"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const websocket_1 = require("../websocket");
const router = (0, express_1.Router)();
// Add order(s) to session (supports both single item and bulk array of items)
router.post('/', auth_1.authenticateToken, async (req, res) => {
    const { sessionId, menuItemId, quantity, items } = req.body;
    if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
    }
    try {
        const session = await index_1.prisma.session.findUnique({
            where: { id: sessionId }
        });
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        let itemsToProcess = [];
        if (items && Array.isArray(items) && items.length > 0) {
            itemsToProcess = items;
        }
        else {
            if (!menuItemId || quantity === undefined) {
                return res.status(400).json({ error: 'menuItemId and quantity, or items array, is required' });
            }
            itemsToProcess = [{ menuItemId, quantity }];
        }
        // Step 1: Bulk lookup menu items outside the transaction to reduce transaction duration
        const menuItemIds = itemsToProcess.map(item => parseInt(item.menuItemId.toString()));
        const menuItems = await index_1.prisma.menuItem.findMany({
            where: { id: { in: menuItemIds } }
        });
        const menuItemsMap = new Map(menuItems.map(m => [m.id, m]));
        // Quick validation checks
        for (const item of itemsToProcess) {
            const id = parseInt(item.menuItemId.toString());
            if (!menuItemsMap.has(id)) {
                return res.status(404).json({ error: `Menu item with ID ${id} not found` });
            }
        }
        const createdOrders = await index_1.prisma.$transaction(async (tx) => {
            await tx.order.createMany({
                data: itemsToProcess.map((item) => {
                    const menuItem = menuItemsMap.get(parseInt(item.menuItemId.toString()));
                    return {
                        sessionId,
                        menuItemId: menuItem.id,
                        quantity: parseInt(item.quantity.toString()),
                        price: menuItem.price,
                    };
                }),
            });
            const orders = await tx.order.findMany({
                where: {
                    sessionId,
                    menuItemId: { in: menuItemIds },
                },
                orderBy: { id: 'desc' },
                take: itemsToProcess.length,
                include: { menuItem: true },
            });
            orders.reverse();
            orders.push(...[]); // just keeping array reference matching typings if needed
            const updatedSession = await tx.session.findUnique({
                where: { id: sessionId },
                include: { orders: true, payments: true }
            });
            if (updatedSession) {
                const menuCost = updatedSession.orders.reduce((sum, o) => sum + (o.quantity * o.price), 0);
                const totalBill = Math.max(0, menuCost + updatedSession.gameCost + updatedSession.customAmount);
                const paidAmount = updatedSession.payments.reduce((sum, p) => sum + p.amount, 0);
                let paymentStatus = updatedSession.paymentStatus;
                if (updatedSession.status === 'completed') {
                    if (paidAmount >= totalBill) {
                        paymentStatus = 'paid';
                    }
                    else if (paidAmount > 0) {
                        paymentStatus = 'partially_paid';
                    }
                }
                await tx.session.update({
                    where: { id: sessionId },
                    data: { menuCost, totalBill, paymentStatus }
                });
            }
            return orders;
        }, {
            maxWait: 10000,
            timeout: 15000
        });
        (0, websocket_1.broadcast)({ type: 'ORDER_ADD_BULK', orders: createdOrders, sessionId });
        // For backwards compatibility, if it was a single item request, return the first order object
        if (items && Array.isArray(items) && items.length > 0) {
            res.status(201).json(createdOrders);
        }
        else {
            res.status(201).json(createdOrders[0]);
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Remove order from session
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const order = await index_1.prisma.order.findUnique({
            where: { id: orderId }
        });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        // Fetch the session's current totals BEFORE deleting, so we can do in-memory math
        const session = await index_1.prisma.session.findUnique({
            where: { id: order.sessionId },
            select: { menuCost: true, gameCost: true, customAmount: true, paymentStatus: true, status: true, payments: { select: { amount: true } } }
        });
        await index_1.prisma.order.delete({
            where: { id: orderId }
        });
        if (session) {
            // In-memory calculation — no extra DB round-trip needed
            const removedCost = order.quantity * order.price;
            const newMenuCost = Math.max(0, session.menuCost - removedCost);
            const newTotalBill = Math.max(0, newMenuCost + session.gameCost + session.customAmount);
            const paidAmount = session.payments.reduce((sum, p) => sum + p.amount, 0);
            let paymentStatus = session.paymentStatus;
            if (session.status === 'completed') {
                if (paidAmount >= newTotalBill) {
                    paymentStatus = 'paid';
                }
                else if (paidAmount > 0) {
                    paymentStatus = 'partially_paid';
                }
            }
            await index_1.prisma.session.update({
                where: { id: order.sessionId },
                data: { menuCost: newMenuCost, totalBill: newTotalBill, paymentStatus }
            });
        }
        (0, websocket_1.broadcast)({ type: 'ORDER_REMOVE', orderId, sessionId: order.sessionId });
        res.json({ message: 'Order removed successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

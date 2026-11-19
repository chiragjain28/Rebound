"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const websocket_1 = require("../websocket");
const router = (0, express_1.Router)();
// Add order(s) to visit (supports both single item and bulk array of items, with customer-centric auto-visit resolution)
router.post('/', auth_1.authenticateToken, async (req, res) => {
    const { visitId: rawVisitId, sessionId, customerId, customerPhone, customerName, menuItemId, quantity, items } = req.body;
    let visitId = rawVisitId || sessionId;
    try {
        // If no visitId provided, resolve or auto-create active visit for customer
        if (!visitId && (customerId || customerPhone || customerName)) {
            let customer = null;
            if (customerId) {
                customer = await index_1.prisma.customer.findUnique({ where: { id: parseInt(customerId) } });
            }
            if (!customer && customerPhone) {
                customer = await index_1.prisma.customer.findUnique({ where: { phone: customerPhone.toString().trim() } });
            }
            if (!customer && customerName) {
                customer = await index_1.prisma.customer.findFirst({
                    where: { name: { equals: customerName.toString().trim(), mode: 'insensitive' } }
                });
            }
            if (!customer) {
                return res.status(404).json({ error: 'Customer not found' });
            }
            // Check for active visit
            let activeVisit = await index_1.prisma.visit.findFirst({
                where: { customerId: customer.id, status: 'active' }
            });
            // If no active visit, auto-create one now!
            if (!activeVisit) {
                const now = new Date();
                const pad = (n) => n.toString().padStart(2, '0');
                const timestamp = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
                const cleanSlug = customer.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const newVisitId = `${timestamp}_${cleanSlug}`;
                const staffUsername = req.user?.username || 'chirag';
                activeVisit = await index_1.prisma.visit.create({
                    data: {
                        id: newVisitId,
                        customerId: customer.id,
                        staffUsername: staffUsername.toLowerCase(),
                        startTime: now,
                        status: 'active'
                    }
                });
                await index_1.prisma.customer.update({
                    where: { id: customer.id },
                    data: { totalVisits: { increment: 1 } }
                });
                (0, websocket_1.broadcast)({ type: 'VISIT_CREATED', visit: activeVisit });
            }
            visitId = activeVisit.id;
        }
        if (!visitId) {
            return res.status(400).json({ error: 'visitId or customerId is required' });
        }
        const visit = await index_1.prisma.visit.findUnique({
            where: { id: visitId }
        });
        if (!visit) {
            return res.status(404).json({ error: 'Visit not found' });
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
        // Step 1: Bulk lookup menu items
        const menuItemIds = itemsToProcess.map(item => parseInt(item.menuItemId.toString()));
        const menuItems = await index_1.prisma.menuItem.findMany({
            where: { id: { in: menuItemIds } }
        });
        const menuItemsMap = new Map(menuItems.map(m => [m.id, m]));
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
                        visitId,
                        menuItemId: menuItem.id,
                        quantity: parseInt(item.quantity.toString()),
                        price: menuItem.price,
                    };
                }),
            });
            // Auto-deduct inventory for ordered items
            for (const item of itemsToProcess) {
                const mId = parseInt(item.menuItemId.toString());
                const deductQty = parseInt(item.quantity.toString());
                const invItem = await tx.inventoryItem.findUnique({
                    where: { menuItemId: mId }
                });
                if (invItem && deductQty > 0) {
                    const newStock = Math.max(0, invItem.currentStock - deductQty);
                    await tx.inventoryItem.update({
                        where: { id: invItem.id },
                        data: { currentStock: newStock }
                    });
                    await tx.inventoryTransaction.create({
                        data: {
                            itemId: invItem.id,
                            type: 'SALE',
                            quantity: -deductQty,
                            piecesPerBox: invItem.piecesPerBox,
                            stockBefore: invItem.currentStock,
                            stockAfter: newStock,
                            notes: `POS Order for Visit ${visitId}`,
                            staffUsername: req.user?.username || 'staff'
                        }
                    });
                }
            }
            const orders = await tx.order.findMany({
                where: {
                    visitId,
                    menuItemId: { in: menuItemIds },
                },
                orderBy: { id: 'desc' },
                take: itemsToProcess.length,
                include: { menuItem: true },
            });
            orders.reverse();
            const updatedVisit = await tx.visit.findUnique({
                where: { id: visitId },
                include: { orders: true, payments: true }
            });
            if (updatedVisit) {
                const itemsTotal = updatedVisit.orders.reduce((sum, o) => sum + (o.quantity * o.price), 0);
                const visitTotal = Math.max(0, itemsTotal + updatedVisit.tablesTotal + updatedVisit.customAmount);
                const paidAmount = updatedVisit.payments.reduce((sum, p) => sum + p.amount, 0);
                const balanceDue = Math.max(0, visitTotal - paidAmount);
                let paymentStatus = updatedVisit.paymentStatus;
                if (updatedVisit.status === 'completed') {
                    if (paidAmount >= visitTotal) {
                        paymentStatus = 'paid';
                    }
                    else if (paidAmount > 0) {
                        paymentStatus = 'partially_paid';
                    }
                }
                await tx.visit.update({
                    where: { id: visitId },
                    data: { itemsTotal, visitTotal, balanceDue, paymentStatus }
                });
            }
            return orders;
        }, {
            maxWait: 10000,
            timeout: 15000
        });
        (0, websocket_1.broadcast)({ type: 'ORDER_ADD_BULK', orders: createdOrders, visitId, sessionId: visitId });
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
// Remove order from visit
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const order = await index_1.prisma.order.findUnique({
            where: { id: orderId }
        });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const visit = await index_1.prisma.visit.findUnique({
            where: { id: order.visitId },
            include: { payments: true }
        });
        await index_1.prisma.order.delete({
            where: { id: orderId }
        });
        // Restore inventory stock on order cancellation
        try {
            const invItem = await index_1.prisma.inventoryItem.findUnique({
                where: { menuItemId: order.menuItemId }
            });
            if (invItem && order.quantity > 0) {
                const newStock = invItem.currentStock + order.quantity;
                await index_1.prisma.inventoryItem.update({
                    where: { id: invItem.id },
                    data: { currentStock: newStock }
                });
                await index_1.prisma.inventoryTransaction.create({
                    data: {
                        itemId: invItem.id,
                        type: 'RETURN',
                        quantity: order.quantity,
                        piecesPerBox: invItem.piecesPerBox,
                        stockBefore: invItem.currentStock,
                        stockAfter: newStock,
                        notes: `Cancelled order #${orderId} for Visit ${order.visitId}`,
                        staffUsername: req.user?.username || 'staff'
                    }
                });
            }
        }
        catch (invErr) {
            console.error('Failed to restore inventory stock on order deletion:', invErr);
        }
        if (visit) {
            const remainingOrders = await index_1.prisma.order.findMany({
                where: { visitId: order.visitId }
            });
            const newItemsTotal = remainingOrders.reduce((sum, o) => sum + (o.quantity * o.price), 0);
            const newVisitTotal = Math.max(0, newItemsTotal + visit.tablesTotal + visit.customAmount);
            const paidAmount = visit.payments.reduce((sum, p) => sum + p.amount, 0);
            const balanceDue = Math.max(0, newVisitTotal - paidAmount);
            let paymentStatus = visit.paymentStatus;
            if (visit.status === 'completed') {
                if (paidAmount >= newVisitTotal) {
                    paymentStatus = 'paid';
                }
                else if (paidAmount > 0) {
                    paymentStatus = 'partially_paid';
                }
            }
            await index_1.prisma.visit.update({
                where: { id: order.visitId },
                data: { itemsTotal: newItemsTotal, visitTotal: newVisitTotal, balanceDue, paymentStatus }
            });
        }
        (0, websocket_1.broadcast)({ type: 'ORDER_REMOVE', orderId, visitId: order.visitId, sessionId: order.visitId });
        res.json({ message: 'Order removed successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const websocket_1 = require("../websocket");
const router = (0, express_1.Router)();
// Get paginated and searchable debtor groups
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        // Step 1: Find unique customer names with unpaid udhars
        const whereClause = {
            status: 'unpaid'
        };
        if (search) {
            whereClause.customerName = {
                contains: search,
                mode: 'insensitive'
            };
        }
        const groupedDebtors = await index_1.prisma.udhar.groupBy({
            by: ['customerName'],
            where: whereClause,
            _max: {
                createdAt: true
            }
        });
        // Step 2: Sort grouped debtors by their most recent unpaid debt date descending
        const sortedDebtors = groupedDebtors.sort((a, b) => {
            const dateA = a._max.createdAt ? new Date(a._max.createdAt).getTime() : 0;
            const dateB = b._max.createdAt ? new Date(b._max.createdAt).getTime() : 0;
            return dateB - dateA;
        });
        const total = sortedDebtors.length;
        const paginatedDebtorNames = sortedDebtors.slice(skip, skip + limit).map(d => d.customerName);
        // Step 3: Fetch all udhar entries (both paid and unpaid) for only the paginated customer names
        const udhars = paginatedDebtorNames.length > 0 ? await index_1.prisma.udhar.findMany({
            where: {
                customerName: { in: paginatedDebtorNames, mode: 'insensitive' }
            },
            include: { session: { include: { table: true } } },
            orderBy: { createdAt: 'desc' }
        }) : [];
        res.json({
            udhars,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create udhar entry
router.post('/', auth_1.authenticateToken, async (req, res) => {
    const { customerName, amount, sessionId } = req.body;
    if (!customerName || amount === undefined || isNaN(amount)) {
        return res.status(400).json({ error: 'customerName and amount are required' });
    }
    try {
        const udhar = await index_1.prisma.udhar.create({
            data: {
                customerName,
                amount: parseFloat(amount),
                sessionId: sessionId || null,
                status: 'unpaid'
            },
            include: { session: { include: { table: true } } }
        });
        if (sessionId) {
            await index_1.prisma.session.update({
                where: { id: sessionId },
                data: { paymentStatus: 'udhar' }
            });
        }
        (0, websocket_1.broadcast)({ type: 'UDHAR_CREATE', udhar });
        res.status(201).json(udhar);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Settlement / Pay udhar
router.post('/:id/pay', auth_1.authenticateToken, async (req, res) => {
    try {
        const udharId = parseInt(req.params.id);
        const udhar = await index_1.prisma.udhar.findUnique({
            where: { id: udharId }
        });
        if (!udhar) {
            return res.status(404).json({ error: 'Udhar entry not found' });
        }
        const updatedUdhar = await index_1.prisma.udhar.update({
            where: { id: udharId },
            data: { status: 'paid' },
            include: { session: { include: { table: true } } }
        });
        if (udhar.sessionId) {
            await index_1.prisma.session.update({
                where: { id: udhar.sessionId },
                data: { paymentStatus: 'paid' }
            });
        }
        (0, websocket_1.broadcast)({ type: 'UDHAR_PAY', udhar: updatedUdhar });
        res.json(updatedUdhar);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

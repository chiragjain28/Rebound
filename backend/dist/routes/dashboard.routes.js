"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Run all 6 major independent database queries in parallel!
        const [tables, activeSessions, completedSessions, paymentsToday, unpaidUdhars, totalCompletedSessions] = await Promise.all([
            index_1.prisma.table.findMany({
                orderBy: { number: 'asc' }
            }),
            index_1.prisma.session.findMany({
                relationLoadStrategy: 'join',
                where: { status: 'active' },
                include: {
                    table: true,
                    orders: {
                        include: { menuItem: true }
                    },
                    payments: true,
                    tablePlays: {
                        include: { table: true }
                    }
                }
            }),
            index_1.prisma.session.findMany({
                relationLoadStrategy: 'join',
                where: { status: 'completed' },
                orderBy: { endTime: 'desc' },
                take: 10,
                include: {
                    table: true,
                    orders: {
                        include: { menuItem: true }
                    },
                    payments: true,
                    tablePlays: {
                        include: { table: true }
                    }
                }
            }),
            index_1.prisma.payment.findMany({
                where: {
                    createdAt: { gte: today }
                }
            }),
            index_1.prisma.udhar.findMany({
                where: { status: 'unpaid' }
            }),
            index_1.prisma.session.count({
                where: { status: 'completed' }
            })
        ]);
        const salesToday = paymentsToday.reduce((sum, p) => sum + p.amount, 0);
        const udharOutstanding = unpaidUdhars.reduce((sum, u) => sum + u.amount, 0);
        // Batch query for prior udhars of all active sessions to eliminate N+1 queries
        const activeCustomerNames = activeSessions.map(s => s.customerName.trim());
        const allPriorUdhars = activeCustomerNames.length > 0 ? await index_1.prisma.udhar.findMany({
            where: {
                customerName: { in: activeCustomerNames, mode: 'insensitive' },
                status: 'unpaid'
            }
        }) : [];
        // Group the unpaid prior udhars by customer name in-memory
        const activeSessionsWithUdhar = activeSessions.map((s) => {
            const trimmedCustomerName = s.customerName.trim().toLowerCase();
            const priorUdhar = allPriorUdhars
                .filter(u => u.customerName.trim().toLowerCase() === trimmedCustomerName && u.sessionId !== s.id)
                .reduce((sum, u) => sum + u.amount, 0);
            return {
                ...s,
                priorUdhar
            };
        });
        res.json({
            tables,
            activeSessionsCount: activeSessions.length,
            activeSessions: activeSessionsWithUdhar,
            completedSessions,
            totalCompletedSessions,
            salesToday,
            udharOutstanding
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/tables', auth_1.authenticateToken, async (req, res) => {
    try {
        const tables = await index_1.prisma.table.findMany({
            orderBy: { number: 'asc' }
        });
        res.json(tables);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

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
        const [tables, activeVisits, completedVisits, paymentsToday, unpaidCredits, totalCompletedVisits] = await Promise.all([
            index_1.prisma.table.findMany({
                orderBy: { number: 'asc' }
            }),
            index_1.prisma.visit.findMany({
                where: { status: 'active' },
                include: {
                    customer: true,
                    orders: {
                        include: { menuItem: true }
                    },
                    payments: true,
                    tablePlays: {
                        include: { table: true }
                    },
                    creditRecords: true
                },
                orderBy: { startTime: 'desc' }
            }),
            index_1.prisma.visit.findMany({
                where: { status: 'completed' },
                orderBy: { endTime: 'desc' },
                take: 10,
                include: {
                    customer: true,
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
            index_1.prisma.creditRecord.findMany({
                where: { status: 'unpaid' }
            }),
            index_1.prisma.visit.count({
                where: { status: 'completed' }
            })
        ]);
        const salesToday = paymentsToday.reduce((sum, p) => sum + p.amount, 0);
        const totalCreditOutstanding = unpaidCredits.reduce((sum, c) => sum + (c.amount - c.settledAmount), 0);
        // Format active visits with backward compatibility keys for dashboard UI
        const formattedActiveVisits = activeVisits.map((v) => {
            const activeTablePlay = v.tablePlays.find(tp => !tp.endTime);
            return {
                ...v,
                customerName: v.customer?.name || 'Guest',
                customerPhone: v.customer?.phone || '',
                gameType: activeTablePlay?.gameType || 'None',
                playerCount: activeTablePlay?.playerCount || 1,
                tableId: activeTablePlay?.tableId || null,
                table: activeTablePlay?.table || null,
                gameCost: v.tablesTotal,
                menuCost: v.itemsTotal,
                totalBill: v.visitTotal,
                priorUdhar: v.customer?.currentCreditDue || 0,
                priorCredit: v.customer?.currentCreditDue || 0
            };
        });
        const formattedCompletedVisits = completedVisits.map((v) => ({
            ...v,
            customerName: v.customer?.name || 'Guest',
            customerPhone: v.customer?.phone || '',
            gameCost: v.tablesTotal,
            menuCost: v.itemsTotal,
            totalBill: v.visitTotal
        }));
        res.json({
            tables,
            activeVisitsCount: formattedActiveVisits.length,
            activeSessionsCount: formattedActiveVisits.length,
            activeVisits: formattedActiveVisits,
            activeSessions: formattedActiveVisits,
            completedVisits: formattedCompletedVisits,
            completedSessions: formattedCompletedVisits,
            totalCompletedVisits,
            totalCompletedSessions: totalCompletedVisits,
            salesToday,
            totalCreditOutstanding,
            udharOutstanding: totalCreditOutstanding
        });
    }
    catch (error) {
        console.error('Error fetching dashboard summary:', error);
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
// GET /api/dashboard/analytics - Comprehensive sales, revenue & customer retention breakdown
router.get('/analytics', auth_1.authenticateToken, async (req, res) => {
    try {
        const range = req.query.range || '30days';
        const now = new Date();
        let startDate = new Date();
        if (range === 'today') {
            startDate.setHours(0, 0, 0, 0);
        }
        else if (range === '7days') {
            startDate.setDate(now.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
        }
        else if (range === 'month') {
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
        }
        else {
            startDate.setDate(now.getDate() - 30);
            startDate.setHours(0, 0, 0, 0);
        }
        const completedVisits = await index_1.prisma.visit.findMany({
            where: {
                status: 'completed',
                startTime: { gte: startDate }
            },
            include: {
                customer: true,
                tablePlays: true,
                orders: {
                    include: { menuItem: true }
                },
                payments: true,
                creditRecords: true
            },
            orderBy: { startTime: 'desc' }
        });
        const payments = await index_1.prisma.payment.findMany({
            where: {
                createdAt: { gte: startDate }
            }
        });
        let tableRevenue = 0;
        let cafeRevenue = 0;
        let drinksRevenue = 0;
        let cigarettesRevenue = 0;
        let otherMenuRevenue = 0;
        const itemSalesMap = new Map();
        const customerPhoneSet = new Set();
        for (const v of completedVisits) {
            if (v.customer?.phone) {
                customerPhoneSet.add(v.customer.phone.trim());
            }
            tableRevenue += v.tablesTotal || 0;
            for (const o of v.orders) {
                const cat = o.menuItem?.category?.toLowerCase() || '';
                const orderRev = o.price * o.quantity;
                if (cat.includes('cafe')) {
                    cafeRevenue += orderRev;
                }
                else if (cat.includes('drink') || cat.includes('cold')) {
                    drinksRevenue += orderRev;
                }
                else if (cat.includes('cigar')) {
                    cigarettesRevenue += orderRev;
                }
                else {
                    otherMenuRevenue += orderRev;
                }
                const itemName = o.menuItem?.name || 'Unknown Item';
                const existing = itemSalesMap.get(itemName) || {
                    name: itemName,
                    category: o.menuItem?.category || 'General',
                    quantity: 0,
                    revenue: 0
                };
                existing.quantity += o.quantity;
                existing.revenue += orderRev;
                itemSalesMap.set(itemName, existing);
            }
        }
        const totalRevenue = tableRevenue + cafeRevenue + drinksRevenue + cigarettesRevenue + otherMenuRevenue;
        const totalPaymentsReceived = payments.reduce((sum, p) => sum + p.amount, 0);
        const topSellingItems = Array.from(itemSalesMap.values())
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);
        res.json({
            range,
            totalVisits: completedVisits.length,
            totalSessions: completedVisits.length,
            uniqueCustomers: customerPhoneSet.size,
            totalRevenue,
            totalPaymentsReceived,
            categoryBreakdown: {
                tables: tableRevenue,
                cafe: cafeRevenue,
                coldDrinks: drinksRevenue,
                cigarettes: cigarettesRevenue,
                other: otherMenuRevenue
            },
            topSellingItems
        });
    }
    catch (error) {
        console.error('Error in dashboard analytics:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

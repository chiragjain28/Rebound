"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const websocket_1 = require("../websocket");
const router = (0, express_1.Router)();
// Record a payment (supports visit payment or customer credit settlement)
router.post('/', auth_1.authenticateToken, async (req, res) => {
    const { visitId: rawVisitId, sessionId, customerId: rawCustId, amount, method, type } = req.body;
    const visitId = rawVisitId || sessionId;
    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0 || !method) {
        return res.status(400).json({ error: 'Valid amount and method are required' });
    }
    try {
        let customerId = rawCustId ? parseInt(rawCustId) : null;
        let visit = null;
        if (visitId) {
            visit = await index_1.prisma.visit.findUnique({
                where: { id: visitId },
                include: {
                    payments: true,
                    orders: true,
                    tablePlays: true,
                    customer: true
                }
            });
            if (!visit) {
                return res.status(404).json({ error: 'Visit not found' });
            }
            customerId = visit.customerId;
        }
        if (!customerId) {
            return res.status(400).json({ error: 'customerId or visitId is required' });
        }
        // Create payment record
        const payment = await index_1.prisma.payment.create({
            data: {
                customerId,
                visitId: visit ? visit.id : null,
                amount: payAmount,
                method,
                type: type || (visit ? 'visit_payment' : 'credit_settlement')
            }
        });
        // If visit exists, update visit paidAmount and balanceDue
        if (visit) {
            const allPayments = await index_1.prisma.payment.findMany({ where: { visitId: visit.id } });
            const totalPaidForVisit = allPayments.reduce((sum, p) => sum + p.amount, 0);
            const balanceDue = Math.max(0, visit.visitTotal - totalPaidForVisit);
            let paymentStatus = visit.paymentStatus;
            if (balanceDue === 0) {
                paymentStatus = 'paid';
            }
            else if (totalPaidForVisit > 0) {
                paymentStatus = 'partially_paid';
            }
            await index_1.prisma.visit.update({
                where: { id: visit.id },
                data: {
                    paidAmount: totalPaidForVisit,
                    balanceDue,
                    paymentStatus
                }
            });
            // If payment exceeds visit total, apply excess to customer's unpaid credit records
            let excess = totalPaidForVisit - visit.visitTotal;
            if (excess > 0) {
                const unpaidCredits = await index_1.prisma.creditRecord.findMany({
                    where: {
                        customerId,
                        status: 'unpaid',
                        visitId: { not: visit.id }
                    },
                    orderBy: { createdAt: 'asc' }
                });
                for (const cr of unpaidCredits) {
                    if (excess <= 0)
                        break;
                    const due = cr.amount - cr.settledAmount;
                    if (excess >= due) {
                        excess -= due;
                        await index_1.prisma.creditRecord.update({
                            where: { id: cr.id },
                            data: { status: 'paid', settledAmount: cr.amount }
                        });
                    }
                    else {
                        await index_1.prisma.creditRecord.update({
                            where: { id: cr.id },
                            data: { settledAmount: cr.settledAmount + excess }
                        });
                        excess = 0;
                    }
                }
            }
        }
        else {
            // General credit settlement: settle unpaid credit records directly
            let remainingToSettle = payAmount;
            const unpaidCredits = await index_1.prisma.creditRecord.findMany({
                where: { customerId, status: 'unpaid' },
                orderBy: { createdAt: 'asc' }
            });
            for (const cr of unpaidCredits) {
                if (remainingToSettle <= 0)
                    break;
                const due = cr.amount - cr.settledAmount;
                if (remainingToSettle >= due) {
                    remainingToSettle -= due;
                    await index_1.prisma.creditRecord.update({
                        where: { id: cr.id },
                        data: { status: 'paid', settledAmount: cr.amount }
                    });
                    if (cr.visitId) {
                        const vRemaining = await index_1.prisma.creditRecord.findMany({
                            where: { visitId: cr.visitId, status: 'unpaid' }
                        });
                        const vDue = vRemaining.reduce((sum, r) => sum + (r.amount - r.settledAmount), 0);
                        await index_1.prisma.visit.update({
                            where: { id: cr.visitId },
                            data: {
                                balanceDue: vDue,
                                paymentStatus: vDue === 0 ? 'paid' : 'partially_paid'
                            }
                        });
                    }
                }
                else {
                    await index_1.prisma.creditRecord.update({
                        where: { id: cr.id },
                        data: { settledAmount: cr.settledAmount + remainingToSettle }
                    });
                    if (cr.visitId) {
                        const vRemaining = await index_1.prisma.creditRecord.findMany({
                            where: { visitId: cr.visitId, status: 'unpaid' }
                        });
                        const vDue = vRemaining.reduce((sum, r) => sum + (r.amount - r.settledAmount), 0);
                        await index_1.prisma.visit.update({
                            where: { id: cr.visitId },
                            data: {
                                balanceDue: Math.max(0, vDue),
                                paymentStatus: 'partially_paid'
                            }
                        });
                    }
                    remainingToSettle = 0;
                }
            }
        }
        // Recompute customer aggregates cleanly
        const remainingCredits = await index_1.prisma.creditRecord.findMany({
            where: { customerId, status: 'unpaid' }
        });
        const currentCreditDue = remainingCredits.reduce((sum, c) => sum + (c.amount - c.settledAmount), 0);
        const [visitAgg, paymentAgg] = await Promise.all([
            index_1.prisma.visit.aggregate({
                where: { customerId },
                _sum: { visitTotal: true }
            }),
            index_1.prisma.payment.aggregate({
                where: { customerId },
                _sum: { amount: true }
            })
        ]);
        await index_1.prisma.customer.update({
            where: { id: customerId },
            data: {
                currentCreditDue,
                lifetimeSpend: visitAgg._sum.visitTotal || 0,
                lifetimePaid: paymentAgg._sum.amount || 0
            }
        });
        (0, websocket_1.broadcast)({ type: 'PAYMENT_RECORD', payment, visitId });
        res.status(201).json(payment);
    }
    catch (error) {
        console.error('Error recording payment:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

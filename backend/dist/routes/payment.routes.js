"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const websocket_1 = require("../websocket");
const router = (0, express_1.Router)();
// Record a payment
router.post('/', auth_1.authenticateToken, async (req, res) => {
    const { sessionId, amount, method } = req.body;
    if (!sessionId || amount === undefined || isNaN(amount) || !method) {
        return res.status(400).json({ error: 'sessionId, amount, and method are required' });
    }
    try {
        const session = await index_1.prisma.session.findUnique({
            where: { id: sessionId },
            include: { payments: true }
        });
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        const payment = await index_1.prisma.payment.create({
            data: {
                sessionId,
                amount: parseFloat(amount),
                method
            }
        });
        const totalPayments = session.payments.reduce((sum, p) => sum + p.amount, 0) + parseFloat(amount);
        let paymentStatus = session.paymentStatus;
        if (session.status === 'completed') {
            if (totalPayments >= session.totalBill) {
                paymentStatus = 'paid';
            }
            else if (totalPayments > 0) {
                paymentStatus = 'partially_paid';
            }
        }
        else {
            paymentStatus = totalPayments > 0 ? 'partially_paid' : 'pending';
        }
        const updatedSession = await index_1.prisma.session.update({
            where: { id: sessionId },
            data: { paymentStatus },
            include: { table: true }
        });
        (0, websocket_1.broadcast)({ type: 'PAYMENT_RECORDED', payment, session: updatedSession });
        res.status(201).json(payment);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

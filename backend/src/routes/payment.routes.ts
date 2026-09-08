import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';
import { broadcast } from '../websocket';

const router = Router();

// Record a payment
router.post('/', authenticateToken, async (req, res) => {
  const { sessionId, amount, method } = req.body;

  if (!sessionId || amount === undefined || isNaN(amount) || !method) {
    return res.status(400).json({ error: 'sessionId, amount, and method are required' });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { payments: true }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const payment = await prisma.payment.create({
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
      } else if (totalPayments > 0) {
        paymentStatus = 'partially_paid';
      }
    } else {
      paymentStatus = totalPayments > 0 ? 'partially_paid' : 'pending';
    }

    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: { paymentStatus },
      include: { table: true }
    });

    broadcast({ type: 'PAYMENT_RECORDED', payment, session: updatedSession });
    res.status(201).json(payment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

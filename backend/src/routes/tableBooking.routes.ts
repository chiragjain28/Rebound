import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';
import { broadcast } from '../websocket';

const router = Router();

// Get all bookings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const bookings = await prisma.tableBooking.findMany({
      include: { table: true },
      orderBy: { bookingTime: 'asc' }
    });
    res.json(bookings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a booking
router.post('/', authenticateToken, async (req, res) => {
  const { tableId, customerName, contactNumber, bookingTime } = req.body;

  if (!tableId || !customerName || !bookingTime) {
    return res.status(400).json({ error: 'tableId, customerName, and bookingTime are required' });
  }

  try {
    const table = await prisma.table.findUnique({
      where: { id: parseInt(tableId) }
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    const booking = await prisma.tableBooking.create({
      data: {
        tableId: parseInt(tableId),
        customerName,
        contactNumber,
        bookingTime: new Date(bookingTime)
      },
      include: { table: true }
    });

    broadcast({ type: 'BOOKING_CREATE', booking });
    res.status(201).json(booking);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete/Cancel booking
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const booking = await prisma.tableBooking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await prisma.tableBooking.delete({
      where: { id: bookingId }
    });

    broadcast({ type: 'BOOKING_DELETE', bookingId });
    res.json({ message: 'Booking cancelled successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

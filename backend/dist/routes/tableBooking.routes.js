"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const websocket_1 = require("../websocket");
const router = (0, express_1.Router)();
// Get all bookings
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const bookings = await index_1.prisma.tableBooking.findMany({
            include: { table: true },
            orderBy: { bookingTime: 'asc' }
        });
        res.json(bookings);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create a booking
router.post('/', auth_1.authenticateToken, async (req, res) => {
    const { tableId, customerName, contactNumber, bookingTime } = req.body;
    if (!tableId || !customerName || !bookingTime) {
        return res.status(400).json({ error: 'tableId, customerName, and bookingTime are required' });
    }
    try {
        const table = await index_1.prisma.table.findUnique({
            where: { id: parseInt(tableId) }
        });
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }
        const booking = await index_1.prisma.tableBooking.create({
            data: {
                tableId: parseInt(tableId),
                customerName,
                contactNumber,
                bookingTime: new Date(bookingTime)
            },
            include: { table: true }
        });
        (0, websocket_1.broadcast)({ type: 'BOOKING_CREATE', booking });
        res.status(201).json(booking);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Delete/Cancel booking
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
        const booking = await index_1.prisma.tableBooking.findUnique({
            where: { id: bookingId }
        });
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        await index_1.prisma.tableBooking.delete({
            where: { id: bookingId }
        });
        (0, websocket_1.broadcast)({ type: 'BOOKING_DELETE', bookingId });
        res.json({ message: 'Booking cancelled successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

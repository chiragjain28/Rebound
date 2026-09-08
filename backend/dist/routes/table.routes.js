"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get all tables
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const tables = await index_1.prisma.table.findMany({
            orderBy: [
                { gameType: 'asc' },
                { number: 'asc' }
            ]
        });
        res.json(tables);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create a single table
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { number, gameType } = req.body;
        if (!number || !gameType) {
            return res.status(400).json({ error: 'Table number and gameType are required' });
        }
        const table = await index_1.prisma.table.create({
            data: {
                number: parseInt(number),
                gameType,
                status: 'available'
            }
        });
        res.status(201).json(table);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create multiple tables (Bulk)
router.post('/bulk', auth_1.authenticateToken, async (req, res) => {
    try {
        const { tables } = req.body;
        if (!tables || !Array.isArray(tables)) {
            return res.status(400).json({ error: 'An array of tables is required' });
        }
        const created = await index_1.prisma.table.createMany({
            data: tables.map((t) => ({
                number: parseInt(t.number),
                gameType: t.gameType,
                status: 'available'
            })),
            skipDuplicates: true
        });
        res.status(201).json({ count: created.count });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

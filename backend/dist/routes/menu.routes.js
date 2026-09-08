"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Get all menu items
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const menuItems = await index_1.prisma.menuItem.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(menuItems);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create a single menu item
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { name, price, category } = req.body;
        if (!name || price === undefined || !category) {
            return res.status(400).json({ error: 'name, price, and category are required' });
        }
        const item = await index_1.prisma.menuItem.create({
            data: {
                name,
                price: parseFloat(price),
                category
            }
        });
        res.status(201).json(item);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Create multiple menu items (Bulk)
router.post('/bulk', auth_1.authenticateToken, async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: 'An array of items is required' });
        }
        const created = await index_1.prisma.menuItem.createMany({
            data: items.map((i) => ({
                name: i.name,
                price: parseFloat(i.price),
                category: i.category
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

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
// Update a menu item (Name, Price, Category)
router.put('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid item ID' });
        }
        const { name, price, category } = req.body;
        if (!name || price === undefined) {
            return res.status(400).json({ error: 'Name and price are required' });
        }
        const existing = await index_1.prisma.menuItem.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        const updated = await index_1.prisma.menuItem.update({
            where: { id },
            data: {
                name: name.trim(),
                price: parseFloat(price),
                ...(category ? { category: category.trim() } : {})
            }
        });
        res.json(updated);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Delete a menu item (only if not used in orders)
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid item ID' });
        }
        const existing = await index_1.prisma.menuItem.findUnique({
            where: { id },
            include: { orders: { take: 1 } }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Menu item not found' });
        }
        if (existing.orders.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete this item because it has existing order records in past sessions.'
            });
        }
        await index_1.prisma.menuItem.delete({ where: { id } });
        res.json({ message: `Menu item "${existing.name}" deleted successfully` });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

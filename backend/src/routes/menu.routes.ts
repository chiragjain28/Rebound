import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get all menu items
router.get('/', authenticateToken, async (req, res) => {
  try {
    const menuItems = await prisma.menuItem.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(menuItems);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
// Create a single menu item
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, price, category } = req.body;
    if (!name || price === undefined || !category) {
      return res.status(400).json({ error: 'name, price, and category are required' });
    }

    const item = await prisma.menuItem.create({
      data: {
        name,
        price: parseFloat(price),
        category
      }
    });
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create multiple menu items (Bulk)
router.post('/bulk', authenticateToken, async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'An array of items is required' });
    }

    const created = await prisma.menuItem.createMany({
      data: items.map((i: any) => ({
        name: i.name,
        price: parseFloat(i.price),
        category: i.category
      })),
      skipDuplicates: true
    });

    res.status(201).json({ count: created.count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

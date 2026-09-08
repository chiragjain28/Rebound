import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get all tables
router.get('/', authenticateToken, async (req, res) => {
  try {
    const tables = await prisma.table.findMany({
      orderBy: [
        { gameType: 'asc' },
        { number: 'asc' }
      ]
    });
    res.json(tables);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a single table
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { number, gameType } = req.body;
    if (!number || !gameType) {
      return res.status(400).json({ error: 'Table number and gameType are required' });
    }

    const table = await prisma.table.create({
      data: {
        number: parseInt(number),
        gameType,
        status: 'available'
      }
    });
    res.status(201).json(table);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create multiple tables (Bulk)
router.post('/bulk', authenticateToken, async (req, res) => {
  try {
    const { tables } = req.body;
    if (!tables || !Array.isArray(tables)) {
      return res.status(400).json({ error: 'An array of tables is required' });
    }

    const created = await prisma.table.createMany({
      data: tables.map((t: any) => ({
        number: parseInt(t.number),
        gameType: t.gameType,
        status: 'available'
      })),
      skipDuplicates: true
    });

    res.status(201).json({ count: created.count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

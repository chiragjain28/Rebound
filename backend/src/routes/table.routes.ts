import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';
import { broadcast } from '../websocket';

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

// Assign a table directly to an existing or new customer
router.post('/:id/assign', authenticateToken, async (req: any, res) => {
  try {
    const tableId = parseInt(req.params.id);
    const { customerId, customerName, customerPhone } = req.body;
    const staffUsername = req.user?.username || 'chirag';

    // 1. Verify table
    const table = await prisma.table.findUnique({
      where: { id: tableId }
    });
    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }
    if (table.status === 'occupied') {
      return res.status(400).json({ error: `Table ${table.number} is already occupied` });
    }

    // 2. Identify or create customer
    let customer: any = null;
    if (customerId) {
      customer = await prisma.customer.findUnique({
        where: { id: parseInt(customerId) }
      });
    }

    if (!customer) {
      if (!customerName || !customerName.trim()) {
        return res.status(400).json({ error: 'Customer name is required' });
      }

      const trimmedName = customerName.trim();
      const trimmedPhone = customerPhone ? customerPhone.trim().replace(/\D/g, '') : '';

      // Check if exists by phone if phone is provided
      if (trimmedPhone && trimmedPhone.length >= 10) {
        customer = await prisma.customer.findUnique({
          where: { phone: trimmedPhone }
        });
      }

      // Check if exists by name
      if (!customer) {
        customer = await prisma.customer.findFirst({
          where: { name: { equals: trimmedName, mode: 'insensitive' } }
        });
      }

      // If still not found, create new customer
      if (!customer) {
        const parts = trimmedName.split(/\s+/);
        const firstName = parts[0] || trimmedName;
        const lastName = parts.slice(1).join(' ') || '';
        // If no phone provided, generate unique walk-in identifier
        const finalPhone = (trimmedPhone && trimmedPhone.length >= 10) 
          ? trimmedPhone 
          : `WALK-${Date.now().toString().slice(-6)}`;

        customer = await prisma.customer.create({
          data: {
            firstName,
            lastName,
            name: trimmedName,
            phone: finalPhone
          }
        });
      }
    }

    // 3. Find active visit or create new one for this customer
    let visit = await prisma.visit.findFirst({
      where: {
        customerId: customer.id,
        status: 'active'
      }
    });

    const now = new Date();

    if (!visit) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const timestamp = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const cleanName = customer.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const visitId = `${timestamp}_${cleanName}`;

      visit = await prisma.visit.create({
        data: {
          id: visitId,
          customerId: customer.id,
          staffUsername,
          startTime: now,
          status: 'active'
        }
      });

      await prisma.customer.update({
        where: { id: customer.id },
        data: { totalVisits: { increment: 1 } }
      });
    }

    // 4. Create table play record and mark table occupied
    const [tablePlay, updatedTable] = await prisma.$transaction([
      prisma.tablePlay.create({
        data: {
          visitId: visit.id,
          tableId: table.id,
          gameType: table.gameType,
          startTime: now,
          createdBy: staffUsername
        },
        include: { table: true }
      }),
      prisma.table.update({
        where: { id: table.id },
        data: { status: 'occupied' }
      })
    ]);

    broadcast({ type: 'TABLE_UPDATE', table: updatedTable });
    broadcast({ type: 'TABLE_PLAY_START', play: tablePlay, visitId: visit.id });
    broadcast({ type: 'VISIT_UPDATE', visit, session: visit });

    res.status(200).json({
      success: true,
      customer,
      visit,
      session: visit,
      tablePlay,
      table: updatedTable
    });
  } catch (error: any) {
    console.error('Error assigning table:', error);
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


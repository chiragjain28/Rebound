"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const websocket_1 = require("../websocket");
const router = (0, express_1.Router)();
// Get all tables
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const [tables, activePlays] = await Promise.all([
            index_1.prisma.table.findMany({
                orderBy: [
                    { gameType: 'asc' },
                    { number: 'asc' }
                ]
            }),
            index_1.prisma.tablePlay.findMany({
                where: { endTime: null },
                select: { tableId: true }
            })
        ]);
        const activeTableIds = new Set(activePlays.map(tp => tp.tableId).filter(Boolean));
        for (const t of tables) {
            const shouldBeOccupied = activeTableIds.has(t.id);
            if ((t.status === 'occupied') !== shouldBeOccupied) {
                t.status = shouldBeOccupied ? 'occupied' : 'available';
                index_1.prisma.table.update({
                    where: { id: t.id },
                    data: { status: t.status }
                }).catch(err => console.error(`Error auto-healing table ${t.id}:`, err));
            }
        }
        res.json(tables);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Assign a table directly to an existing or new customer
router.post('/:id/assign', auth_1.authenticateToken, async (req, res) => {
    try {
        const tableId = parseInt(req.params.id);
        const { customerId, customerName, customerPhone, playerCount } = req.body;
        const staffUsername = req.user?.username || 'chirag';
        // 1. Verify table
        const table = await index_1.prisma.table.findUnique({
            where: { id: tableId }
        });
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }
        // Verify against actual active table plays (source of truth)
        const activePlay = await index_1.prisma.tablePlay.findFirst({
            where: { tableId, endTime: null }
        });
        if (activePlay) {
            return res.status(400).json({ error: `Table ${table.number} is already occupied` });
        }
        // 2. Identify or create customer
        let customer = null;
        if (customerId) {
            customer = await index_1.prisma.customer.findUnique({
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
                customer = await index_1.prisma.customer.findUnique({
                    where: { phone: trimmedPhone }
                });
            }
            // Check if exists by name
            if (!customer) {
                customer = await index_1.prisma.customer.findFirst({
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
                customer = await index_1.prisma.customer.create({
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
        let visit = await index_1.prisma.visit.findFirst({
            where: {
                customerId: customer.id,
                status: 'active'
            }
        });
        const now = new Date();
        if (!visit) {
            const pad = (n) => n.toString().padStart(2, '0');
            const timestamp = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
            const cleanName = customer.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            const visitId = `${timestamp}_${cleanName}`;
            visit = await index_1.prisma.visit.create({
                data: {
                    id: visitId,
                    customerId: customer.id,
                    staffUsername,
                    startTime: now,
                    status: 'active'
                }
            });
            await index_1.prisma.customer.update({
                where: { id: customer.id },
                data: { totalVisits: { increment: 1 } }
            });
        }
        const parsedPlayerCount = table.gameType === 'PS4'
            ? Math.max(1, Math.min(4, parseInt(playerCount) || 1))
            : 1;
        // 4. Create table play record and mark table occupied
        const [tablePlay, updatedTable] = await index_1.prisma.$transaction([
            index_1.prisma.tablePlay.create({
                data: {
                    visitId: visit.id,
                    tableId: table.id,
                    gameType: table.gameType,
                    playerCount: parsedPlayerCount,
                    startTime: now,
                    createdBy: staffUsername
                },
                include: { table: true }
            }),
            index_1.prisma.table.update({
                where: { id: table.id },
                data: { status: 'occupied' }
            })
        ]);
        (0, websocket_1.broadcast)({ type: 'TABLE_UPDATE', table: updatedTable });
        (0, websocket_1.broadcast)({ type: 'TABLE_PLAY_START', play: tablePlay, visitId: visit.id });
        (0, websocket_1.broadcast)({ type: 'VISIT_UPDATE', visit, session: visit });
        res.status(200).json({
            success: true,
            customer,
            visit,
            session: visit,
            tablePlay,
            table: updatedTable
        });
    }
    catch (error) {
        console.error('Error assigning table:', error);
        res.status(500).json({ error: error.message });
    }
});
// Create a single table (supports custom name/label)
router.post('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { number, gameType, name, ratePerHour } = req.body;
        if (!number || !gameType) {
            return res.status(400).json({ error: 'Table number and gameType are required' });
        }
        const tableNum = parseInt(number);
        if (isNaN(tableNum) || tableNum <= 0) {
            return res.status(400).json({ error: 'Table number must be a positive number (e.g., 1, 2, 3)' });
        }
        // Check if table already exists (unique constraint on gameType + number)
        const existing = await index_1.prisma.table.findUnique({
            where: {
                gameType_number: {
                    gameType,
                    number: tableNum
                }
            }
        });
        if (existing) {
            const highestTable = await index_1.prisma.table.findFirst({
                where: { gameType },
                orderBy: { number: 'desc' }
            });
            const nextNum = (highestTable?.number || 0) + 1;
            return res.status(400).json({
                error: `${gameType} Table ${tableNum} already exists in your lounge! Next available number is Table ${nextNum}.`
            });
        }
        const customName = typeof name === 'string' && name.trim() ? name.trim() : null;
        const parsedRate = (ratePerHour !== undefined && ratePerHour !== null && !isNaN(parseFloat(ratePerHour)) && parseFloat(ratePerHour) >= 0)
            ? parseFloat(ratePerHour)
            : null;
        const table = await index_1.prisma.table.create({
            data: {
                number: tableNum,
                name: customName,
                gameType,
                ratePerHour: parsedRate,
                status: 'available'
            }
        });
        (0, websocket_1.broadcast)({ type: 'TABLE_UPDATE', table });
        res.status(201).json(table);
    }
    catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({
                error: `${req.body.gameType || 'This'} Table ${req.body.number} already exists! Please pick a different table number.`
            });
        }
        console.error('Error creating table:', error);
        res.status(500).json({ error: error.message });
    }
});
// Update / Rename a table (custom name or number)
router.patch('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const tableId = parseInt(req.params.id);
        if (isNaN(tableId)) {
            return res.status(400).json({ error: 'Invalid table ID' });
        }
        const existing = await index_1.prisma.table.findUnique({
            where: { id: tableId }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Table not found' });
        }
        // Restriction: Cannot modify table name, number, or price while running / occupied
        const activePlay = await index_1.prisma.tablePlay.findFirst({
            where: { tableId, endTime: null }
        });
        if (existing.status === 'occupied' || activePlay) {
            const displayName = existing.name || `${existing.gameType} Table ${existing.number}`;
            return res.status(400).json({
                error: `Cannot modify table "${displayName}" while a game is actively running on it! Please finish or switch the game before making changes.`
            });
        }
        const { name, number, ratePerHour } = req.body;
        const updateData = {};
        if (name !== undefined) {
            updateData.name = typeof name === 'string' && name.trim() ? name.trim() : null;
        }
        if (ratePerHour !== undefined) {
            const parsedRate = (ratePerHour !== null && !isNaN(parseFloat(ratePerHour)) && parseFloat(ratePerHour) >= 0)
                ? parseFloat(ratePerHour)
                : null;
            updateData.ratePerHour = parsedRate;
        }
        if (number !== undefined) {
            const tableNum = parseInt(number);
            if (!isNaN(tableNum) && tableNum > 0 && tableNum !== existing.number) {
                const conflict = await index_1.prisma.table.findUnique({
                    where: {
                        gameType_number: {
                            gameType: existing.gameType,
                            number: tableNum
                        }
                    }
                });
                if (conflict && conflict.id !== tableId) {
                    return res.status(400).json({
                        error: `${existing.gameType} Table ${tableNum} already exists in your lounge!`
                    });
                }
                updateData.number = tableNum;
            }
        }
        const updated = await index_1.prisma.table.update({
            where: { id: tableId },
            data: updateData
        });
        (0, websocket_1.broadcast)({ type: 'TABLE_UPDATE', table: updated });
        res.json(updated);
    }
    catch (error) {
        console.error('Error updating table:', error);
        res.status(500).json({ error: error.message });
    }
});
// Delete a table from the database
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const tableId = parseInt(req.params.id);
        if (isNaN(tableId)) {
            return res.status(400).json({ error: 'Invalid table ID' });
        }
        const table = await index_1.prisma.table.findUnique({
            where: { id: tableId },
            include: {
                tablePlays: {
                    where: { endTime: null }
                }
            }
        });
        if (!table) {
            return res.status(404).json({ error: 'Table not found' });
        }
        // Safety check: Cannot delete occupied or actively played table
        if (table.status === 'occupied' || (table.tablePlays && table.tablePlays.length > 0)) {
            const displayName = table.name || `${table.gameType} Table ${table.number}`;
            return res.status(400).json({
                error: `Cannot delete "${displayName}" because it is currently in use in an active visit! Please finish the game or switch tables before removing.`
            });
        }
        // Nullify tableId in historical completed tablePlays so past session records are preserved
        await index_1.prisma.tablePlay.updateMany({
            where: { tableId },
            data: { tableId: null }
        });
        // Remove any reservations for this table
        await index_1.prisma.tableBooking.deleteMany({
            where: { tableId }
        });
        // Delete table
        await index_1.prisma.table.delete({
            where: { id: tableId }
        });
        (0, websocket_1.broadcast)({ type: 'TABLE_DELETED', tableId });
        res.json({
            success: true,
            message: `Table "${table.name || `${table.gameType} Table ${table.number}`}" deleted successfully.`
        });
    }
    catch (error) {
        console.error('Error deleting table:', error);
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
                name: typeof t.name === 'string' && t.name.trim() ? t.name.trim() : null,
                gameType: t.gameType,
                status: 'available'
            })),
            skipDuplicates: true
        });
        (0, websocket_1.broadcast)({ type: 'TABLE_UPDATE' });
        res.status(201).json({ count: created.count });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

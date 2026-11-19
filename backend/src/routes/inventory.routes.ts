import { Router } from 'express';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';
import { broadcast } from '../websocket';

const router = Router();

// Helper to calculate box and loose representation
export function computeStockUnits(stock: number, piecesPerBox: number) {
  const pPerBox = piecesPerBox > 0 ? piecesPerBox : 1;
  const boxes = Math.floor(stock / pPerBox);
  const loose = stock % pPerBox;
  return { boxes, loose, piecesPerBox: pPerBox };
}

// 1. GET /inventory - List all inventory items with filtering and search
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, subCategory, search, status } = req.query;

    const where: any = {
      isActive: true
    };

    if (category && category !== 'all') {
      where.category = { equals: category.toString(), mode: 'insensitive' };
    }

    if (subCategory && subCategory !== 'all') {
      where.subCategory = { equals: subCategory.toString(), mode: 'insensitive' };
    }

    if (search && search.toString().trim()) {
      where.name = { contains: search.toString().trim(), mode: 'insensitive' };
    }

    if (status === 'out_of_stock') {
      where.currentStock = { lte: 0 };
    }

    const items = await prisma.inventoryItem.findMany({
      where,
      include: {
        menuItem: {
          select: { id: true, name: true, price: true, category: true }
        },
        _count: {
          select: { transactions: true }
        }
      },
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ]
    });

    const enriched = items.map(item => {
      const { boxes, loose } = computeStockUnits(item.currentStock, item.piecesPerBox);
      const hasHistory = (item._count?.transactions || 0) > 0 || item.currentStock > 0;
      const isUncounted = !hasHistory && item.currentStock === 0;
      const isLowStock = hasHistory && item.currentStock <= item.minStockAlert && item.currentStock > 0;
      const isOutOfStock = hasHistory && item.currentStock <= 0;

      return {
        ...item,
        boxesCount: boxes,
        looseCount: loose,
        isUncounted,
        isLowStock,
        isOutOfStock
      };
    });

    // Client-side filter for low_stock if requested
    const filtered = status === 'low_stock'
      ? enriched.filter(i => i.isLowStock)
      : status === 'out_of_stock'
      ? enriched.filter(i => i.isOutOfStock)
      : enriched;

    res.json(filtered);
  } catch (error: any) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. GET /inventory/stats - High-level KPIs and cigarette-specific metrics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { transactions: true }
        }
      }
    });

    let cafeItemsCount = 0;
    let clubItemsCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let uncountedCount = 0;
    let totalValuation = 0;

    // Cigarette-specific stats
    let totalCigarettesCount = 0;
    let totalCigaretteBoxesCount = 0;
    let cigaretteBrandsCount = 0;

    for (const item of items) {
      if (item.category.toLowerCase() === 'cafe') {
        cafeItemsCount++;
      } else {
        clubItemsCount++;
      }

      const hasHistory = (item._count?.transactions || 0) > 0 || item.currentStock > 0;
      if (!hasHistory && item.currentStock === 0) {
        uncountedCount++;
      } else if (item.currentStock <= 0) {
        outOfStockCount++;
      } else if (item.currentStock <= item.minStockAlert) {
        lowStockCount++;
      }

      const price = item.sellingPrice || (item.costPrice ? item.costPrice * 1.3 : 0);
      if (item.currentStock > 0 && price) {
        totalValuation += item.currentStock * price;
      }

      if (item.category?.toLowerCase() === 'club' || item.subCategory?.toLowerCase() === 'cigarettes') {
        cigaretteBrandsCount++;
        totalCigarettesCount += item.currentStock;
        totalCigaretteBoxesCount += Math.floor(item.currentStock / (item.piecesPerBox || 10));
      }
    }

    res.json({
      totalItems: items.length,
      cafeItemsCount,
      clubItemsCount,
      lowStockCount,
      outOfStockCount,
      uncountedCount,
      totalValuation: Math.round(totalValuation),
      cigarettes: {
        totalLoose: totalCigarettesCount,
        totalBoxes: totalCigaretteBoxesCount,
        brandsCount: cigaretteBrandsCount
      }
    });
  } catch (error: any) {
    console.error('Error fetching inventory stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. POST /inventory/restock - Bulk or single restock with Box calculations
router.post('/restock', authenticateToken, async (req: any, res) => {
  try {
    const { items, supplierName, notes } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Array of restock items is required' });
    }

    const staffUsername = req.user?.username || 'admin';
    const results: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const entry of items) {
        const { itemId, boxes, loosePieces, costPerBox, totalCost } = entry;
        const item = await tx.inventoryItem.findUnique({
          where: { id: parseInt(itemId) }
        });

        if (!item) continue;

        const boxesNum = Math.max(0, parseFloat(boxes) || 0);
        const looseNum = Math.max(0, parseInt(loosePieces) || 0);
        const piecesPerBox = item.piecesPerBox > 0 ? item.piecesPerBox : 1;

        // Total loose pieces added = (boxes * piecesPerBox) + loosePieces
        const addedQuantity = Math.round((boxesNum * piecesPerBox) + looseNum);
        if (addedQuantity <= 0) continue;

        const stockBefore = item.currentStock;
        const stockAfter = stockBefore + addedQuantity;

        // Update inventory item
        const updatedItem = await tx.inventoryItem.update({
          where: { id: item.id },
          data: {
            currentStock: stockAfter,
            costPrice: costPerBox ? parseFloat(costPerBox) : item.costPrice
          }
        });

        // Record restock audit transaction
        const transaction = await tx.inventoryTransaction.create({
          data: {
            itemId: item.id,
            type: 'RESTOCK',
            quantity: addedQuantity,
            boxesCount: boxesNum > 0 ? boxesNum : null,
            piecesPerBox,
            unitCost: costPerBox ? parseFloat(costPerBox) : null,
            totalCost: totalCost ? parseFloat(totalCost) : (costPerBox ? boxesNum * parseFloat(costPerBox) : null),
            stockBefore,
            stockAfter,
            notes: notes || (supplierName ? `Supplier: ${supplierName}` : 'Restock shipment'),
            staffUsername
          }
        });

        results.push({ item: updatedItem, transaction });
      }
    });

    broadcast({ type: 'INVENTORY_RESTOCKED', count: results.length });
    res.status(200).json({ success: true, count: results.length, data: results });
  } catch (error: any) {
    console.error('Error during restock:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. POST /inventory/adjust - Stock correction (physical audit, damage, wastage)
router.post('/adjust', authenticateToken, async (req: any, res) => {
  try {
    const { itemId, newStock, reason, notes } = req.body;
    if (itemId === undefined || newStock === undefined) {
      return res.status(400).json({ error: 'itemId and newStock are required' });
    }

    const item = await prisma.inventoryItem.findUnique({
      where: { id: parseInt(itemId) }
    });

    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const targetStock = Math.max(0, parseInt(newStock));
    const stockBefore = item.currentStock;
    const diff = targetStock - stockBefore;

    if (diff === 0) {
      return res.json({ success: true, message: 'Stock is already at target value', item });
    }

    const staffUsername = req.user?.username || 'admin';
    const txType = (reason || '').toUpperCase() === 'WASTAGE' ? 'WASTAGE' : 'ADJUSTMENT';

    const [updatedItem, transaction] = await prisma.$transaction([
      prisma.inventoryItem.update({
        where: { id: item.id },
        data: { currentStock: targetStock }
      }),
      prisma.inventoryTransaction.create({
        data: {
          itemId: item.id,
          type: txType,
          quantity: diff,
          piecesPerBox: item.piecesPerBox,
          stockBefore,
          stockAfter: targetStock,
          notes: notes || `Audit Adjustment: ${diff > 0 ? `+${diff}` : diff} pieces (${reason || 'Count check'})`,
          staffUsername
        }
      })
    ]);

    broadcast({ type: 'INVENTORY_ADJUSTED', itemId: item.id, newStock: targetStock });
    res.json({ success: true, item: updatedItem, transaction });
  } catch (error: any) {
    console.error('Error during stock adjustment:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. POST /inventory - Create a new inventory item
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, category, subCategory, currentStock, unit, piecesPerBox, minStockAlert, costPrice, sellingPrice, menuItemId } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: 'name and category (Cafe or Club) are required' });
    }

    const item = await prisma.inventoryItem.create({
      data: {
        name: name.trim(),
        category: category.trim(),
        subCategory: subCategory ? subCategory.trim() : null,
        currentStock: parseInt(currentStock) || 0,
        unit: unit || 'pieces',
        piecesPerBox: parseInt(piecesPerBox) || 1,
        minStockAlert: parseInt(minStockAlert) || 10,
        costPrice: costPrice ? parseFloat(costPrice) : null,
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
        menuItemId: menuItemId ? parseInt(menuItemId) : null
      }
    });

    broadcast({ type: 'INVENTORY_CREATED', item });
    res.status(201).json(item);
  } catch (error: any) {
    console.error('Error creating inventory item:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. PUT /inventory/:id - Update inventory item configuration
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, category, subCategory, currentStock, unit, piecesPerBox, minStockAlert, costPrice, sellingPrice, isActive } = req.body;

    const existing = await prisma.inventoryItem.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(category ? { category: category.trim() } : {}),
        ...(subCategory !== undefined ? { subCategory: subCategory ? subCategory.trim() : null } : {}),
        ...(currentStock !== undefined ? { currentStock: parseInt(currentStock) } : {}),
        ...(unit ? { unit: unit.trim() } : {}),
        ...(piecesPerBox !== undefined ? { piecesPerBox: parseInt(piecesPerBox) || 1 } : {}),
        ...(minStockAlert !== undefined ? { minStockAlert: parseInt(minStockAlert) || 0 } : {}),
        ...(costPrice !== undefined ? { costPrice: costPrice ? parseFloat(costPrice) : null } : {}),
        ...(sellingPrice !== undefined ? { sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {})
      }
    });

    broadcast({ type: 'INVENTORY_UPDATED', item: updated });
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. GET /inventory/transactions - Transaction audit log
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const { itemId, type, limit = 50 } = req.query;
    const where: any = {};

    if (itemId) {
      where.itemId = parseInt(itemId.toString());
    }
    if (type && type !== 'all') {
      where.type = type.toString().toUpperCase();
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where,
      include: {
        item: {
          select: { id: true, name: true, category: true, subCategory: true, unit: true, piecesPerBox: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, parseInt(limit.toString()) || 50)
    });

    res.json(transactions);
  } catch (error: any) {
    console.error('Error fetching inventory transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8. POST /inventory/sync-menu - Sync any missing menu items into inventory
router.post('/sync-menu', authenticateToken, async (req, res) => {
  try {
    const menuItems = await prisma.menuItem.findMany();
    let syncedCount = 0;

    for (const m of menuItems) {
      const isCigarette = m.category.toLowerCase().includes('cigarette');
      const isColdDrink = m.category.toLowerCase().includes('drink') || m.category.toLowerCase().includes('beverage');

      // Do NOT sync cooked food recipes/dishes directly into inventory items - cafe dishes track raw materials
      if (!isCigarette && !isColdDrink) {
        continue;
      }

      let category = isCigarette ? 'Club' : 'Cafe';
      let piecesPerBox = 1;
      let unit = 'pieces';
      let minStockAlert = 5;

      if (isCigarette) {
        category = 'Club';
        unit = 'pieces';
        minStockAlert = 10;

        const lowerName = m.name.toLowerCase();
        if (lowerName.includes('connect') || lowerName.includes('social') || lowerName.includes('shift')) {
          piecesPerBox = 20;
        } else {
          piecesPerBox = 10;
        }
      } else if (isColdDrink) {
        category = 'Cafe';
        unit = 'cans';
        minStockAlert = 6;
      }

      const existing = await prisma.inventoryItem.findUnique({
        where: { menuItemId: m.id }
      });

      if (!existing) {
        await prisma.inventoryItem.create({
          data: {
            name: m.name,
            category,
            subCategory: null,
            currentStock: 0,
            unit,
            piecesPerBox,
            minStockAlert,
            sellingPrice: m.price,
            menuItemId: m.id,
            isActive: m.isActive !== false
          }
        });
        syncedCount++;
      }
    }

    res.json({ success: true, syncedCount });
  } catch (error: any) {
    console.error('Error syncing menu to inventory:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;


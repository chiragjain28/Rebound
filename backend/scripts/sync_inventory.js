const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncInventory() {
  console.log('--- Starting Inventory Synchronization ---');

  // 1. Fetch all Menu Items
  const menuItems = await prisma.menuItem.findMany();
  console.log(`Found ${menuItems.length} menu items.`);

  let createdCount = 0;
  let updatedCount = 0;

  for (const m of menuItems) {
    const isCigarette = m.category.toLowerCase().includes('cigarette');
    const isColdDrink = m.category.toLowerCase().includes('drink');

    let category = 'Cafe';
    let subCategory = 'Food & Snacks';
    let piecesPerBox = 1;
    let unit = 'pieces';
    let minStockAlert = 5;

    if (isCigarette) {
      category = 'Club';
      subCategory = 'Cigarettes';
      unit = 'pieces';
      minStockAlert = 10;

      const lowerName = m.name.toLowerCase();
      if (lowerName.includes('connect')) {
        piecesPerBox = 20;
      } else if (lowerName.includes('social')) {
        piecesPerBox = 20;
      } else if (lowerName.includes('shift')) {
        piecesPerBox = 20;
      } else {
        piecesPerBox = 10;
      }
    } else if (isColdDrink) {
      category = 'Cafe';
      subCategory = 'Cold Drinks';
      piecesPerBox = 1;
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
          subCategory,
          currentStock: 0,
          unit,
          piecesPerBox,
          minStockAlert,
          sellingPrice: m.price,
          menuItemId: m.id,
          isActive: m.isActive !== false
        }
      });
      createdCount++;
    } else {
      await prisma.inventoryItem.update({
        where: { id: existing.id },
        data: {
          name: m.name,
          category,
          subCategory,
          piecesPerBox: existing.piecesPerBox > 1 ? existing.piecesPerBox : piecesPerBox,
          sellingPrice: m.price,
          isActive: m.isActive !== false
        }
      });
      updatedCount++;
    }
  }

  // 2. Add sample non-menu Club Essentials if they don't already exist
  const clubEssentials = [
    { name: 'Pioneer Pool Chalk (Blue)', category: 'Club', subCategory: 'Gaming Supplies', unit: 'cubes', piecesPerBox: 12, minStockAlert: 12, currentStock: 24 },
    { name: 'Master Cue Chalk (Green)', category: 'Club', subCategory: 'Gaming Supplies', unit: 'cubes', piecesPerBox: 12, minStockAlert: 12, currentStock: 12 },
    { name: 'Elk Master Cue Tips (10mm)', category: 'Club', subCategory: 'Gaming Supplies', unit: 'tips', piecesPerBox: 50, minStockAlert: 10, currentStock: 50 },
    { name: 'Billiard Table Cloth Cleaning Brush', category: 'Club', subCategory: 'Table Maintenance', unit: 'pieces', piecesPerBox: 1, minStockAlert: 2, currentStock: 4 },
  ];

  for (const item of clubEssentials) {
    const found = await prisma.inventoryItem.findFirst({
      where: { name: item.name, menuItemId: null }
    });
    if (!found) {
      await prisma.inventoryItem.create({ data: item });
      createdCount++;
    }
  }

  // 3. Add sample non-menu Cafe Raw Materials if they don't exist
  const cafeEssentials = [
    { name: 'Amul Taaza Milk (500ml)', category: 'Cafe', subCategory: 'Raw Materials', unit: 'packets', piecesPerBox: 1, minStockAlert: 6, currentStock: 10 },
    { name: 'Amul Butter Block (500g)', category: 'Cafe', subCategory: 'Raw Materials', unit: 'blocks', piecesPerBox: 1, minStockAlert: 2, currentStock: 3 },
    { name: 'Amul Cheese Slices (Pack of 48)', category: 'Cafe', subCategory: 'Raw Materials', unit: 'slices', piecesPerBox: 48, minStockAlert: 20, currentStock: 48 },
    { name: 'Nescafe Classic Coffee (200g)', category: 'Cafe', subCategory: 'Raw Materials', unit: 'jars', piecesPerBox: 1, minStockAlert: 2, currentStock: 2 },
  ];

  for (const item of cafeEssentials) {
    const found = await prisma.inventoryItem.findFirst({
      where: { name: item.name, menuItemId: null }
    });
    if (!found) {
      await prisma.inventoryItem.create({ data: item });
      createdCount++;
    }
  }

  console.log(`Inventory sync complete! Created: ${createdCount}, Updated: ${updatedCount}`);
}

syncInventory()
  .catch(console.error)
  .finally(() => prisma.$disconnect());


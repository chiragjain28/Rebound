import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Seed Staff
  const passwordHash = await bcrypt.hash('rebound@123', 10);
  const staffMembers = [
    { username: 'chirag', passwordHash, name: 'Chirag', role: 'owner' },
    { username: 'ajinkya', passwordHash, name: 'Ajinkya', role: 'owner' },
    { username: 'ayush', passwordHash, name: 'Ayush', role: 'owner' }
  ];

  for (const staff of staffMembers) {
    await prisma.staff.upsert({
      where: { username: staff.username },
      update: {},
      create: staff
    });
  }
  console.log('Staff members seeded.');

  // 2. Seed Billiard Tables
  for (let i = 1; i <= 5; i++) {
    await prisma.table.upsert({
      where: { number: i },
      update: {},
      create: { number: i, status: 'available' }
    });
  }
  console.log('Billiard tables seeded.');

  // 3. Seed Menu Items (21 items across Cafe, Cold Drinks, Cigarettes)
  const menuItems = [
    // Cafe
    { name: 'Espresso', price: 80, category: 'Cafe' },
    { name: 'Cappuccino', price: 120, category: 'Cafe' },
    { name: 'Cafe Latte', price: 130, category: 'Cafe' },
    { name: 'Americano', price: 100, category: 'Cafe' },
    { name: 'Hot Tea', price: 40, category: 'Cafe' },
    { name: 'Green Tea', price: 50, category: 'Cafe' },
    { name: 'Garlic Bread', price: 150, category: 'Cafe' },
    { name: 'French Fries', price: 120, category: 'Cafe' },

    // Cold Drinks
    { name: 'Coca Cola 300ml', price: 40, category: 'Cold Drinks' },
    { name: 'Sprite 300ml', price: 40, category: 'Cold Drinks' },
    { name: 'Red Bull', price: 125, category: 'Cold Drinks' },
    { name: 'Iced Latte', price: 150, category: 'Cold Drinks' },
    { name: 'Cold Coffee', price: 140, category: 'Cold Drinks' },
    { name: 'Mineral Water 1L', price: 30, category: 'Cold Drinks' },
    { name: 'Lemonade', price: 90, category: 'Cold Drinks' },

    // Cigarettes
    { name: 'Marlboro Lights', price: 18, category: 'Cigarettes' },
    { name: 'Marlboro Advance', price: 20, category: 'Cigarettes' },
    { name: 'Gold Flake King', price: 18, category: 'Cigarettes' },
    { name: 'Classic Milds', price: 20, category: 'Cigarettes' },
    { name: 'Garam', price: 25, category: 'Cigarettes' },
    { name: 'Essence', price: 22, category: 'Cigarettes' }
  ];

  for (const item of menuItems) {
    const existing = await prisma.menuItem.findFirst({
      where: { name: item.name }
    });
    if (!existing) {
      await prisma.menuItem.create({ data: item });
    }
  }
  console.log('Menu items seeded.');

  console.log('Seeding complete successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

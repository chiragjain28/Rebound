import { prisma } from '../index';

export class VisitService {
  static async getActiveVisits() {
    return prisma.visit.findMany({
      where: { status: 'active' },
      include: {
        customer: true,
        tablePlays: { include: { table: true } },
        orders: { include: { menuItem: true } },
        payments: true
      }
    });
  }
}

export const SessionService = VisitService;

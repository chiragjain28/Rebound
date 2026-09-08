import { prisma } from '../index';

export class SessionService {
  static async getActiveSessions() {
    return prisma.session.findMany({
      where: { status: 'active' },
      include: { table: true }
    });
  }
}

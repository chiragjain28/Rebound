"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionService = exports.VisitService = void 0;
const index_1 = require("../index");
class VisitService {
    static async getActiveVisits() {
        return index_1.prisma.visit.findMany({
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
exports.VisitService = VisitService;
exports.SessionService = VisitService;

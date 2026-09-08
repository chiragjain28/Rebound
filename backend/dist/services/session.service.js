"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionService = void 0;
const index_1 = require("../index");
class SessionService {
    static async getActiveSessions() {
        return index_1.prisma.session.findMany({
            where: { status: 'active' },
            include: { table: true }
        });
    }
}
exports.SessionService = SessionService;

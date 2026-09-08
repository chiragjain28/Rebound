"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../index");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }
    try {
        const staff = await index_1.prisma.staff.findUnique({
            where: { username: username.toLowerCase() }
        });
        if (!staff) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const isValid = await bcryptjs_1.default.compare(password, staff.passwordHash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        const secret = process.env.JWT_SECRET || 'rebound_secret_key_2026';
        const token = jsonwebtoken_1.default.sign({ username: staff.username, role: staff.role, name: staff.name }, secret, { expiresIn: '24h' });
        res.json({
            token,
            user: {
                username: staff.username,
                role: staff.role,
                name: staff.name
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/verify-password', auth_1.authenticateToken, async (req, res) => {
    const { password, username } = req.body;
    if (!password) {
        return res.status(400).json({ error: 'Password is required' });
    }
    try {
        // Use the logged-in user's username for a targeted single-row lookup
        const targetUsername = (username || req.user?.username || '').toLowerCase();
        const staff = await index_1.prisma.staff.findUnique({
            where: { username: targetUsername }
        });
        if (!staff) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        const isValid = await bcryptjs_1.default.compare(password, staff.passwordHash);
        if (isValid) {
            return res.json({ valid: true });
        }
        res.status(401).json({ error: 'Invalid password' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;

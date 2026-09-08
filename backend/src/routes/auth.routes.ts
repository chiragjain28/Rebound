import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const staff = await prisma.staff.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (!staff) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isValid = await bcrypt.compare(password, staff.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const secret = process.env.JWT_SECRET || 'rebound_secret_key_2026';
    const token = jwt.sign(
      { username: staff.username, role: staff.role, name: staff.name },
      secret,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        username: staff.username,
        role: staff.role,
        name: staff.name
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/verify-password', authenticateToken, async (req, res) => {
  const { password, username } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  try {
    // Use the logged-in user's username for a targeted single-row lookup
    const targetUsername = (username || (req as any).user?.username || '').toLowerCase();
    const staff = await prisma.staff.findUnique({
      where: { username: targetUsername }
    });

    if (!staff) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const isValid = await bcrypt.compare(password, staff.passwordHash);
    if (isValid) {
      return res.json({ valid: true });
    }
    
    res.status(401).json({ error: 'Invalid password' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

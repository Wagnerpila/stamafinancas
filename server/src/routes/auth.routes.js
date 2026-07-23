import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { publicUser } from '../lib/serialize.js';
import { requireAuth } from '../middleware/auth.js';
import { DEFAULT_CATEGORIES } from '../lib/defaultCategories.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, full_name } = req.body || {};
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ error: 'Já existe uma conta com esse email.' });
    }

    const isFirstUser = (await prisma.user.count()) === 0;
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const role = isFirstUser || (adminEmail && normalizedEmail === adminEmail) ? 'admin' : 'user';

    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email: normalizedEmail, password_hash, full_name, role },
    });

    await prisma.transactionCategory.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: user.id, created_by: user.email })),
    });
    await prisma.notificationSettings.create({
      data: { user_id: user.id, created_by: user.email },
    });

    const token = signToken(user.id);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(401).json({ error: 'Email ou senha inválidos.' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou senha inválidos.' });
    }
    const token = signToken(user.id);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json(publicUser(req.user));
});

const SELF_EDITABLE_FIELDS = [
  'full_name',
  'whatsapp_number',
  'monthly_budget',
  'food_voucher_balance',
];

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const data = {};
    for (const field of SELF_EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        data[field] = req.body[field];
      }
    }
    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json(publicUser(user));
  } catch (err) {
    next(err);
  }
});

router.delete('/me', requireAuth, async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.user.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

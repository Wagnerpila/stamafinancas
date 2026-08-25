import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { signToken } from '../lib/jwt.js';
import { publicUser } from '../lib/serialize.js';
import { requireAuth } from '../middleware/auth.js';
import { DEFAULT_CATEGORIES } from '../lib/defaultCategories.js';
import { requireEmailConfigured, sendEmail } from '../lib/mailer.js';

const router = Router();

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

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

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório.' });
    }

    // Checa a config ANTES de saber se o email existe — senão um SMTP mal configurado faria
    // esta rota responder diferente (erro vs. sucesso genérico) dependendo só de existir ou não
    // conta com aquele email, vazando essa informação pra quem estiver testando emails ao acaso.
    requireEmailConfigured();

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Mesma resposta genérica exista ou não a conta — só dispara o email (e só por dentro do
    // if) quando existe, sem revelar ao chamador qual dos dois casos aconteceu.
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const reset_token_hash = crypto.createHash('sha256').update(token).digest('hex');
      const reset_token_expires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await prisma.user.update({ where: { id: user.id }, data: { reset_token_hash, reset_token_expires } });

      const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
      const resetUrl = `${appUrl}/reset-password?token=${token}`;
      await sendEmail({
        to: user.email,
        subject: 'Redefinir senha — STAMA',
        text:
          `Recebemos um pedido para redefinir sua senha no STAMA.\n\n` +
          `Acesse o link abaixo para criar uma nova senha (válido por 1 hora):\n${resetUrl}\n\n` +
          `Se você não pediu isso, pode ignorar este email — sua senha continua a mesma.`,
        html:
          `<p>Recebemos um pedido para redefinir sua senha no STAMA.</p>` +
          `<p><a href="${resetUrl}">Clique aqui para criar uma nova senha</a> (o link vale por 1 hora).</p>` +
          `<p>Se você não pediu isso, pode ignorar este email — sua senha continua a mesma.</p>`,
      });
    }

    res.json({ success: true, message: 'Se este email tiver uma conta, enviamos um link de redefinição.' });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!token || !password) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
    }

    const reset_token_hash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({ where: { reset_token_hash } });
    if (!user || !user.reset_token_expires || user.reset_token_expires < new Date()) {
      return res.status(400).json({ error: 'Link inválido ou expirado. Solicite a redefinição novamente.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash, reset_token_hash: null, reset_token_expires: null },
    });

    res.json({ success: true });
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

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { publicUser } from '../lib/serialize.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireAdmin);

// Mirrors the base44 generic entity interface (list/filter) that AdminDashboard.jsx expects for "User".
router.get('/', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { created_date: 'desc' } });
    res.json(users.map(publicUser));
  } catch (err) {
    next(err);
  }
});

const ADMIN_EDITABLE_FIELDS = ['role', 'subscription_plan_name', 'full_name', 'monthly_budget', 'food_voucher_balance'];

router.patch('/:id', async (req, res, next) => {
  try {
    const data = {};
    for (const field of ADMIN_EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
        data[field] = req.body[field];
      }
    }
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json(publicUser(user));
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function deserialize(plan) {
  return {
    ...plan,
    features: JSON.parse(plan.features || '{}'),
    pricing: JSON.parse(plan.pricing || '{}'),
  };
}

// Every authenticated user can read the plan catalog (used by MySubscription.jsx); only admins can write.
router.get('/', async (req, res, next) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({ orderBy: { created_date: 'asc' } });
    res.json(plans.map(deserialize));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { plan_name, features, pricing, transaction_limit, active } = req.body || {};
    const plan = await prisma.subscriptionPlan.create({
      data: {
        plan_name,
        features: JSON.stringify(features || {}),
        pricing: JSON.stringify(pricing || {}),
        transaction_limit: transaction_limit ?? -1,
        active: active ?? true,
        created_by: req.user.email,
      },
    });
    res.status(201).json(deserialize(plan));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const data = {};
    const { plan_name, features, pricing, transaction_limit, active } = req.body || {};
    if (plan_name !== undefined) data.plan_name = plan_name;
    if (features !== undefined) data.features = JSON.stringify(features);
    if (pricing !== undefined) data.pricing = JSON.stringify(pricing);
    if (transaction_limit !== undefined) data.transaction_limit = transaction_limit;
    if (active !== undefined) data.active = active;
    const plan = await prisma.subscriptionPlan.update({ where: { id: req.params.id }, data });
    res.json(deserialize(plan));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await prisma.subscriptionPlan.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

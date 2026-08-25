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

// Ferramenta de fase de desenvolvimento: apaga TODOS os lançamentos financeiros do próprio admin
// autenticado (transações, contas, cartões + faturas + lançamentos de cartão, crediários, metas,
// orçamentos por categoria, resumos e consultorias de IA), pra recomeçar do zero — sem apagar a
// conta em si, as categorias personalizadas nem as preferências de notificação. Escopado sempre a
// req.user.id (nunca a um :id da URL) — é "apagar os MEUS dados", não uma ferramenta pra um admin
// apagar dados de outro usuário. Roda tudo numa única transação do Prisma: ou apaga tudo, ou nada
// (se algo falhar no meio, não fica um estado parcialmente zerado).
router.post('/me/wipe-data', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const results = await prisma.$transaction([
      prisma.creditCardTransaction.deleteMany({ where: { user_id: userId } }),
      prisma.creditCardInvoice.deleteMany({ where: { user_id: userId } }),
      prisma.creditCard.deleteMany({ where: { user_id: userId } }),
      prisma.transaction.deleteMany({ where: { user_id: userId } }),
      prisma.bill.deleteMany({ where: { user_id: userId } }),
      prisma.crediario.deleteMany({ where: { user_id: userId } }),
      prisma.goal.deleteMany({ where: { user_id: userId } }),
      prisma.categoryBudget.deleteMany({ where: { user_id: userId } }),
      prisma.spendingSummary.deleteMany({ where: { user_id: userId } }),
      prisma.aIConsultation.deleteMany({ where: { user_id: userId } }),
    ]);
    const deletedCount = results.reduce((sum, r) => sum + r.count, 0);
    res.json({ success: true, deletedCount });
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

import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getWhatsAppStatus, startWhatsApp, logoutWhatsApp } from '../whatsapp/client.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/status', (req, res) => {
  res.json(getWhatsAppStatus());
});

router.post('/connect', async (req, res, next) => {
  try {
    await startWhatsApp();
    res.json(getWhatsAppStatus());
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    await logoutWhatsApp();
    res.json(getWhatsAppStatus());
  } catch (err) {
    next(err);
  }
});

export default router;

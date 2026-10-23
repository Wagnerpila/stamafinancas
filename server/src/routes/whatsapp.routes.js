import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getStatus, connect, logout, whatsappProvider } from '../whatsapp/index.js';
import { handleEvolutionWebhook, verifyWebhook } from '../whatsapp/evolution.js';
import { generateLinkCode } from '../whatsapp/linking.js';

const router = Router();

// Webhook da Evolution API — chamado pelo servidor da Evolution, sem login; protegido pelo
// WHATSAPP_WEBHOOK_TOKEN. Responde na hora e processa depois, pra Evolution não reenviar o
// evento enquanto a IA ainda está pensando.
router.post('/webhook', (req, res) => {
  if (whatsappProvider() !== 'evolution') return res.status(404).json({ error: 'Webhook desativado.' });
  if (!verifyWebhook(req)) return res.status(401).json({ error: 'Token inválido.' });
  res.json({ ok: true });
  handleEvolutionWebhook(req.body).catch((err) => console.error('[whatsapp/evolution] Webhook:', err));
});

// Para qualquer usuário logado: o número do bot (link wa.me na tela "Stama no WhatsApp") e se
// ele está no ar — sem QR Code nem detalhes da conexão, que são só do admin.
router.get('/info', requireAuth, async (req, res, next) => {
  try {
    const status = await getStatus();
    res.json({
      connected: status.status === 'connected',
      phoneNumber: status.status === 'connected' ? status.phoneNumber || process.env.WHATSAPP_BOT_NUMBER || null : null,
    });
  } catch (err) {
    next(err);
  }
});

// Gera o código de vínculo: o usuário manda esse código pro número do bot e o bot vincula o
// WhatsApp dele à conta (ver whatsapp/linking.js).
router.post('/link', requireAuth, async (req, res, next) => {
  try {
    const number = String(req.body?.number || '').replace(/\D/g, '');
    if (number && (number.length < 10 || number.length > 13)) {
      return res.status(400).json({ error: 'Número inválido. Use DDD + número, ex: 11999998888.' });
    }
    const user = await generateLinkCode(req.user, number);
    const status = await getStatus();
    res.json({
      code: user.whatsapp_link_code,
      expiresAt: user.whatsapp_link_expires,
      connected: status.status === 'connected',
      botNumber: status.phoneNumber || process.env.WHATSAPP_BOT_NUMBER || null,
    });
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth, requireAdmin);

router.get('/status', async (req, res, next) => {
  try {
    res.json(await getStatus());
  } catch (err) {
    next(err);
  }
});

router.post('/connect', async (req, res, next) => {
  try {
    res.json(await connect());
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    res.json(await logout());
  } catch (err) {
    next(err);
  }
});

export default router;

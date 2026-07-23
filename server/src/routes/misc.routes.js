import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Replaces the base44 getAdminContact function used by MySubscription.jsx / PlanRestriction.jsx
// to build a wa.me deep link for manual plan-upgrade requests.
router.get('/admin-contact', requireAuth, (req, res) => {
  res.json({ phoneNumber: process.env.ADMIN_WHATSAPP_NUMBER || null });
});

export default router;

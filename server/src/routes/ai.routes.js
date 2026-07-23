import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAIProvider } from '../services/ai/index.js';
import { resolveFileForAI } from '../services/fileResolver.js';
import {
  transactionExtractionSchema,
  receiptOcrPrompt,
  textTransactionPrompt,
  statementImportSchema,
  statementImportPrompt,
  invoiceOcrSchema,
  invoiceOcrPrompt,
  monthlySummarySchema,
  monthlySummaryPrompt,
  consultingChatPrompt,
} from '../services/ai/prompts.js';

const router = Router();
router.use(requireAuth);

// Receipt / photo OCR — used by PhotoTransaction.jsx and FileUploadTransaction.jsx.
router.post('/receipt-ocr', async (req, res, next) => {
  try {
    const provider = requireAIProvider();
    const { file_url } = req.body || {};
    if (!file_url) return res.status(400).json({ error: 'file_url é obrigatório.' });

    const file = await resolveFileForAI(file_url);
    const output = await provider.generateStructured({
      prompt: receiptOcrPrompt(),
      schema: transactionExtractionSchema,
      files: [file],
    });
    res.json({ status: 'success', output });
  } catch (err) {
    next(err);
  }
});

// Voice/text command parsing — used by VoiceTransaction.jsx.
router.post('/parse-text', async (req, res, next) => {
  try {
    const provider = requireAIProvider();
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'text é obrigatório.' });

    const output = await provider.generateStructured({
      prompt: textTransactionPrompt(text),
      schema: transactionExtractionSchema,
    });
    res.json({ status: 'success', output });
  } catch (err) {
    next(err);
  }
});

// Bank statement import — used by ImportStatement.jsx.
router.post('/statement-import', async (req, res, next) => {
  try {
    const provider = requireAIProvider();
    const { file_url } = req.body || {};
    if (!file_url) return res.status(400).json({ error: 'file_url é obrigatório.' });

    const file = await resolveFileForAI(file_url);
    const output = await provider.generateStructured({
      prompt: statementImportPrompt(),
      schema: statementImportSchema,
      files: [file],
    });
    res.json({ status: 'success', output });
  } catch (err) {
    next(err);
  }
});

// Credit card invoice OCR (installment-aware) — used by InvoiceOCRDialog.jsx.
router.post('/invoice-ocr', async (req, res, next) => {
  try {
    const provider = requireAIProvider();
    const { file_url, card_name, user_categories, existing_installments } = req.body || {};
    if (!file_url) return res.status(400).json({ error: 'file_url é obrigatório.' });

    const file = await resolveFileForAI(file_url);
    const output = await provider.generateStructured({
      prompt: invoiceOcrPrompt({
        cardName: card_name,
        userCategories: user_categories,
        existingInstallments: existing_installments,
      }),
      schema: invoiceOcrSchema(),
      files: [file],
    });
    res.json({ success: true, data: output });
  } catch (err) {
    next(err);
  }
});

// Monthly AI summary — used by AIConsulting.jsx (structured, replaces fragile string-splitting).
router.post('/monthly-summary', async (req, res, next) => {
  try {
    const provider = requireAIProvider();
    const { income, expense, balance, savings_rate, category_spending } = req.body || {};
    const output = await provider.generateStructured({
      prompt: monthlySummaryPrompt({
        income: income || 0,
        expense: expense || 0,
        balance: balance || 0,
        savingsRate: savings_rate || 0,
        categorySpending: category_spending || {},
      }),
      schema: monthlySummarySchema,
    });
    res.json({ status: 'success', output });
  } catch (err) {
    next(err);
  }
});

// Free-form AI consulting chat — used by AIConsulting.jsx.
router.post('/consulting-chat', async (req, res, next) => {
  try {
    const provider = requireAIProvider();
    const { context, question } = req.body || {};
    if (!question) return res.status(400).json({ error: 'question é obrigatório.' });

    const text = await provider.generateText({
      prompt: consultingChatPrompt({ contextBlock: context || '', question }),
    });
    res.json({ status: 'success', response: text });
  } catch (err) {
    next(err);
  }
});

export default router;

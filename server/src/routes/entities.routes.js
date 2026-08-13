import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { ENTITY_CONFIG, SYSTEM_FIELDS, OWNERSHIP_FIELDS } from '../services/entityConfig.js';

const router = Router();
router.use(requireAuth);

router.param('entityName', (req, res, next, entityName) => {
  const config = ENTITY_CONFIG[entityName];
  if (!config) {
    return res.status(404).json({ error: `Entidade "${entityName}" não existe.` });
  }
  req.entityConfig = config;
  req.model = prisma[config.accessor];
  next();
});

function parseFilter(rawQ) {
  if (!rawQ) return {};
  try {
    const parsed = JSON.parse(rawQ);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // ignore malformed filter, treat as no filter
  }
  return {};
}

// Date-only strings ("2026-07-10") coming from <input type="date"> and AI extraction are not
// valid ISO-8601 DateTime values as far as Prisma's SQLite connector is concerned — it wants a
// full timestamp. Coerce any key that looks like a date field into a real Date instead.
function coerceDates(data) {
  const out = { ...data };
  for (const [key, value] of Object.entries(out)) {
    if (typeof value !== 'string' || !/date/i.test(key)) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) out[key] = parsed;
  }
  return out;
}

function extraFilter(rawQ) {
  const filter = parseFilter(rawQ);
  const clean = {};
  for (const [key, value] of Object.entries(filter)) {
    if (OWNERSHIP_FIELDS.includes(key)) continue; // owner/relations are always derived server-side
    clean[key] = value;
  }
  return coerceDates(clean);
}

// Segundo critério de desempate quando a ordenação pedida empata (ex: várias transações com a
// mesma "date") — sem isso o empate cai na ordem natural da tabela, que no SQLite tende a ser a
// ordem de inserção crescente, fazendo o lançamento mais recente aparecer no fim do grupo em vez
// de no topo.
function buildOrderBy(sort) {
  if (!sort) return { created_date: 'desc' };
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  const primary = { [field]: desc ? 'desc' : 'asc' };
  if (field === 'created_date') return primary;
  return [primary, { created_date: 'desc' }];
}

function stripFields(body, fields) {
  const data = { ...(body || {}) };
  for (const field of fields) delete data[field];
  return data;
}

router.get('/:entityName/schema', (req, res) => {
  res.json(req.entityConfig.schema || { type: 'object', properties: {} });
});

router.get('/:entityName', async (req, res, next) => {
  try {
    const where = req.entityConfig.buildWhere(req.user, extraFilter(req.query.q));
    const orderBy = buildOrderBy(req.query.sort);
    const take = req.query.limit ? Number(req.query.limit) : undefined;
    const rows = await req.model.findMany({ where, orderBy, take });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:entityName/:id', async (req, res, next) => {
  try {
    const row = await req.model.findUnique({ where: { id: req.params.id } });
    if (!row || !req.entityConfig.canAccess(row, req.user)) {
      return res.status(404).json({ error: 'Não encontrado.' });
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.post('/:entityName', async (req, res, next) => {
  try {
    if (req.entityConfig.validateCreate) {
      await req.entityConfig.validateCreate(req.user);
    }
    const input = coerceDates(stripFields(req.body, [...SYSTEM_FIELDS, ...OWNERSHIP_FIELDS]));
    const data = req.entityConfig.prepareCreate(input, req.user);
    const row = await req.model.create({ data });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.post('/:entityName/bulk', async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Esperado um array de itens.' });
    }
    const created = [];
    for (const item of items) {
      const input = coerceDates(stripFields(item, [...SYSTEM_FIELDS, ...OWNERSHIP_FIELDS]));
      const data = req.entityConfig.prepareCreate(input, req.user);
      try {
        created.push(await req.model.create({ data }));
      } catch (err) {
        if (err.code === 'P2002') continue; // silently skip duplicates (e.g. category re-seed race)
        throw err;
      }
    }
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.patch('/:entityName/:id', async (req, res, next) => {
  try {
    const existing = await req.model.findUnique({ where: { id: req.params.id } });
    if (!existing || !req.entityConfig.canAccess(existing, req.user)) {
      return res.status(404).json({ error: 'Não encontrado.' });
    }
    const input = coerceDates(stripFields(req.body, [...SYSTEM_FIELDS, ...OWNERSHIP_FIELDS]));
    const data = req.entityConfig.prepareUpdate(input, req.user, existing);
    const row = await req.model.update({ where: { id: req.params.id }, data });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

router.delete('/:entityName/:id', async (req, res, next) => {
  try {
    const existing = await req.model.findUnique({ where: { id: req.params.id } });
    if (!existing || !req.entityConfig.canAccess(existing, req.user)) {
      return res.status(404).json({ error: 'Não encontrado.' });
    }
    await req.model.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

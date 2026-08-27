import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getInstallmentGroupKey } from "../components/lib/purchaseMatch";

function mapKey(cardId, groupKey) {
  return `${cardId}::${groupKey}`;
}

// Carrega, uma única vez, o comentário de identificação (ex: "Sofá", "Roupa da Maria") de cada
// compra parcelada do usuário — fonte única (PurchaseNote) resolvida por card_id + group_key em
// toda tela que lista o lançamento (fatura, transações, gastos por categoria, planejamento
// futuro), em vez de copiar o texto em cada parcela/cópia que representa a mesma compra. Ver o
// comentário do model PurchaseNote em server/prisma/schema.prisma.
export default function usePurchaseNotes() {
  const [notes, setNotes] = useState({}); // { [`${card_id}::${group_key}`]: PurchaseNote row }
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const user = await base44.auth.me();
      const rows = await base44.entities.PurchaseNote.filter({ created_by: user.email });
      const map = {};
      rows.forEach(r => { map[mapKey(r.card_id, r.group_key)] = r; });
      setNotes(map);
    } catch (e) {
      console.error("Erro ao carregar comentários de compras:", e);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // description pode ser o description da CreditCardTransaction ou o title do Bill (com ou sem
  // sufixo de parcela) — getInstallmentGroupKey normaliza os dois pro mesmo grupo.
  const getNote = useCallback((cardId, description) => {
    if (!cardId || !description) return "";
    return notes[mapKey(cardId, getInstallmentGroupKey(description))]?.notes || "";
  }, [notes]);

  // Cria, atualiza ou remove (texto vazio) o comentário da compra inteira de uma vez — todo
  // lançamento com o mesmo card_id + group_key passa a exibi-lo no próximo getNote, sem precisar
  // encontrar e atualizar cada parcela/cópia individualmente.
  const saveNote = useCallback(async (cardId, description, text) => {
    const groupKey = getInstallmentGroupKey(description);
    const key = mapKey(cardId, groupKey);
    const clean = String(text || "").trim();
    const existing = notes[key];

    if (!clean) {
      if (existing) {
        await base44.entities.PurchaseNote.delete(existing.id);
        setNotes(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
      return;
    }

    if (existing) {
      await base44.entities.PurchaseNote.update(existing.id, { notes: clean });
      setNotes(prev => ({ ...prev, [key]: { ...existing, notes: clean } }));
    } else {
      const created = await base44.entities.PurchaseNote.create({
        card_id: cardId,
        group_key: groupKey,
        notes: clean,
      });
      setNotes(prev => ({ ...prev, [key]: created }));
    }
  }, [notes]);

  return { getNote, saveNote, reload: load, loaded };
}

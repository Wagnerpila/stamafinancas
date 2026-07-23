// WhatsApp JIDs and user-entered numbers don't always agree on Brazil's extra mobile "9"
// digit (e.g. 5511999998888 vs 551199998888), so matching is done against a small set of
// plausible variants instead of a single normalized value.
export function phoneVariants(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return [];

  const core = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  const variants = new Set([digits, core]);

  if (core.length === 11) variants.add(core.slice(0, 2) + core.slice(3)); // drop the extra 9
  if (core.length === 10) variants.add(core.slice(0, 2) + '9' + core.slice(2)); // add a 9

  for (const v of [...variants]) variants.add('55' + v);
  return [...variants];
}

export function jidToPhoneVariants(jid) {
  const number = String(jid || '').split('@')[0].split(':')[0];
  return phoneVariants(number);
}

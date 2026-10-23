// Datas do bot trabalham sempre como string "YYYY-MM-DD" no fuso de São Paulo — o servidor pode
// rodar em UTC (Docker), e "hoje" às 22h em Brasília já é amanhã em UTC. As datas gravadas no
// banco seguem a convenção do resto do app: new Date("YYYY-MM-DD"), ou seja, meia-noite UTC.

const TZ = 'America/Sao_Paulo';

export function todayStr(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function currentHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(now));
}

export function weekdayOf(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay(); // 0 = domingo
}

export function isDateStr(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthStart(dateStr) {
  return dateStr.slice(0, 8) + '01';
}

export function addMonths(dateStr, months) {
  const d = new Date(monthStart(dateStr) + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function lastDayOfMonth(dateStr) {
  return addDays(addMonths(dateStr, 1), -1);
}

export function toDbDate(dateStr) {
  return new Date(dateStr + 'T00:00:00.000Z');
}

export function fromDbDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function formatDateBR(dateStr) {
  const [y, m, d] = String(dateStr).slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : String(dateStr);
}

export function formatShortBR(dateStr) {
  const [, m, d] = String(dateStr).slice(0, 10).split('-');
  return d && m ? `${d}/${m}` : String(dateStr);
}

export function nowTimeStr(now = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
}

// "YYYY-MM-DDTHH:mm" no horário de Brasília -> instante (Date). Brasília não tem horário de
// verão desde 2019, então o deslocamento é fixo em -03:00.
export function fromLocalDateTime(value) {
  const m = String(value || '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTimeBR(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function localDateOf(date) {
  return todayStr(new Date(date));
}

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function describePeriod(start, endInclusive) {
  if (start === monthStart(start) && endInclusive === lastDayOfMonth(start)) {
    return `${MONTHS[Number(start.slice(5, 7)) - 1]} de ${start.slice(0, 4)}`;
  }
  if (start === endInclusive) return formatDateBR(start);
  return `${formatDateBR(start)} a ${formatDateBR(endInclusive)}`;
}

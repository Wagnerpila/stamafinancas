import path from 'node:path';

// Reuses the same persistent volume as the SQLite DB (DATABASE_URL's directory) so the
// WhatsApp pairing session survives redeploys without needing a second volume mount.
function resolveDatabaseDir() {
  const url = process.env.DATABASE_URL || 'file:./dev.db';
  const filePath = url.replace(/^file:/, '');
  return path.dirname(path.resolve(process.cwd(), filePath));
}

export const WHATSAPP_SESSION_DIR =
  process.env.WHATSAPP_SESSION_DIR || path.join(resolveDatabaseDir(), 'whatsapp-session');

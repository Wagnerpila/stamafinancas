import fs from 'node:fs/promises';
import path from 'node:path';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
};

// Resolves a file_url returned by /api/upload back into base64 bytes for the AI provider.
// Local uploads are read straight off disk (no network hop needed); anything else is fetched.
export async function resolveFileForAI(fileUrl) {
  if (!fileUrl) return null;

  const localMarker = '/uploads/';
  const idx = fileUrl.indexOf(localMarker);
  if (idx !== -1) {
    const filename = fileUrl.slice(idx + localMarker.length).split(/[?#]/)[0];
    const filePath = path.join(UPLOAD_DIR, filename);
    if (!filePath.startsWith(UPLOAD_DIR)) {
      throw new Error('Caminho de arquivo inválido.');
    }
    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    return { base64: buffer.toString('base64'), mimeType: MIME_BY_EXT[ext] || 'application/octet-stream' };
  }

  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Não foi possível baixar o arquivo: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get('content-type') || 'application/octet-stream';
  return { base64: Buffer.from(arrayBuffer).toString('base64'), mimeType };
}

// ==============================================================================
// SMART JOURNEY MEDIA STORAGE UTILITY
// Eliminates Base64 Bloat by saving uploads as optimized local files and storing clean URLs
// ==============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * If the input is a base64 Data URL, writes it to public/uploads and returns the relative URL (/uploads/...).
 * If it's already an HTTP/HTTPS URL or existing relative path, returns it as-is.
 */
export function sanitizeAndPersistImage(imageStr?: string | null, prefix: string = 'media'): string {
  if (!imageStr || typeof imageStr !== 'string') return '';
  const trimmed = imageStr.trim();

  // If not a data URL, return as-is
  if (!trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  try {
    const matches = trimmed.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length < 3) {
      return trimmed;
    }

    let ext = matches[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (ext === 'svg+xml') ext = 'svg';

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    const hash = crypto.randomBytes(8).toString('hex');
    const fileName = `${prefix}-${Date.now()}-${hash}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    fs.writeFileSync(filePath, buffer);
    console.log(`[Media Storage] Persisted base64 image (${Math.round(buffer.length / 1024)} KB) to /uploads/${fileName}`);

    return `/uploads/${fileName}`;
  } catch (err) {
    console.error('[Media Storage Error] Failed to persist base64 image:', err);
    return trimmed;
  }
}

export function sanitizeAndPersistImages(images?: (string | null | undefined)[], prefix: string = 'gallery'): string[] {
  if (!Array.isArray(images)) return [];
  return images.map(img => sanitizeAndPersistImage(img, prefix)).filter(Boolean);
}

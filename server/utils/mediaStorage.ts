// ==============================================================================
// SMART JOURNEY MEDIA STORAGE UTILITY
// Eliminates Base64 Bloat by saving uploads as optimized local files and storing clean URLs
// Guaranteed synchronous disk persistence & Sharp compression
// ==============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';

const UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Validates, decodes, resizes/optimizes and persists a Base64 data URL to public/uploads.
 * AWAITS disk completion and verifies physical file presence before returning the URL.
 * If already an HTTP/HTTPS URL or existing relative path, returns it as-is.
 */
export async function sanitizeAndPersistImage(imageStr?: string | null, prefix: string = 'media'): Promise<string> {
  if (!imageStr || typeof imageStr !== 'string') return '';
  const trimmed = imageStr.trim();

  // If not a data URL, return as-is
  if (!trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  try {
    const matches = trimmed.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length < 3) {
      console.warn('[Media Storage Warning] Invalid Base64 data URL format.');
      return trimmed;
    }

    const format = matches[1].toLowerCase();
    const base64Data = matches[2];
    const rawBuffer = Buffer.from(base64Data, 'base64');

    if (rawBuffer.length === 0) {
      console.warn('[Media Storage Warning] Empty base64 buffer.');
      return '';
    }

    let finalBuffer: Buffer = rawBuffer;
    let fileExt = 'webp';

    // Optimize image using Sharp: resize to max 1920x1920, convert to high-performance WebP
    try {
      if (format === 'svg' || format === 'svg+xml') {
        finalBuffer = rawBuffer;
        fileExt = 'svg';
      } else {
        finalBuffer = await sharp(rawBuffer)
          .rotate() // Auto-orient based on EXIF
          .resize(1920, 1920, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality: 85, effort: 4 })
          .toBuffer();
        fileExt = 'webp';
      }
    } catch (sharpErr) {
      console.warn('[Media Storage Optimization Fallback] Sharp failed, using raw buffer:', sharpErr);
      finalBuffer = rawBuffer;
      fileExt = format === 'jpeg' ? 'jpg' : (format.split('+')[0] || 'png');
    }

    const hash = crypto.randomBytes(8).toString('hex');
    const fileName = `${prefix}-${Date.now()}-${hash}.${fileExt}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    // Reliable atomic write with fsync to flush to physical storage
    const tempPath = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    const fd = await fs.promises.open(tempPath, 'w');
    try {
      await fd.writeFile(finalBuffer);
      await fd.sync();
    } finally {
      await fd.close();
    }
    await fs.promises.rename(tempPath, filePath);

    // Verify physical file existence
    if (!fs.existsSync(filePath)) {
      throw new Error(`File write verification failed: ${filePath} does not exist after write completion.`);
    }

    const stats = fs.statSync(filePath);
    console.log(`[Media Storage] ✅ Successfully persisted image (${Math.round(stats.size / 1024)} KB, was ${Math.round(rawBuffer.length / 1024)} KB) to /uploads/${fileName}`);
    return `/uploads/${fileName}`;
  } catch (err: any) {
    console.error('[Media Storage Error] Failed to persist image:', err.message);
    throw new Error(`Image storage failure: ${err.message}`);
  }
}

export async function sanitizeAndPersistImages(images?: (string | null | undefined)[], prefix: string = 'gallery'): Promise<string[]> {
  if (!Array.isArray(images)) return [];
  const results: string[] = [];
  for (const img of images) {
    if (img) {
      const persisted = await sanitizeAndPersistImage(img, prefix);
      if (persisted) results.push(persisted);
    }
  }
  return results;
}

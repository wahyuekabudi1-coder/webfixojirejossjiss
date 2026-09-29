// ==============================================================================
// SMART JOURNEY ADMIN CREDENTIALS & SECURITY REPOSITORY
// Pure Relational SQL implementation (MySQL / SQLite)
// Authoritative Single Source of Truth for Staff & Admin Passwords
// ==============================================================================
import crypto from 'crypto';
import { DatabaseClient } from '../types';
import { getDB } from '../pool';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPasswordHash(password: string, stored: string): boolean {
  try {
    if (!stored || !password) return false;
    const parts = stored.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false;
    }
    const salt = parts[1];
    const originalHash = parts[2];
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    const bufA = Buffer.from(computedHash, 'hex');
    const bufB = Buffer.from(originalHash, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (err) {
    return false;
  }
}

export class CredentialsRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async getStoredPasswordHash(): Promise<string | null> {
    const client = await this.db();
    const rows = await client.query<{ meta_value: string }>(
      "SELECT meta_value FROM system_meta WHERE meta_key = 'admin_password_hash' LIMIT 1"
    );
    if (!rows || rows.length === 0) return null;
    return rows[0].meta_value || null;
  }

  async savePasswordHash(hashStr: string): Promise<void> {
    const client = await this.db();
    const now = new Date().toISOString();
    const existing = await client.query<{ meta_key: string }>(
      "SELECT meta_key FROM system_meta WHERE meta_key = 'admin_password_hash' LIMIT 1"
    );
    if (existing && existing.length > 0) {
      await client.execute(
        "UPDATE system_meta SET meta_value = ?, updated_at = ? WHERE meta_key = 'admin_password_hash'",
        [hashStr, now]
      );
    } else {
      await client.execute(
        "INSERT INTO system_meta (meta_key, meta_value, updated_at) VALUES ('admin_password_hash', ?, ?)",
        [hashStr, now]
      );
    }
  }

  async verifyPassword(inputPassword: string): Promise<boolean> {
    const cleanInput = String(inputPassword || '').trim();
    if (!cleanInput) return false;

    const storedHash = await this.getStoredPasswordHash();
    if (storedHash) {
      return verifyPasswordHash(cleanInput, storedHash);
    }

    // Fallback to configured environment password if not yet customized in database
    const configuredPassword = (process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== 'production' ? 'admin123' : '')).trim();
    if (configuredPassword.length > 0 && cleanInput === configuredPassword) {
      return true;
    }

    const configuredSecret = (process.env.ADMIN_SECRET_KEY || '').trim();
    if (configuredSecret.length > 0 && cleanInput === configuredSecret) {
      return true;
    }

    return false;
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword?: string
  ): Promise<{ success: boolean; message: string; httpStatus: number }> {
    const cleanCurrent = String(currentPassword || '').trim();
    const cleanNew = String(newPassword || '').trim();
    const cleanConfirm = confirmPassword !== undefined ? String(confirmPassword).trim() : cleanNew;

    // 1. Current password verification
    if (!cleanCurrent) {
      return { success: false, message: 'Kata sandi saat ini wajib diisi.', httpStatus: 400 };
    }

    const isCurrentValid = await this.verifyPassword(cleanCurrent);
    if (!isCurrentValid) {
      return { success: false, message: 'Kata sandi saat ini tidak valid.', httpStatus: 401 };
    }

    // 2. New password validation
    if (!cleanNew || cleanNew.length < 6) {
      return { success: false, message: 'Kata sandi baru minimal 6 karakter.', httpStatus: 400 };
    }

    if (cleanNew !== cleanConfirm) {
      return { success: false, message: 'Konfirmasi kata sandi baru tidak cocok.', httpStatus: 400 };
    }

    // 3. Hash & store in SQL system_meta
    const newHash = hashPassword(cleanNew);
    await this.savePasswordHash(newHash);

    return {
      success: true,
      message: 'Kata sandi operasional admin berhasil diperbarui secara permanen.',
      httpStatus: 200
    };
  }
}

export const credentialsRepo = new CredentialsRepository();

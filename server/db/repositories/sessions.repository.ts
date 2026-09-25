// ==============================================================================
// SMART JOURNEY ADMIN SESSIONS REPOSITORY
// Pure Relational SQL implementation (MySQL / SQLite)
// ==============================================================================

import { DatabaseClient } from '../types';
import { getDB } from '../pool';

export interface AdminSessionEntity {
  token: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

export class SessionsRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async createSession(token: string, emailOrHours: string | number = 'admin', role: string = 'superadmin', hoursValid: number = 72): Promise<AdminSessionEntity> {
    const client = await this.db();
    const now = new Date();
    const effectiveHours = typeof emailOrHours === 'number' ? (emailOrHours > 1000 ? emailOrHours / (3600 * 1000) : emailOrHours) : hoursValid;
    const effectiveEmail = typeof emailOrHours === 'string' ? emailOrHours : 'admin';
    const expires = new Date(now.getTime() + effectiveHours * 60 * 60 * 1000);

    const session: AdminSessionEntity = {
      token,
      email: effectiveEmail,
      role,
      expiresAt: expires.toISOString(),
      createdAt: now.toISOString()
    };

    await client.execute(
      'INSERT INTO admin_sessions (token, email, role, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
      [session.token, session.email, session.role, session.expiresAt, session.createdAt]
    );

    return session;
  }

  async getAllActive(): Promise<AdminSessionEntity[]> {
    const client = await this.db();
    const nowIso = new Date().toISOString();
    const rows = await client.query<{
      token: string;
      email: string;
      role: string;
      expires_at: string;
      created_at: string;
    }>(
      'SELECT * FROM admin_sessions WHERE expires_at > ?',
      [nowIso]
    );
    return rows.map(r => ({
      token: r.token,
      email: r.email,
      role: r.role,
      expiresAt: r.expires_at,
      createdAt: r.created_at
    }));
  }

  async getSession(token: string): Promise<AdminSessionEntity | null> {
    const client = await this.db();
    const rows = await client.query<{
      token: string;
      email: string;
      role: string;
      expires_at: string;
      created_at: string;
    }>(
      'SELECT * FROM admin_sessions WHERE token = ? LIMIT 1',
      [token]
    );

    if (!rows || rows.length === 0) return null;
    const r = rows[0];

    // Check expiration
    if (new Date(r.expires_at) < new Date()) {
      await this.deleteSession(token);
      return null;
    }

    return {
      token: r.token,
      email: r.email,
      role: r.role,
      expiresAt: r.expires_at,
      createdAt: r.created_at
    };
  }

  async deleteSession(token: string): Promise<boolean> {
    const client = await this.db();
    const res = await client.execute('DELETE FROM admin_sessions WHERE token = ?', [token]);
    return res.affectedRows > 0;
  }
}

export const sessionsRepo = new SessionsRepository();

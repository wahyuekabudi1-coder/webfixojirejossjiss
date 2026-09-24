// ==============================================================================
// SMART JOURNEY ADMIN DRAFTS REPOSITORY
// Pure Relational SQL implementation (MySQL / SQLite)
// ==============================================================================

import { DatabaseClient } from '../types';
import { getDB } from '../pool';

export interface AdminDraftEntity {
  draftKey: string;
  title: string;
  content: any;
  updatedAt: string;
}

export class DraftsRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async getAll(): Promise<Record<string, any>> {
    const client = await this.db();
    const rows = await client.query<{ draft_key: string; content: string }>(
      'SELECT draft_key, content FROM admin_drafts'
    );
    const result: Record<string, any> = {};
    for (const r of rows) {
      try {
        result[r.draft_key] = JSON.parse(r.content);
      } catch {
        result[r.draft_key] = r.content;
      }
    }
    return result;
  }

  async getByKey(key: string): Promise<any | null> {
    const client = await this.db();
    const rows = await client.query<{ content: string }>(
      'SELECT content FROM admin_drafts WHERE draft_key = ? LIMIT 1',
      [key]
    );
    if (!rows || rows.length === 0) return null;
    try {
      return JSON.parse(rows[0].content);
    } catch {
      return rows[0].content;
    }
  }

  async save(key: string, data: any, title?: string): Promise<void> {
    const client = await this.db();
    const now = new Date().toISOString();
    const content = typeof data === 'string' ? data : JSON.stringify(data);

    // Delete existing and insert fresh (idempotent upsert across MySQL and SQLite)
    await client.execute('DELETE FROM admin_drafts WHERE draft_key = ?', [key]);
    await client.execute(
      'INSERT INTO admin_drafts (draft_key, title, content, updated_at) VALUES (?, ?, ?, ?)',
      [key, title || key, content, now]
    );
  }

  async delete(key: string): Promise<boolean> {
    const client = await this.db();
    const res = await client.execute('DELETE FROM admin_drafts WHERE draft_key = ?', [key]);
    return res.affectedRows > 0;
  }
}

export const draftsRepo = new DraftsRepository();

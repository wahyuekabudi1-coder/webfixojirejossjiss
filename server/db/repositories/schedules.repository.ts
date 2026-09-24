// ==============================================================================
// SMART JOURNEY SCHEDULES REPOSITORY
// Pure Relational SQL implementation (MySQL / SQLite)
// ==============================================================================

import { DatabaseClient } from '../types';
import { getDB } from '../pool';

export interface ScheduleEntity {
  id: string;
  name: string;
  category: string;
  startDate: string;
  endDate: string;
  slots: number;
  notes?: string;
  createdAt: string;
}

export class SchedulesRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async getAll(): Promise<ScheduleEntity[]> {
    const client = await this.db();
    const rows = await client.query<{
      id: string;
      name: string;
      category: string;
      start_date: string;
      end_date: string;
      slots: number;
      notes: string;
      created_at: string;
    }>('SELECT * FROM schedules ORDER BY start_date ASC');

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      startDate: r.start_date,
      endDate: r.end_date,
      slots: Number(r.slots) || 0,
      notes: r.notes || '',
      createdAt: r.created_at || new Date().toISOString()
    }));
  }

  async create(schedule: Partial<ScheduleEntity>): Promise<ScheduleEntity> {
    const client = await this.db();
    const id = schedule.id || `sch-${Date.now()}`;
    const now = new Date().toISOString();

    await client.execute(
      'INSERT INTO schedules (id, name, category, start_date, end_date, slots, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        schedule.name || '',
        schedule.category || 'General',
        schedule.startDate || '',
        schedule.endDate || '',
        Number(schedule.slots) || 0,
        schedule.notes || '',
        now
      ]
    );

    return {
      id,
      name: schedule.name || '',
      category: schedule.category || 'General',
      startDate: schedule.startDate || '',
      endDate: schedule.endDate || '',
      slots: Number(schedule.slots) || 0,
      notes: schedule.notes || '',
      createdAt: now
    };
  }

  async delete(id: string): Promise<boolean> {
    const client = await this.db();
    const res = await client.execute('DELETE FROM schedules WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }
}

export const schedulesRepo = new SchedulesRepository();

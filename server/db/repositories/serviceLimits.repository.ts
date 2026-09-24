// ==============================================================================
// SMART JOURNEY SERVICE LIMITS REPOSITORY
// Pure Relational SQL implementation (MySQL / SQLite)
// ==============================================================================

import { DatabaseClient } from '../types';
import { getDB } from '../pool';

export class ServiceLimitsRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async getAll(): Promise<Record<string, number>> {
    const client = await this.db();
    const rows = await client.query<{ service_type: string; daily_limit: number }>(
      'SELECT service_type, daily_limit FROM service_limits'
    );
    const defaults: Record<string, number> = {
      tour: 8,
      airport: 6,
      taxi: 7,
      rental: 9
    };
    for (const r of rows) {
      defaults[r.service_type] = Number(r.daily_limit);
    }
    return defaults;
  }

  async getLimits(): Promise<Record<string, number>> {
    return this.getAll();
  }

  async setLimit(serviceType: string, limit: number): Promise<void> {
    const client = await this.db();
    const now = new Date().toISOString();
    await client.execute('DELETE FROM service_limits WHERE service_type = ?', [serviceType]);
    await client.execute(
      'INSERT INTO service_limits (service_type, daily_limit, updated_at) VALUES (?, ?, ?)',
      [serviceType, Number(limit), now]
    );
  }

  async saveLimits(limits: Record<string, any>): Promise<Record<string, number>> {
    for (const [key, val] of Object.entries(limits)) {
      if (typeof val === 'number' || !isNaN(Number(val))) {
        await this.setLimit(key, Number(val));
      }
    }
    return this.getAll();
  }
}

export const serviceLimitsRepo = new ServiceLimitsRepository();

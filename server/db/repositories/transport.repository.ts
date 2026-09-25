// ==============================================================================
// SMART JOURNEY TRANSPORT REPOSITORY (RENTAL, TAXI, AIRPORT TRANSFERS)
// Pure Relational SQL implementation (MySQL / SQLite)
// ==============================================================================

import { DatabaseClient } from '../types';
import { getDB } from '../pool';

export class TransportRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async getCategoryData<T = any>(category: 'rentals' | 'airportTransfers' | 'taxiServices'): Promise<T | null> {
    const client = await this.db();
    const rows = await client.query<{ data: string }>(
      'SELECT data FROM transport_data WHERE category = ? LIMIT 1',
      [category]
    );
    if (!rows || rows.length === 0) return null;
    try {
      return JSON.parse(rows[0].data);
    } catch {
      return null;
    }
  }

  async saveCategoryData(category: 'rentals' | 'airportTransfers' | 'taxiServices', data: any): Promise<void> {
    const client = await this.db();
    const now = new Date().toISOString();
    const jsonStr = JSON.stringify(data || {});

    await client.execute('DELETE FROM transport_data WHERE category = ?', [category]);
    await client.execute(
      'INSERT INTO transport_data (category, data, updated_at) VALUES (?, ?, ?)',
      [category, jsonStr, now]
    );
  }

  async getTaxiRoutes(): Promise<any[]> {
    const data = await this.getCategoryData<any[]>('taxiServices');
    return Array.isArray(data) ? data : [];
  }

  async saveTaxiRoutes(routes: any[]): Promise<void> {
    await this.saveCategoryData('taxiServices', routes);
  }

  async getAirportTransfers(): Promise<any[]> {
    const data = await this.getCategoryData<any[]>('airportTransfers');
    return Array.isArray(data) ? data : [];
  }

  async saveAirportTransfers(transfers: any[]): Promise<void> {
    await this.saveCategoryData('airportTransfers', transfers);
  }
}

export const transportRepo = new TransportRepository();

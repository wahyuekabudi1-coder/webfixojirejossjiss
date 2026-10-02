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
    const data = await this.getCategoryData<any>('taxiServices');
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.routes)) return data.routes;
    return [];
  }

  async saveTaxiRoutes(routes: any[]): Promise<void> {
    const current = await this.getCategoryData<any>('taxiServices');
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      await this.saveCategoryData('taxiServices', {
        ...current,
        routes
      });
    } else {
      await this.saveCategoryData('taxiServices', {
        masterAreas: [
          { id: "area-sub", code: "SUB", name: "Surabaya", type: "City" },
          { id: "area-mlg", code: "MLG", name: "Malang", type: "City" },
          { id: "area-brm", code: "BRM", name: "Bromo", type: "City" }
        ],
        destinations: [],
        pricingRules: [
          { id: "taxi-rule-sub-mlg", source_id: "area-sub", destination_id: "area-mlg", price_idr: 300000, status: "Active" },
          { id: "taxi-rule-sub-brm", source_id: "area-sub", destination_id: "area-brm", price_idr: 650000, status: "Active" },
          { id: "taxi-rule-sub-mlg-prem", source_id: "area-sub", destination_id: "area-mlg", vehicle_type: "Premium", price_idr: 450000, status: "Active" }
        ],
        areaRules: [
          { id: "ar-brm-surcharge", area_id: "area-brm", surcharge_idr: 50000, is_blackout: false, note: "Bromo National Park Entrance Surcharge" }
        ],
        importHistory: [],
        routes
      });
    }
  }

  async getAirportTransfers(): Promise<any[]> {
    const data = await this.getCategoryData<any>('airportTransfers');
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.transfers)) return data.transfers;
    return [];
  }

  async saveAirportTransfers(transfers: any[]): Promise<void> {
    const current = await this.getCategoryData<any>('airportTransfers');
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      current.transfers = Array.isArray(transfers) ? transfers : [];
      await this.saveCategoryData('airportTransfers', current);
    } else {
      await this.saveCategoryData('airportTransfers', {
        airports: [],
        routes: [],
        transfers: Array.isArray(transfers) ? transfers : []
      });
    }
  }
}

export const transportRepo = new TransportRepository();

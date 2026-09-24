// ==============================================================================
// SMART JOURNEY TOURS REPOSITORY
// Pure Relational SQL implementation (MySQL / SQLite) with Parameterized Queries
// ==============================================================================

import { DatabaseClient, TourRow } from '../types';
import { getDB } from '../pool';

export interface TourEntity {
  id: string;
  name: string;
  description: string;
  category: string;
  days: number;
  nights: number;
  duration: string;
  startingPrice: number;
  startingPriceIDR: number;
  wniPrice: number;
  wnaPrice: number;
  rating: number;
  reviewCount: number;
  image: string;
  highlights: string[];
  itinerary: any[];
  includes?: string[];
  excludes?: string[];
  whatToBring?: string[];
  status: 'published' | 'draft' | 'unpublished' | 'archived';
  isDeleted?: boolean;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
}

function parseJsonArray<T = any>(val: any, fallback: T[] = []): T[] {
  if (Array.isArray(val)) return val;
  if (!val || typeof val !== 'string') return fallback;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function rowToTour(row: TourRow): TourEntity {
  const statusStr = (row.status || 'published').toLowerCase();
  const normalizedStatus = (statusStr === 'published' || statusStr === 'draft' || statusStr === 'archived')
    ? statusStr as 'published' | 'draft' | 'archived'
    : 'published';

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    category: row.category || 'Private Tour',
    days: Number(row.days) || 1,
    nights: Number(row.nights) || 0,
    duration: row.duration || `${row.days || 1}D`,
    startingPrice: Number(row.starting_price_usd) || Number(row.wna_price) || 0,
    startingPriceIDR: Number(row.starting_price_idr) || Number(row.wni_price) || 0,
    wniPrice: Number(row.wni_price) || Number(row.starting_price_idr) || 0,
    wnaPrice: Number(row.wna_price) || Number(row.starting_price_usd) || 0,
    rating: Number(row.rating) || 5.0,
    reviewCount: Number(row.review_count) || 0,
    image: row.image || '',
    highlights: parseJsonArray<string>(row.highlights),
    itinerary: parseJsonArray<any>(row.itinerary),
    includes: parseJsonArray<string>(row.includes),
    excludes: parseJsonArray<string>(row.excludes),
    whatToBring: parseJsonArray<string>(row.what_to_bring),
    status: normalizedStatus,
    isDeleted: Boolean(row.is_deleted),
    isArchived: Boolean(row.is_archived || normalizedStatus === 'archived'),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

export class ToursRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async getAll(options: { all?: boolean; status?: string } = {}): Promise<TourEntity[]> {
    const client = await this.db();
    let sql = 'SELECT * FROM tours WHERE is_deleted = 0';
    const params: any[] = [];

    if (!options.all) {
      sql += ' AND status = ?';
      params.push('published');
    } else if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }

    sql += ' ORDER BY created_at DESC';

    const rows = await client.query<TourRow>(sql, params);
    return rows.map(rowToTour);
  }

  async getById(id: string): Promise<TourEntity | null> {
    const client = await this.db();
    const rows = await client.query<TourRow>(
      'SELECT * FROM tours WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows || rows.length === 0) return null;
    return rowToTour(rows[0]);
  }

  async create(tour: Partial<TourEntity>): Promise<TourEntity> {
    const client = await this.db();
    const now = new Date().toISOString();
    const id = (tour.id && tour.id.trim() !== '') ? tour.id.trim() : `tour-${Date.now()}`;
    const status = tour.status || 'published';

    const sql = `
      INSERT INTO tours (
        id, name, description, category, days, nights, duration,
        starting_price_usd, starting_price_idr, wni_price, wna_price,
        rating, review_count, image, highlights, itinerary, includes, excludes, what_to_bring,
        status, is_deleted, is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      tour.name || '',
      tour.description || '',
      tour.category || 'Private Tour',
      Number(tour.days) || 1,
      Number(tour.nights) || 0,
      tour.duration || `${tour.days || 1}D`,
      Number(tour.startingPrice) || Number(tour.wnaPrice) || 0,
      Number(tour.startingPriceIDR) || Number(tour.wniPrice) || 0,
      Number(tour.wniPrice) || Number(tour.startingPriceIDR) || 0,
      Number(tour.wnaPrice) || Number(tour.startingPrice) || 0,
      Number(tour.rating) || 5.0,
      Number(tour.reviewCount) || 0,
      tour.image || '',
      JSON.stringify(tour.highlights || []),
      JSON.stringify(tour.itinerary || []),
      JSON.stringify(tour.includes || []),
      JSON.stringify(tour.excludes || []),
      JSON.stringify(tour.whatToBring || []),
      status,
      0, // is_deleted
      status === 'archived' ? 1 : 0, // is_archived
      tour.createdAt || now,
      now
    ];

    await client.execute(sql, params);
    const created = await this.getById(id);
    if (!created) {
      throw new Error(`Failed to retrieve tour ${id} immediately after insert.`);
    }
    return created;
  }

  async update(id: string, tour: Partial<TourEntity>): Promise<TourEntity | null> {
    const client = await this.db();
    const existing = await this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const status = tour.status || existing.status;

    const sql = `
      UPDATE tours SET
        name = ?,
        description = ?,
        category = ?,
        days = ?,
        nights = ?,
        duration = ?,
        starting_price_usd = ?,
        starting_price_idr = ?,
        wni_price = ?,
        wna_price = ?,
        rating = ?,
        review_count = ?,
        image = ?,
        highlights = ?,
        itinerary = ?,
        includes = ?,
        excludes = ?,
        what_to_bring = ?,
        status = ?,
        is_archived = ?,
        updated_at = ?
      WHERE id = ?
    `;

    const params = [
      tour.name !== undefined ? tour.name : existing.name,
      tour.description !== undefined ? tour.description : existing.description,
      tour.category !== undefined ? tour.category : existing.category,
      tour.days !== undefined ? Number(tour.days) : existing.days,
      tour.nights !== undefined ? Number(tour.nights) : existing.nights,
      tour.duration !== undefined ? tour.duration : existing.duration,
      tour.startingPrice !== undefined ? Number(tour.startingPrice) : existing.startingPrice,
      tour.startingPriceIDR !== undefined ? Number(tour.startingPriceIDR) : existing.startingPriceIDR,
      tour.wniPrice !== undefined ? Number(tour.wniPrice) : existing.wniPrice,
      tour.wnaPrice !== undefined ? Number(tour.wnaPrice) : existing.wnaPrice,
      tour.rating !== undefined ? Number(tour.rating) : existing.rating,
      tour.reviewCount !== undefined ? Number(tour.reviewCount) : existing.reviewCount,
      tour.image !== undefined ? tour.image : existing.image,
      JSON.stringify(tour.highlights !== undefined ? tour.highlights : existing.highlights),
      JSON.stringify(tour.itinerary !== undefined ? tour.itinerary : existing.itinerary),
      JSON.stringify(tour.includes !== undefined ? tour.includes : existing.includes),
      JSON.stringify(tour.excludes !== undefined ? tour.excludes : existing.excludes),
      JSON.stringify(tour.whatToBring !== undefined ? tour.whatToBring : existing.whatToBring),
      status,
      status === 'archived' ? 1 : 0,
      now,
      id
    ];

    await client.execute(sql, params);
    return await this.getById(id);
  }

  async delete(id: string): Promise<{ success: boolean; id: string; mode: 'archived' | 'deleted' }> {
    const client = await this.db();
    const existing = await this.getById(id);
    if (!existing) {
      return { success: false, id, mode: 'deleted' };
    }

    // Check if there are historical bookings linked to this tour
    const bookingRows = await client.query<{ id: string }>(
      'SELECT id FROM bookings WHERE service_id = ? LIMIT 1',
      [id]
    );
    const hasBookings = bookingRows && bookingRows.length > 0;

    if (hasBookings) {
      // Soft-delete / archive to preserve historical customer records and invoices
      await client.execute(
        'UPDATE tours SET status = ?, is_archived = 1, is_deleted = 1, updated_at = ? WHERE id = ?',
        ['archived', new Date().toISOString(), id]
      );
      return { success: true, id, mode: 'archived' };
    } else {
      // Physical removal if no dependent transactions exist
      await client.execute('DELETE FROM tours WHERE id = ?', [id]);
      return { success: true, id, mode: 'deleted' };
    }
  }

  async setStatus(id: string, status: 'published' | 'draft' | 'archived'): Promise<TourEntity | null> {
    const client = await this.db();
    const now = new Date().toISOString();
    await client.execute(
      'UPDATE tours SET status = ?, is_archived = ?, updated_at = ? WHERE id = ?',
      [status, status === 'archived' ? 1 : 0, now, id]
    );
    return await this.getById(id);
  }
}

export const toursRepo = new ToursRepository();

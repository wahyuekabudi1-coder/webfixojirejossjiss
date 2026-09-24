// ==============================================================================
// SMART JOURNEY SHARE TOURS & BATCHES REPOSITORY
// Pure Relational SQL implementation (MySQL / SQLite)
// ==============================================================================

import { DatabaseClient, ShareTourRow, BatchRow } from '../types';
import { getDB } from '../pool';

export interface ShareTourEntity {
  id: string;
  title: string;
  slug: string;
  location: string;
  category: string;
  duration: string;
  days: number;
  nights: number;
  description: string;
  coverImage: string;
  gallery: string[];
  highlight: string[];
  included: string[];
  excluded: string[];
  faq: any[];
  status: string;
  startingPrice: number;
  price: number;
  startingPriceIDR: number;
  itinerary: any[];
  createdAt: string;
  updatedAt: string;
}

export interface BatchEntity {
  id: string;
  tripId: string;
  departureDate: string;
  quota: number;
  availableSeats: number;
  price: number;
  status: string;
}

function parseJsonArray<T = any>(val: any): T[] {
  if (Array.isArray(val)) return val;
  if (!val || typeof val !== 'string') return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rowToShareTour(row: ShareTourRow): ShareTourEntity {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    location: row.location || '',
    category: row.category || 'Open Trip',
    duration: row.duration || '1D',
    days: Number(row.days) || 1,
    nights: Number(row.nights) || 0,
    description: row.description || '',
    coverImage: row.cover_image || '',
    gallery: parseJsonArray<string>(row.gallery),
    highlight: parseJsonArray<string>(row.highlight),
    included: parseJsonArray<string>(row.included),
    excluded: parseJsonArray<string>(row.excluded),
    faq: parseJsonArray<any>(row.faq),
    status: row.status || 'published',
    startingPrice: Number(row.starting_price_usd) || 0,
    price: Number(row.starting_price_idr) || 0,
    startingPriceIDR: Number(row.starting_price_idr) || 0,
    itinerary: parseJsonArray<any>(row.itinerary),
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

function rowToBatch(row: BatchRow): BatchEntity {
  return {
    id: row.id,
    tripId: row.trip_id,
    departureDate: row.departure_date,
    quota: Number(row.quota) || 10,
    availableSeats: Number(row.available_seats) || 0,
    price: Number(row.price) || 0,
    status: row.status || 'open'
  };
}

export class ShareToursRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async getAllTrips(options: { all?: boolean } = {}): Promise<ShareTourEntity[]> {
    const client = await this.db();
    let sql = 'SELECT * FROM share_tours';
    const params: any[] = [];
    if (!options.all) {
      sql += ' WHERE status = ?';
      params.push('published');
    }
    sql += ' ORDER BY created_at DESC';
    const rows = await client.query<ShareTourRow>(sql, params);
    return rows.map(rowToShareTour);
  }

  async getTripById(idOrSlug: string): Promise<ShareTourEntity | null> {
    const client = await this.db();
    const rows = await client.query<ShareTourRow>(
      'SELECT * FROM share_tours WHERE id = ? OR slug = ? LIMIT 1',
      [idOrSlug, idOrSlug]
    );
    if (!rows || rows.length === 0) return null;
    return rowToShareTour(rows[0]);
  }

  async createTrip(trip: Partial<ShareTourEntity>): Promise<ShareTourEntity> {
    const client = await this.db();
    const now = new Date().toISOString();
    const id = trip.id && trip.id.trim() !== '' ? trip.id.trim() : `trip-${Date.now()}`;
    const slug = trip.slug && trip.slug.trim() !== '' ? trip.slug.trim() : `trip-${Date.now()}`;

    const sql = `
      INSERT INTO share_tours (
        id, title, slug, location, category, duration, days, nights, description,
        cover_image, gallery, highlight, included, excluded, faq, status,
        starting_price_idr, starting_price_usd, itinerary, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      trip.title || '',
      slug,
      trip.location || '',
      trip.category || 'Open Trip',
      trip.duration || '1D',
      Number(trip.days) || 1,
      Number(trip.nights) || 0,
      trip.description || '',
      trip.coverImage || '',
      JSON.stringify(trip.gallery || []),
      JSON.stringify(trip.highlight || []),
      JSON.stringify(trip.included || []),
      JSON.stringify(trip.excluded || []),
      JSON.stringify(trip.faq || []),
      trip.status || 'published',
      Number(trip.startingPriceIDR || trip.price) || 0,
      Number(trip.startingPrice) || 0,
      JSON.stringify(trip.itinerary || []),
      trip.createdAt || now,
      now
    ];

    await client.execute(sql, params);
    const created = await this.getTripById(id);
    if (!created) throw new Error(`Failed to retrieve created share tour: ${id}`);
    return created;
  }

  async updateTrip(id: string, trip: Partial<ShareTourEntity>): Promise<ShareTourEntity | null> {
    const client = await this.db();
    const existing = await this.getTripById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const sql = `
      UPDATE share_tours SET
        title = ?,
        slug = ?,
        location = ?,
        category = ?,
        duration = ?,
        days = ?,
        nights = ?,
        description = ?,
        cover_image = ?,
        gallery = ?,
        highlight = ?,
        included = ?,
        excluded = ?,
        faq = ?,
        status = ?,
        starting_price_idr = ?,
        starting_price_usd = ?,
        itinerary = ?,
        updated_at = ?
      WHERE id = ?
    `;

    const params = [
      trip.title !== undefined ? trip.title : existing.title,
      trip.slug !== undefined ? trip.slug : existing.slug,
      trip.location !== undefined ? trip.location : existing.location,
      trip.category !== undefined ? trip.category : existing.category,
      trip.duration !== undefined ? trip.duration : existing.duration,
      trip.days !== undefined ? Number(trip.days) : existing.days,
      trip.nights !== undefined ? Number(trip.nights) : existing.nights,
      trip.description !== undefined ? trip.description : existing.description,
      trip.coverImage !== undefined ? trip.coverImage : existing.coverImage,
      JSON.stringify(trip.gallery !== undefined ? trip.gallery : existing.gallery),
      JSON.stringify(trip.highlight !== undefined ? trip.highlight : existing.highlight),
      JSON.stringify(trip.included !== undefined ? trip.included : existing.included),
      JSON.stringify(trip.excluded !== undefined ? trip.excluded : existing.excluded),
      JSON.stringify(trip.faq !== undefined ? trip.faq : existing.faq),
      trip.status !== undefined ? trip.status : existing.status,
      trip.startingPriceIDR !== undefined ? Number(trip.startingPriceIDR) : existing.startingPriceIDR,
      trip.startingPrice !== undefined ? Number(trip.startingPrice) : existing.startingPrice,
      JSON.stringify(trip.itinerary !== undefined ? trip.itinerary : existing.itinerary),
      now,
      id
    ];

    await client.execute(sql, params);
    return await this.getTripById(id);
  }

  async deleteTrip(id: string): Promise<boolean> {
    const client = await this.db();
    await client.execute('DELETE FROM batches WHERE trip_id = ?', [id]);
    const res = await client.execute('DELETE FROM share_tours WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  // Batches
  async getAllBatches(): Promise<BatchEntity[]> {
    const client = await this.db();
    const rows = await client.query<BatchRow>('SELECT * FROM batches ORDER BY departure_date ASC');
    return rows.map(rowToBatch);
  }

  async getBatchById(id: string): Promise<BatchEntity | null> {
    const client = await this.db();
    const rows = await client.query<BatchRow>('SELECT * FROM batches WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return null;
    return rowToBatch(rows[0]);
  }

  async createBatch(batch: Partial<BatchEntity>): Promise<BatchEntity> {
    const client = await this.db();
    const now = new Date().toISOString();
    const id = batch.id && batch.id.trim() !== '' ? batch.id.trim() : `batch-${Date.now()}`;

    const sql = `
      INSERT INTO batches (id, trip_id, departure_date, quota, available_seats, price, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      batch.tripId || '',
      batch.departureDate || '',
      Number(batch.quota) || 10,
      Number(batch.availableSeats !== undefined ? batch.availableSeats : batch.quota) || 10,
      Number(batch.price) || 0,
      batch.status || 'open',
      now,
      now
    ];

    await client.execute(sql, params);
    const created = await this.getBatchById(id);
    if (!created) throw new Error(`Failed to retrieve batch ${id}`);
    return created;
  }

  async updateBatch(id: string, batch: Partial<BatchEntity>): Promise<BatchEntity | null> {
    const client = await this.db();
    const existing = await this.getBatchById(id);
    if (!existing) return null;

    const sql = `
      UPDATE batches SET
        trip_id = ?,
        departure_date = ?,
        quota = ?,
        available_seats = ?,
        price = ?,
        status = ?,
        updated_at = ?
      WHERE id = ?
    `;

    const params = [
      batch.tripId !== undefined ? batch.tripId : existing.tripId,
      batch.departureDate !== undefined ? batch.departureDate : existing.departureDate,
      batch.quota !== undefined ? Number(batch.quota) : existing.quota,
      batch.availableSeats !== undefined ? Number(batch.availableSeats) : existing.availableSeats,
      batch.price !== undefined ? Number(batch.price) : existing.price,
      batch.status !== undefined ? batch.status : existing.status,
      new Date().toISOString(),
      id
    ];

    await client.execute(sql, params);
    return await this.getBatchById(id);
  }

  async deleteBatch(id: string): Promise<boolean> {
    const client = await this.db();
    const res = await client.execute('DELETE FROM batches WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }
}

export const shareToursRepo = new ShareToursRepository();

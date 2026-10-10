// ==============================================================================
// SMART JOURNEY REVIEWS REPOSITORY
// Pure Relational SQL implementation (MySQL / SQLite)
// ==============================================================================

import { DatabaseClient } from '../types';
import { getDB } from '../pool';

export interface ReviewEntity {
  id: string;
  name: string;
  rating: number;
  comment: string;
  text?: string;
  date: string;
  service: string;
  serviceType?: string;
  serviceId?: string;
  serviceName?: string;
  bookingCode?: string;
  country?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export class ReviewsRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async getAll(options: { onlyApproved?: boolean; service?: string; serviceId?: string } | boolean = false): Promise<ReviewEntity[]> {
    const client = await this.db();
    let onlyApproved = false;
    let service: string | undefined;
    let serviceId: string | undefined;

    if (typeof options === 'boolean') {
      onlyApproved = options;
    } else if (options && typeof options === 'object') {
      onlyApproved = Boolean(options.onlyApproved);
      service = options.service;
      serviceId = options.serviceId;
    }

    let sql = 'SELECT * FROM reviews WHERE 1=1';
    const params: any[] = [];
    if (onlyApproved) {
      sql += ' AND status = ?';
      params.push('approved');
    }
    if (service) {
      sql += ' AND service = ?';
      params.push(service);
    }
    if (serviceId) {
      sql += ' AND service_id = ?';
      params.push(serviceId);
    }
    sql += ' ORDER BY created_at DESC';

    const rows = await client.query<{
      id: string;
      name: string;
      rating: number;
      comment: string;
      date: string;
      service: string;
      service_id?: string;
      service_name?: string;
      booking_code?: string;
      country?: string;
      status: string;
      created_at: string;
    }>(sql, params);

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      rating: Number(r.rating) || 5,
      comment: r.comment || '',
      text: r.comment || '',
      date: r.date || '',
      service: r.service || 'tour',
      serviceType: r.service || 'tour',
      serviceId: r.service_id || undefined,
      serviceName: r.service_name || undefined,
      bookingCode: r.booking_code || undefined,
      country: r.country || 'Indonesia',
      status: (r.status || 'pending') as any,
      createdAt: r.created_at || new Date().toISOString()
    }));
  }

  async findByBookingCodeAndServiceId(bookingCode: string, serviceId?: string): Promise<ReviewEntity[]> {
    const client = await this.db();
    let sql = 'SELECT * FROM reviews WHERE LOWER(booking_code) = LOWER(?)';
    const params: any[] = [(bookingCode || '').trim()];
    if (serviceId) {
      sql += ' AND service_id = ?';
      params.push(serviceId);
    }
    const rows = await client.query<any>(sql, params);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      rating: Number(r.rating) || 5,
      comment: r.comment || '',
      text: r.comment || '',
      date: r.date || '',
      service: r.service || 'tour',
      serviceType: r.service || 'tour',
      serviceId: r.service_id || undefined,
      serviceName: r.service_name || undefined,
      bookingCode: r.booking_code || undefined,
      country: r.country || 'Indonesia',
      status: (r.status || 'pending') as any,
      createdAt: r.created_at || new Date().toISOString()
    }));
  }

  async create(review: Partial<ReviewEntity>): Promise<ReviewEntity> {
    const client = await this.db();
    const id = review.id || `rev-${Date.now()}`;
    const now = new Date().toISOString();
    const service = review.service || review.serviceType || 'tour';
    const comment = review.comment || review.text || '';
    const name = review.name || 'Anonymous';
    const rating = Number(review.rating) || 5;
    const date = review.date || now.split('T')[0];
    const status = review.status || 'pending';
    const serviceId = review.serviceId || null;
    const serviceName = review.serviceName || null;
    const bookingCode = review.bookingCode || null;
    const country = review.country || 'Indonesia';

    await client.execute(
      'INSERT INTO reviews (id, name, rating, comment, date, service, service_id, service_name, booking_code, country, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        name,
        rating,
        comment,
        date,
        service,
        serviceId,
        serviceName,
        bookingCode,
        country,
        status,
        now
      ]
    );

    return {
      id,
      name,
      rating,
      comment,
      text: comment,
      date,
      service,
      serviceType: service,
      serviceId: serviceId || undefined,
      serviceName: serviceName || undefined,
      bookingCode: bookingCode || undefined,
      country,
      status: status as any,
      createdAt: now
    };
  }

  async getById(id: string): Promise<ReviewEntity | null> {
    const client = await this.db();
    const rows = await client.query<any>('SELECT * FROM reviews WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      name: r.name,
      rating: Number(r.rating) || 5,
      comment: r.comment || '',
      text: r.comment || '',
      date: r.date || '',
      service: r.service || 'tour',
      serviceType: r.service || 'tour',
      serviceId: r.service_id || undefined,
      serviceName: r.service_name || undefined,
      bookingCode: r.booking_code || undefined,
      country: r.country || 'Indonesia',
      status: (r.status || 'pending') as any,
      createdAt: r.created_at || new Date().toISOString()
    };
  }

  async seedInitialReviews(initialReviews: any[]): Promise<{ seeded: number; skipped: number; total: number }> {
    let seeded = 0;
    let skipped = 0;
    for (const r of initialReviews) {
      if (!r.id) continue;
      const existing = await this.getById(r.id);
      if (!existing) {
        await this.create({
          id: r.id,
          name: r.name,
          rating: Number(r.rating) || 5,
          comment: r.text || r.comment || '',
          text: r.text || r.comment || '',
          date: r.date || new Date().toISOString().split('T')[0],
          service: r.serviceType || r.service || 'tour',
          serviceType: r.serviceType || r.service || 'tour',
          serviceId: r.serviceId,
          serviceName: r.serviceName,
          bookingCode: r.bookingCode,
          country: r.country || 'Indonesia',
          status: (r.status || 'approved') as any
        });
        seeded++;
      } else {
        skipped++;
      }
    }
    return { seeded, skipped, total: initialReviews.length };
  }

  async updateStatus(id: string, status: 'approved' | 'rejected'): Promise<boolean> {
    const client = await this.db();
    const res = await client.execute(
      'UPDATE reviews SET status = ? WHERE id = ?',
      [status, id]
    );
    return res.affectedRows > 0;
  }
}

export const reviewsRepo = new ReviewsRepository();

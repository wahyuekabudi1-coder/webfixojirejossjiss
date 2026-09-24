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
  date: string;
  service: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export class ReviewsRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async getAll(onlyApproved: boolean = false): Promise<ReviewEntity[]> {
    const client = await this.db();
    let sql = 'SELECT * FROM reviews';
    const params: any[] = [];
    if (onlyApproved) {
      sql += ' WHERE status = ?';
      params.push('approved');
    }
    sql += ' ORDER BY created_at DESC';

    const rows = await client.query<{
      id: string;
      name: string;
      rating: number;
      comment: string;
      date: string;
      service: string;
      status: string;
      created_at: string;
    }>(sql, params);

    return rows.map(r => ({
      id: r.id,
      name: r.name,
      rating: Number(r.rating) || 5,
      comment: r.comment || '',
      date: r.date || '',
      service: r.service || 'tour',
      status: (r.status || 'pending') as any,
      createdAt: r.created_at || new Date().toISOString()
    }));
  }

  async create(review: Partial<ReviewEntity>): Promise<ReviewEntity> {
    const client = await this.db();
    const id = review.id || `rev-${Date.now()}`;
    const now = new Date().toISOString();

    await client.execute(
      'INSERT INTO reviews (id, name, rating, comment, date, service, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        review.name || 'Anonymous',
        Number(review.rating) || 5,
        review.comment || '',
        review.date || now.split('T')[0],
        review.service || 'tour',
        review.status || 'pending',
        now
      ]
    );

    return {
      id,
      name: review.name || 'Anonymous',
      rating: Number(review.rating) || 5,
      comment: review.comment || '',
      date: review.date || now.split('T')[0],
      service: review.service || 'tour',
      status: (review.status || 'pending') as any,
      createdAt: now
    };
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

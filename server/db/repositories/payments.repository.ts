// ==============================================================================
// SMART JOURNEY PAYMENTS REPOSITORY
// Pure Relational SQL implementation (MySQL / SQLite)
// ==============================================================================

import { DatabaseClient } from '../types';
import { getDB } from '../pool';

export interface PaymentEntity {
  id: string;
  bookingId: string;
  orderId: string;
  paymentId?: string;
  gateway: string;
  baseAmount: number;
  uniqueCode: number;
  paymentAmount: number;
  paymentMethod?: string;
  paymentStatus: 'Pending' | 'Paid' | 'Expired' | 'Failed';
  rawPayload?: any;
  paidAt?: string;
  createdAt: string;
}

export class PaymentsRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async getAll(): Promise<PaymentEntity[]> {
    const client = await this.db();
    const rows = await client.query<any>('SELECT * FROM payments ORDER BY created_at DESC');
    return rows.map(r => ({
      id: r.id,
      bookingId: r.booking_id,
      orderId: r.order_id,
      paymentId: r.payment_id || undefined,
      gateway: r.gateway || 'artopay',
      baseAmount: Number(r.base_amount) || 0,
      uniqueCode: Number(r.unique_code) || 0,
      paymentAmount: Number(r.payment_amount) || 0,
      paymentMethod: r.payment_method || undefined,
      paymentStatus: r.payment_status || 'Pending',
      rawPayload: r.raw_payload ? JSON.parse(r.raw_payload) : undefined,
      paidAt: r.paid_at || undefined,
      createdAt: r.created_at || new Date().toISOString()
    }));
  }

  async getByOrderId(orderId: string): Promise<PaymentEntity | null> {
    const client = await this.db();
    const rows = await client.query<any>(
      'SELECT * FROM payments WHERE order_id = ? OR payment_id = ? ORDER BY created_at DESC LIMIT 1',
      [orderId, orderId]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      bookingId: r.booking_id,
      orderId: r.order_id,
      paymentId: r.payment_id || undefined,
      gateway: r.gateway || 'artopay',
      baseAmount: Number(r.base_amount) || 0,
      uniqueCode: Number(r.unique_code) || 0,
      paymentAmount: Number(r.payment_amount) || 0,
      paymentMethod: r.payment_method || undefined,
      paymentStatus: r.payment_status || 'Pending',
      rawPayload: r.raw_payload ? JSON.parse(r.raw_payload) : undefined,
      paidAt: r.paid_at || undefined,
      createdAt: r.created_at || new Date().toISOString()
    };
  }

  async create(payment: Partial<PaymentEntity>): Promise<PaymentEntity> {
    const client = await this.db();
    const now = new Date().toISOString();
    const id = payment.id || `pay-${Date.now()}`;

    await client.execute(
      `INSERT INTO payments (
        id, booking_id, order_id, payment_id, gateway,
        base_amount, unique_code, payment_amount, payment_method,
        payment_status, raw_payload, paid_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        payment.bookingId || '',
        payment.orderId || '',
        payment.paymentId || null,
        payment.gateway || 'artopay',
        Number(payment.baseAmount) || 0,
        Number(payment.uniqueCode) || 0,
        Number(payment.paymentAmount) || 0,
        payment.paymentMethod || null,
        payment.paymentStatus || 'Pending',
        payment.rawPayload ? JSON.stringify(payment.rawPayload) : null,
        payment.paidAt || null,
        payment.createdAt || now
      ]
    );

    return {
      id,
      bookingId: payment.bookingId || '',
      orderId: payment.orderId || '',
      paymentId: payment.paymentId,
      gateway: payment.gateway || 'artopay',
      baseAmount: Number(payment.baseAmount) || 0,
      uniqueCode: Number(payment.uniqueCode) || 0,
      paymentAmount: Number(payment.paymentAmount) || 0,
      paymentMethod: payment.paymentMethod,
      paymentStatus: payment.paymentStatus || 'Pending',
      rawPayload: payment.rawPayload,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt || now
    };
  }

  async createPaymentRecord(payment: any): Promise<PaymentEntity> {
    return await this.create({
      id: payment.id,
      bookingId: payment.bookingId,
      orderId: payment.orderId,
      paymentId: payment.paymentId || payment.paymentIntentId,
      gateway: payment.gateway || payment.paymentMethod || 'artopay',
      baseAmount: Number(payment.baseAmount || payment.amount) || 0,
      uniqueCode: Number(payment.uniqueCode) || 0,
      paymentAmount: Number(payment.paymentAmount || payment.amount) || 0,
      paymentMethod: payment.paymentMethod,
      paymentStatus: payment.paymentStatus || 'Pending',
      rawPayload: payment.rawPayload || payment.rawCallbackPayload,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt
    });
  }

  async updateByOrderId(orderId: string, updates: Partial<PaymentEntity> & { rawCallbackPayload?: any }): Promise<boolean> {
    const client = await this.db();
    const existing = await this.getByOrderId(orderId);
    if (!existing) return false;
    const now = new Date().toISOString();
    const newStatus = updates.paymentStatus || existing.paymentStatus;
    const paidAt = updates.paidAt || (newStatus === 'Paid' ? (existing.paidAt || now) : existing.paidAt);
    const rawPayload = updates.rawPayload || updates.rawCallbackPayload || existing.rawPayload;

    const res = await client.execute(
      `UPDATE payments SET
        payment_status = ?,
        paid_at = ?,
        raw_payload = ?
       WHERE id = ?`,
      [newStatus, paidAt || null, rawPayload ? JSON.stringify(rawPayload) : null, existing.id]
    );
    return res.affectedRows > 0;
  }
}

export const paymentsRepo = new PaymentsRepository();

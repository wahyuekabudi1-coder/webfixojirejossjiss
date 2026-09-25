// ==============================================================================
// SMART JOURNEY BOOKINGS & PAYMENTS REPOSITORY
// Pure Relational SQL implementation (MySQL / SQLite) with Strict Status Separation
// ==============================================================================

import { DatabaseClient, BookingRow } from '../types';
import { getDB } from '../pool';

export interface BookingEntity {
  id: string;
  bookingCode: string;
  serviceType: string;
  serviceId?: string;
  serviceName?: string;
  bookingType?: string;
  tourBookingType?: string;
  departureDate?: string;
  fullName: string;
  customerName?: string;
  email: string;
  customerEmail?: string;
  phone: string;
  customerPhone?: string;
  participantsCount: number;
  participantsNames?: string[];
  proofOfPayment?: string;
  status: 'Pending Payment' | 'Pending Confirmation' | 'Confirmed' | 'Completed' | 'Cancelled' | 'Rejected';
  paymentStatus: 'Pending' | 'Paid' | 'Expired' | 'Failed';
  totalPrice: number;
  totalPriceIDR: number;
  baseAmount: number;
  uniqueCode: number;
  paymentAmount: number;
  currency: string;
  createdAt: string;
  details?: any;
  tourSnapshot?: any;
  discount?: any;
  adminNotes?: string;
  paidAt?: string;
  paymentId?: string;
  paymentIntentId?: string;
  checkoutUrl?: string;
  confirmedAt?: string;
  rejectReason?: string;
  verificationHash?: string;
  tripId?: string;
  tripTitle?: string;
  batchId?: string;
  nationalityType?: string;
}

function parseJsonObject<T = any>(val: any, fallback: T = {} as T): T {
  if (val && typeof val === 'object') return val;
  if (!val || typeof val !== 'string') return fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function rowToBooking(row: BookingRow): BookingEntity {
  const parsedDetails = parseJsonObject<any>(row.details, {});
  return {
    id: row.id,
    bookingCode: row.booking_code,
    serviceType: row.service_type,
    serviceId: row.service_id || undefined,
    serviceName: row.service_name || undefined,
    bookingType: row.booking_type || undefined,
    tourBookingType: row.tour_booking_type || undefined,
    departureDate: row.departure_date || undefined,
    fullName: row.full_name,
    customerName: row.customer_name || row.full_name,
    email: row.email,
    customerEmail: row.customer_email || row.email,
    phone: row.phone,
    customerPhone: row.customer_phone || row.phone,
    participantsCount: Number(row.participants_count) || 1,
    participantsNames: parseJsonObject<string[]>(row.participants_names, []),
    proofOfPayment: row.proof_of_payment || undefined,
    status: (row.status === 'Pending' ? 'Pending Payment' : (row.status || 'Pending Payment')) as any,
    paymentStatus: (row.payment_status === 'Pending Payment' || row.payment_status === 'Unpaid' ? 'Pending' : (row.payment_status || 'Pending')) as any,
    totalPrice: Number(row.total_price) || 0,
    totalPriceIDR: Number(row.total_price_idr) || 0,
    baseAmount: Number(row.base_amount) || 0,
    uniqueCode: Number(row.unique_code) || 0,
    paymentAmount: Number(row.payment_amount) || 0,
    currency: row.currency || 'IDR',
    createdAt: row.created_at || new Date().toISOString(),
    details: parsedDetails,
    tourSnapshot: parseJsonObject<any>(row.tour_snapshot, {}),
    discount: parseJsonObject<any>(row.discount, {}),
    adminNotes: row.admin_notes || undefined,
    paidAt: row.paid_at || undefined,
    paymentId: row.payment_id || undefined,
    paymentIntentId: row.payment_intent_id || undefined,
    checkoutUrl: row.checkout_url || undefined,
    confirmedAt: row.confirmed_at || undefined,
    rejectReason: row.reject_reason || undefined,
    verificationHash: row.verification_hash || undefined,
    tripId: parsedDetails.tripId || row.service_id || undefined,
    tripTitle: parsedDetails.tripTitle || row.service_name || undefined,
    batchId: parsedDetails.batchId || undefined,
    nationalityType: parsedDetails.nationalityType || row.tour_booking_type || undefined
  };
}

export class BookingsRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async getAll(): Promise<BookingEntity[]> {
    const client = await this.db();
    const rows = await client.query<BookingRow>('SELECT * FROM bookings ORDER BY created_at DESC');
    return rows.map(rowToBooking);
  }

  async getById(id: string): Promise<BookingEntity | null> {
    const client = await this.db();
    const rows = await client.query<BookingRow>('SELECT * FROM bookings WHERE id = ? LIMIT 1', [id]);
    if (!rows || rows.length === 0) return null;
    return rowToBooking(rows[0]);
  }

  async getByCode(code: string): Promise<BookingEntity | null> {
    const client = await this.db();
    const rows = await client.query<BookingRow>(
      'SELECT * FROM bookings WHERE booking_code = ? OR id = ? LIMIT 1',
      [code, code]
    );
    if (!rows || rows.length === 0) return null;
    return rowToBooking(rows[0]);
  }

  async create(booking: Partial<BookingEntity>): Promise<BookingEntity> {
    const client = await this.db();
    const now = new Date().toISOString();
    const id = booking.id && booking.id.trim() !== '' ? booking.id.trim() : `bk-${Date.now()}`;
    const code = booking.bookingCode && booking.bookingCode.trim() !== ''
      ? booking.bookingCode.trim()
      : `SJ-${Date.now().toString().slice(-6)}`;

    const sql = `
      INSERT INTO bookings (
        id, booking_code, service_type, service_id, service_name,
        booking_type, tour_booking_type, departure_date, full_name, customer_name,
        email, customer_email, phone, customer_phone, participants_count,
        participants_names, proof_of_payment, status, payment_status,
        total_price, total_price_idr, base_amount, unique_code, payment_amount,
        currency, created_at, details, tour_snapshot, discount, admin_notes,
        paid_at, payment_id, payment_intent_id, checkout_url, confirmed_at, reject_reason, verification_hash
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      )
    `;

    const params = [
      id,
      code,
      booking.serviceType || 'tour',
      booking.serviceId || null,
      booking.serviceName || null,
      booking.bookingType || null,
      booking.tourBookingType || null,
      booking.departureDate || null,
      booking.fullName || booking.customerName || 'Customer',
      booking.customerName || booking.fullName || 'Customer',
      booking.email || booking.customerEmail || '',
      booking.customerEmail || booking.email || '',
      booking.phone || booking.customerPhone || '',
      booking.customerPhone || booking.phone || '',
      Number(booking.participantsCount) || 1,
      JSON.stringify(booking.participantsNames || []),
      booking.proofOfPayment || null,
      booking.status || 'Pending Payment',
      booking.paymentStatus || 'Pending',
      Number(booking.totalPrice) || 0,
      Number(booking.totalPriceIDR || booking.totalPrice) || 0,
      Number(booking.baseAmount || booking.totalPrice) || 0,
      Number(booking.uniqueCode) || 0,
      Number(booking.paymentAmount || booking.totalPrice) || 0,
      booking.currency || 'IDR',
      booking.createdAt || now,
      JSON.stringify(booking.details || {}),
      JSON.stringify(booking.tourSnapshot || {}),
      JSON.stringify(booking.discount || {}),
      booking.adminNotes || null,
      booking.paidAt || null,
      booking.paymentId || null,
      booking.paymentIntentId || null,
      booking.checkoutUrl || null,
      booking.confirmedAt || null,
      booking.rejectReason || null,
      booking.verificationHash || null
    ];

    await client.execute(sql, params);
    const created = await this.getById(id);
    if (!created) throw new Error(`Failed to retrieve newly created booking ${id}`);
    return created;
  }

  async update(id: string, updates: Partial<BookingEntity>): Promise<BookingEntity | null> {
    const client = await this.db();
    const existing = await this.getById(id);
    if (!existing) return null;

    const sql = `
      UPDATE bookings SET
        service_type = ?,
        service_id = ?,
        service_name = ?,
        departure_date = ?,
        full_name = ?,
        customer_name = ?,
        email = ?,
        customer_email = ?,
        phone = ?,
        customer_phone = ?,
        participants_count = ?,
        participants_names = ?,
        proof_of_payment = ?,
        status = ?,
        payment_status = ?,
        total_price = ?,
        total_price_idr = ?,
        base_amount = ?,
        unique_code = ?,
        payment_amount = ?,
        details = ?,
        tour_snapshot = ?,
        admin_notes = ?,
        paid_at = ?,
        payment_id = ?,
        payment_intent_id = ?,
        checkout_url = ?,
        confirmed_at = ?,
        reject_reason = ?,
        verification_hash = ?
      WHERE id = ?
    `;

    const params = [
      updates.serviceType !== undefined ? updates.serviceType : existing.serviceType,
      updates.serviceId !== undefined ? updates.serviceId : existing.serviceId || null,
      updates.serviceName !== undefined ? updates.serviceName : existing.serviceName || null,
      updates.departureDate !== undefined ? updates.departureDate : existing.departureDate || null,
      updates.fullName !== undefined ? updates.fullName : existing.fullName,
      updates.customerName !== undefined ? updates.customerName : existing.customerName || null,
      updates.email !== undefined ? updates.email : existing.email,
      updates.customerEmail !== undefined ? updates.customerEmail : existing.customerEmail || null,
      updates.phone !== undefined ? updates.phone : existing.phone,
      updates.customerPhone !== undefined ? updates.customerPhone : existing.customerPhone || null,
      updates.participantsCount !== undefined ? Number(updates.participantsCount) : existing.participantsCount,
      JSON.stringify(updates.participantsNames !== undefined ? updates.participantsNames : existing.participantsNames || []),
      updates.proofOfPayment !== undefined ? updates.proofOfPayment : existing.proofOfPayment || null,
      updates.status !== undefined ? updates.status : existing.status,
      updates.paymentStatus !== undefined ? updates.paymentStatus : existing.paymentStatus,
      updates.totalPrice !== undefined ? Number(updates.totalPrice) : existing.totalPrice,
      updates.totalPriceIDR !== undefined ? Number(updates.totalPriceIDR) : existing.totalPriceIDR,
      updates.baseAmount !== undefined ? Number(updates.baseAmount) : existing.baseAmount,
      updates.uniqueCode !== undefined ? Number(updates.uniqueCode) : existing.uniqueCode,
      updates.paymentAmount !== undefined ? Number(updates.paymentAmount) : existing.paymentAmount,
      JSON.stringify(updates.details !== undefined ? updates.details : existing.details || {}),
      JSON.stringify(updates.tourSnapshot !== undefined ? updates.tourSnapshot : existing.tourSnapshot || {}),
      updates.adminNotes !== undefined ? updates.adminNotes : existing.adminNotes || null,
      updates.paidAt !== undefined ? updates.paidAt : existing.paidAt || null,
      updates.paymentId !== undefined ? updates.paymentId : existing.paymentId || null,
      updates.paymentIntentId !== undefined ? updates.paymentIntentId : existing.paymentIntentId || null,
      updates.checkoutUrl !== undefined ? updates.checkoutUrl : existing.checkoutUrl || null,
      updates.confirmedAt !== undefined ? updates.confirmedAt : existing.confirmedAt || null,
      updates.rejectReason !== undefined ? updates.rejectReason : existing.rejectReason || null,
      updates.verificationHash !== undefined ? updates.verificationHash : existing.verificationHash || null,
      id
    ];

    await client.execute(sql, params);
    return await this.getById(id);
  }

  async getByPaymentIntentId(intentId: string): Promise<BookingEntity | null> {
    const client = await this.db();
    const rows = await client.query<BookingRow>(
      'SELECT * FROM bookings WHERE payment_intent_id = ? OR payment_id = ? LIMIT 1',
      [intentId, intentId]
    );
    if (!rows || rows.length === 0) return null;
    return rowToBooking(rows[0]);
  }

  async updatePaymentIntent(idOrCode: string, paymentIntentId: string, checkoutUrl?: string): Promise<BookingEntity | null> {
    const client = await this.db();
    const existing = await this.getByCode(idOrCode);
    if (!existing) return null;

    await client.execute(
      'UPDATE bookings SET payment_intent_id = ?, checkout_url = ?, payment_status = ?, status = ? WHERE id = ?',
      [paymentIntentId, checkoutUrl || null, 'Pending', 'Pending Payment', existing.id]
    );
    return await this.getById(existing.id);
  }

  async markPaidByWebhook(orderIdOrCode: string, paymentId?: string): Promise<BookingEntity | null> {
    const client = await this.db();
    const booking = await this.getByCode(orderIdOrCode);
    if (!booking) return null;

    const now = new Date().toISOString();
    // CRITICAL BUSINESS RULE: Payment status becomes 'Paid', booking status becomes 'Pending Confirmation' (NEVER auto-confirmed)
    await client.execute(
      `UPDATE bookings SET 
        payment_status = 'Paid',
        status = 'Pending Confirmation',
        paid_at = ?,
        payment_id = ?
      WHERE id = ?`,
      [now, paymentId || booking.paymentId || null, booking.id]
    );

    return await this.getById(booking.id);
  }

  async confirmByAdmin(id: string): Promise<BookingEntity | null> {
    const client = await this.db();
    await client.execute(
      "UPDATE bookings SET status = 'Confirmed' WHERE id = ?",
      [id]
    );
    return await this.getById(id);
  }

  async getActivePendingUniqueCodes(): Promise<Set<number>> {
    const client = await this.db();
    const rows = await client.query<{ unique_code: number }>(
      `SELECT unique_code FROM bookings 
       WHERE (LOWER(payment_status) = 'pending' OR LOWER(payment_status) = 'pending payment' OR LOWER(payment_status) = 'unpaid')
       AND LOWER(status) NOT IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired')
       AND unique_code > 0`
    );
    const set = new Set<number>();
    for (const r of rows) {
      if (r.unique_code > 0) set.add(Number(r.unique_code));
    }
    return set;
  }

  async delete(id: string): Promise<boolean> {
    const client = await this.db();
    const res = await client.execute('DELETE FROM bookings WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  async clearAll(): Promise<void> {
    const client = await this.db();
    await client.execute('DELETE FROM bookings');
  }
}

export const bookingsRepo = new BookingsRepository();

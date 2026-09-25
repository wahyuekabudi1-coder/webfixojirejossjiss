// ==============================================================================
// SMART JOURNEY INVOICES REPOSITORY
// Pure Relational SQL implementation (MySQL / SQLite)
// ==============================================================================

import { DatabaseClient } from '../types';
import { getDB } from '../pool';

export interface InvoiceEntity {
  id: string;
  bookingId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  customerName?: string;
  customerEmail?: string;
  serviceSummary?: string;
  createdAt: string;
}

export class InvoicesRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async getAll(): Promise<InvoiceEntity[]> {
    const client = await this.db();
    const rows = await client.query<any>('SELECT * FROM invoices ORDER BY created_at DESC');
    return rows.map(r => ({
      id: r.id,
      bookingId: r.booking_id,
      invoiceNumber: r.invoice_number,
      amount: Number(r.amount) || 0,
      currency: r.currency || 'IDR',
      status: r.status || 'UNPAID',
      customerName: r.customer_name || undefined,
      customerEmail: r.customer_email || undefined,
      serviceSummary: r.service_summary || undefined,
      createdAt: r.created_at || new Date().toISOString()
    }));
  }

  async getByInvoiceNumber(num: string): Promise<InvoiceEntity | null> {
    const client = await this.db();
    const rows = await client.query<any>(
      'SELECT * FROM invoices WHERE invoice_number = ? OR booking_id = ? LIMIT 1',
      [num, num]
    );
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      bookingId: r.booking_id,
      invoiceNumber: r.invoice_number,
      amount: Number(r.amount) || 0,
      currency: r.currency || 'IDR',
      status: r.status || 'UNPAID',
      customerName: r.customer_name || undefined,
      customerEmail: r.customer_email || undefined,
      serviceSummary: r.service_summary || undefined,
      createdAt: r.created_at || new Date().toISOString()
    };
  }

  async create(invoice: Partial<InvoiceEntity>): Promise<InvoiceEntity> {
    const client = await this.db();
    const now = new Date().toISOString();
    const id = invoice.id || `inv-${Date.now()}`;
    const invoiceNumber = invoice.invoiceNumber || `INV-${Date.now()}`;

    await client.execute(
      `INSERT INTO invoices (
        id, booking_id, invoice_number, amount, currency,
        status, customer_name, customer_email, service_summary, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        invoice.bookingId || '',
        invoiceNumber,
        Number(invoice.amount) || 0,
        invoice.currency || 'IDR',
        invoice.status || 'UNPAID',
        invoice.customerName || null,
        invoice.customerEmail || null,
        invoice.serviceSummary || null,
        invoice.createdAt || now
      ]
    );

    return {
      id,
      bookingId: invoice.bookingId || '',
      invoiceNumber,
      amount: Number(invoice.amount) || 0,
      currency: invoice.currency || 'IDR',
      status: invoice.status || 'UNPAID',
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      serviceSummary: invoice.serviceSummary,
      createdAt: invoice.createdAt || now
    };
  }

  async createInvoice(invoice: Partial<InvoiceEntity>): Promise<InvoiceEntity> {
    return await this.create(invoice);
  }

  async updateStatus(invoiceNumber: string, status: string): Promise<boolean> {
    const client = await this.db();
    const res = await client.execute(
      'UPDATE invoices SET status = ? WHERE invoice_number = ? OR booking_id = ?',
      [status, invoiceNumber, invoiceNumber]
    );
    return res.affectedRows > 0;
  }
}

export const invoicesRepo = new InvoicesRepository();

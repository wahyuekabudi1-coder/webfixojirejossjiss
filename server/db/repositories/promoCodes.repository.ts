// ==============================================================================
// SMART JOURNEY PROMO CODES REPOSITORY (MEDIUM-02A BACKEND FOUNDATION)
// Relational SQL implementation (MySQL 8 / SQLite 3) for Promo Codes & Vouchers
// ==============================================================================

import { getDB } from '../pool';
import { PromoCodeRow, PromoCodeEntity, DatabaseClient } from '../types';

export function normalizePromoCode(code: string): string {
  if (!code || typeof code !== 'string') return '';
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

export function isPromoExpired(validUntil: string): boolean {
  if (!validUntil) return true;
  const trimmed = validUntil.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    // Valid through the entire day until 23:59:59.999
    const endOfDay = new Date(`${trimmed}T23:59:59.999`);
    if (!isNaN(endOfDay.getTime())) {
      return Date.now() > endOfDay.getTime();
    }
  }
  const dateObj = new Date(trimmed);
  if (isNaN(dateObj.getTime())) return false;
  return Date.now() > dateObj.getTime();
}

export interface PromoValidationResult {
  valid: boolean;
  code?: string;
  discount: number;
  reason?: string;
  message: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  maxDiscount?: number | null;
  minSpendIDR?: number;
  description?: string;
}

export const INITIAL_CANONICAL_PROMOS: Array<Omit<PromoCodeEntity, 'createdAt' | 'updatedAt'>> = [
  {
    id: 'p1',
    code: 'SMARTBALI10',
    discountType: 'percentage',
    discountValue: 10,
    minSpendIDR: 500000,
    maxDiscount: 200000,
    validUntil: '2026-12-31',
    isActive: true,
    usageCount: 0,
    maxUsage: 100,
    description: 'Diskon 10% paket wisata Bali & Jawa Timur min. belanja Rp 500rb'
  },
  {
    id: 'p2',
    code: 'EARLYBIRD',
    discountType: 'percentage',
    discountValue: 15,
    minSpendIDR: 1000000,
    maxDiscount: 500000,
    validUntil: '2026-08-31',
    isActive: true,
    usageCount: 0,
    maxUsage: 50,
    description: 'Diskon pemesanan awal (Early Bird) min. belanja Rp 1 Jt'
  },
  {
    id: 'p3',
    code: 'WELCOME2026',
    discountType: 'fixed',
    discountValue: 50000,
    minSpendIDR: 300000,
    maxDiscount: null,
    validUntil: '2026-12-31',
    isActive: true,
    usageCount: 0,
    maxUsage: 200,
    description: 'Voucher potongan Rp 50.000 untuk pengguna baru'
  }
];

function fromRow(row: PromoCodeRow): PromoCodeEntity {
  return {
    id: row.id,
    code: row.code,
    discountType: (row.discount_type === 'percentage' || row.discount_type === 'Percentage') ? 'percentage' : 'fixed',
    discountValue: Number(row.discount_value) || 0,
    minSpendIDR: Number(row.min_spend_idr) || 0,
    maxDiscount: row.max_discount != null ? Number(row.max_discount) : null,
    validUntil: row.valid_until,
    maxUsage: row.max_usage != null ? Number(row.max_usage) : null,
    usageCount: Number(row.usage_count) || 0,
    isActive: Boolean(row.is_active === 1 || (row.is_active as any) === true || (row.is_active as any) === '1'),
    description: row.description || '',
    createdAt: row.created_at || undefined,
    updatedAt: row.updated_at || undefined
  };
}

export class PromoCodesRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  /**
   * Fetch all promo codes with optional active status filter
   */
  async getAll(options?: { activeOnly?: boolean }): Promise<PromoCodeEntity[]> {
    const client = await this.db();
    let sql = 'SELECT * FROM promo_codes';
    const params: any[] = [];

    if (options?.activeOnly) {
      sql += ' WHERE is_active = 1';
    }

    sql += ' ORDER BY created_at DESC';

    const rows = await client.query<PromoCodeRow>(sql, params);
    return rows.map(fromRow);
  }

  /**
   * Find a promo code by its unique ID
   */
  async getById(id: string): Promise<PromoCodeEntity | null> {
    if (!id) return null;
    const client = await this.db();
    const rows = await client.query<PromoCodeRow>(
      'SELECT * FROM promo_codes WHERE id = ? LIMIT 1',
      [id.trim()]
    );
    if (!rows || rows.length === 0) return null;
    return fromRow(rows[0]);
  }

  /**
   * Find a promo code by code string (case-insensitive & normalized)
   */
  async getByCode(code: string): Promise<PromoCodeEntity | null> {
    const normalized = normalizePromoCode(code);
    if (!normalized) return null;
    const client = await this.db();
    const rows = await client.query<PromoCodeRow>(
      'SELECT * FROM promo_codes WHERE UPPER(code) = ? LIMIT 1',
      [normalized]
    );
    if (!rows || rows.length === 0) return null;
    return fromRow(rows[0]);
  }

  /**
   * Create a new promo code
   */
  async create(data: Partial<PromoCodeEntity>): Promise<PromoCodeEntity> {
    const client = await this.db();
    const normalizedCode = normalizePromoCode(data.code || '');

    if (!normalizedCode || normalizedCode.length < 3) {
      throw new Error('Kode promo minimal 3 karakter alfanumerik.');
    }

    const existing = await this.getByCode(normalizedCode);
    if (existing) {
      throw new Error(`Kode promo "${normalizedCode}" sudah terdaftar.`);
    }

    const id = data.id || `promo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const discountType = data.discountType === 'percentage' ? 'percentage' : 'fixed';
    const discountValue = Number(data.discountValue) || 0;
    const minSpendIDR = Number(data.minSpendIDR) || 0;
    const maxDiscount = data.maxDiscount != null ? Number(data.maxDiscount) : null;
    const validUntil = data.validUntil || '2026-12-31';
    const maxUsage = data.maxUsage != null ? Number(data.maxUsage) : null;
    const usageCount = Number(data.usageCount) || 0;
    const isActive = data.isActive === false ? 0 : 1;
    const description = data.description || '';
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO promo_codes (
        id, code, discount_type, discount_value, min_spend_idr,
        max_discount, valid_until, max_usage, usage_count, is_active,
        description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await client.execute(sql, [
      id,
      normalizedCode,
      discountType,
      discountValue,
      minSpendIDR,
      maxDiscount,
      validUntil,
      maxUsage,
      usageCount,
      isActive,
      description,
      data.createdAt || now,
      data.updatedAt || now
    ]);

    const created = await this.getById(id);
    if (!created) {
      throw new Error('Gagal mengambil data promo code setelah pembuatan.');
    }
    return created;
  }

  /**
   * Update an existing promo code by code or id
   */
  async update(codeOrId: string, data: Partial<PromoCodeEntity>): Promise<PromoCodeEntity | null> {
    const client = await this.db();
    let existing = await this.getById(codeOrId);
    if (!existing) {
      existing = await this.getByCode(codeOrId);
    }
    if (!existing) return null;

    let targetCode = existing.code;
    if (data.code) {
      const normalizedNewCode = normalizePromoCode(data.code);
      if (normalizedNewCode !== existing.code) {
        const codeConflict = await this.getByCode(normalizedNewCode);
        if (codeConflict && codeConflict.id !== existing.id) {
          throw new Error(`Kode promo "${normalizedNewCode}" sudah digunakan.`);
        }
        targetCode = normalizedNewCode;
      }
    }

    const discountType = data.discountType !== undefined ? data.discountType : existing.discountType;
    const discountValue = data.discountValue !== undefined ? Number(data.discountValue) : existing.discountValue;
    const minSpendIDR = data.minSpendIDR !== undefined ? Number(data.minSpendIDR) : existing.minSpendIDR;
    const maxDiscount = data.maxDiscount !== undefined ? (data.maxDiscount != null ? Number(data.maxDiscount) : null) : existing.maxDiscount;
    const validUntil = data.validUntil !== undefined ? data.validUntil : existing.validUntil;
    const maxUsage = data.maxUsage !== undefined ? (data.maxUsage != null ? Number(data.maxUsage) : null) : existing.maxUsage;
    const usageCount = data.usageCount !== undefined ? Number(data.usageCount) : existing.usageCount;
    const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : (existing.isActive ? 1 : 0);
    const description = data.description !== undefined ? data.description : existing.description;
    const updatedAt = new Date().toISOString();

    const sql = `
      UPDATE promo_codes SET
        code = ?,
        discount_type = ?,
        discount_value = ?,
        min_spend_idr = ?,
        max_discount = ?,
        valid_until = ?,
        max_usage = ?,
        usage_count = ?,
        is_active = ?,
        description = ?,
        updated_at = ?
      WHERE id = ?
    `;

    await client.execute(sql, [
      targetCode,
      discountType,
      discountValue,
      minSpendIDR,
      maxDiscount,
      validUntil,
      maxUsage,
      usageCount,
      isActive,
      description,
      updatedAt,
      existing.id
    ]);

    return this.getById(existing.id);
  }

  /**
   * Delete a promo code by code or id
   */
  async delete(codeOrId: string): Promise<boolean> {
    const client = await this.db();
    let existing = await this.getById(codeOrId);
    if (!existing) {
      existing = await this.getByCode(codeOrId);
    }
    if (!existing) return false;

    await client.execute('DELETE FROM promo_codes WHERE id = ?', [existing.id]);
    return true;
  }

  /**
   * Validate promo code against current transaction amount
   * Performs server-authoritative checks:
   * 1. Existence & Normalization
   * 2. Active status (isActive)
   * 3. Expiration date (validUntil)
   * 4. Maximum usage limit (maxUsage)
   * 5. Minimum spend requirement (minSpendIDR)
   * 6. Accurate safe discount calculation (bounded to baseAmount, >= 0, percentage bounded)
   * NOTE: Does NOT increment usage_count at this stage (per requirement).
   */
  async validatePromo(rawCode: string, amount: number): Promise<PromoValidationResult> {
    const normalized = normalizePromoCode(rawCode);
    const baseAmount = Number(amount) || 0;

    if (!normalized) {
      return {
        valid: false,
        discount: 0,
        reason: 'CODE_EMPTY',
        message: 'Harap masukkan kode promo.'
      };
    }

    if (baseAmount <= 0) {
      return {
        valid: false,
        code: normalized,
        discount: 0,
        reason: 'INVALID_AMOUNT',
        message: 'Nominal transaksi tidak valid untuk penerapan promo.'
      };
    }

    const promo = await this.getByCode(normalized);
    if (!promo) {
      return {
        valid: false,
        code: normalized,
        discount: 0,
        reason: 'CODE_NOT_FOUND',
        message: `Kode promo "${normalized}" tidak ditemukan.`
      };
    }

    // 1. Validasi Status Aktif
    if (!promo.isActive) {
      return {
        valid: false,
        code: promo.code,
        discount: 0,
        reason: 'CODE_INACTIVE',
        message: `Voucher "${promo.code}" sedang tidak aktif atau dinonaktifkan oleh administrator.`
      };
    }

    // 2. Validasi Tanggal Kedaluwarsa
    if (isPromoExpired(promo.validUntil)) {
      return {
        valid: false,
        code: promo.code,
        discount: 0,
        reason: 'CODE_EXPIRED',
        message: `Voucher "${promo.code}" telah kedaluwarsa pada ${promo.validUntil}.`
      };
    }

    // 3. Validasi Max Usage
    if (promo.maxUsage != null && promo.maxUsage > 0 && promo.usageCount >= promo.maxUsage) {
      return {
        valid: false,
        code: promo.code,
        discount: 0,
        reason: 'MAX_USAGE_EXCEEDED',
        message: `Batas kuota penggunaan voucher "${promo.code}" (${promo.maxUsage}x) telah habis.`
      };
    }

    // 4. Validasi Minimum Spend
    if (promo.minSpendIDR > 0 && baseAmount < promo.minSpendIDR) {
      return {
        valid: false,
        code: promo.code,
        discount: 0,
        reason: 'MIN_SPEND_NOT_MET',
        message: `Minimal transaksi untuk voucher ini adalah Rp ${promo.minSpendIDR.toLocaleString('id-ID')} (transaksi Anda: Rp ${baseAmount.toLocaleString('id-ID')}).`
      };
    }

    // 5. Hitung Discount Secara Aman
    let calculatedDiscount = 0;
    if (promo.discountType === 'percentage') {
      const pct = Math.max(0, Math.min(100, promo.discountValue));
      calculatedDiscount = Math.round((baseAmount * pct) / 100);
      if (promo.maxDiscount != null && promo.maxDiscount > 0 && calculatedDiscount > promo.maxDiscount) {
        calculatedDiscount = Math.round(promo.maxDiscount);
      }
    } else {
      // Fixed discount
      calculatedDiscount = Math.round(Math.max(0, promo.discountValue));
    }

    // Guardrail: Discount tidak boleh melebihi baseAmount
    if (calculatedDiscount > baseAmount) {
      calculatedDiscount = baseAmount;
    }

    // Guardrail: Discount tidak boleh negatif
    if (calculatedDiscount < 0) {
      calculatedDiscount = 0;
    }

    return {
      valid: true,
      code: promo.code,
      discount: calculatedDiscount,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      maxDiscount: promo.maxDiscount,
      minSpendIDR: promo.minSpendIDR,
      description: promo.description || '',
      message: `Kode promo "${promo.code}" berhasil diterapkan. Hemat Rp ${calculatedDiscount.toLocaleString('id-ID')}!`
    };
  }

  /**
   * Atomically validate and reserve (increment usage_count) for a promo code.
   * Atomic SQL prevents concurrent bookings from exceeding maxUsage:
   * UPDATE promo_codes SET usage_count = usage_count + 1 WHERE id = ? AND is_active = 1 AND (max_usage IS NULL OR max_usage <= 0 OR usage_count < max_usage)
   */
  async reservePromoUsage(rawCode: string, amount: number): Promise<{
    valid: boolean;
    promo?: PromoCodeEntity;
    discount: number;
    reason?: string;
    message: string;
  }> {
    const validation = await this.validatePromo(rawCode, amount);
    if (!validation.valid || !validation.code) {
      return {
        valid: false,
        discount: 0,
        reason: validation.reason,
        message: validation.message
      };
    }

    const promo = await this.getByCode(validation.code);
    if (!promo) {
      return {
        valid: false,
        discount: 0,
        reason: 'CODE_NOT_FOUND',
        message: `Kode promo "${validation.code}" tidak ditemukan.`
      };
    }

    const client = await this.db();
    const now = new Date().toISOString();
    const updateRes = await client.execute(
      `UPDATE promo_codes 
       SET usage_count = usage_count + 1, updated_at = ? 
       WHERE id = ? AND is_active = 1 AND (max_usage IS NULL OR max_usage <= 0 OR usage_count < max_usage)`,
      [now, promo.id]
    );

    if (updateRes.affectedRows === 0) {
      return {
        valid: false,
        discount: 0,
        reason: 'MAX_USAGE_EXCEEDED',
        message: `Batas kuota penggunaan voucher "${promo.code}" (${promo.maxUsage}x) telah habis.`
      };
    }

    const updated = await this.getById(promo.id);
    return {
      valid: true,
      promo: updated || promo,
      discount: validation.discount,
      message: validation.message
    };
  }

  /**
   * Atomically rollback/decrement usage_count if transaction fails before completion.
   */
  async decrementUsage(idOrCode: string): Promise<void> {
    const client = await this.db();
    const now = new Date().toISOString();
    await client.execute(
      `UPDATE promo_codes 
       SET usage_count = CASE WHEN usage_count > 0 THEN usage_count - 1 ELSE 0 END, 
           updated_at = ? 
       WHERE id = ? OR code = ?`,
      [now, idOrCode, idOrCode]
    );
  }

  /**
   * Idempotent Seeding of Canonical Promos on Server Startup
   */
  async seedInitialPromos(): Promise<number> {
    let seededCount = 0;
    for (const promoData of INITIAL_CANONICAL_PROMOS) {
      const existing = await this.getByCode(promoData.code);
      if (!existing) {
        await this.create({
          ...promoData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        seededCount++;
      }
    }
    return seededCount;
  }
}

export const promoCodesRepo = new PromoCodesRepository();

/**
 * Smart Journey Unified Pricing & Currency Engine
 * Single Source of Truth for all Tour, Share Tour, and Booking Price Calculations.
 * 
 * Rules:
 * 1. NO hardcoded hacks (e.g. if total == 338 then 6000000).
 * 2. Formatting functions (formatPrice) must NEVER be used for calculations.
 * 3. Consistent pricing across Tour Detail -> Booking Form -> Checkout -> OJIRE Payment Gateway.
 * 4. OJIRE Payment Gateway settles in IDR (Indonesian Rupiah).
 */

export const EXCHANGE_RATE_USD_TO_IDR = 16000;
export const EXCHANGE_RATE_USD_TO_CNY = 7.2;

/**
 * Flag kontrol tombol mata uang asing (USD / Dolar & CNY / Yuan).
 * Diaktifkan kembali: Semua mata uang (IDR, USD, CNY) aktif dengan default IDR (Rp).
 */
export const ENABLE_FOREIGN_CURRENCIES = true;

export interface TourPricingResult {
  unitPriceUSD: number;
  unitPriceIDR: number;
  pax: number;
  surchargeMultiplier: number;
  totalPriceUSD: number;
  totalPriceIDR: number;
  paymentAmountIDR: number; // The exact whole-Rupiah amount to be charged by OJIRE Payment Gateway
}

/**
 * Converts USD amount to whole IDR (Rupiah).
 */
export function usdToIDR(usd: number): number {
  if (!usd || isNaN(usd)) return 0;
  return Math.round(usd * EXCHANGE_RATE_USD_TO_IDR);
}

/**
 * Converts IDR amount to USD.
 */
export function idrToUSD(idr: number): number {
  if (!idr || isNaN(idr)) return 0;
  return Math.round(idr / EXCHANGE_RATE_USD_TO_IDR);
}

/**
 * Converts USD amount to CNY.
 */
export function usdToCNY(usd: number): number {
  if (!usd || isNaN(usd)) return 0;
  return Number((usd * EXCHANGE_RATE_USD_TO_CNY).toFixed(1));
}

/**
 * Canonical Pricing Calculator for Private Tours.
 * 
 * - WNI (Wisatawan Domestik): Base is tour.startingPriceIDR (or tour.wniPrice) in IDR.
 * - WNA (Wisatawan Mancanegara): Authoritative base is tour.wnaPriceIDR in IDR.
 *   Do NOT calculate from WNI price, do NOT apply 1.25x rule, do NOT guess.
 *   USD is strictly a read-only display conversion (IDR / 16,000).
 */
export function calculatePrivateTourPricing(
  tour: {
    startingPrice?: number;
    startingPriceIDR?: number;
    wnaPrice?: number;
    wniPrice?: number;
    wnaPriceIDR?: number;
  },
  nationalityType: 'WNI' | 'WNA' | 'WNA_CHINA' | 'WNA_EUROPE' = 'WNI',
  pax: number = 1,
  surchargeMultiplier: number = 1.0
): TourPricingResult {
  const isWNI = nationalityType === 'WNI';
  const safePax = Math.max(1, Number(pax) || 1);
  const mult = Math.max(1.0, Number(surchargeMultiplier) || 1.0);

  const baseStartingPriceIDR = Number(tour?.startingPriceIDR || tour?.wniPrice) || 0;

  let unitPriceUSD = 0;
  let unitPriceIDR = 0;

  if (isWNI) {
    unitPriceIDR = baseStartingPriceIDR;
    unitPriceUSD = unitPriceIDR > 0 ? Math.round(unitPriceIDR / EXCHANGE_RATE_USD_TO_IDR) : 0;
  } else {
    // Authoritative WNA IDR: Must use wnaPriceIDR directly
    const authWnaPriceIDR = Number(tour?.wnaPriceIDR || 0);
    if (authWnaPriceIDR > 0) {
      unitPriceIDR = authWnaPriceIDR;
      unitPriceUSD = Math.round(unitPriceIDR / EXCHANGE_RATE_USD_TO_IDR);
    } else {
      // Legacy tour without authoritative WNA IDR: 0 (reports missing to prevent guessing)
      unitPriceIDR = 0;
      unitPriceUSD = 0;
    }
  }

  const subtotalUSD = unitPriceUSD * safePax;
  const subtotalIDR = unitPriceIDR * safePax;

  const totalPriceUSD = Math.round(subtotalUSD * mult);
  const totalPriceIDR = Math.round(subtotalIDR * mult);

  return {
    unitPriceUSD,
    unitPriceIDR,
    pax: safePax,
    surchargeMultiplier: mult,
    totalPriceUSD,
    totalPriceIDR,
    paymentAmountIDR: totalPriceIDR
  };
}

/**
 * Canonical Pricing Calculator for Share Tours / Open Trips.
 * 
 * - WNI (Wisatawan Domestik): Base is batch.price (or trip.startingPriceIDR / trip.wniPrice) in IDR.
 * - WNA (Wisatawan Mancanegara): Authoritative base is batch.wnaPriceIDR (or trip.wnaPriceIDR) in IDR if set;
 *   otherwise falls back to authoritative batch.price / trip IDR.
 *   Do NOT apply 1.25x rule, do NOT guess price from USD.
 *   USD is strictly a read-only display conversion (IDR / 16,000).
 */
export function calculateShareTourPricing(
  trip: {
    startingPrice?: number;
    wnaStartingPrice?: number;
    price?: number;
    wnaPrice?: number;
    wniPrice?: number;
    startingPriceIDR?: number;
    wnaPriceIDR?: number;
  },
  batch: {
    price?: number;
    wnaPrice?: number;
    wnaPriceIDR?: number;
  } | null | undefined,
  nationalityType: 'WNI' | 'WNA' | 'WNA_CHINA' | 'WNA_EUROPE' = 'WNI',
  pax: number = 1
): TourPricingResult {
  const isWNI = nationalityType === 'WNI';
  const safePax = Math.max(1, Number(pax) || 1);

  let unitPriceIDR = 0;

  // Authoritative IDR prices must be valid transactional IDR values (>= 10,000)
  // Legacy USD values (< 10,000, e.g. 150) must NEVER be treated as IDR or used as fallback
  const rawBatchPrice = (batch && Number(batch.price) >= 10000) ? Number(batch.price) : 0;
  const rawBatchWnaIDR = (batch && Number(batch.wnaPriceIDR) >= 10000) ? Number(batch.wnaPriceIDR) : 0;

  const explicitTripIDR = Number(trip?.startingPriceIDR || trip?.wniPrice || 0);
  const rawTripPriceIDR = explicitTripIDR >= 10000 ? explicitTripIDR : (Number(trip?.price) >= 10000 ? Number(trip?.price) : 0);
  const rawTripWnaIDR = Number(trip?.wnaPriceIDR) >= 10000 ? Number(trip?.wnaPriceIDR) : 0;

  if (isWNI) {
    unitPriceIDR = rawBatchPrice > 0 ? rawBatchPrice : rawTripPriceIDR;
  } else {
    // International / WNA: Explicit authoritative IDR price if available
    const explicitWnaIDR = rawBatchWnaIDR > 0 ? rawBatchWnaIDR : rawTripWnaIDR;
    if (explicitWnaIDR > 0) {
      unitPriceIDR = explicitWnaIDR;
    } else if (rawBatchPrice > 0) {
      unitPriceIDR = rawBatchPrice;
    } else {
      unitPriceIDR = rawTripPriceIDR;
    }
  }

  const unitPriceUSD = unitPriceIDR > 0 ? Math.round(unitPriceIDR / EXCHANGE_RATE_USD_TO_IDR) : 0;
  const totalPriceUSD = unitPriceUSD * safePax;
  const totalPriceIDR = unitPriceIDR * safePax;

  return {
    unitPriceUSD,
    unitPriceIDR,
    pax: safePax,
    surchargeMultiplier: 1.0,
    totalPriceUSD,
    totalPriceIDR,
    paymentAmountIDR: totalPriceIDR
  };
}

/**
 * Universal safe currency formatter.
 * 
 * Automatically detects whether amount is in USD or IDR.
 * - If amount >= 10,000, it treats the amount as IDR.
 * - If amount < 10,000, it treats the amount as USD.
 * This completely prevents accidental double-conversion (e.g. 5,408,000 * 16,000).
 */
export function formatCurrencyAmount(
  amount: number,
  targetCurrency: 'USD' | 'IDR' | 'CNY' = 'USD'
): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '';

  let amountUSD: number;
  let amountIDR: number;

  if (amount >= 10000) {
    // Input is already in IDR
    amountIDR = amount;
    amountUSD = Math.round(amount / EXCHANGE_RATE_USD_TO_IDR);
  } else {
    // Input is in USD
    amountUSD = amount;
    amountIDR = Math.round(amount * EXCHANGE_RATE_USD_TO_IDR);
  }

  if (targetCurrency === 'IDR') {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amountIDR)).replace('Rp', 'Rp ');
  } else if (targetCurrency === 'CNY') {
    const cnyValue = amountUSD * EXCHANGE_RATE_USD_TO_CNY;
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }).format(cnyValue);
  } else {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amountUSD));
  }
}

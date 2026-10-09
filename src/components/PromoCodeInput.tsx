import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tag, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';

export interface PromoValidationResult {
  valid: boolean;
  code: string;
  discount: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  maxDiscount?: number | null;
  minSpendIDR?: number;
  description?: string;
  message?: string;
  reason?: string;
}

export interface PromoCodeInputProps {
  /** The current order / transaction amount in IDR against which promo is validated */
  amount: number;
  /** Callback fired whenever promo is applied (with server validation result) or removed (with null) */
  onPromoChange: (result: PromoValidationResult | null) => void;
  /** Initial promo code string if pre-filled */
  initialCode?: string;
  /** Theme styling mode ('light' for white/gray cards, 'dark' for neutral-900 dark backgrounds) */
  theme?: 'light' | 'dark';
  /** Optional container class name */
  className?: string;
}

export default function PromoCodeInput({
  amount,
  onPromoChange,
  initialCode = '',
  theme = 'light',
  className = ''
}: PromoCodeInputProps) {
  const [code, setCode] = useState(initialCode);
  const [appliedPromo, setAppliedPromo] = useState<PromoValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Track the amount that was last validated to detect amount changes
  const prevAmountRef = useRef<number>(amount);
  const onPromoChangeRef = useRef(onPromoChange);
  onPromoChangeRef.current = onPromoChange;

  // Authoritative server validation call
  const executeValidation = useCallback(async (codeToValidate: string, currentAmount: number, isRevalidation = false) => {
    const cleanCode = codeToValidate.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) {
      setErrorMsg('Harap masukkan kode promo.');
      return;
    }

    if (currentAmount <= 0) {
      setErrorMsg('Nominal transaksi harus lebih dari 0.');
      return;
    }

    setIsValidating(true);
    setErrorMsg(null);
    if (!isRevalidation) {
      setSuccessMsg(null);
    }

    try {
      const res = await fetch('/api/promos/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: cleanCode,
          amount: currentAmount
        })
      });

      const data: PromoValidationResult = await res.json();

      if (data && data.valid === true) {
        setAppliedPromo(data);
        setErrorMsg(null);
        setSuccessMsg(data.message || `Kode promo "${data.code}" berhasil diterapkan.`);
        onPromoChangeRef.current(data);
      } else {
        // Server rejected promo (invalid / expired / inactive / min spend not met / etc.)
        setAppliedPromo(null);
        setErrorMsg(data?.message || 'Kode promo tidak valid atau tidak memenuhi syarat.');
        setSuccessMsg(null);
        onPromoChangeRef.current(null);
      }
    } catch (err: any) {
      console.error('[PromoCodeInput] Validation network error:', err);
      setAppliedPromo(null);
      setErrorMsg('Gagal memvalidasi kode promo ke server. Silakan coba lagi.');
      setSuccessMsg(null);
      onPromoChangeRef.current(null);
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Handle Apply button click
  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || isValidating) return;
    executeValidation(code, amount, false);
  };

  // Handle Remove promo
  const handleRemove = () => {
    setAppliedPromo(null);
    setCode('');
    setErrorMsg(null);
    setSuccessMsg(null);
    onPromoChangeRef.current(null);
  };

  // CRITICAL RULE: "Jika amount berubah, promo harus divalidasi ulang."
  // If amount changes while a promo is currently applied, re-validate against new amount!
  useEffect(() => {
    if (prevAmountRef.current !== amount) {
      prevAmountRef.current = amount;
      if (appliedPromo && appliedPromo.code) {
        // Revalidate applied promo against new amount
        executeValidation(appliedPromo.code, amount, true);
      }
    }
  }, [amount, appliedPromo, executeValidation]);

  const isDark = theme === 'dark';

  return (
    <div className={`space-y-2.5 ${className}`} data-testid="promo-code-container">
      {/* 1. If Promo is Applied Successfully: Show Applied Card */}
      {appliedPromo ? (
        <div
          data-testid="applied-promo-card"
          className={`p-3.5 rounded-2xl border transition-all animate-in fade-in flex items-center justify-between gap-3 ${
            isDark
              ? 'bg-emerald-500/10 border-emerald-500/30 text-neutral-100'
              : 'bg-emerald-50 border-emerald-200 text-neutral-900 shadow-xs'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
              <Tag className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span data-testid="applied-promo-code" className="font-mono font-black text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {appliedPromo.code}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-500 font-mono">
                  TERPASANG
                </span>
              </div>
              <p data-testid="applied-promo-discount" className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5 truncate">
                Hemat Rp {appliedPromo.discount.toLocaleString('id-ID')}
                {appliedPromo.description ? ` · ${appliedPromo.description}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            data-testid="remove-promo-btn"
            onClick={handleRemove}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
              isDark
                ? 'bg-neutral-800 hover:bg-neutral-700 text-rose-400 border border-neutral-700'
                : 'bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 shadow-xs'
            }`}
            title="Hapus kode promo"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Hapus</span>
          </button>
        </div>
      ) : (
        /* 2. Input Form when no promo is applied */
        <div className="space-y-1.5" data-testid="promo-input-form-wrapper">
          <label
            className={`text-[10px] font-mono uppercase font-black tracking-wider flex items-center gap-1.5 ${
              isDark ? 'text-neutral-400' : 'text-neutral-600'
            }`}
          >
            <Tag className="h-3 w-3 text-amber-500" />
            <span>Kode Promo & Voucher Diskon</span>
          </label>

          <form onSubmit={handleApply} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                data-testid="promo-code-input"
                id="promo-code-input"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/\s+/g, ''));
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Contoh: SMARTBALI10"
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-mono uppercase font-bold transition-all outline-none ${
                  isDark
                    ? 'bg-neutral-900 border border-neutral-700 text-white placeholder:text-neutral-300 focus:border-amber-500'
                    : 'bg-neutral-50 border border-neutral-300 text-neutral-900 placeholder:text-neutral-600 focus:bg-white focus:border-[#315B4F]'
                }`}
                disabled={isValidating}
              />
            </div>

            <button
              type="submit"
              data-testid="apply-promo-btn"
              id="apply-promo-btn"
              disabled={isValidating || !code.trim()}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black active:scale-95 shadow-md shadow-amber-500/10'
                  : 'bg-[#315B4F] hover:bg-[#25463d] text-white active:scale-95 shadow-sm'
              }`}
            >
              {isValidating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Memeriksa...</span>
                </>
              ) : (
                <span>Terapkan</span>
              )}
            </button>
          </form>
        </div>
      )}

      {/* 3. Rejection / Error Message Banner */}
      {errorMsg && (
        <div
          data-testid="promo-error-msg"
          className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 animate-in fade-in ${
            isDark
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              : 'bg-rose-50 border-rose-200 text-rose-700'
          }`}
        >
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
          <p className="font-medium text-[11px] leading-tight">{errorMsg}</p>
        </div>
      )}

      {/* 4. Success Message Banner */}
      {successMsg && !errorMsg && appliedPromo && (
        <div
          data-testid="promo-success-msg"
          className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in ${
            isDark
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          <p className="font-medium text-[11px] leading-tight">{successMsg}</p>
        </div>
      )}
    </div>
  );
}

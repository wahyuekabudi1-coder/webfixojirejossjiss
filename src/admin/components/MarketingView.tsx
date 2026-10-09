import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Sparkles, Tag, Globe, Plus, Trash2, Edit, Check, X, Search, 
  Star, Activity, Upload, Building, ExternalLink, Save, Calendar, 
  Clock, Percent, DollarSign, Filter, RefreshCw, AlertCircle, 
  CheckCircle2, ChevronRight, Copy, Eye, MessageSquare, Phone, 
  Mail, MapPin, Share2, HelpCircle, FileText, Database
} from 'lucide-react';
import { getAdminHeaders, handleAdminResponse } from '../../utils/adminAuth';
import { Review } from '../../types';
import { PartnerApp, PARTNERS_DATA_VERSION, OFFICIAL_PARTNERS } from '../../data/partnersData';
import { SocialMediaItem, getStoredSocialMedia, saveStoredSocialMedia } from '../../data/socialMediaData';
import { UnifiedBookingDetail } from '../../components/admin/BookingDetailModal';
import ArticleCmsWorkspace from './ArticleCmsWorkspace';

export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minSpendIDR: number;
  maxDiscount?: number | null;
  validUntil: string;
  maxUsage?: number | null;
  usageCount: number;
  isActive: boolean;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface MarketingViewProps {
  theme: any;
  isDark?: boolean;
  activeTab: 'promo' | 'content';
  setActiveTab: (tab: 'promo' | 'content') => void;
  triggerToast: (msg: string) => void;
  reviews: Review[];
  approveReview: (id: string) => void;
  rejectReview: (id: string) => void;
  bookings?: UnifiedBookingDetail[];
}

export default function MarketingView({
  theme,
  isDark = false,
  activeTab,
  setActiveTab,
  triggerToast,
  reviews,
  approveReview,
  rejectReview,
  bookings = []
}: MarketingViewProps) {
  // ---------------------------------------------------------------------------
  // 1. PROMO CODES ENGINE & PERSISTENCE (SERVER SQL SINGLE SOURCE OF TRUTH)
  // ---------------------------------------------------------------------------
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loadingPromos, setLoadingPromos] = useState<boolean>(true);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isSavingPromo, setIsSavingPromo] = useState<boolean>(false);

  // Fetch all promo codes from backend API (GET /api/admin/promos)
  const fetchPromos = useCallback(async () => {
    setLoadingPromos(true);
    setPromoError(null);
    try {
      const res = await fetch('/api/admin/promos', {
        headers: getAdminHeaders()
      });
      const data = await handleAdminResponse<PromoCode[]>(res, 'Gagal memuat daftar kode promo.');
      setPromoCodes(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Error fetching promo codes:', err);
      setPromoError(err.message || 'Gagal memuat kode promo dari database server.');
      triggerToast(err.message || 'Gagal memuat kode promo');
    } finally {
      setLoadingPromos(false);
    }
  }, [triggerToast]);

  // Load promos on mount
  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  // Promo Filter & Search state
  const [promoSearch, setPromoSearch] = useState('');
  const [promoStatusFilter, setPromoStatusFilter] = useState<'all' | 'active' | 'paused' | 'expired'>('all');

  // Promo Add / Edit Modal state
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<PromoCode | null>(null);
  const [promoForm, setPromoForm] = useState({
    code: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 10,
    minSpendIDR: 500000,
    maxDiscount: '' as string | number,
    validUntil: '2026-12-31',
    maxUsage: '' as string | number,
    description: '',
    isActive: true
  });

  // Open modal for Create
  const handleOpenAddPromo = () => {
    setEditingPromo(null);
    setPromoForm({
      code: '',
      discountType: 'percentage',
      discountValue: 10,
      minSpendIDR: 500000,
      maxDiscount: 100000,
      validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      maxUsage: 100,
      description: '',
      isActive: true
    });
    setIsPromoModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditPromo = (promo: PromoCode) => {
    setEditingPromo(promo);
    setPromoForm({
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      minSpendIDR: promo.minSpendIDR,
      maxDiscount: promo.maxDiscount != null ? promo.maxDiscount : '',
      validUntil: promo.validUntil,
      maxUsage: promo.maxUsage != null ? promo.maxUsage : '',
      description: promo.description || '',
      isActive: promo.isActive
    });
    setIsPromoModalOpen(true);
  };

  // Submit Promo (Create or Edit) with strict validation & server persistence
  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = promoForm.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    
    if (!cleanCode || cleanCode.length < 3) {
      triggerToast('Kode promo minimal 3 karakter alfanumerik');
      return;
    }

    if (promoForm.discountType === 'percentage') {
      if (Number(promoForm.discountValue) <= 0 || Number(promoForm.discountValue) > 100) {
        triggerToast('Nilai diskon persentase harus antara 1% - 100%');
        return;
      }
    } else {
      if (Number(promoForm.discountValue) < 1000) {
        triggerToast('Nilai diskon nominal tetap minimal Rp 1.000');
        return;
      }
    }

    if (Number(promoForm.minSpendIDR) < 0) {
      triggerToast('Minimal belanja tidak boleh negatif');
      return;
    }

    if (!promoForm.validUntil) {
      triggerToast('Tentukan tanggal batas berlaku voucher');
      return;
    }

    setIsSavingPromo(true);
    try {
      const payload = {
        code: cleanCode,
        discountType: promoForm.discountType,
        discountValue: Number(promoForm.discountValue),
        minSpendIDR: Number(promoForm.minSpendIDR) || 0,
        maxDiscount: promoForm.maxDiscount !== '' && promoForm.maxDiscount != null ? Number(promoForm.maxDiscount) : null,
        validUntil: String(promoForm.validUntil).trim(),
        maxUsage: promoForm.maxUsage !== '' && promoForm.maxUsage != null ? Number(promoForm.maxUsage) : null,
        description: promoForm.description ? promoForm.description.trim() : '',
        isActive: promoForm.isActive
      };

      if (editingPromo) {
        // Edit existing promo: PUT /api/admin/promos/:code
        const res = await fetch(`/api/admin/promos/${encodeURIComponent(editingPromo.code)}`, {
          method: 'PUT',
          headers: getAdminHeaders(),
          body: JSON.stringify(payload)
        });
        const updated = await handleAdminResponse<PromoCode>(res, 'Gagal memperbarui voucher promo.');
        setPromoCodes(prev => prev.map(p => p.id === editingPromo.id ? updated : p));
        triggerToast(`Voucher ${updated.code} berhasil diperbarui di database!`);
      } else {
        // Create new promo: POST /api/admin/promos
        const res = await fetch('/api/admin/promos', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify(payload)
        });
        const created = await handleAdminResponse<PromoCode>(res, 'Gagal menerbitkan voucher promo baru.');
        setPromoCodes(prev => [created, ...prev]);
        triggerToast(`Voucher ${created.code} berhasil diterbitkan dan disimpan ke database!`);
      }

      setIsPromoModalOpen(false);
    } catch (err: any) {
      console.error('Error saving promo code:', err);
      triggerToast(err.message || 'Gagal menyimpan kode promo.');
    } finally {
      setIsSavingPromo(false);
    }
  };

  // Toggle active / paused status via PUT /api/admin/promos/:code
  const handleTogglePromoStatus = async (promo: PromoCode) => {
    try {
      const res = await fetch(`/api/admin/promos/${encodeURIComponent(promo.code)}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          isActive: !promo.isActive
        })
      });
      const updated = await handleAdminResponse<PromoCode>(res, 'Gagal mengubah status aktif promo.');
      setPromoCodes(prev => prev.map(p => p.id === promo.id ? updated : p));
      triggerToast(`Status promo ${promo.code} ${updated.isActive ? 'diaktifkan' : 'dinonaktifkan'}`);
    } catch (err: any) {
      console.error('Error toggling promo status:', err);
      triggerToast(err.message || 'Gagal mengubah status aktif promo.');
    }
  };

  // Delete promo via DELETE /api/admin/promos/:code
  const handleDeletePromo = async (promo: PromoCode) => {
    if (!confirm(`Hapus voucher promo "${promo.code}" secara permanen dari database server? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/promos/${encodeURIComponent(promo.code)}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      });
      await handleAdminResponse(res, 'Gagal menghapus kode promo.');
      setPromoCodes(prev => prev.filter(p => p.id !== promo.id));
      triggerToast(`Promo ${promo.code} berhasil dihapus dari database.`);
    } catch (err: any) {
      console.error('Error deleting promo:', err);
      triggerToast(err.message || 'Gagal menghapus voucher promo.');
    }
  };

  // Filtered Promo list
  const filteredPromoCodes = useMemo(() => {
    const now = new Date().toISOString().split('T')[0];
    return promoCodes.filter(p => {
      // Search filter
      const matchesSearch = 
        p.code.toLowerCase().includes(promoSearch.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(promoSearch.toLowerCase());
      if (!matchesSearch) return false;

      // Status filter
      const isExpired = p.validUntil < now;
      if (promoStatusFilter === 'active') return p.isActive && !isExpired;
      if (promoStatusFilter === 'paused') return !p.isActive && !isExpired;
      if (promoStatusFilter === 'expired') return isExpired;
      return true;
    });
  }, [promoCodes, promoSearch, promoStatusFilter]);

  // Promo KPIs
  const promoKpi = useMemo(() => {
    const now = new Date().toISOString().split('T')[0];
    const total = promoCodes.length;
    const active = promoCodes.filter(p => p.isActive && p.validUntil >= now).length;
    const totalUsage = promoCodes.reduce((acc, curr) => acc + (curr.usageCount || 0), 0);
    const expired = promoCodes.filter(p => p.validUntil < now).length;
    return { total, active, totalUsage, expired };
  }, [promoCodes]);

  // ---------------------------------------------------------------------------
  // 2. WEBSITE CMS ENGINE (Connected strictly to real frontend consumers)
  // ---------------------------------------------------------------------------
  // CMS subtabs: Only those that have genuine consumer in the frontend
  const [cmsSubTab, setCmsSubTab] = useState<'reviews' | 'partners' | 'socials' | 'articles'>('reviews');

  // Reviews moderation filter
  const [reviewsFilter, setReviewsFilter] = useState<'all' | 'pending' | 'approved'>('all');

  const filteredReviews = useMemo(() => {
    return reviews.filter(r => {
      if (reviewsFilter === 'pending') return r.status === 'pending';
      if (reviewsFilter === 'approved') return r.status === 'approved' || !r.status;
      return true;
    });
  }, [reviews, reviewsFilter]);

  const reviewsSummary = useMemo(() => {
    const total = reviews.length;
    const pending = reviews.filter(r => r.status === 'pending').length;
    const approved = reviews.filter(r => r.status === 'approved' || !r.status).length;
    return { total, pending, approved };
  }, [reviews]);

  // Partners state (Synchronized with smartjourney_partners & OFFICIAL_PARTNERS)
  const [adminPartners, setAdminPartners] = useState<PartnerApp[]>(() => {
    try {
      const version = localStorage.getItem('smartjourney_partners_version');
      const stored = localStorage.getItem('smartjourney_partners');
      if (stored && version === PARTNERS_DATA_VERSION) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    try {
      localStorage.setItem('smartjourney_partners', JSON.stringify(OFFICIAL_PARTNERS));
      localStorage.setItem('smartjourney_partners_version', PARTNERS_DATA_VERSION);
    } catch (e) {}
    return OFFICIAL_PARTNERS;
  });

  const [partnerForm, setPartnerForm] = useState({ id: '', name: '', url: '', logoUrl: '', category: 'Travel Platform' });
  const [isEditingPartner, setIsEditingPartner] = useState(false);
  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  const saveAdminPartners = (updated: PartnerApp[]) => {
    setAdminPartners(updated);
    try {
      localStorage.setItem('smartjourney_partners', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleLogoFileUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      triggerToast('Mohon unggah file gambar (format PNG disarankan)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setPartnerForm(prev => ({ ...prev, logoUrl: event.target!.result as string }));
        triggerToast('Logo PNG partner berhasil diunggah!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSavePartner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerForm.name || !partnerForm.url || !partnerForm.logoUrl) {
      triggerToast('Nama, URL, dan Logo Partner wajib diisi.');
      return;
    }
    let updated: PartnerApp[] = [];
    if (isEditingPartner) {
      updated = adminPartners.map(p => p.id === partnerForm.id ? { ...p, ...partnerForm } : p);
      triggerToast(`Partner ${partnerForm.name} berhasil diperbarui!`);
    } else {
      const newPartner: PartnerApp = {
        id: 'partner-' + Date.now(),
        name: partnerForm.name.trim(),
        url: partnerForm.url.trim(),
        logoUrl: partnerForm.logoUrl.trim(),
        category: partnerForm.category || 'Travel Partner'
      };
      updated = [...adminPartners, newPartner];
      triggerToast(`Partner ${partnerForm.name} berhasil ditambahkan!`);
    }
    saveAdminPartners(updated);
    setPartnerForm({ id: '', name: '', url: '', logoUrl: '', category: 'Travel Platform' });
    setIsEditingPartner(false);
  };

  const handleDeletePartner = (id: string, name: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus partner platform ${name}?`)) {
      const updated = adminPartners.filter(p => p.id !== id);
      saveAdminPartners(updated);
      triggerToast(`Partner ${name} berhasil dihapus.`);
    }
  };

  // Social Media state (Directly connected to Footer & SocialMediaButtons)
  const [adminSocials, setAdminSocials] = useState<SocialMediaItem[]>(() => getStoredSocialMedia());

  const handleUpdateSocial = (id: string, field: 'handle' | 'url', value: string) => {
    setAdminSocials(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleSaveSocials = () => {
    saveStoredSocialMedia(adminSocials);
    triggerToast('Pengaturan Media Sosial (IG, TikTok, Rednote, LinkedIn) berhasil disimpan & aktif di website!');
  };

  return (
    <div className="space-y-6 text-left">
      {/* ------------------------------------------------------------------- */}
      {/* HEADER & MODULE SUB-NAV */}
      {/* ------------------------------------------------------------------- */}
      <div className={`p-4 rounded-2xl border ${theme.card} flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm`}>
        <div className="space-y-0.5">
          <h3 className="text-sm font-black uppercase tracking-wider font-mono text-amber-500 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span>MARKETING &amp; PROMOTION HUB</span>
          </h3>
          <p className={`text-xs ${theme.textSecondary}`}>
            Kelola voucher diskon pelanggan dan materi publikasi website utama yang terhubung langsung ke customer frontend.
          </p>
        </div>

        <div className={`flex items-center gap-1.5 p-1 rounded-xl ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-100 border-slate-200'} border shrink-0`}>
          <button
            onClick={() => setActiveTab('promo')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'promo'
                ? 'bg-amber-500 text-neutral-950 font-black shadow-sm'
                : isDark
                ? 'text-neutral-400 hover:text-white'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            <span>Kode Promo &amp; Diskon ({promoCodes.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'content'
                ? 'bg-amber-500 text-neutral-950 font-black shadow-sm'
                : isDark
                ? 'text-neutral-400 hover:text-white'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Website Content (CMS)</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: PROMO CODES MANAGEMENT                                       */}
      {/* =================================================================== */}
      {activeTab === 'promo' && (
        <div className="space-y-6">
          {/* Promo Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={`p-4 rounded-2xl border ${theme.card} shadow-sm space-y-1`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-neutral-400 font-bold">Total Voucher</span>
                <Tag className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black font-mono text-neutral-100">{promoKpi.total}</div>
              <p className={`text-[10px] ${theme.textSecondary}`}>Terdaftar di database sistem</p>
            </div>

            <div className={`p-4 rounded-2xl border ${theme.card} shadow-sm space-y-1`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold">Voucher Aktif</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400">{promoKpi.active}</div>
              <p className={`text-[10px] ${theme.textSecondary}`}>Siap digunakan oleh tamu</p>
            </div>

            <div className={`p-4 rounded-2xl border ${theme.card} shadow-sm space-y-1`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-neutral-400 font-bold">Total Penggunaan</span>
                <Activity className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black font-mono text-neutral-100">{promoKpi.totalUsage}x</div>
              <p className={`text-[10px] ${theme.textSecondary}`}>Frekuensi transaksi klaim</p>
            </div>

            <div className={`p-4 rounded-2xl border ${theme.card} shadow-sm space-y-1`}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-rose-400 font-bold">Kadaluarsa</span>
                <Clock className="h-4 w-4 text-rose-500" />
              </div>
              <div className="text-2xl font-black font-mono text-rose-400">{promoKpi.expired}</div>
              <p className={`text-[10px] ${theme.textSecondary}`}>Melewati batas tanggal</p>
            </div>
          </div>

          {/* Action & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className={`absolute left-3 top-2.5 h-3.5 w-3.5 ${theme.textMuted}`} />
                <input
                  type="text"
                  value={promoSearch}
                  onChange={(e) => setPromoSearch(e.target.value)}
                  placeholder="Cari kode promo atau deskripsi..."
                  className={`w-full ${theme.input} border rounded-xl pl-9 pr-3 py-1.5 text-xs`}
                />
              </div>

              <div className={`flex items-center gap-1 ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-100 border-slate-200'} p-1 rounded-xl border`}>
                {(['all', 'active', 'paused', 'expired'] as const).map((filterId) => (
                  <button
                    key={filterId}
                    onClick={() => setPromoStatusFilter(filterId)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer ${
                      promoStatusFilter === filterId
                        ? 'bg-amber-500 text-neutral-950 font-black'
                        : isDark
                        ? 'text-neutral-400 hover:text-white'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {filterId === 'all' ? 'Semua' : filterId === 'active' ? 'Aktif' : filterId === 'paused' ? 'Non-aktif' : 'Expired'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={fetchPromos}
                disabled={loadingPromos}
                className={`px-3 py-2 rounded-xl ${
                  isDark 
                    ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border-neutral-700' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border-slate-300'
                } font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer border disabled:opacity-50`}
                title="Segarkan data dari database"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingPromos ? 'animate-spin text-amber-500' : ''}`} />
                <span className="hidden sm:inline">Segarkan</span>
              </button>

              <button
                onClick={handleOpenAddPromo}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shrink-0 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Promo Baru</span>
              </button>
            </div>
          </div>

          {/* Error Banner if API fails */}
          {promoError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                <span>{promoError}</span>
              </div>
              <button
                onClick={fetchPromos}
                className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-bold transition-all cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* Promo Codes Table */}
          <div className={`${theme.card} border rounded-2xl overflow-hidden shadow-sm`}>
            <table className="w-full text-left text-xs">
              <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase text-neutral-400 font-black`}>
                <tr>
                  <th className="p-3.5">Kode Promo</th>
                  <th className="p-3.5">Tipe Diskon</th>
                  <th className="p-3.5">Nilai Potongan</th>
                  <th className="p-3.5">Maks. Diskon</th>
                  <th className="p-3.5">Min. Belanja</th>
                  <th className="p-3.5">Berlaku Hingga</th>
                  <th className="p-3.5 text-center">Batas Penggunaan</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850">
                {loadingPromos && promoCodes.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-neutral-400">
                      <RefreshCw className="h-6 w-6 mx-auto text-amber-500 animate-spin mb-3" />
                      <p className="text-xs font-mono font-bold">Memuat data promo dari database SQL...</p>
                    </td>
                  </tr>
                ) : filteredPromoCodes.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-neutral-500">
                      <Tag className="h-8 w-8 mx-auto text-neutral-600 mb-2 opacity-60" />
                      <p className="text-xs font-bold">Tidak ada kode promo yang cocok dengan kriteria pencarian.</p>
                    </td>
                  </tr>
                ) : (
                  filteredPromoCodes.map((p) => {
                    const now = new Date().toISOString().split('T')[0];
                    const isExpired = p.validUntil < now;
                    return (
                      <tr key={p.id} className={`${theme.hover} transition-colors group`}>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-amber-500 text-sm tracking-wider">
                              {p.code}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(p.code);
                                triggerToast(`Kode promo ${p.code} disalin ke clipboard!`);
                              }}
                              className="text-neutral-500 hover:text-amber-400 transition-colors cursor-pointer"
                              title="Salin Kode"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                          {p.description && (
                            <p className="text-[10px] text-neutral-400 mt-0.5 max-w-xs truncate">
                              {p.description}
                            </p>
                          )}
                        </td>

                        <td className="p-3.5 font-mono capitalize">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            p.discountType === 'percentage' 
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {p.discountType === 'percentage' ? 'Persentase (%)' : 'Nominal Tetap (Rp)'}
                          </span>
                        </td>

                        <td className="p-3.5 font-mono font-black text-neutral-200 text-sm">
                          {p.discountType === 'percentage' 
                            ? `${p.discountValue}%` 
                            : `Rp ${p.discountValue.toLocaleString('id-ID')}`}
                        </td>

                        <td className="p-3.5 font-mono text-neutral-300">
                          {p.maxDiscount && p.maxDiscount > 0 ? (
                            <span>Rp {p.maxDiscount.toLocaleString('id-ID')}</span>
                          ) : (
                            <span className="text-neutral-500 text-[11px]">Tanpa Maks.</span>
                          )}
                        </td>

                        <td className="p-3.5 font-mono text-neutral-300">
                          {p.minSpendIDR > 0 
                            ? `Rp ${p.minSpendIDR.toLocaleString('id-ID')}` 
                            : 'Tanpa Min.'}
                        </td>

                        <td className="p-3.5 font-mono text-neutral-300">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3 text-neutral-500" />
                            <span className={isExpired ? 'text-rose-400 font-bold line-through' : ''}>
                              {p.validUntil}
                            </span>
                          </div>
                        </td>

                        <td className="p-3.5 text-center font-mono">
                          <span className="font-bold text-neutral-200">{p.usageCount}x</span>
                          {p.maxUsage ? (
                            <span className="text-neutral-500 text-[10px]"> / {p.maxUsage}x</span>
                          ) : (
                            <span className="text-neutral-500 text-[10px]"> / ∞</span>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          {isExpired ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              Kadaluarsa
                            </span>
                          ) : p.isActive ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Aktif
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
                              Non-aktif
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-right space-x-1.5">
                          <button
                            onClick={() => handleTogglePromoStatus(p)}
                            disabled={isExpired}
                            className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              isExpired 
                                ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' 
                                : p.isActive 
                                ? 'bg-neutral-800 hover:bg-neutral-700 text-amber-400' 
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20'
                            }`}
                            title={p.isActive ? 'Jeda Voucher' : 'Aktifkan Voucher'}
                          >
                            {p.isActive ? 'Pause' : 'Aktifkan'}
                          </button>
                          
                          <button
                            onClick={() => handleOpenEditPromo(p)}
                            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all cursor-pointer"
                            title="Edit Voucher"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeletePromo(p)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                            title="Hapus Voucher"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Add / Edit Promo Modal */}
          {isPromoModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
              <div className={`max-w-lg w-full ${theme.card} border rounded-2xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95`}>
                <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-amber-500" />
                    <h4 className="text-sm font-black font-mono text-amber-500 uppercase">
                      {editingPromo ? `Edit Kode Promo: ${editingPromo.code}` : 'Tambah Kode Promo Baru'}
                    </h4>
                  </div>
                  <button 
                    onClick={() => setIsPromoModalOpen(false)} 
                    className={`${isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-800'} cursor-pointer transition-colors`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSavePromo} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-neutral-400 uppercase block font-bold">
                      Kode Voucher Promo *
                    </label>
                    <input
                      type="text"
                      required
                      value={promoForm.code}
                      onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                      placeholder="e.g. BALISPECIAL2026"
                      className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs font-mono uppercase font-black`}
                    />
                    <p className="text-[10px] text-neutral-500">Hanya huruf dan angka, tanpa spasi (otomatis kapital).</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-400 uppercase block font-bold">
                        Tipe Diskon *
                      </label>
                      <select
                        value={promoForm.discountType}
                        onChange={(e) => setPromoForm({ ...promoForm, discountType: e.target.value as any })}
                        className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs`}
                      >
                        <option value="percentage">Persentase (%)</option>
                        <option value="fixed">Nominal Tetap (Rp)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-400 uppercase block font-bold">
                        {promoForm.discountType === 'percentage' ? 'Nilai Potongan (%) *' : 'Nilai Potongan (Rp) *'}
                      </label>
                      <input
                        type="number"
                        required
                        min={promoForm.discountType === 'percentage' ? 1 : 1000}
                        max={promoForm.discountType === 'percentage' ? 100 : 100000000}
                        value={promoForm.discountValue}
                        onChange={(e) => setPromoForm({ ...promoForm, discountValue: Number(e.target.value) })}
                        className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs font-mono`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-400 uppercase block font-bold">
                        Min. Belanja (Rp)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={50000}
                        value={promoForm.minSpendIDR}
                        onChange={(e) => setPromoForm({ ...promoForm, minSpendIDR: Number(e.target.value) })}
                        className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs font-mono`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-400 uppercase block font-bold">
                        Maks. Potongan (Rp, Opsional)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={10000}
                        value={promoForm.maxDiscount !== '' ? promoForm.maxDiscount : ''}
                        onChange={(e) => setPromoForm({ ...promoForm, maxDiscount: e.target.value === '' ? '' : Number(e.target.value) })}
                        placeholder="Contoh: 100000"
                        className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs font-mono`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-400 uppercase block font-bold">
                        Batas Berlaku *
                      </label>
                      <input
                        type="date"
                        required
                        value={promoForm.validUntil}
                        onChange={(e) => setPromoForm({ ...promoForm, validUntil: e.target.value })}
                        className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs font-mono`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-400 uppercase block font-bold">
                        Batas Kuota Penggunaan (Opsional)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={promoForm.maxUsage !== '' ? promoForm.maxUsage : ''}
                        onChange={(e) => setPromoForm({ ...promoForm, maxUsage: e.target.value === '' ? '' : Number(e.target.value) })}
                        placeholder="Contoh: 100"
                        className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs font-mono`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-400 uppercase block font-bold">
                        Keterangan Singkat
                      </label>
                      <input
                        type="text"
                        value={promoForm.description}
                        onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })}
                        placeholder="e.g. Promo Liburan Bromo & Bali"
                        className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-neutral-400 uppercase block font-bold">
                        Status Saat Terbit
                      </label>
                      <select
                        value={promoForm.isActive ? 'active' : 'inactive'}
                        onChange={(e) => setPromoForm({ ...promoForm, isActive: e.target.value === 'active' })}
                        className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs`}
                      >
                        <option value="active">Aktif (Dapat Digunakan Tamu)</option>
                        <option value="inactive">Non-aktif (Dijeda)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setIsPromoModalOpen(false)}
                      className={`px-4 py-2 rounded-xl border ${
                        isDark 
                          ? 'border-neutral-700 text-neutral-300 hover:bg-neutral-800 hover:text-white' 
                          : 'border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 bg-white'
                      } text-xs font-bold cursor-pointer transition-all`}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingPromo}
                      className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-black cursor-pointer shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isSavingPromo && <RefreshCw className="h-3 w-3 animate-spin" />}
                      <span>{editingPromo ? 'Simpan Perubahan' : 'Terbitkan Promo'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: WEBSITE CMS INTERFACE (Only Real Frontend Consumers)         */}
      {/* =================================================================== */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-black tracking-tight font-mono text-amber-500">
              WEBSITE CMS MANAGEMENT
            </h2>
            <p className={`text-xs ${theme.textSecondary}`}>
              Pusat pengelolaan materi publikasi yang tampil nyata pada customer frontend: Moderasi Ulasan Tamu, Mitra Platform Resmi, dan Media Sosial.
            </p>
          </div>

          {/* Sub tabs for CMS */}
          <div className="flex gap-2 border-b border-neutral-850 pb-px overflow-x-auto no-scrollbar">
            {[
              { id: 'reviews', label: `Ulasan Tamu (${reviewsSummary.total})`, icon: Star },
              { id: 'partners', label: `Our Partner Platforms (${adminPartners.length})`, icon: Building },
              { id: 'socials', label: 'Media Sosial & Kontak Resmi', icon: Share2 },
              { id: 'articles', label: 'Travel Blog & Articles', icon: FileText }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setCmsSubTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    cmsSubTab === tab.id 
                      ? 'border-amber-500 text-amber-500 font-extrabold' 
                      : isDark
                      ? 'border-transparent text-neutral-400 hover:text-white'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* --------------------------------------------------------------- */}
          {/* CMS SUBTAB 1: REVIEWS MODERATION CENTER                        */}
          {/* --------------------------------------------------------------- */}
          {cmsSubTab === 'reviews' && (
            <div className={`${theme.card} border rounded-2xl p-6 space-y-6`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-neutral-800">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest font-mono text-amber-500 flex items-center gap-2">
                    <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                    <span>Customer Review &amp; Moderation Center</span>
                  </h4>
                  <p className={`text-xs mt-1 ${theme.textSecondary}`}>
                    Ulasan yang telah disetujui (Approved) akan langsung tampil di Testimonial beranda dan katalog paket tour.
                  </p>
                </div>
                
                {/* Summary Badges */}
                <div className="flex gap-3">
                  <div className={`px-3 py-1.5 rounded-xl border border-neutral-800 ${theme.innerCard} text-center`}>
                    <span className="text-[10px] font-bold text-neutral-400 block font-mono">TOTAL</span>
                    <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-neutral-900'} font-mono`}>{reviewsSummary.total}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-950/20 text-center">
                    <span className="text-[10px] font-bold text-amber-400 block font-mono">PENDING</span>
                    <span className="text-sm font-black text-amber-500 font-mono">{reviewsSummary.pending}</span>
                  </div>
                  <div className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-center">
                    <span className="text-[10px] font-bold text-emerald-400 block font-mono">APPROVED</span>
                    <span className="text-sm font-black text-emerald-500 font-mono">{reviewsSummary.approved}</span>
                  </div>
                </div>
              </div>

              {/* Filter tabs */}
              <div className={`flex gap-1 ${isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-slate-100 border-slate-200'} p-1 rounded-xl border w-fit`}>
                {[
                  { id: 'all', label: 'Semua Ulasan' },
                  { id: 'pending', label: `Menunggu Persetujuan (${reviewsSummary.pending})` },
                  { id: 'approved', label: `Telah Disetujui (${reviewsSummary.approved})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setReviewsFilter(tab.id as any)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                      reviewsFilter === tab.id
                        ? 'bg-amber-500 text-neutral-950 shadow-md'
                        : isDark
                        ? 'text-neutral-400 hover:text-white'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Reviews grid list */}
              <div className="space-y-3">
                {filteredReviews.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-neutral-800 rounded-2xl text-neutral-500 space-y-2">
                    <MessageSquare className="h-8 w-8 mx-auto text-neutral-600 opacity-60" />
                    <p className="text-xs font-bold">Tidak ada ulasan dalam kategori filter ini.</p>
                  </div>
                ) : (
                  filteredReviews.map((r) => {
                    const serviceTypeLabels: Record<string, string> = {
                      tour: 'Tours & Wisata',
                      airport: 'Airport Transfer',
                      taxi: 'Taxi Service',
                      rental: 'Car Rental'
                    };
                    const serviceTypeColors: Record<string, string> = {
                      tour: 'bg-indigo-950/40 text-indigo-400 border-indigo-900/30',
                      airport: 'bg-sky-950/40 text-sky-400 border-sky-900/30',
                      taxi: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30',
                      rental: 'bg-rose-950/40 text-rose-400 border-rose-900/30'
                    };

                    const label = serviceTypeLabels[r.serviceType || 'tour'] || 'Tours';
                    const colorClass = serviceTypeColors[r.serviceType || 'tour'] || 'bg-indigo-950/40 text-indigo-400 border-indigo-900/30';

                    return (
                      <div 
                        key={r.id} 
                        className={`p-5 rounded-2xl border ${theme.innerCard} flex flex-col md:flex-row justify-between gap-4 items-start md:items-center relative transition-all hover:border-neutral-700`}
                      >
                        <div className="space-y-2 flex-1 text-left">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`font-extrabold text-xs ${isDark ? 'text-white' : 'text-neutral-900'}`}>{r.name}</span>
                            <span className="text-[10px] text-neutral-400">({r.country || 'Indonesia'})</span>
                            <span className="text-[10px] text-neutral-500 font-mono">· {r.date}</span>
                            
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
                              {label}
                            </span>

                            {r.status === 'pending' ? (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-950/40 text-amber-500 border border-amber-900/40 font-mono">
                                PENDING
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/40 text-emerald-500 border border-emerald-900/40 font-mono">
                                APPROVED
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 text-amber-500">
                            {[...Array(r.rating || 5)].map((_, i) => (
                              <Star key={i} className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                            ))}
                            {[...Array(5 - (r.rating || 5))].map((_, i) => (
                              <Star key={i} className="h-3.5 w-3.5 text-neutral-700" />
                            ))}
                          </div>

                          <p className={`text-xs italic leading-relaxed ${theme.textSecondary}`}>
                            "{r.text}"
                          </p>
                        </div>

                        {/* Interactive moderation buttons */}
                        <div className="flex gap-2 shrink-0 self-end md:self-auto">
                          {r.status === 'pending' && (
                            <button
                              onClick={() => {
                                approveReview(r.id);
                                triggerToast('Ulasan disetujui & dipublikasikan ke website!');
                              }}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs px-3 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Setujui</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              rejectReview(r.id);
                              triggerToast('Ulasan berhasil dihapus.');
                            }}
                            className="bg-neutral-800 hover:bg-red-900 text-neutral-300 hover:text-white border border-neutral-700 hover:border-red-800 font-extrabold text-xs px-3 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>{r.status === 'pending' ? 'Tolak' : 'Hapus'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* CMS SUBTAB 2: OUR PARTNER PLATFORMS                             */}
          {/* --------------------------------------------------------------- */}
          {cmsSubTab === 'partners' && (
            <div className={`${theme.card} border rounded-2xl p-6 space-y-6`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-neutral-800">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest font-mono text-amber-500 flex items-center gap-2">
                    <Building className="h-4 w-4 text-amber-500" />
                    <span>Managing Our Partner Platforms</span>
                  </h4>
                  <p className={`text-xs mt-1 ${theme.textSecondary}`}>
                    Tambah, edit, dan hapus platform partner travel yang ditampilkan pada section <strong>"Our Partner Platforms"</strong> di beranda dan Partner Directory.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPartnerForm({ id: '', name: '', url: '', logoUrl: '', category: 'Travel Platform' });
                      setIsEditingPartner(false);
                    }}
                    className="bg-amber-500 hover:bg-amber-400 text-neutral-950 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/10 active:scale-95"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah Partner Baru</span>
                  </button>
                </div>
              </div>

              {/* Partner Add/Edit Form */}
              <form onSubmit={handleSavePartner} className={`p-5 rounded-2xl border ${theme.innerCard} space-y-4`}>
                <h5 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Building className="h-4 w-4 text-amber-500" />
                  <span>{isEditingPartner ? 'Edit Platform Partner' : 'Form Tambah Platform Partner'}</span>
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase">Nama Partner *</label>
                    <input
                      type="text"
                      required
                      value={partnerForm.name}
                      onChange={(e) => setPartnerForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Traveloka"
                      className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs`}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-neutral-400 uppercase">Tautan / Link Website *</label>
                    <input
                      type="text"
                      required
                      value={partnerForm.url}
                      onChange={(e) => setPartnerForm(prev => ({ ...prev, url: e.target.value }))}
                      placeholder="e.g. https://www.traveloka.com"
                      className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs`}
                    />
                  </div>
                </div>

                {/* Drag & Drop PNG Logo Upload */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-neutral-400 uppercase">Gambar Logo (PNG Drag &amp; Drop / URL) *</label>
                    <span className="text-[9px] font-bold text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Format PNG / Vector SVG
                    </span>
                  </div>

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingLogo(true);
                    }}
                    onDragLeave={() => setIsDraggingLogo(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingLogo(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleLogoFileUpload(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`relative border-2 border-dashed rounded-2xl p-4 transition-all text-center flex flex-col items-center justify-center cursor-pointer ${
                      isDraggingLogo
                        ? 'border-amber-500 bg-amber-500/15 scale-[1.01]'
                        : partnerForm.logoUrl
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-neutral-700/80 bg-neutral-900/50 hover:border-amber-500/60 hover:bg-neutral-900'
                    }`}
                  >
                    <input
                      type="file"
                      accept="image/png,image/*"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleLogoFileUpload(e.target.files[0]);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />

                    {partnerForm.logoUrl ? (
                      <div className="flex flex-col sm:flex-row items-center gap-4 w-full z-20">
                        <div className="w-20 h-20 rounded-xl bg-neutral-950 border border-neutral-800 p-2 flex items-center justify-center shrink-0">
                          <img
                            src={partnerForm.logoUrl}
                            alt="Preview Logo Partner"
                            className="max-h-full max-w-full object-contain rounded"
                          />
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <span className="inline-block text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 mb-1">
                            Gambar Logo Siap Digunakan
                          </span>
                          <p className="text-xs font-medium text-neutral-300 truncate">
                            {partnerForm.logoUrl.startsWith('data:') ? 'File Gambar PNG Terunggah (Base64)' : partnerForm.logoUrl}
                          </p>
                          <p className="text-[10px] text-neutral-500 mt-1">
                            Seret file PNG baru ke sini atau klik area ini untuk mengganti gambar logo.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPartnerForm(prev => ({ ...prev, logoUrl: '' }));
                          }}
                          className="z-30 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-all cursor-pointer shrink-0"
                        >
                          Hapus Logo
                        </button>
                      </div>
                    ) : (
                      <div className="py-3 flex flex-col items-center gap-2 pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                          <Upload className="h-6 w-6" />
                        </div>
                        <div>
                          <p className={`text-xs font-extrabold ${isDark ? 'text-white' : 'text-neutral-900'}`}>
                            Seret &amp; Lepas Gambar Logo PNG di Sini
                          </p>
                          <p className="text-[11px] text-neutral-400 mt-0.5">
                            atau <span className="text-amber-400 font-bold underline">Klik di sini untuk memilih file PNG</span> dari perangkat Anda
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Fallback URL input option */}
                  <details className="text-[11px] text-neutral-500 pt-1">
                    <summary className="cursor-pointer hover:text-amber-400 font-medium select-none">
                      Atau masukkan URL gambar logo secara manual (opsional)
                    </summary>
                    <input
                      type="text"
                      value={partnerForm.logoUrl}
                      onChange={(e) => setPartnerForm(prev => ({ ...prev, logoUrl: e.target.value }))}
                      placeholder="https://example.com/logo.png"
                      className={`w-full ${theme.input} border rounded-xl px-3 py-1.5 text-xs mt-1.5`}
                    />
                  </details>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                  {isEditingPartner && (
                    <button
                      type="button"
                      onClick={() => {
                        setPartnerForm({ id: '', name: '', url: '', logoUrl: '', category: 'Travel Platform' });
                        setIsEditingPartner(false);
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold ${
                        isDark
                          ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300'
                      } transition-all cursor-pointer`}
                    >
                      Batal
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-400 text-neutral-950 transition-all cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>{isEditingPartner ? 'Simpan Perubahan Partner' : 'Tambahkan Partner'}</span>
                  </button>
                </div>
              </form>

              {/* Partner List Grid */}
              <div className="space-y-3">
                <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-wider font-mono">
                  Daftar Partner Aktif ({adminPartners.length})
                </h5>

                {adminPartners.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-neutral-800 rounded-2xl text-neutral-500">
                    <p className="text-xs font-bold">Belum ada partner platform terdaftar.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {adminPartners.map((p) => (
                      <div
                        key={p.id}
                        className={`p-4 rounded-2xl border ${theme.innerCard} flex items-center justify-between gap-3 relative group transition-all hover:border-neutral-700`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 p-2 flex items-center justify-center shrink-0">
                            <img
                              src={p.logoUrl}
                              alt={p.name}
                              className="max-h-full max-w-full object-contain rounded"
                              onError={(e) => {
                                (e.target as any).src = 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?auto=format&fit=crop&w=150&q=80';
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <h6 className={`text-xs font-extrabold ${isDark ? 'text-white' : 'text-neutral-900'} truncate`}>{p.name}</h6>
                            <a
                              href={p.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-amber-500 hover:underline truncate block"
                            >
                              {p.url}
                            </a>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setPartnerForm({
                                id: p.id,
                                name: p.name,
                                url: p.url,
                                logoUrl: p.logoUrl,
                                category: p.category || 'Travel Platform'
                              });
                              setIsEditingPartner(true);
                            }}
                            className="p-2 rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 text-neutral-300 transition-all cursor-pointer"
                            title="Edit Partner"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePartner(p.id, p.name)}
                            className="p-2 rounded-lg bg-neutral-800 hover:bg-red-600 text-neutral-300 hover:text-white transition-all cursor-pointer"
                            title="Hapus Partner"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* CMS SUBTAB 3: SOCIAL MEDIA & OFFICIAL CONTACT                   */}
          {/* --------------------------------------------------------------- */}
          {cmsSubTab === 'socials' && (
            <div className={`${theme.card} border rounded-2xl p-6 space-y-6`}>
              <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest font-mono text-amber-500 flex items-center gap-2">
                    <Share2 className="h-4 w-4 text-amber-500" />
                    <span>Media Sosial Resmi &amp; Saluran Publikasi</span>
                  </h4>
                  <p className={`text-xs mt-1 ${theme.textSecondary}`}>
                    Kelola tautan media sosial (Instagram, TikTok, Rednote, LinkedIn) yang tampil di Footer dan Halaman Tentang Kami.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveSocials}
                  className="bg-amber-500 hover:bg-amber-400 text-neutral-950 px-5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md cursor-pointer active:scale-95"
                >
                  <Save className="h-4 w-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>

              {/* Social Channels Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adminSocials.map((social) => (
                  <div 
                    key={social.id} 
                    className={`p-4 rounded-2xl border ${theme.innerCard} space-y-3 relative overflow-hidden`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-black shadow-sm"
                          style={{ backgroundColor: social.color }}
                        >
                          {social.shortName.slice(0, 2)}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-neutral-200 block">{social.name}</span>
                          <span className="text-[10px] text-neutral-400 font-mono">{social.category}</span>
                        </div>
                      </div>
                      <a
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        <span>Buka Tautan</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase">Username / ID Handle</label>
                        <input
                          type="text"
                          value={social.handle}
                          onChange={(e) => handleUpdateSocial(social.id, 'handle', e.target.value)}
                          placeholder="e.g. @smartjourney.id"
                          className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs`}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-neutral-400 uppercase">Target URL Direct Link</label>
                        <input
                          type="url"
                          value={social.url}
                          onChange={(e) => handleUpdateSocial(social.id, 'url', e.target.value)}
                          placeholder="https://..."
                          className={`w-full ${theme.input} border rounded-xl px-3 py-2 text-xs font-mono`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Official Contact Info Reference (Connected to Footer & WhatsApp widget) */}
              <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-400" />
                  <h5 className="text-xs font-bold text-neutral-200 uppercase font-mono tracking-wider">
                    Informasi Kontak Operasional Utama
                  </h5>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">WhatsApp Direct 24/7</span>
                    <span className="font-mono font-bold text-emerald-400">+62 852-1234-7289</span>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">Email Korespondensi</span>
                    <span className="font-mono font-bold text-neutral-200">sawahjayagroup@gmail.com</span>
                  </div>
                  <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">Kantor Operasional</span>
                    <span className="font-medium text-neutral-300 truncate block">Malang &amp; Bali, Indonesia</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------- */}
          {/* CMS SUBTAB 4: TRAVEL BLOG & ARTICLES CMS ENGINE                */}
          {/* --------------------------------------------------------------- */}
          {cmsSubTab === 'articles' && (
            <ArticleCmsWorkspace
              theme={theme}
              isDark={isDark}
              triggerToast={triggerToast}
            />
          )}
        </div>
      )}
    </div>
  );
}

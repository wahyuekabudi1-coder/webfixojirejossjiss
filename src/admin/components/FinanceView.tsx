import React, { useState, useMemo } from 'react';
import { 
  CreditCard, Receipt, TrendingUp, FileText, Download, 
  CheckCircle2, AlertTriangle, Clock, RefreshCw, Send, DollarSign,
  ShieldCheck, ArrowUpRight, BarChart3, Search, Terminal, Filter,
  Calendar, Eye, Printer, X, Check, ArrowRight, Shield, Award,
  Users, Car, Plane, Compass, ExternalLink, HelpCircle
} from 'lucide-react';
import { UnifiedBookingDetail } from '../../components/admin/BookingDetailModal';

interface FinanceViewProps {
  bookings: UnifiedBookingDetail[];
  activeTab: 'payments' | 'invoices' | 'revenue' | 'reports';
  setActiveTab: (tab: 'payments' | 'invoices' | 'revenue' | 'reports') => void;
  formatPrice: (usd: number, idr: number) => string;
  theme: any;
  isDark?: boolean;
  triggerToast: (msg: string) => void;
  onOpenDetail: (booking: UnifiedBookingDetail) => void;
}

// Period filtering helper
function matchesPeriod(dateStr: string | undefined, period: 'all' | 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | 'thisYear'): boolean {
  if (period === 'all') return true;
  if (!dateStr) return false;

  const targetDate = new Date(dateStr);
  if (isNaN(targetDate.getTime())) return false;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const targetIso = targetDate.toISOString().slice(0, 10);

  if (period === 'today') {
    return targetIso === todayStr;
  }

  const diffMs = now.getTime() - targetDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (period === '7d') {
    return diffDays >= 0 && diffDays <= 7;
  }
  if (period === '30d') {
    return diffDays >= 0 && diffDays <= 30;
  }
  if (period === 'thisMonth') {
    return targetDate.getFullYear() === now.getFullYear() && targetDate.getMonth() === now.getMonth();
  }
  if (period === 'lastMonth') {
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return targetDate.getFullYear() === prevMonth.getFullYear() && targetDate.getMonth() === prevMonth.getMonth();
  }
  if (period === 'thisYear') {
    return targetDate.getFullYear() === now.getFullYear();
  }

  return true;
}

export default function FinanceView({
  bookings,
  activeTab,
  setActiveTab,
  formatPrice,
  theme,
  isDark = false,
  triggerToast,
  onOpenDetail
}: FinanceViewProps) {
  // --------------------------------------------------------------------------
  // GLOBAL REAL REVENUE CALCULATIONS (Strictly Real Data, Zero Fake Revenue)
  // --------------------------------------------------------------------------
  // Canonical rule: Realized Revenue = paymentStatus === 'Paid' AND bookingStatus !== 'Cancelled' AND bookingStatus !== 'Rejected'
  const allPaidBookings = useMemo(() => {
    return bookings.filter(b => 
      (b.paymentStatus === 'Paid' || (b.paymentStatus || '').toLowerCase() === 'paid') && 
      b.bookingStatus !== 'Cancelled' &&
      b.bookingStatus !== 'Rejected'
    );
  }, [bookings]);

  const allPendingBookings = useMemo(() => {
    return bookings.filter(b => 
      (b.paymentStatus || '').toLowerCase() !== 'paid' && 
      b.bookingStatus !== 'Cancelled' &&
      b.bookingStatus !== 'Rejected'
    );
  }, [bookings]);

  const globalTotalRevenueIDR = useMemo(() => {
    return allPaidBookings.reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0);
  }, [allPaidBookings]);

  const globalTotalRevenueUSD = useMemo(() => {
    return allPaidBookings.reduce((sum, b) => sum + (b.totalAmountUSD || 0), 0);
  }, [allPaidBookings]);

  const globalPendingPotentialIDR = useMemo(() => {
    return allPendingBookings.reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0);
  }, [allPendingBookings]);

  // --------------------------------------------------------------------------
  // TAB 1: PAYMENTS (All 5 Services, paymentStatus separate from bookingStatus)
  // --------------------------------------------------------------------------
  const [paymentsSearch, setPaymentsSearch] = useState('');
  const [paymentsServiceFilter, setPaymentsServiceFilter] = useState<'all' | 'tour' | 'sharetour' | 'airport' | 'taxi' | 'car-rental'>('all');
  const [paymentsStatusFilter, setPaymentsStatusFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [paymentsPeriodFilter, setPaymentsPeriodFilter] = useState<'all' | 'today' | '7d' | '30d' | 'thisMonth'>('all');

  // Sandbox Webhook Simulator State (preserved)
  const [sandboxBookingId, setSandboxBookingId] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);

  const handleSimulateWebhook = async () => {
    if (!sandboxBookingId.trim()) {
      triggerToast('Pilih atau masukkan ID/Kode booking untuk simulasi.');
      return;
    }

    setIsSimulating(true);
    try {
      const res = await fetch('/api/artopay/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: sandboxBookingId.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Simulasi gagal');
      }

      triggerToast(`Simulasi Sukses! Booking #${sandboxBookingId} terverifikasi Paid via Sandbox ArtoPay.`);
    } catch (err: any) {
      triggerToast(`Gagal: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  const filteredPayments = useMemo(() => {
    return bookings.filter((b) => {
      // 1. Service Filter
      if (paymentsServiceFilter !== 'all') {
        if (paymentsServiceFilter === 'car-rental') {
          if (b.serviceType !== 'car-rental' && b.serviceType !== 'rental') return false;
        } else if (b.serviceType !== paymentsServiceFilter) {
          return false;
        }
      }

      // 2. Payment Status Filter
      const isPaid = (b.paymentStatus || '').toLowerCase() === 'paid';
      if (paymentsStatusFilter === 'paid' && !isPaid) return false;
      if (paymentsStatusFilter === 'pending' && isPaid) return false;

      // 3. Period Filter (checks paidAt or createdAt)
      const dateToCheck = b.paidAt || b.createdAt || b.date || b.departureDate;
      if (!matchesPeriod(dateToCheck, paymentsPeriodFilter)) return false;

      // 4. Search Filter
      if (paymentsSearch.trim()) {
        const q = paymentsSearch.toLowerCase().trim();
        const matches = 
          (b.bookingCode || '').toLowerCase().includes(q) ||
          (b.customerName || '').toLowerCase().includes(q) ||
          (b.serviceTitle || '').toLowerCase().includes(q) ||
          (b.customerEmail || '').toLowerCase().includes(q) ||
          (b.customerPhone || '').toLowerCase().includes(q) ||
          String(b.uniqueCode || '').includes(q);
        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => {
      const dateA = a.paidAt || a.createdAt || a.date || '';
      const dateB = b.paidAt || b.createdAt || b.date || '';
      return dateB.localeCompare(dateA);
    });
  }, [bookings, paymentsServiceFilter, paymentsStatusFilter, paymentsPeriodFilter, paymentsSearch]);

  // --------------------------------------------------------------------------
  // TAB 2: INVOICES (Official Document System tied to bookingStatus)
  // --------------------------------------------------------------------------
  const [invoicesSearch, setInvoicesSearch] = useState('');
  const [invoicesServiceFilter, setInvoicesServiceFilter] = useState<'all' | 'tour' | 'sharetour' | 'airport' | 'taxi' | 'car-rental'>('all');
  const [invoicesDocStatusFilter, setInvoicesDocStatusFilter] = useState<'all' | 'confirmed' | 'draft' | 'cancelled'>('all');

  const filteredInvoices = useMemo(() => {
    return bookings.filter((b) => {
      // 1. Service Filter
      if (invoicesServiceFilter !== 'all') {
        if (invoicesServiceFilter === 'car-rental') {
          if (b.serviceType !== 'car-rental' && b.serviceType !== 'rental') return false;
        } else if (b.serviceType !== invoicesServiceFilter) {
          return false;
        }
      }

      // 2. Document status (mapped to bookingStatus)
      if (invoicesDocStatusFilter === 'confirmed') {
        if (b.bookingStatus !== 'Confirmed' && b.bookingStatus !== 'Completed') return false;
      } else if (invoicesDocStatusFilter === 'draft') {
        if (b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Completed' || b.bookingStatus === 'Cancelled') return false;
      } else if (invoicesDocStatusFilter === 'cancelled') {
        if (b.bookingStatus !== 'Cancelled') return false;
      }

      // 3. Search Filter
      if (invoicesSearch.trim()) {
        const q = invoicesSearch.toLowerCase().trim();
        const invNum = `INV-${b.bookingCode.slice(-6)}`.toLowerCase();
        const matches = 
          invNum.includes(q) ||
          (b.bookingCode || '').toLowerCase().includes(q) ||
          (b.customerName || '').toLowerCase().includes(q) ||
          (b.serviceTitle || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => {
      const dateA = a.createdAt || a.departureDate || '';
      const dateB = b.createdAt || b.departureDate || '';
      return dateB.localeCompare(dateA);
    });
  }, [bookings, invoicesServiceFilter, invoicesDocStatusFilter, invoicesSearch]);

  // --------------------------------------------------------------------------
  // TAB 3: REVENUE ANALYSIS (Strict Breakdown per Service)
  // --------------------------------------------------------------------------
  const revenueByService = useMemo(() => {
    const services = [
      { id: 'tour', label: 'Private Tour', color: 'bg-amber-500', barBg: 'bg-amber-500/20', textColor: 'text-amber-500' },
      { id: 'sharetour', label: 'Open Trip (Share Tour)', color: 'bg-emerald-500', barBg: 'bg-emerald-500/20', textColor: 'text-emerald-500' },
      { id: 'airport', label: 'Airport Transfer', color: 'bg-sky-500', barBg: 'bg-sky-500/20', textColor: 'text-sky-500' },
      { id: 'taxi', label: 'Taxi Service', color: 'bg-purple-500', barBg: 'bg-purple-500/20', textColor: 'text-purple-500' },
      { id: 'car-rental', label: 'Car Rental & Charter', color: 'bg-rose-500', barBg: 'bg-rose-500/20', textColor: 'text-rose-500' }
    ];

    return services.map(srv => {
      const srvPaidBookings = allPaidBookings.filter(b => {
        if (srv.id === 'car-rental') return b.serviceType === 'car-rental' || b.serviceType === 'rental';
        return b.serviceType === srv.id;
      });

      const totalIDR = srvPaidBookings.reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0);
      const totalUSD = srvPaidBookings.reduce((sum, b) => sum + (b.totalAmountUSD || 0), 0);
      const count = srvPaidBookings.length;
      const totalPax = srvPaidBookings.reduce((sum, b) => sum + (b.passengers || 1), 0);
      const aov = count > 0 ? Math.round(totalIDR / count) : 0;
      const percentage = globalTotalRevenueIDR > 0 ? Math.round((totalIDR / globalTotalRevenueIDR) * 100) : 0;

      return {
        ...srv,
        totalIDR,
        totalUSD,
        count,
        totalPax,
        aov,
        percentage
      };
    });
  }, [allPaidBookings, globalTotalRevenueIDR]);

  // Unique codes total (verified addition)
  const totalUniqueCodesIDR = useMemo(() => {
    return allPaidBookings.reduce((sum, b) => sum + (b.uniqueCode || 0), 0);
  }, [allPaidBookings]);

  // --------------------------------------------------------------------------
  // TAB 4: REPORTS & RECONCILIATION
  // --------------------------------------------------------------------------
  const [reportPeriod, setReportPeriod] = useState<'all' | 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | 'thisYear'>('thisMonth');
  const [reportService, setReportService] = useState<'all' | 'tour' | 'sharetour' | 'airport' | 'taxi' | 'car-rental'>('all');

  const reportData = useMemo(() => {
    const periodBookings = bookings.filter(b => {
      // Service filter
      if (reportService !== 'all') {
        if (reportService === 'car-rental') {
          if (b.serviceType !== 'car-rental' && b.serviceType !== 'rental') return false;
        } else if (b.serviceType !== reportService) {
          return false;
        }
      }

      // Period filter
      const dateToCheck = b.paidAt || b.createdAt || b.departureDate || b.date;
      return matchesPeriod(dateToCheck, reportPeriod);
    });

    const totalBookingsCount = periodBookings.length;
    const paidList = periodBookings.filter(b => (b.paymentStatus === 'Paid' || (b.paymentStatus || '').toLowerCase() === 'paid') && b.bookingStatus !== 'Cancelled' && b.bookingStatus !== 'Rejected');
    const paidCount = paidList.length;
    const confirmedCount = periodBookings.filter(b => b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Completed').length;
    const cancelledCount = periodBookings.filter(b => b.bookingStatus === 'Cancelled' || b.bookingStatus === 'Rejected').length;

    const realizedRevenueIDR = paidList.reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0);
    const pendingList = periodBookings.filter(b => (b.paymentStatus || '').toLowerCase() !== 'paid' && b.bookingStatus !== 'Cancelled' && b.bookingStatus !== 'Rejected');
    const pendingPotentialIDR = pendingList.reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0);

    const conversionRate = totalBookingsCount > 0 ? Math.round((paidCount / totalBookingsCount) * 100) : 0;

    // Service Breakdown in this period
    const serviceBreakdown = [
      { id: 'tour', name: 'Private Tour' },
      { id: 'sharetour', name: 'Open Trip (Share Tour)' },
      { id: 'airport', name: 'Airport Transfer' },
      { id: 'taxi', name: 'Taxi Service' },
      { id: 'car-rental', name: 'Car Rental' }
    ].map(srv => {
      const srvList = periodBookings.filter(b => {
        if (srv.id === 'car-rental') return b.serviceType === 'car-rental' || b.serviceType === 'rental';
        return b.serviceType === srv.id;
      });
      const srvPaid = srvList.filter(b => (b.paymentStatus === 'Paid' || (b.paymentStatus || '').toLowerCase() === 'paid') && b.bookingStatus !== 'Cancelled' && b.bookingStatus !== 'Rejected');
      const srvConfirmed = srvList.filter(b => b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Completed');
      const revenue = srvPaid.reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0);
      const pax = srvPaid.reduce((sum, b) => sum + (b.passengers || 1), 0);

      return {
        id: srv.id,
        name: srv.name,
        totalBookings: srvList.length,
        paidCount: srvPaid.length,
        confirmedCount: srvConfirmed.length,
        revenue,
        pax,
        convRate: srvList.length > 0 ? Math.round((srvPaid.length / srvList.length) * 100) : 0
      };
    });

    return {
      periodBookings,
      totalBookingsCount,
      paidCount,
      confirmedCount,
      cancelledCount,
      realizedRevenueIDR,
      pendingPotentialIDR,
      conversionRate,
      serviceBreakdown
    };
  }, [bookings, reportPeriod, reportService]);

  // --------------------------------------------------------------------------
  // EXPORT FUNCTIONS (CSV)
  // --------------------------------------------------------------------------
  const handleExportPaymentsCSV = () => {
    if (filteredPayments.length === 0) {
      triggerToast('Tidak ada data transaksi pembayaran untuk diekspor.');
      return;
    }

    const headers = [
      'Kode Booking',
      'Layanan',
      'Nama Pelanggan',
      'Telepon',
      'Email',
      'Nilai Tagihan (IDR)',
      'Kode Unik (IDR)',
      'Total Akhir (IDR)',
      'Status Pembayaran (paymentStatus)',
      'Status Booking (bookingStatus)',
      'Waktu Pembayaran',
      'Tanggal Dibuat'
    ];

    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = filteredPayments.map(b => [
      escapeCsv(b.bookingCode),
      escapeCsv(b.serviceType.toUpperCase()),
      escapeCsv(b.customerName),
      escapeCsv(b.customerPhone || '-'),
      escapeCsv(b.customerEmail || '-'),
      escapeCsv(b.baseAmountIDR || b.totalAmountIDR || 0),
      escapeCsv(b.uniqueCode || 0),
      escapeCsv(b.totalAmountIDR || 0),
      escapeCsv(b.paymentStatus || 'Pending'),
      escapeCsv(b.bookingStatus || 'Pending Payment'),
      escapeCsv(b.paidAt ? new Date(b.paidAt).toISOString() : '-'),
      escapeCsv(b.createdAt ? new Date(b.createdAt).toISOString() : '-')
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smartjourney_payments_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    triggerToast(`Berhasil mengekspor ${filteredPayments.length} catatan pembayaran.`);
  };

  const handleExportReconciliationCSV = () => {
    const headers = [
      'Layanan',
      'Total Pemesanan Dibuat',
      'Transaksi Lunas (Paid)',
      'Terkonfirmasi (Confirmed/Completed)',
      'Tingkat Keberhasilan (%)',
      'Total Pendapatan Lunas (IDR)',
      'Total Penumpang / Pax'
    ];

    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = reportData.serviceBreakdown.map(s => [
      escapeCsv(s.name),
      escapeCsv(s.totalBookings),
      escapeCsv(s.paidCount),
      escapeCsv(s.confirmedCount),
      escapeCsv(`${s.convRate}%`),
      escapeCsv(s.revenue),
      escapeCsv(s.pax)
    ].join(','));

    const totalRow = [
      escapeCsv('TOTAL KESELURUHAN'),
      escapeCsv(reportData.totalBookingsCount),
      escapeCsv(reportData.paidCount),
      escapeCsv(reportData.confirmedCount),
      escapeCsv(`${reportData.conversionRate}%`),
      escapeCsv(reportData.realizedRevenueIDR),
      escapeCsv(reportData.serviceBreakdown.reduce((sum, s) => sum + s.pax, 0))
    ].join(',');

    const csvContent = [headers.join(','), ...rows, totalRow].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smartjourney_financial_report_${reportPeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    triggerToast('Laporan rekonsiliasi keuangan per layanan berhasil diunduh.');
  };

  // Helper Badge Colors for Services
  const getServiceBadge = (type: string) => {
    switch (type) {
      case 'tour':
        return { label: 'Private Tour', color: 'bg-amber-500/10 text-amber-500 border-amber-500/30' };
      case 'sharetour':
        return { label: 'Open Trip', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' };
      case 'airport':
        return { label: 'Airport Transfer', color: 'bg-sky-500/10 text-sky-500 border-sky-500/30' };
      case 'taxi':
        return { label: 'Taxi Service', color: 'bg-purple-500/10 text-purple-500 border-purple-500/30' };
      case 'car-rental':
      case 'rental':
        return { label: 'Car Rental', color: 'bg-rose-500/10 text-rose-500 border-rose-500/30' };
      default:
        return { label: type.toUpperCase(), color: 'bg-neutral-800 text-neutral-300 border-neutral-700' };
    }
  };

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30">
              <DollarSign className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-black tracking-tight font-sans">
                KEUANGAN &amp; ARUS PEMBAYARAN TERPADU (FINANCE)
              </h2>
              <p className={`text-xs ${theme.textSecondary}`}>
                Audit transaksi 5 layanan, sistem faktur/e-voucher resmi, analisis omset nyata (realized revenue), dan laporan rekonsiliasi.
              </p>
            </div>
          </div>
        </div>

        {/* Global Summary Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`px-3 py-1.5 rounded-xl ${theme.innerCard} border border-neutral-700/60 flex items-center gap-2`}>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono text-neutral-300 font-bold">
              Omset Lunas: <span className="text-amber-500 font-black">Rp {globalTotalRevenueIDR.toLocaleString('id-ID')}</span>
            </span>
          </div>

          <div className={`px-3 py-1.5 rounded-xl ${theme.innerCard} border border-neutral-700/60 flex items-center gap-2`}>
            <Receipt className="h-3.5 w-3.5 text-sky-400" />
            <span className="text-[11px] font-mono text-neutral-300 font-bold">
              {allPaidBookings.length} Transaksi Terbayar
            </span>
          </div>
        </div>
      </div>

      {/* FINANCE SUB-NAV (4 Core Parts) */}
      <div className="flex items-center gap-2 border-b border-neutral-700/40 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'payments' as const, label: '1. Pembayaran & ArtoPay (Payments)', icon: CreditCard },
          { id: 'invoices' as const, label: '2. Faktur & Dokumen (Invoices)', icon: Receipt },
          { id: 'revenue' as const, label: '3. Analisis Pendapatan (Revenue)', icon: TrendingUp },
          { id: 'reports' as const, label: '4. Laporan & Rekonsiliasi (Reports)', icon: FileText }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                isActive
                  ? isDark
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 font-extrabold shadow-xs'
                    : 'bg-amber-500/15 border border-amber-500/30 text-amber-700 font-extrabold shadow-xs'
                  : isDark
                    ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border border-transparent'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-transparent'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          1. VIEW: PAYMENTS & ARTOPAY GATEWAY (5 SERVICES AUDIT)
          ========================================================================= */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* SANDBOX PAYMENT SIMULATION TOOL (PRESERVED) */}
          <div className={`${theme.card} border rounded-2xl p-5 space-y-4 shadow-sm border-amber-500/30`}>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-mono bg-amber-500/15 text-amber-500 font-black px-2 py-0.5 rounded border border-amber-500/30">
                  DEVELOPER / SANDBOX TOOL
                </span>
                <h3 className="text-sm font-black font-sans text-neutral-100">
                  Simulasi Webhook Pembayaran Sukses (ArtoPay Sandbox Only)
                </h3>
                <p className="text-xs text-neutral-400">
                  Simulasikan panggilan callback webhook ArtoPay untuk memverifikasi flow: Pending Payment → ArtoPay Webhook → Paid → Pending Confirmation.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <div className="relative flex-grow w-full">
                <input
                  type="text"
                  value={sandboxBookingId}
                  onChange={(e) => setSandboxBookingId(e.target.value)}
                  placeholder="Masukkan Kode Booking / ID Booking (misal: SJ-TB-1234 atau pilih dari daftar)..."
                  className={`w-full ${theme.input} px-4 py-2.5 rounded-xl text-xs font-mono`}
                />
              </div>

              {/* Quick Select for pending bookings */}
              <select
                onChange={(e) => setSandboxBookingId(e.target.value)}
                value=""
                className={`w-full sm:w-60 ${theme.input} px-3 py-2.5 rounded-xl text-xs font-mono cursor-pointer`}
              >
                <option value="">-- Pilih Booking Pending --</option>
                {allPendingBookings.slice(0, 15).map(b => (
                  <option key={b.id} value={b.bookingCode || b.id}>
                    #{b.bookingCode} - {b.customerName} ({b.serviceType})
                  </option>
                ))}
              </select>

              <button
                disabled={isSimulating}
                onClick={handleSimulateWebhook}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shrink-0"
              >
                {isSimulating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>Kirim Simulasi Webhook</span>
              </button>
            </div>
          </div>

          {/* SEARCH & FILTER CONTROLS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3">
            {/* Search */}
            <div className="md:col-span-5 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={paymentsSearch}
                onChange={(e) => setPaymentsSearch(e.target.value)}
                placeholder="Cari kode booking, nama tamu, layanan, kode unik..."
                className={`w-full ${theme.input} pl-9 pr-8 py-2 rounded-xl text-xs`}
              />
              {paymentsSearch && (
                <button
                  onClick={() => setPaymentsSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Service Filter */}
            <div className="md:col-span-3">
              <select
                value={paymentsServiceFilter}
                onChange={(e) => setPaymentsServiceFilter(e.target.value as any)}
                className={`w-full ${theme.input} px-3 py-2 rounded-xl text-xs`}
              >
                <option value="all">Semua 5 Layanan</option>
                <option value="tour">Private Tour</option>
                <option value="sharetour">Open Trip</option>
                <option value="airport">Airport Transfer</option>
                <option value="taxi">Taxi Service</option>
                <option value="car-rental">Car Rental</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="md:col-span-2">
              <select
                value={paymentsStatusFilter}
                onChange={(e) => setPaymentsStatusFilter(e.target.value as any)}
                className={`w-full ${theme.input} px-3 py-2 rounded-xl text-xs`}
              >
                <option value="all">Semua Status Bayar</option>
                <option value="paid">Lunas (Paid)</option>
                <option value="pending">Menunggu (Pending)</option>
              </select>
            </div>

            {/* Period Filter */}
            <div className="md:col-span-2">
              <select
                value={paymentsPeriodFilter}
                onChange={(e) => setPaymentsPeriodFilter(e.target.value as any)}
                className={`w-full ${theme.input} px-3 py-2 rounded-xl text-xs`}
              >
                <option value="all">Semua Periode</option>
                <option value="today">Hari Ini</option>
                <option value="7d">7 Hari Terakhir</option>
                <option value="30d">30 Hari Terakhir</option>
                <option value="thisMonth">Bulan Ini</option>
              </select>
            </div>
          </div>

          {/* ACTIVE SUMMARY BAR */}
          <div className="flex items-center justify-between text-xs text-neutral-400 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span>Menampilkan: <b className="text-neutral-200">{filteredPayments.length}</b> transaksi</span>
              <span className="text-neutral-600">•</span>
              <span>Total Nilai Terfilter: <b className="text-amber-500 font-mono">Rp {filteredPayments.reduce((s, b) => s + (b.totalAmountIDR || 0), 0).toLocaleString('id-ID')}</b></span>
            </div>

            <button
              onClick={handleExportPaymentsCSV}
              className="px-3 py-1 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Ekspor Transaksi CSV</span>
            </button>
          </div>

          {/* RECENT PAYMENT LOGS TABLE (ALL 5 SERVICES) */}
          <div className={`${theme.card} border rounded-2xl overflow-hidden shadow-sm`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase text-neutral-400 font-bold`}>
                  <tr>
                    <th className="p-3.5">Kode Transaksi</th>
                    <th className="p-3.5">Layanan</th>
                    <th className="p-3.5">Nama Pelanggan</th>
                    <th className="p-3.5 text-right">Nilai Tagihan</th>
                    <th className="p-3.5 text-center">Kode Unik</th>
                    <th className="p-3.5 text-center">Status Pembayaran</th>
                    <th className="p-3.5 text-center">Status Booking</th>
                    <th className="p-3.5">Waktu Pembayaran</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40">
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-neutral-500 font-mono">
                        Tidak ada transaksi pembayaran yang cocok dengan kriteria filter.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((item) => {
                      const isPaid = (item.paymentStatus || '').toLowerCase() === 'paid';
                      const badge = getServiceBadge(item.serviceType);

                      return (
                        <tr key={item.id} className={`${theme.hover} transition-colors`}>
                          <td className="p-3.5 font-mono font-bold text-amber-500">
                            #{item.bookingCode}
                          </td>
                          <td className="p-3.5">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badge.color}`}>
                              {badge.label}
                            </span>
                            <div className="text-[11px] text-neutral-400 truncate max-w-[150px] mt-0.5" title={item.serviceTitle}>
                              {item.serviceTitle}
                            </div>
                          </td>
                          <td className="p-3.5 font-bold text-neutral-100">
                            <div>{item.customerName}</div>
                            <div className="text-[10px] font-mono text-neutral-500">{item.customerPhone || item.customerEmail || '-'}</div>
                          </td>
                          <td className="p-3.5 font-mono font-black text-right text-neutral-100">
                            {item.totalAmountIDR 
                              ? `Rp ${Number(item.totalAmountIDR).toLocaleString('id-ID')}`
                              : (item.totalAmountUSD ? formatPrice(item.totalAmountUSD, item.totalAmountIDR || 0) : '-')}
                          </td>
                          <td className="p-3.5 text-center font-mono text-amber-400 font-bold">
                            {item.uniqueCode ? `+${item.uniqueCode}` : '-'}
                          </td>
                          {/* Payment Status (Separated) */}
                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                              isPaid
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}>
                              {item.paymentStatus || 'Pending'}
                            </span>
                          </td>
                          {/* Booking Status (Separated) */}
                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                              item.bookingStatus === 'Confirmed' || item.bookingStatus === 'Completed'
                                ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                                : item.bookingStatus === 'Cancelled'
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                            }`}>
                              {item.bookingStatus || 'Pending Payment'}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-neutral-400 text-[11px]">
                            {item.paidAt ? new Date(item.paidAt).toLocaleString('id-ID') : '-'}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => onOpenDetail(item)}
                              className="px-2.5 py-1 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 font-bold text-[11px] cursor-pointer"
                            >
                              Detail
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          2. VIEW: INVOICES (OFFICIAL DOCUMENT & E-VOUCHER SYSTEM)
          ========================================================================= */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto flex-grow max-w-xl">
              <div className="relative flex-grow">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  value={invoicesSearch}
                  onChange={(e) => setInvoicesSearch(e.target.value)}
                  placeholder="Cari nomor invoice (INV-...), kode booking, atau nama tamu..."
                  className={`w-full ${theme.input} pl-9 pr-4 py-2 rounded-xl text-xs`}
                />
              </div>

              <select
                value={invoicesServiceFilter}
                onChange={(e) => setInvoicesServiceFilter(e.target.value as any)}
                className={`${theme.input} px-3 py-2 rounded-xl text-xs`}
              >
                <option value="all">Semua Layanan</option>
                <option value="tour">Private Tour</option>
                <option value="sharetour">Open Trip</option>
                <option value="airport">Airport Transfer</option>
                <option value="taxi">Taxi Service</option>
                <option value="car-rental">Car Rental</option>
              </select>

              <select
                value={invoicesDocStatusFilter}
                onChange={(e) => setInvoicesDocStatusFilter(e.target.value as any)}
                className={`${theme.input} px-3 py-2 rounded-xl text-xs`}
              >
                <option value="all">Semua Status Dokumen</option>
                <option value="confirmed">Resmi / Dikonfirmasi</option>
                <option value="draft">Draft / Menunggu</option>
                <option value="cancelled">Dibatalkan (Void)</option>
              </select>
            </div>

            <div className="text-xs font-mono text-neutral-400">
              *Dokumen mengikuti status pemesanan resmi (Confirmed / Completed)
            </div>
          </div>

          <div className={`${theme.card} border rounded-2xl overflow-hidden shadow-sm`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase text-neutral-400 font-bold`}>
                  <tr>
                    <th className="p-3.5">Nomor Faktur (Invoice)</th>
                    <th className="p-3.5">Kode Booking</th>
                    <th className="p-3.5">Pelanggan</th>
                    <th className="p-3.5">Layanan</th>
                    <th className="p-3.5 text-right">Nilai Tagihan</th>
                    <th className="p-3.5 text-center">Status Pembayaran</th>
                    <th className="p-3.5 text-center">Status Dokumen</th>
                    <th className="p-3.5 text-right">Aksi Dokumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-neutral-500 font-mono">
                        Tidak ada faktur/invoice yang sesuai dengan kriteria pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((item) => {
                      const isPaid = (item.paymentStatus || '').toLowerCase() === 'paid';
                      const isConfirmed = item.bookingStatus === 'Confirmed' || item.bookingStatus === 'Completed';
                      const isCancelled = item.bookingStatus === 'Cancelled';
                      const badge = getServiceBadge(item.serviceType);

                      return (
                        <tr key={item.id} className={`${theme.hover} transition-colors`}>
                          <td className="p-3.5 font-mono font-bold text-neutral-200">
                            INV-2026-{item.bookingCode.slice(-6)}
                          </td>
                          <td className="p-3.5 font-mono text-amber-500 font-bold">
                            #{item.bookingCode}
                          </td>
                          <td className="p-3.5 font-bold text-neutral-100">
                            <div>{item.customerName}</div>
                            <div className="text-[10px] font-mono text-neutral-500">{item.customerPhone || item.customerEmail || '-'}</div>
                          </td>
                          <td className="p-3.5">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badge.color}`}>
                              {badge.label}
                            </span>
                            <div className="text-[11px] text-neutral-400 truncate max-w-[160px] mt-0.5">
                              {item.serviceTitle}
                            </div>
                          </td>
                          <td className="p-3.5 font-mono font-black text-right text-neutral-100">
                            Rp {Number(item.totalAmountIDR || 0).toLocaleString('id-ID')}
                          </td>
                          {/* Payment Status */}
                          <td className="p-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                              isPaid 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}>
                              {item.paymentStatus || 'Pending'}
                            </span>
                          </td>
                          {/* Document Status */}
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                              isConfirmed
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                                : isCancelled
                                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}>
                              {isConfirmed ? 'Resmi (Valid)' : isCancelled ? 'Batal (Void)' : 'Draft / Menunggu'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => onOpenDetail(item)}
                                className="px-2.5 py-1 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 text-[11px] font-bold cursor-pointer"
                                title="Buka Detail Invoice / E-Voucher"
                              >
                                Lihat Slip
                              </button>
                              <a
                                href={`/api/bookings/${item.bookingCode}/invoice.pdf`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-400 hover:text-white"
                                title="Unduh PDF Resmi"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          3. VIEW: REVENUE ANALYSIS (REAL DATA, ZERO FAKE DATA)
          ========================================================================= */}
      {activeTab === 'revenue' && (
        <div className="space-y-6">
          {/* Audit Notice */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-400 font-mono">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-500" />
              <span>
                <b>Audit Keuangan Mandatori:</b> Pendapatan (Revenue) hanya dihitung dari transaksi berstatus <b>LUNAS (Paid)</b>. Status Pending Payment / Confirmation TIDAK dihitung sebagai omset masuk.
              </span>
            </div>
            <span className="font-bold text-[11px] bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">
              100% Realized Revenue
            </span>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`${theme.card} border rounded-2xl p-5 space-y-2 shadow-sm`}>
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                Total Omset Terverifikasi (IDR)
              </span>
              <div className="text-2xl font-black font-mono text-amber-500">
                Rp {globalTotalRevenueIDR.toLocaleString('id-ID')}
              </div>
              <p className="text-[11px] text-neutral-400">
                Dari {allPaidBookings.length} transaksi yang telah lunas via ArtoPay.
              </p>
            </div>

            <div className={`${theme.card} border rounded-2xl p-5 space-y-2 shadow-sm`}>
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                Total Omset Internasional (USD)
              </span>
              <div className="text-2xl font-black font-mono text-emerald-400">
                ${globalTotalRevenueUSD.toLocaleString('en-US')} USD
              </div>
              <p className="text-[11px] text-neutral-400">
                Wisatawan mancanegara (WNA Tariff).
              </p>
            </div>

            <div className={`${theme.card} border rounded-2xl p-5 space-y-2 shadow-sm`}>
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                Rata-rata Nilai Pesanan (AOV)
              </span>
              <div className="text-2xl font-black font-mono text-purple-400">
                {allPaidBookings.length > 0 
                  ? `Rp ${Math.round(globalTotalRevenueIDR / allPaidBookings.length).toLocaleString('id-ID')}`
                  : 'Rp 0'}
              </div>
              <p className="text-[11px] text-neutral-400">
                Average order value per transaksi lunas.
              </p>
            </div>

            <div className={`${theme.card} border rounded-2xl p-5 space-y-2 shadow-sm`}>
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                Potensi Piutang / Pending (IDR)
              </span>
              <div className="text-2xl font-black font-mono text-neutral-300">
                Rp {globalPendingPotentialIDR.toLocaleString('id-ID')}
              </div>
              <p className="text-[11px] text-neutral-400">
                {allPendingBookings.length} pesanan menunggu pembayaran.
              </p>
            </div>
          </div>

          {/* Revenue Breakdown by 5 Services */}
          <div className={`${theme.card} border rounded-2xl p-6 space-y-5 shadow-sm`}>
            <div className="flex items-center justify-between border-b border-neutral-700/40 pb-3">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider font-mono text-amber-500">
                  DISTRIBUSI PENDAPATAN BERDASARKAN 5 LAYANAN
                </h4>
                <p className="text-[11px] text-neutral-400">
                  Rincian kontribusi omset per divisi layanan yang telah berhasil diverifikasi lunas.
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-neutral-400">
                Total: Rp {globalTotalRevenueIDR.toLocaleString('id-ID')}
              </span>
            </div>

            <div className="space-y-4">
              {revenueByService.map((item) => (
                <div key={item.id} className="space-y-1.5 p-3 rounded-xl bg-neutral-900/40 border border-neutral-800">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                      <span className="text-neutral-100">{item.label}</span>
                      <span className="text-[10px] font-mono text-neutral-400">
                        ({item.count} Transaksi • {item.totalPax} Pax)
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-neutral-400 font-mono">
                        AOV: Rp {item.aov.toLocaleString('id-ID')}
                      </span>
                      <span className="font-mono text-amber-400 font-black">
                        Rp {item.totalIDR.toLocaleString('id-ID')} ({item.percentage}%)
                      </span>
                    </div>
                  </div>

                  <div className="h-2.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${item.color} rounded-full transition-all`} 
                      style={{ width: `${item.percentage}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Unique Code Reconciliation */}
            <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400 font-mono">
              <div className="flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-amber-500" />
                <span>Akumulasi Kode Unik Verifikasi Otomatis (3 Digit Terakhir):</span>
              </div>
              <span className="font-bold text-amber-400">
                +Rp {totalUniqueCodesIDR.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. VIEW: REPORTS & RECONCILIATION
          ========================================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Report Filters */}
          <div className={`${theme.card} border rounded-2xl p-5 space-y-4 shadow-sm`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black font-sans text-neutral-100">
                  REKONSILIASI PEMBUKUAN &amp; LAPORAN KEUANGAN
                </h4>
                <p className="text-xs text-neutral-400">
                  Pilih periode dan layanan untuk menghasilkan rekapitulasi data keuangan resmi.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportReconciliationCSV}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Unduh Rekonsiliasi (CSV)</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[10px] font-mono text-neutral-400 uppercase font-bold block mb-1">
                  Periode Laporan:
                </label>
                <select
                  value={reportPeriod}
                  onChange={(e) => setReportPeriod(e.target.value as any)}
                  className={`w-full ${theme.input} px-3 py-2 rounded-xl text-xs font-sans`}
                >
                  <option value="thisMonth">Bulan Ini</option>
                  <option value="lastMonth">Bulan Lalu</option>
                  <option value="7d">7 Hari Terakhir</option>
                  <option value="30d">30 Hari Terakhir</option>
                  <option value="thisYear">Tahun Ini</option>
                  <option value="today">Hari Ini</option>
                  <option value="all">Semua Riwayat Waktu</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-neutral-400 uppercase font-bold block mb-1">
                  Kategori Layanan:
                </label>
                <select
                  value={reportService}
                  onChange={(e) => setReportService(e.target.value as any)}
                  className={`w-full ${theme.input} px-3 py-2 rounded-xl text-xs font-sans`}
                >
                  <option value="all">Semua 5 Layanan Terpadu</option>
                  <option value="tour">Private Tour Sahaja</option>
                  <option value="sharetour">Open Trip Sahaja</option>
                  <option value="airport">Airport Transfer Sahaja</option>
                  <option value="taxi">Taxi Service Sahaja</option>
                  <option value="car-rental">Car Rental Sahaja</option>
                </select>
              </div>
            </div>
          </div>

          {/* Report Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`p-4 rounded-2xl ${theme.innerCard} border border-neutral-700/60 space-y-1`}>
              <span className="text-[10px] font-mono text-neutral-400 uppercase font-bold block">
                Total Pemesanan Dibuat
              </span>
              <div className="text-xl font-black font-mono text-neutral-100">
                {reportData.totalBookingsCount} Booking
              </div>
              <div className="text-[10px] font-mono text-neutral-400">
                Semua status masuk
              </div>
            </div>

            <div className={`p-4 rounded-2xl ${theme.innerCard} border border-neutral-700/60 space-y-1`}>
              <span className="text-[10px] font-mono text-neutral-400 uppercase font-bold block">
                Transaksi Lunas (Paid)
              </span>
              <div className="text-xl font-black font-mono text-emerald-400">
                {reportData.paidCount} Transaksi
              </div>
              <div className="text-[10px] font-mono text-emerald-500 font-bold">
                Tingkat Pembayaran: {reportData.conversionRate}%
              </div>
            </div>

            <div className={`p-4 rounded-2xl ${theme.innerCard} border border-neutral-700/60 space-y-1`}>
              <span className="text-[10px] font-mono text-neutral-400 uppercase font-bold block">
                Pesanan Terkonfirmasi Resmi
              </span>
              <div className="text-xl font-black font-mono text-sky-400">
                {reportData.confirmedCount} Terkonfirmasi
              </div>
              <div className="text-[10px] font-mono text-neutral-400">
                Confirmed / Completed
              </div>
            </div>

            <div className={`p-4 rounded-2xl ${theme.innerCard} border border-neutral-700/60 space-y-1`}>
              <span className="text-[10px] font-mono text-neutral-400 uppercase font-bold block">
                Omset Lunas Periode Ini
              </span>
              <div className="text-lg font-black font-mono text-amber-500">
                Rp {reportData.realizedRevenueIDR.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] font-mono text-neutral-400">
                Piutang: Rp {reportData.pendingPotentialIDR.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {/* Reconciliation Table per 5 Services */}
          <div className={`${theme.card} border rounded-2xl overflow-hidden shadow-sm`}>
            <div className="p-4 border-b border-neutral-700/40">
              <h4 className="text-xs font-black uppercase tracking-wider font-mono text-neutral-300">
                TABEL REKONSILIASI 5 LAYANAN (PERIODE: {reportPeriod.toUpperCase()})
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase text-neutral-400 font-bold`}>
                  <tr>
                    <th className="p-3.5">Layanan</th>
                    <th className="p-3.5 text-center">Total Dipesan</th>
                    <th className="p-3.5 text-center">Transaksi Lunas</th>
                    <th className="p-3.5 text-center">Terkonfirmasi</th>
                    <th className="p-3.5 text-center">Tingkat Lunas</th>
                    <th className="p-3.5 text-center">Total Penumpang</th>
                    <th className="p-3.5 text-right">Omset Lunas (IDR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40">
                  {reportData.serviceBreakdown.map((row) => (
                    <tr key={row.id} className={`${theme.hover} transition-colors`}>
                      <td className="p-3.5 font-bold text-neutral-100">
                        {row.name}
                      </td>
                      <td className="p-3.5 font-mono text-center text-neutral-300">
                        {row.totalBookings}
                      </td>
                      <td className="p-3.5 font-mono text-center text-emerald-400 font-bold">
                        {row.paidCount}
                      </td>
                      <td className="p-3.5 font-mono text-center text-sky-400">
                        {row.confirmedCount}
                      </td>
                      <td className="p-3.5 font-mono text-center text-neutral-200">
                        {row.convRate}%
                      </td>
                      <td className="p-3.5 font-mono text-center text-neutral-300">
                        {row.pax} Pax
                      </td>
                      <td className="p-3.5 font-mono font-black text-right text-amber-500">
                        Rp {row.revenue.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className={`${theme.innerCard} border-t font-mono font-bold text-xs`}>
                  <tr>
                    <td className="p-3.5 text-neutral-100 uppercase">
                      Total Periode Ini
                    </td>
                    <td className="p-3.5 text-center text-neutral-100">
                      {reportData.totalBookingsCount}
                    </td>
                    <td className="p-3.5 text-center text-emerald-400">
                      {reportData.paidCount}
                    </td>
                    <td className="p-3.5 text-center text-sky-400">
                      {reportData.confirmedCount}
                    </td>
                    <td className="p-3.5 text-center text-neutral-100">
                      {reportData.conversionRate}%
                    </td>
                    <td className="p-3.5 text-center text-neutral-100">
                      {reportData.serviceBreakdown.reduce((sum, s) => sum + s.pax, 0)} Pax
                    </td>
                    <td className="p-3.5 text-right text-amber-500 font-black text-sm">
                      Rp {reportData.realizedRevenueIDR.toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Activity, Clock, AlertTriangle, CheckCircle2, DollarSign, 
  CreditCard, ClipboardList, Car, Users, Plane, Compass, 
  ArrowUpRight, ArrowRight, ShieldAlert, UserCheck, Calendar,
  TrendingUp, RefreshCw, Eye, ExternalLink, Filter, ChevronRight,
  ShieldCheck, HelpCircle, AlertCircle
} from 'lucide-react';
import { UnifiedBookingDetail } from '../../components/admin/BookingDetailModal';
import { Batch as ShareTourBatch, Trip as ShareTourTrip } from '../../sharetour/types';
import { getAdminHeaders } from '../../utils/adminAuth';

interface DashboardViewProps {
  bookings: UnifiedBookingDetail[];
  shareTourBatches: ShareTourBatch[];
  shareTourTrips: ShareTourTrip[];
  theme: any;
  isDark?: boolean;
  formatPrice: (usd: number, idr: number) => string;
  triggerToast: (msg: string) => void;
  onOpenDetail: (booking: UnifiedBookingDetail) => void;
  onNavigate: (module: 'orders' | 'operations' | 'finance' | 'customers' | 'analytics' | 'settings', subTab?: string, filter?: string) => void;
}

export default function DashboardView({
  bookings,
  shareTourBatches,
  shareTourTrips,
  theme,
  isDark = false,
  formatPrice,
  triggerToast,
  onOpenDetail,
  onNavigate
}: DashboardViewProps) {
  // Live clock
  const [liveTime, setLiveTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Helper to extract official departure date
  const getDepartureDate = (b: UnifiedBookingDetail): string => {
    let dateStr = '';
    if (b.serviceType === 'sharetour' && b.batchId && shareTourBatches.length > 0) {
      const batch = shareTourBatches.find(bat => bat.id === b.batchId);
      if (batch?.departureDate) dateStr = batch.departureDate;
    }
    if (!dateStr) {
      dateStr = b.departureDate || b.date || '';
    }
    return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.trim();
  };

  // Helper to check if a timestamp was today
  const isDateToday = (timestamp?: string): boolean => {
    if (!timestamp) return false;
    const clean = timestamp.includes('T') ? timestamp.split('T')[0] : timestamp.slice(0, 10);
    return clean === todayStr;
  };

  // Load persistent assignments from Server Persistent SQL DB to detect unassigned upcoming departures
  const [operationalAssignments, setOperationalAssignments] = useState<Record<string, any>>({});
  useEffect(() => {
    let isMounted = true;
    fetch('/api/operations/assignments', {
      headers: getAdminHeaders()
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isMounted && data?.assignments && typeof data.assignments === 'object') {
          setOperationalAssignments(data.assignments);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // --------------------------------------------------------------------------
  // 1. REAL KPI CALCULATIONS (ZERO FAKE DATA)
  // --------------------------------------------------------------------------
  const metrics = useMemo(() => {
    // Canonical rule: active bookings exclude Cancelled and Rejected
    const activeBookings = bookings.filter(b => b.bookingStatus !== 'Cancelled' && b.bookingStatus !== 'Rejected');
    const totalOrders = activeBookings.length;

    // 1. Pending Payment: guests who haven't paid yet
    const pendingPaymentList = activeBookings.filter(b => 
      (b.paymentStatus || '').toLowerCase() !== 'paid'
    );
    const pendingPaymentCount = pendingPaymentList.length;
    const pendingPaymentAmountIDR = pendingPaymentList.reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0);

    // 2. Pending Confirmation: guests who PAID, but admin hasn't confirmed yet (CRITICAL: Paid ≠ Confirmed)
    const pendingConfirmationList = activeBookings.filter(b => 
      (b.paymentStatus || '').toLowerCase() === 'paid' && 
      b.bookingStatus === 'Pending Confirmation'
    );
    const pendingConfirmationCount = pendingConfirmationList.length;

    // 3. Paid Today: bookings marked paid today
    const paidTodayList = activeBookings.filter(b => 
      (b.paymentStatus || '').toLowerCase() === 'paid' && 
      (isDateToday(b.paidAt) || (b.paidAt && b.paidAt.startsWith(todayStr)))
    );
    const paidTodayCount = paidTodayList.length;
    const paidTodayRevenueIDR = paidTodayList.reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0);

    // 4. Confirmed Today
    const confirmedTodayList = activeBookings.filter(b => 
      (b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Completed') && 
      isDateToday(b.createdAt)
    );
    const confirmedTodayCount = confirmedTodayList.length;

    // 5. Upcoming Departures (departureDate >= todayStr)
    const upcomingDeparturesList = activeBookings.filter(b => {
      const dep = getDepartureDate(b);
      return dep && dep.length >= 10 && dep >= todayStr;
    }).sort((a, b) => getDepartureDate(a).localeCompare(getDepartureDate(b)));
    const upcomingDeparturesCount = upcomingDeparturesList.length;

    // 6. Realized Revenue Paid (strictly paid and not cancelled)
    const paidList = activeBookings.filter(b => (b.paymentStatus || '').toLowerCase() === 'paid');
    const totalRevenuePaidIDR = paidList.reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0);
    const totalRevenuePaidUSD = paidList.reduce((sum, b) => sum + (b.totalAmountUSD || 0), 0);

    // 7. Booking Volume in last 7 days
    const d7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const recent7DaysCount = bookings.filter(b => {
      const created = b.createdAt ? b.createdAt.slice(0, 10) : '';
      return created >= d7;
    }).length;

    return {
      totalOrders,
      totalAllRecords: bookings.length,
      pendingPaymentCount,
      pendingPaymentAmountIDR,
      pendingPaymentList,
      pendingConfirmationCount,
      pendingConfirmationList,
      paidTodayCount,
      paidTodayRevenueIDR,
      confirmedTodayCount,
      upcomingDeparturesCount,
      upcomingDeparturesList,
      totalRevenuePaidIDR,
      totalRevenuePaidUSD,
      paidBookingsCount: paidList.length,
      recent7DaysCount
    };
  }, [bookings, todayStr, shareTourBatches]);

  // --------------------------------------------------------------------------
  // 2. BREAKDOWN 5 LAYANAN (REAL DATA)
  // --------------------------------------------------------------------------
  const serviceBreakdown = useMemo(() => {
    const services = [
      { id: 'tour', name: 'Private Tour', icon: Compass, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
      { id: 'sharetour', name: 'Open Trip (Share Tour)', icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
      { id: 'airport', name: 'Airport Transfer', icon: Plane, color: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
      { id: 'taxi', name: 'Taxi Service', icon: Activity, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
      { id: 'car-rental', name: 'Car Rental', icon: Car, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30' }
    ];

    return services.map(s => {
      const srvBookings = bookings.filter(b => {
        if (s.id === 'car-rental') return b.serviceType === 'car-rental' || b.serviceType === 'rental';
        return b.serviceType === s.id;
      });

      const activeSrv = srvBookings.filter(b => b.bookingStatus !== 'Cancelled' && b.bookingStatus !== 'Rejected');
      const paidSrv = activeSrv.filter(b => (b.paymentStatus || '').toLowerCase() === 'paid');
      const revenueIDR = paidSrv.reduce((sum, b) => sum + (b.totalAmountIDR || 0), 0);
      const pendingCount = activeSrv.filter(b => (b.paymentStatus || '').toLowerCase() !== 'paid').length;
      const upcomingCount = activeSrv.filter(b => {
        const dep = getDepartureDate(b);
        return dep && dep >= todayStr;
      }).length;

      return {
        ...s,
        totalBookings: activeSrv.length,
        paidCount: paidSrv.length,
        pendingCount,
        revenueIDR,
        upcomingCount
      };
    });
  }, [bookings, todayStr, shareTourBatches]);

  // --------------------------------------------------------------------------
  // 3. ACTIONABLE "NEEDS ATTENTION" DATA
  // --------------------------------------------------------------------------
  // 1) Paid but NOT Confirmed (HIGHEST PRIORITY)
  const paidUnconfirmed = metrics.pendingConfirmationList;

  // 2) Pending Payment awaiting settlement
  const pendingPayments = metrics.pendingPaymentList.slice(0, 5);

  // 3) Nearest upcoming departures needing attention (next 3 days)
  const d3Ahead = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const immediateDepartures = useMemo(() => {
    return metrics.upcomingDeparturesList.filter(b => {
      const dep = getDepartureDate(b);
      return dep >= todayStr && dep <= d3Ahead;
    }).slice(0, 6);
  }, [metrics.upcomingDeparturesList, todayStr, d3Ahead]);

  // 4) Upcoming departures missing assignment
  const unassignedUpcoming = useMemo(() => {
    return metrics.upcomingDeparturesList.filter(b => {
      const key = b.bookingCode || b.id;
      return !operationalAssignments[key];
    }).slice(0, 5);
  }, [metrics.upcomingDeparturesList, operationalAssignments]);

  const totalNeedsAttentionCount = 
    paidUnconfirmed.length + 
    (unassignedUpcoming.length > 0 ? unassignedUpcoming.length : 0);

  return (
    <div className="space-y-8 text-left animate-fade-in">
      {/* SECTION 1: WELCOME & TIME CONTROL HEADER */}
      <div className={`${theme.innerCard} border rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-sm`}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-amber-500/10 text-amber-500 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
              <Activity className="h-3 w-3 animate-pulse" />
              Operational Control Center
            </span>
            {totalNeedsAttentionCount > 0 && (
              <span className="text-xs font-mono bg-rose-500/15 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold animate-pulse">
                {totalNeedsAttentionCount} Perlu Perhatian Segera
              </span>
            )}
          </div>
          <h2 className={`text-2xl font-black tracking-tight ${theme.textPrimary} font-sans`}>
            {(() => {
              const hours = liveTime.getHours();
              if (hours < 12) return 'Selamat Pagi';
              if (hours < 17) return 'Selamat Siang';
              return 'Selamat Malam';
            })()}, Admin Pusat
          </h2>
          <p className={`text-xs ${theme.textSecondary}`}>
            Pusat komando terpadu Smart Journey: memantau reservasi 5 layanan, audit pembayaran ArtoPay, dan penugasan armada real-time.
          </p>
        </div>
        
        <div className="flex items-center gap-3.5 text-xs font-bold font-mono">
          <span className="p-3 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Clock className="h-5 w-5 animate-spin-slow" />
          </span>
          <div>
            <span className={`${theme.textSecondary} block text-[9px] uppercase tracking-wider`}>WAKTU SISTEM KONTROL PUSAT</span>
            <div className="flex items-center gap-2 text-sm">
              <span className={`${theme.textPrimary} font-extrabold`}>
                {liveTime.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className={theme.textMuted}>|</span>
              <span className="text-amber-500 font-black">
                {liveTime.toLocaleTimeString('id-ID', { hour12: false })} WIB
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: ACTIONABLE "NEEDS ATTENTION" (TINDAKAN SEGERA ADMIN) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            <span>NEEDS ATTENTION · TINDAKAN SEGERA ADMIN (ACTIONABLE)</span>
          </span>
          <span className="text-[11px] font-mono text-neutral-400">
            Klik kartu untuk langsung menuju antrean data terkait
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Action Card 1: Paid BUT NOT Confirmed */}
          <div 
            onClick={() => onNavigate('orders', 'pending_confirmation')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              paidUnconfirmed.length > 0
                ? 'bg-amber-500/15 border-amber-500/50 hover:border-amber-400 shadow-md ring-1 ring-amber-500/20'
                : `${theme.innerCard} border-neutral-800 opacity-60`
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase font-bold text-amber-500 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                Lunas Menunggu Konfirmasi
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-black ${
                paidUnconfirmed.length > 0 ? 'bg-amber-500 text-neutral-950 animate-pulse' : 'bg-neutral-800 text-neutral-400'
              }`}>
                {paidUnconfirmed.length}
              </span>
            </div>
            <p className="text-xs font-bold text-neutral-100">
              {paidUnconfirmed.length > 0 
                ? `${paidUnconfirmed.length} pesanan telah lunas via ArtoPay tapi belum diverifikasi admin.`
                : 'Semua pembayaran lunas telah dikonfirmasi.'}
            </p>
            <span className="text-[10px] text-amber-500 font-bold block mt-2 hover:underline flex items-center gap-1">
              <span>Buka Antrean Konfirmasi</span>
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>

          {/* Action Card 2: Pending Payment */}
          <div 
            onClick={() => onNavigate('orders', 'pending_payment')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              metrics.pendingPaymentCount > 0
                ? 'bg-neutral-800/40 border-neutral-700 hover:border-neutral-500'
                : `${theme.innerCard} border-neutral-800 opacity-60`
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase font-bold text-neutral-400 flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5 text-amber-400" />
                Menunggu Pembayaran
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-neutral-800 text-neutral-300">
                {metrics.pendingPaymentCount}
              </span>
            </div>
            <p className="text-xs font-bold text-neutral-200">
              {metrics.pendingPaymentCount > 0
                ? `Rp ${metrics.pendingPaymentAmountIDR.toLocaleString('id-ID')} tagihan aktif belum diselesaikan.`
                : 'Tidak ada tagihan yang tertunda.'}
            </p>
            <span className="text-[10px] text-neutral-400 font-bold block mt-2 hover:underline flex items-center gap-1">
              <span>Lihat Daftar Tagihan</span>
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>

          {/* Action Card 3: Upcoming Nearest Departures */}
          <div 
            onClick={() => onNavigate('operations', 'departures')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              immediateDepartures.length > 0
                ? 'bg-sky-500/10 border-sky-500/40 hover:border-sky-400'
                : `${theme.innerCard} border-neutral-800 opacity-60`
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase font-bold text-sky-400 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Berangkat 72 Jam Kedepan
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-sky-500/20 text-sky-300">
                {immediateDepartures.length}
              </span>
            </div>
            <p className="text-xs font-bold text-neutral-200">
              {immediateDepartures.length > 0
                ? `${immediateDepartures.length} trip akan segera diberangkatkan dalam 3 hari ke depan.`
                : 'Tidak ada keberangkatan dalam 72 jam.'}
            </p>
            <span className="text-[10px] text-sky-400 font-bold block mt-2 hover:underline flex items-center gap-1">
              <span>Buka Jadwal Operasional</span>
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>

          {/* Action Card 4: Unassigned Upcoming Departures */}
          <div 
            onClick={() => onNavigate('operations', 'assignment')}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              unassignedUpcoming.length > 0
                ? 'bg-rose-500/10 border-rose-500/40 hover:border-rose-400 shadow-xs'
                : `${theme.innerCard} border-neutral-800 opacity-60`
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase font-bold text-rose-400 flex items-center gap-1">
                <UserCheck className="h-3.5 w-3.5" />
                Belum Ada Penugasan Kru
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-black ${
                unassignedUpcoming.length > 0 ? 'bg-rose-500 text-neutral-950 font-black' : 'bg-neutral-800 text-neutral-400'
              }`}>
                {unassignedUpcoming.length}
              </span>
            </div>
            <p className="text-xs font-bold text-neutral-200">
              {unassignedUpcoming.length > 0
                ? `${unassignedUpcoming.length} trip mendatang belum dialokasikan armada & driver.`
                : 'Seluruh armada & kru trip telah dialokasikan.'}
            </p>
            <span className="text-[10px] text-rose-400 font-bold block mt-2 hover:underline flex items-center gap-1">
              <span>Alokasikan Kru Sekarang</span>
              <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* Immediate Needs Attention Item List (if paidUnconfirmed has items) */}
        {paidUnconfirmed.length > 0 && (
          <div className={`${theme.card} border border-amber-500/40 rounded-2xl p-4 space-y-3 bg-amber-500/5`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-amber-500 uppercase flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" />
                Daftar Pesanan Lunas Membutuhkan Konfirmasi Segera ({paidUnconfirmed.length})
              </span>
              <button
                onClick={() => onNavigate('orders', 'pending_confirmation')}
                className="text-xs font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
              >
                <span>Lihat Semua di Orders</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {paidUnconfirmed.slice(0, 3).map((item) => (
                <div 
                  key={item.id} 
                  className={`p-3 rounded-xl ${theme.innerCard} border border-neutral-700/60 hover:border-amber-500 transition-all flex flex-col justify-between`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-black text-amber-500">
                        #{item.bookingCode}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        Paid ArtoPay
                      </span>
                    </div>
                    <div className="text-xs font-bold text-neutral-100 truncate" title={item.serviceTitle}>
                      {item.serviceTitle}
                    </div>
                    <div className="text-[11px] text-neutral-400 flex items-center justify-between">
                      <span>Tamu: <b className="text-neutral-200">{item.customerName}</b></span>
                      <span className="font-mono text-amber-400 font-bold">
                        Rp {Number(item.totalAmountIDR || 0).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 mt-2 border-t border-neutral-800 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-neutral-400">
                      Jadwal: {getDepartureDate(item) || '-'}
                    </span>
                    <button
                      onClick={() => onOpenDetail(item)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Konfirmasi</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 3: KEY PERFORMANCE INDICATORS (8 REAL METRICS) */}
      <div className="space-y-3">
        <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
          <Activity className="h-4 w-4 text-amber-500" />
          <span>RINGKASAN METRIK OPERASIONAL REAL-TIME</span>
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
          {/* 1. Total Orders */}
          <div 
            onClick={() => onNavigate('orders', 'all')}
            className={`p-5 rounded-2xl ${theme.card} border border-neutral-800/80 hover:border-amber-500/40 transition-all cursor-pointer space-y-2 shadow-xs`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                Total Orders Aktif
              </span>
              <ClipboardList className="h-4 w-4 text-neutral-500" />
            </div>
            <div className="text-2xl font-black font-mono text-neutral-100">
              {metrics.totalOrders} <span className="text-xs font-normal text-neutral-400">Pesanan</span>
            </div>
            <div className="text-[10px] font-mono text-neutral-500 flex items-center justify-between">
              <span>Semua 5 Layanan</span>
              <span className="text-amber-500 font-bold">Buka Orders →</span>
            </div>
          </div>

          {/* 2. Revenue Paid */}
          <div 
            onClick={() => onNavigate('finance', 'revenue')}
            className={`p-5 rounded-2xl ${theme.card} border border-neutral-800/80 hover:border-amber-500/40 transition-all cursor-pointer space-y-2 shadow-xs`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                Total Revenue Paid
              </span>
              <DollarSign className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black font-mono text-amber-500">
              Rp {metrics.totalRevenuePaidIDR.toLocaleString('id-ID')}
            </div>
            <div className="text-[10px] font-mono text-neutral-500 flex items-center justify-between">
              <span>{metrics.paidBookingsCount} Transaksi Lunas</span>
              <span className="text-amber-500 font-bold">Finance →</span>
            </div>
          </div>

          {/* 3. Paid Today */}
          <div 
            onClick={() => onNavigate('finance', 'payments')}
            className={`p-5 rounded-2xl ${theme.card} border border-neutral-800/80 hover:border-emerald-500/40 transition-all cursor-pointer space-y-2 shadow-xs`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                Paid Hari Ini
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400">
              {metrics.paidTodayCount} <span className="text-xs font-normal text-neutral-400">Transaksi</span>
            </div>
            <div className="text-[10px] font-mono text-neutral-500 flex items-center justify-between">
              <span>Rp {metrics.paidTodayRevenueIDR.toLocaleString('id-ID')}</span>
              <span className="text-emerald-400 font-bold">Audit →</span>
            </div>
          </div>

          {/* 4. Confirmed Today */}
          <div 
            onClick={() => onNavigate('orders', 'all')}
            className={`p-5 rounded-2xl ${theme.card} border border-neutral-800/80 hover:border-sky-500/40 transition-all cursor-pointer space-y-2 shadow-xs`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                Confirmed / Dibuat Hari Ini
              </span>
              <ShieldCheck className="h-4 w-4 text-sky-400" />
            </div>
            <div className="text-2xl font-black font-mono text-sky-400">
              {metrics.confirmedTodayCount} <span className="text-xs font-normal text-neutral-400">Pemesanan</span>
            </div>
            <div className="text-[10px] font-mono text-neutral-500 flex items-center justify-between">
              <span>Tanggal {todayStr}</span>
              <span className="text-sky-400 font-bold">Detail →</span>
            </div>
          </div>

          {/* 5. Pending Payment */}
          <div 
            onClick={() => onNavigate('orders', 'pending_payment')}
            className={`p-5 rounded-2xl ${theme.card} border border-neutral-800/80 hover:border-amber-500/40 transition-all cursor-pointer space-y-2 shadow-xs`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                Pending Payment
              </span>
              <CreditCard className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black font-mono text-amber-400">
              {metrics.pendingPaymentCount} <span className="text-xs font-normal text-neutral-400">Tagihan</span>
            </div>
            <div className="text-[10px] font-mono text-neutral-500 flex items-center justify-between">
              <span>Rp {metrics.pendingPaymentAmountIDR.toLocaleString('id-ID')}</span>
              <span className="text-amber-400 font-bold">Tagihan →</span>
            </div>
          </div>

          {/* 6. Pending Confirmation */}
          <div 
            onClick={() => onNavigate('orders', 'pending_confirmation')}
            className={`p-5 rounded-2xl ${theme.card} border border-neutral-800/80 hover:border-rose-500/40 transition-all cursor-pointer space-y-2 shadow-xs`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                Pending Confirmation
              </span>
              <AlertTriangle className="h-4 w-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black font-mono text-rose-400">
              {metrics.pendingConfirmationCount} <span className="text-xs font-normal text-neutral-400">Pesanan</span>
            </div>
            <div className="text-[10px] font-mono text-neutral-500 flex items-center justify-between">
              <span>Paid ≠ Confirmed</span>
              <span className="text-rose-400 font-bold">Proses →</span>
            </div>
          </div>

          {/* 7. Upcoming Departures */}
          <div 
            onClick={() => onNavigate('operations', 'departures')}
            className={`p-5 rounded-2xl ${theme.card} border border-neutral-800/80 hover:border-sky-500/40 transition-all cursor-pointer space-y-2 shadow-xs`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                Upcoming Departures
              </span>
              <Calendar className="h-4 w-4 text-sky-400" />
            </div>
            <div className="text-2xl font-black font-mono text-sky-400">
              {metrics.upcomingDeparturesCount} <span className="text-xs font-normal text-neutral-400">Trip</span>
            </div>
            <div className="text-[10px] font-mono text-neutral-500 flex items-center justify-between">
              <span>Mulai {todayStr}</span>
              <span className="text-sky-400 font-bold">Operasional →</span>
            </div>
          </div>

          {/* 8. Booking Volume (7 Hari Terakhir) */}
          <div 
            onClick={() => onNavigate('analytics')}
            className={`p-5 rounded-2xl ${theme.card} border border-neutral-800/80 hover:border-purple-500/40 transition-all cursor-pointer space-y-2 shadow-xs`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                Booking Volume (7H)
              </span>
              <TrendingUp className="h-4 w-4 text-purple-400" />
            </div>
            <div className="text-2xl font-black font-mono text-purple-400">
              {metrics.recent7DaysCount} <span className="text-xs font-normal text-neutral-400">Masuk</span>
            </div>
            <div className="text-[10px] font-mono text-neutral-500 flex items-center justify-between">
              <span>Tren Mingguan</span>
              <span className="text-purple-400 font-bold">Analytics →</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: BREAKDOWN 5 LAYANAN TERPADU */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-mono font-extrabold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              <span>PORTOFOLIO &amp; KONTRIBUSI 5 DIVISI LAYANAN</span>
            </h3>
            <p className="text-[11px] text-neutral-400">
              Peta volume pemesanan, pendapatan lunas, dan jadwal keberangkatan untuk setiap layanan resmi.
            </p>
          </div>
          <button
            onClick={() => onNavigate('analytics')}
            className="text-xs font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
          >
            <span>Analitik Lengkap</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {serviceBreakdown.map((srv) => {
            const Icon = srv.icon;
            return (
              <div
                key={srv.id}
                onClick={() => onNavigate('orders', 'all', srv.id)}
                className={`p-4 rounded-2xl ${theme.card} border border-neutral-800/80 hover:border-amber-500/40 transition-all cursor-pointer space-y-3 flex flex-col justify-between shadow-xs`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`p-2 rounded-xl ${srv.bg} ${srv.color} border ${srv.border}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] font-mono font-bold text-neutral-400">
                      {srv.totalBookings} Booking
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-neutral-100">{srv.name}</h4>
                    <div className="text-sm font-black font-mono text-amber-500 mt-1">
                      Rp {srv.revenueIDR.toLocaleString('id-ID')}
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {srv.paidCount} Terbayar Lunas
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] font-mono text-neutral-400">
                  <span>{srv.upcomingCount} Trip Aktif</span>
                  <span className="text-amber-500 font-bold flex items-center gap-0.5">
                    Orders <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 5: REAL RECENT BOOKINGS AUDIT FEED */}
      <div className={`${theme.card} border rounded-2xl overflow-hidden shadow-sm`}>
        <div className="p-4 border-b border-neutral-700/40 flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-xs font-black uppercase tracking-wider font-mono text-neutral-200 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-amber-500" />
              <span>LOG AKTIVITAS OPERASIONAL &amp; PEMESANAN TERBARU</span>
            </h4>
            <p className="text-[11px] text-neutral-400">
              Transaksi nyata yang baru saja dicatat pada platform Smart Journey lintas seluruh 5 layanan.
            </p>
          </div>
          <button
            onClick={() => onNavigate('orders', 'all')}
            className="text-xs font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
          >
            <span>Buka Semua Pesanan ({bookings.length})</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase text-neutral-400 font-bold`}>
              <tr>
                <th className="p-3.5">Kode Transaksi</th>
                <th className="p-3.5">Layanan</th>
                <th className="p-3.5">Tamu Utama</th>
                <th className="p-3.5">Keberangkatan</th>
                <th className="p-3.5 text-right">Nilai Tagihan</th>
                <th className="p-3.5 text-center">Status Bayar</th>
                <th className="p-3.5 text-center">Status Booking</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/40">
              {bookings.slice(0, 8).map((b) => {
                const isPaid = (b.paymentStatus || '').toLowerCase() === 'paid';
                const isConfirmed = b.bookingStatus === 'Confirmed' || b.bookingStatus === 'Completed';

                return (
                  <tr key={b.id} className={`${theme.hover} transition-colors`}>
                    <td className="p-3.5 font-mono font-bold text-amber-500">
                      #{b.bookingCode}
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-neutral-200 block truncate max-w-[170px]" title={b.serviceTitle}>
                        {b.serviceTitle}
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500 uppercase">
                        {b.serviceType}
                      </span>
                    </td>
                    <td className="p-3.5 font-bold text-neutral-100">
                      <div>{b.customerName}</div>
                      <div className="text-[10px] font-mono text-neutral-500">{b.customerPhone || '-'}</div>
                    </td>
                    <td className="p-3.5 font-mono text-neutral-300 text-[11px]">
                      {getDepartureDate(b) || '-'} {b.time ? `• ${b.time}` : ''}
                    </td>
                    <td className="p-3.5 font-mono font-black text-right text-neutral-100">
                      Rp {Number(b.totalAmountIDR || 0).toLocaleString('id-ID')}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        isPaid 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {b.paymentStatus || 'Pending'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        isConfirmed
                          ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                          : b.bookingStatus === 'Cancelled'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                      }`}>
                        {b.bookingStatus || 'Pending'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => onOpenDetail(b)}
                        className="px-2.5 py-1 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 font-bold text-[11px] cursor-pointer"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

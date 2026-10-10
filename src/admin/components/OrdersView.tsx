import React, { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardList, Download, Search, Check, ShieldCheck, 
  AlertTriangle, CheckCircle2, Clock, Filter, Eye, AlertCircle, FileText,
  Calendar, RotateCcw, ArrowUpDown, X, Plane, Car, Compass, Users, MapPin, Ban
} from 'lucide-react';
import { UnifiedBookingDetail } from '../../components/admin/BookingDetailModal';

export type OrdersTabType = 'all' | 'pending_payment' | 'pending_confirmation' | 'confirmed' | 'completed' | 'cancelled';
export type ServiceChannelFilter = 'all' | 'gathering' | 'tour' | 'sharetour' | 'airport' | 'taxi' | 'car-rental';
export type PaymentStatusFilter = 'all' | 'Pending' | 'Paid';
export type BookingStatusFilter = 'all' | 'Pending Payment' | 'Pending Confirmation' | 'Confirmed' | 'Completed' | 'Cancelled';
export type DatePresetFilter = 'all' | 'today' | 'tomorrow' | 'next7days' | 'thisMonth' | 'custom';
export type SortOption = 'newest' | 'oldest' | 'departure_asc' | 'departure_desc' | 'price_desc' | 'price_asc';

interface OrdersViewProps {
  bookings: UnifiedBookingDetail[];
  activeTab: OrdersTabType;
  setActiveTab: (tab: OrdersTabType) => void;
  onOpenDetail: (booking: UnifiedBookingDetail) => void;
  onConfirmBooking: (id: string, source: 'main' | 'sharetour') => void;
  onCompleteBooking: (id: string, source: 'main' | 'sharetour') => void;
  onCancelBooking?: (id: string, source: 'main' | 'sharetour') => void;
  formatPrice: (usd: number, idr: number) => string;
  theme: any;
  isDark?: boolean;
  triggerToast: (msg: string) => void;
}

export default function OrdersView({
  bookings,
  activeTab,
  setActiveTab,
  onOpenDetail,
  onConfirmBooking,
  onCompleteBooking,
  onCancelBooking,
  formatPrice,
  theme,
  isDark = false,
  triggerToast
}: OrdersViewProps) {
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState<ServiceChannelFilter>('all');
  const [dateFilter, setDateFilter] = useState<DatePresetFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>('all');
  const [bookingStatusFilter, setBookingStatusFilter] = useState<BookingStatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // When activeTab changes (e.g. from Dashboard or Sidebar to pending_confirmation),
  // reset conflicting status filters so the tab items are immediately visible
  useEffect(() => {
    if (activeTab !== 'all') {
      setBookingStatusFilter('all');
      setPaymentStatusFilter('all');
    }
  }, [activeTab]);

  // Tab counts calculation
  const counts = useMemo(() => {
    return {
      all: bookings.length,
      pending_payment: bookings.filter(b => {
        const isPaid = (b.paymentStatus || '').toLowerCase() === 'paid';
        const isCancelled = b.bookingStatus === 'Cancelled' || b.bookingStatus === 'Rejected';
        return !isPaid && !isCancelled;
      }).length,
      pending_confirmation: bookings.filter(b => {
        const isPaid = (b.paymentStatus || '').toLowerCase() === 'paid';
        const isConfirmed = b.bookingStatus === 'Confirmed';
        const isCompleted = b.bookingStatus === 'Completed';
        const isCancelled = b.bookingStatus === 'Cancelled' || b.bookingStatus === 'Rejected';
        return b.bookingStatus === 'Pending Confirmation' || 
          (b.bookingStatus === 'Pending' && isPaid) ||
          (isPaid && !isConfirmed && !isCompleted && !isCancelled);
      }).length,
      confirmed: bookings.filter(b => b.bookingStatus === 'Confirmed').length,
      completed: bookings.filter(b => b.bookingStatus === 'Completed').length,
      cancelled: bookings.filter(b => b.bookingStatus === 'Cancelled' || b.bookingStatus === 'Rejected').length
    };
  }, [bookings]);

  // Financial summary counters for quick insights
  const quickStats = useMemo(() => {
    // Canonical rule: Realized Revenue = paymentStatus === 'Paid' AND bookingStatus !== 'Cancelled' AND bookingStatus !== 'Rejected'
    const totalRevenueIDR = bookings
      .filter(b => 
        (b.paymentStatus === 'Paid' || (b.paymentStatus || '').toLowerCase() === 'paid') && 
        b.bookingStatus !== 'Cancelled' && 
        b.bookingStatus !== 'Rejected'
      )
      .reduce((sum, b) => sum + (Number(b.totalAmountIDR) || 0), 0);

    const pendingConfirmationCount = counts.pending_confirmation;
    const pendingPaymentCount = counts.pending_payment;
    const completedCount = counts.completed;

    return { totalRevenueIDR, pendingConfirmationCount, pendingPaymentCount, completedCount };
  }, [bookings, counts]);

  // Date helper for filtering
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().slice(0, 10);

  const next7DaysDate = new Date();
  next7DaysDate.setDate(next7DaysDate.getDate() + 7);
  const next7DaysStr = next7DaysDate.toISOString().slice(0, 10);

  const currentYear = now.getFullYear();
  const currentMonthStr = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Master Filter & Sort Logic
  const filteredBookings = useMemo(() => {
    return bookings.filter(item => {
      const isPaid = (item.paymentStatus || '').toLowerCase() === 'paid';
      const isConfirmed = item.bookingStatus === 'Confirmed';
      const isCompleted = item.bookingStatus === 'Completed';
      const isCancelled = item.bookingStatus === 'Cancelled' || item.bookingStatus === 'Rejected';
      const isPendingConfirmation = 
        item.bookingStatus === 'Pending Confirmation' || 
        (item.bookingStatus === 'Pending' && isPaid) ||
        (isPaid && !isConfirmed && !isCompleted && !isCancelled);

      // 1. Tab Status Filter
      if (activeTab === 'pending_payment') {
        const isUnpaid = !isPaid && !isCancelled;
        if (!isUnpaid) return false;
      } else if (activeTab === 'pending_confirmation') {
        if (!isPendingConfirmation) return false;
      } else if (activeTab === 'confirmed') {
        if (!isConfirmed) return false;
      } else if (activeTab === 'completed') {
        if (!isCompleted) return false;
      } else if (activeTab === 'cancelled') {
        if (!isCancelled) return false;
      }

      // 2. Service Filter
      if (serviceFilter !== 'all') {
        if (serviceFilter === 'gathering' && item.serviceType !== 'gathering' && item.serviceType !== 'event-gathering') return false;
        if (serviceFilter === 'tour' && item.serviceType !== 'tour') return false;
        if (serviceFilter === 'sharetour' && item.serviceType !== 'sharetour') return false;
        if (serviceFilter === 'airport' && item.serviceType !== 'airport') return false;
        if (serviceFilter === 'taxi' && item.serviceType !== 'taxi') return false;
        if (serviceFilter === 'car-rental' && item.serviceType !== 'car-rental' && item.serviceType !== 'rental') return false;
      }

      // 3. Payment Status Filter (Dropdown)
      if (paymentStatusFilter !== 'all') {
        if (paymentStatusFilter === 'Paid' && !isPaid) return false;
        if (paymentStatusFilter === 'Pending' && isPaid) return false;
      }

      // 4. Booking Status Filter (Dropdown)
      if (bookingStatusFilter !== 'all') {
        if (bookingStatusFilter === 'Pending Payment' && (isPaid || isCancelled)) return false;
        if (bookingStatusFilter === 'Pending Confirmation' && !isPendingConfirmation) return false;
        if (bookingStatusFilter === 'Confirmed' && !isConfirmed) return false;
        if (bookingStatusFilter === 'Completed' && !isCompleted) return false;
        if (bookingStatusFilter === 'Cancelled' && !isCancelled) return false;
      }

      // 5. Date Filter (using departureDate / date)
      const opDate = (item.departureDate || item.date || '').slice(0, 10);
      if (dateFilter !== 'all' && opDate) {
        if (dateFilter === 'today' && opDate !== todayStr) return false;
        if (dateFilter === 'tomorrow' && opDate !== tomorrowStr) return false;
        if (dateFilter === 'next7days' && (opDate < todayStr || opDate > next7DaysStr)) return false;
        if (dateFilter === 'thisMonth' && !opDate.startsWith(currentMonthStr)) return false;
        if (dateFilter === 'custom') {
          if (customStartDate && opDate < customStartDate) return false;
          if (customEndDate && opDate > customEndDate) return false;
        }
      }

      // 6. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match = 
          (item.bookingCode || '').toLowerCase().includes(q) ||
          (item.id || '').toLowerCase().includes(q) ||
          (item.customerName || '').toLowerCase().includes(q) ||
          (item.customerPhone || '').toLowerCase().includes(q) ||
          (item.customerEmail || '').toLowerCase().includes(q) ||
          (item.serviceTitle || '').toLowerCase().includes(q) ||
          (item.flightNumber || '').toLowerCase().includes(q) ||
          (item.vehicleName || '').toLowerCase().includes(q) ||
          (item.pickupLocation || '').toLowerCase().includes(q) ||
          (item.dropoffLocation || '').toLowerCase().includes(q);

        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort logic
      if (sortBy === 'newest') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (sortBy === 'departure_asc') {
        const dateA = a.departureDate || a.date || '';
        const dateB = b.departureDate || b.date || '';
        return dateA.localeCompare(dateB);
      }
      if (sortBy === 'departure_desc') {
        const dateA = a.departureDate || a.date || '';
        const dateB = b.departureDate || b.date || '';
        return dateB.localeCompare(dateA);
      }
      if (sortBy === 'price_desc') {
        return (Number(b.totalAmountIDR) || 0) - (Number(a.totalAmountIDR) || 0);
      }
      if (sortBy === 'price_asc') {
        return (Number(a.totalAmountIDR) || 0) - (Number(b.totalAmountIDR) || 0);
      }
      return 0;
    });
  }, [
    bookings, 
    activeTab, 
    serviceFilter, 
    paymentStatusFilter, 
    bookingStatusFilter, 
    dateFilter, 
    customStartDate, 
    customEndDate, 
    searchQuery, 
    sortBy, 
    todayStr, 
    tomorrowStr, 
    next7DaysStr, 
    currentMonthStr
  ]);

  // Check if any filter is actively applied beyond defaults
  const isFilterActive = 
    searchQuery.trim() !== '' || 
    serviceFilter !== 'all' || 
    dateFilter !== 'all' || 
    paymentStatusFilter !== 'all' || 
    bookingStatusFilter !== 'all' || 
    sortBy !== 'newest';

  const resetAllFilters = () => {
    setSearchQuery('');
    setServiceFilter('all');
    setDateFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setPaymentStatusFilter('all');
    setBookingStatusFilter('all');
    setSortBy('newest');
    triggerToast('Semua filter berhasil direset ke default.');
  };

  const handleExportCSV = () => {
    const csvRows = [
      [
        'Kode Booking',
        'Layanan',
        'Judul Layanan / Produk',
        'Nama Pelanggan',
        'Telepon',
        'Email',
        'Tanggal Keberangkatan / Operasional',
        'Waktu',
        'Pax',
        'Total IDR',
        'Total USD',
        'Status Pembayaran (paymentStatus)',
        'Status Booking (bookingStatus)',
        'Dibuat Pada'
      ]
    ];

    filteredBookings.forEach(b => {
      csvRows.push([
        `"${b.bookingCode}"`,
        `"${b.serviceType}"`,
        `"${(b.serviceTitle || '').replace(/"/g, '""')}"`,
        `"${(b.customerName || '').replace(/"/g, '""')}"`,
        `"${b.customerPhone || ''}"`,
        `"${b.customerEmail || ''}"`,
        `"${b.departureDate || b.date || '-'}"`,
        `"${b.time || '-'}"`,
        `"${b.passengers}"`,
        `"${b.totalAmountIDR || 0}"`,
        `"${b.totalAmountUSD || 0}"`,
        `"${b.paymentStatus}"`,
        `"${b.bookingStatus}"`,
        `"${b.createdAt || '-'}"`
      ]);
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + csvRows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smartjourney_orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Laporan CSV Pemesanan berhasil diunduh.');
  };

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* 1. TITLE & QUICK STATS HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30">
              <ClipboardList className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-black tracking-tight font-sans">
                PUSAT PESANAN &amp; TRANSAKSI (ORDERS CENTER)
              </h2>
              <p className={`text-xs ${theme.textSecondary}`}>
                Manajemen terpadu 5 layanan: Private Tour, Open Trip, Airport Transfer, Taxi, dan Car Rental.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isFilterActive && (
            <button
              onClick={resetAllFilters}
              className={`px-3.5 py-2 rounded-xl border ${
                isDark 
                  ? 'border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 hover:text-white' 
                  : 'border-slate-300 hover:bg-slate-100 text-slate-700 hover:text-slate-900 bg-white'
              } font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer`}
              title="Reset semua filter ke kondisi awal"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Filter</span>
            </button>
          )}

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV Orders ({filteredBookings.length})</span>
          </button>
        </div>
      </div>

      {/* 2. SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`${theme.card} border rounded-xl p-3 space-y-1 shadow-xs`}>
          <span className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-600'} uppercase font-bold block`}>
            Total Seluruh Pesanan
          </span>
          <div className={`text-lg font-black font-mono ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
            {counts.all} <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-600'} font-normal`}>booking</span>
          </div>
        </div>

        <div className={`${theme.card} border rounded-xl p-3 space-y-1 shadow-xs`}>
          <span className={`text-[10px] font-mono ${isDark ? 'text-amber-500' : 'text-amber-700'} uppercase font-bold block`}>
            Menunggu Pembayaran
          </span>
          <div className={`text-lg font-black font-mono ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
            {counts.pending_payment} <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-600'} font-normal`}>unpaid</span>
          </div>
        </div>

        <div className={`${theme.card} border rounded-xl p-3 space-y-1 shadow-xs ${counts.pending_confirmation > 0 ? 'border-cyan-500/40 bg-cyan-500/5' : ''}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold block">
              Menunggu Konfirmasi
            </span>
            {counts.pending_confirmation > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-cyan-500 text-neutral-950 font-bold animate-pulse">
                PERLU AKSI
              </span>
            )}
          </div>
          <div className="text-lg font-black font-mono text-cyan-400">
            {counts.pending_confirmation} <span className="text-xs text-neutral-500 font-normal">siap dikonfirmasi</span>
          </div>
        </div>

        <div className={`${theme.card} border rounded-xl p-3 space-y-1 shadow-xs`}>
          <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold block">
            Total Omzet Lunas
          </span>
          <div className="text-lg font-black font-mono text-emerald-400 truncate">
            Rp {Number(quickStats.totalRevenueIDR).toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* 3. STATUS TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-neutral-700/40 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'all' as const, label: 'All Orders', count: counts.all, alert: false },
          { id: 'pending_payment' as const, label: 'Pending Payment', count: counts.pending_payment, alert: false },
          { id: 'pending_confirmation' as const, label: 'Pending Confirmation', count: counts.pending_confirmation, alert: counts.pending_confirmation > 0 },
          { id: 'confirmed' as const, label: 'Confirmed', count: counts.confirmed, alert: false },
          { id: 'completed' as const, label: 'Completed', count: counts.completed, alert: false },
          { id: 'cancelled' as const, label: 'Cancelled', count: counts.cancelled, alert: false }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? isDark
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 font-extrabold shadow-xs'
                    : 'bg-amber-500/15 border border-amber-500/30 text-amber-700 font-extrabold shadow-xs'
                  : isDark
                    ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border border-transparent'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-transparent'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                tab.alert 
                  ? 'bg-cyan-500 text-neutral-950 font-black animate-pulse' 
                  : isActive
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'bg-neutral-500/15 text-neutral-400'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 4. COMPREHENSIVE FILTER & SEARCH CONTROLS */}
      <div className={`${theme.card} border rounded-2xl p-4 space-y-4 shadow-sm`}>
        {/* Row 1: Search + Service Channel Pills */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-grow max-w-lg">
            <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode booking, nama customer, telepon, email, rute, armada, flight..."
              className={`w-full ${theme.input} pl-10 pr-9 py-2 rounded-xl text-xs focus:outline-none focus:border-amber-500 border`}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${
                  isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-800'
                } transition-colors cursor-pointer`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Service Channel Selector Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-mono text-neutral-400 font-bold uppercase shrink-0 mr-1">
              Layanan:
            </span>
            {[
              { id: 'all' as const, label: 'Semua Layanan' },
              { id: 'gathering' as const, label: 'Event & Gathering' },
              { id: 'tour' as const, label: 'Private Tour' },
              { id: 'sharetour' as const, label: 'Open Trip' },
              { id: 'airport' as const, label: 'Airport Transfer' },
              { id: 'taxi' as const, label: 'Taxi' },
              { id: 'car-rental' as const, label: 'Car Rental' }
            ].map((ch) => (
              <button
                key={ch.id}
                onClick={() => setServiceFilter(ch.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  serviceFilter === ch.id
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-500 font-bold'
                    : isDark ? 'text-neutral-400 hover:text-neutral-200' : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Secondary Dropdown Filters (Tanggal, paymentStatus, bookingStatus, Sort) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-neutral-800/40">
          {/* Date Filter Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-neutral-400 uppercase font-bold flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Filter Tanggal</span>
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DatePresetFilter)}
              className={`w-full ${theme.input} py-2 px-3 rounded-xl text-xs focus:outline-none focus:border-amber-500 border cursor-pointer`}
            >
              <option value="all">Semua Tanggal</option>
              <option value="today">Hari Ini</option>
              <option value="tomorrow">Besok</option>
              <option value="next7days">7 Hari Ke Depan</option>
              <option value="thisMonth">Bulan Ini</option>
              <option value="custom">Rentang Tanggal Kustom...</option>
            </select>
          </div>

          {/* paymentStatus Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-neutral-400 uppercase font-bold flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Status Bayar (paymentStatus)</span>
            </label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value as PaymentStatusFilter)}
              className={`w-full ${theme.input} py-2 px-3 rounded-xl text-xs focus:outline-none focus:border-amber-500 border cursor-pointer`}
            >
              <option value="all">Semua Status Bayar</option>
              <option value="Pending">Pending (Belum Bayar)</option>
              <option value="Paid">Paid (Sudah Bayar Lunas)</option>
            </select>
          </div>

          {/* bookingStatus Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-neutral-400 uppercase font-bold flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              <span>Status Booking (bookingStatus)</span>
            </label>
            <select
              value={bookingStatusFilter}
              onChange={(e) => setBookingStatusFilter(e.target.value as BookingStatusFilter)}
              className={`w-full ${theme.input} py-2 px-3 rounded-xl text-xs focus:outline-none focus:border-amber-500 border cursor-pointer`}
            >
              <option value="all">Semua Status Booking</option>
              <option value="Pending Payment">Pending Payment</option>
              <option value="Pending Confirmation">Pending Confirmation</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-neutral-400 uppercase font-bold flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3" />
              <span>Urutan (Sort)</span>
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className={`w-full ${theme.input} py-2 px-3 rounded-xl text-xs focus:outline-none focus:border-amber-500 border cursor-pointer`}
            >
              <option value="newest">Terbaru Dibuat (Default)</option>
              <option value="oldest">Terlama Dibuat</option>
              <option value="departure_asc">Tanggal Operasional (Terdekat)</option>
              <option value="departure_desc">Tanggal Operasional (Terjauh)</option>
              <option value="price_desc">Nominal Tertinggi (Highest)</option>
              <option value="price_asc">Nominal Terendah (Lowest)</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Picker when dateFilter === 'custom' */}
        {dateFilter === 'custom' && (
          <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 flex flex-wrap items-center gap-3 animate-fade-in text-xs">
            <span className="text-neutral-400 font-mono font-bold">Pilih Rentang Tanggal:</span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className={`${theme.input} py-1.5 px-3 rounded-lg text-xs border`}
              />
              <span className="text-neutral-500">s/d</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className={`${theme.input} py-1.5 px-3 rounded-lg text-xs border`}
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                className={`${isDark ? 'text-neutral-400 hover:text-amber-400' : 'text-neutral-600 hover:text-amber-700'} text-[11px] underline cursor-pointer`}
              >
                Hapus Rentang
              </button>
            )}
          </div>
        )}

        {/* Active Filter Tags Bar */}
        {isFilterActive && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
            <span className="text-neutral-400 font-mono font-semibold">Filter Aktif:</span>
            {searchQuery && (
              <span className={`px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 ${isDark ? 'text-amber-400' : 'text-amber-800'} font-mono flex items-center gap-1`}>
                Pencarian: "{searchQuery}"
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery('')} />
              </span>
            )}
            {serviceFilter !== 'all' && (
              <span className={`px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 ${isDark ? 'text-amber-400' : 'text-amber-800'} font-mono flex items-center gap-1`}>
                Layanan: {serviceFilter}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setServiceFilter('all')} />
              </span>
            )}
            {dateFilter !== 'all' && (
              <span className={`px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 ${isDark ? 'text-amber-400' : 'text-amber-800'} font-mono flex items-center gap-1`}>
                Tanggal: {dateFilter}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setDateFilter('all')} />
              </span>
            )}
            {paymentStatusFilter !== 'all' && (
              <span className={`px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 ${isDark ? 'text-amber-400' : 'text-amber-800'} font-mono flex items-center gap-1`}>
                Bayar: {paymentStatusFilter}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setPaymentStatusFilter('all')} />
              </span>
            )}
            {bookingStatusFilter !== 'all' && (
              <span className={`px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 ${isDark ? 'text-amber-400' : 'text-amber-800'} font-mono flex items-center gap-1`}>
                Booking: {bookingStatusFilter}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setBookingStatusFilter('all')} />
              </span>
            )}
            {sortBy !== 'newest' && (
              <span className={`px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 ${isDark ? 'text-amber-400' : 'text-amber-800'} font-mono flex items-center gap-1`}>
                Urutan: {sortBy}
                <X className="h-3 w-3 cursor-pointer" onClick={() => setSortBy('newest')} />
              </span>
            )}
            <button
              onClick={resetAllFilters}
              className={`${isDark ? 'text-amber-400' : 'text-amber-800'} hover:underline font-bold underline ml-1 cursor-pointer`}
            >
              Hapus Semua
            </button>
          </div>
        )}
      </div>

      {/* 5. MASTER ORDERS TABLE */}
      <div className={`${theme.card} border rounded-2xl overflow-hidden shadow-sm`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase ${isDark ? 'text-neutral-400' : 'text-neutral-700'} font-bold`}>
              <tr>
                <th className="p-3.5">Kode Booking</th>
                <th className="p-3.5">Layanan</th>
                <th className="p-3.5">Produk / Rute</th>
                <th className="p-3.5">Pelanggan</th>
                <th className="p-3.5">Tgl Keberangkatan / Operasional</th>
                <th className="p-3.5 text-center">Pax</th>
                <th className="p-3.5 text-right">Total Transaksi</th>
                <th className="p-3.5 text-center">paymentStatus</th>
                <th className="p-3.5 text-center">bookingStatus</th>
                <th className="p-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? 'divide-neutral-800/40' : 'divide-neutral-200'}`}>
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-neutral-500 font-mono space-y-2">
                    <p className="text-sm">Tidak ada pesanan yang sesuai dengan filter yang dipilih.</p>
                    {isFilterActive && (
                      <button
                        onClick={resetAllFilters}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isDark
                            ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                        }`}
                      >
                        Reset Filter
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredBookings.map((item) => {
                  const isPaid = (item.paymentStatus || '').toLowerCase() === 'paid';
                  const isConfirmed = item.bookingStatus === 'Confirmed';
                  const isCompleted = item.bookingStatus === 'Completed';
                  const isCancelled = item.bookingStatus === 'Cancelled' || item.bookingStatus === 'Rejected';
                  const isPendingConfirmation = 
                    item.bookingStatus === 'Pending Confirmation' || 
                    (item.bookingStatus === 'Pending' && isPaid);

                  // Payment Verification: verify that final payment amount matches base price - discount + unique code
                  const raw = item.rawBooking || {};
                  const disc = Number(item.discount ?? raw.discount ?? (raw.details?.discountAmount || 0));
                  const unique = Number(item.uniqueCode ?? raw.unique_code ?? raw.uniqueCode ?? 0);
                  let base = Number(item.baseAmount ?? raw.base_amount ?? raw.baseAmount ?? 0);
                  if (!base || base <= 0) {
                    const netBase = Number(item.totalAmountIDR ?? raw.total_price_idr ?? raw.totalPriceIDR ?? (item as any).totalPrice ?? 0);
                    base = (netBase > 0 && disc > 0) ? (netBase + disc) : netBase;
                  }
                  const finalAmt = 
                    Number(item.finalPaymentAmount ?? item.paymentAmount ?? raw.payment_amount ?? raw.paymentAmount ?? item.totalAmountIDR ?? raw.total_price_idr ?? 0) ||
                    (base > 0 ? (Math.max(0, base - disc) + unique) : 0);
                  const expectedAmt = base > 0 ? (Math.max(0, base - disc) + unique) : finalAmt;
                  const isAmountMatched = Math.abs(finalAmt - expectedAmt) <= 1;
                  const isPaymentVerified = isPaid && isAmountMatched;

                  // Official departure date for Open Trip, otherwise date
                  const officialDate = item.departureDate || item.date || '-';

                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => onOpenDetail(item)}
                      className={`${theme.hover} transition-colors cursor-pointer`}
                    >
                      {/* Booking Code */}
                      <td className="p-3.5 font-mono font-bold text-amber-500 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>#{item.bookingCode}</span>
                          {item.source === 'sharetour' && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                              OT
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Service Badge (All Services) */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          item.serviceType === 'gathering' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' :
                          item.serviceType === 'tour' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                          item.serviceType === 'sharetour' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                          item.serviceType === 'airport' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                          item.serviceType === 'taxi' ? 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20' :
                          'bg-purple-500/10 text-purple-500 border border-purple-500/20'
                        }`}>
                          {item.serviceType === 'gathering' ? 'Event & Gathering' :
                           item.serviceType === 'tour' ? 'Private Tour' :
                           item.serviceType === 'sharetour' ? 'Open Trip' :
                           item.serviceType === 'airport' ? 'Airport Transfer' :
                           item.serviceType === 'taxi' ? 'Taxi' : 'Car Rental'}
                        </span>
                      </td>

                      {/* Product Title / Route */}
                      <td className={`p-3.5 font-semibold ${isDark ? 'text-neutral-200' : 'text-neutral-900'} max-w-[200px] truncate`} title={item.serviceTitle}>
                        <div className="truncate font-bold">{item.serviceTitle}</div>
                        {item.flightNumber && (
                          <div className={`text-[10px] ${isDark ? 'text-amber-400' : 'text-amber-800'} font-mono`}>Flight: {item.flightNumber}</div>
                        )}
                        {item.vehicleName && item.serviceType !== 'tour' && (
                          <div className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-600'} font-mono`}>{item.vehicleName}</div>
                        )}
                      </td>

                      {/* Customer Info */}
                      <td className="p-3.5">
                        <div className={`font-bold ${isDark ? 'text-neutral-200' : 'text-neutral-900'}`}>{item.customerName}</div>
                        <div className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-600'} font-mono`}>{item.customerPhone}</div>
                      </td>

                      {/* Official Date (departureDate prioritized for Open Trip) */}
                      <td className={`p-3.5 font-mono ${isDark ? 'text-neutral-300' : 'text-neutral-800'} whitespace-nowrap`}>
                        <span className={item.serviceType === 'sharetour' ? (isDark ? 'font-bold text-emerald-400' : 'font-bold text-emerald-700') : ''}>
                          {officialDate}
                        </span>
                        {item.time ? ` · ${item.time}` : ''}
                      </td>

                      {/* Passengers */}
                      <td className={`p-3.5 font-mono ${isDark ? 'text-neutral-300' : 'text-neutral-800'} text-center whitespace-nowrap`}>
                        {item.passengers}
                      </td>

                      {/* Total Transaksi */}
                      <td className={`p-3.5 font-mono font-black text-right ${isDark ? 'text-neutral-100' : 'text-neutral-900'} whitespace-nowrap`}>
                        {item.totalAmountIDR 
                          ? `Rp ${Number(item.totalAmountIDR).toLocaleString('id-ID')}`
                          : (item.totalAmountUSD ? formatPrice(item.totalAmountUSD, item.totalAmountIDR || 0) : '-')}
                      </td>

                      {/* Mandatory Status Separation: 1. paymentStatus with verification match indicator */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                            isPaid 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                              : (isDark 
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse' 
                                  : 'bg-amber-500/15 text-amber-800 border border-amber-500/40 animate-pulse')
                          }`}>
                            {isPaid ? 'Paid' : (item.paymentStatus || 'Pending')}
                          </span>
                          {isPaid && (
                            <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                              isAmountMatched
                                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-600/40'
                                : 'bg-rose-950/40 text-rose-400 border-rose-600/40'
                            }`} title={isAmountMatched ? `Nominal final dan kode unik (+Rp ${unique}) cocok sempurna` : 'Ketidakcocokan nominal final dan kode unik'}>
                              {isAmountMatched ? '✓ Match' : '⚠ Mismatch'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Mandatory Status Separation: 2. bookingStatus */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                          isConfirmed ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' :
                          isCompleted ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' :
                          isCancelled ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' :
                          isPendingConfirmation ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 animate-pulse' :
                          (isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-amber-500/15 text-amber-800 border border-amber-500/40')
                        }`}>
                          {isPendingConfirmation ? 'Pending Confirmation' : item.bookingStatus}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="p-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Open Detail Eye */}
                          <button
                            onClick={() => onOpenDetail(item)}
                            className={`p-1.5 rounded-lg border ${
                              isDark
                                ? 'border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 hover:text-white'
                                : 'border-slate-300 hover:bg-slate-100 text-slate-700 hover:text-slate-900 bg-white'
                            } transition-all cursor-pointer`}
                            title="Buka Booking Detail Terpadu"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {/* Quick Confirm button: strictly only if isPaymentVerified (isPaid AND isAmountMatched) */}
                          {!isConfirmed && !isCompleted && !isCancelled && (
                            <button
                              disabled={!isPaymentVerified}
                              onClick={() => {
                                if (!isPaid) {
                                  triggerToast('Gagal: Admin hanya boleh konfirmasi jika status pembayaran sudah "Paid".');
                                  return;
                                }
                                if (!isAmountMatched) {
                                  triggerToast('Gagal: Verifikasi pembayaran gagal karena ketidakcocokan nominal final dan kode unik.');
                                  return;
                                }
                                onConfirmBooking(item.id, item.source);
                              }}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isPaymentVerified
                                  ? (isDark 
                                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 cursor-pointer shadow-xs' 
                                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300 cursor-pointer shadow-xs')
                                  : (isDark 
                                      ? 'bg-neutral-850 text-neutral-600 border-neutral-800 cursor-not-allowed opacity-50' 
                                      : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50')
                              }`}
                              title={
                                !isPaid 
                                  ? 'Admin hanya boleh konfirmasi jika status pembayaran sudah Paid'
                                  : !isAmountMatched
                                    ? 'Admin tidak boleh konfirmasi jika nominal final dan kode unik tidak cocok'
                                    : 'Verifikasi Pembayaran & Konfirmasi Booking'
                              }
                            >
                              <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                            </button>
                          )}

                          {/* Quick Complete button */}
                          {isConfirmed && !isCompleted && (
                            <button
                              onClick={() => onCompleteBooking(item.id, item.source)}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isDark
                                  ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/30'
                                  : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-300'
                              } cursor-pointer`}
                              title="Tandai Selesai (Completed)"
                            >
                              <ShieldCheck className="h-3.5 w-3.5 stroke-[2.5]" />
                            </button>
                          )}

                          {/* Quick Cancel button */}
                          {!isCompleted && !isCancelled && onCancelBooking && (
                            <button
                              onClick={() => {
                                if (confirm(`Yakin ingin membatalkan booking #${item.bookingCode}?`)) {
                                  onCancelBooking(item.id, item.source);
                                }
                              }}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                isDark
                                  ? 'border-neutral-800 hover:border-rose-500/40 hover:bg-rose-500/10 text-neutral-400 hover:text-rose-400'
                                  : 'border-slate-300 hover:border-rose-300 hover:bg-rose-50 text-rose-600 hover:text-rose-700 bg-white'
                              }`}
                              title="Batalkan Booking"
                            >
                              <Ban className="h-3.5 w-3.5" />
                            </button>
                          )}
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
  );
}

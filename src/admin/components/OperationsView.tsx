import React, { useState, useMemo } from 'react';
import { 
  CalendarDays, Clock, FileText, UserCheck, ChevronLeft, ChevronRight, 
  MapPin, Users, Car, Plane, Compass, Download, Printer, Filter, 
  CheckCircle2, AlertTriangle, ShieldCheck, Eye, Search
} from 'lucide-react';
import { UnifiedBookingDetail } from '../../components/admin/BookingDetailModal';
import { Batch as ShareTourBatch, Trip as ShareTourTrip } from '../../sharetour/types';

interface OperationsViewProps {
  bookings: UnifiedBookingDetail[];
  shareTourBatches: ShareTourBatch[];
  shareTourTrips: ShareTourTrip[];
  activeTab: 'calendar' | 'departures' | 'manifest' | 'assignment';
  setActiveTab: (tab: 'calendar' | 'departures' | 'manifest' | 'assignment') => void;
  onOpenDetail: (booking: UnifiedBookingDetail) => void;
  theme: any;
  isDark?: boolean;
  triggerToast: (msg: string) => void;
}

export default function OperationsView({
  bookings,
  shareTourBatches,
  shareTourTrips,
  activeTab,
  setActiveTab,
  onOpenDetail,
  theme,
  isDark = false,
  triggerToast
}: OperationsViewProps) {
  // Calendar State
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [calendarServiceFilter, setCalendarServiceFilter] = useState<'all' | 'tour' | 'sharetour' | 'airport' | 'taxi' | 'car-rental'>('all');
  const [manifestSearch, setManifestSearch] = useState('');

  // Year & Month for Calendar
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Map departures by Date (YYYY-MM-DD)
  // CRITICAL: Open Trip uses departureDate from batch as official departure date
  const departuresByDate = useMemo(() => {
    const map = new Map<string, UnifiedBookingDetail[]>();

    bookings.forEach(b => {
      // Determine effective operational date
      let effectiveDate = b.date || b.departureDate || '';
      
      // Clean up date string if format is ISO
      if (effectiveDate.includes('T')) {
        effectiveDate = effectiveDate.split('T')[0];
      }

      if (!effectiveDate || effectiveDate.length < 10) return;

      // Filter by service if specified
      if (calendarServiceFilter !== 'all') {
        if (calendarServiceFilter === 'tour' && b.serviceType !== 'tour') return;
        if (calendarServiceFilter === 'sharetour' && b.serviceType !== 'sharetour') return;
        if (calendarServiceFilter === 'airport' && b.serviceType !== 'airport') return;
        if (calendarServiceFilter === 'taxi' && b.serviceType !== 'taxi') return;
        if (calendarServiceFilter === 'car-rental' && b.serviceType !== 'car-rental' && b.serviceType !== 'rental') return;
      }

      const existing = map.get(effectiveDate) || [];
      existing.push(b);
      map.set(effectiveDate, existing);
    });

    return map;
  }, [bookings, calendarServiceFilter]);

  const selectedDayDepartures = departuresByDate.get(selectedDay) || [];

  // Filtered Manifest List
  const manifestBookings = useMemo(() => {
    return bookings.filter(b => {
      if (calendarServiceFilter !== 'all') {
        if (calendarServiceFilter === 'tour' && b.serviceType !== 'tour') return false;
        if (calendarServiceFilter === 'sharetour' && b.serviceType !== 'sharetour') return false;
        if (calendarServiceFilter === 'airport' && b.serviceType !== 'airport') return false;
        if (calendarServiceFilter === 'taxi' && b.serviceType !== 'taxi') return false;
        if (calendarServiceFilter === 'car-rental' && b.serviceType !== 'car-rental' && b.serviceType !== 'rental') return false;
      }

      if (manifestSearch.trim()) {
        const q = manifestSearch.toLowerCase();
        const match = 
          b.customerName.toLowerCase().includes(q) ||
          b.bookingCode.toLowerCase().includes(q) ||
          b.serviceTitle.toLowerCase().includes(q) ||
          (b.pickupLocation || '').toLowerCase().includes(q) ||
          (b.flightNumber || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [bookings, calendarServiceFilter, manifestSearch]);

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Operations Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-black tracking-tight font-sans">
                PUSAT OPERASIONAL PERJALANAN (OPERATIONS)
              </h2>
              <p className={`text-xs ${theme.textSecondary}`}>
                Manajemen jadwal keberangkatan, kalender operasional terpadu, manifest penumpang, dan penugasan armada supir.
              </p>
            </div>
          </div>
        </div>

        {/* Global Service Filter for Operations */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-mono text-neutral-400 font-bold uppercase shrink-0 mr-1">
            Filter:
          </span>
          {[
            { id: 'all' as const, label: 'Semua Layanan' },
            { id: 'tour' as const, label: 'Private Tour' },
            { id: 'sharetour' as const, label: 'Open Trip' },
            { id: 'airport' as const, label: 'Airport' },
            { id: 'taxi' as const, label: 'Taxi' },
            { id: 'car-rental' as const, label: 'Rental' }
          ].map((ch) => (
            <button
              key={ch.id}
              onClick={() => setCalendarServiceFilter(ch.id)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                calendarServiceFilter === ch.id
                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-500 font-bold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
      </div>

      {/* OPERATIONS SUB-NAV */}
      <div className="flex items-center gap-2 border-b border-neutral-700/40 pb-2">
        {[
          { id: 'calendar' as const, label: 'Kalender Operasional', icon: CalendarDays },
          { id: 'departures' as const, label: 'Jadwal Keberangkatan', icon: Clock },
          { id: 'manifest' as const, label: 'Manifest Penumpang', icon: FileText },
          { id: 'assignment' as const, label: 'Penugasan Armada & Supir', icon: UserCheck }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
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

      {/* 1. VIEW: CALENDAR */}
      {activeTab === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Month Calendar Grid (2 cols) */}
          <div className={`lg:col-span-2 ${theme.card} border rounded-2xl p-5 space-y-4 shadow-sm`}>
            {/* Month Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black font-sans tracking-wide flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-amber-500" />
                <span>{monthNames[month]} {year}</span>
              </h3>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-2.5 py-1 text-[11px] font-mono font-bold rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 cursor-pointer"
                >
                  Hari Ini
                </button>
                <button
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Weekdays Row */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-mono uppercase text-neutral-400 font-bold border-b border-neutral-700/40 pb-2">
              {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {/* Empty offset days */}
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="h-20 rounded-xl bg-transparent opacity-20" />
              ))}

              {/* Days of month */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isSelected = selectedDay === dateStr;
                const isToday = new Date().toISOString().slice(0, 10) === dateStr;
                const dayDepartures = departuresByDate.get(dateStr) || [];
                const hasDepartures = dayDepartures.length > 0;

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDay(dateStr)}
                    className={`h-20 p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 shadow-xs'
                        : isToday
                          ? 'border-amber-500/40 bg-neutral-800/30'
                          : `${theme.innerCard} border-neutral-800/60 hover:border-neutral-700`
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-mono font-bold ${
                        isToday ? 'text-amber-500 font-black' : isSelected ? 'text-amber-400' : 'text-neutral-300'
                      }`}>
                        {dayNum}
                      </span>
                      {hasDepartures && (
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      )}
                    </div>

                    {hasDepartures ? (
                      <div className="space-y-0.5 overflow-hidden">
                        <div className="text-[9px] font-mono font-black text-amber-500 truncate">
                          {dayDepartures.length} Keberangkatan
                        </div>
                        <div className="text-[8px] text-neutral-400 truncate">
                          {dayDepartures.reduce((s, b) => s + b.passengers, 0)} Pax Total
                        </div>
                      </div>
                    ) : (
                      <span className="text-[9px] text-neutral-600 font-mono">-</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Departure Inspector (1 col) */}
          <div className={`${theme.card} border rounded-2xl p-5 space-y-4 shadow-sm flex flex-col`}>
            <div className="border-b border-neutral-700/40 pb-3">
              <span className="text-[10px] font-mono text-neutral-400 uppercase font-bold block">
                INSPEKSI KEBERANGKATAN
              </span>
              <h3 className="text-base font-black font-sans text-amber-500">
                {selectedDay}
              </h3>
              <p className="text-[11px] text-neutral-400">
                {selectedDayDepartures.length} Trip Terjadwal pada tanggal ini.
              </p>
            </div>

            <div className="flex-grow space-y-2.5 overflow-y-auto max-h-[500px] no-scrollbar">
              {selectedDayDepartures.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-500 font-mono">
                  Tidak ada keberangkatan terjadwal pada tanggal {selectedDay}.
                </div>
              ) : (
                selectedDayDepartures.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onOpenDetail(item)}
                    className={`p-3 rounded-xl ${theme.innerCard} border border-neutral-700/60 hover:border-amber-500/40 transition-all cursor-pointer space-y-1.5`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-amber-500">
                        #{item.bookingCode}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300">
                        {item.passengers} Pax
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-neutral-100 truncate">
                      {item.serviceTitle}
                    </h4>

                    <div className="text-[11px] text-neutral-400 flex items-center justify-between">
                      <span>Tamu: {item.customerName}</span>
                      <span className="font-mono text-amber-400 font-bold">{item.time || '08:00'}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. VIEW: DEPARTURES TABLE */}
      {activeTab === 'departures' && (
        <div className={`${theme.card} border rounded-2xl overflow-hidden shadow-sm`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase text-neutral-400 font-bold`}>
                <tr>
                  <th className="p-3.5">Tanggal</th>
                  <th className="p-3.5">Waktu</th>
                  <th className="p-3.5">Layanan</th>
                  <th className="p-3.5">Nama Trip / Paket</th>
                  <th className="p-3.5">Nama Tamu Utama</th>
                  <th className="p-3.5 text-center">Pax</th>
                  <th className="p-3.5">Titik Jemput</th>
                  <th className="p-3.5 text-center">Status Operasi</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/40">
                {bookings.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-neutral-500 font-mono">
                      Tidak ada jadwal keberangkatan.
                    </td>
                  </tr>
                ) : (
                  bookings
                    .filter(b => b.bookingStatus !== 'Cancelled')
                    .map((item) => (
                      <tr 
                        key={item.id} 
                        onClick={() => onOpenDetail(item)}
                        className={`${theme.hover} transition-colors cursor-pointer`}
                      >
                        <td className="p-3.5 font-mono font-bold text-amber-400 whitespace-nowrap">
                          {item.date || item.departureDate || '-'}
                        </td>
                        <td className="p-3.5 font-mono text-neutral-300">
                          {item.time || '08:00 WIB'}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                            {item.serviceType.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3.5 font-semibold text-neutral-200 max-w-[200px] truncate" title={item.serviceTitle}>
                          {item.serviceTitle}
                        </td>
                        <td className="p-3.5 font-bold text-neutral-200">
                          {item.customerName}
                        </td>
                        <td className="p-3.5 font-mono text-center text-neutral-200">
                          {item.passengers}
                        </td>
                        <td className="p-3.5 text-neutral-400 max-w-[150px] truncate">
                          {item.pickupLocation || item.meetingPoint || 'Sesuai Konfirmasi'}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                            item.bookingStatus === 'Confirmed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                            item.bookingStatus === 'Completed' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30' :
                            'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}>
                            {item.bookingStatus}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDetail(item);
                            }}
                            className="p-1.5 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. VIEW: MANIFEST */}
      {activeTab === 'manifest' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={manifestSearch}
                onChange={(e) => setManifestSearch(e.target.value)}
                placeholder="Cari nama tamu, flight number, atau trip..."
                className={`w-full ${theme.input} pl-9 pr-4 py-2 rounded-xl text-xs`}
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Cetak Manifest</span>
              </button>
              <button
                onClick={() => triggerToast('Manifest sedang diekspor ke format CSV...')}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Unduh Manifest</span>
              </button>
            </div>
          </div>

          <div className={`${theme.card} border rounded-2xl overflow-hidden shadow-sm`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase text-neutral-400 font-bold`}>
                  <tr>
                    <th className="p-3.5">Kode Booking</th>
                    <th className="p-3.5">Tanggal</th>
                    <th className="p-3.5">Nama Tamu &amp; Kontak</th>
                    <th className="p-3.5">Layanan &amp; Trip</th>
                    <th className="p-3.5 text-center">Pax</th>
                    <th className="p-3.5">Titik Jemput &amp; Drop-off</th>
                    <th className="p-3.5">Penerbangan / Info</th>
                    <th className="p-3.5 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40">
                  {manifestBookings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-neutral-500 font-mono">
                        Tidak ada manifest penumpang yang cocok.
                      </td>
                    </tr>
                  ) : (
                    manifestBookings.map((item) => (
                      <tr 
                        key={item.id}
                        onClick={() => onOpenDetail(item)}
                        className={`${theme.hover} transition-colors cursor-pointer`}
                      >
                        <td className="p-3.5 font-mono font-bold text-amber-500 whitespace-nowrap">
                          #{item.bookingCode}
                        </td>
                        <td className="p-3.5 font-mono text-neutral-300 whitespace-nowrap">
                          {item.date || item.departureDate || '-'}
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-neutral-100">{item.customerName}</div>
                          <div className="text-[10px] text-neutral-500 font-mono">{item.customerPhone}</div>
                        </td>
                        <td className="p-3.5 max-w-[200px] truncate" title={item.serviceTitle}>
                          <span className="font-semibold text-neutral-200">{item.serviceTitle}</span>
                        </td>
                        <td className="p-3.5 font-mono text-center text-neutral-200">
                          {item.passengers} Orang
                        </td>
                        <td className="p-3.5 text-neutral-400 text-xs">
                          <div><span className="text-neutral-500 font-mono text-[10px]">Jemput:</span> {item.pickupLocation || item.meetingPoint || '-'}</div>
                          {item.dropoffLocation && (
                            <div><span className="text-neutral-500 font-mono text-[10px]">Tujuan:</span> {item.dropoffLocation}</div>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-neutral-300">
                          {item.flightNumber ? (
                            <span className="text-amber-400 font-bold">{item.flightNumber}</span>
                          ) : (
                            <span className="text-neutral-500">-</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDetail(item);
                            }}
                            className="p-1.5 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. VIEW: ASSIGNMENT */}
      {activeTab === 'assignment' && (
        <div className={`${theme.card} border rounded-2xl p-6 space-y-4 shadow-sm`}>
          <div className="border-b border-neutral-700/40 pb-3">
            <h3 className="text-sm font-black font-sans text-neutral-100">
              ALOKASI &amp; PENUGASAN OPERASIONAL LAPANGAN
            </h3>
            <p className="text-xs text-neutral-400">
              Penetapan supir (chauffeur), armada kendaraan (fleet unit), dan pemandu wisata untuk trip yang akan beroperasi.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase text-neutral-400 font-bold`}>
                <tr>
                  <th className="p-3.5">Tanggal Trip</th>
                  <th className="p-3.5">Layanan</th>
                  <th className="p-3.5">Pelanggan</th>
                  <th className="p-3.5">Armada Ditugaskan</th>
                  <th className="p-3.5">Supir / Driver</th>
                  <th className="p-3.5 text-center">Status Alokasi</th>
                  <th className="p-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/40">
                {bookings.slice(0, 10).map((item, idx) => (
                  <tr key={idx} className={`${theme.hover} transition-colors`}>
                    <td className="p-3.5 font-mono text-neutral-300 whitespace-nowrap">
                      {item.date || '-'}
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-neutral-200">{item.serviceTitle}</span>
                    </td>
                    <td className="p-3.5 font-bold text-neutral-200">
                      {item.customerName}
                    </td>
                    <td className="p-3.5">
                      <span className="font-mono text-neutral-300">
                        {item.vehicleName || 'Toyota HiAce Premio'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="font-medium text-neutral-300">
                        {idx % 2 === 0 ? 'Bpk. Made Wijaya' : 'Bpk. Ketut Artawa'}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        Terkonfirmasi Ready
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => onOpenDetail(item)}
                        className="px-2.5 py-1 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 text-[11px] font-bold"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

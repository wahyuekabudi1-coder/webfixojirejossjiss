import React, { useState, useEffect } from 'react';
import { 
  Plane, 
  Clock, 
  MapPin, 
  Users, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  ArrowLeft,
  Sparkles,
  Calendar,
  Ticket
} from 'lucide-react';

export interface PassengerManifestItem {
  id?: string;
  name: string;
  pax: number;
  isYou: boolean;
  status: string;
}

export interface DepartureBoardData {
  accessible: boolean;
  isShared: boolean;
  bookingCode: string;
  tripTitle?: string;
  batchId?: string;
  departureDate?: string;
  departureTime?: string;
  meetingPoint?: string;
  boardStatus?: string;
  totalConfirmedPax?: number;
  maxCapacity?: number;
  availableSeats?: number;
  passengers?: PassengerManifestItem[];
  customer?: {
    bookingCode: string;
    customerName: string;
    pax: number;
    bookingStatus?: string;
    paymentStatus?: string;
  };
  message?: string;
  bookingStatus?: string;
  paymentStatus?: string;
}

interface OpenTripDepartureBoardProps {
  bookingCode: string;
  onBackToSearch?: () => void;
  onViewBilling?: () => void;
  initialData?: DepartureBoardData | null;
}

export default function OpenTripDepartureBoard({
  bookingCode,
  onBackToSearch,
  onViewBilling,
  initialData = null
}: OpenTripDepartureBoardProps) {
  const [data, setData] = useState<DepartureBoardData | null>(initialData);
  const [loading, setLoading] = useState<boolean>(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Digital clock for airport FIDS display
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short'
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchBoardData = async () => {
    if (!bookingCode) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/open-trip/departure-board/${encodeURIComponent(bookingCode.trim())}`);
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Gagal memuat informasi Departure Board.');
        setData(null);
      } else {
        setData(result);
      }
    } catch (err: any) {
      console.error('Failed to fetch Departure Board:', err);
      setError('Gagal menghubungi server untuk memuat Layar Keberangkatan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData || initialData.bookingCode !== bookingCode) {
      fetchBoardData();
    }
  }, [bookingCode]);

  // Loading State (Light Theme)
  if (loading) {
    return (
      <div className="bg-white text-slate-800 p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
        <div className="inline-flex p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 animate-pulse">
          <Plane className="h-8 w-8 text-emerald-600 animate-bounce" />
        </div>
        <h3 className="text-base font-mono font-black uppercase tracking-widest text-slate-900">
          CONNECTING TO DISPATCH RADAR...
        </h3>
        <p className="text-xs text-slate-600 font-mono">
          Sinkronisasi manifes peserta dan jadwal keberangkatan bandara / open trip...
        </p>
      </div>
    );
  }

  // Error State (Light Theme)
  if (error || !data) {
    return (
      <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-3xl border border-rose-200 shadow-xl space-y-6">
        <div className="flex items-center gap-3 text-rose-700">
          <AlertCircle className="h-6 w-6 shrink-0" />
          <h3 className="text-base font-bold font-mono uppercase tracking-wide">
            Departure Board Unavailable
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-slate-700 font-mono bg-rose-50 p-4 rounded-xl border border-rose-200">
          {error || 'Data keberangkatan tidak ditemukan.'}
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          {onBackToSearch && (
            <button
              onClick={onBackToSearch}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer border border-slate-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Kembali ke Pencarian</span>
            </button>
          )}
          <button
            onClick={fetchBoardData}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Coba Lagi</span>
          </button>
        </div>
      </div>
    );
  }

  // Gate Check: Status not yet confirmed (Light Theme)
  if (!data.accessible) {
    return (
      <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-3xl border border-amber-200 shadow-xl space-y-6">
        {/* Header Airport Beacon */}
        <div className="flex items-center justify-between border-b border-amber-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping" />
            <span className="font-mono text-xs font-black uppercase tracking-widest text-amber-800">
              BOARDING ACCESS RESTRICTED // STATUS: {data.bookingStatus || 'PENDING'}
            </span>
          </div>
          <span className="font-mono text-xs text-slate-500 font-bold">{currentTime}</span>
        </div>

        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-black font-mono text-amber-950 uppercase tracking-wider">
                Akses Departure Board Menunggu Konfirmasi Admin
              </h4>
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                {data.message || 'Departure Board (Layar Informasi Keberangkatan) hanya dapat diakses setelah pemesanan Open Trip Anda dikonfirmasi resmi oleh Admin Pusat.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-amber-200/70 text-xs font-mono">
            <div>
              <span className="text-slate-600 block text-[10px] font-bold uppercase">Kode Booking:</span>
              <span className="text-slate-950 font-black">{data.bookingCode}</span>
            </div>
            <div>
              <span className="text-slate-600 block text-[10px] font-bold uppercase">Status Bayar:</span>
              <span className={`font-black ${data.paymentStatus === 'Paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                {data.paymentStatus || 'Pending'}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-slate-600 block text-[10px] font-bold uppercase">Tanggal Trip:</span>
              <span className="text-slate-900 font-bold">{data.departureDate || '-'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          {onViewBilling && (
            <button
              onClick={onViewBilling}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs font-mono transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <FileText className="h-4 w-4" />
              <span>Lihat Detail Pembayaran / Tagihan</span>
            </button>
          )}
          {onBackToSearch && (
            <button
              onClick={onBackToSearch}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer border border-slate-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Cek Booking Lain</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const passengers = data.passengers || [];
  const totalConfirmed = data.totalConfirmedPax || passengers.reduce((sum, p) => sum + (p.pax || 1), 0);
  const maxCap = data.maxCapacity || 14;
  const seatsLeft = Math.max(0, maxCap - totalConfirmed);
  const percentFilled = Math.min(100, Math.round((totalConfirmed / maxCap) * 100));

  return (
    <div 
      id="open-trip-departure-board"
      className="bg-white text-slate-900 rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden font-sans"
    >
      {/* 1. TOP AIRPORT TICKER / FIDS HEADER (LIGHT THEME) */}
      <div className="bg-slate-50/90 border-b border-slate-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Logo & System Brand */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0 shadow-xs text-emerald-700">
              <Plane className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-black uppercase tracking-widest text-emerald-800">
                  SMART JOURNEY EXPEDITIONS
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-900">
                  FIDS LIVE
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black font-mono tracking-tight text-slate-950 uppercase">
                DEPARTURE BOARD // LAYAR KEBERANGKATAN
              </h2>
            </div>
          </div>

          {/* Clock & Status Beacon */}
          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider font-bold">
                SYSTEM CLOCK
              </span>
              <span className="text-xs sm:text-sm font-mono font-black text-emerald-800 tracking-wider">
                {currentTime}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <button
              onClick={fetchBoardData}
              title="Refresh Layar Keberangkatan"
              className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-emerald-700 transition-all cursor-pointer shadow-xs"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

        </div>
      </div>

      {/* 2. AIRPORT FLIGHT SPECIFICATION TILES (LIGHT THEME) */}
      <div className="p-4 sm:p-6 space-y-6 bg-slate-50/40">
        
        {/* Core Flight Header Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* Tile 1: Destination / Trip Title */}
          <div className="col-span-2 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
              <Plane className="h-16 w-16 text-slate-900" />
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-700 block mb-1">
              DESTINATION / EXPEDITION
            </span>
            <h3 className="text-base sm:text-lg font-black text-slate-950 tracking-tight">
              {data.tripTitle || 'Open Trip Eksklusif'}
            </h3>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                <Ticket className="h-3 w-3 text-emerald-700" />
                <span>BATCH: {data.batchId || 'OT-BATCH-001'}</span>
              </span>
              <span className="text-[11px] font-mono text-slate-600">
                BOOKING ID: <strong className="text-slate-950">{data.bookingCode}</strong>
              </span>
            </div>
          </div>

          {/* Tile 2: Departure Date */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-700 block mb-1">
              DEPARTURE DATE
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <Calendar className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-sm sm:text-base font-black font-mono text-slate-950">
                {data.departureDate || '-'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 font-medium block mt-1">
              Jadwal Resmi Batch
            </span>
          </div>

          {/* Tile 3: Scheduled Time & Status */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-700 block mb-1">
              TIME &amp; STATUS
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <Clock className="h-4 w-4 text-emerald-700 shrink-0" />
              <span className="text-sm sm:text-base font-black font-mono text-slate-950">
                {data.departureTime || '03:00 WIB'}
              </span>
            </div>
            <div className="mt-1.5">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100/90 text-emerald-950 border border-emerald-300 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                <span>{data.boardStatus || 'CONFIRMED TO GO'}</span>
              </span>
            </div>
          </div>

        </div>

        {/* Meeting Point / Gate Banner */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-800">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">
                GATE / MEETING POINT ASSEMBLY
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                {data.meetingPoint || 'Meeting Point Smart Journey (Malang / Surabaya / Bali)'}
              </span>
            </div>
          </div>
          <span className="hidden sm:inline-block font-mono text-[11px] font-black uppercase px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-2xs">
            ARMADA STANDBY
          </span>
        </div>

        {/* 3. CAPACITY STATUS GAUGE (LIGHT THEME) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-800 block">
                BATCH OCCUPANCY // STATUS KUOTA
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black font-mono text-slate-950 tracking-tight">
                  {totalConfirmed} / {maxCap}
                </span>
                <span className="text-xs font-mono font-bold text-slate-600 uppercase">
                  PAX CONFIRMED
                </span>
              </div>
            </div>

            <div className="sm:text-right">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 shadow-2xs">
                <Users className="h-3.5 w-3.5 text-emerald-700" />
                <span>{seatsLeft} Kursi Tersisa ({maxCap - seatsLeft}/{maxCap})</span>
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div 
              className="h-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 rounded-full transition-all duration-700 shadow-xs"
              style={{ width: `${percentFilled}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-600 font-medium">
            <span>0 Pax (Min. Kuota)</span>
            <span>{percentFilled}% Kuota Terisi</span>
            <span>Kapasitas Penuh ({maxCap} Pax)</span>
          </div>
        </div>

        {/* 4. PASSENGER MANIFEST TABLE (LIGHT THEME) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              <span>PASSENGER MANIFEST // DAFTAR PESERTA CONFIRMED BATCH</span>
            </h4>
            <span className="text-[10px] font-mono text-slate-600 font-semibold">
              Total: <strong className="text-slate-900 font-black">{passengers.length} Pemesanan ({totalConfirmed} Pax)</strong>
            </span>
          </div>

          {/* Flight Manifest Board */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            
            {/* Manifest Header */}
            <div className="grid grid-cols-12 bg-slate-100 border-b border-slate-200 px-3.5 sm:px-5 py-2.5 text-[10px] font-mono font-black uppercase tracking-widest text-slate-700">
              <div className="col-span-1 text-center">NO</div>
              <div className="col-span-6 sm:col-span-7">PASSENGER / MANIFEST NAME</div>
              <div className="col-span-3 sm:col-span-2 text-center">SEATS</div>
              <div className="col-span-2 text-right sm:text-center">STATUS</div>
            </div>

            {/* Manifest List Rows */}
            <div className="divide-y divide-slate-100">
              {passengers.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-slate-500">
                  Belum ada peserta confirmed lain pada batch ini.
                </div>
              ) : (
                passengers.map((p, idx) => (
                  <div 
                    key={p.id || idx}
                    className={`grid grid-cols-12 px-3.5 sm:px-5 py-3 items-center text-xs font-mono transition-colors ${
                      p.isYou 
                        ? 'bg-emerald-50/80 border-l-4 border-l-emerald-600' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Index */}
                    <div className="col-span-1 text-center font-bold text-slate-500">
                      {String(idx + 1).padStart(2, '0')}
                    </div>

                    {/* Name & YOU Badge */}
                    <div className="col-span-6 sm:col-span-7 flex items-center gap-2 flex-wrap">
                      <span className={`font-bold ${p.isYou ? 'text-emerald-950 font-black text-sm' : 'text-slate-900'}`}>
                        {p.name}
                      </span>
                      {p.isYou && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black font-mono px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 shadow-xs">
                          <Sparkles className="h-2.5 w-2.5" />
                          <span>YOU</span>
                        </span>
                      )}
                    </div>

                    {/* Pax Count */}
                    <div className="col-span-3 sm:col-span-2 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded font-black text-xs ${
                        p.isYou ? 'bg-amber-100 text-amber-950 border border-amber-300' : 'bg-slate-100 text-slate-800 border border-slate-200'
                      }`}>
                        {p.pax} Pax
                      </span>
                    </div>

                    {/* Status */}
                    <div className="col-span-2 text-right sm:text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="hidden sm:inline">CONFIRMED</span>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total Manifest Summary Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-5 py-3 flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                TOTAL CONFIRMED MANIFEST:
              </span>
              <span className="font-black text-emerald-800 text-sm">
                {totalConfirmed} / {maxCap} Pax
              </span>
            </div>

          </div>
        </div>

        {/* 5. PRIVACY GUARANTEE BANNER */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-[11px] text-slate-600 leading-relaxed flex items-start gap-2.5 shadow-2xs">
          <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-900 font-bold block mb-0.5">
              Jaminan Keamanan &amp; Privasi Data Penumpang (Data Privacy Protocol)
            </strong>
            Layar Departure Board hanya menampilkan nama manifes dan jumlah pax peserta confirmed. Nomor WhatsApp, alamat email, referensi pembayaran, dan rincian harga bersifat rahasia dan tidak pernah dipublikasikan demi kenyamanan seluruh peserta.
          </div>
        </div>

        {/* 6. ACTION FOOTER */}
        <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onViewBilling && (
              <button
                id="btn-view-billing-summary"
                onClick={onViewBilling}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-mono font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <FileText className="h-3.5 w-3.5 text-emerald-700" />
                <span>Lihat Tagihan &amp; Invoice Resmi</span>
              </button>
            )}
            <button
              onClick={fetchBoardData}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-mono text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Perbarui</span>
            </button>
          </div>

          {onBackToSearch && (
            <button
              onClick={onBackToSearch}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Cari Booking Lain</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

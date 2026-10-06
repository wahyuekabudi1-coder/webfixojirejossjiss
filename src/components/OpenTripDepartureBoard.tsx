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

  if (loading) {
    return (
      <div className="bg-[#0b1311] text-emerald-400 p-8 sm:p-12 rounded-3xl border border-emerald-900/60 shadow-2xl text-center space-y-4">
        <div className="inline-flex p-3 rounded-full bg-emerald-950/60 border border-emerald-800 animate-pulse">
          <Plane className="h-8 w-8 text-emerald-400 animate-bounce" />
        </div>
        <h3 className="text-lg font-mono font-bold uppercase tracking-widest text-emerald-300">
          CONNECTING TO DISPATCH RADAR...
        </h3>
        <p className="text-xs text-emerald-500/80 font-mono">
          Sinkronisasi manifes peserta dan jadwal keberangkatan bandara / open trip...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#0b1311] text-white p-6 sm:p-8 rounded-3xl border border-red-900/50 shadow-2xl space-y-6">
        <div className="flex items-center gap-3 text-rose-400">
          <AlertCircle className="h-6 w-6 shrink-0" />
          <h3 className="text-base font-bold font-mono uppercase tracking-wide">
            Departure Board Unavailable
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-slate-300 font-mono bg-rose-950/30 p-4 rounded-xl border border-rose-900/40">
          {error || 'Data keberangkatan tidak ditemukan.'}
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          {onBackToSearch && (
            <button
              onClick={onBackToSearch}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Kembali ke Pencarian</span>
            </button>
          )}
          <button
            onClick={fetchBoardData}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Coba Lagi</span>
          </button>
        </div>
      </div>
    );
  }

  // Gate Check: Status not yet confirmed
  if (!data.accessible) {
    return (
      <div className="bg-[#0e1715] text-white p-6 sm:p-8 rounded-3xl border border-amber-800/40 shadow-2xl space-y-6">
        {/* Header Airport Beacon */}
        <div className="flex items-center justify-between border-b border-amber-900/40 pb-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-amber-500 animate-ping" />
            <span className="font-mono text-xs font-black uppercase tracking-widest text-amber-400">
              BOARDING ACCESS RESTRICTED // STATUS: {data.bookingStatus || 'PENDING'}
            </span>
          </div>
          <span className="font-mono text-xs text-slate-400">{currentTime}</span>
        </div>

        <div className="bg-amber-950/30 border border-amber-700/40 rounded-2xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-black font-mono text-amber-300 uppercase tracking-wider">
                Akses Departure Board Menunggu Konfirmasi Admin
              </h4>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                {data.message || 'Departure Board (Layar Informasi Keberangkatan) hanya dapat diakses setelah pemesanan Open Trip Anda dikonfirmasi resmi oleh Admin Pusat.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-amber-900/40 text-xs font-mono">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Kode Booking:</span>
              <span className="text-amber-400 font-bold">{data.bookingCode}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Status Bayar:</span>
              <span className={`font-bold ${data.paymentStatus === 'Paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {data.paymentStatus || 'Pending'}
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-slate-500 block text-[10px] uppercase">Tanggal Trip:</span>
              <span className="text-slate-300 font-bold">{data.departureDate || '-'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          {onViewBilling && (
            <button
              onClick={onViewBilling}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black rounded-xl text-xs font-mono transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <FileText className="h-4 w-4" />
              <span>Lihat Detail Pembayaran / Tagihan</span>
            </button>
          )}
          {onBackToSearch && (
            <button
              onClick={onBackToSearch}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer"
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
      className="bg-[#09110f] text-slate-100 rounded-3xl border-2 border-[#1c3830] shadow-2xl overflow-hidden font-sans"
    >
      {/* 1. TOP AIRPORT TICKER / FIDS HEADER */}
      <div className="bg-[#060c0a] border-b border-[#1c3830] px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* Logo & System Brand */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <Plane className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-black uppercase tracking-widest text-amber-400">
                  SMART JOURNEY EXPEDITIONS
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-600/60 text-emerald-300">
                  FIDS LIVE
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black font-mono tracking-tight text-white uppercase">
                DEPARTURE BOARD // LAYAR KEBERANGKATAN
              </h2>
            </div>
          </div>

          {/* Clock & Status Beacon */}
          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-wider">
                SYSTEM CLOCK
              </span>
              <span className="text-xs sm:text-sm font-mono font-black text-amber-400 tracking-wider">
                {currentTime}
              </span>
            </div>
            <div className="h-8 w-px bg-[#1c3830]" />
            <button
              onClick={fetchBoardData}
              title="Refresh Layar Keberangkatan"
              className="p-2 rounded-xl bg-[#142621] hover:bg-[#1a332c] border border-[#23473c] text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

        </div>
      </div>

      {/* 2. AIRPORT FLIGHT SPECIFICATION TILES */}
      <div className="p-4 sm:p-6 space-y-6">
        
        {/* Core Flight Header Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* Tile 1: Destination / Trip Title */}
          <div className="col-span-2 bg-[#0d1a16] border border-[#1f3d34] rounded-2xl p-4 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Plane className="h-16 w-16 text-emerald-400" />
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400/90 block mb-1">
              DESTINATION / EXPEDITION
            </span>
            <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
              {data.tripTitle || 'Open Trip Eksklusif'}
            </h3>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                <Ticket className="h-3 w-3" />
                <span>BATCH: {data.batchId || 'OT-BATCH-001'}</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                BOOKING ID: <strong className="text-slate-200">{data.bookingCode}</strong>
              </span>
            </div>
          </div>

          {/* Tile 2: Departure Date */}
          <div className="bg-[#0d1a16] border border-[#1f3d34] rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400/90 block mb-1">
              DEPARTURE DATE
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <Calendar className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-sm sm:text-base font-black font-mono text-white">
                {data.departureDate || '-'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 block mt-1">
              Jadwal Resmi Batch
            </span>
          </div>

          {/* Tile 3: Scheduled Time & Status */}
          <div className="bg-[#0d1a16] border border-[#1f3d34] rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400/90 block mb-1">
              TIME &amp; STATUS
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <Clock className="h-4 w-4 text-emerald-400 shrink-0" />
              <span className="text-sm sm:text-base font-black font-mono text-white">
                {data.departureTime || '03:00 WIB'}
              </span>
            </div>
            <div className="mt-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{data.boardStatus || 'CONFIRMED TO GO'}</span>
              </span>
            </div>
          </div>

        </div>

        {/* Meeting Point / Gate Banner */}
        <div className="bg-[#0b1714] border border-[#1c3830] rounded-2xl p-3.5 sm:p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-950 border border-emerald-800/80 flex items-center justify-center shrink-0">
              <MapPin className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                GATE / MEETING POINT ASSEMBLY
              </span>
              <span className="text-xs sm:text-sm font-bold text-white">
                {data.meetingPoint || 'Meeting Point Smart Journey (Malang / Surabaya / Bali)'}
              </span>
            </div>
          </div>
          <span className="hidden sm:inline-block font-mono text-[11px] font-black uppercase px-2.5 py-1 rounded bg-[#132722] border border-[#23473c] text-emerald-300">
            ARMADA STANDBY
          </span>
        </div>

        {/* 3. CAPACITY STATUS GAUGE (AIRPORT FLIGHT OCCUPANCY) */}
        <div className="bg-[#0d1a16] border border-[#1f3d34] rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono font-black uppercase tracking-widest text-emerald-400 block">
                BATCH OCCUPANCY // STATUS KUOTA
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                  {totalConfirmed} / {maxCap}
                </span>
                <span className="text-xs font-mono font-bold text-slate-400 uppercase">
                  PAX CONFIRMED
                </span>
              </div>
            </div>

            <div className="sm:text-right">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-[#142721] border border-[#23483e] text-emerald-300">
                <Users className="h-3.5 w-3.5 text-emerald-400" />
                <span>{seatsLeft} Kursi Tersisa ({maxCap - seatsLeft}/{maxCap})</span>
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#070e0c] h-3 rounded-full overflow-hidden p-0.5 border border-[#1c3830]">
            <div 
              className="h-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-amber-500 rounded-full transition-all duration-700 shadow-sm"
              style={{ width: `${percentFilled}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
            <span>0 Pax (Min. Kuota)</span>
            <span>{percentFilled}% Kuota Terisi</span>
            <span>Kapasitas Penuh ({maxCap} Pax)</span>
          </div>
        </div>

        {/* 4. PASSENGER MANIFEST TABLE (DAFTAR PESERTA CONFIRMED) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-mono font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>PASSENGER MANIFEST // DAFTAR PESERTA CONFIRMED BATCH</span>
            </h4>
            <span className="text-[10px] font-mono text-slate-400">
              Total: <strong className="text-white font-bold">{passengers.length} Pemesanan ({totalConfirmed} Pax)</strong>
            </span>
          </div>

          {/* Flight Manifest Board */}
          <div className="bg-[#0b1714] border border-[#1c3830] rounded-2xl overflow-hidden shadow-inner">
            
            {/* Manifest Header */}
            <div className="grid grid-cols-12 bg-[#060c0a] border-b border-[#1c3830] px-3.5 sm:px-5 py-2.5 text-[10px] font-mono font-black uppercase tracking-widest text-slate-400">
              <div className="col-span-1 text-center">NO</div>
              <div className="col-span-6 sm:col-span-7">PASSENGER / MANIFEST NAME</div>
              <div className="col-span-3 sm:col-span-2 text-center">SEATS</div>
              <div className="col-span-2 text-right sm:text-center">STATUS</div>
            </div>

            {/* Manifest List Rows */}
            <div className="divide-y divide-[#132721]">
              {passengers.length === 0 ? (
                <div className="p-6 text-center text-xs font-mono text-slate-400">
                  Belum ada peserta confirmed lain pada batch ini.
                </div>
              ) : (
                passengers.map((p, idx) => (
                  <div 
                    key={p.id || idx}
                    className={`grid grid-cols-12 px-3.5 sm:px-5 py-3 items-center text-xs font-mono transition-colors ${
                      p.isYou 
                        ? 'bg-emerald-950/40 border-l-4 border-l-amber-400' 
                        : 'hover:bg-[#0f1f1a]'
                    }`}
                  >
                    {/* Index */}
                    <div className="col-span-1 text-center font-bold text-slate-500">
                      {String(idx + 1).padStart(2, '0')}
                    </div>

                    {/* Name & YOU Badge */}
                    <div className="col-span-6 sm:col-span-7 flex items-center gap-2 flex-wrap">
                      <span className={`font-bold ${p.isYou ? 'text-amber-300 font-black text-sm' : 'text-slate-200'}`}>
                        {p.name}
                      </span>
                      {p.isYou && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black font-mono px-2 py-0.5 rounded-full bg-amber-500 text-neutral-950 shadow-sm animate-pulse">
                          <Sparkles className="h-2.5 w-2.5" />
                          <span>YOU</span>
                        </span>
                      )}
                    </div>

                    {/* Pax Count */}
                    <div className="col-span-3 sm:col-span-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded font-black text-xs ${
                        p.isYou ? 'bg-amber-400/20 text-amber-300 border border-amber-500/30' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {p.pax} Pax
                      </span>
                    </div>

                    {/* Status */}
                    <div className="col-span-2 text-right sm:text-center">
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="hidden sm:inline">CONFIRMED</span>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Total Manifest Summary Footer */}
            <div className="bg-[#070e0c] border-t border-[#1c3830] px-4 sm:px-5 py-3 flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[11px]">
                TOTAL CONFIRMED MANIFEST:
              </span>
              <span className="font-black text-emerald-400 text-sm">
                {totalConfirmed} / {maxCap} Pax
              </span>
            </div>

          </div>
        </div>

        {/* 5. PRIVACY GUARANTEE BANNER */}
        <div className="p-3.5 rounded-2xl bg-[#091512] border border-[#1b342d] text-[11px] text-slate-400 leading-relaxed flex items-start gap-2.5">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-slate-300 font-bold block mb-0.5">
              Jaminan Keamanan &amp; Privasi Data Penumpang (Data Privacy Protocol)
            </strong>
            Layar Departure Board hanya menampilkan nama manifes dan jumlah pax peserta confirmed. Nomor WhatsApp, alamat email, referensi pembayaran, dan rincian harga bersifat rahasia dan tidak pernah dipublikasikan demi kenyamanan seluruh peserta.
          </div>
        </div>

        {/* 6. ACTION FOOTER */}
        <div className="pt-2 border-t border-[#1c3830] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onViewBilling && (
              <button
                id="btn-view-billing-summary"
                onClick={onViewBilling}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-[#142621] hover:bg-[#1c3830] border border-[#23483e] text-white font-mono font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <FileText className="h-3.5 w-3.5 text-amber-400" />
                <span>Lihat Tagihan &amp; Invoice Resmi</span>
              </button>
            )}
            <button
              onClick={fetchBoardData}
              className="px-3.5 py-2.5 bg-[#0f1d19] hover:bg-[#162c26] border border-[#1f3d34] text-slate-300 font-mono text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Perbarui</span>
            </button>
          </div>

          {onBackToSearch && (
            <button
              onClick={onBackToSearch}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 font-mono text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
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

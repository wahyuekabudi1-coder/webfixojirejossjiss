import React, { useState, useEffect } from 'react';
import { 
  Search, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Lock, 
  Download, 
  AlertCircle, 
  Copy, 
  Check, 
  Car, 
  Calendar, 
  Users, 
  FileText,
  CreditCard,
  ArrowRight,
  ExternalLink,
  MapPin,
  RefreshCw,
  Sparkles,
  Plane
} from 'lucide-react';
import FinalBookingSummaryModal, { FinalSummaryData } from './FinalBookingSummaryModal';
import OpenTripDepartureBoard from './OpenTripDepartureBoard';
import { useApp } from '../AppContext';
import { idrToUSD } from '../utils/pricingUtils';

interface PrivateTourBookingResult {
  found: boolean;
  bookingCode: string;
  id: string;
  bookingType: string;
  bookingCategory?: string;
  isShared?: boolean;
  serviceName: string;
  tripTitle: string;
  packageName?: string;
  departureDate: string;
  duration: string;
  participantsCount: number;
  participantsNames: string[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  vehicleName: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  baseAmount: number;
  uniqueCode: number;
  paymentAmount: number;
  paymentStatus: string;
  bookingStatus: string;
  paidAt?: string | null;
  paymentId?: string | null;
  paymentMethod?: string;
  itinerary?: any[];
  canDownloadFinalSummary: boolean;
  canDownloadInvoice?: boolean;
  gateMessage?: string;
  createdAt: string;
}

interface PrivateTourCheckBookingProps {
  initialCode?: string;
  onPayNow?: (booking: any) => void;
  hideHeader?: boolean;
}

export default function PrivateTourCheckBooking({ initialCode = '', onPayNow, hideHeader = false }: PrivateTourCheckBookingProps) {
  const { currency, formatPrice, refreshBookings } = useApp();
  const [searchCode, setSearchCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<PrivateTourBookingResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Modal State for Final Booking Summary
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<FinalSummaryData | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Open Trip View Tab: 'board' (Departure Board) vs 'billing' (Financial & Invoice)
  const [openTripActiveView, setOpenTripActiveView] = useState<'board' | 'billing'>('board');

  // Sandbox Test Payment state (Active in Sandbox / Development only)
  const [isSandbox, setIsSandbox] = useState(() => {
    if (typeof window === 'undefined') return true;
    const isDev = Boolean((import.meta as any).env?.DEV);
    const host = window.location.hostname;
    return isDev || host === 'localhost' || host === '127.0.0.1' || host.includes('.run.app') || host.includes('ai.studio');
  });
  const [isSimulatingPayment, setIsSimulatingPayment] = useState(false);
  const [simulationFeedback, setSimulationFeedback] = useState<string | null>(null);

  useEffect(() => {
    // Determine if environment is Sandbox/Development
    fetch('/api/artopay/config')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.env === 'sandbox') {
          setIsSandbox(true);
        } else if (data && data.env === 'production') {
          const host = typeof window !== 'undefined' ? window.location.hostname : '';
          const isLocal = host === 'localhost' || host === '127.0.0.1';
          if (!isLocal) {
            setIsSandbox(false);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Auto search if initialCode provided or URL has ?code=
  useEffect(() => {
    let codeFromUrl = initialCode;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
      const hashParams = new URLSearchParams(hashQuery);
      codeFromUrl = hashParams.get('code') || urlParams.get('code') || initialCode;
    }
    if (codeFromUrl && codeFromUrl.trim().length > 2) {
      setSearchCode(codeFromUrl.trim());
      executeSearch(codeFromUrl.trim());
    }

    const handleHashChange = () => {
      const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
      const hashParams = new URLSearchParams(hashQuery);
      const code = hashParams.get('code');
      if (code && code.trim().length > 2) {
        setSearchCode(code.trim());
        executeSearch(code.trim());
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [initialCode]);

  const executeSearch = async (codeToSearch: string) => {
    const cleanCode = codeToSearch.trim();
    if (!cleanCode) {
      setError('Silakan masukkan Booking ID / Kode Booking Anda.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Direct call to Backend Authoritative Endpoint (Never localStorage)
      const res = await fetch(`/api/private-tour/check-booking/${encodeURIComponent(cleanCode)}`);
      const data = await res.json();

      if (!res.ok) {
        setBooking(null);
        setError(data.error || 'Booking tidak ditemukan atau gagal diperiksa.');
        return;
      }

      setBooking(data);
      setOpenTripActiveView('board');

      if (data.found && data.bookingCode) {
        try {
          const stored = JSON.parse(localStorage.getItem('sj_customer_booking_codes') || '[]');
          if (!stored.includes(data.bookingCode)) {
            stored.unshift(data.bookingCode);
            localStorage.setItem('sj_customer_booking_codes', JSON.stringify(stored.slice(0, 20)));
          }
        } catch {}
      }
    } catch (err: any) {
      console.error('Failed to check booking:', err);
      setError('Gagal menghubungi server. Periksa koneksi internet Anda dan coba lagi.');
      setBooking(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(searchCode);
  };

  const handleCopyCode = () => {
    if (!booking) return;
    navigator.clipboard.writeText(booking.bookingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = () => {
    if (!booking || !canDownload) return;
    const code = booking.bookingCode || booking.id;
    const url = `/api/private-tour/invoice-pdf/${encodeURIComponent(code)}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SmartJourney-Confirmation-${code}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenSummaryModal = async () => {
    if (!booking) return;
    setLoadingSummary(true);
    try {
      const res = await fetch(`/api/private-tour/final-summary/${encodeURIComponent(booking.bookingCode)}`);
      const data = await res.json();
      if (res.ok) {
        setSummaryData(data);
        setIsSummaryModalOpen(true);
      } else {
        alert(data.error || 'Gagal memuat pratinjau invoice.');
      }
    } catch (err) {
      console.error('Error fetching invoice preview:', err);
      alert('Gagal memuat pratinjau invoice.');
    } finally {
      setLoadingSummary(false);
    }
  };

  // Sandbox Test Payment Simulation Handler (Only active in sandbox/dev mode)
  const handleSimulatePayment = async () => {
    if (!booking) return;
    setIsSimulatingPayment(true);
    setSimulationFeedback(null);
    const targetCode = (booking.bookingCode || booking.id || '').trim();
    try {
      const res = await fetch('/api/artopay/simulate-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: targetCode,
          bookingCode: booking.bookingCode,
          bookingId: booking.id
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSimulationFeedback('Simulasi pembayaran berhasil! Status: Paid & Menunggu Konfirmasi Admin.');
        
        // Optimistically update local booking status
        setBooking(prev => prev ? {
          ...prev,
          paymentStatus: 'Paid',
          bookingStatus: 'Pending Confirmation'
        } : null);

        // Re-sync authoritative backend state
        await executeSearch(targetCode);

        // Synchronize AppContext global bookings
        if (typeof refreshBookings === 'function') {
          await refreshBookings().catch(() => {});
        }

        // Notify Admin Dashboard & other tabs via CustomEvent and localStorage
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sj_booking_updated', {
            detail: {
              bookingCode: booking.bookingCode || booking.id,
              id: booking.id,
              paymentStatus: 'Paid',
              bookingStatus: 'Pending Confirmation'
            }
          }));
          try {
            localStorage.setItem('sj_last_webhook_event', JSON.stringify({
              timestamp: Date.now(),
              bookingCode: booking.bookingCode || booking.id,
              id: booking.id,
              paymentStatus: 'Paid',
              bookingStatus: 'Pending Confirmation'
            }));
          } catch {}
        }
      } else {
        alert(data.error || 'Simulasi pembayaran gagal.');
      }
    } catch (err: any) {
      console.error('Simulation payment error:', err);
      alert('Gagal menghubungi server untuk simulasi pembayaran.');
    } finally {
      setIsSimulatingPayment(false);
    }
  };

  // Determine tracker step (Tahap 8)
  const getStepProgress = (): 1 | 2 | 3 | 4 => {
    if (!booking) return 1;

    const payStatus = (booking.paymentStatus || '').toLowerCase();
    const bookStatus = (booking.bookingStatus || '').toLowerCase();

    if (bookStatus === 'confirmed' || bookStatus === 'completed') {
      return 4;
    }
    if (bookStatus === 'pending confirmation') {
      return 3;
    }
    if (payStatus === 'paid') {
      return 2;
    }
    return 1; // Pending payment
  };

  const currentStep = getStepProgress();
  const isPaid = (booking?.paymentStatus || '').toLowerCase() === 'paid';
  const rawBookingStatus = (booking?.bookingStatus || (booking as any)?.status || '').trim();
  const isStatusConfirmedOrCompleted = Boolean(
    booking && (
      booking.bookingStatus === 'Confirmed' ||
      booking.bookingStatus === 'Completed' ||
      (booking as any).status === 'Confirmed' ||
      (booking as any).status === 'Completed' ||
      (booking.bookingStatus || '').toLowerCase() === 'confirmed' ||
      (booking.bookingStatus || '').toLowerCase() === 'completed' ||
      ((booking as any).status || '').toLowerCase() === 'confirmed' ||
      ((booking as any).status || '').toLowerCase() === 'completed'
    )
  );

  // Tombol "Minta Konfirmasi via WhatsApp" aktif hanya saat paymentStatus=Paid dan bookingStatus=Pending Confirmation
  const isRequestConfirmationActive = Boolean(
    booking &&
    isPaid &&
    (
      rawBookingStatus === 'Pending Confirmation' ||
      rawBookingStatus.toLowerCase() === 'pending confirmation' ||
      rawBookingStatus.toLowerCase() === 'pending'
    ) &&
    !isStatusConfirmedOrCompleted
  );

  const handleRequestConfirmationWA = () => {
    if (!booking || !isRequestConfirmationActive) return;
    const bookingId = booking.bookingCode || booking.id;
    const customerName = booking.customerName || 'Customer';
    const serviceName = booking.serviceName || booking.tripTitle || 'Layanan Smart Journey';
    const departureDate = booking.departureDate ? ` (Jadwal: ${booking.departureDate})` : '';

    const message = `Halo Admin Smart Journey,\n\nSaya ingin meminta konfirmasi pemesanan saya:\n- Booking ID: ${bookingId}\n- Nama Customer: ${customerName}\n- Paket / Layanan: ${serviceName}${departureDate}\n- Status Pembayaran: LUNAS (PAID)\n\nPembayaran telah berhasil diselesaikan. Mohon bantuannya untuk memverifikasi dan mengonfirmasi pemesanan ini agar invoice resmi dan jadwal armada dapat segera aktif. Terima kasih!`;

    const waUrl = `https://wa.me/6285212347289?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // Authoritative gate: PDF and Final Summary can be downloaded if and only if Paid AND Confirmed/Completed
  const canDownload = Boolean(
    booking && isPaid && isStatusConfirmedOrCompleted
  );

  // Check whether current booking is an Open Trip / Share Tour
  const isSharedBooking = Boolean(
    booking && (
      booking.isShared ||
      booking.bookingType === 'shared' ||
      (booking.bookingCode && booking.bookingCode.startsWith('SJ-OT-'))
    )
  );

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8" id="private-tour-check-booking-section">
      
      {/* Section Header (Hidden when embedded in dedicated portal page) */}
      {!hideHeader && (
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-950 text-xs font-black uppercase tracking-wider mb-3">
            <ShieldCheck className="h-4 w-4 text-amber-700" />
            <span>PORTAL CEK BOOKING &amp; INVOICE</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Cek Status Booking &amp; Unduh Invoice
          </h2>
          <p className="text-sm text-slate-700 font-medium mt-2 leading-relaxed">
            Masukkan kode booking resmi Anda (peserta Open Trip maupun Private Trip) untuk mengecek status pembayaran, melihat rincian perjalanan, dan mengunduh invoice final.
          </p>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-300 p-4 sm:p-6 mb-8">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
              placeholder="Masukkan Kode Booking / Booking ID (contoh: SJ-8F42KD)"
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold text-base placeholder:text-slate-500 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all"
              autoCapitalize="characters"
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-sm"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Memeriksa...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                <span>Periksa Booking</span>
              </>
            )}
          </button>
        </form>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-300 flex items-start gap-3 text-red-950 text-xs sm:text-sm">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Pencarian Tidak Ditemukan</span>
              <p className="mt-0.5 font-medium">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Booking Result View */}
      {booking && (
        <div className="space-y-6 animate-in fade-in duration-300">

          {/* Open Trip Navigation Tabs (Active for Confirmed Open Trip bookings) */}
          {isSharedBooking && isStatusConfirmedOrCompleted && (
            <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-xs flex gap-1.5">
              <button
                type="button"
                id="btn-tab-departure-board"
                onClick={() => setOpenTripActiveView('board')}
                className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl font-mono font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  openTripActiveView === 'board'
                    ? 'bg-emerald-700 text-white font-black shadow-sm'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
                }`}
              >
                <Plane className="h-4 w-4" />
                <span>Layar Keberangkatan (Departure Board)</span>
              </button>
              <button
                type="button"
                id="btn-tab-billing-summary"
                onClick={() => setOpenTripActiveView('billing')}
                className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl font-mono font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  openTripActiveView === 'billing'
                    ? 'bg-emerald-700 text-white font-black shadow-sm'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/60'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Rincian Tagihan &amp; Invoice</span>
              </button>
            </div>
          )}

          {/* If Open Trip Confirmed and Board tab is active, render Departure Board */}
          {isSharedBooking && isStatusConfirmedOrCompleted && openTripActiveView === 'board' ? (
            <OpenTripDepartureBoard
              bookingCode={booking.bookingCode}
              onBackToSearch={() => setBooking(null)}
              onViewBilling={() => setOpenTripActiveView('billing')}
            />
          ) : (
            <>
              {/* If Open Trip but not yet confirmed, render airport departure board notice */}
              {isSharedBooking && !isStatusConfirmedOrCompleted && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3 shadow-xs">
                  <Plane className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-mono font-black text-emerald-900 uppercase block text-xs tracking-wider">
                      Akses Layar Keberangkatan (Departure Board)
                    </span>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed font-sans">
                      Pemesanan Open Trip Anda tercatat di sistem. Layar Informasi Keberangkatan (Departure Board) dan daftar manifes peserta satu batch akan aktif otomatis begitu status pemesanan resmi berstatus <strong>Confirmed</strong> oleh Admin.
                    </p>
                  </div>
                </div>
              )}

              {/* Card 1: Booking Overview Banner */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-300 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
              <div>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-slate-700">Kode Booking / ID</span>
                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                    booking.isShared || booking.bookingType === 'shared'
                      ? 'bg-blue-100 text-blue-950 border-blue-300'
                      : 'bg-amber-100 text-amber-950 border-amber-300'
                  }`}>
                    {booking.isShared || booking.bookingType === 'shared' ? 'OPEN TRIP / SHARE TOUR' : 'PRIVATE TOUR'}
                  </span>

                  {/* Status badges matching Admin with high contrast */}
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-black font-mono px-2.5 py-0.5 rounded-full border uppercase ${
                    (booking.paymentStatus || '').toLowerCase() === 'paid'
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                      : 'bg-amber-100 text-amber-950 border-amber-300'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${(booking.paymentStatus || '').toLowerCase() === 'paid' ? 'bg-emerald-700' : 'bg-amber-600 animate-pulse'}`} />
                    <span>Payment: {(booking.paymentStatus || '').toLowerCase() === 'paid' ? 'PAID' : 'PENDING'}</span>
                  </span>

                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-black font-mono px-2.5 py-0.5 rounded-full border uppercase ${
                    booking.bookingStatus === 'Confirmed' ? 'bg-blue-100 text-blue-950 border-blue-300' :
                    booking.bookingStatus === 'Completed' ? 'bg-purple-100 text-purple-950 border-purple-300' :
                    booking.bookingStatus === 'Cancelled' ? 'bg-rose-100 text-rose-950 border-rose-300' :
                    booking.bookingStatus === 'Pending Confirmation' ? 'bg-cyan-100 text-cyan-950 border-cyan-300' :
                    'bg-amber-100 text-amber-950 border-amber-300'
                  }`}>
                    <span>Booking: {booking.bookingStatus || (booking as any).status || 'PENDING'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl sm:text-3xl font-black font-mono text-slate-950 tracking-tight">
                    {booking.bookingCode}
                  </h3>
                  <button
                    onClick={handleCopyCode}
                    className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-800 transition-colors text-xs flex items-center gap-1 cursor-pointer font-bold"
                    title="Salin Kode Booking"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-700" /> : <Copy className="h-4 w-4" />}
                    <span className="text-[11px] font-bold">{copied ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
              </div>

              <div className="sm:text-right">
                <span className="text-xs text-slate-600 font-bold uppercase tracking-wider block">Waktu Reservasi Dibuat</span>
                <span className="text-xs font-mono font-bold text-slate-900">
                  {new Date(booking.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>

            {/* TAHAP 8: Visual Status Tracker */}
            <div className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono">
                  Alur Progres Reservasi (Live Status Tracker)
                </h4>
                <span className="text-xs font-mono font-black text-slate-900">
                  Tahap {currentStep} dari 4
                </span>
              </div>

              {/* Progress Steps Timeline */}
              <div className="relative mt-4">
                {/* Connecting Line */}
                <div className="absolute top-4 left-6 right-6 h-1 bg-slate-200 -z-0 hidden sm:block">
                  <div 
                    className="h-full bg-emerald-600 transition-all duration-500" 
                    style={{ width: currentStep === 1 ? '0%' : currentStep === 2 ? '33%' : currentStep === 3 ? '66%' : '100%' }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 relative z-10">
                  
                  {/* Step 1: Pending Payment */}
                  <div className={`p-3 rounded-xl border transition-all ${
                    currentStep >= 1 
                      ? 'bg-slate-50 border-slate-300 text-slate-900' 
                      : 'bg-slate-50/50 border-slate-200 text-slate-600'
                  }`}>
                    <div className="flex items-center sm:flex-col sm:items-center text-left sm:text-center gap-3 sm:gap-2">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        currentStep > 1 
                          ? 'bg-emerald-600 text-white' 
                          : currentStep === 1 
                            ? 'bg-amber-500 text-slate-950 font-black ring-4 ring-amber-100' 
                            : 'bg-slate-200 text-slate-600 font-bold'
                      }`}>
                        {currentStep > 1 ? <Check className="h-4 w-4" /> : '1'}
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 block">Pending Payment</span>
                        <span className="text-[11px] font-semibold text-slate-700">Menunggu Pembayaran</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Paid */}
                  <div className={`p-3 rounded-xl border transition-all ${
                    currentStep >= 2 
                      ? 'bg-slate-50 border-slate-300 text-slate-900' 
                      : 'bg-slate-50/50 border-slate-200 text-slate-600'
                  }`}>
                    <div className="flex items-center sm:flex-col sm:items-center text-left sm:text-center gap-3 sm:gap-2">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        currentStep > 2 
                          ? 'bg-emerald-600 text-white' 
                          : currentStep === 2 
                            ? 'bg-amber-500 text-slate-950 font-black ring-4 ring-amber-100' 
                            : 'bg-slate-200 text-slate-600 font-bold'
                      }`}>
                        {currentStep > 2 ? <Check className="h-4 w-4" /> : '2'}
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 block">Paid</span>
                        <span className="text-[11px] font-semibold text-slate-700">Pembayaran Diterima</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 3: Pending Confirmation */}
                  <div className={`p-3 rounded-xl border transition-all ${
                    currentStep >= 3 
                      ? 'bg-slate-50 border-slate-300 text-slate-900' 
                      : 'bg-slate-50/50 border-slate-200 text-slate-600'
                  }`}>
                    <div className="flex items-center sm:flex-col sm:items-center text-left sm:text-center gap-3 sm:gap-2">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        currentStep > 3 
                          ? 'bg-emerald-600 text-white' 
                          : currentStep === 3 
                            ? 'bg-amber-500 text-slate-950 font-black ring-4 ring-amber-100' 
                            : 'bg-slate-200 text-slate-600 font-bold'
                      }`}>
                        {currentStep > 3 ? <Check className="h-4 w-4" /> : '3'}
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 block">Pending Confirmation</span>
                        <span className="text-[11px] font-semibold text-slate-700">Verifikasi Admin Pusat</span>
                      </div>
                    </div>
                  </div>

                  {/* Step 4: Confirmed */}
                  <div className={`p-3 rounded-xl border transition-all ${
                    currentStep >= 4 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950' 
                      : 'bg-slate-50/50 border-slate-200 text-slate-600'
                  }`}>
                    <div className="flex items-center sm:flex-col sm:items-center text-left sm:text-center gap-3 sm:gap-2">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        currentStep >= 4 
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' 
                          : 'bg-slate-200 text-slate-600 font-bold'
                      }`}>
                        {currentStep >= 4 ? <CheckCircle2 className="h-4 w-4" /> : '4'}
                      </div>
                      <div>
                        <span className="text-xs font-black text-slate-900 block">
                          {booking?.bookingStatus === 'Completed' || (booking as any)?.status === 'Completed' ? 'Completed' : 'Confirmed'}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-700">
                          {booking?.bookingStatus === 'Completed' || (booking as any)?.status === 'Completed' ? 'Trip Selesai Dilaksanakan' : 'Pemesanan Dikonfirmasi'}
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* Status Explanation Box */}
              <div className="mt-4 rounded-xl text-xs sm:text-sm">
                {currentStep === 4 ? (
                  <div className="bg-emerald-50 text-emerald-950 border border-emerald-300 p-3.5 rounded-xl flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-emerald-950 block">
                        {booking?.bookingStatus === 'Completed' || (booking as any)?.status === 'Completed' ? 'Trip Selesai (Completed)' : 'Booking Confirmed'}
                      </span>
                      <p className="mt-0.5 text-emerald-950 font-medium leading-relaxed">
                        {booking?.bookingStatus === 'Completed' || (booking as any)?.status === 'Completed'
                          ? 'Perjalanan wisata Anda telah selesai dilaksanakan dengan sukses. Anda tetap dapat mengunduh dokumen resmi invoice / konfirmasi pemesanan di bawah sebagai arsip perjalanan.'
                          : 'Admin Pusat Smart Journey telah mengonfirmasi pemesanan Anda. Seluruh jadwal perjalanan dan kendaraan siap. Silakan unduh Final Booking Confirmation di bawah.'}
                      </p>
                    </div>
                  </div>
                ) : currentStep === 3 ? (
                  <div className="bg-amber-50 text-amber-950 border border-amber-300 p-3.5 rounded-xl flex items-start gap-3">
                    <Clock className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-amber-950 block">Pembayaran diterima. Pemesanan sedang diverifikasi tim Smart Journey.</span>
                      <p className="mt-0.5 text-amber-950 font-medium leading-relaxed">
                        Pembayaran Anda sebesar <strong>Rp {(booking.paymentAmount || 0).toLocaleString('id-ID')}</strong> telah berhasil diterima via ArtoPay Gateway. Tim operasional Smart Journey sedang memverifikasi alokasi armada dan pemandu wisata khusus Private Tour Anda.
                      </p>
                      <p className="mt-1 text-[11px] text-amber-900 font-semibold italic">
                        * Catatan: Dokumen Final Booking Confirmation hanya akan aktif setelah status resmi berubah menjadi <strong>Confirmed</strong> atau <strong>Completed</strong> oleh Admin Pusat.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 text-slate-950 border border-slate-300 p-3.5 rounded-xl flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-slate-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black text-slate-950 block">Menunggu Pembayaran</span>
                      <p className="mt-0.5 text-slate-800 font-medium leading-relaxed">
                        Pemesanan Anda telah tercatat di sistem. Harap selesaikan pembayaran sebesar <strong>Rp {(booking.paymentAmount || 0).toLocaleString('id-ID')}</strong> (termasuk kode unik) agar jadwal tur dapat segera diproses ke tahap verifikasi.
                      </p>
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* Card 2: Tour & Trip Details Snapshot */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Tour Specifications */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-300 p-5 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono flex items-center gap-2">
                <Car className="h-4 w-4 text-amber-600" />
                <span>Rincian Paket &amp; Jadwal Perjalanan</span>
              </h4>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Nama Paket Tur</span>
                  <span className="font-black text-slate-900 text-sm">{booking.serviceName || booking.tripTitle}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Tanggal Keberangkatan</span>
                    <span className="font-bold text-slate-900">{booking.departureDate || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Durasi Tur</span>
                    <span className="font-bold text-slate-900">{booking.duration || '1 Hari'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Jumlah Peserta</span>
                    <span className="font-bold text-slate-900">{booking.participantsCount} Orang</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Pilihan Kendaraan</span>
                    <span className="font-bold text-slate-900">{booking.vehicleName || 'Toyota HiAce / Avanza'}</span>
                  </div>
                </div>

                {booking.pickupLocation && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Lokasi Penjemputan</span>
                    <span className="font-bold text-slate-900 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                      {booking.pickupLocation}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Financial Details & Gate Action */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-300 p-5 flex flex-col justify-between space-y-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-emerald-700" />
                  <span>Rincian Biaya &amp; Transaksi</span>
                </h4>

                <div className="space-y-2 text-xs mt-3">
                  <div className="flex justify-between py-1">
                    <span className="text-slate-700 font-semibold">
                      {booking.serviceType === 'rental' ? 'Harga Dasar Sewa:' : booking.serviceType === 'taxi' ? 'Harga Dasar Taksi:' : booking.serviceType === 'airport' ? 'Harga Dasar Transfer:' : 'Harga Dasar Tur:'}
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      Rp {(
                        Number(booking.baseAmount) > 0
                          ? Number(booking.baseAmount)
                          : (Number(booking.totalPriceIDR) > 0 && Number(booking.discount) > 0
                              ? Number(booking.totalPriceIDR) + Number(booking.discount)
                              : Number(booking.totalPriceIDR || 0))
                      ).toLocaleString('id-ID')}
                    </span>
                  </div>
                  {Boolean(booking.discount && Number(booking.discount) > 0) && (
                    <div className="flex justify-between py-1 border-t border-slate-200 text-emerald-700 font-bold">
                      <span>Diskon Promo {booking.promoCode ? `(${booking.promoCode})` : ''}:</span>
                      <span className="font-mono">- Rp {Number(booking.discount).toLocaleString('id-ID')}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-t border-slate-200">
                    <span className="text-slate-700 font-semibold">Kode Unik Verifikasi:</span>
                    <span className="font-mono font-bold text-amber-700">+ Rp {(booking.uniqueCode || 0).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between py-2 border-t border-slate-200 font-bold text-sm bg-slate-50 px-2 rounded-lg items-center">
                    <span className="text-slate-900 font-extrabold">Total Pembayaran (ArtoPay IDR):</span>
                    <div className="text-right">
                      {(() => {
                        const finalPayable = 
                          Number(booking.paymentAmount) || 
                          Number(booking.totalAmountIDR) || 
                          Number(booking.totalPaid) || 
                          Number(booking.totalPriceIDR) || 0;
                        if (currency !== 'IDR') {
                          return (
                            <>
                              <span className="font-mono text-emerald-800 font-black block">
                                {formatPrice(idrToUSD(finalPayable), finalPayable)}
                              </span>
                              <span className="text-[10px] font-mono text-slate-700 font-semibold block">
                                (≈ Rp {finalPayable.toLocaleString('id-ID')} IDR)
                              </span>
                            </>
                          );
                        }
                        return (
                          <span className="font-mono text-emerald-800 font-black">
                            Rp {finalPayable.toLocaleString('id-ID')}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* AKSI KONFIRMASI & INVOICE */}
              <div className="pt-4 border-t border-slate-200 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Tombol Minta Konfirmasi via WhatsApp: Aktif hanya saat paymentStatus=Paid dan bookingStatus=Pending Confirmation */}
                  <button
                    id="btn-request-confirmation-wa"
                    onClick={handleRequestConfirmationWA}
                    disabled={!isRequestConfirmationActive}
                    className={`w-full py-2.5 px-3 font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 ${
                      isRequestConfirmationActive
                        ? 'bg-[#25D366] hover:bg-[#20ba5a] active:bg-[#1da851] text-white cursor-pointer font-black'
                        : 'bg-slate-100 text-slate-500 border border-slate-300 cursor-not-allowed font-semibold'
                    }`}
                    title={
                      isRequestConfirmationActive
                        ? 'Hubungi WhatsApp resmi Smart Journey untuk meminta konfirmasi pemesanan'
                        : isStatusConfirmedOrCompleted
                        ? 'Pemesanan Anda sudah berstatus Confirmed oleh Admin'
                        : !isPaid
                        ? 'Tombol aktif setelah pembayaran lunas diverifikasi (status Paid)'
                        : 'Minta Konfirmasi via WhatsApp'
                    }
                  >
                    <svg viewBox="0 0 448 512" className={`h-4 w-4 fill-current shrink-0 ${isRequestConfirmationActive ? 'text-white' : 'text-slate-400'}`} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-117zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
                    </svg>
                    <span>
                      {isStatusConfirmedOrCompleted ? 'Pemesanan Dikonfirmasi' : 'Minta Konfirmasi via WhatsApp'}
                    </span>
                  </button>

                  {/* Tombol Lihat Invoice: Membuka Booking Summary (di mana tombol Download PDF berada di dalam) */}
                  <button
                    id="btn-view-invoice-modal"
                    onClick={handleOpenSummaryModal}
                    disabled={!canDownload || loadingSummary}
                    className={`w-full py-2.5 px-3 font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 ${
                      canDownload
                        ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                        : 'bg-slate-100 text-slate-700 border border-slate-300 cursor-not-allowed font-semibold'
                    }`}
                    title={
                      canDownload
                        ? 'Buka Booking Summary untuk melihat detail dan mengunduh invoice PDF'
                        : 'Pratinjau invoice dan unduh PDF hanya aktif setelah pemesanan berstatus Confirmed atau Completed oleh Admin'
                    }
                  >
                    {loadingSummary ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Memuat...</span>
                      </>
                    ) : canDownload ? (
                      <>
                        <FileText className="h-4 w-4" />
                        <span>Lihat Invoice</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 text-slate-600" />
                        <span>Lihat Invoice (Terkunci)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Bayar sekarang jika belum lunas */}
                {booking.paymentStatus !== 'Paid' && onPayNow && (
                  <button
                    id="btn-pay-now-artopay"
                    onClick={() => onPayNow(booking)}
                    className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>
                      Bayar {currency !== 'IDR' ? `${formatPrice(idrToUSD(booking.paymentAmount || 0), booking.paymentAmount || 0)} (Rp ${(booking.paymentAmount || 0).toLocaleString('id-ID')})` : `Rp ${(booking.paymentAmount || 0).toLocaleString('id-ID')}`} (ArtoPay)
                    </span>
                  </button>
                )}

                {/* TOMBOL TEST PAYMENT UNTUK SANDBOX SAJA */}
                {isSandbox && booking.paymentStatus !== 'Paid' && (
                  <div className="pt-2">
                    <button
                      id="btn-simulate-payment-success"
                      type="button"
                      onClick={handleSimulatePayment}
                      disabled={isSimulatingPayment}
                      className="w-full py-2.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-950 border-2 border-dashed border-amber-500 font-black text-xs sm:text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99] disabled:opacity-50"
                      title="Simulasi Webhook ArtoPay Sukses (Sandbox Testing Saja)"
                    >
                      {isSimulatingPayment ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin text-amber-700" />
                          <span>Memproses Simulasi Webhook ArtoPay...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 text-amber-600" />
                          <span>Simulasi Pembayaran Sukses (Sandbox Testing)</span>
                        </>
                      )}
                    </button>
                    {simulationFeedback && (
                      <p className="mt-1.5 text-center text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 py-1 px-2 rounded-lg">
                        ✓ {simulationFeedback}
                      </p>
                    )}
                  </div>
                )}

                <span className="text-[11px] text-slate-600 text-center block font-medium pt-1">
                  {canDownload
                    ? '✓ Berkas invoice dan konfirmasi resmi siap diunduh melalui tombol "Lihat Invoice".'
                    : isRequestConfirmationActive
                    ? '⚡ Pembayaran lunas. Klik "Minta Konfirmasi via WhatsApp" untuk verifikasi langsung.'
                    : booking.paymentStatus === 'Paid'
                    ? '⏳ Pembayaran lunas. Dokumen resmi aktif begitu diverifikasi Admin Pusat.'
                    : '🔒 Dokumen resmi aktif setelah pembayaran diselesaikan dan diverifikasi Admin.'}
                </span>
              </div>

            </div>

          </div>
          </>
          )}

        </div>
      )}

      {/* TAHAP 10: Official Modal Component */}
      <FinalBookingSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        data={summaryData}
      />

    </div>
  );
}

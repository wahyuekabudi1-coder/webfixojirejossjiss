import React from 'react';
import { useApp } from '../AppContext';
import { idrToUSD } from '../utils/pricingUtils';
import { 
  X, 
  Printer, 
  Download, 
  CheckCircle2, 
  ShieldCheck, 
  Calendar, 
  Users, 
  Clock, 
  Car, 
  MapPin, 
  CreditCard, 
  FileText,
  Phone,
  Mail,
  Building
} from 'lucide-react';

export interface FinalSummaryData {
  bookingCode: string;
  id?: string;
  bookingDate?: string;
  bookingStatus: string;
  paymentStatus: string;
  verificationHash?: string;
  generatedAt?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    pickupLocation?: string;
    dropoffLocation?: string;
  };
  trip: {
    title: string;
    package?: string;
    departureDate: string;
    duration: string;
    participantsCount: number;
    participantsNames?: string[];
    participantsManifest?: Array<{ name: string; nationality?: string }>;
    vehicleName?: string;
    pickupLocation?: string;
    dropoffLocation?: string;
    itinerary?: string[] | any[];
  };
  payment: {
    baseAmount: number;
    basePrice?: number;
    discount?: number;
    promoCode?: string;
    uniqueCode: number;
    totalPaid: number;
    currency?: string;
    paidAt?: string;
    paymentDate?: string;
    paymentId?: string;
    paymentMethod?: string;
  };
  company?: {
    name: string;
    legalEntity?: string;
    brand?: string;
    hotline?: string;
    email?: string;
    website?: string;
    operationalHub?: string;
  };
}

interface FinalBookingSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: FinalSummaryData | null;
}

export default function FinalBookingSummaryModal({ isOpen, onClose, data }: FinalBookingSummaryModalProps) {
  const { currency, formatPrice } = useApp();
  if (!isOpen || !data) return null;

  const handleDownloadActualPdf = () => {
    const pdfUrl = `/api/private-tour/invoice-pdf/${encodeURIComponent(data.bookingCode)}`;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.setAttribute('download', `SmartJourney-Final-Booking-${data.bookingCode}.pdf`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `SmartJourney-Final-Booking-${data.bookingCode}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  const handleOpenPrintablePage = () => {
    window.open(`/api/private-tour/invoice-html/${encodeURIComponent(data.bookingCode)}?autoPrint=true`, '_blank');
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SmartJourney-Final-Booking-${data.bookingCode}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formattedTotal = (data.payment.totalPaid || 0).toLocaleString('id-ID');
  const formattedBase = (data.payment.baseAmount || data.payment.basePrice || 0).toLocaleString('id-ID');
  const formattedUnique = (data.payment.uniqueCode || 0).toLocaleString('id-ID');

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      id="final-summary-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white text-neutral-900 w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-neutral-200 my-auto">
        
        {/* Modal Top Actions (Hidden in Print, Sticky at top) */}
        <div className="bg-neutral-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden z-10 border-b border-neutral-800">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <span className="font-bold text-xs sm:text-sm tracking-wide">DOKUMEN RESMI — FINAL BOOKING CONFIRMATION</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              id="btn-download-pdf-actual"
              onClick={handleDownloadActualPdf}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
              title="Unduh Berkas PDF Asli"
            >
              <Download className="h-4 w-4" />
              <span>Download PDF</span>
            </button>
            <button
              id="btn-print-summary-modal"
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer"
              title="Cetak via Dialog Browser"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak (A4)</span>
            </button>
            <button
              id="btn-open-pdf-summary-modal"
              onClick={handleOpenPrintablePage}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer"
              title="Buka Halaman Siap Cetak A4"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Versi Web A4</span>
            </button>
            <button
              id="btn-download-json-summary"
              onClick={handleDownloadJSON}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-black transition-colors cursor-pointer"
              title="Unduh Snapshot JSON"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">JSON</span>
            </button>
            <button
              id="btn-close-summary-modal"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer ml-1"
              aria-label="Tutup modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Document Body (Smooth vertical scroll inside container) */}
        <div className="p-4 sm:p-6 md:p-8 space-y-6 overflow-y-auto overscroll-contain flex-1 print:overflow-visible print:p-0 print:space-y-4 text-neutral-900" id="printable-summary-document">
          
          {/* Header Brand & Verification */}
          <div className="border-b border-neutral-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="font-black text-2xl tracking-tight text-neutral-900 font-mono">SMART JOURNEY</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-950 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                  OFFICIAL CONFIRMATION
                </span>
              </div>
              <div className="text-base font-black text-emerald-900 tracking-wider uppercase font-mono">FINAL BOOKING CONFIRMATION</div>
              <p className="text-xs text-slate-700 font-semibold mt-0.5">Booking Summary &amp; Payment Receipt</p>
              <p className="text-xs text-slate-600 font-medium mt-1">PT Sawah Jaya Trans • Smart Journey Official Travel</p>
              <p className="text-[11px] text-slate-700 font-mono font-medium">Hub: Malang &amp; Bali • WhatsApp: +62 852-1234-7289 • Info@sawahjayatrans.com</p>
            </div>

            <div className="sm:text-right bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-200">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-600 block font-bold">Booking Code / ID</span>
              <span className="text-2xl font-black font-mono text-neutral-900 block" id="summary-booking-code">{data.bookingCode}</span>
              <div className="mt-1 flex sm:justify-end items-center gap-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${
                  data.bookingStatus === 'Confirmed' || data.bookingStatus === 'Completed'
                    ? 'text-emerald-900 bg-emerald-100 border-emerald-300'
                    : 'text-amber-900 bg-amber-100 border-amber-300'
                }`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {data.bookingStatus === 'Confirmed' || data.bookingStatus === 'Completed' ? 'CONFIRMED' : data.bookingStatus.toUpperCase()}
                </span>
                <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${
                  data.paymentStatus === 'Paid'
                    ? 'text-emerald-900 bg-emerald-100 border-emerald-300'
                    : 'text-amber-900 bg-amber-100 border-amber-300'
                }`}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {data.paymentStatus === 'Paid' ? 'PAID' : 'PENDING'}
                </span>
              </div>
              {data.bookingDate && (
                <span className="text-[11px] text-slate-700 font-semibold block mt-1">Tanggal: {data.bookingDate}</span>
              )}
            </div>
          </div>

          {/* Section: Status Snapshot Banner */}
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-600 text-white rounded-lg shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-emerald-950">
                  {data.paymentStatus === 'Paid' ? 'Pemesanan Resmi Terkonfirmasi & Lunas' : 'Pemesanan Terdaftar — Menunggu Pembayaran'}
                </h4>
                <p className="text-xs text-emerald-900 font-medium mt-0.5 leading-relaxed">
                  {data.paymentStatus === 'Paid'
                    ? 'Pembayaran lunas terverifikasi ArtoPay Gateway. Armada dan jadwal perjalanan telah tercatat resmi di sistem Smart Journey.'
                    : 'Pemesanan telah tercatat di sistem Smart Journey. Silakan selesaikan pembayaran untuk konfirmasi final jadwal armada.'}
                </p>
              </div>
            </div>
            {data.verificationHash && (
              <div className="text-[10px] font-mono text-emerald-950 font-bold bg-white px-2.5 py-1 rounded border border-emerald-300 self-stretch sm:self-auto text-center sm:text-right">
                <span className="block text-[9px] uppercase font-bold text-slate-600">Digital Hash</span>
                <span id="summary-verification-hash">{data.verificationHash}</span>
              </div>
            )}
          </div>

          {/* Section: 2 Columns (Customer & Trip) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Column 1: Customer Details */}
            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-amber-500" />
                <span>Informasi Customer</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Nama Lengkap (Customer)</span>
                  <span className="font-black text-slate-900 text-sm" id="summary-customer-name">{data.customer.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-200">
                  <div>
                    <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Telepon / WhatsApp</span>
                    <span className="font-mono font-bold text-slate-900">{data.customer.phone || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Email</span>
                    <span className="font-mono font-bold text-slate-900 truncate block">{data.customer.email || '-'}</span>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-slate-200">
                  <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Lokasi Penjemputan (Pickup)</span>
                  <span className="font-bold text-slate-900">{data.customer.pickupLocation || data.trip.pickupLocation || 'Hotel Lobby / Meeting Point'}</span>
                </div>
                {(data.customer.dropoffLocation || data.trip.dropoffLocation) && (
                  <div className="pt-1.5 border-t border-slate-200">
                    <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Lokasi Pengantaran (Drop-off)</span>
                    <span className="font-bold text-slate-900">{data.customer.dropoffLocation || data.trip.dropoffLocation}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Trip Specifications */}
            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-amber-500" />
                <span>Informasi Paket Wisata (Tour Information)</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Nama Paket Tur</span>
                  <span className="font-black text-amber-800 text-sm" id="summary-tour-title">{data.trip.title}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-200">
                  <div>
                    <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Kategori / Paket</span>
                    <span className="font-bold text-slate-900">{data.trip.package || 'Private Exclusive'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Tanggal Wisata</span>
                    <span className="font-bold text-slate-900">{data.trip.departureDate || '-'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-200">
                  <div>
                    <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Durasi Wisata</span>
                    <span className="font-bold text-slate-900">{data.trip.duration || '1 Hari'}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Jumlah Peserta</span>
                    <span className="font-bold text-slate-900">{data.trip.participantsCount} Orang</span>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-slate-200">
                  <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Pilihan Kendaraan (Armada)</span>
                  <span className="font-bold text-slate-900">{data.trip.vehicleName || 'Standard Private Tourism Vehicle'}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Section: Guest Manifest */}
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-amber-500" />
              <span>Guest Manifest (Daftar Tamu Peserta)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {data.trip.participantsManifest && data.trip.participantsManifest.length > 0 ? (
                data.trip.participantsManifest.map((guest, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900">{idx + 1}. {guest.name}</span>
                    {guest.nationality && (
                      <span className="text-[10px] text-slate-800 bg-slate-100 font-bold px-2 py-0.5 rounded border border-slate-200">{guest.nationality}</span>
                    )}
                  </div>
                ))
              ) : (
                (data.trip.participantsNames || [data.customer.name]).map((name, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-900">{idx + 1}. {name}</span>
                    <span className="text-[10px] text-slate-800 bg-slate-100 font-bold px-2 py-0.5 rounded border border-slate-200">Tamu Utama</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: Financial & Payment Snapshot */}
          <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
              <span>Rincian Pembayaran &amp; Transaksi (LUNAS)</span>
            </h3>

            <div className={`grid grid-cols-1 ${data.payment.discount && data.payment.discount > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-3 pt-2 text-xs`}>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Harga Dasar Tur (Base Price)</span>
                <span className="font-mono font-bold text-slate-900 text-sm">Rp {formattedBase}</span>
              </div>
              {Boolean(data.payment.discount && data.payment.discount > 0) && (
                <div className="bg-rose-50 p-3 rounded-lg border border-rose-200">
                  <span className="text-rose-900 block text-[10px] font-bold">Diskon Promo {data.payment.promoCode ? `(${data.payment.promoCode})` : ''}</span>
                  <span className="font-mono font-bold text-rose-800 text-sm">- Rp {Number(data.payment.discount).toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Kode Unik (Unique Code)</span>
                <span className="font-mono font-bold text-amber-700 text-sm">Rp {formattedUnique}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-300">
                <span className="text-emerald-950 block text-[10px] font-bold">Total Pembayaran Lunas</span>
                <span className="font-mono font-black text-emerald-900 text-base" id="summary-total-paid">Rp {formattedTotal}</span>
                {currency !== 'IDR' && (
                  <span className="text-[10px] font-mono text-emerald-900 block mt-0.5 font-bold">
                    {formatPrice(idrToUSD(data.payment.totalPaid), data.payment.totalPaid)} (≈ Rp {formattedTotal} IDR)
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2.5 border-t border-slate-200 text-[11px] font-mono">
              <div>
                <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Metode Pembayaran</span>
                <span className="font-bold text-slate-900">{data.payment.paymentMethod || 'ARTOPAY GATEWAY'}</span>
              </div>
              <div>
                <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">ID Transaksi ArtoPay</span>
                <span className="truncate block font-bold text-slate-900">{data.payment.paymentId || 'TX-VERIFIED-ARTOPAY'}</span>
              </div>
              <div>
                <span className="text-slate-600 block text-[10px] font-bold uppercase tracking-wider">Waktu Pelunasan</span>
                <span className="font-bold text-slate-900">{data.payment.paymentDate || (data.payment.paidAt ? new Date(data.payment.paidAt).toLocaleString('id-ID') : '-')}</span>
              </div>
            </div>
          </div>

          {/* Section: Itinerary Snapshot */}
          {data.trip.itinerary && Array.isArray(data.trip.itinerary) && data.trip.itinerary.length > 0 && (
            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-mono flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span>Jadwal &amp; Rencana Perjalanan (Itinerary)</span>
              </h3>
              <div className="space-y-1.5 text-xs text-slate-900 mt-2">
                {data.trip.itinerary.map((item: any, idx: number) => {
                  const title = typeof item === 'string' ? item : (item.title || item.day || `Hari ${idx + 1}`);
                  const desc = typeof item === 'object' && item.desc ? item.desc : (typeof item === 'object' && item.activities ? item.activities.join(', ') : null);
                  return (
                    <div key={idx} className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="font-mono text-amber-700 font-bold shrink-0">{idx + 1}.</span>
                      <div>
                        <span className="font-bold text-slate-900">{title}</span>
                        {desc && <p className="text-[11px] text-slate-700 font-medium mt-0.5">{desc}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Terms & Operational Notice */}
          <div className="border-t border-slate-200 pt-4 text-[11px] text-slate-700 space-y-1">
            <p className="font-bold text-slate-900">Ketentuan Penting &amp; Layanan Operasional:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Pemandu wisata / Driver Smart Journey akan menghubungi tamu via WhatsApp H-1 sebelum jam keberangkatan.</li>
              <li>Mohon siap di lokasi penjemputan 15 menit sebelum jadwal. Simpan bukti Final Booking Summary ini di ponsel Anda.</li>
              <li>Layanan bantuan 24 Jam via WhatsApp: <strong className="text-slate-950">+62 852-1234-7289</strong> atau email <strong className="text-slate-950">Info@sawahjayatrans.com</strong>.</li>
            </ul>
          </div>

          {/* Official Footer Timestamp */}
          <div className="text-center pt-2 text-[10px] text-slate-600 font-mono font-medium">
            Dokumen ini diterbitkan secara resmi oleh Smart Journey (PT Sawah Jaya Trans) pada {new Date().toLocaleString('id-ID')} • Seluruh Hak Cipta Dilindungi
          </div>

        </div>

      </div>
    </div>
  );
}

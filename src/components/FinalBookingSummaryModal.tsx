import React from 'react';
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
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
      id="final-summary-modal"
    >
      <div className="bg-white text-neutral-900 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-neutral-200 my-4">
        
        {/* Modal Top Actions (Hidden in Print) */}
        <div className="bg-neutral-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <span className="font-bold text-sm tracking-wide">DOKUMEN RESMI — FINAL BOOKING SUMMARY</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              id="btn-download-pdf-actual"
              onClick={handleDownloadActualPdf}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer shadow-sm"
              title="Unduh Berkas PDF Asli"
            >
              <Download className="h-4 w-4" />
              <span>Unduh File PDF</span>
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

        {/* Printable Official Document Body */}
        <div className="p-6 sm:p-8 space-y-6 print:p-0 print:space-y-4 text-neutral-850" id="printable-summary-document">
          
          {/* Header Brand & Verification */}
          <div className="border-b border-neutral-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="font-black text-2xl tracking-tight text-neutral-900 font-mono">SMART JOURNEY</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  OFFICIAL SUMMARY
                </span>
              </div>
              <div className="text-sm font-black text-amber-600 tracking-wider uppercase font-mono">FINAL BOOKING SUMMARY</div>
              <p className="text-xs text-neutral-500 font-medium mt-1">PT Smart Journey Transindo • Lisensi Resmi Biro Perjalanan Wisata</p>
              <p className="text-[11px] text-neutral-400 font-mono">Malang &amp; Surabaya, Jawa Timur • Hotline 24/7: +62 852-1234-7289</p>
            </div>

            <div className="sm:text-right bg-neutral-50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-neutral-200">
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block font-bold">Booking Code</span>
              <span className="text-2xl font-black font-mono text-neutral-900 block" id="summary-booking-code">{data.bookingCode}</span>
              <div className="mt-1 flex sm:justify-end items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  BOOKING CONFIRMED
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  <CheckCircle2 className="h-3 w-3 text-blue-600" />
                  PAYMENT PAID
                </span>
              </div>
              {data.bookingDate && (
                <span className="text-[10px] text-neutral-500 block mt-1">Tanggal: {data.bookingDate}</span>
              )}
            </div>
          </div>

          {/* Section: Status Snapshot Banner */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-500 text-white rounded-lg shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-950">Pemesanan Private Tour Resmi Terkonfirmasi &amp; Lunas</h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Pembayaran lunas terverifikasi ArtoPay Gateway. Armada privat &amp; pemandu wisata telah dijadwalkan secara resmi oleh Smart Journey.
                </p>
              </div>
            </div>
            {data.verificationHash && (
              <div className="text-[10px] font-mono text-emerald-800/80 bg-white/70 px-2.5 py-1 rounded border border-emerald-200 self-stretch sm:self-auto text-center sm:text-right">
                <span className="block text-[9px] uppercase font-bold text-neutral-400">Digital Hash</span>
                <span id="summary-verification-hash">{data.verificationHash}</span>
              </div>
            )}
          </div>

          {/* Section: 2 Columns (Customer & Trip) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Column 1: Customer Details */}
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200/80 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-amber-500" />
                <span>Informasi Customer</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-neutral-400 block text-[10px]">Nama Lengkap (Customer)</span>
                  <span className="font-bold text-neutral-900 text-sm" id="summary-customer-name">{data.customer.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200/60">
                  <div>
                    <span className="text-neutral-400 block text-[10px]">Telepon / WhatsApp</span>
                    <span className="font-mono font-medium text-neutral-800">{data.customer.phone || '-'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[10px]">Email</span>
                    <span className="font-mono font-medium text-neutral-800 truncate block">{data.customer.email || '-'}</span>
                  </div>
                </div>
                <div className="pt-1 border-t border-neutral-200/60">
                  <span className="text-neutral-400 block text-[10px]">Lokasi Penjemputan (Pickup)</span>
                  <span className="font-medium text-neutral-800">{data.customer.pickupLocation || data.trip.pickupLocation || 'Hotel Lobby / Meeting Point'}</span>
                </div>
                {(data.customer.dropoffLocation || data.trip.dropoffLocation) && (
                  <div className="pt-1 border-t border-neutral-200/60">
                    <span className="text-neutral-400 block text-[10px]">Lokasi Pengantaran (Drop-off)</span>
                    <span className="font-medium text-neutral-800">{data.customer.dropoffLocation || data.trip.dropoffLocation}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Trip Specifications */}
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200/80 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-amber-500" />
                <span>Informasi Private Tour</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-neutral-400 block text-[10px]">Nama Paket Tur</span>
                  <span className="font-black text-neutral-900 text-sm text-amber-700" id="summary-tour-title">{data.trip.title}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200/60">
                  <div>
                    <span className="text-neutral-400 block text-[10px]">Kategori / Paket</span>
                    <span className="font-bold text-neutral-800">{data.trip.package || 'Private Exclusive'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[10px]">Tanggal Wisata</span>
                    <span className="font-bold text-neutral-800">{data.trip.departureDate || '-'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200/60">
                  <div>
                    <span className="text-neutral-400 block text-[10px]">Durasi Wisata</span>
                    <span className="font-bold text-neutral-800">{data.trip.duration || '1 Hari'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[10px]">Jumlah Peserta</span>
                    <span className="font-bold text-neutral-800">{data.trip.participantsCount} Orang</span>
                  </div>
                </div>
                <div className="pt-1 border-t border-neutral-200/60">
                  <span className="text-neutral-400 block text-[10px]">Pilihan Kendaraan (Armada)</span>
                  <span className="font-bold text-neutral-800">{data.trip.vehicleName || 'Standard Private Tourism Vehicle'}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Section: Guest Manifest */}
          <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200/80 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-amber-500" />
              <span>Guest Manifest (Daftar Tamu Peserta)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {data.trip.participantsManifest && data.trip.participantsManifest.length > 0 ? (
                data.trip.participantsManifest.map((guest, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-neutral-200/70">
                    <span className="font-medium text-neutral-900">{idx + 1}. {guest.name}</span>
                    {guest.nationality && (
                      <span className="text-[10px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">{guest.nationality}</span>
                    )}
                  </div>
                ))
              ) : (
                (data.trip.participantsNames || [data.customer.name]).map((name, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border border-neutral-200/70">
                    <span className="font-medium text-neutral-900">{idx + 1}. {name}</span>
                    <span className="text-[10px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">Tamu Utama</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section: Financial & Payment Snapshot */}
          <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200/80 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-emerald-600" />
              <span>Rincian Pembayaran &amp; Transaksi (LUNAS)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="bg-white p-3 rounded-lg border border-neutral-200">
                <span className="text-neutral-400 block text-[10px]">Harga Dasar Tur (Base Price)</span>
                <span className="font-mono font-bold text-neutral-800 text-sm">Rp {formattedBase}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-neutral-200">
                <span className="text-neutral-400 block text-[10px]">Kode Unik (Unique Code)</span>
                <span className="font-mono font-bold text-neutral-800 text-sm">Rp {formattedUnique}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                <span className="text-emerald-700 block text-[10px] font-bold">Total Pembayaran Lunas</span>
                <span className="font-mono font-black text-emerald-800 text-base" id="summary-total-paid">Rp {formattedTotal}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-neutral-200/70 text-[11px] text-neutral-600 font-mono">
              <div>
                <span className="text-neutral-400 block text-[10px]">Metode Pembayaran</span>
                <span>{data.payment.paymentMethod || 'ARTOPAY GATEWAY'}</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">ID Transaksi ArtoPay</span>
                <span className="truncate block font-bold">{data.payment.paymentId || 'TX-VERIFIED-ARTOPAY'}</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">Waktu Pelunasan</span>
                <span>{data.payment.paymentDate || (data.payment.paidAt ? new Date(data.payment.paidAt).toLocaleString('id-ID') : '-')}</span>
              </div>
            </div>
          </div>

          {/* Section: Itinerary Snapshot */}
          {data.trip.itinerary && Array.isArray(data.trip.itinerary) && data.trip.itinerary.length > 0 && (
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200/80 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span>Jadwal &amp; Rencana Perjalanan (Itinerary)</span>
              </h3>
              <div className="space-y-1.5 text-xs text-neutral-700 mt-2">
                {data.trip.itinerary.map((item: any, idx: number) => {
                  const title = typeof item === 'string' ? item : (item.title || item.day || `Hari ${idx + 1}`);
                  const desc = typeof item === 'object' && item.desc ? item.desc : (typeof item === 'object' && item.activities ? item.activities.join(', ') : null);
                  return (
                    <div key={idx} className="flex items-start gap-2 bg-white p-2.5 rounded-lg border border-neutral-200/60">
                      <span className="font-mono text-amber-600 font-bold shrink-0">{idx + 1}.</span>
                      <div>
                        <span className="font-bold text-neutral-900">{title}</span>
                        {desc && <p className="text-[11px] text-neutral-500 mt-0.5">{desc}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Terms & Operational Notice */}
          <div className="border-t border-neutral-200 pt-4 text-[11px] text-neutral-500 space-y-1">
            <p className="font-bold text-neutral-700">Ketentuan Penting &amp; Layanan Operasional:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Pemandu wisata / Driver Smart Journey akan menghubungi tamu via WhatsApp H-1 sebelum jam keberangkatan.</li>
              <li>Mohon siap di lokasi penjemputan 15 menit sebelum jadwal. Simpan bukti Final Booking Summary ini di ponsel Anda.</li>
              <li>Layanan bantuan 24 Jam via WhatsApp: <strong className="text-neutral-800">+62 852-1234-7289</strong> atau email <strong className="text-neutral-800">support@smartjourney.co.id</strong>.</li>
            </ul>
          </div>

          {/* Official Footer Timestamp */}
          <div className="text-center pt-2 text-[10px] text-neutral-400 font-mono">
            Dokumen ini diterbitkan secara resmi oleh Smart Journey Indonesia pada {new Date().toLocaleString('id-ID')} • Seluruh Hak Cipta Dilindungi
          </div>

        </div>

      </div>
    </div>
  );
}

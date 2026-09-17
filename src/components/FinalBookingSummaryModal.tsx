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
  bookingStatus: string;
  paymentStatus: string;
  verificationHash?: string;
  generatedAt?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    pickupLocation?: string;
  };
  trip: {
    title: string;
    departureDate: string;
    duration: string;
    participantsCount: number;
    participantsNames?: string[];
    vehicleName?: string;
    pickupLocation?: string;
    itinerary?: string[] | any[];
  };
  payment: {
    baseAmount: number;
    uniqueCode: number;
    totalPaid: number;
    currency?: string;
    paidAt?: string;
    paymentId?: string;
    paymentMethod?: string;
  };
  company?: {
    name: string;
    legalEntity?: string;
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

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SmartJourney_Summary_${data.bookingCode}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formattedTotal = (data.payment.totalPaid || 0).toLocaleString('id-ID');
  const formattedBase = (data.payment.baseAmount || 0).toLocaleString('id-ID');

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 md:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white text-neutral-900 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-neutral-200 my-4">
        
        {/* Modal Top Actions (Hidden in Print) */}
        <div className="bg-neutral-900 text-white px-6 py-4 flex items-center justify-between print:hidden">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <span className="font-bold text-sm tracking-wide">DOKUMEN RESMI — FINAL BOOKING SUMMARY</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors cursor-pointer"
              title="Cetak atau Simpan PDF"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Cetak / Simpan PDF</span>
            </button>
            <button
              onClick={handleDownloadJSON}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-black transition-colors cursor-pointer"
              title="Unduh Snapshot JSON"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Unduh Data</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
                  OFFICIAL SNAPSHOT
                </span>
              </div>
              <p className="text-xs text-neutral-500 font-medium">PT Smart Journey Transindo • Lisensi Resmi Biro Perjalanan Wisata</p>
              <p className="text-[11px] text-neutral-400 font-mono">Malang &amp; Surabaya, Jawa Timur • Hotline: +62 852-1234-7289</p>
            </div>

            <div className="sm:text-right bg-neutral-50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-neutral-200">
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block font-bold">Booking Code</span>
              <span className="text-2xl font-black font-mono text-amber-600 block">{data.bookingCode}</span>
              <div className="mt-1 flex sm:justify-end items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  CONFIRMED &amp; PAID
                </span>
              </div>
            </div>
          </div>

          {/* Section: Status Snapshot Banner */}
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-500 text-white rounded-lg shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-950">Pemesanan Tur Privat Resmi Dikonfirmasi</h4>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Seluruh biaya telah dilunasi dan armada serta pemandu wisata telah dijadwalkan oleh Tim Operasional Smart Journey.
                </p>
              </div>
            </div>
            {data.verificationHash && (
              <div className="text-[10px] font-mono text-emerald-800/80 bg-white/70 px-2.5 py-1 rounded border border-emerald-200 self-stretch sm:self-auto text-center sm:text-right">
                <span className="block text-[9px] uppercase font-bold text-neutral-400">Security Hash</span>
                {data.verificationHash}
              </div>
            )}
          </div>

          {/* Section: 2 Columns (Customer & Trip) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Column 1: Customer Details */}
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200/80 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-amber-500" />
                <span>Informasi Tamu &amp; Kontak</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-neutral-400 block text-[10px]">Nama Tamu Utama</span>
                  <span className="font-bold text-neutral-900 text-sm">{data.customer.name}</span>
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
                {data.customer.pickupLocation && (
                  <div className="pt-1 border-t border-neutral-200/60">
                    <span className="text-neutral-400 block text-[10px]">Lokasi Penjemputan</span>
                    <span className="font-medium text-neutral-800">{data.customer.pickupLocation}</span>
                  </div>
                )}
                {data.trip.participantsNames && data.trip.participantsNames.length > 0 && (
                  <div className="pt-1 border-t border-neutral-200/60">
                    <span className="text-neutral-400 block text-[10px]">Daftar Peserta ({data.trip.participantsCount} Orang)</span>
                    <ul className="list-disc list-inside text-neutral-700 space-y-0.5 mt-0.5">
                      {data.trip.participantsNames.map((name, i) => (
                        <li key={i} className="font-medium">{name}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Trip Specifications */}
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200/80 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-amber-500" />
                <span>Spesifikasi Paket Tur</span>
              </h3>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-neutral-400 block text-[10px]">Paket Private Tour</span>
                  <span className="font-black text-neutral-900 text-sm text-amber-700">{data.trip.title}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200/60">
                  <div>
                    <span className="text-neutral-400 block text-[10px]">Tanggal Keberangkatan</span>
                    <span className="font-bold text-neutral-800">{data.trip.departureDate || '-'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[10px]">Durasi Wisata</span>
                    <span className="font-bold text-neutral-800">{data.trip.duration || '1 Hari'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200/60">
                  <div>
                    <span className="text-neutral-400 block text-[10px]">Jumlah Peserta</span>
                    <span className="font-bold text-neutral-800">{data.trip.participantsCount} Orang</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[10px]">Armada Privat</span>
                    <span className="font-bold text-neutral-800">{data.trip.vehicleName || 'Private Tour Car'}</span>
                  </div>
                </div>
              </div>
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
                <span className="text-neutral-400 block text-[10px]">Harga Dasar Tur</span>
                <span className="font-mono font-bold text-neutral-800 text-sm">Rp {formattedBase}</span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-neutral-200">
                <span className="text-neutral-400 block text-[10px]">Kode Unik Verifikasi</span>
                <span className="font-mono font-bold text-neutral-800 text-sm">Rp {(data.payment.uniqueCode || 0).toLocaleString('id-ID')}</span>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                <span className="text-emerald-700 block text-[10px] font-bold">Total Pembayaran Lunas</span>
                <span className="font-mono font-black text-emerald-800 text-base">Rp {formattedTotal}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-neutral-200/70 text-[11px] text-neutral-600 font-mono">
              <div>
                <span className="text-neutral-400 block text-[10px]">Metode Pembayaran</span>
                <span>{data.payment.paymentMethod || 'ArtoPay Gateway'}</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">Nomor Transaksi</span>
                <span className="truncate block">{data.payment.paymentId || 'TX-VERIFIED'}</span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">Waktu Pembayaran</span>
                <span>{data.payment.paidAt ? new Date(data.payment.paidAt).toLocaleString('id-ID') : '-'}</span>
              </div>
            </div>
          </div>

          {/* Section: Itinerary Snapshot (If Available) */}
          {data.trip.itinerary && Array.isArray(data.trip.itinerary) && data.trip.itinerary.length > 0 && (
            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200/80 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span>Jadwal &amp; Rencana Perjalanan (Itinerary)</span>
              </h3>
              <div className="space-y-1.5 text-xs text-neutral-700 mt-2">
                {data.trip.itinerary.map((item: any, idx: number) => {
                  const title = typeof item === 'string' ? item : (item.title || item.time || `Aktivitas ${idx + 1}`);
                  const desc = typeof item === 'object' && item.desc ? item.desc : null;
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
            Dokumen ini diterbitkan secara otomatis oleh Sistem Reservasi Smart Journey Indonesia pada {new Date().toLocaleString('id-ID')} • Hak Cipta Dilindungi Undang-Undang
          </div>

        </div>

      </div>
    </div>
  );
}

import React from 'react';
import { 
  X, Check, ShieldCheck, AlertTriangle, Clock, Calendar, MapPin, 
  User, Mail, Phone, Car, Plane, DollarSign, Download, Printer, 
  ExternalLink, Sparkles, Shield, AlertCircle, FileText, CheckCircle2,
  Users, Luggage, Navigation, ArrowRight, Ban, Compass, Hash, Info
} from 'lucide-react';

export interface UnifiedBookingDetail {
  id: string;
  bookingCode: string;
  source: 'main' | 'sharetour';
  serviceType: 'tour' | 'sharetour' | 'airport' | 'taxi' | 'car-rental' | string;
  serviceTitle: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  emergencyContact?: string;
  flightNumber?: string;
  date: string;
  time?: string;
  passengers: number;
  participantNames?: string[];
  pickupLocation?: string;
  dropoffLocation?: string;
  itinerarySummary?: string[];
  vehicleName?: string;
  duration?: string;
  withDriver?: boolean;
  meetingPoint?: string;
  batchId?: string;
  departureDate?: string;
  luggage?: number;
  direction?: string;
  routeType?: string;
  returnDate?: string;
  returnTime?: string;
  operationalCity?: string;
  pickupArea?: string;
  dropoffArea?: string;
  selectedAddons?: string[];
  pricingBreakdown?: any;
  nationalityType?: string;
  specialRequests?: string;
  notes?: string;
  totalAmountIDR?: number;
  totalAmountUSD?: number;
  uniqueCode?: number;
  baseAmount?: number;
  paymentStatus: 'Pending' | 'Paid' | 'Failed' | 'Expired' | string;
  bookingStatus: 'Pending Payment' | 'Pending Confirmation' | 'Confirmed' | 'Completed' | 'Cancelled' | string;
  createdAt?: string;
  paidAt?: string;
  confirmedAt?: string;
  paymentMethod?: string;
  rawBooking?: any;
}

interface BookingDetailModalProps {
  booking: UnifiedBookingDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmBooking?: (id: string, source: 'main' | 'sharetour') => void;
  onCompleteBooking?: (id: string, source: 'main' | 'sharetour') => void;
  onCancelBooking?: (id: string, source: 'main' | 'sharetour') => void;
  formatPrice: (usdPrice: number, idrPrice: number) => string;
  isDark?: boolean;
}

export default function BookingDetailModal({
  booking,
  isOpen,
  onClose,
  onConfirmBooking,
  onCompleteBooking,
  onCancelBooking,
  formatPrice,
  isDark = false
}: BookingDetailModalProps) {
  if (!isOpen || !booking) return null;

  const isPaid = (booking.paymentStatus || '').toLowerCase() === 'paid';
  const isConfirmed = (booking.bookingStatus || '').toLowerCase() === 'confirmed';
  const isCompleted = (booking.bookingStatus || '').toLowerCase() === 'completed';
  const isCancelled = (booking.bookingStatus || '').toLowerCase() === 'cancelled';
  const isPendingConfirmation = 
    (booking.bookingStatus || '').toLowerCase().includes('pending confirmation') || 
    (booking.bookingStatus === 'Pending' && isPaid) ||
    (isPaid && !isConfirmed && !isCompleted && !isCancelled);

  const getServiceBadge = (type: string) => {
    switch (type) {
      case 'tour':
        return { label: 'Private Tour', color: 'bg-amber-500/10 text-amber-500 border-amber-500/30' };
      case 'sharetour':
        return { label: 'Open Trip (Share Tour)', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' };
      case 'airport':
        return { label: 'Airport Transfer', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' };
      case 'taxi':
        return { label: 'Taxi Service', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30' };
      case 'car-rental':
      case 'rental':
        return { label: 'Car Rental', color: 'bg-purple-500/10 text-purple-500 border-purple-500/30' };
      default:
        return { label: 'Smart Journey Service', color: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/30' };
    }
  };

  const serviceBadge = getServiceBadge(booking.serviceType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/75 backdrop-blur-xs animate-fade-in">
      <div 
        className={`relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border ${
          isDark 
            ? 'bg-neutral-900 border-neutral-800 text-neutral-100' 
            : 'bg-white border-neutral-200 text-neutral-900 shadow-2xl'
        } p-6 space-y-6 text-left`}
      >
        {/* Header Bar */}
        <div className={`flex items-start justify-between border-b ${isDark ? 'border-neutral-800' : 'border-neutral-200'} pb-4`}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${serviceBadge.color}`}>
                {serviceBadge.label}
              </span>
              <span className="text-xs font-mono font-black text-amber-500 tracking-wider">
                #{booking.bookingCode}
              </span>
            </div>
            <h2 className="text-lg font-black tracking-tight font-sans">
              {booking.serviceTitle || 'Pemesanan Layanan'}
            </h2>
            <p className="text-xs text-neutral-500 font-mono">
              ID Sistem: {booking.id} · Dibuat: {booking.createdAt ? new Date(booking.createdAt).toLocaleString('id-ID') : '-'}
            </p>
          </div>

          <button 
            onClick={onClose}
            className={`p-1.5 rounded-lg border ${
              isDark ? 'border-neutral-800 hover:bg-neutral-800 text-neutral-400' : 'border-neutral-200 hover:bg-neutral-100 text-neutral-500'
            } transition-all cursor-pointer`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* STATUS CARDS SECTION (MANDATORY SEPARATION) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* 1. Payment Status (Pending / Paid) */}
          <div className={`p-4 rounded-xl border ${
            isPaid 
              ? 'bg-emerald-500/10 border-emerald-500/30' 
              : 'bg-amber-500/10 border-amber-500/30'
          }`}>
            <span className="text-[10px] font-mono uppercase font-bold text-neutral-500 block mb-1">
              STATUS PEMBAYARAN (paymentStatus)
            </span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isPaid ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
                )}
                <span className={`text-sm font-black font-mono uppercase ${
                  isPaid ? 'text-emerald-500' : 'text-amber-500'
                }`}>
                  {booking.paymentStatus || 'Pending'}
                </span>
              </div>
              {booking.paidAt && (
                <span className="text-[10px] font-mono text-neutral-400">
                  Lunas: {new Date(booking.paidAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            {!isPaid ? (
              <p className="text-[10px] text-amber-600 mt-2 font-medium">
                ⚠️ Menunggu konfirmasi pembayaran lunas (ArtoPay webhook / transfer). Admin hanya dapat mengonfirmasi booking jika status pembayaran adalah <strong>Paid</strong>.
              </p>
            ) : (
              <p className="text-[10px] text-emerald-600 mt-2 font-medium">
                ✓ Pembayaran telah lunas diverifikasi.
              </p>
            )}
          </div>

          {/* 2. Booking Operational Status */}
          <div className={`p-4 rounded-xl border ${
            isConfirmed 
              ? 'bg-blue-500/10 border-blue-500/30' 
              : isCompleted
                ? 'bg-purple-500/10 border-purple-500/30'
                : isCancelled
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : isPendingConfirmation
                    ? 'bg-cyan-500/10 border-cyan-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
          }`}>
            <span className="text-[10px] font-mono uppercase font-bold text-neutral-500 block mb-1">
              STATUS BOOKING / OPERASIONAL (bookingStatus)
            </span>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isConfirmed ? (
                  <ShieldCheck className="h-5 w-5 text-blue-500" />
                ) : isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-purple-500" />
                ) : isCancelled ? (
                  <AlertTriangle className="h-5 w-5 text-rose-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                )}
                <span className={`text-sm font-black font-mono uppercase ${
                  isConfirmed ? 'text-blue-500' : isCompleted ? 'text-purple-500' : isCancelled ? 'text-rose-500' : 'text-amber-500'
                }`}>
                  {booking.bookingStatus}
                </span>
              </div>
              {booking.confirmedAt && (
                <span className="text-[10px] font-mono text-neutral-400">
                  Dikonfirmasi: {new Date(booking.confirmedAt).toLocaleDateString('id-ID')}
                </span>
              )}
            </div>
            {isConfirmed && (
              <p className="text-[10px] text-blue-600 mt-2 font-medium">
                ✅ Booking telah dikonfirmasi Admin. Akses voucher & invoice resmi customer aktif.
              </p>
            )}
            {isPendingConfirmation && (
              <p className="text-[10px] text-cyan-600 mt-2 font-medium">
                ⚡ Pembayaran sudah lunas. Menunggu konfirmasi Admin (Siap Dikonfirmasi).
              </p>
            )}
          </div>
        </div>

        {/* 2-COLUMN LAYOUT: CUSTOMER INFO & OPERATIONAL DETAILS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Customer / Guest Info */}
          <div className={`p-4 rounded-xl border ${isDark ? 'border-neutral-800 bg-neutral-950/40' : 'border-neutral-200 bg-neutral-50/70'} space-y-3`}>
            <h3 className="text-xs font-black uppercase font-mono tracking-wider text-amber-500 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              <span>DATA PELANGGAN (CUSTOMER)</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-dashed border-neutral-700/40 pb-1.5">
                <span className="text-neutral-500">Nama Utama:</span>
                <span className="font-bold text-neutral-200">{booking.customerName}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-neutral-700/40 pb-1.5">
                <span className="text-neutral-500">Nomor Telepon:</span>
                <span className="font-mono font-bold text-neutral-200">{booking.customerPhone}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-neutral-700/40 pb-1.5">
                <span className="text-neutral-500">Email:</span>
                <span className="font-mono text-neutral-300">{booking.customerEmail}</span>
              </div>
              {booking.emergencyContact && (
                <div className="flex justify-between border-b border-dashed border-neutral-700/40 pb-1.5">
                  <span className="text-neutral-500">Kontak Darurat / WeChat:</span>
                  <span className="font-mono text-neutral-300">{booking.emergencyContact}</span>
                </div>
              )}
              {booking.nationalityType && (
                <div className="flex justify-between border-b border-dashed border-neutral-700/40 pb-1.5">
                  <span className="text-neutral-500">Kewarganegaraan:</span>
                  <span className="font-mono font-bold text-neutral-300">{booking.nationalityType}</span>
                </div>
              )}
            </div>
          </div>

          {/* Operational Details By Service */}
          <div className={`p-4 rounded-xl border ${isDark ? 'border-neutral-800 bg-neutral-950/40' : 'border-neutral-200 bg-neutral-50/70'} space-y-3`}>
            <h3 className="text-xs font-black uppercase font-mono tracking-wider text-amber-500 flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5" />
              <span>JADWAL &amp; TITIK OPERASIONAL</span>
            </h3>

            <div className="space-y-2 text-xs">
              {/* If Open Trip, prominently show departureDate as official date */}
              {booking.serviceType === 'sharetour' ? (
                <div className="flex justify-between border-b border-dashed border-emerald-500/40 pb-1.5 bg-emerald-500/5 px-2 py-1 rounded">
                  <span className="text-emerald-400 font-bold">Tanggal Keberangkatan Resmi (departureDate):</span>
                  <span className="font-mono font-black text-emerald-400 text-sm">
                    {booking.departureDate || booking.date || '-'}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between border-b border-dashed border-neutral-700/40 pb-1.5">
                  <span className="text-neutral-500">Tanggal Operasional:</span>
                  <span className="font-mono font-bold text-amber-400">{booking.date || '-'}</span>
                </div>
              )}

              {booking.time && (
                <div className="flex justify-between border-b border-dashed border-neutral-700/40 pb-1.5">
                  <span className="text-neutral-500">Waktu / Jam:</span>
                  <span className="font-mono font-bold text-neutral-200">{booking.time}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-dashed border-neutral-700/40 pb-1.5">
                <span className="text-neutral-500">Jumlah Penumpang (Pax):</span>
                <span className="font-mono font-bold text-neutral-200">{booking.passengers} Orang</span>
              </div>

              {booking.meetingPoint && (
                <div className="flex justify-between border-b border-dashed border-neutral-700/40 pb-1.5">
                  <span className="text-neutral-500">Titik Kumpul (Meeting Point):</span>
                  <span className="text-right text-neutral-200 font-medium">{booking.meetingPoint}</span>
                </div>
              )}

              {booking.pickupLocation && (
                <div className="flex justify-between border-b border-dashed border-neutral-700/40 pb-1.5">
                  <span className="text-neutral-500">Titik Jemput (Pickup):</span>
                  <span className="text-right max-w-[200px] truncate text-neutral-200 font-medium">{booking.pickupLocation}</span>
                </div>
              )}

              {booking.dropoffLocation && (
                <div className="flex justify-between border-b border-dashed border-neutral-700/40 pb-1.5">
                  <span className="text-neutral-500">Tujuan (Destination):</span>
                  <span className="text-right max-w-[200px] truncate text-neutral-200 font-medium">{booking.dropoffLocation}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SERVICE-SPECIFIC ACCENT PANEL */}
        {booking.serviceType === 'sharetour' && (
          <div className={`p-4 rounded-xl border ${isDark ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/50'} space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase font-mono tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5" />
                <span>SPESIFIKASI KHUSUS OPEN TRIP (SHARE TOUR)</span>
              </h3>
              {booking.batchId && (
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                  Batch ID: #{booking.batchId}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-neutral-500 block mb-1">Tanggal Keberangkatan Resmi:</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  {booking.departureDate || booking.date || '-'}
                </span>
              </div>
              <div>
                <span className="text-neutral-500 block mb-1">Titik Kumpul / Pickup Point:</span>
                <span className="font-medium text-neutral-200">
                  {booking.meetingPoint || booking.pickupLocation || 'Sesuai kesepakatan meeting point trip'}
                </span>
              </div>
            </div>

            {booking.participantNames && booking.participantNames.length > 0 && (
              <div className="pt-2 border-t border-emerald-500/20">
                <span className="text-[11px] font-bold text-neutral-400 block mb-1.5">
                  Manifest Nama Peserta Terdaftar ({booking.participantNames.length} Orang):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {booking.participantNames.map((name, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono text-[11px]">
                      {idx + 1}. {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {booking.serviceType === 'airport' && (
          <div className={`p-4 rounded-xl border ${isDark ? 'border-blue-500/20 bg-blue-500/5' : 'border-blue-200 bg-blue-50/50'} space-y-3`}>
            <h3 className="text-xs font-black uppercase font-mono tracking-wider text-blue-400 flex items-center gap-1.5">
              <Plane className="h-3.5 w-3.5" />
              <span>SPESIFIKASI AIRPORT TRANSFER</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block">Nomor Penerbangan</span>
                <span className="font-mono font-bold text-amber-400">{booking.flightNumber || '-'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block">Arah Perjalanan</span>
                <span className="font-semibold text-neutral-200">{booking.direction || 'Bandara ⇄ Kota'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block">Tipe Rute</span>
                <span className="font-semibold text-neutral-200">{booking.routeType || 'One Way'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block">Jumlah Bagasi</span>
                <span className="font-mono font-bold text-neutral-200">
                  {booking.luggage ? `${booking.luggage} Koper` : `${booking.passengers} Standar`}
                </span>
              </div>
            </div>

            {booking.returnDate && (
              <div className="p-2.5 rounded-lg bg-neutral-900/40 border border-blue-500/30 text-xs flex justify-between items-center">
                <span className="text-blue-400 font-bold">Jadwal Pengantaran Kembali (Round Trip):</span>
                <span className="font-mono text-neutral-200">{booking.returnDate} {booking.returnTime ? `· ${booking.returnTime}` : ''}</span>
              </div>
            )}
          </div>
        )}

        {booking.serviceType === 'taxi' && (
          <div className={`p-4 rounded-xl border ${isDark ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50/50'} space-y-3`}>
            <h3 className="text-xs font-black uppercase font-mono tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Car className="h-3.5 w-3.5" />
              <span>SPESIFIKASI TAXI SERVICE</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block">Zona Penjemputan</span>
                <span className="font-semibold text-neutral-200">{booking.pickupLocation || booking.pickupArea || '-'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block">Zona Tujuan</span>
                <span className="font-semibold text-neutral-200">{booking.dropoffLocation || booking.dropoffArea || '-'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block">Kategori Armada</span>
                <span className="font-bold text-amber-400">{booking.vehicleName || 'Standard Taxi'}</span>
              </div>
            </div>
          </div>
        )}

        {(booking.serviceType === 'car-rental' || booking.serviceType === 'rental') && (
          <div className={`p-4 rounded-xl border ${isDark ? 'border-purple-500/20 bg-purple-500/5' : 'border-purple-200 bg-purple-50/50'} space-y-3`}>
            <h3 className="text-xs font-black uppercase font-mono tracking-wider text-purple-400 flex items-center gap-1.5">
              <Car className="h-3.5 w-3.5" />
              <span>SPESIFIKASI CAR RENTAL (SEWA MOBIL)</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block">Armada Mobil</span>
                <span className="font-bold text-neutral-200">{booking.vehicleName || 'Avanza / Xenia'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block">Kota Operasional</span>
                <span className="font-semibold text-neutral-200">{booking.operationalCity || 'Jawa Timur'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block">Durasi Sewa</span>
                <span className="font-mono font-bold text-neutral-200">{booking.duration || '1 Hari'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block">Opsi Supir</span>
                <span className="font-bold text-amber-400">{booking.withDriver ? 'Dengan Supir' : 'Lepas Kunci'}</span>
              </div>
            </div>

            {booking.selectedAddons && booking.selectedAddons.length > 0 && (
              <div className="pt-2 border-t border-purple-500/20">
                <span className="text-[11px] font-bold text-neutral-400 block mb-1">Add-ons Tambahan:</span>
                <div className="flex flex-wrap gap-1.5">
                  {booking.selectedAddons.map((addon, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 font-mono text-[10px]">
                      + {addon}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {booking.serviceType === 'tour' && (
          <div className={`p-4 rounded-xl border ${isDark ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-200 bg-amber-50/50'} space-y-3`}>
            <h3 className="text-xs font-black uppercase font-mono tracking-wider text-amber-400 flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5" />
              <span>SPESIFIKASI PRIVATE TOUR</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block">Paket Tour</span>
                <span className="font-semibold text-neutral-200">{booking.serviceTitle}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block">Durasi</span>
                <span className="font-mono font-bold text-neutral-200">{booking.duration || 'Sesuai Paket'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-neutral-800">
                <span className="text-[10px] text-neutral-500 block">Armada Disediakan</span>
                <span className="font-bold text-amber-400">{booking.vehicleName || 'Innova Reborn / Hiace'}</span>
              </div>
            </div>
          </div>
        )}

        {/* SPECIAL REQUESTS IF ANY */}
        {booking.specialRequests && (
          <div className={`p-3 rounded-xl border ${isDark ? 'border-neutral-800 bg-neutral-900/60' : 'border-neutral-200 bg-neutral-100/60'} text-xs space-y-1`}>
            <span className="text-[10px] font-mono uppercase text-amber-500 font-bold block">
              Catatan / Permintaan Khusus Tamu:
            </span>
            <p className="text-neutral-300 italic">{booking.specialRequests}</p>
          </div>
        )}

        {/* FINANCIAL SUMMARY */}
        <div className={`p-4 rounded-xl border ${isDark ? 'border-neutral-800 bg-neutral-950/60' : 'border-neutral-200 bg-neutral-100/60'} space-y-2`}>
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500 font-mono uppercase">Rincian Pembayaran</span>
            <span className="text-[10px] font-mono text-neutral-400">Gateway: ArtoPay Production / Sandbox</span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div>
              <span className="text-xs text-neutral-400 block">Total Transaksi</span>
              {booking.uniqueCode ? (
                <span className="text-[10px] font-mono text-amber-500 font-bold block">
                  Termasuk Kode Unik: +Rp {booking.uniqueCode}
                </span>
              ) : null}
            </div>
            <div className="text-right">
              <span className="text-xl font-black font-mono text-amber-500">
                {booking.totalAmountIDR 
                  ? `Rp ${Number(booking.totalAmountIDR).toLocaleString('id-ID')}` 
                  : (booking.totalAmountUSD ? formatPrice(booking.totalAmountUSD, booking.totalAmountIDR || 0) : '-')}
              </span>
              {booking.totalAmountUSD && (
                <span className="text-xs text-neutral-400 block font-mono">
                  (${booking.totalAmountUSD} USD)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS FOOTER */}
        <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t ${isDark ? 'border-neutral-800' : 'border-neutral-200'}`}>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => window.print()}
              className={`px-3 py-2 rounded-xl border ${
                isDark ? 'border-neutral-800 hover:bg-neutral-800 text-neutral-300' : 'border-neutral-200 hover:bg-neutral-100 text-neutral-700'
              } flex items-center gap-1.5 font-bold cursor-pointer transition-all`}
            >
              <Printer className="h-4 w-4" />
              <span>Cetak Ringkasan</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Cancel Action Button (if not completed or already cancelled) */}
            {!isCompleted && !isCancelled && onCancelBooking && (
              <button
                onClick={() => {
                  if (confirm(`Yakin ingin membatalkan booking #${booking.bookingCode}?`)) {
                    onCancelBooking(booking.id, booking.source);
                  }
                }}
                className="px-3.5 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5"
                title="Batalkan Booking"
              >
                <Ban className="h-3.5 w-3.5" />
                <span>Batalkan</span>
              </button>
            )}

            {/* Confirm Action Button: ONLY enabled if paymentStatus === Paid */}
            {!isConfirmed && !isCompleted && !isCancelled && (
              <button
                disabled={!isPaid}
                onClick={() => {
                  if (!isPaid) return;
                  if (onConfirmBooking) {
                    onConfirmBooking(booking.id, booking.source);
                  }
                }}
                className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
                  isPaid
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-neutral-950 cursor-pointer shadow-md'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700 opacity-60'
                }`}
                title={!isPaid ? 'Admin tidak boleh konfirmasi jika status pembayaran belum Paid' : 'Konfirmasi Booking ini'}
              >
                <Check className="h-4 w-4 stroke-[3]" />
                <span>Konfirmasi Booking</span>
              </button>
            )}

            {/* Complete Action Button: enabled when isConfirmed */}
            {isConfirmed && !isCompleted && (
              <button
                onClick={() => {
                  if (onCompleteBooking) {
                    onCompleteBooking(booking.id, booking.source);
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-black text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md"
              >
                <ShieldCheck className="h-4 w-4 stroke-[2.5]" />
                <span>Tandai Selesai (Completed)</span>
              </button>
            )}

            <button
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl border ${
                isDark ? 'border-neutral-800 hover:bg-neutral-800 text-neutral-300' : 'border-neutral-200 hover:bg-neutral-100 text-neutral-700'
              } font-bold text-xs cursor-pointer transition-all`}
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

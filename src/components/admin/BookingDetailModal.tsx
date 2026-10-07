import React from 'react';
import { 
  X, Check, ShieldCheck, AlertTriangle, Clock, Calendar, MapPin, 
  User, Mail, Phone, Car, Plane, DollarSign, Download, Printer, 
  ExternalLink, Sparkles, Shield, AlertCircle, FileText, CheckCircle2,
  Users, Luggage, Navigation, ArrowRight, Ban, Compass, Hash, Info,
  CreditCard
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
  discount?: number;
  promoCode?: string;
  paymentAmount?: number;
  finalPaymentAmount?: number;
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
      case 'gathering':
      case 'event-gathering':
        return { label: 'Event & Gathering', color: 'bg-teal-500/10 text-teal-400 border-teal-500/30' };
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

  // Dynamic high-contrast classes ensuring crisp readability in Admin Dashboard Light & Dark modes
  const labelColor = isDark ? 'text-neutral-400' : 'text-slate-700 font-semibold';
  const labelHeaderColor = isDark ? 'text-neutral-400' : 'text-slate-800 font-bold';
  const valueColor = isDark ? 'text-neutral-200' : 'text-slate-900 font-bold';
  const valueMonoColor = `font-mono ${isDark ? 'text-neutral-200' : 'text-slate-900 font-bold'}`;
  const subtextColor = isDark ? 'text-neutral-300' : 'text-slate-800 font-medium';
  const dividerColor = isDark ? 'border-neutral-700/40' : 'border-slate-200';
  const miniCardBg = isDark ? 'bg-neutral-900/50 border-neutral-800' : 'bg-white border-slate-200 shadow-xs';

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
            <p className={`text-xs font-mono ${isDark ? 'text-neutral-400' : 'text-slate-700 font-medium'}`}>
              <span className={isDark ? 'text-neutral-400' : 'text-slate-800 font-bold'}>ID Sistem Booking:</span>{' '}
              <span className={isDark ? 'text-neutral-200' : 'text-slate-900 font-semibold'}>{booking.id}</span>
              {' · '}
              <span className={isDark ? 'text-neutral-400' : 'text-slate-800 font-bold'}>Dibuat:</span>{' '}
              <span className={isDark ? 'text-neutral-200' : 'text-slate-900 font-semibold'}>
                {booking.createdAt ? new Date(booking.createdAt).toLocaleString('id-ID') : '-'}
              </span>
            </p>
          </div>

          <button 
            onClick={onClose}
            className={`p-1.5 rounded-lg border ${
              isDark ? 'border-neutral-800 hover:bg-neutral-800 text-neutral-400' : 'border-neutral-200 hover:bg-neutral-100 text-neutral-700'
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
            <span className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelHeaderColor}`}>
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
                <span className={`text-[10px] font-mono ${subtextColor}`}>
                  Lunas: {new Date(booking.paidAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            {!isPaid ? (
              <p className={`text-[10px] mt-2 font-medium ${isDark ? 'text-amber-400' : 'text-amber-800'}`}>
                ⚠️ Menunggu konfirmasi pembayaran lunas (ArtoPay webhook / transfer). Admin hanya dapat mengonfirmasi booking jika status pembayaran adalah <strong>Paid</strong>.
              </p>
            ) : (
              <p className={`text-[10px] mt-2 font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>
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
            <span className={`text-[10px] font-mono uppercase font-bold block mb-1 ${labelHeaderColor}`}>
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
                <span className={`text-[10px] font-mono ${subtextColor}`}>
                  Dikonfirmasi: {new Date(booking.confirmedAt).toLocaleDateString('id-ID')}
                </span>
              )}
            </div>
            {isConfirmed && (
              <p className={`text-[10px] mt-2 font-medium ${isDark ? 'text-blue-400' : 'text-blue-800'}`}>
                ✅ Booking telah dikonfirmasi Admin. Akses voucher & invoice resmi customer aktif.
              </p>
            )}
            {isPendingConfirmation && (
              <p className={`text-[10px] mt-2 font-medium ${isDark ? 'text-cyan-400' : 'text-cyan-800'}`}>
                ⚡ Pembayaran sudah lunas. Menunggu konfirmasi Admin (Siap Dikonfirmasi).
              </p>
            )}
          </div>
        </div>

        {/* 2-COLUMN LAYOUT: CUSTOMER INFO & OPERATIONAL DETAILS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Customer / Guest Info */}
          <div className={`p-4 rounded-xl border ${isDark ? 'border-neutral-800 bg-neutral-950/40' : 'border-slate-200 bg-slate-50/70'} space-y-3`}>
            <h3 className="text-xs font-black uppercase font-mono tracking-wider text-amber-500 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              <span>DATA PELANGGAN (CUSTOMER)</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className={`flex justify-between border-b border-dashed ${dividerColor} pb-1.5`}>
                <span className={labelColor}>Nama Utama:</span>
                <span className={valueColor}>{booking.customerName}</span>
              </div>
              <div className={`flex justify-between border-b border-dashed ${dividerColor} pb-1.5`}>
                <span className={labelColor}>Nomor Telepon:</span>
                <span className={valueMonoColor}>{booking.customerPhone}</span>
              </div>
              <div className={`flex justify-between border-b border-dashed ${dividerColor} pb-1.5`}>
                <span className={labelColor}>Email:</span>
                <span className={`font-mono ${subtextColor}`}>{booking.customerEmail}</span>
              </div>
              {booking.emergencyContact && (
                <div className={`flex justify-between border-b border-dashed ${dividerColor} pb-1.5`}>
                  <span className={labelColor}>Kontak Darurat / WeChat:</span>
                  <span className={`font-mono ${subtextColor}`}>{booking.emergencyContact}</span>
                </div>
              )}
              {booking.nationalityType && (
                <div className={`flex justify-between border-b border-dashed ${dividerColor} pb-1.5`}>
                  <span className={labelColor}>Kewarganegaraan:</span>
                  <span className={valueMonoColor}>{booking.nationalityType}</span>
                </div>
              )}
            </div>
          </div>

          {/* Operational Details By Service */}
          <div className={`p-4 rounded-xl border ${isDark ? 'border-neutral-800 bg-neutral-950/40' : 'border-slate-200 bg-slate-50/70'} space-y-3`}>
            <h3 className="text-xs font-black uppercase font-mono tracking-wider text-amber-500 flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5" />
              <span>JADWAL &amp; TITIK OPERASIONAL</span>
            </h3>

            <div className="space-y-2 text-xs">
              {/* If Open Trip, prominently show departureDate as official date */}
              {booking.serviceType === 'sharetour' ? (
                <div className={`flex justify-between border-b border-dashed ${isDark ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-emerald-300 bg-emerald-50'} pb-1.5 px-2 py-1 rounded`}>
                  <span className={`font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-900'}`}>Tanggal Keberangkatan Resmi (departureDate):</span>
                  <span className={`font-mono font-black text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    {booking.departureDate || booking.date || '-'}
                  </span>
                </div>
              ) : (
                <div className={`flex justify-between border-b border-dashed ${dividerColor} pb-1.5`}>
                  <span className={labelColor}>Tanggal Operasional:</span>
                  <span className="font-mono font-bold text-amber-500">{booking.date || '-'}</span>
                </div>
              )}

              {booking.time && (
                <div className={`flex justify-between border-b border-dashed ${dividerColor} pb-1.5`}>
                  <span className={labelColor}>Waktu / Jam:</span>
                  <span className={valueMonoColor}>{booking.time}</span>
                </div>
              )}
              <div className={`flex justify-between border-b border-dashed ${dividerColor} pb-1.5`}>
                <span className={labelColor}>Jumlah Penumpang (Pax):</span>
                <span className={valueMonoColor}>{booking.passengers} Orang</span>
              </div>

              {booking.meetingPoint && (
                <div className={`flex justify-between border-b border-dashed ${dividerColor} pb-1.5`}>
                  <span className={labelColor}>Titik Kumpul (Meeting Point):</span>
                  <span className={`text-right ${valueColor}`}>{booking.meetingPoint}</span>
                </div>
              )}

              {booking.pickupLocation && (
                <div className={`flex justify-between border-b border-dashed ${dividerColor} pb-1.5`}>
                  <span className={labelColor}>Titik Jemput (Pickup):</span>
                  <span className={`text-right max-w-[200px] truncate ${valueColor}`}>{booking.pickupLocation}</span>
                </div>
              )}

              {booking.dropoffLocation && (
                <div className={`flex justify-between border-b border-dashed ${dividerColor} pb-1.5`}>
                  <span className={labelColor}>Tujuan (Destination):</span>
                  <span className={`text-right max-w-[200px] truncate ${valueColor}`}>{booking.dropoffLocation}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SERVICE-SPECIFIC ACCENT PANEL */}
        {booking.serviceType === 'sharetour' && (
          <div className={`p-4 rounded-xl border ${isDark ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/50'} space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase font-mono tracking-wider text-emerald-500 flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5" />
                <span>SPESIFIKASI KHUSUS OPEN TRIP (SHARE TOUR)</span>
              </h3>
              {booking.batchId && (
                <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">
                  Batch ID: #{booking.batchId}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className={`block mb-1 font-semibold ${labelColor}`}>Tanggal Keberangkatan Resmi:</span>
                <span className={`font-mono font-black text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  {booking.departureDate || booking.date || '-'}
                </span>
              </div>
              <div>
                <span className={`block mb-1 font-semibold ${labelColor}`}>Titik Kumpul / Pickup Point:</span>
                <span className={`font-semibold ${valueColor}`}>
                  {booking.meetingPoint || booking.pickupLocation || 'Sesuai kesepakatan meeting point trip'}
                </span>
              </div>
            </div>

            {booking.participantNames && booking.participantNames.length > 0 && (
              <div className={`pt-2 border-t ${isDark ? 'border-emerald-500/20' : 'border-emerald-200'}`}>
                <span className={`text-[11px] font-bold block mb-1.5 ${isDark ? 'text-neutral-300' : 'text-slate-800'}`}>
                  Manifest Nama Peserta Terdaftar ({booking.participantNames.length} Orang):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {booking.participantNames.map((name, idx) => (
                    <span key={idx} className={`px-2 py-0.5 rounded-md border font-mono text-[11px] font-semibold ${
                      isDark 
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                        : 'bg-emerald-100/80 border-emerald-300 text-emerald-900'
                    }`}>
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
            <h3 className="text-xs font-black uppercase font-mono tracking-wider text-blue-500 flex items-center gap-1.5">
              <Plane className="h-3.5 w-3.5" />
              <span>SPESIFIKASI AIRPORT TRANSFER</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className={`p-2.5 rounded-lg border ${miniCardBg}`}>
                <span className={`text-[10px] block font-semibold ${labelColor}`}>Nomor Penerbangan</span>
                <span className="font-mono font-bold text-amber-500">{booking.flightNumber || '-'}</span>
              </div>
              <div className={`p-2.5 rounded-lg border ${miniCardBg}`}>
                <span className={`text-[10px] block font-semibold ${labelColor}`}>Arah Perjalanan</span>
                <span className={valueColor}>{booking.direction || 'Bandara ⇄ Kota'}</span>
              </div>
              <div className={`p-2.5 rounded-lg border ${miniCardBg}`}>
                <span className={`text-[10px] block font-semibold ${labelColor}`}>Tipe Rute</span>
                <span className={valueColor}>{booking.routeType || 'One Way'}</span>
              </div>
              <div className={`p-2.5 rounded-lg border ${miniCardBg}`}>
                <span className={`text-[10px] block font-semibold ${labelColor}`}>Jumlah Bagasi</span>
                <span className={valueMonoColor}>
                  {booking.luggage ? `${booking.luggage} Koper` : `${booking.passengers} Standar`}
                </span>
              </div>
            </div>

            {booking.returnDate && (
              <div className={`p-2.5 rounded-lg border text-xs flex justify-between items-center ${
                isDark ? 'bg-neutral-900/40 border-blue-500/30' : 'bg-white border-blue-200 shadow-xs'
              }`}>
                <span className={`font-bold ${isDark ? 'text-blue-400' : 'text-blue-800'}`}>Jadwal Pengantaran Kembali (Round Trip):</span>
                <span className={`font-mono font-semibold ${valueColor}`}>{booking.returnDate} {booking.returnTime ? `· ${booking.returnTime}` : ''}</span>
              </div>
            )}
          </div>
        )}

        {booking.serviceType === 'taxi' && (
          <div className={`p-4 rounded-xl border ${isDark ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-indigo-200 bg-indigo-50/50'} space-y-3`}>
            <h3 className="text-xs font-black uppercase font-mono tracking-wider text-indigo-500 flex items-center gap-1.5">
              <Car className="h-3.5 w-3.5" />
              <span>SPESIFIKASI TAXI SERVICE</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className={`p-2.5 rounded-lg border ${miniCardBg}`}>
                <span className={`text-[10px] block font-semibold ${labelColor}`}>Zona Penjemputan</span>
                <span className={valueColor}>{booking.pickupLocation || booking.pickupArea || '-'}</span>
              </div>
              <div className={`p-2.5 rounded-lg border ${miniCardBg}`}>
                <span className={`text-[10px] block font-semibold ${labelColor}`}>Zona Tujuan</span>
                <span className={valueColor}>{booking.dropoffLocation || booking.dropoffArea || '-'}</span>
              </div>
              <div className={`p-2.5 rounded-lg border ${miniCardBg}`}>
                <span className={`text-[10px] block font-semibold ${labelColor}`}>Kategori Armada</span>
                <span className="font-bold text-amber-500">{booking.vehicleName || 'Standard Taxi'}</span>
              </div>
            </div>
          </div>
        )}

        {(booking.serviceType === 'car-rental' || booking.serviceType === 'rental') && (
          <div className={`p-4 rounded-xl border ${isDark ? 'border-purple-500/20 bg-purple-500/5' : 'border-purple-200 bg-purple-50/50'} space-y-3`}>
            <h3 className="text-xs font-black uppercase font-mono tracking-wider text-purple-500 flex items-center gap-1.5">
              <Car className="h-3.5 w-3.5" />
              <span>SPESIFIKASI CAR RENTAL (SEWA MOBIL)</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className={`p-2.5 rounded-lg border ${miniCardBg}`}>
                <span className={`text-[10px] block font-semibold ${labelColor}`}>Armada Mobil</span>
                <span className={valueColor}>{booking.vehicleName || 'Avanza / Xenia'}</span>
              </div>
              <div className={`p-2.5 rounded-lg border ${miniCardBg}`}>
                <span className={`text-[10px] block font-semibold ${labelColor}`}>Kota Operasional</span>
                <span className={valueColor}>{booking.operationalCity || 'Jawa Timur'}</span>
              </div>
              <div className={`p-2.5 rounded-lg border ${miniCardBg}`}>
                <span className={`text-[10px] block font-semibold ${labelColor}`}>Durasi Sewa</span>
                <span className={valueMonoColor}>{booking.duration || '1 Hari'}</span>
              </div>
              <div className={`p-2.5 rounded-lg border ${miniCardBg}`}>
                <span className={`text-[10px] block font-semibold ${labelColor}`}>Opsi Supir</span>
                <span className="font-bold text-amber-500">{booking.withDriver ? 'Dengan Supir' : 'Lepas Kunci'}</span>
              </div>
            </div>

            {booking.selectedAddons && booking.selectedAddons.length > 0 && (
              <div className={`pt-2 border-t ${isDark ? 'border-purple-500/20' : 'border-purple-200'}`}>
                <span className={`text-[11px] font-bold block mb-1 ${isDark ? 'text-neutral-300' : 'text-slate-800'}`}>Add-ons Tambahan:</span>
                <div className="flex flex-wrap gap-1.5">
                  {booking.selectedAddons.map((addon, idx) => (
                    <span key={idx} className={`px-2 py-0.5 rounded border font-mono text-[10px] font-semibold ${
                      isDark 
                        ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' 
                        : 'bg-purple-100/80 border-purple-300 text-purple-900'
                    }`}>
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
            <h3 className="text-xs font-black uppercase font-mono tracking-wider text-amber-500 flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5" />
              <span>SPESIFIKASI PRIVATE TOUR</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className={`p-2.5 rounded-lg border ${miniCardBg}`}>
                <span className={`text-[10px] block font-semibold ${labelColor}`}>Paket Tour</span>
                <span className={valueColor}>{booking.serviceTitle}</span>
              </div>
              <div className={`p-2.5 rounded-lg border ${miniCardBg}`}>
                <span className={`text-[10px] block font-semibold ${labelColor}`}>Durasi</span>
                <span className={valueMonoColor}>{booking.duration || 'Sesuai Paket'}</span>
              </div>
              <div className={`p-2.5 rounded-lg border ${miniCardBg}`}>
                <span className={`text-[10px] block font-semibold ${labelColor}`}>Armada Disediakan</span>
                <span className="font-bold text-amber-500">{booking.vehicleName || 'Innova Reborn / Hiace'}</span>
              </div>
            </div>
          </div>
        )}

        {/* SPECIAL REQUESTS IF ANY */}
        {booking.specialRequests && (
          <div className={`p-3 rounded-xl border ${isDark ? 'border-neutral-800 bg-neutral-900/60' : 'border-slate-200 bg-slate-100/70'} text-xs space-y-1`}>
            <span className="text-[10px] font-mono uppercase text-amber-500 font-bold block">
              Catatan / Permintaan Khusus Tamu:
            </span>
            <p className={`italic ${isDark ? 'text-neutral-200' : 'text-slate-900 font-medium'}`}>{booking.specialRequests}</p>
          </div>
        )}

        {/* FINANCIAL SUMMARY / PAYMENT DETAIL (ARTOPAY PARITY) */}
        {(() => {
          const raw = booking.rawBooking || {};
          const discount = Number(booking.discount ?? raw.discount ?? (raw.details?.discountAmount || 0));
          const promoCode = booking.promoCode || raw.promoCode || raw.details?.promoCode;
          const uniqueCode = Number(booking.uniqueCode ?? raw.unique_code ?? raw.uniqueCode ?? 0);
          let baseAmount = Number(booking.baseAmount ?? raw.base_amount ?? raw.baseAmount ?? 0);
          if (!baseAmount || baseAmount <= 0) {
            const netBase = Number(booking.totalAmountIDR ?? raw.total_price_idr ?? raw.totalPriceIDR ?? (booking as any).totalPrice ?? 0);
            baseAmount = (netBase > 0 && discount > 0) ? (netBase + discount) : netBase;
          }
          const finalPaymentAmount = 
            Number(booking.finalPaymentAmount ?? booking.paymentAmount ?? raw.payment_amount ?? raw.paymentAmount ?? booking.totalAmountIDR ?? raw.total_price_idr ?? 0) ||
            (baseAmount > 0 ? (Math.max(0, baseAmount - discount) + uniqueCode) : 0);

          return (
            <div className={`p-4 rounded-xl border ${isDark ? 'border-neutral-800 bg-neutral-950/60' : 'border-slate-200 bg-slate-50/80'} space-y-3`}>
              <div className={`flex items-center justify-between text-xs border-b ${isDark ? 'border-neutral-800/60' : 'border-slate-200'} pb-2`}>
                <span className={`font-mono uppercase font-bold flex items-center gap-1.5 ${isDark ? 'text-neutral-300' : 'text-slate-900'}`}>
                  <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                  <span>Rincian Pembayaran (Payment Detail)</span>
                </span>
                <span className={`text-[10px] font-mono font-semibold ${isDark ? 'text-neutral-400' : 'text-slate-700'}`}>
                  Gateway: {booking.paymentMethod || 'ArtoPay'}
                </span>
              </div>

              {/* 4 Line Items: Base Price, Discount/Promo, Unique Code, Final Payment Amount */}
              <div className="space-y-2 text-xs font-mono">
                {/* 1. Base Price */}
                <div className="flex items-center justify-between">
                  <span className={labelColor}>1. Harga Dasar Layanan (Base Price):</span>
                  <span className={valueColor}>
                    Rp {baseAmount.toLocaleString('id-ID')}
                  </span>
                </div>

                {/* 2. Discount / Promo */}
                <div className="flex items-center justify-between">
                  <span className={labelColor}>
                    2. Diskon Promo {promoCode ? <strong className="text-emerald-500 uppercase font-sans font-bold">({promoCode})</strong> : ''}:
                  </span>
                  <span className={`font-bold ${discount > 0 ? (isDark ? 'text-emerald-400' : 'text-emerald-700') : (isDark ? 'text-neutral-500' : 'text-slate-600')}`}>
                    {discount > 0 ? `- Rp ${discount.toLocaleString('id-ID')}` : 'Rp 0'}
                  </span>
                </div>

                {/* 3. Unique Code */}
                <div className="flex items-center justify-between">
                  <span className={labelColor}>3. Kode Unik Verifikasi (Unique Code):</span>
                  <span className={`font-bold ${uniqueCode > 0 ? 'text-amber-500' : (isDark ? 'text-neutral-500' : 'text-slate-600')}`}>
                    {uniqueCode > 0 ? `+ Rp ${uniqueCode.toLocaleString('id-ID')}` : 'Rp 0'}
                  </span>
                </div>

                {/* 4. Final Payment Amount (Sent to ArtoPay) */}
                <div className={`flex items-baseline justify-between pt-2.5 border-t ${isDark ? 'border-neutral-800/80' : 'border-slate-200'}`}>
                  <div>
                    <span className="text-xs font-black text-amber-500 block">
                      4. Nominal Final Pembayaran (ArtoPay):
                    </span>
                    <span className={`text-[10px] block font-sans font-medium ${isDark ? 'text-neutral-400' : 'text-slate-700'}`}>
                      Nominal persis sama dengan payload amount yang dikirim ke ArtoPay Gateway
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black font-mono text-amber-500 block">
                      Rp {finalPaymentAmount.toLocaleString('id-ID')}
                    </span>
                    {booking.totalAmountUSD && (
                      <span className={`text-xs block font-mono font-medium ${isDark ? 'text-neutral-400' : 'text-slate-700'}`}>
                        (${booking.totalAmountUSD} USD)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Admin Payment Verification Box */}
              {(() => {
                const expectedFinal = baseAmount > 0 ? (Math.max(0, baseAmount - discount) + uniqueCode) : finalPaymentAmount;
                const isAmountMatched = Math.abs(finalPaymentAmount - expectedFinal) <= 1;
                const isPaymentVerified = isPaid && isAmountMatched;

                return (
                  <div className={`p-3 rounded-xl border ${
                    isPaymentVerified
                      ? isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : !isPaid
                        ? isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-950'
                        : isDark ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-950'
                  } text-xs space-y-1`}>
                    <div className="flex items-center justify-between font-bold">
                      <span className="flex items-center gap-1.5">
                        {isPaymentVerified ? (
                          <>
                            <ShieldCheck className="h-4 w-4 text-emerald-500" />
                            <span>Verifikasi Pembayaran: VALID &amp; COCOK (Verified)</span>
                          </>
                        ) : !isPaid ? (
                          <>
                            <Clock className="h-4 w-4 text-amber-500" />
                            <span>Verifikasi Pembayaran: MENUNGGU PEMBAYARAN</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-4 w-4 text-rose-500" />
                            <span>Verifikasi Pembayaran: KETIDAKCOCOKAN NOMINAL</span>
                          </>
                        )}
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-full border uppercase">
                        {isPaymentVerified ? 'PAID + MATCH' : !isPaid ? 'PENDING' : 'MISMATCH'}
                      </span>
                    </div>
                    <p className={`text-[11px] leading-relaxed font-sans font-medium ${
                      isPaymentVerified 
                        ? isDark ? 'text-emerald-200' : 'text-emerald-900' 
                        : !isPaid 
                          ? isDark ? 'text-amber-200' : 'text-amber-900' 
                          : isDark ? 'text-rose-200' : 'text-rose-900'
                    }`}>
                      {isPaymentVerified
                        ? `Status pembayaran telah PAID dan nominal final (Rp ${finalPaymentAmount.toLocaleString('id-ID')}) terverifikasi cocok sempurna dengan kode unik (+Rp ${uniqueCode}) serta harga dasar.`
                        : !isPaid
                          ? 'Status pembayaran belum Paid. Konfirmasi resmi admin dikunci hingga pembayaran lunas terverifikasi gateway ArtoPay.'
                          : `Peringatan: Nominal pembayaran final (Rp ${finalPaymentAmount.toLocaleString('id-ID')}) berbeda dari perhitungan harga dasar + kode unik (Rp ${expectedFinal.toLocaleString('id-ID')}).`}
                    </p>
                  </div>
                );
              })()}
            </div>
          );
        })()}

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
                className="px-3.5 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5"
                title="Batalkan Booking"
              >
                <Ban className="h-3.5 w-3.5" />
                <span>Batalkan</span>
              </button>
            )}

            {/* Confirm Action Button: ONLY enabled if paymentStatus === Paid AND final payment amount + unique code match */}
            {!isConfirmed && !isCompleted && !isCancelled && (() => {
              const raw = booking.rawBooking || {};
              const disc = Number(booking.discount ?? raw.discount ?? (raw.details?.discountAmount || 0));
              const unique = Number(booking.uniqueCode ?? raw.unique_code ?? raw.uniqueCode ?? 0);
              let base = Number(booking.baseAmount ?? raw.base_amount ?? raw.baseAmount ?? 0);
              if (!base || base <= 0) {
                const netBase = Number(booking.totalAmountIDR ?? raw.total_price_idr ?? raw.totalPriceIDR ?? (booking as any).totalPrice ?? 0);
                base = (netBase > 0 && disc > 0) ? (netBase + disc) : netBase;
              }
              const finalAmt = 
                Number(booking.finalPaymentAmount ?? booking.paymentAmount ?? raw.payment_amount ?? raw.paymentAmount ?? booking.totalAmountIDR ?? raw.total_price_idr ?? 0) ||
                (base > 0 ? (Math.max(0, base - disc) + unique) : 0);
              const expectedAmt = base > 0 ? (Math.max(0, base - disc) + unique) : finalAmt;
              const isMatch = Math.abs(finalAmt - expectedAmt) <= 1;
              const canConfirm = isPaid && isMatch;

              return (
                <button
                  disabled={!canConfirm}
                  onClick={() => {
                    if (!canConfirm) return;
                    if (onConfirmBooking) {
                      onConfirmBooking(booking.id, booking.source);
                    }
                  }}
                  className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 ${
                    canConfirm
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-neutral-950 cursor-pointer shadow-md'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700 opacity-60'
                  }`}
                  title={
                    !isPaid 
                      ? 'Admin tidak boleh konfirmasi jika status pembayaran belum Paid' 
                      : !isMatch 
                        ? 'Admin tidak boleh konfirmasi jika nominal final dan kode unik tidak cocok' 
                        : 'Verifikasi Pembayaran & Konfirmasi Booking'
                  }
                >
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>Verifikasi &amp; Konfirmasi Booking</span>
                </button>
              );
            })()}

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

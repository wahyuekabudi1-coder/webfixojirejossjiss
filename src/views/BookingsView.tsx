import React, { useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { 
  Calendar, 
  Search 
} from 'lucide-react';
import { processArtoPayPayment } from '../lib/artopay';
import Breadcrumbs from '../components/Breadcrumbs';
import PrivateTourCheckBooking from '../components/PrivateTourCheckBooking';

export default function BookingsView() {
  const { refreshBookings } = useApp();
  const [selectedCode, setSelectedCode] = useState<string>('');

  // Check URL query param ?code= from both search and hash on mount
  useEffect(() => {
    let code: string | null = null;
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
      const hashParams = new URLSearchParams(hashQuery);
      code = hashParams.get('code') || params.get('code');
    }
    if (code) {
      setSelectedCode(code);
    }

    const handleHash = () => {
      const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
      const hashParams = new URLSearchParams(hashQuery);
      const hCode = hashParams.get('code');
      if (hCode) {
        setSelectedCode(hCode);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Triggered when paying with ArtoPay via Cek Booking ID & Invoice
  const handlePayWithArtoPay = async (booking: any) => {
    try {
      const targetOrderId = booking.bookingCode || booking.id;
      const disc = Math.max(0, Number(booking.discount || 0));
      const base = Number(booking.baseAmount) > 0 
        ? Number(booking.baseAmount) 
        : (Number(booking.totalPriceIDR) > 0 && disc > 0 
            ? Number(booking.totalPriceIDR) + disc 
            : Number(booking.totalPriceIDR || 0));
      const unique = Number(booking.uniqueCode || 0);
      const payableAmount = Number(booking.paymentAmount) || (Math.max(0, base - disc) + unique);
      await processArtoPayPayment({
        orderId: targetOrderId,
        amount: payableAmount,
        currency: 'IDR',
        onSuccess: async () => {
          if (typeof refreshBookings === 'function') {
            await refreshBookings().catch(() => {});
          }
        },
        onPending: async () => {
          if (typeof refreshBookings === 'function') {
            await refreshBookings().catch(() => {});
          }
        },
        onError: (err) => {
          console.warn('ArtoPay checkout error/cancelled:', err);
        }
      });
    } catch (err: any) {
      console.error('ArtoPay payment trigger failed:', err);
      alert(err.message || 'Gagal memproses pembayaran ke ArtoPay.');
    }
  };

  return (
    <div id="bookings-view" className="bg-[#1c3830] text-white min-h-screen pt-20 pb-16 relative">
      <Breadcrumbs items={[{ label: 'My Bookings & Reservations' }]} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">

        {/* Header Intro */}
        <div className="text-center space-y-3">
          <span className="inline-flex items-center space-x-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-semibold font-mono uppercase tracking-widest">
            <Calendar className="h-3.5 w-3.5" />
            <span>Passenger Reservation Center</span>
          </span>
          <h1 className="text-3xl sm:text-4.5xl font-black">Your Booking Portal</h1>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-lg mx-auto leading-relaxed">
            Cek Booking ID untuk peserta Open Trip maupun Private Trip, lihat rincian pemesanan, dan unduh invoice resmi Anda di sini.
          </p>
        </div>

        {/* Portal: Cek Booking ID & Invoice */}
        <div className="flex justify-center">
          <div className="inline-flex p-1.5 rounded-2xl bg-[#203c34] border border-[#315B4F] shadow-lg">
            <div
              className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 bg-amber-500 text-neutral-950 shadow-md"
            >
              <Search className="h-4 w-4" />
              <span>Cek Booking ID &amp; Invoice</span>
            </div>
          </div>
        </div>

        {/* Cek Booking ID & Invoice Content */}
        <div className="bg-[#F8FAF9] rounded-3xl p-2 sm:p-6 text-neutral-900 shadow-2xl border border-neutral-200">
          <PrivateTourCheckBooking 
            initialCode={selectedCode}
            onPayNow={(b) => handlePayWithArtoPay(b)}
          />
        </div>

      </div>
    </div>
  );
}

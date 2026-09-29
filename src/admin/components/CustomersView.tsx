import React, { useState, useMemo } from 'react';
import { 
  Users, Star, Search, Download, Check, X, 
  MessageSquare, ShieldCheck, Mail, Phone, Calendar
} from 'lucide-react';
import { UnifiedBookingDetail } from '../../components/admin/BookingDetailModal';
import { Review } from '../../types';

interface CustomersViewProps {
  bookings: UnifiedBookingDetail[];
  reviews: Review[];
  approveReview: (id: string) => void;
  rejectReview: (id: string) => void;
  activeTab: 'list' | 'reviews';
  setActiveTab: (tab: 'list' | 'reviews') => void;
  theme: any;
  isDark?: boolean;
  triggerToast: (msg: string) => void;
  onOpenBookingDetail: (booking: UnifiedBookingDetail) => void;
}

export default function CustomersView({
  bookings,
  reviews,
  approveReview,
  rejectReview,
  activeTab,
  setActiveTab,
  theme,
  isDark = false,
  triggerToast,
  onOpenBookingDetail
}: CustomersViewProps) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'pending' | 'approved'>('all');

  // Aggregate Customers by email / phone
  const customersList = useMemo(() => {
    const map = new Map<string, {
      name: string;
      email: string;
      phone: string;
      services: Set<string>;
      totalSpentIDR: number;
      bookingsCount: number;
      lastDate: string;
      recentBooking: UnifiedBookingDetail;
    }>();

    bookings.forEach(b => {
      const key = (b.customerEmail && b.customerEmail !== '-') ? b.customerEmail.toLowerCase() : b.customerPhone;
      if (!key || key === '-') return;

      const existing = map.get(key);
      const spent = b.totalAmountIDR || 0;
      const bDate = b.date || b.createdAt || '';

      if (!existing) {
        const services = new Set<string>();
        services.add(b.serviceType);
        map.set(key, {
          name: b.customerName,
          email: b.customerEmail,
          phone: b.customerPhone,
          services,
          totalSpentIDR: spent,
          bookingsCount: 1,
          lastDate: bDate,
          recentBooking: b
        });
      } else {
        existing.services.add(b.serviceType);
        existing.totalSpentIDR += spent;
        existing.bookingsCount += 1;
        if (bDate > existing.lastDate) {
          existing.lastDate = bDate;
          existing.recentBooking = b;
        }
      }
    });

    const list = Array.from(map.values());
    return list.sort((a, b) => b.totalSpentIDR - a.totalSpentIDR);
  }, [bookings]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customersList;
    const q = customerSearch.toLowerCase();
    return customersList.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q)
    );
  }, [customersList, customerSearch]);

  // Filtered reviews list
  const filteredReviews = useMemo(() => {
    return reviews.filter(r => {
      if (reviewFilter === 'all') return true;
      return r.status === reviewFilter;
    });
  }, [reviews, reviewFilter]);

  const pendingReviewsCount = reviews.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xl font-black tracking-tight font-sans">
                DATA PELANGGAN &amp; ULASAN (CUSTOMERS)
              </h2>
              <p className={`text-xs ${theme.textSecondary}`}>
                Database profil tamu terpadu dari seluruh saluran pesanan dan moderasi ulasan testimoni pelanggan.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            const csvRows = [
              ['Nama Tamu', 'Email', 'Telepon', 'Jumlah Transaksi', 'Total Transaksi IDR', 'Trip Terakhir']
            ];
            customersList.forEach(c => {
              csvRows.push([
                `"${c.name}"`,
                `"${c.email}"`,
                `"${c.phone}"`,
                `"${c.bookingsCount}"`,
                `"${c.totalSpentIDR}"`,
                `"${c.lastDate}"`
              ]);
            });
            const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map(e => e.join(',')).join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `smartjourney_customers_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            triggerToast('Database Pelanggan berhasil diunduh');
          }}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer"
        >
          <Download className="h-4 w-4" />
          <span>Export Pelanggan CSV</span>
        </button>
      </div>

      {/* SUB-NAV */}
      <div className="flex items-center gap-2 border-b border-neutral-700/40 pb-2">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'list'
              ? isDark
                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 font-extrabold shadow-xs'
                : 'bg-amber-500/15 border border-amber-500/30 text-amber-700 font-extrabold shadow-xs'
              : isDark
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border border-transparent'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-transparent'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Direktori Pelanggan ({customersList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'reviews'
              ? isDark
                ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400 font-extrabold shadow-xs'
                : 'bg-amber-500/15 border border-amber-500/30 text-amber-700 font-extrabold shadow-xs'
              : isDark
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40 border border-transparent'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-transparent'
          }`}
        >
          <Star className="h-4 w-4" />
          <span>Ulasan &amp; Rating</span>
          {pendingReviewsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500 text-white animate-pulse">
              {pendingReviewsCount}
            </span>
          )}
        </button>
      </div>

      {/* 1. VIEW: CUSTOMER LIST */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              placeholder="Cari nama pelanggan, email, atau telepon..."
              className={`w-full ${theme.input} pl-9 pr-4 py-2 rounded-xl text-xs`}
            />
          </div>

          <div className={`${theme.card} border rounded-2xl overflow-hidden shadow-sm`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase text-neutral-400 font-bold`}>
                  <tr>
                    <th className="p-3.5">Nama Pelanggan</th>
                    <th className="p-3.5">Kontak</th>
                    <th className="p-3.5">Layanan Dipakai</th>
                    <th className="p-3.5 text-center">Total Booking</th>
                    <th className="p-3.5 text-right">Akumulasi Belanja</th>
                    <th className="p-3.5">Trip Terakhir</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-neutral-500 font-mono">
                        Tidak ada data pelanggan yang cocok.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((cust, idx) => (
                      <tr key={idx} className={`${theme.hover} transition-colors`}>
                        <td className="p-3.5 font-bold text-neutral-100">
                          {cust.name}
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-neutral-400">
                          <div>{cust.phone}</div>
                          <div className="text-[10px] text-neutral-500">{cust.email}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-wrap gap-1">
                            {Array.from(cust.services).map((srv, i) => (
                              <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 uppercase">
                                {srv}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-center text-neutral-200">
                          {cust.bookingsCount} Trip
                        </td>
                        <td className="p-3.5 font-mono font-black text-right text-amber-500">
                          Rp {cust.totalSpentIDR.toLocaleString('id-ID')}
                        </td>
                        <td className="p-3.5 font-mono text-neutral-400">
                          {cust.lastDate || '-'}
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => onOpenBookingDetail(cust.recentBooking)}
                            className="px-2.5 py-1 rounded-lg border border-neutral-700/60 hover:bg-neutral-800 text-neutral-300 text-[11px] font-bold"
                          >
                            Pesanan
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

      {/* 2. VIEW: REVIEWS MODERATION */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {(['all', 'pending', 'approved'] as const).map(st => (
              <button
                key={st}
                onClick={() => setReviewFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  reviewFilter === st
                    ? 'bg-amber-500 text-neutral-950 font-black'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {st === 'all' ? 'Semua Ulasan' : st === 'pending' ? 'Perlu Moderasi' : 'Disetujui'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredReviews.length === 0 ? (
              <div className="col-span-2 p-8 text-center text-neutral-500 font-mono">
                Tidak ada ulasan pada kategori ini.
              </div>
            ) : (
              filteredReviews.map((rev) => (
                <div key={rev.id} className={`${theme.card} border rounded-2xl p-4 space-y-3 shadow-sm`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-neutral-100">{rev.name}</h4>
                      <span className="text-[10px] text-neutral-500 font-mono">{rev.country} · {rev.date}</span>
                    </div>

                    <div className="flex items-center gap-0.5 text-amber-500">
                      {Array.from({ length: rev.rating }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-amber-500" />
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-neutral-300 italic">
                    "{rev.text}"
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-neutral-700/40">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      rev.status === 'approved' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}>
                      {rev.status === 'approved' ? 'Tampil di Website' : 'Menunggu Moderasi'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {rev.status === 'pending' && (
                        <button
                          onClick={() => {
                            approveReview(rev.id);
                            triggerToast(`Ulasan oleh ${rev.name} disetujui`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-neutral-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Setujui</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          rejectReview(rev.id);
                          triggerToast(`Ulasan ditolak`);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-neutral-700 hover:bg-rose-950/20 text-rose-400 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

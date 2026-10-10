import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Star, Search, Download, Check, X, 
  MessageSquare, ShieldCheck, Mail, Phone, Calendar,
  Filter, Eye, ArrowUpRight, DollarSign, Clock, MapPin,
  Car, Plane, Compass, AlertCircle, CheckCircle2, ChevronRight,
  ExternalLink, UserCheck, Luggage, Navigation, Hash, Globe,
  Award, Shield, FileText, ArrowUpDown
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

export interface CustomerProfile {
  id: string;
  primaryName: string;
  allNames: string[];
  primaryEmail: string;
  allEmails: string[];
  primaryPhone: string;
  allPhones: string[];
  emergencyContacts: string[];
  nationalities: string[];
  services: Set<string>;
  bookings: UnifiedBookingDetail[];
  totalBookings: number;
  paidBookingsCount: number;
  totalSpentIDR: number; // Sum of Paid / Confirmed / Completed bookings
  totalPotentialIDR: number; // Sum of all non-cancelled bookings
  earliestDate: string;
  latestDate: string;
  latestBooking: UnifiedBookingDetail;
}

// Helper: Normalize phone numbers for clustering
function normalizePhone(phone?: string): string {
  if (!phone || phone === '-') return '';
  let digits = phone.replace(/\D/g, '');
  if (!digits || digits.length < 7) return '';
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  return digits;
}

// Helper: Normalize email addresses for clustering
function normalizeEmail(email?: string): string {
  if (!email || email === '-') return '';
  const clean = email.trim().toLowerCase();
  if (clean.length < 5 || !clean.includes('@') || !clean.includes('.')) return '';
  const [local, domain] = clean.split('@');
  if (!local || !domain || domain.length < 3) return '';
  // Exclude ambiguous dummy / test placeholders
  if (['admin', 'test', 'unknown', 'noreply', 'no-reply', 'null', 'undefined', 'dummy'].includes(local)) return '';
  return clean;
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
  // Filters & Search
  const [customerSearch, setCustomerSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState<'all' | 'tour' | 'sharetour' | 'airport' | 'taxi' | 'car-rental'>('all');
  const [dateHorizonFilter, setDateHorizonFilter] = useState<'all' | '30d' | '90d' | 'thisYear' | 'older'>('all');
  const [sortBy, setSortBy] = useState<'spent' | 'bookings' | 'latest' | 'name'>('spent');

  // Customer Detail Modal State
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerProfile | null>(null);

  // Reviews Filter
  const [reviewFilter, setReviewFilter] = useState<'all' | 'pending' | 'approved'>('all');

  // --------------------------------------------------------------------------
  // 1. ROBUST CUSTOMER AGGREGATION & NORMALIZATION ENGINE (CROSS-SERVICE)
  // --------------------------------------------------------------------------
  const allCustomers = useMemo<CustomerProfile[]>(() => {
    // Map to find existing customer cluster by email or normalized phone
    const emailToId = new Map<string, string>();
    const phoneToId = new Map<string, string>();
    const profiles = new Map<string, CustomerProfile>();

    let idCounter = 1;

    bookings.forEach((b) => {
      const rawEmail = (b.customerEmail || (b as any).email || (b.rawBooking && ((b.rawBooking as any).customerEmail || (b.rawBooking as any).email)) || '').trim();
      const cleanEmail = normalizeEmail(rawEmail);

      const rawPhone = (b.customerPhone || (b as any).phone || (b.rawBooking && ((b.rawBooking as any).customerPhone || (b.rawBooking as any).phone)) || '').trim();
      const cleanPhone = normalizePhone(rawPhone);

      const rawName = (b.customerName || (b as any).name || (b.rawBooking && ((b.rawBooking as any).customerName || (b.rawBooking as any).name)) || '').trim();

      // Skip invalid bookings without name or contact
      if (!rawName && !cleanEmail && !cleanPhone) return;

      // Identify matching existing profile by email or phone
      const emailMatchId = cleanEmail ? emailToId.get(cleanEmail) : undefined;
      const phoneMatchId = cleanPhone ? phoneToId.get(cleanPhone) : undefined;

      let targetId: string | undefined;

      if (emailMatchId && phoneMatchId && emailMatchId !== phoneMatchId) {
        // Both contacts exist but were previously in separate profiles -> Merge them cleanly
        targetId = emailMatchId;
        const sourceId = phoneMatchId;
        const primaryProf = profiles.get(targetId);
        const sourceProf = profiles.get(sourceId);

        if (primaryProf && sourceProf) {
          sourceProf.services.forEach(s => primaryProf.services.add(s));
          primaryProf.bookings.push(...sourceProf.bookings);
          primaryProf.totalBookings += sourceProf.totalBookings;
          primaryProf.paidBookingsCount += sourceProf.paidBookingsCount;
          primaryProf.totalSpentIDR += sourceProf.totalSpentIDR;
          primaryProf.totalPotentialIDR += sourceProf.totalPotentialIDR;

          sourceProf.allNames.forEach(n => {
            if (!primaryProf.allNames.includes(n)) primaryProf.allNames.push(n);
          });
          sourceProf.allEmails.forEach(e => {
            if (!primaryProf.allEmails.includes(e)) primaryProf.allEmails.push(e);
          });
          sourceProf.allPhones.forEach(p => {
            if (!primaryProf.allPhones.includes(p)) primaryProf.allPhones.push(p);
          });
          sourceProf.emergencyContacts.forEach(ec => {
            if (!primaryProf.emergencyContacts.includes(ec)) primaryProf.emergencyContacts.push(ec);
          });
          sourceProf.nationalities.forEach(nat => {
            if (!primaryProf.nationalities.includes(nat)) primaryProf.nationalities.push(nat);
          });

          if (sourceProf.earliestDate && (!primaryProf.earliestDate || sourceProf.earliestDate < primaryProf.earliestDate)) {
            primaryProf.earliestDate = sourceProf.earliestDate;
          }
          if (sourceProf.latestDate && (!primaryProf.latestDate || sourceProf.latestDate > primaryProf.latestDate)) {
            primaryProf.latestDate = sourceProf.latestDate;
            primaryProf.latestBooking = sourceProf.latestBooking;
          }

          // Remap all emails and phones from sourceProf to targetId
          sourceProf.allEmails.forEach(e => {
            const ce = normalizeEmail(e);
            if (ce) emailToId.set(ce, targetId!);
          });
          sourceProf.allPhones.forEach(p => {
            const cp = normalizePhone(p);
            if (cp) phoneToId.set(cp, targetId!);
          });

          profiles.delete(sourceId);
        }
      } else {
        targetId = emailMatchId || phoneMatchId;
      }

      const bookingAmount = b.totalAmountIDR || 0;
      const bDate = b.departureDate || b.date || b.createdAt || '';
      const isPaid = (b.paymentStatus || '').toLowerCase() === 'paid' || 
                     b.bookingStatus === 'Confirmed' || 
                     b.bookingStatus === 'Completed';
      const isCancelled = b.bookingStatus === 'Cancelled';

      if (!targetId) {
        // Create new customer profile
        targetId = `CUST-${String(idCounter++).padStart(4, '0')}`;
        const newProf: CustomerProfile = {
          id: targetId,
          primaryName: rawName || 'Tamu Smart Journey',
          allNames: rawName ? [rawName] : [],
          primaryEmail: b.customerEmail || cleanEmail || rawEmail || '-',
          allEmails: (b.customerEmail && b.customerEmail !== '-') ? [b.customerEmail] : (cleanEmail ? [cleanEmail] : []),
          primaryPhone: b.customerPhone || rawPhone || '-',
          allPhones: (b.customerPhone && b.customerPhone !== '-') ? [b.customerPhone] : (rawPhone && rawPhone !== '-' ? [rawPhone] : []),
          emergencyContacts: b.emergencyContact && b.emergencyContact !== '-' ? [b.emergencyContact] : [],
          nationalities: b.nationalityType ? [b.nationalityType] : [],
          services: new Set([b.serviceType]),
          bookings: [b],
          totalBookings: 1,
          paidBookingsCount: isPaid && !isCancelled ? 1 : 0,
          totalSpentIDR: isPaid && !isCancelled ? bookingAmount : 0,
          totalPotentialIDR: !isCancelled ? bookingAmount : 0,
          earliestDate: bDate,
          latestDate: bDate,
          latestBooking: b
        };

        profiles.set(targetId, newProf);
        if (cleanEmail) emailToId.set(cleanEmail, targetId);
        if (cleanPhone) phoneToId.set(cleanPhone, targetId);
      } else {
        // Append to existing customer profile
        const prof = profiles.get(targetId)!;

        prof.services.add(b.serviceType);
        prof.bookings.push(b);
        prof.totalBookings += 1;

        if (isPaid && !isCancelled) {
          prof.paidBookingsCount += 1;
          prof.totalSpentIDR += bookingAmount;
        }
        if (!isCancelled) {
          prof.totalPotentialIDR += bookingAmount;
        }

        // Names
        if (rawName && !prof.allNames.includes(rawName)) {
          prof.allNames.push(rawName);
        }
        if (!prof.primaryName || prof.primaryName === 'Tamu Smart Journey') {
          prof.primaryName = rawName;
        }

        // Emails - append and immediately map new valid email to existing customer ID
        const displayEmail = b.customerEmail || rawEmail;
        if (displayEmail && displayEmail !== '-' && !prof.allEmails.includes(displayEmail)) {
          prof.allEmails.push(displayEmail);
        }
        if ((prof.primaryEmail === '-' || !prof.primaryEmail) && displayEmail && displayEmail !== '-') {
          prof.primaryEmail = displayEmail;
        }
        if (cleanEmail) {
          emailToId.set(cleanEmail, targetId);
        }

        // Phones - append and immediately map new valid phone to existing customer ID
        const displayPhone = b.customerPhone || rawPhone;
        if (displayPhone && displayPhone !== '-' && !prof.allPhones.includes(displayPhone)) {
          prof.allPhones.push(displayPhone);
        }
        if ((prof.primaryPhone === '-' || !prof.primaryPhone) && displayPhone && displayPhone !== '-') {
          prof.primaryPhone = displayPhone;
        }
        if (cleanPhone) {
          phoneToId.set(cleanPhone, targetId);
        }

        // Emergency Contacts
        if (b.emergencyContact && b.emergencyContact !== '-' && !prof.emergencyContacts.includes(b.emergencyContact)) {
          prof.emergencyContacts.push(b.emergencyContact);
        }

        // Nationalities
        if (b.nationalityType && !prof.nationalities.includes(b.nationalityType)) {
          prof.nationalities.push(b.nationalityType);
        }

        // Dates comparison
        if (bDate) {
          if (!prof.earliestDate || bDate < prof.earliestDate) {
            prof.earliestDate = bDate;
          }
          if (!prof.latestDate || bDate > prof.latestDate) {
            prof.latestDate = bDate;
            prof.latestBooking = b;
          }
        }

        // Register both identifiers in lookup maps
        if (cleanEmail) emailToId.set(cleanEmail, targetId);
        if (cleanPhone) phoneToId.set(cleanPhone, targetId);
      }
    });

    // Sort customer bookings chronologically (newest first)
    profiles.forEach((p) => {
      p.bookings.sort((a, b) => {
        const dateA = a.departureDate || a.date || a.createdAt || '';
        const dateB = b.departureDate || b.date || b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
      if (p.bookings.length > 0) {
        p.latestBooking = p.bookings[0];
      }
    });

    return Array.from(profiles.values());
  }, [bookings]);

  // --------------------------------------------------------------------------
  // 2. FILTERING & SEARCHING (NAME, EMAIL, PHONE, BOOKING CODE, SERVICE, DATE)
  // --------------------------------------------------------------------------
  const filteredCustomers = useMemo<CustomerProfile[]>(() => {
    const now = new Date();
    const currentYear = now.getFullYear().toString();
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return allCustomers.filter((cust) => {
      // 1. Service Filter
      if (serviceFilter !== 'all') {
        const matchesService = Array.from(cust.services).some((srv) => {
          if (serviceFilter === 'car-rental') return srv === 'car-rental' || srv === 'rental';
          return srv === serviceFilter;
        });
        if (!matchesService) return false;
      }

      // 2. Date Horizon Filter
      if (dateHorizonFilter !== 'all') {
        const lastDate = cust.latestDate ? cust.latestDate.slice(0, 10) : '';
        if (dateHorizonFilter === '30d') {
          if (!lastDate || lastDate < d30) return false;
        } else if (dateHorizonFilter === '90d') {
          if (!lastDate || lastDate < d90) return false;
        } else if (dateHorizonFilter === 'thisYear') {
          if (!lastDate || !lastDate.startsWith(currentYear)) return false;
        } else if (dateHorizonFilter === 'older') {
          if (!lastDate || lastDate.startsWith(currentYear)) return false;
        }
      }

      // 3. Search: Name, Email, Phone, Booking Code
      if (customerSearch.trim()) {
        const q = customerSearch.trim().toLowerCase();
        const matchesName = cust.primaryName.toLowerCase().includes(q) || 
                            cust.allNames.some(n => n.toLowerCase().includes(q));
        const matchesEmail = cust.primaryEmail.toLowerCase().includes(q) || 
                             cust.allEmails.some(e => e.toLowerCase().includes(q));
        const matchesPhone = cust.primaryPhone.toLowerCase().includes(q) || 
                             cust.allPhones.some(p => p.toLowerCase().includes(q));
        const matchesBookingCode = cust.bookings.some(b => 
          (b.bookingCode || '').toLowerCase().includes(q) || 
          (b.id || '').toLowerCase().includes(q)
        );

        if (!matchesName && !matchesEmail && !matchesPhone && !matchesBookingCode) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'spent') {
        return b.totalSpentIDR - a.totalSpentIDR;
      }
      if (sortBy === 'bookings') {
        return b.totalBookings - a.totalBookings;
      }
      if (sortBy === 'latest') {
        return (b.latestDate || '').localeCompare(a.latestDate || '');
      }
      if (sortBy === 'name') {
        return a.primaryName.localeCompare(b.primaryName);
      }
      return 0;
    });
  }, [allCustomers, serviceFilter, dateHorizonFilter, customerSearch, sortBy]);

  // Keep selectedCustomer updated if background state changes
  useEffect(() => {
    if (selectedCustomer) {
      const refreshed = allCustomers.find(c => c.id === selectedCustomer.id);
      if (refreshed) {
        setSelectedCustomer(refreshed);
      }
    }
  }, [allCustomers]);

  // --------------------------------------------------------------------------
  // 3. REVIEWS MODERATION FILTER
  // --------------------------------------------------------------------------
  const filteredReviews = useMemo(() => {
    return reviews.filter(r => {
      if (reviewFilter === 'all') return true;
      return r.status === reviewFilter;
    });
  }, [reviews, reviewFilter]);

  const pendingReviewsCount = reviews.filter(r => r.status === 'pending').length;

  // --------------------------------------------------------------------------
  // 4. CSV EXPORT FOR DIRECTORY
  // --------------------------------------------------------------------------
  const handleExportCSV = () => {
    if (filteredCustomers.length === 0) {
      triggerToast('Tidak ada data pelanggan untuk diekspor.');
      return;
    }

    const headers = [
      'ID Pelanggan',
      'Nama Pelanggan',
      'Nomor Telepon',
      'Email',
      'Kontak Darurat',
      'Layanan Digunakan',
      'Total Pemesanan',
      'Pemesanan Berhasil/Lunas',
      'Akumulasi Belanja (IDR)',
      'Total Nilai Transaksi (IDR)',
      'Kebangsaan Terdaftar',
      'Tanggal Pertama',
      'Trip/Pemesanan Terakhir',
      'Kode Booking Terakhir'
    ];

    const escapeCsv = (val: any) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filteredCustomers.map(c => [
      escapeCsv(c.id),
      escapeCsv(c.primaryName),
      escapeCsv(c.primaryPhone),
      escapeCsv(c.primaryEmail),
      escapeCsv(c.emergencyContacts.join(', ') || '-'),
      escapeCsv(Array.from(c.services).join(', ').toUpperCase()),
      escapeCsv(c.totalBookings),
      escapeCsv(c.paidBookingsCount),
      escapeCsv(c.totalSpentIDR),
      escapeCsv(c.totalPotentialIDR),
      escapeCsv(c.nationalities.join(', ') || '-'),
      escapeCsv(c.earliestDate || '-'),
      escapeCsv(c.latestDate || '-'),
      escapeCsv(c.latestBooking?.bookingCode || '-')
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `smartjourney_customers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    triggerToast(`Data ${filteredCustomers.length} pelanggan berhasil diekspor ke CSV.`);
  };

  // Helper Badge Colors for Services
  const getServiceBadge = (type: string) => {
    switch (type) {
      case 'tour':
        return { label: 'Private Tour', color: isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-amber-500/15 text-amber-800 border-amber-500/40' };
      case 'sharetour':
        return { label: 'Open Trip', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' };
      case 'airport':
        return { label: 'Airport Transfer', color: 'bg-sky-500/10 text-sky-500 border-sky-500/30' };
      case 'taxi':
        return { label: 'Taxi Service', color: 'bg-purple-500/10 text-purple-500 border-purple-500/30' };
      case 'car-rental':
      case 'rental':
        return { label: 'Car Rental', color: 'bg-rose-500/10 text-rose-500 border-rose-500/30' };
      default:
        return { label: type.toUpperCase(), color: 'bg-neutral-800 text-neutral-300 border-neutral-700' };
    }
  };

  // Helper Status Badge
  const getStatusBadges = (booking: UnifiedBookingDetail) => {
    const isPaid = (booking.paymentStatus || '').toLowerCase() === 'paid';
    const isCancelled = booking.bookingStatus === 'Cancelled';
    const isCompleted = booking.bookingStatus === 'Completed';
    const isConfirmed = booking.bookingStatus === 'Confirmed';

    return {
      paymentBadge: isPaid 
        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
        : (isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-amber-500/15 text-amber-800 border border-amber-500/40'),
      bookingBadge: isCancelled
        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
        : isCompleted
          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
          : isConfirmed
            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
            : (isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-amber-500/15 text-amber-800 border border-amber-500/40')
    };
  };

  // Helper Loyalty Badge
  const getLoyaltyBadge = (bookingsCount: number, spentIDR: number) => {
    if (bookingsCount >= 4 || spentIDR >= 15000000) {
      return { label: 'VIP Traveler', color: isDark ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-amber-500/15 text-amber-800 border-amber-500/40' };
    }
    if (bookingsCount >= 2 || spentIDR >= 5000000) {
      return { label: 'Repeat Customer', color: 'bg-sky-500/20 text-sky-400 border-sky-500/40' };
    }
    return { label: 'New Guest', color: 'bg-neutral-800 text-neutral-400 border-neutral-700' };
  };

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
                MANAJEMEN PELANGGAN TERPADU (CUSTOMERS)
              </h2>
              <p className={`text-xs ${theme.textSecondary}`}>
                Database profil tamu terpadu 5 layanan: Private Tour, Open Trip, Airport Transfer, Taxi, dan Car Rental.
              </p>
            </div>
          </div>
        </div>

        {/* Global Summary & Export */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`px-3 py-1.5 rounded-xl ${theme.innerCard} border border-neutral-700/60 flex items-center gap-2`}>
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono text-neutral-300 font-bold">
              {allCustomers.length} Total Profil Tamu
            </span>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>Ekspor Pelanggan CSV</span>
          </button>
        </div>
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
          <span>Direktori Pelanggan ({allCustomers.length})</span>
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
          <span>Ulasan &amp; Rating ({reviews.length})</span>
          {pendingReviewsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500 text-white animate-pulse">
              {pendingReviewsCount}
            </span>
          )}
        </button>
      </div>

      {/* =========================================================================
          TAB 1: UNIFIED CUSTOMER DIRECTORY & MANAGEMENT
          ========================================================================= */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          {/* SEARCH & FILTERS TOOLBAR */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input (Name, Email, Phone, Booking Code) */}
            <div className="md:col-span-5 relative">
              <Search className={`h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`} />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Cari nama, email, telepon, atau kode booking (#SJ / #ST)..."
                className={`w-full ${theme.input} pl-9 pr-8 py-2 rounded-xl text-xs font-sans`}
              />
              {customerSearch && (
                <button
                  onClick={() => setCustomerSearch('')}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${
                    isDark ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-800'
                  } transition-colors cursor-pointer`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter by Service */}
            <div className="md:col-span-3">
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value as any)}
                className={`w-full ${theme.input} px-3 py-2 rounded-xl text-xs font-sans`}
              >
                <option value="all">Semua 5 Layanan</option>
                <option value="tour">Private Tour</option>
                <option value="sharetour">Open Trip</option>
                <option value="airport">Airport Transfer</option>
                <option value="taxi">Taxi Service</option>
                <option value="car-rental">Car Rental</option>
              </select>
            </div>

            {/* Filter by Date Horizon */}
            <div className="md:col-span-2">
              <select
                value={dateHorizonFilter}
                onChange={(e) => setDateHorizonFilter(e.target.value as any)}
                className={`w-full ${theme.input} px-3 py-2 rounded-xl text-xs font-sans`}
              >
                <option value="all">Semua Waktu</option>
                <option value="30d">30 Hari Terakhir</option>
                <option value="90d">90 Hari Terakhir</option>
                <option value="thisYear">Tahun Ini</option>
                <option value="older">Riwayat Lama</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="md:col-span-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={`w-full ${theme.input} px-3 py-2 rounded-xl text-xs font-sans`}
              >
                <option value="spent">Urutkan: Total Belanja</option>
                <option value="bookings">Urutkan: Total Booking</option>
                <option value="latest">Urutkan: Trip Terkini</option>
                <option value="name">Urutkan: Nama (A-Z)</option>
              </select>
            </div>
          </div>

          {/* Quick Active Filter Badges */}
          <div className={`flex items-center justify-between text-[11px] font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-600'} pt-1`}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>Menampilkan: <b>{filteredCustomers.length}</b> dari {allCustomers.length} Pelanggan</span>
              {serviceFilter !== 'all' && (
                <span className={`px-2 py-0.5 rounded bg-amber-500/10 ${isDark ? 'text-amber-400' : 'text-amber-800'} border border-amber-500/30 text-[10px]`}>
                  Layanan: {serviceFilter.toUpperCase()}
                </span>
              )}
              {dateHorizonFilter !== 'all' && (
                <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 text-[10px]">
                  Riwayat: {dateHorizonFilter}
                </span>
              )}
              {customerSearch && (
                <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 text-[10px]">
                  Kata Kunci: "{customerSearch}"
                </span>
              )}
            </div>

            {(serviceFilter !== 'all' || dateHorizonFilter !== 'all' || customerSearch) && (
              <button
                onClick={() => {
                  setServiceFilter('all');
                  setDateHorizonFilter('all');
                  setCustomerSearch('');
                }}
                className={`${isDark ? 'text-amber-400' : 'text-amber-800'} hover:underline font-bold cursor-pointer text-[10px]`}
              >
                Reset Semua Filter
              </button>
            )}
          </div>

          {/* MASTER CUSTOMER TABLE */}
          <div className={`${theme.card} border rounded-2xl overflow-hidden shadow-sm`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`${theme.innerCard} border-b text-[10px] font-mono uppercase ${isDark ? 'text-neutral-400' : 'text-neutral-600'} font-bold`}>
                  <tr>
                    <th className="p-3.5">Pelanggan</th>
                    <th className="p-3.5">Kontak Resmi</th>
                    <th className="p-3.5">Portofolio Layanan</th>
                    <th className="p-3.5 text-center">Total Booking</th>
                    <th className="p-3.5 text-right">Akumulasi Belanja</th>
                    <th className="p-3.5">Trip Terakhir</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-neutral-500 font-mono">
                        Tidak ada data profil pelanggan yang memenuhi kriteria pencarian atau filter.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((cust) => {
                      const loyalty = getLoyaltyBadge(cust.totalBookings, cust.totalSpentIDR);
                      return (
                        <tr 
                          key={cust.id} 
                          className={`${theme.hover} transition-colors cursor-pointer group`}
                          onClick={() => setSelectedCustomer(cust)}
                        >
                          {/* Name & Tier */}
                          <td className="p-3.5">
                            <div className="space-y-0.5">
                              <div className={`font-bold ${isDark ? 'text-neutral-100' : 'text-neutral-900'} flex items-center gap-1.5 group-hover:text-amber-500 transition-colors`}>
                                <span>{cust.primaryName}</span>
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${loyalty.color}`}>
                                  {loyalty.label}
                                </span>
                              </div>
                              <div className="text-[10px] font-mono text-neutral-500">
                                {cust.id} • {cust.nationalities.join(', ') || 'Domestik/WNI'}
                              </div>
                            </div>
                          </td>

                          {/* Contact Info */}
                          <td className="p-3.5 font-mono text-[11px] text-neutral-300">
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3 w-3 text-neutral-500 shrink-0" />
                              <span>{cust.primaryPhone}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 truncate max-w-[200px]">
                              <Mail className="h-3 w-3 text-neutral-500 shrink-0" />
                              <span className="truncate">{cust.primaryEmail}</span>
                            </div>
                          </td>

                          {/* Services Portfolio */}
                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-1 max-w-[190px]">
                              {Array.from(cust.services).map((srv, i) => {
                                const badge = getServiceBadge(srv as string);
                                return (
                                  <span 
                                    key={i} 
                                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${badge.color}`}
                                  >
                                    {badge.label}
                                  </span>
                                );
                              })}
                            </div>
                          </td>

                          {/* Bookings Count */}
                          <td className="p-3.5 font-mono text-center">
                            <div className={`font-black ${isDark ? 'text-neutral-100' : 'text-neutral-900'} text-xs`}>
                              {cust.totalBookings} Trip
                            </div>
                            <div className="text-[10px] text-emerald-400 font-bold">
                              {cust.paidBookingsCount} Lunas
                            </div>
                          </td>

                          {/* Total Spent */}
                          <td className="p-3.5 font-mono text-right">
                            <div className="font-black text-amber-500 text-xs">
                              Rp {cust.totalSpentIDR.toLocaleString('id-ID')}
                            </div>
                            {cust.totalPotentialIDR > cust.totalSpentIDR && (
                              <div className="text-[9px] text-neutral-500">
                                Total: Rp {cust.totalPotentialIDR.toLocaleString('id-ID')}
                              </div>
                            )}
                          </td>

                          {/* Last Trip */}
                          <td className={`p-3.5 font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-600'} text-[11px]`}>
                            <div>{cust.latestDate ? cust.latestDate.slice(0, 10) : '-'}</div>
                            <div className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-600'} truncate max-w-[160px]`} title={cust.latestBooking?.serviceTitle}>
                              #{cust.latestBooking?.bookingCode}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedCustomer(cust)}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Buka Detail Profil & Seluruh Riwayat Pelanggan"
                              >
                                <Eye className="h-3 w-3" />
                                <span>Profil</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: REVIEWS & RATINGS MODERATION (PRESERVED)
          ========================================================================= */}
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
                    : isDark
                    ? 'text-neutral-400 hover:text-white'
                    : 'text-neutral-600 hover:text-neutral-900'
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
                      <h4 className={`text-xs font-bold ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>{rev.name}</h4>
                      <span className={`text-[10px] ${isDark ? 'text-neutral-500' : 'text-neutral-600'} font-mono`}>{rev.country} · {rev.date}</span>
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

      {/* =========================================================================
          CUSTOMER DETAIL MODAL (FULL PROFILE & CROSS-SERVICE BOOKING HISTORY)
          ========================================================================= */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div 
            className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto ${theme.card} border rounded-3xl p-6 space-y-6 shadow-2xl text-left`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-neutral-700/60 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 font-black text-lg">
                  {selectedCustomer.primaryName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`text-lg font-black font-sans ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
                      {selectedCustomer.primaryName}
                    </h3>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      getLoyaltyBadge(selectedCustomer.totalBookings, selectedCustomer.totalSpentIDR).color
                    }`}>
                      {getLoyaltyBadge(selectedCustomer.totalBookings, selectedCustomer.totalSpentIDR).label}
                    </span>
                  </div>
                  <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'} font-mono`}>
                    ID: {selectedCustomer.id} • Terdaftar sejak {selectedCustomer.earliestDate ? selectedCustomer.earliestDate.slice(0, 10) : '-'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedCustomer.primaryPhone && selectedCustomer.primaryPhone !== '-' && (
                  <a
                    href={`https://wa.me/${normalizePhone(selectedCustomer.primaryPhone)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                    title="Hubungi via WhatsApp"
                  >
                    <Phone className="h-4 w-4" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                )}
                {selectedCustomer.primaryEmail && selectedCustomer.primaryEmail !== '-' && (
                  <a
                    href={`mailto:${selectedCustomer.primaryEmail}`}
                    className="p-2 rounded-xl bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 border border-sky-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                    title="Kirim Email"
                  >
                    <Mail className="h-4 w-4" />
                    <span className="hidden sm:inline">Email</span>
                  </a>
                )}
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className={`p-2 rounded-xl ${
                    isDark 
                      ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-300'
                  } transition-all cursor-pointer`}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={`p-3.5 rounded-2xl ${theme.innerCard} border ${isDark ? 'border-neutral-700/60' : 'border-slate-200'} space-y-1`}>
                <span className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-600'} uppercase font-bold block`}>
                  Total Pemesanan
                </span>
                <div className={`text-lg font-black font-mono ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}>
                  {selectedCustomer.totalBookings} Trip
                </div>
                <div className="text-[10px] font-mono text-emerald-400 font-bold">
                  {selectedCustomer.paidBookingsCount} Berhasil/Lunas
                </div>
              </div>

              <div className={`p-3.5 rounded-2xl ${theme.innerCard} border ${isDark ? 'border-neutral-700/60' : 'border-slate-200'} space-y-1`}>
                <span className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-600'} uppercase font-bold block`}>
                  Akumulasi Belanja Lunas
                </span>
                <div className="text-lg font-black font-mono text-amber-500">
                  Rp {selectedCustomer.totalSpentIDR.toLocaleString('id-ID')}
                </div>
                <div className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                  Total Nilai: Rp {selectedCustomer.totalPotentialIDR.toLocaleString('id-ID')}
                </div>
              </div>

              <div className={`p-3.5 rounded-2xl ${theme.innerCard} border ${isDark ? 'border-neutral-700/60' : 'border-slate-200'} space-y-1`}>
                <span className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-600'} uppercase font-bold block`}>
                  Layanan Digunakan
                </span>
                <div className="text-lg font-black font-mono text-sky-400">
                  {selectedCustomer.services.size} Layanan
                </div>
                <div className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-600'} truncate`}>
                  {Array.from(selectedCustomer.services).join(', ').toUpperCase()}
                </div>
              </div>

              <div className={`p-3.5 rounded-2xl ${theme.innerCard} border ${isDark ? 'border-neutral-700/60' : 'border-slate-200'} space-y-1`}>
                <span className={`text-[10px] font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-600'} uppercase font-bold block`}>
                  Aktivitas Terakhir
                </span>
                <div className={`text-sm font-black font-mono ${isDark ? 'text-neutral-200' : 'text-neutral-800'} mt-1`}>
                  {selectedCustomer.latestDate ? selectedCustomer.latestDate.slice(0, 10) : '-'}
                </div>
                <div className="text-[10px] font-mono text-amber-500 truncate">
                  #{selectedCustomer.latestBooking?.bookingCode}
                </div>
              </div>
            </div>

            {/* Customer Details Information Grid */}
            <div className={`p-4 rounded-2xl ${theme.innerCard} border border-neutral-700/60 space-y-3`}>
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-amber-500" />
                <span>INFORMASI KONTAK &amp; IDENTITAS TAMU</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-sans">
                <div>
                  <span className="text-[10px] font-mono text-neutral-400 uppercase block">Nomor Telepon / WhatsApp:</span>
                  <div className="font-mono font-bold text-neutral-200 mt-0.5">
                    {selectedCustomer.allPhones.join(' • ') || '-'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-neutral-400 uppercase block">Alamat Email:</span>
                  <div className="font-mono font-bold text-neutral-200 mt-0.5 break-all">
                    {selectedCustomer.allEmails.join(' • ') || '-'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-neutral-400 uppercase block">Kontak Darurat (Emergency):</span>
                  <div className="font-mono text-neutral-300 mt-0.5">
                    {selectedCustomer.emergencyContacts.join(' • ') || 'Tidak dicantumkan'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-neutral-400 uppercase block">Kebangsaan / Status Tamu:</span>
                  <div className="font-bold text-neutral-200 mt-0.5">
                    {selectedCustomer.nationalities.length > 0
                      ? selectedCustomer.nationalities.join(', ')
                      : 'WNI / Domestik Indonesia'}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-neutral-400 uppercase block">Variasi Nama Terdaftar:</span>
                  <div className="text-neutral-300 mt-0.5">
                    {selectedCustomer.allNames.join(' / ') || selectedCustomer.primaryName}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono text-neutral-400 uppercase block">Saluran Pemesanan:</span>
                  <div className="text-neutral-300 mt-0.5 flex items-center gap-1">
                    <span>Smart Journey Platform (Web &amp; WhatsApp Portal)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* CROSS-SERVICE BOOKING HISTORY (RIWAYAT SELURUH BOOKING) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-amber-500" />
                  <span>RIWAYAT SELURUH PESANAN LINTAS LAYANAN ({selectedCustomer.bookings.length} BOOKING)</span>
                </h4>
                <span className="text-[10px] font-mono text-neutral-400">
                  Urut dari yang terkini
                </span>
              </div>

              <div className="space-y-2.5">
                {selectedCustomer.bookings.map((b) => {
                  const badge = getServiceBadge(b.serviceType);
                  const statuses = getStatusBadges(b);
                  const depDate = b.departureDate || b.date || '-';

                  return (
                    <div
                      key={b.id}
                      className={`p-4 rounded-2xl ${theme.innerCard} border border-neutral-700/60 hover:border-amber-500/40 transition-all space-y-3`}
                    >
                      {/* Booking Item Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${badge.color}`}>
                            {badge.label}
                          </span>
                          <span className="text-xs font-mono font-black text-amber-500">
                            #{b.bookingCode}
                          </span>
                          <span className="text-xs font-bold text-neutral-200">
                            {b.serviceTitle}
                          </span>
                        </div>

                        {/* Status Badges */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${statuses.paymentBadge}`}>
                            {b.paymentStatus || 'Pending'}
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${statuses.bookingBadge}`}>
                            {b.bookingStatus || 'Pending'}
                          </span>
                        </div>
                      </div>

                      {/* Booking Item Details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-neutral-800/80 pt-2.5 text-neutral-300">
                        <div>
                          <span className="text-[10px] font-mono text-neutral-500 uppercase block">Jadwal Keberangkatan:</span>
                          <span className="font-mono font-bold text-amber-400">
                            {depDate} {b.time ? `• ${b.time}` : ''}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono text-neutral-500 uppercase block">Jumlah Penumpang:</span>
                          <span className="font-bold text-neutral-200">
                            {b.passengers} Orang (Pax)
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono text-neutral-500 uppercase block">Total Biaya:</span>
                          <span className="font-mono font-black text-amber-500">
                            Rp {(b.totalAmountIDR || 0).toLocaleString('id-ID')}
                          </span>
                        </div>

                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => {
                              setSelectedCustomer(null);
                              onOpenBookingDetail(b);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                          >
                            <span>Buka Pesanan</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Participant Names / Open Trip Metadata if available */}
                      {(b.participantNames && b.participantNames.length > 0 || b.nationalityType || b.pickupLocation) && (
                        <div className="bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800/80 text-[11px] space-y-1">
                          {b.participantNames && b.participantNames.length > 0 && (
                            <div>
                              <span className="text-neutral-500 font-mono">Daftar Anggota Peserta: </span>
                              <span className="font-bold text-neutral-200">{b.participantNames.join(', ')}</span>
                            </div>
                          )}
                          {b.nationalityType && (
                            <div>
                              <span className="text-neutral-500 font-mono">Kategori Kebangsaan: </span>
                              <span className="text-amber-400 font-mono font-bold">{b.nationalityType}</span>
                            </div>
                          )}
                          {b.pickupLocation && (
                            <div className="truncate">
                              <span className="text-neutral-500 font-mono">Lokasi Penjemputan: </span>
                              <span className="text-neutral-300">{b.pickupLocation}</span>
                            </div>
                          )}
                          {b.flightNumber && (
                            <div>
                              <span className="text-neutral-500 font-mono">Nomor Penerbangan: </span>
                              <span className="text-sky-400 font-mono font-bold">{b.flightNumber}</span>
                            </div>
                          )}
                          {b.specialRequests && (
                            <div>
                              <span className="text-neutral-500 font-mono">Catatan Khusus: </span>
                              <span className="text-neutral-300 italic">"{b.specialRequests}"</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`flex items-center justify-between pt-4 border-t ${isDark ? 'border-neutral-700/60' : 'border-neutral-200'}`}>
              <span className={`text-[11px] font-mono ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                Single Source of Truth • Smart Journey Operations &amp; Customer Ledger
              </span>

              <button
                onClick={() => setSelectedCustomer(null)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isDark
                    ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300'
                }`}
              >
                Tutup Profil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

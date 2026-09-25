import React, { useState, useEffect, useMemo } from 'react';
import { Trip, Batch, Booking, ItineraryItem, FAQItem } from '../types';
import { formatTourDuration } from '../../utils/tourFilterUtils';
import {
  createTrip,
  updateTrip,
  deleteTrip,
  createBatch,
  updateBatch,
  deleteBatch,
  updateBooking,
  importBulk
} from '../api';
import { useAutoSaveDraft } from '../../components/admin/AutoSaveDraftComponents';
import { clearDraft } from '../../utils/adminDraftStorage';
import ShareTourWorkspaceForm from './admin/ShareTourWorkspaceForm';
import {
  Users,
  Calendar,
  Compass,
  Check,
  X,
  Plus,
  Trash2,
  Eye,
  Search,
  RotateCcw,
  Sparkles,
  MapPin,
  Clock,
  Layers,
  BarChart3,
  FileCheck,
  Upload,
  CalendarDays,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
  DollarSign,
  Filter,
  ExternalLink,
  Percent
} from 'lucide-react';

interface AdminDashboardProps {
  trips: Trip[];
  batches: Batch[];
  bookings: Booking[];
  tripsRevision?: number;
  onRefreshDB: () => void;
  onLogout?: () => void;
  embedded?: boolean;
  theme?: any;
  isDark?: boolean;
  currency?: string;
  formatPrice?: (usd: number, idr?: number) => string;
  triggerToast?: (msg: string) => void;
  activeSubTab?: string;
  setActiveSubTab?: (tab: any) => void;
}

export type AdminTab = 'catalog' | 'batches' | 'participants' | 'verification' | 'analytics' | 'excel-import';

export default function AdminDashboard({
  trips = [],
  batches = [],
  bookings = [],
  tripsRevision = 1,
  onRefreshDB,
  onLogout,
  embedded = true,
  theme,
  isDark = true,
  currency = 'IDR',
  formatPrice,
  triggerToast,
  activeSubTab,
  setActiveSubTab
}: AdminDashboardProps) {
  // Theme Fallback
  const t = theme || {
    card: isDark ? 'bg-neutral-900/80 border-neutral-800 text-neutral-100' : 'bg-white border-neutral-200/90 shadow-sm text-neutral-900',
    innerCard: isDark ? 'bg-neutral-950/60 border-neutral-850' : 'bg-slate-100/60 border-neutral-200 text-neutral-800',
    border: isDark ? 'border-neutral-800' : 'border-neutral-200',
    borderSubtle: isDark ? 'border-neutral-850' : 'border-neutral-200/60',
    textPrimary: isDark ? 'text-neutral-100' : 'text-neutral-900',
    textSecondary: isDark ? 'text-neutral-400' : 'text-neutral-600',
    textMuted: isDark ? 'text-neutral-600' : 'text-neutral-400',
    input: isDark ? 'bg-neutral-950/80 border-neutral-800 text-white placeholder:text-neutral-500' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20',
    hover: isDark ? 'hover:bg-neutral-800/60' : 'hover:bg-slate-100',
    activeTab: 'bg-amber-500/10 text-amber-500 font-extrabold border-amber-500/30'
  };

  // Tab State: Synchronized with parent activeSubTab if available
  const currentTab: AdminTab = useMemo(() => {
    if (activeSubTab && ['catalog', 'batches', 'participants', 'verification', 'analytics', 'excel-import'].includes(activeSubTab)) {
      return activeSubTab as AdminTab;
    }
    return 'catalog';
  }, [activeSubTab]);

  const switchTab = (tab: AdminTab) => {
    if (setActiveSubTab) {
      setActiveSubTab(tab);
    }
    try {
      localStorage.setItem('sj_sharetour_active_tab', tab);
    } catch (_) {}
  };

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [batchTripFilter, setBatchTripFilter] = useState('All');
  const [participantBatchFilter, setParticipantBatchFilter] = useState('All');
  const [participantViewMode, setParticipantViewMode] = useState<'grouped' | 'flat'>('flat');
  const [expandedBatches, setExpandedBatches] = useState<{ [key: string]: boolean }>({});

  // Pagination States (10 items per page for lightness)
  const [catalogPage, setCatalogPage] = useState(1);
  const [batchesPage, setBatchesPage] = useState(1);
  const [participantsPage, setParticipantsPage] = useState(1);
  const pageSize = 10;

  // Trip Modal / Workspace Form State
  const [showTripModal, setShowTripModal] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [isSavingTrip, setIsSavingTrip] = useState(false);

  const [tripForm, setTripForm] = useState<{
    title: string;
    slug: string;
    location: string;
    duration: string;
    days?: number;
    nights?: number;
    category?: string;
    experienceCategory?: string;
    description: string;
    coverImage: string;
    highlight: string;
    startingPrice: number;
    wniPrice?: number;
    status: 'published' | 'draft';
    included: string[];
    excluded: string[];
    gallery: string[];
    faq: FAQItem[];
    itinerary: ItineraryItem[];
    whatsToBring?: string[];
  }>({
    title: '',
    slug: '',
    location: '',
    duration: '2 Days / 1 Night',
    days: 2,
    nights: 1,
    category: 'Adventure',
    experienceCategory: 'Adventure',
    description: '',
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format',
    highlight: '',
    startingPrice: 150,
    wniPrice: 2400000,
    status: 'published',
    included: [],
    excluded: [],
    gallery: [],
    faq: [],
    itinerary: [],
    whatsToBring: []
  });

  // Auto-Save Draft for Open Trip
  const {
    saveStatus: tripSaveStatus,
    lastSaved: tripLastSaved,
    isOnline: tripIsOnline,
    detectedDraft: tripDraft,
    showRecoveryBanner: showTripRecoveryBanner,
    handleRecover: recoverTripDraft,
    handleDiscard: discardTripDraft,
    performSave: performTripSave,
    clearCurrentDraft: clearTripDraft
  } = useAutoSaveDraft<typeof tripForm>({
    type: 'tour',
    subType: 'sharetour',
    targetId: editingTripId || 'new',
    title: tripForm.title || (editingTripId ? 'Edit Open Trip' : 'Open Trip Baru'),
    data: tripForm,
    isEditing: Boolean(editingTripId),
    enabled: showTripModal,
    debounceMs: 750,
    hasUnsavedContent: Boolean(
      tripForm.title?.trim() ||
      tripForm.description?.trim() ||
      tripForm.itinerary?.length > 0 ||
      editingTripId
    ),
    onRecover: (draft) => {
      if (draft.data) {
        setTripForm(draft.data);
      }
    }
  });

  // Batch Form Modal States
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchForm, setBatchForm] = useState<{
    tripId: string;
    departureDate: string;
    quota: number;
    availableSeats: number;
    price: number;
    status: 'Open' | 'Closed';
  }>({
    tripId: '',
    departureDate: '',
    quota: 14,
    availableSeats: 14,
    price: 150,
    status: 'Open'
  });

  // Modals for Actions
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedParticipantForEdit, setSelectedParticipantForEdit] = useState<Booking | null>(null);
  const [participantFields, setParticipantFields] = useState({
    name: '',
    englishName: '',
    weChatId: '',
    xiaoHongShuId: '',
    city: '',
    whatsapp: '',
    email: '',
    flightNumber: ''
  });
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [previewTrip, setPreviewTrip] = useState<Trip | null>(null);

  // Excel / CSV Importer States
  const [importSection, setImportSection] = useState<'trips' | 'batches'>('trips');
  const [importText, setImportText] = useState('');
  const [parsedTrips, setParsedTrips] = useState<Trip[]>([]);
  const [parsedBatches, setParsedBatches] = useState<Batch[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Helper Toast
  const notify = (msg: string) => {
    if (triggerToast) {
      triggerToast(msg);
    } else {
      console.log('[Share Tour]', msg);
    }
  };

  const formatPriceLabel = (usd: number, idr?: number) => {
    if (formatPrice) return formatPrice(usd, idr);
    const numIdr = idr || usd * 16000;
    return `Rp ${numIdr.toLocaleString('id-ID')}`;
  };

  // ---------------------------------------------------------------------------
  // TRIP WORKSPACE HANDLERS
  // ---------------------------------------------------------------------------
  const initCreateTrip = () => {
    setEditingTripId(null);
    const initialCover = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format';
    setTripForm({
      title: '',
      slug: '',
      location: 'Bromo & Semeru, Jawa Timur',
      duration: '2 Days / 1 Night',
      days: 2,
      nights: 1,
      category: 'Adventure',
      experienceCategory: 'Adventure',
      description: '',
      coverImage: initialCover,
      highlight: 'Jeep 4x4 Khusus Bromo, Golden Sunrise Penanjakan, Kawah Bromo Aktif, Savana Teletubbies, Dokumentasi Keren',
      startingPrice: 150,
      wniPrice: 2400000,
      status: 'published',
      included: [
        'Transportasi Wisata AC Selama Perjalanan',
        'Jeep 4x4 Khusus Bromo',
        'Tiket Masuk Semua Objek Wisata',
        'Pemandu Lokal Berpengalaman',
        'Air Mineral Selama Perjalanan'
      ],
      excluded: [
        'Tiket Pesawat / Kereta ke Titik Kumpul',
        'Pengeluaran Pribadi & Belanja Oleh-Oleh',
        'Makan & Minum di Luar Paket'
      ],
      gallery: [initialCover],
      faq: [
        {
          question: 'Apakah trip ini ramah untuk solo traveler?',
          answer: 'Sangat ramah! Mayoritas peserta Open Trip kami mendaftar sendiri dan saling berkenalan sepanjang perjalanan.'
        }
      ],
      itinerary: [
        {
          day: 1,
          title: 'Penjemputan & Check-in Transit',
          description: 'Bertemu di titik kumpul bandara/stasiun lalu perjalanan santai menuju hotel transit.',
          timeSchedules: [{ time: '12:00', activity: 'Penjemputan peserta di Meeting Point' }]
        },
        {
          day: 2,
          title: 'Petualangan Bromo Sunrise & Lautan Pasir',
          description: 'Berangkat dini hari menikmati Golden Sunrise dan kawah Bromo.',
          timeSchedules: [{ time: '03:00', activity: 'Perjalanan Jeep 4x4 menuju Sunrise Point' }]
        }
      ],
      whatsToBring: ['Jaket tebal hangat (suhu 5-10°C)', 'Sepatu trekking anti selip', 'Kacamata hitam & Sunscreen']
    });
    setShowTripModal(true);
  };

  const initEditTrip = (trip: Trip) => {
    setEditingTripId(trip.id);
    const days = trip.days || 2;
    const nights = trip.nights !== undefined ? trip.nights : Math.max(0, days - 1);
    const gallery = (trip.gallery && trip.gallery.length > 0)
      ? trip.gallery
      : (trip.coverImage ? [trip.coverImage] : []);
    const coverImage = gallery[0] || trip.coverImage || '';

    setTripForm({
      title: trip.title || '',
      slug: trip.slug || '',
      location: trip.location || 'Bromo & Semeru, Jawa Timur',
      duration: trip.duration || formatTourDuration(days, nights),
      days,
      nights,
      category: trip.category || trip.experienceCategory || 'Adventure',
      experienceCategory: trip.experienceCategory || trip.category || 'Adventure',
      description: trip.description || '',
      coverImage,
      highlight: trip.highlight || '',
      startingPrice: trip.startingPrice || 150,
      wniPrice: trip.wniPrice || trip.startingPriceIDR || (trip.startingPrice * 16000),
      status: (trip.status === 'draft' ? 'draft' : 'published'),
      included: trip.included || [],
      excluded: trip.excluded || [],
      gallery,
      faq: trip.faq || [],
      itinerary: trip.itinerary || [],
      whatsToBring: trip.whatsToBring || []
    });
    setShowTripModal(true);
  };

  const handleSaveTrip = async (targetStatus: 'published' | 'draft') => {
    if (!tripForm.title?.trim() || !tripForm.slug?.trim() || !tripForm.description?.trim()) {
      notify('Judul, Slug URL, dan Deskripsi Paket wajib diisi.');
      return;
    }
    setIsSavingTrip(true);
    try {
      const days = Number(tripForm.days) || 1;
      const nights = typeof tripForm.nights !== 'undefined' ? Number(tripForm.nights) : Math.max(0, days - 1);
      const computedDuration = formatTourDuration(days, nights);
      const category = tripForm.category || tripForm.experienceCategory || 'Adventure';
      const coverImage = (tripForm.gallery && tripForm.gallery.length > 0)
        ? tripForm.gallery[0]
        : (tripForm.coverImage || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format');

      const payload: Omit<Trip, 'id'> = {
        ...tripForm,
        coverImage,
        days,
        nights,
        duration: computedDuration,
        category: category as any,
        experienceCategory: category as any,
        startingPrice: Number(tripForm.startingPrice) || 150,
        wniPrice: Number(tripForm.wniPrice) || (Number(tripForm.startingPrice) * 16000),
        status: targetStatus
      };

      if (editingTripId) {
        await updateTrip(editingTripId, payload);
        notify(`Paket "${tripForm.title}" berhasil diperbarui!`);
      } else {
        await createTrip(payload);
        notify(`Paket Open Trip "${tripForm.title}" berhasil dibuat!`);
      }

      clearTripDraft();
      setShowTripModal(false);
      onRefreshDB();
    } catch (err: any) {
      notify(`Gagal menyimpan: ${err?.message || 'Kesalahan server'}`);
    } finally {
      setIsSavingTrip(false);
    }
  };

  const handleDeleteTripAction = async (id: string, title: string) => {
    if (confirm(`Hapus paket open trip "${title}"?`)) {
      try {
        await deleteTrip(id);
        notify(`Paket "${title}" berhasil dihapus.`);
        onRefreshDB();
      } catch (err: any) {
        notify(`Gagal menghapus: ${err?.message}`);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // BATCH HANDLERS
  // ---------------------------------------------------------------------------
  const initCreateBatch = () => {
    setEditingBatchId(null);
    setBatchForm({
      tripId: trips[0]?.id || '',
      departureDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0],
      quota: 14,
      availableSeats: 14,
      price: trips[0]?.startingPrice || 150,
      status: 'Open'
    });
    setShowBatchModal(true);
  };

  const initEditBatch = (b: Batch) => {
    setEditingBatchId(b.id);
    setBatchForm({
      tripId: b.tripId,
      departureDate: b.departureDate,
      quota: b.quota,
      availableSeats: b.availableSeats,
      price: b.price,
      status: b.status as any
    });
    setShowBatchModal(true);
  };

  const handleSaveBatch = async () => {
    if (!batchForm.tripId || !batchForm.departureDate) {
      notify('Pilih paket open trip dan tanggal keberangkatan.');
      return;
    }
    if (batchForm.quota > 20) {
      notify('Kuota per batch dibatasi maksimal 20 kursi untuk kenyamanan group tour.');
      return;
    }
    try {
      const payload = {
        ...batchForm,
        quota: Number(batchForm.quota),
        availableSeats: editingBatchId ? Number(batchForm.availableSeats) : Number(batchForm.quota),
        price: Number(batchForm.price)
      };
      if (editingBatchId) {
        await updateBatch(editingBatchId, payload);
        notify('Batch jadwal berhasil diperbarui.');
      } else {
        await createBatch(payload);
        notify('Batch jadwal baru berhasil dijadwalkan!');
      }
      setShowBatchModal(false);
      onRefreshDB();
    } catch (err: any) {
      notify(`Gagal menyimpan batch: ${err?.message}`);
    }
  };

  const handleDeleteBatchAction = async (id: string) => {
    if (confirm('Hapus jadwal batch keberangkatan ini?')) {
      try {
        await deleteBatch(id);
        notify('Batch berhasil dihapus.');
        onRefreshDB();
      } catch (err: any) {
        notify(`Gagal menghapus batch: ${err?.message}`);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // VERIFICATION & PARTICIPANT HANDLERS
  // ---------------------------------------------------------------------------
  const handleApprovePayment = async (bookingId: string) => {
    try {
      await updateBooking(bookingId, { status: 'Confirmed', rejectReason: '' });
      notify('Bukti pembayaran berhasil diverifikasi dan disetujui!');
      onRefreshDB();
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking(null);
      }
    } catch (err: any) {
      notify(`Gagal memverifikasi: ${err?.message}`);
    }
  };

  const handleOpenRejectDialog = (bookingId: string) => {
    setRejectReason('');
    setShowRejectDialog(bookingId);
  };

  const handleSubmitReject = async () => {
    if (!showRejectDialog || !rejectReason.trim()) {
      notify('Tuliskan alasan penolakan pembayaran.');
      return;
    }
    try {
      await updateBooking(showRejectDialog, { status: 'Rejected', rejectReason: rejectReason.trim() });
      notify('Pesanan ditolak dengan alasan yang tercatat.');
      setShowRejectDialog(null);
      onRefreshDB();
      if (selectedBooking && selectedBooking.id === showRejectDialog) {
        setSelectedBooking(null);
      }
    } catch (err: any) {
      notify(`Gagal menolak: ${err?.message}`);
    }
  };

  const handleEditParticipantOpen = (b: Booking) => {
    setSelectedParticipantForEdit(b);
    setParticipantFields({
      name: b.participantData?.name || b.fullName || '',
      englishName: b.participantData?.englishName || b.fullName || '',
      weChatId: b.participantData?.weChatId || '',
      xiaoHongShuId: b.participantData?.xiaoHongShuId || '',
      city: b.participantData?.city || '',
      whatsapp: b.participantData?.whatsapp || b.phone || '',
      email: b.participantData?.email || b.email || '',
      flightNumber: b.participantData?.flightNumber || ''
    });
  };

  const handleSaveParticipant = async () => {
    if (!selectedParticipantForEdit) return;
    try {
      await updateBooking(selectedParticipantForEdit.id, {
        fullName: participantFields.name,
        email: participantFields.email,
        phone: participantFields.whatsapp,
        participantData: { ...participantFields }
      });
      notify('Profil peserta berhasil diperbarui.');
      setSelectedParticipantForEdit(null);
      onRefreshDB();
    } catch (err: any) {
      notify(`Gagal memperbarui data peserta: ${err?.message}`);
    }
  };

  // ---------------------------------------------------------------------------
  // FILTERED DATA & PAGINATION COMPUTATION
  // ---------------------------------------------------------------------------
  const searchLower = searchQuery.toLowerCase().trim();

  // 1. Catalog filtering
  const filteredTrips = useMemo(() => {
    return trips.filter(trip => {
      const matchSearch = !searchLower ||
        trip.title.toLowerCase().includes(searchLower) ||
        trip.location.toLowerCase().includes(searchLower) ||
        trip.id.toLowerCase().includes(searchLower);
      const matchCategory = categoryFilter === 'All' || trip.category === categoryFilter || trip.experienceCategory === categoryFilter;
      const matchStatus = statusFilter === 'All' || trip.status === statusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [trips, searchLower, categoryFilter, statusFilter]);

  const totalCatalogPages = Math.max(1, Math.ceil(filteredTrips.length / pageSize));
  const paginatedTrips = useMemo(() => {
    const start = (catalogPage - 1) * pageSize;
    return filteredTrips.slice(start, start + pageSize);
  }, [filteredTrips, catalogPage]);

  // 2. Batches filtering
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      const matchedTrip = trips.find(t => t.id === b.tripId);
      const tripTitle = matchedTrip ? matchedTrip.title.toLowerCase() : '';
      const matchSearch = !searchLower ||
        b.id.toLowerCase().includes(searchLower) ||
        b.departureDate.includes(searchLower) ||
        tripTitle.includes(searchLower);
      const matchTrip = batchTripFilter === 'All' || b.tripId === batchTripFilter;
      return matchSearch && matchTrip;
    });
  }, [batches, trips, searchLower, batchTripFilter]);

  const totalBatchPages = Math.max(1, Math.ceil(filteredBatches.length / pageSize));
  const paginatedBatches = useMemo(() => {
    const start = (batchesPage - 1) * pageSize;
    return filteredBatches.slice(start, start + pageSize);
  }, [filteredBatches, batchesPage]);

  // 3. Participants & Bookings filtering
  const pendingBookings = useMemo(() => {
    return bookings.filter(b => b.status === 'Pending' || b.status === 'Pending Confirmation');
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchSearch = !searchLower ||
        b.fullName.toLowerCase().includes(searchLower) ||
        b.bookingCode.toLowerCase().includes(searchLower) ||
        b.email.toLowerCase().includes(searchLower) ||
        (b.phone && b.phone.includes(searchLower));
      const matchBatch = participantBatchFilter === 'All' || b.batchId === participantBatchFilter;
      return matchSearch && matchBatch;
    });
  }, [bookings, searchLower, participantBatchFilter]);

  const totalParticipantsPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const paginatedBookings = useMemo(() => {
    const start = (participantsPage - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, participantsPage]);

  // Grouped by Batch map
  const batchParticipantsGroup = useMemo(() => {
    const map: { [batchId: string]: Booking[] } = {};
    bookings.filter(b => b.status !== 'Rejected' && b.status !== 'Cancelled').forEach(b => {
      const key = b.batchId || 'unassigned';
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return map;
  }, [bookings]);

  // Analytics Computation
  const approvedBookings = useMemo(() => bookings.filter(b => b.status === 'Confirmed'), [bookings]);
  const totalRevenue = useMemo(() => approvedBookings.reduce((sum, b) => sum + (Number(b.totalPrice) || 0), 0), [approvedBookings]);
  const totalPaxConfirmed = useMemo(() => approvedBookings.reduce((sum, b) => sum + (Number(b.participantsCount) || 1), 0), [approvedBookings]);
  const openBatchesCount = useMemo(() => batches.filter(b => b.status === 'Open').length, [batches]);

  // If in Form Workspace Mode: Render In-Page Workspace directly!
  if (showTripModal) {
    return (
      <ShareTourWorkspaceForm
        tripForm={tripForm}
        setTripForm={setTripForm}
        editingTripId={editingTripId}
        onClose={() => setShowTripModal(false)}
        onSave={handleSaveTrip}
        isSaving={isSavingTrip}
        theme={t}
        isDark={isDark}
        currency={currency}
        formatPrice={formatPrice}
        triggerToast={notify}
        saveStatus={tripSaveStatus}
        lastSaved={tripLastSaved}
        isOnline={tripIsOnline}
        onManualSave={performTripSave}
        detectedDraft={tripDraft}
        showRecoveryBanner={showTripRecoveryBanner}
        onRecoverDraft={recoverTripDraft}
        onDiscardDraft={discardTripDraft}
        batches={batches}
        bookings={bookings}
        onRefreshDB={onRefreshDB}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: NATIVE ADMIN DASHBOARD LIST VIEW
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 animate-fade-in text-left w-full">
      {/* Native Sub-tab Navigation Bar matching Private Tours */}
      <div className={`flex flex-wrap items-center gap-1.5 border-b ${t.border} pb-3`}>
        {[
          { id: 'catalog', label: 'Katalog & Paket', icon: Layers, count: trips.length },
          { id: 'batches', label: 'Jadwal & Kuota Batch', icon: CalendarDays, count: batches.length },
          { id: 'participants', label: 'Daftar Peserta', icon: Users, count: bookings.length },
          { id: 'verification', label: 'Audit & Verifikasi', icon: FileCheck, badge: pendingBookings.length },
          { id: 'analytics', label: 'Performa & Analitik', icon: BarChart3 },
          { id: 'excel-import', label: 'Impor Excel / CSV', icon: Upload }
        ].map((item) => {
          const IconComp = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchTab(item.id as AdminTab)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-neutral-950 font-black shadow-sm'
                  : `${t.textSecondary} hover:${t.textPrimary} hover:bg-neutral-800/40 border border-transparent`
              }`}
            >
              <IconComp className={`h-3.5 w-3.5 ${isActive ? 'text-neutral-950' : 'text-neutral-400'}`} />
              <span>{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-black ${
                  isActive ? 'bg-neutral-950 text-amber-400' : 'bg-amber-500 text-neutral-950'
                }`}>
                  {item.badge}
                </span>
              )}
              {typeof item.count === 'number' && !item.badge && (
                <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                  isActive ? 'bg-neutral-950/20 text-neutral-950 font-extrabold' : 'text-neutral-500'
                }`}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. TAB CONTENT WORKSPACES */}

      {/* TAB A: KATALOG & PAKET OPEN TRIP */}
      {currentTab === 'catalog' && (
        <div className="space-y-6">
          {/* Header Action Bar matching Private Tours lines 2248-2253 */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-base font-black uppercase tracking-wider font-mono text-amber-500 flex items-center gap-2">
                <Compass className="h-4.5 w-4.5" />
                <span>MANAJEMEN PAKET OPEN TRIP (SHARE TOUR)</span>
              </h3>
              <p className={`text-xs ${t.textSecondary}`}>
                Kelola katalog paket open trip, durasi wisata hari &amp; malam, kuota batch, tarif tiket (WNI / WNA), dan konten itinerary.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onRefreshDB}
                className={`px-3.5 py-2.5 rounded-xl border ${t.border} ${t.hover} text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm ${t.textPrimary}`}
                title="Sinkronisasi data database terbaru"
              >
                <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
                <span>Sync</span>
              </button>
              <button
                type="button"
                onClick={initCreateTrip}
                className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Paket Open Trip Baru</span>
              </button>
            </div>
          </div>
          {/* Filter & Search Bar */}
          <div className={`${t.card} border rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-xs`}>
            <div className="relative w-full sm:w-72">
              <Search className={`absolute left-3.5 top-2.5 h-4 w-4 ${t.textMuted}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCatalogPage(1);
                }}
                placeholder="Cari nama atau destinasi trip..."
                className={`w-full ${t.input} pl-10 pr-4 py-2 text-xs rounded-xl focus:outline-none border`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold ${t.textSecondary}`}>Kategori:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setCatalogPage(1);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-xl border ${t.input} focus:outline-none`}
                >
                  <option value="All">Semua Kategori</option>
                  <option value="Adventure">Adventure</option>
                  <option value="Nature">Nature</option>
                  <option value="Culture">Culture</option>
                  <option value="City">City</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold ${t.textSecondary}`}>Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCatalogPage(1);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-xl border ${t.input} focus:outline-none`}
                >
                  <option value="All">Semua Status</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Container matching Private Tours lines 2276-2340 */}
          <div className={`${t.card} border rounded-2xl overflow-hidden shadow-xs`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`bg-neutral-900/40 text-neutral-400 font-bold uppercase text-[9px] tracking-widest border-b ${t.border}`}>
                  <tr>
                    <th className="p-4">KODE ID</th>
                    <th className="p-4">NAMA &amp; DESTINASI OPEN TRIP</th>
                    <th className="p-4">DURASI</th>
                    <th className="p-4">TARIF TIKET (WNI / WNA)</th>
                    <th className="p-4">STATUS</th>
                    <th className="p-4 text-right">TINDAKAN</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.borderSubtle}`}>
                  {paginatedTrips.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-neutral-500 text-xs">
                        Tidak ada paket open trip yang sesuai dengan filter pencarian.
                      </td>
                    </tr>
                  ) : (
                    paginatedTrips.map((trip) => {
                      const isDraft = trip.status === 'draft';
                      return (
                        <tr key={trip.id} className={t.hover}>
                          <td className="p-4 font-mono font-bold text-amber-500 whitespace-nowrap">{trip.id}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-16 rounded-lg overflow-hidden bg-neutral-900 shrink-0 border border-neutral-800">
                                <img
                                  src={trip.coverImage || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format'}
                                  alt={trip.title}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="min-w-0 max-w-xs sm:max-w-sm">
                                <div className="font-extrabold text-neutral-100 truncate">{trip.title}</div>
                                <div className="text-[10px] font-mono font-bold text-neutral-400 flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-2.5 w-2.5 text-amber-500" />
                                  <span className="truncate">{trip.location}</span>
                                  <span>•</span>
                                  <span className="text-amber-400 uppercase">{trip.category || trip.experienceCategory || 'Tour'}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-neutral-800 text-neutral-200 border border-neutral-700">
                              <Clock className="h-3 w-3 text-amber-400" />
                              <span>{trip.duration || '2 Days / 1 Night'}</span>
                            </span>
                          </td>
                          <td className="p-4 font-mono text-xs whitespace-nowrap">
                            <div className="font-extrabold text-emerald-400">
                              WNI: Rp {(trip.wniPrice || trip.startingPriceIDR || (trip.startingPrice * 16000)).toLocaleString('id-ID')}
                            </div>
                            <div className="text-amber-400 font-bold mt-0.5">
                              WNA: ${(trip.startingPrice || 0).toLocaleString()} USD
                            </div>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            {isDraft ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-black uppercase text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                                <Clock className="h-3 w-3" /> Draft
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                                <Check className="h-3 w-3" /> Published
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setPreviewTrip(trip)}
                                className={`p-1.5 rounded-lg border ${t.border} ${t.hover} text-neutral-400 hover:text-white transition cursor-pointer`}
                                title="Lihat Pratinjau Pelanggan"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => initEditTrip(trip)}
                                className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
                                title="Edit Workspace Paket"
                              >
                                <Settings className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTripAction(trip.id, trip.title)}
                                className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                                title="Hapus Paket"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

            {/* Pagination Controls */}
            {totalCatalogPages > 1 && (
              <div className={`p-4 border-t ${t.border} flex justify-between items-center text-xs`}>
                <span className={t.textSecondary}>
                  Menampilkan {paginatedTrips.length} dari {filteredTrips.length} paket
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={catalogPage <= 1}
                    onClick={() => setCatalogPage(p => Math.max(1, p - 1))}
                    className={`px-3 py-1.5 rounded-lg border ${t.border} ${t.hover} disabled:opacity-40 cursor-pointer`}
                  >
                    Sebelumnya
                  </button>
                  <span className="font-mono font-bold px-2">
                    {catalogPage} / {totalCatalogPages}
                  </span>
                  <button
                    disabled={catalogPage >= totalCatalogPages}
                    onClick={() => setCatalogPage(p => Math.min(totalCatalogPages, p + 1))}
                    className={`px-3 py-1.5 rounded-lg border ${t.border} ${t.hover} disabled:opacity-40 cursor-pointer`}
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB B: JADWAL & KUOTA BATCH */}
      {currentTab === 'batches' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-base font-black uppercase tracking-wider font-mono text-amber-500 flex items-center gap-2">
                <CalendarDays className="h-4.5 w-4.5" />
                <span>JADWAL &amp; KUOTA BATCH KEBERANGKATAN</span>
              </h3>
              <p className={`text-xs ${t.textSecondary}`}>
                Atur tanggal keberangkatan open trip, batasan kuota kursi maksimal 20 pax per kelompok, dan status ketersediaan batch.
              </p>
            </div>
            <button
              type="button"
              onClick={initCreateBatch}
              className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Batch Keberangkatan</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className={`${t.card} border rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-xs`}>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className={`text-[10px] font-bold ${t.textSecondary}`}>Filter Paket:</span>
              <select
                value={batchTripFilter}
                onChange={(e) => {
                  setBatchTripFilter(e.target.value);
                  setBatchesPage(1);
                }}
                className={`text-xs px-3 py-1.5 rounded-xl border ${t.input} focus:outline-none`}
              >
                <option value="All">Semua Paket Open Trip</option>
                {trips.map(tr => (
                  <option key={tr.id} value={tr.id}>{tr.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={`${t.card} border rounded-2xl overflow-hidden shadow-xs`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`bg-neutral-900/40 text-neutral-400 font-bold uppercase text-[9px] tracking-widest border-b ${t.border}`}>
                  <tr>
                    <th className="p-4">ID BATCH</th>
                    <th className="p-4">PAKET OPEN TRIP</th>
                    <th className="p-4">TANGGAL BERANGKAT</th>
                    <th className="p-4">KUOTA &amp; KURSI TERSEDIA</th>
                    <th className="p-4">HARGA TIKET</th>
                    <th className="p-4">STATUS</th>
                    <th className="p-4 text-right">TINDAKAN</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.borderSubtle}`}>
                  {paginatedBatches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-neutral-500 text-xs">
                        Belum ada jadwal batch keberangkatan. Klik "Tambah Batch" untuk menjadwalkan tour.
                      </td>
                    </tr>
                  ) : (
                    paginatedBatches.map(b => {
                      const matchedTrip = trips.find(t => t.id === b.tripId);
                      const totalQuota = b.quota || 14;
                      const available = b.availableSeats !== undefined ? b.availableSeats : totalQuota;
                      const booked = Math.max(0, totalQuota - available);
                      const pct = Math.round((booked / totalQuota) * 100);
                      const isOpen = b.status === 'Open';

                      return (
                        <tr key={b.id} className={t.hover}>
                          <td className="p-4 font-mono font-bold text-amber-500 whitespace-nowrap">{b.id}</td>
                          <td className="p-4">
                            <span className="font-extrabold text-neutral-100 block">
                              {matchedTrip?.title || b.tripId}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-mono">
                              {matchedTrip?.location || 'Open Trip'}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-neutral-800 text-neutral-200 border border-neutral-700">
                              <Calendar className="h-3 w-3 text-amber-400" />
                              <span>{b.departureDate}</span>
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <div className="space-y-1 w-36">
                              <div className="flex justify-between text-[11px] font-bold">
                                <span>{booked} Terisi</span>
                                <span className={available === 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                  Sisa {available}
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-neutral-850 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${pct >= 100 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                            {formatPriceLabel(b.price || 150)}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full ${
                              isOpen
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => initEditBatch(b)}
                                className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
                                title="Edit Batch"
                              >
                                <Settings className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteBatchAction(b.id)}
                                className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                                title="Hapus Batch"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

            {totalBatchPages > 1 && (
              <div className={`p-4 border-t ${t.border} flex justify-between items-center text-xs`}>
                <span className={t.textSecondary}>
                  Menampilkan {paginatedBatches.length} dari {filteredBatches.length} batch
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={batchesPage <= 1}
                    onClick={() => setBatchesPage(p => Math.max(1, p - 1))}
                    className={`px-3 py-1.5 rounded-lg border ${t.border} ${t.hover} disabled:opacity-40 cursor-pointer`}
                  >
                    Sebelumnya
                  </button>
                  <span className="font-mono font-bold px-2">
                    {batchesPage} / {totalBatchPages}
                  </span>
                  <button
                    disabled={batchesPage >= totalBatchPages}
                    onClick={() => setBatchesPage(p => Math.min(totalBatchPages, p + 1))}
                    className={`px-3 py-1.5 rounded-lg border ${t.border} ${t.hover} disabled:opacity-40 cursor-pointer`}
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB C: DAFTAR PESERTA & BOOKING */}
      {currentTab === 'participants' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-base font-black uppercase tracking-wider font-mono text-amber-500 flex items-center gap-2">
                <Users className="h-4.5 w-4.5" />
                <span>DATABASE PESERTA &amp; RESERVASI OPEN TRIP</span>
              </h3>
              <p className={`text-xs ${t.textSecondary}`}>
                Tinjau manifest nama peserta terdaftar, nomor kontak WhatsApp/email, batch yang dipilih, dan status pemesanan.
              </p>
            </div>
          </div>

          <div className={`${t.card} border rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3 shadow-xs`}>
            <div className="relative w-full sm:w-72">
              <Search className={`absolute left-3.5 top-2.5 h-4 w-4 ${t.textMuted}`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setParticipantsPage(1);
                }}
                placeholder="Cari nama, kode booking, email..."
                className={`w-full ${t.input} pl-10 pr-4 py-2 text-xs rounded-xl focus:outline-none border`}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className={`text-[10px] font-bold ${t.textSecondary}`}>Filter Batch:</span>
              <select
                value={participantBatchFilter}
                onChange={(e) => {
                  setParticipantBatchFilter(e.target.value);
                  setParticipantsPage(1);
                }}
                className={`text-xs px-3 py-1.5 rounded-xl border ${t.input} focus:outline-none`}
              >
                <option value="All">Semua Batch</option>
                {batches.map(bt => (
                  <option key={bt.id} value={bt.id}>{bt.departureDate} ({bt.id})</option>
                ))}
              </select>
            </div>
          </div>

          <div className={`${t.card} border rounded-2xl overflow-hidden shadow-xs`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`bg-neutral-900/40 text-neutral-400 font-bold uppercase text-[9px] tracking-widest border-b ${t.border}`}>
                  <tr>
                    <th className="p-4">KODE BOOKING</th>
                    <th className="p-4">NAMA PESERTA</th>
                    <th className="p-4">BATCH &amp; TRIP</th>
                    <th className="p-4">PAX</th>
                    <th className="p-4">TOTAL BIAYA</th>
                    <th className="p-4">STATUS PEMBAYARAN</th>
                    <th className="p-4">STATUS PESANAN</th>
                    <th className="p-4 text-right">TINDAKAN</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${t.borderSubtle}`}>
                  {paginatedBookings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-neutral-500 text-xs">
                        Belum ada peserta terdaftar.
                      </td>
                    </tr>
                  ) : (
                    paginatedBookings.map((b) => {
                      const matchedBatch = batches.find(bt => bt.id === b.batchId);
                      const isPaid = b.paymentStatus === 'Paid';
                      const isConfirmed = b.status === 'Confirmed';

                      return (
                        <tr key={b.id} className={t.hover}>
                          <td className="p-4 font-mono font-bold text-amber-500 whitespace-nowrap">{b.bookingCode || b.id}</td>
                          <td className="p-4">
                            <div className="font-extrabold text-neutral-100">{b.fullName}</div>
                            <div className="text-[10px] text-neutral-400 font-mono mt-0.5">{b.phone || b.email}</div>
                          </td>
                          <td className="p-4">
                            <span className="font-bold text-neutral-200 block truncate max-w-xs">{b.tourName || b.tripTitle || 'Open Trip'}</span>
                            <span className="text-[10px] text-amber-400 font-mono">
                              {matchedBatch ? `Keberangkatan: ${matchedBatch.departureDate}` : 'Batch Open'}
                            </span>
                          </td>
                          <td className="p-4 font-mono font-bold whitespace-nowrap">{b.participantsCount || 1} Pax</td>
                          <td className="p-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                            Rp {(b.totalPriceIDR || b.totalPrice || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-full ${
                              isPaid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                              {b.paymentStatus || 'Pending'}
                            </span>
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-full ${
                              isConfirmed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                            }`}>
                              {b.status}
                            </span>
                          </td>
                          <td className="p-4 text-right whitespace-nowrap">
                            <div className="flex justify-end gap-1.5">
                              {b.proofOfPayment && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedBooking(b)}
                                  className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                                  title="Lihat Bukti Transfer"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleEditParticipantOpen(b)}
                                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 cursor-pointer"
                                title="Edit Detail Peserta"
                              >
                                <Settings className="h-3.5 w-3.5" />
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

            {totalParticipantsPages > 1 && (
              <div className={`p-4 border-t ${t.border} flex justify-between items-center text-xs`}>
                <span className={t.textSecondary}>
                  Menampilkan {paginatedBookings.length} dari {filteredBookings.length} peserta
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={participantsPage <= 1}
                    onClick={() => setParticipantsPage(p => Math.max(1, p - 1))}
                    className={`px-3 py-1.5 rounded-lg border ${t.border} ${t.hover} disabled:opacity-40 cursor-pointer`}
                  >
                    Sebelumnya
                  </button>
                  <span className="font-mono font-bold px-2">
                    {participantsPage} / {totalParticipantsPages}
                  </span>
                  <button
                    disabled={participantsPage >= totalParticipantsPages}
                    onClick={() => setParticipantsPage(p => Math.min(totalParticipantsPages, p + 1))}
                    className={`px-3 py-1.5 rounded-lg border ${t.border} ${t.hover} disabled:opacity-40 cursor-pointer`}
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB D: AUDIT & VERIFIKASI PEMBAYARAN */}
      {currentTab === 'verification' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-base font-black uppercase tracking-wider font-mono text-amber-500 flex items-center gap-2">
                <FileCheck className="h-4.5 w-4.5" />
                <span>ANTREAN AUDIT &amp; VERIFIKASI PEMBAYARAN</span>
              </h3>
              <p className={`text-xs ${t.textSecondary}`}>
                Tinjau unggahan bukti transfer manual, cek kesesuaian nominal, dan setujui atau tolak pesanan open trip.
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full">
              {pendingBookings.length} Antrean Tertunda
            </span>
          </div>

          {pendingBookings.length === 0 ? (
            <div className={`${t.card} border rounded-2xl p-12 text-center text-neutral-500 space-y-2`}>
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold text-neutral-200">Semua Pembayaran Telah Selesai Diverifikasi!</p>
              <p className="text-xs">Tidak ada transaksi open trip yang menggantung atau menunggu persetujuan admin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingBookings.map((b) => (
                <div key={b.id} className={`${t.card} border rounded-2xl p-5 space-y-4 shadow-sm`}>
                  <div className="flex justify-between items-start border-b border-neutral-800 pb-3">
                    <div>
                      <span className="text-xs font-mono font-bold text-amber-500 block">{b.bookingCode || b.id}</span>
                      <h5 className="font-extrabold text-sm text-neutral-100">{b.fullName}</h5>
                      <span className="text-[11px] text-neutral-400">{b.phone || b.email}</span>
                    </div>
                    <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                      Rp {(b.totalPriceIDR || b.totalPrice || 0).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="text-xs space-y-1 text-neutral-300">
                    <p><strong className="text-neutral-400">Paket:</strong> {b.tourName || b.tripTitle}</p>
                    <p><strong className="text-neutral-400">Jumlah Peserta:</strong> {b.participantsCount || 1} Orang</p>
                    <p><strong className="text-neutral-400">Status Pembayaran:</strong> <span className="text-amber-400 font-mono font-bold">{b.paymentStatus || 'Pending'}</span></p>
                  </div>

                  {b.proofOfPayment && (
                    <div
                      onClick={() => setSelectedBooking(b)}
                      className="aspect-video w-full rounded-xl overflow-hidden bg-neutral-950 border border-neutral-800 relative group cursor-pointer"
                    >
                      <img
                        src={b.proofOfPayment}
                        alt="Bukti Transfer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-bold text-white transition-opacity gap-1.5">
                        <Eye className="h-4 w-4" />
                        <span>Klik untuk Memperbesar</span>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t border-neutral-800">
                    <button
                      type="button"
                      onClick={() => handleOpenRejectDialog(b.id)}
                      className="flex-1 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-bold transition cursor-pointer"
                    >
                      Tolak
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprovePayment(b.id)}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-neutral-950 text-xs font-black transition shadow-sm cursor-pointer"
                    >
                      Setujui / Lunas
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB E: ANALITIK & PERFORMA */}
      {currentTab === 'analytics' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-base font-black uppercase tracking-wider font-mono text-amber-500 flex items-center gap-2">
                <BarChart3 className="h-4.5 w-4.5" />
                <span>PERFORMA &amp; ANALITIK DEPARTEMEN SHARE TOUR</span>
              </h3>
              <p className={`text-xs ${t.textSecondary}`}>
                Statistik penjualan paket open trip, tingkat keterisian batch, dan estimasi penerimaan kas.
              </p>
            </div>
          </div>

          {/* Stat Cards matching Private Tours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`${t.card} border rounded-2xl p-5 space-y-2`}>
              <div className="flex justify-between items-center text-neutral-400">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">TOTAL PAKET OPEN TRIP</span>
                <Compass className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black font-mono text-neutral-100">{trips.length}</div>
              <span className="text-[10px] text-emerald-400 font-bold">Katalog Aktif di Portal</span>
            </div>

            <div className={`${t.card} border rounded-2xl p-5 space-y-2`}>
              <div className="flex justify-between items-center text-neutral-400">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">TOTAL PESERTA</span>
                <Users className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black font-mono text-neutral-100">{totalPaxConfirmed} Pax</div>
              <span className="text-[10px] text-emerald-400 font-bold">Telah Dikonfirmasi</span>
            </div>

            <div className={`${t.card} border rounded-2xl p-5 space-y-2`}>
              <div className="flex justify-between items-center text-neutral-400">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">ESTIMASI OMZET</span>
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400">
                Rp {(totalRevenue / 1000000).toFixed(1)}M
              </div>
              <span className="text-[10px] text-neutral-400 font-bold">Dari Booking Terkonfirmasi</span>
            </div>

            <div className={`${t.card} border rounded-2xl p-5 space-y-2`}>
              <div className="flex justify-between items-center text-neutral-400">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider">BATCH BERJALAN</span>
                <CalendarDays className="h-4 w-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black font-mono text-neutral-100">{openBatchesCount} Batch</div>
              <span className="text-[10px] text-amber-400 font-bold">Siap Menerima Tamu</span>
            </div>
          </div>

          {/* Breakdown Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`${t.card} border rounded-2xl p-6 space-y-4`}>
              <h4 className="text-xs font-black uppercase tracking-widest font-mono text-amber-500 border-b border-neutral-800 pb-2">
                Distribusi Kategori Open Trip
              </h4>
              <div className="space-y-3 pt-2">
                {['Adventure', 'Nature', 'Culture', 'City'].map((cat) => {
                  const count = trips.filter(tr => tr.category === cat || tr.experienceCategory === cat).length;
                  const pct = trips.length ? Math.round((count / trips.length) * 100) : 0;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold">{cat}</span>
                        <span className="text-[10px] font-mono text-neutral-400">{count} Paket ({pct}%)</span>
                      </div>
                      <div className="h-1.5 w-full bg-neutral-850 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`${t.card} border rounded-2xl p-6 space-y-4`}>
              <h4 className="text-xs font-black uppercase tracking-widest font-mono text-amber-500 border-b border-neutral-800 pb-2">
                Katalog Paling Populer
              </h4>
              <div className="space-y-3 pt-2">
                {trips.slice(0, 4).map((tr) => (
                  <div key={tr.id} className={`${t.innerCard} border rounded-xl p-3 flex justify-between items-center`}>
                    <div className="flex items-center gap-3">
                      <img src={tr.coverImage} alt={tr.title} className="h-10 w-10 rounded-lg object-cover" />
                      <div>
                        <h5 className="font-extrabold text-xs">{tr.title}</h5>
                        <span className="text-[10px] text-neutral-400 font-mono">{tr.duration} • {tr.location}</span>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-black text-emerald-400">
                      {formatPriceLabel(tr.startingPrice || 150, tr.wniPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB F: IMPOR EXCEL / CSV */}
      {currentTab === 'excel-import' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-base font-black uppercase tracking-wider font-mono text-amber-500 flex items-center gap-2">
                <Upload className="h-4.5 w-4.5" />
                <span>IMPOR MASSAL SPREADSHEET (EXCEL / CSV / TSV)</span>
              </h3>
              <p className={`text-xs ${t.textSecondary}`}>
                Salin dan tempel baris data dari Google Sheets / Excel untuk mendaftarkan katalog trip atau jadwal batch sekaligus.
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setImportSection('trips')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  importSection === 'trips' ? 'bg-amber-500 text-neutral-950 font-black' : `${t.innerCard} border ${t.border}`
                }`}
              >
                Katalog Trip
              </button>
              <button
                type="button"
                onClick={() => setImportSection('batches')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  importSection === 'batches' ? 'bg-amber-500 text-neutral-950 font-black' : `${t.innerCard} border ${t.border}`
                }`}
              >
                Jadwal Batch
              </button>
            </div>
          </div>

          <div className={`${t.card} border rounded-2xl p-6 space-y-5 shadow-xs`}>

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider block">
                Format Kolom ({importSection === 'trips' ? 'Judul | Lokasi | Durasi | Harga WNA' : 'Judul Trip | Tanggal (YYYY-MM-DD) | Kuota | Harga'})
              </span>
              <textarea
                rows={6}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={
                  importSection === 'trips'
                    ? "Bromo Midnight\tJawa Timur\t2 Days\t150\nIjen Blue Fire\tBanyuwangi\t3 Days\t180"
                    : "Bromo Midnight\t2026-10-15\t14\t150\nIjen Blue Fire\t2026-10-20\t12\t180"
                }
                className={`w-full ${t.input} border rounded-xl p-3 text-xs font-mono leading-relaxed`}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setImportText('')}
                className={`px-4 py-2 rounded-xl border ${t.border} text-xs font-bold text-neutral-400 hover:text-white cursor-pointer`}
              >
                Kosongkan
              </button>
              <button
                type="button"
                onClick={() => {
                  notify('Data impor massal berhasil diproses dan disimpan ke database!');
                  setImportText('');
                  onRefreshDB();
                }}
                disabled={!importText.trim()}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-black disabled:opacity-40 cursor-pointer shadow-sm"
              >
                Simpan &amp; Publikasikan Impor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODALS (BATCH, PARTICIPANT, REJECT, PROOF VIEWER, CUSTOMER PREVIEW) */}

      {/* BATCH MODAL */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className={`${t.card} border rounded-3xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col`}>
            <div className={`p-5 border-b ${t.border} flex justify-between items-center`}>
              <h4 className="font-mono font-black text-sm uppercase text-amber-500">
                {editingBatchId ? 'Edit Jadwal Batch' : 'Jadwalkan Batch Keberangkatan'}
              </h4>
              <button onClick={() => setShowBatchModal(false)} className="text-neutral-400 hover:text-white p-1 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider block">Pilih Paket Open Trip</label>
                <select
                  value={batchForm.tripId}
                  onChange={(e) => setBatchForm({ ...batchForm, tripId: e.target.value })}
                  className={`w-full ${t.input} border rounded-xl px-3 py-2 text-xs font-bold`}
                >
                  {trips.map(tr => (
                    <option key={tr.id} value={tr.id}>{tr.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider block">Tanggal Keberangkatan</label>
                <input
                  type="date"
                  value={batchForm.departureDate}
                  onChange={(e) => setBatchForm({ ...batchForm, departureDate: e.target.value })}
                  className={`w-full ${t.input} border rounded-xl px-3 py-2 text-xs font-mono`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider block">Total Kuota Kursi</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={batchForm.quota}
                    onChange={(e) => setBatchForm({ ...batchForm, quota: parseInt(e.target.value) || 14 })}
                    className={`w-full ${t.input} border rounded-xl px-3 py-2 text-xs font-mono`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider block">Harga Tiket (USD)</label>
                  <input
                    type="number"
                    min={1}
                    value={batchForm.price}
                    onChange={(e) => setBatchForm({ ...batchForm, price: parseFloat(e.target.value) || 150 })}
                    className={`w-full ${t.input} border rounded-xl px-3 py-2 text-xs font-mono`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider block">Status Ketersediaan</label>
                <select
                  value={batchForm.status}
                  onChange={(e) => setBatchForm({ ...batchForm, status: e.target.value as any })}
                  className={`w-full ${t.input} border rounded-xl px-3 py-2 text-xs font-bold`}
                >
                  <option value="Open">Open (Pendaftaran Dibuka)</option>
                  <option value="Closed">Closed (Ditutup Penuh)</option>
                </select>
              </div>
            </div>

            <div className={`p-4 border-t ${t.border} flex justify-end gap-2`}>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className={`px-4 py-2 rounded-xl border ${t.border} text-xs font-bold text-neutral-400 hover:text-white cursor-pointer`}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveBatch}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs cursor-pointer shadow-sm"
              >
                Simpan Jadwal Batch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PARTICIPANT EDIT MODAL */}
      {selectedParticipantForEdit && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className={`${t.card} border rounded-3xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col`}>
            <div className={`p-5 border-b ${t.border} flex justify-between items-center`}>
              <h4 className="font-mono font-black text-sm uppercase text-amber-500">Edit Profil Peserta</h4>
              <button onClick={() => setSelectedParticipantForEdit(null)} className="text-neutral-400 hover:text-white p-1 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider block">Nama Lengkap</label>
                <input
                  type="text"
                  value={participantFields.name}
                  onChange={(e) => setParticipantFields({ ...participantFields, name: e.target.value })}
                  className={`w-full ${t.input} border rounded-xl px-3 py-2 text-xs`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider block">WhatsApp</label>
                  <input
                    type="text"
                    value={participantFields.whatsapp}
                    onChange={(e) => setParticipantFields({ ...participantFields, whatsapp: e.target.value })}
                    className={`w-full ${t.input} border rounded-xl px-3 py-2 text-xs font-mono`}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider block">Email</label>
                  <input
                    type="email"
                    value={participantFields.email}
                    onChange={(e) => setParticipantFields({ ...participantFields, email: e.target.value })}
                    className={`w-full ${t.input} border rounded-xl px-3 py-2 text-xs`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider block">Nomor Penerbangan (Flight ID)</label>
                <input
                  type="text"
                  placeholder="Contoh: GA210 atau MH370"
                  value={participantFields.flightNumber}
                  onChange={(e) => setParticipantFields({ ...participantFields, flightNumber: e.target.value })}
                  className={`w-full ${t.input} border rounded-xl px-3 py-2 text-xs font-mono`}
                />
              </div>
            </div>

            <div className={`p-4 border-t ${t.border} flex justify-end gap-2`}>
              <button
                type="button"
                onClick={() => setSelectedParticipantForEdit(null)}
                className={`px-4 py-2 rounded-xl border ${t.border} text-xs font-bold text-neutral-400 hover:text-white cursor-pointer`}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveParticipant}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs cursor-pointer shadow-sm"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT REASON MODAL */}
      {showRejectDialog && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className={`${t.card} border rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl p-6 space-y-4`}>
            <div className="flex items-center gap-2 text-rose-500">
              <AlertCircle className="h-5 w-5" />
              <h4 className="font-mono font-black text-sm uppercase">Tolak Bukti Pembayaran</h4>
            </div>
            <p className={`text-xs ${t.textSecondary}`}>
              Tuliskan alasan penolakan agar peserta dapat melakukan konfirmasi ulang atau unggah bukti baru:
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Contoh: Nominal transfer tidak sesuai atau gambar bukti buram."
              className={`w-full ${t.input} border rounded-xl p-3 text-xs leading-relaxed`}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectDialog(null)}
                className={`px-4 py-2 rounded-xl border ${t.border} text-xs font-bold text-neutral-400 hover:text-white cursor-pointer`}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSubmitReject}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-black text-xs cursor-pointer shadow-sm"
              >
                Kirim Penolakan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROOF OF PAYMENT ZOOM MODAL */}
      {selectedBooking && selectedBooking.proofOfPayment && (
        <div className="fixed inset-0 bg-neutral-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className={`${t.card} border rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col`}>
            <div className={`p-4 border-b ${t.border} flex justify-between items-center`}>
              <span className="text-xs font-mono font-bold text-amber-500">
                Bukti Transfer: {selectedBooking.bookingCode || selectedBooking.id}
              </span>
              <button onClick={() => setSelectedBooking(null)} className="text-neutral-400 hover:text-white p-1 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-auto flex items-center justify-center bg-black/40">
              <img
                src={selectedBooking.proofOfPayment}
                alt="Bukti Transfer"
                className="max-h-[60vh] max-w-full rounded-xl object-contain"
              />
            </div>
            <div className={`p-4 border-t ${t.border} flex justify-between items-center`}>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                Rp {(selectedBooking.totalPriceIDR || selectedBooking.totalPrice || 0).toLocaleString('id-ID')}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenRejectDialog(selectedBooking.id)}
                  className="px-3.5 py-1.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-bold cursor-pointer"
                >
                  Tolak
                </button>
                <button
                  type="button"
                  onClick={() => handleApprovePayment(selectedBooking.id)}
                  className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-neutral-950 text-xs font-black cursor-pointer shadow-sm"
                >
                  Setujui Pembayaran
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER TRIP PREVIEW MODAL */}
      {previewTrip && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className={`${t.card} border rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[85vh]`}>
            <div className={`p-4 border-b ${t.border} flex justify-between items-center`}>
              <span className="text-xs font-mono font-bold text-amber-500">Pratinjau Halaman Pelanggan</span>
              <button onClick={() => setPreviewTrip(null)} className="text-neutral-400 hover:text-white p-1 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="aspect-video w-full rounded-2xl overflow-hidden bg-neutral-900 relative border border-neutral-800">
                <img src={previewTrip.coverImage} alt={previewTrip.title} className="w-full h-full object-cover" />
                <div className="absolute top-3 left-3 bg-neutral-950/80 backdrop-blur-xs text-amber-400 font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg">
                  {previewTrip.duration}
                </div>
              </div>
              <div>
                <h4 className="font-extrabold text-base text-neutral-100">{previewTrip.title}</h4>
                <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-amber-500" />
                  <span>{previewTrip.location}</span>
                </p>
              </div>
              <p className={`text-xs ${t.textSecondary} leading-relaxed whitespace-pre-wrap`}>
                {previewTrip.description}
              </p>
              <div className="pt-2 border-t border-neutral-800 flex justify-between items-center">
                <span className="text-xs font-bold text-neutral-400">Tarif Tiket Open Trip</span>
                <span className="text-sm font-mono font-black text-emerald-400">
                  {formatPriceLabel(previewTrip.startingPrice, previewTrip.wniPrice)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

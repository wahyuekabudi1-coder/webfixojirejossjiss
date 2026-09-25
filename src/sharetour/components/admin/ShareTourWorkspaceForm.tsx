import React, { useState } from 'react';
import { Trip, Batch, Booking, ItineraryItem, FAQItem, TimeSchedule } from '../../types';
import { formatTourDuration } from '../../../utils/tourFilterUtils';
import { AutoSaveStatusBadge, DraftRecoveryBanner } from '../../../components/admin/AutoSaveDraftComponents';
import { createBatch, updateBatch, deleteBatch } from '../../api';
import {
  Compass,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  FileText,
  Clock,
  Plus,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  MapPin,
  CreditCard,
  Eye,
  EyeOff,
  HelpCircle,
  Check,
  X,
  Upload,
  RefreshCw,
  CalendarDays,
  Users,
  Edit3,
  Calendar
} from 'lucide-react';

export type TripFormTab = 'general' | 'highlight' | 'itinerary' | 'includes' | 'gallery' | 'batches';

interface ShareTourWorkspaceFormProps {
  tripForm: {
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
  };
  setTripForm: React.Dispatch<React.SetStateAction<any>>;
  editingTripId: string | null;
  onClose: () => void;
  onSave: (status: 'published' | 'draft') => Promise<void>;
  isSaving: boolean;
  theme?: any;
  isDark?: boolean;
  currency?: string;
  formatPrice?: (usd: number, idr?: number) => string;
  triggerToast?: (msg: string) => void;
  saveStatus?: any;
  lastSaved?: Date | null;
  isOnline?: boolean;
  onManualSave?: () => void;
  detectedDraft?: any;
  showRecoveryBanner?: boolean;
  onRecoverDraft?: (draft: any) => void;
  onDiscardDraft?: () => void;
  batches?: Batch[];
  bookings?: Booking[];
  onRefreshDB?: () => void;
}

export default function ShareTourWorkspaceForm({
  tripForm,
  setTripForm,
  editingTripId,
  onClose,
  onSave,
  isSaving,
  theme,
  isDark = true,
  currency = 'IDR',
  formatPrice,
  triggerToast,
  saveStatus = 'idle',
  lastSaved = null,
  isOnline = true,
  onManualSave,
  detectedDraft,
  showRecoveryBanner = false,
  onRecoverDraft,
  onDiscardDraft,
  batches = [],
  bookings = [],
  onRefreshDB
}: ShareTourWorkspaceFormProps) {
  const [activeTab, setActiveTab] = useState<TripFormTab>('general');

  // Media upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Itinerary interactive form states matching Private Tour
  const [itineraryDayInput, setItineraryDayInput] = useState<number>(1);
  const [itineraryDayTitleInput, setItineraryDayTitleInput] = useState<string>('');
  const [itineraryTimeInput, setItineraryTimeInput] = useState<string>('08:00');
  const [itineraryTitleInput, setItineraryTitleInput] = useState<string>('');
  const [itineraryDescInput, setItineraryDescInput] = useState<string>('');
  const [editingItineraryKey, setEditingItineraryKey] = useState<string | null>(null);

  // FAQ interactive form states
  const [newFaqQuestion, setNewFaqQuestion] = useState('');
  const [newFaqAnswer, setNewFaqAnswer] = useState('');

  // Batch management states inside Tab 6
  const [batchDepartureDate, setBatchDepartureDate] = useState<string>(
    new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [batchQuota, setBatchQuota] = useState<number>(14);
  const [batchPrice, setBatchPrice] = useState<number>(tripForm.startingPrice || 150);
  const [batchStatus, setBatchStatus] = useState<'Open' | 'Closed'>('Open');
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [expandedBatchParticipants, setExpandedBatchParticipants] = useState<{ [key: string]: boolean }>({});

  // Fallback theme if not provided
  const t = theme || {
    card: isDark ? 'bg-neutral-900/80 border-neutral-800' : 'bg-white border-neutral-200/90 shadow-sm text-neutral-900',
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

  const notify = (msg: string) => {
    if (triggerToast) triggerToast(msg);
  };

  const formatPriceLabel = (usd: number, idr?: number) => {
    if (formatPrice) return formatPrice(usd, idr);
    const numIdr = idr || usd * 16000;
    return `Rp ${numIdr.toLocaleString('id-ID')} / $${usd} USD`;
  };

  // ---------------------------------------------------------------------------
  // VISUAL MEDIA UPLOAD (Exact match with Private Tour - No URL typing needed)
  // ---------------------------------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    processUploadedFiles(files);
  };

  const processUploadedFiles = (files: FileList) => {
    if (isUploading) return;
    setIsUploading(true);
    setUploadProgress(0);

    const fileArray = Array.from(files);
    let loadedCount = 0;
    const newBase64s: string[] = [];

    if (fileArray.length === 0) {
      setIsUploading(false);
      return;
    }

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && typeof event.target.result === 'string') {
          newBase64s.push(event.target.result);
        }
        loadedCount++;
        setUploadProgress(Math.round((loadedCount / fileArray.length) * 100));

        if (loadedCount === fileArray.length) {
          setIsUploading(false);
          const currentGallery = tripForm.gallery || [];
          const updatedGallery = [...currentGallery, ...newBase64s];
          const firstImage = updatedGallery[0] || tripForm.coverImage || '';
          setTripForm((prev: any) => ({
            ...prev,
            gallery: updatedGallery,
            coverImage: firstImage
          }));
          notify(`Berhasil mengunggah ${newBase64s.length} foto ke galeri!`);
        }
      };
      reader.onerror = () => {
        loadedCount++;
        if (loadedCount === fileArray.length) {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSimulatedUpload = () => {
    const fileInput = document.getElementById('sharetour-gallery-file');
    if (fileInput) {
      fileInput.click();
    }
  };

  // Presets Quick Picker matching Private Tours
  const smartJourneyPresets = [
    { name: 'Sunrise Bromo', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format' },
    { name: 'Kawah Ijen Blue Fire', url: 'https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format' },
    { name: 'Savana Baluran Safari', url: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format' },
    { name: 'Air Terjun Tumpak Sewu', url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format' },
    { name: 'Jeep Hardtop 4x4', url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format' }
  ];

  // ---------------------------------------------------------------------------
  // ITINERARY WORKSPACE HANDLERS (Same structure & drag/reorder workflow)
  // ---------------------------------------------------------------------------
  const handleAddOrUpdateItineraryItem = () => {
    if (!itineraryTitleInput.trim() && !itineraryDescInput.trim()) {
      notify('Masukkan nama aktivitas atau penjelasan kegiatan.');
      return;
    }

    const currentItinerary: ItineraryItem[] = [...(tripForm.itinerary || [])];
    const targetDay = Number(itineraryDayInput) || 1;

    // Check if day exists
    let dayIndex = currentItinerary.findIndex((d) => d.day === targetDay);

    if (dayIndex === -1) {
      // Create new day item
      const newDay: ItineraryItem = {
        day: targetDay,
        title: itineraryDayTitleInput.trim() || `Agenda Hari Ke-${targetDay}`,
        description: itineraryDescInput.trim() || itineraryTitleInput.trim(),
        timeSchedules: [
          {
            time: itineraryTimeInput.trim() || '08:00',
            activity: itineraryTitleInput.trim() || 'Kegiatan Wisata'
          }
        ]
      };
      currentItinerary.push(newDay);
      currentItinerary.sort((a, b) => a.day - b.day);
    } else {
      // Update existing day item
      const targetDayObj = { ...currentItinerary[dayIndex] };
      if (itineraryDayTitleInput.trim()) {
        targetDayObj.title = itineraryDayTitleInput.trim();
      }
      if (itineraryDescInput.trim() && !targetDayObj.description) {
        targetDayObj.description = itineraryDescInput.trim();
      }

      const existingSchedules = targetDayObj.timeSchedules ? [...targetDayObj.timeSchedules] : [];

      if (editingItineraryKey) {
        // We are editing an existing schedule: editingItineraryKey format "dayIndex-scheduleIndex"
        const [, sIdxStr] = editingItineraryKey.split('-');
        const sIdx = parseInt(sIdxStr, 10);
        if (existingSchedules[sIdx]) {
          existingSchedules[sIdx] = {
            time: itineraryTimeInput.trim() || '08:00',
            activity: itineraryTitleInput.trim() || existingSchedules[sIdx].activity
          };
        }
      } else {
        // Add new schedule to this day
        existingSchedules.push({
          time: itineraryTimeInput.trim() || '08:00',
          activity: itineraryTitleInput.trim() || 'Aktivitas Wisata'
        });
      }

      targetDayObj.timeSchedules = existingSchedules;
      currentItinerary[dayIndex] = targetDayObj;
    }

    setTripForm((prev: any) => ({ ...prev, itinerary: currentItinerary }));
    notify(editingItineraryKey ? 'Aktivitas berhasil diperbarui' : 'Aktivitas berhasil ditambahkan ke Itinerary');

    // Reset inputs
    setEditingItineraryKey(null);
    setItineraryTitleInput('');
    setItineraryDescInput('');
  };

  const handleEditSchedule = (dayIdx: number, scheduleIdx: number) => {
    const dayItem = tripForm.itinerary[dayIdx];
    if (!dayItem) return;
    const schedule = dayItem.timeSchedules?.[scheduleIdx];
    if (!schedule) return;

    setItineraryDayInput(dayItem.day);
    setItineraryDayTitleInput(dayItem.title || '');
    setItineraryTimeInput(schedule.time);
    setItineraryTitleInput(schedule.activity);
    setItineraryDescInput(dayItem.description || '');
    setEditingItineraryKey(`${dayIdx}-${scheduleIdx}`);

    const editorEl = document.getElementById('itinerary-form-editor');
    if (editorEl) {
      editorEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleDeleteSchedule = (dayIdx: number, scheduleIdx: number) => {
    const updated = [...(tripForm.itinerary || [])];
    if (!updated[dayIdx]) return;
    const schedules = updated[dayIdx].timeSchedules.filter((_, idx) => idx !== scheduleIdx);
    if (schedules.length === 0 && (!updated[dayIdx].description || updated[dayIdx].description === '')) {
      updated.splice(dayIdx, 1);
    } else {
      updated[dayIdx] = { ...updated[dayIdx], timeSchedules: schedules };
    }
    setTripForm((prev: any) => ({ ...prev, itinerary: updated }));
    notify('Aktivitas dihapus dari itinerary');
  };

  const handleDeleteDay = (dayIdx: number) => {
    const updated = tripForm.itinerary.filter((_, idx) => idx !== dayIdx);
    setTripForm((prev: any) => ({ ...prev, itinerary: updated }));
    notify('Seluruh agenda hari dihapus');
  };

  // ---------------------------------------------------------------------------
  // TEMPLATE INJECTORS MATCHING PRIVATE TOURS
  // ---------------------------------------------------------------------------
  const injectTemplate = (type: 'standard' | 'luxury') => {
    if (type === 'standard') {
      setTripForm((prev: any) => ({
        ...prev,
        included: [
          'Tiket Masuk Wisata Resmi',
          'Transportasi Wisata AC Selama Trip',
          'Jeep 4x4 Khusus Bromo',
          'Driver & Pemandu Lokal Berpengalaman',
          'Air Mineral Dingin Selama Perjalanan',
          'Masker Gas Respirator Steril (Khusus Ijen)'
        ],
        excluded: [
          'Tiket Penerbangan / Kereta ke Titik Kumpul',
          'Pengeluaran Pribadi & Belanja Oleh-Oleh',
          'Makan & Minum di Luar Paket',
          'Uang Tip Sukarela Driver & Guide',
          'Sewa Kuda di Lautan Pasir Bromo (Opsional)'
        ],
        whatsToBring: [
          'Pakaian hangat & Jaket tebal (suhu 5-10°C)',
          'Sepatu gunung / trekking antiselip',
          'Kacamata hitam & Tabir surya',
          'Masker respirator / penutup debu',
          'Kamera / Handphone untuk dokumentasi'
        ]
      }));
      notify('Template Inklusi Standard diterapkan!');
    } else {
      setTripForm((prev: any) => ({
        ...prev,
        included: [
          'Tiket Penerbangan PP Pariwisata / Tiket Eksekutif',
          'Hotel Bintang 4 Pilihan (Twin/Double Share)',
          'Transportasi Premium VIP AC',
          'Jeep Bromo Hardtop Terawat',
          'All-Inclusive Meals (Breakfast, Lunch, Dinner)',
          'Fotografer Profesional & Drone Footage',
          'VIP Priority Access Gates & Retribusi Resmi',
          'Air Mineral & Snack Premium Tanpa Batas'
        ],
        excluded: [
          'Keperluan Belanja Pribadi',
          'Layanan Tambahan di Hotel (Laundry/Minibar)',
          'Tip Eksklusif Kru & Pemandu Utama'
        ],
        whatsToBring: [
          'Pakaian hangat & Jaket tebal branded',
          'Sepatu trekking nyaman',
          'Kacamata hitam & Sunscreen SPF 50+',
          'Obat-obatan pribadi & Suplemen'
        ]
      }));
      notify('Template Inklusi Luxury VIP diterapkan!');
    }
  };

  // ---------------------------------------------------------------------------
  // BATCH CREATION & MANAGEMENT (Dedicated Open Trip Special Addition)
  // ---------------------------------------------------------------------------
  const tripBatches = batches.filter(
    (b) => (editingTripId && b.tripId === editingTripId) || (tripForm.slug && b.tripId === tripForm.slug)
  );

  const handleCreateNewBatch = async () => {
    if (!editingTripId && !tripForm.slug) {
      notify('Simpan draf paket tour terlebih dahulu sebelum menambahkan jadwal batch keberangkatan.');
      return;
    }
    if (!batchDepartureDate) {
      notify('Pilih tanggal keberangkatan batch.');
      return;
    }
    if (batchQuota > 20) {
      notify('Kuota per batch dibatasi maksimal 20 kursi untuk kenyamanan group tour.');
      return;
    }

    setIsSubmittingBatch(true);
    try {
      await createBatch({
        tripId: editingTripId || tripForm.slug,
        departureDate: batchDepartureDate,
        quota: Number(batchQuota) || 14,
        availableSeats: Number(batchQuota) || 14,
        price: Number(batchPrice) || tripForm.startingPrice || 150,
        status: batchStatus
      });
      notify(`Jadwal batch tanggal ${batchDepartureDate} berhasil dibuka!`);
      if (onRefreshDB) onRefreshDB();
    } catch (err: any) {
      notify(`Gagal membuat batch: ${err?.message || 'Kesalahan server'}`);
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const handleToggleBatchStatus = async (batch: Batch) => {
    const nextStatus = batch.status === 'Open' ? 'Closed' : 'Open';
    try {
      await updateBatch(batch.id, { status: nextStatus });
      notify(`Status batch diubah menjadi ${nextStatus}`);
      if (onRefreshDB) onRefreshDB();
    } catch (err: any) {
      notify(`Gagal memperbarui status: ${err?.message}`);
    }
  };

  const handleDeleteBatchAction = async (batchId: string, date: string) => {
    if (confirm(`Hapus jadwal batch keberangkatan tanggal ${date}?`)) {
      try {
        await deleteBatch(batchId);
        notify(`Batch tanggal ${date} berhasil dihapus`);
        if (onRefreshDB) onRefreshDB();
      } catch (err: any) {
        notify(`Gagal menghapus batch: ${err?.message}`);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-left w-full">
      {/* 1. Header & Breadcrumbs matching Private Tours in AdminView.tsx lines 1139-1173 */}
      <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b ${t.border} pb-5`}>
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 mb-1">
            <span>KATALOG OPEN TRIP (SHARE TOUR)</span>
            <span className="text-neutral-600">/</span>
            <span className="text-amber-500 font-extrabold">{editingTripId ? 'EDIT DATA OPEN TRIP' : 'BUAT PAKET BARU'}</span>
          </div>
          <h3 className={`text-xl font-black uppercase tracking-tight font-mono ${t.textPrimary} flex items-center gap-2`}>
            <Compass className="h-5 w-5 text-amber-500" />
            <span>{editingTripId ? `WORKSPACE: ${tripForm.title || 'Edit Paket'}` : 'BUAT PAKET OPEN TRIP BARU'}</span>
          </h3>
          <p className={`text-xs ${t.textSecondary} mt-0.5`}>
            Workspace terpadu OTA untuk mengelola informasi paket, harga penawaran (WNI/WNA), fasilitas inklusi, agenda itinerary, galeri visual, serta jadwal &amp; kuota batch keberangkatan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AutoSaveStatusBadge
            status={saveStatus}
            lastSaved={lastSaved}
            isOnline={isOnline}
            onManualSave={onManualSave}
          />
          <button
            type="button"
            onClick={onClose}
            className={`px-4 py-2.5 rounded-xl border ${t.border} ${t.hover} text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${t.textPrimary}`}
          >
            <ChevronDown className="h-4 w-4 rotate-90 shrink-0" />
            <span>Tutup Workspace</span>
          </button>
        </div>
      </div>

      {/* Auto-Save Draft Recovery Banner */}
      {showRecoveryBanner && detectedDraft && onRecoverDraft && onDiscardDraft && (
        <DraftRecoveryBanner
          draft={detectedDraft}
          typeLabel={editingTripId ? 'Edit Open Trip' : 'Open Trip Baru'}
          onRecover={() => onRecoverDraft(detectedDraft)}
          onDiscard={onDiscardDraft}
        />
      )}

      {/* 2. Form Navigation Tabs matching Private Tours lines 1186-1212 + Open Trip Batch Tab */}
      <div className={`flex flex-wrap gap-1 border-b ${t.border} pb-px`}>
        {[
          { id: 'general', name: '1. Informasi & Harga', icon: FileText },
          { id: 'highlight', name: '2. Highlight & FAQ', icon: Sparkles },
          { id: 'itinerary', name: '3. Itinerary', icon: Compass },
          { id: 'includes', name: '4. Included & Excluded', icon: CheckCircle2 },
          { id: 'gallery', name: '5. Gallery', icon: ImageIcon },
          { id: 'batches', name: '6. Jadwal & Batch', icon: CalendarDays }
        ].map((tab) => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TripFormTab)}
              className={`px-4 py-3 border-b-2 font-mono text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                isActive
                  ? 'border-amber-500 text-amber-500 bg-amber-500/5 font-extrabold'
                  : `border-transparent ${t.textSecondary} hover:${t.textPrimary}`
              }`}
            >
              <IconComp className={`h-4 w-4 ${isActive ? 'text-amber-500' : 'text-neutral-500'}`} />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Responsive 2-Column Layout (Form 8 cols + Live Preview 4 cols) matching lines 1284-2210 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave('published');
        }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6"
      >
        {/* Left Column: Form Controls (8 cols on large screens) */}
        <div className="lg:col-span-8 space-y-6">

          {/* TAB 1: INFORMASI DASAR & HARGA */}
          {activeTab === 'general' && (
            <div className="space-y-6 animate-fade-in">
              <div className={`${t.card} border rounded-2xl p-6 space-y-5 shadow-sm`}>
                <h4 className="text-xs font-black uppercase tracking-wider font-mono text-amber-500 border-b border-neutral-800 pb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Informasi Dasar, Kategori &amp; Tarif Penawaran Open Trip</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-800 dark:text-neutral-300 uppercase tracking-wider">
                      Slug URL / ID Paket (Satu kata)
                    </label>
                    <input
                      type="text"
                      required
                      disabled={!!editingTripId}
                      value={tripForm.slug}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/[^\w-]/g, '');
                        setTripForm({ ...tripForm, slug: val });
                      }}
                      placeholder="contoh: bromo-midnight"
                      className={`w-full ${t.input} border rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 font-mono text-xs ${
                        editingTripId ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-neutral-900' : ''
                      }`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-800 dark:text-neutral-300 uppercase tracking-wider">
                      Kategori Pengalaman
                    </label>
                    <select
                      value={tripForm.category || 'Adventure'}
                      onChange={(e) => setTripForm({ ...tripForm, category: e.target.value as any, experienceCategory: e.target.value as any })}
                      className={`w-full ${t.input} border rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 font-semibold text-xs`}
                    >
                      <option value="Adventure">Adventure (Petualangan)</option>
                      <option value="Nature">Nature (Alam Bebas)</option>
                      <option value="Culture">Culture (Budaya &amp; Sejarah)</option>
                      <option value="City">City (Wisata Kota)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-800 dark:text-neutral-300 uppercase tracking-wider flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-amber-500" />
                      <span>Lokasi / Destinasi Utama</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={tripForm.location || ''}
                      onChange={(e) => setTripForm({ ...tripForm, location: e.target.value })}
                      placeholder="Contoh: Bromo &amp; Ijen, Jawa Timur"
                      className={`w-full ${t.input} border rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 text-xs font-semibold`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-800 dark:text-neutral-300 uppercase tracking-wider">
                    Nama Lengkap Paket Open Trip
                  </label>
                  <input
                    type="text"
                    required
                    value={tripForm.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      const slug = val
                        .toLowerCase()
                        .trim()
                        .replace(/[^\w\s-]/g, '')
                        .replace(/[\s_-]+/g, '-')
                        .replace(/^-+|-+$/g, '');
                      setTripForm((prev: any) => ({
                        ...prev,
                        title: val,
                        slug: prev.slug === '' || prev.slug === editingTripId ? slug : prev.slug
                      }));
                    }}
                    placeholder="Contoh: Open Trip Sunrise Bromo Midnight Super Hemat"
                    className={`w-full ${t.input} border rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 font-bold text-sm`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-800 dark:text-neutral-300 uppercase tracking-wider">
                    Deskripsi Lengkap / Penjelasan Paket
                  </label>
                  <textarea
                    rows={6}
                    required
                    value={tripForm.description}
                    onChange={(e) => setTripForm({ ...tripForm, description: e.target.value })}
                    placeholder="Berikan penjelasan memikat mengenai petualangan open trip ini, suasana perjalanan rombongan, serta keseruan yang akan dirasakan peserta..."
                    className={`w-full ${t.input} border rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 leading-relaxed text-xs`}
                  />
                </div>

                {/* FIELD DURASI: DAYS & NIGHTS DENGAN DISPLAY OTOMATIS */}
                <div className="space-y-3 bg-slate-500/5 p-4 rounded-2xl border border-slate-200/60 dark:border-neutral-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-[10px] font-black text-slate-800 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      <span>Durasi Perjalanan (Duration &amp; Nights)</span>
                    </label>
                    <span className="text-xs font-mono font-bold text-amber-600 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                      Display Otomatis: {formatTourDuration(Number(tripForm.days) || 1, Number(tripForm.nights) || 0)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black text-slate-700 dark:text-neutral-300 uppercase">Jumlah Hari (Days)</span>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={30}
                          required
                          value={tripForm.days || 1}
                          onChange={(e) => {
                            const days = Math.max(1, parseInt(e.target.value, 10) || 1);
                            const nights = typeof tripForm.nights === 'number' ? tripForm.nights : Math.max(0, days - 1);
                            setTripForm({
                              ...tripForm,
                              days,
                              duration: formatTourDuration(days, nights)
                            });
                          }}
                          className={`w-full ${t.input} border rounded-xl pl-4 pr-14 py-2.5 focus:outline-none focus:border-amber-500 font-bold text-xs`}
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Hari</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-black text-slate-700 dark:text-neutral-300 uppercase">Jumlah Malam (Nights)</span>
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          max={30}
                          required
                          value={typeof tripForm.nights === 'number' ? tripForm.nights : 0}
                          onChange={(e) => {
                            const nights = Math.max(0, parseInt(e.target.value, 10) || 0);
                            const days = Number(tripForm.days) || 1;
                            setTripForm({
                              ...tripForm,
                              nights,
                              duration: formatTourDuration(days, nights)
                            });
                          }}
                          className={`w-full ${t.input} border rounded-xl pl-4 pr-14 py-2.5 focus:outline-none focus:border-amber-500 font-bold text-xs`}
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Malam</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-neutral-400">
                    Sistem otomatis memformat label durasi untuk katalog dan detail tiket pelanggan: &quot;{formatTourDuration(Number(tripForm.days) || 1, Number(tripForm.nights) || 0)}&quot;.
                  </p>
                </div>

                {/* STRUKTUR HARGA OPEN TRIP: WNI & WNA TERPISAH */}
                <div className="space-y-3 bg-slate-500/5 p-4 rounded-2xl border border-slate-200/60 dark:border-neutral-800">
                  <label className="text-[10px] font-black text-slate-800 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-amber-500" />
                    <span>Struktur Harga Tiket Open Trip (WNI &amp; WNA)</span>
                  </label>
                  <p className="text-[10px] text-slate-500 dark:text-neutral-400">
                    Tarif tiket per peserta untuk wisatawan domestik (IDR) dan mancanegara (USD). Harga WNA dapat Anda atur secara bebas dan independen.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {/* WNI Price */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                        Harga Tiket WNI / Domestik (IDR / Rupiah)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 font-mono">Rp</span>
                        <input
                          type="number"
                          required
                          value={tripForm.wniPrice || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setTripForm({
                              ...tripForm,
                              wniPrice: val
                            });
                          }}
                          placeholder="450000"
                          className={`w-full ${t.input} border rounded-xl pl-11 pr-4 py-2.5 focus:outline-none focus:border-emerald-500 font-mono text-sm font-extrabold`}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 dark:text-neutral-400 block">Contoh: Rp 450.000 per orang untuk wisatawan domestik</span>
                    </div>

                    {/* WNA Price */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                        Harga Tiket WNA / International (USD / Dollar)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-600 font-mono">$</span>
                        <input
                          type="number"
                          required
                          value={tripForm.startingPrice || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setTripForm({
                              ...tripForm,
                              startingPrice: val
                            });
                          }}
                          placeholder="35"
                          className={`w-full ${t.input} border rounded-xl pl-8 pr-4 py-2.5 focus:outline-none focus:border-amber-500 font-mono text-sm font-extrabold`}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500 dark:text-neutral-400 block">Contoh: USD 35 per orang untuk turis mancanegara</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: HIGHLIGHTS, WHAT TO BRING & FAQ */}
          {activeTab === 'highlight' && (
            <div className="space-y-6 animate-fade-in">
              <div className={`${t.card} border rounded-2xl p-6 space-y-5 shadow-sm`}>
                <h4 className="text-xs font-black uppercase tracking-wider font-mono text-amber-500 border-b border-neutral-800 pb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span>Sorotan Utama, Perlengkapan &amp; Tanya Jawab (FAQ)</span>
                </h4>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-800 dark:text-neutral-300 uppercase tracking-wider block">
                    Sorotan Wisata (Highlights)
                  </label>
                  <span className="text-[10px] text-slate-600 dark:text-neutral-400 block">
                    Pisahkan setiap sorotan dengan tanda koma (,) agar terformat otomatis
                  </span>
                  <textarea
                    rows={4}
                    value={tripForm.highlight}
                    onChange={(e) => setTripForm({ ...tripForm, highlight: e.target.value })}
                    placeholder="Contoh: Jeep 4x4 Khusus Bromo, Sunrise Golden Hour, Lautan Pasir Berbisik, Pemandu Ramah Berlisensi, Dokumentasi Foto Keren"
                    className={`w-full ${t.input} border rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 leading-relaxed text-xs`}
                  />
                </div>

                <div className="space-y-2 border-t border-neutral-800 pt-4">
                  <label className="text-[10px] font-black text-slate-800 dark:text-neutral-300 uppercase tracking-wider block">
                    Perlengkapan yang Harus Dibawa Peserta (What to Bring)
                  </label>
                  <span className="text-[10px] text-slate-600 dark:text-neutral-400 block">
                    Tuliskan barang atau perlengkapan yang disarankan dibawa, satu item per baris
                  </span>
                  <textarea
                    rows={5}
                    value={(tripForm.whatsToBring || []).join('\n')}
                    onChange={(e) => setTripForm({
                      ...tripForm,
                      whatsToBring: e.target.value.split('\n').filter(Boolean)
                    })}
                    placeholder="Contoh:&#10;Jaket tebal hangat (suhu 5-10°C)&#10;Sepatu kets / trekking antiselip&#10;Kacamata hitam &amp; Masker debu&#10;Kamera / Handphone dengan baterai penuh"
                    className={`w-full ${t.input} border rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 leading-relaxed text-xs`}
                  />
                </div>

                {/* FAQ Interactive Manager */}
                <div className="space-y-3 border-t border-neutral-800 pt-4">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-800 dark:text-neutral-300 uppercase tracking-wider block">
                      Tanya Jawab Populer (FAQ)
                    </label>
                    <span className="text-[10px] font-mono text-neutral-500">{(tripForm.faq || []).length} Pertanyaan</span>
                  </div>

                  {(tripForm.faq || []).length > 0 && (
                    <div className="space-y-2 pb-2">
                      {tripForm.faq.map((faqItem, fIdx) => (
                        <div key={fIdx} className={`${t.innerCard} border rounded-xl p-3 flex justify-between items-start gap-3`}>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                              <span className="text-amber-500 font-mono">Q:</span>
                              <span>{faqItem.question}</span>
                            </p>
                            <p className={`text-xs ${t.textSecondary} flex items-start gap-1.5`}>
                              <span className="text-emerald-500 font-mono">A:</span>
                              <span>{faqItem.answer}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = tripForm.faq.filter((_, i) => i !== fIdx);
                              setTripForm({ ...tripForm, faq: updated });
                              notify('FAQ berhasil dihapus');
                            }}
                            className="text-neutral-500 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                            title="Hapus FAQ"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={`${t.innerCard} border rounded-2xl p-4 space-y-3`}>
                    <span className="text-[10px] font-bold text-amber-500 uppercase font-mono flex items-center gap-1">
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>Tambah Tanya Jawab Baru</span>
                    </span>
                    <input
                      type="text"
                      value={newFaqQuestion}
                      onChange={(e) => setNewFaqQuestion(e.target.value)}
                      placeholder="Pertanyaan (contoh: Apakah trip ini cocok untuk solo traveler?)"
                      className={`w-full ${t.input} border rounded-xl px-3 py-2 text-xs`}
                    />
                    <textarea
                      rows={2}
                      value={newFaqAnswer}
                      onChange={(e) => setNewFaqAnswer(e.target.value)}
                      placeholder="Jawaban (contoh: Sangat cocok! Banyak peserta kami bergabung sendirian dan menemukan teman baru)."
                      className={`w-full ${t.input} border rounded-xl px-3 py-2 text-xs leading-relaxed`}
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          if (!newFaqQuestion.trim() || !newFaqAnswer.trim()) {
                            notify('Isi pertanyaan dan jawaban FAQ terlebih dahulu.');
                            return;
                          }
                          setTripForm({
                            ...tripForm,
                            faq: [...(tripForm.faq || []), { question: newFaqQuestion.trim(), answer: newFaqAnswer.trim() }]
                          });
                          setNewFaqQuestion('');
                          setNewFaqAnswer('');
                          notify('FAQ baru berhasil ditambahkan');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-bold transition-all shadow cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Tambah ke FAQ</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ITINERARY INTERAKTIF */}
          {activeTab === 'itinerary' && (
            <div className="space-y-6 animate-fade-in">
              {/* Itinerary Add/Edit Form matching Private Tours lines 1535-1624 */}
              <div id="itinerary-form-editor" className={`${t.card} border rounded-2xl p-6 space-y-4 shadow-sm`}>
                <h4 className="text-xs font-black uppercase tracking-wider font-mono text-amber-500 border-b border-neutral-800 pb-3 flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>{editingItineraryKey ? 'Edit Aktivitas Itinerary' : 'Tambah Aktivitas Itinerary Baru'}</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-800 dark:text-neutral-300 uppercase tracking-wider">
                      Hari Ke (Day)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={itineraryDayInput}
                      onChange={(e) => setItineraryDayInput(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className={`w-full ${t.input} border rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500 font-mono text-xs`}
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-800 dark:text-neutral-300 uppercase tracking-wider">
                      Judul Hari (Opsional)
                    </label>
                    <input
                      type="text"
                      value={itineraryDayTitleInput}
                      onChange={(e) => setItineraryDayTitleInput(e.target.value)}
                      placeholder="Contoh: Menikmati Golden Sunrise Bromo &amp; Kawah Bromo"
                      className={`w-full ${t.input} border rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500 text-xs`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-800 dark:text-neutral-300 uppercase tracking-wider">
                      Jam / Waktu (Hour)
                    </label>
                    <input
                      type="text"
                      value={itineraryTimeInput}
                      onChange={(e) => setItineraryTimeInput(e.target.value)}
                      placeholder="Contoh: 03:30 atau 03:30 - 06:00"
                      className={`w-full ${t.input} border rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500 font-mono text-xs`}
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-black text-slate-800 dark:text-neutral-300 uppercase tracking-wider">
                      Nama Aktivitas / Kegiatan
                    </label>
                    <input
                      type="text"
                      value={itineraryTitleInput}
                      onChange={(e) => setItineraryTitleInput(e.target.value)}
                      placeholder="Contoh: Berburu Golden Sunrise di Penanjakan"
                      className={`w-full ${t.input} border rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500 text-xs font-bold`}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-800 dark:text-neutral-300 uppercase tracking-wider">
                    Penjelasan Detail Kegiatan
                  </label>
                  <textarea
                    rows={3}
                    value={itineraryDescInput}
                    onChange={(e) => setItineraryDescInput(e.target.value)}
                    placeholder="Tulis penjelasan rincian jalannya aktivitas ini..."
                    className={`w-full ${t.input} border rounded-xl px-4 py-2.5 focus:outline-none focus:border-amber-500 leading-relaxed text-xs`}
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  {editingItineraryKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItineraryKey(null);
                        setItineraryTimeInput('08:00');
                        setItineraryTitleInput('');
                        setItineraryDescInput('');
                      }}
                      className="px-3.5 py-2 rounded-xl border border-neutral-700 bg-transparent text-neutral-300 hover:text-white hover:bg-neutral-800 text-xs font-bold transition-all cursor-pointer"
                    >
                      Batal Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleAddOrUpdateItineraryItem}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-black transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{editingItineraryKey ? 'Perbarui Aktivitas' : 'Tambah ke Itinerary'}</span>
                  </button>
                </div>
              </div>

              {/* Displaying interactive list & Agenda Cards */}
              <div className={`${t.card} border rounded-2xl p-6 space-y-4 shadow-sm`}>
                <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider font-mono text-amber-500 flex items-center gap-2">
                    <Compass className="h-4 w-4" />
                    <span>Daftar Agenda Rencana Perjalanan ({(tripForm.itinerary || []).length} Hari)</span>
                  </h4>
                  <span className="text-[10px] text-neutral-500 font-mono">Disusun rapi per hari untuk kenyamanan peserta</span>
                </div>

                {(!tripForm.itinerary || tripForm.itinerary.length === 0) ? (
                  <div className="text-center py-10 text-neutral-500 space-y-2">
                    <Compass className="h-10 w-10 text-neutral-600 mx-auto animate-pulse" />
                    <p className="text-xs font-bold">Belum ada agenda itinerary yang dibuat.</p>
                    <p className="text-[11px] text-neutral-600 max-w-md mx-auto">
                      Gunakan formulir di atas untuk menentukan hari, jam, judul aktivitas, serta penjelasannya lalu klik &quot;Tambah ke Itinerary&quot;.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {tripForm.itinerary.map((dayItem, dayIdx) => (
                      <div key={dayIdx} className={`${t.innerCard} border rounded-2xl p-5 space-y-3`}>
                        <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="bg-amber-500 text-neutral-950 font-black font-mono text-[10px] px-2 py-0.5 rounded-lg uppercase">
                              Hari {dayItem.day}
                            </span>
                            <span className="text-xs font-bold text-neutral-100">
                              {dayItem.title || `Agenda Hari Ke-${dayItem.day}`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteDay(dayIdx)}
                            className="text-rose-500 hover:text-rose-400 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="Hapus Seluruh Hari Ini"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Hapus Hari</span>
                          </button>
                        </div>

                        {dayItem.description && (
                          <p className={`text-xs ${t.textSecondary} leading-relaxed`}>
                            {dayItem.description}
                          </p>
                        )}

                        {/* Schedules inside this day */}
                        {dayItem.timeSchedules && dayItem.timeSchedules.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-neutral-850">
                            {dayItem.timeSchedules.map((sch, sIdx) => (
                              <div
                                key={sIdx}
                                className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs hover:border-amber-500/40 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="font-mono font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg text-[11px] border border-amber-500/20">
                                    {sch.time}
                                  </span>
                                  <span className="font-medium text-neutral-200">{sch.activity}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditSchedule(dayIdx, sIdx)}
                                    className="p-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-amber-400 hover:bg-neutral-700 transition cursor-pointer"
                                    title="Edit Aktivitas Ini"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSchedule(dayIdx, sIdx)}
                                    className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-rose-400 hover:bg-neutral-700 transition cursor-pointer"
                                    title="Hapus Aktivitas Ini"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: INCLUDED & EXCLUDED (FASILITAS) */}
          {activeTab === 'includes' && (
            <div className="space-y-6 animate-fade-in">
              <div className={`${t.card} border rounded-2xl p-6 space-y-5 shadow-sm`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-neutral-800 pb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider font-mono text-amber-500 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Inklusi &amp; Eksklusi (Include &amp; Exclude)</span>
                  </h4>
                  {/* Injector presets matching Private Tours lines 1963-1994 */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-neutral-400 font-bold">TEMPLATE CEPAT:</span>
                    <button
                      type="button"
                      onClick={() => injectTemplate('standard')}
                      className="px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-[10px] font-bold text-neutral-200 cursor-pointer transition-colors"
                    >
                      Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => injectTemplate('luxury')}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-neutral-950 text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      Luxury VIP
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wider block">
                      Harga Sudah Termasuk (Inclusions)
                    </label>
                    <span className="text-[10px] text-slate-600 dark:text-neutral-400 block">
                      Tuliskan satu item per baris (tekan Enter untuk baris baru)
                    </span>
                    <textarea
                      rows={8}
                      value={(tripForm.included || []).join('\n')}
                      onChange={(e) => setTripForm({
                        ...tripForm,
                        included: e.target.value.split('\n').filter(Boolean)
                      })}
                      placeholder="Contoh:&#10;Tiket Masuk Wisata Resmi&#10;Transportasi AC Nyaman&#10;Jeep 4x4 Bromo&#10;Driver &amp; Pemandu Lokal"
                      className={`w-full ${t.input} border rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 leading-relaxed text-xs`}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-red-800 dark:text-rose-400 uppercase tracking-wider block">
                      Tidak Termasuk (Exclusions)
                    </label>
                    <span className="text-[10px] text-slate-600 dark:text-neutral-400 block">
                      Tuliskan satu item per baris (tekan Enter untuk baris baru)
                    </span>
                    <textarea
                      rows={8}
                      value={(tripForm.excluded || []).join('\n')}
                      onChange={(e) => setTripForm({
                        ...tripForm,
                        excluded: e.target.value.split('\n').filter(Boolean)
                      })}
                      placeholder="Contoh:&#10;Tiket Pesawat ke Titik Kumpul&#10;Pengeluaran Pribadi &amp; Belanja&#10;Makan di Luar Jadwal&#10;Uang Tip Guide"
                      className={`w-full ${t.input} border rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500 leading-relaxed text-xs`}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: VISUAL MEDIA & GALERI (No manual URL typing needed!) */}
          {activeTab === 'gallery' && (
            <div className="space-y-6 animate-fade-in">
              <div className={`${t.card} border rounded-2xl p-6 space-y-5 shadow-sm`}>
                <h4 className="text-xs font-black uppercase tracking-wider font-mono text-amber-500 border-b border-neutral-800 pb-3 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-amber-500" />
                  <span>Galeri Foto &amp; Media Kreatif Open Trip</span>
                </h4>

                <p className={`text-xs ${t.textSecondary}`}>
                  Unggah beberapa foto sekaligus untuk dijadikan galeri paket open trip. Foto pertama otomatis menjadi Cover utama katalog. Anda dapat menggeser urutan atau menghapus foto kapan saja.
                </p>

                {/* Hidden native input */}
                <input
                  type="file"
                  id="sharetour-gallery-file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Interactive Drag & Drop Area matching lines 1773-1808 */}
                <div
                  onClick={handleSimulatedUpload}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files) {
                      processUploadedFiles(e.dataTransfer.files);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-neutral-700 hover:border-amber-500 hover:bg-neutral-900/60'
                  }`}
                >
                  {isUploading ? (
                    <div className="space-y-3">
                      <RefreshCw className="h-8 w-8 text-amber-500 animate-spin mx-auto" />
                      <div className="text-xs font-bold text-neutral-200">Memproses file gambar...</div>
                      <div className="w-48 bg-neutral-800 h-2 rounded-full overflow-hidden mx-auto">
                        <div
                          className="bg-amber-500 h-full transition-all duration-100"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-400">{uploadProgress}% Selesai</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="h-10 w-10 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div className="text-xs font-bold text-neutral-200">
                        Drag &amp; Drop Beberapa Foto di Sini, atau <span className="text-amber-500 underline">Pilih File dari Komputer</span>
                      </div>
                      <p className="text-[10px] text-neutral-500">Pilih file foto JPG, PNG, atau WebP dari perangkat Anda</p>
                    </div>
                  )}
                </div>

                {/* Dynamic Gallery Grid (from uploaded file list) */}
                {tripForm.gallery && tripForm.gallery.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">
                        Foto Galeri Terunggah ({tripForm.gallery.length}):
                      </span>
                      <span className="text-[9px] text-amber-500 font-bold font-mono uppercase tracking-wider">
                        Slide 1 otomatis menjadi Thumbnail (Cover)
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {tripForm.gallery.map((imgUrl, idx) => {
                        const isCover = idx === 0;
                        return (
                          <div
                            key={idx}
                            className={`group relative aspect-[4/3] rounded-xl overflow-hidden border transition-all ${
                              isCover ? 'border-amber-500 ring-2 ring-amber-500/25' : 'border-neutral-800'
                            }`}
                          >
                            <img
                              src={imgUrl}
                              alt={`Gallery image ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />

                            {/* Badges / Overlay */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col justify-between p-2 transition-opacity">
                              <div className="flex justify-between items-center">
                                <div className="flex gap-1">
                                  {/* Move Left */}
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (idx === 0) return;
                                      const newGallery = [...tripForm.gallery];
                                      const temp = newGallery[idx];
                                      newGallery[idx] = newGallery[idx - 1];
                                      newGallery[idx - 1] = temp;
                                      setTripForm({
                                        ...tripForm,
                                        gallery: newGallery,
                                        coverImage: newGallery[0] || ''
                                      });
                                      notify('Posisi gambar digeser ke kiri (Thumbnail diupdate)');
                                    }}
                                    className={`p-1 rounded bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors cursor-pointer ${
                                      idx === 0 ? 'opacity-30 cursor-not-allowed' : ''
                                    }`}
                                    title="Geser Kiri (Jadikan Thumbnail)"
                                  >
                                    <ChevronLeft className="h-3 w-3" />
                                  </button>

                                  {/* Move Right */}
                                  <button
                                    type="button"
                                    disabled={idx === tripForm.gallery.length - 1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (idx === tripForm.gallery.length - 1) return;
                                      const newGallery = [...tripForm.gallery];
                                      const temp = newGallery[idx];
                                      newGallery[idx] = newGallery[idx + 1];
                                      newGallery[idx + 1] = temp;
                                      setTripForm({
                                        ...tripForm,
                                        gallery: newGallery,
                                        coverImage: newGallery[0] || ''
                                      });
                                      notify('Posisi gambar digeser ke kanan');
                                    }}
                                    className={`p-1 rounded bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors cursor-pointer ${
                                      idx === tripForm.gallery.length - 1 ? 'opacity-30 cursor-not-allowed' : ''
                                    }`}
                                    title="Geser Kanan"
                                  >
                                    <ChevronRight className="h-3 w-3" />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updated = tripForm.gallery.filter((_, i) => i !== idx);
                                    const newCover = updated[0] || '';
                                    setTripForm({ ...tripForm, gallery: updated, coverImage: newCover });
                                    notify('Foto dihapus dari galeri');
                                  }}
                                  className="p-1 rounded bg-red-500/80 hover:bg-red-500 text-white cursor-pointer"
                                  title="Hapus Foto"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                              <span className="text-[8px] text-neutral-400 font-mono">Slide #{idx + 1}</span>
                            </div>

                            {isCover && (
                              <div className="absolute top-1.5 left-1.5 bg-amber-500 text-neutral-950 font-black font-mono text-[7px] uppercase tracking-widest px-1.5 py-0.5 rounded shadow">
                                Thumbnail (Cover)
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Presets Quick Picker matching Private Tours */}
                <div className="space-y-2.5">
                  <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">
                    Atau Tambahkan Preset Foto SmartJourney Unggulan:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {smartJourneyPresets.map((preset, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => {
                          const current = tripForm.gallery || [];
                          const updated = [...current, preset.url];
                          setTripForm({
                            ...tripForm,
                            gallery: updated,
                            coverImage: updated[0] || preset.url
                          });
                          notify(`Preset foto "${preset.name}" ditambahkan ke galeri`);
                        }}
                        className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-neutral-800 hover:border-amber-500 text-left transition-all cursor-pointer"
                      >
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                          <span className="text-[9px] font-bold text-white leading-tight truncate">{preset.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: JADWAL & KUOTA BATCH (TAMBAHAN KHUSUS OPEN TRIP) */}
          {activeTab === 'batches' && (
            <div className="space-y-6 animate-fade-in">
              <div className={`${t.card} border rounded-2xl p-6 space-y-5 shadow-sm`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-neutral-800 pb-3">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider font-mono text-amber-500 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      <span>Jadwal Keberangkatan &amp; Alokasi Kuota Batch</span>
                    </h4>
                    <p className={`text-[11px] ${t.textSecondary} mt-0.5`}>
                      Customer Open Trip hanya dapat mendaftar pada batch tanggal keberangkatan yang telah dibuat dan dibuka oleh Admin.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                    {tripBatches.length} Batch Terjadwal
                  </span>
                </div>

                {/* Quick Add Batch Form inside workspace */}
                <div className={`${t.innerCard} border rounded-2xl p-4 space-y-3`}>
                  <span className="text-[10px] font-bold text-amber-500 uppercase font-mono flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Buka Jadwal Batch Keberangkatan Baru Untuk Paket Ini</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-neutral-400 block">Tanggal Berangkat</label>
                      <input
                        type="date"
                        value={batchDepartureDate}
                        onChange={(e) => setBatchDepartureDate(e.target.value)}
                        className={`w-full ${t.input} border rounded-xl px-3 py-2 text-xs font-mono`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-neutral-400 block">Kuota Kursi (Maks 20)</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={batchQuota}
                        onChange={(e) => setBatchQuota(parseInt(e.target.value, 10) || 14)}
                        className={`w-full ${t.input} border rounded-xl px-3 py-2 text-xs font-mono`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-neutral-400 block">Tarif per Orang ($ USD)</label>
                      <input
                        type="number"
                        min={1}
                        value={batchPrice}
                        onChange={(e) => setBatchPrice(Number(e.target.value) || 150)}
                        className={`w-full ${t.input} border rounded-xl px-3 py-2 text-xs font-mono`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-neutral-400 block">Status Batch</label>
                      <select
                        value={batchStatus}
                        onChange={(e) => setBatchStatus(e.target.value as any)}
                        className={`w-full ${t.input} border rounded-xl px-3 py-2 text-xs font-semibold`}
                      >
                        <option value="Open">Open (Pendaftaran Buka)</option>
                        <option value="Closed">Closed (Ditutup)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={isSubmittingBatch}
                      onClick={handleCreateNewBatch}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>{isSubmittingBatch ? 'Membuka Batch...' : 'Buka Jadwal Batch Ini'}</span>
                    </button>
                  </div>
                </div>

                {/* List of Batches for this Trip */}
                {tripBatches.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500 space-y-2 border border-dashed border-neutral-800 rounded-2xl">
                    <Calendar className="h-8 w-8 text-neutral-600 mx-auto" />
                    <p className="text-xs font-bold text-neutral-300">Belum ada batch jadwal untuk paket ini.</p>
                    <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
                      Gunakan formulir di atas untuk membuka tanggal keberangkatan agar calon pelanggan dapat memilih tanggal tersebut saat booking.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <span className="text-[10px] font-black text-neutral-400 uppercase tracking-wider block">
                      Daftar Tanggal Batch Terjadwal:
                    </span>
                    {tripBatches.map((b) => {
                      const batchBookings = bookings.filter((bk) => bk.batchId === b.id);
                      const isExpanded = !!expandedBatchParticipants[b.id];

                      return (
                        <div key={b.id} className={`${t.innerCard} border rounded-2xl p-4 space-y-3`}>
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-sm text-neutral-100 flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 text-amber-500" />
                                  <span>{b.departureDate}</span>
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono uppercase ${
                                    b.status === 'Open'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                  }`}
                                >
                                  {b.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-neutral-400 font-mono">
                                <span>Kuota: <strong className="text-neutral-200">{b.quota} Kursi</strong></span>
                                <span>|</span>
                                <span>Tersedia: <strong className="text-emerald-400">{b.availableSeats} Kursi</strong></span>
                                <span>|</span>
                                <span>Tarif: <strong className="text-amber-400">${b.price} USD</strong></span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleBatchStatus(b)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                                  b.status === 'Open'
                                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                }`}
                              >
                                {b.status === 'Open' ? 'Tutup Pendaftaran' : 'Buka Pendaftaran'}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedBatchParticipants((prev) => ({
                                    ...prev,
                                    [b.id]: !prev[b.id]
                                  }))
                                }
                                className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                              >
                                <Users className="h-3 w-3" />
                                <span>Peserta ({batchBookings.length})</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteBatchAction(b.id, b.departureDate)}
                                className="p-1.5 rounded-xl bg-neutral-800 text-neutral-400 hover:text-rose-400 hover:bg-neutral-700 transition cursor-pointer"
                                title="Hapus Batch"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Accordion Peserta Terdaftar */}
                          {isExpanded && (
                            <div className="border-t border-neutral-800 pt-3 space-y-2 animate-fade-in">
                              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase">
                                Peserta Terdaftar di Batch Tanggal {b.departureDate}:
                              </span>
                              {batchBookings.length === 0 ? (
                                <p className="text-xs text-neutral-500 py-2">Belum ada peserta yang mendaftar di batch ini.</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {batchBookings.map((bk) => (
                                    <div
                                      key={bk.id}
                                      className="flex flex-col sm:flex-row justify-between sm:items-center p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs gap-2"
                                    >
                                      <div>
                                        <p className="font-bold text-neutral-200">{bk.fullName || bk.customerName || 'Tamu'}</p>
                                        <p className="text-[10px] text-neutral-400 font-mono">
                                          Telp/WA: {bk.phone || bk.customerPhone || '-'} • Pax: {bk.participantsCount || 1} Orang
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                            bk.status === 'Confirmed'
                                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                          }`}
                                        >
                                          {bk.status}
                                        </span>
                                        <span className="font-mono font-bold text-emerald-400 text-xs">
                                          Rp {(bk.totalPriceIDR || bk.paymentAmount || 0).toLocaleString('id-ID')}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Right Column: Live Preview & Action Bar (4 cols on large screens) matching lines 2029-2210 */}
        <div className="lg:col-span-4 space-y-6">

          {/* Live Image & Summary Preview Card */}
          <div className={`${t.card} border rounded-2xl overflow-hidden p-1.5 shadow-sm`}>
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-neutral-900 relative border border-neutral-800">
              {tripForm.coverImage ? (
                <img
                  src={tripForm.coverImage}
                  alt="Pratinjau Sampul"
                  className="w-full h-full object-cover animate-fade-in"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as any).src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format';
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500 gap-2">
                  <EyeOff className="h-8 w-8 text-neutral-600" />
                  <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-neutral-600">
                    Belum Ada Gambar
                  </span>
                </div>
              )}
              <div className="absolute top-3 left-3 bg-neutral-950/85 backdrop-blur-md text-[9px] font-mono font-black text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-md uppercase">
                {tripForm.category || 'Adventure'}
              </div>
              <div className="absolute bottom-3 right-3 bg-neutral-950/85 backdrop-blur-md text-xs font-mono font-black text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                {formatPriceLabel(tripForm.startingPrice, tripForm.wniPrice)}
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-black uppercase tracking-wider text-amber-500">
                    Katalog Live Preview
                  </span>
                  <span className="text-[9px] font-mono font-bold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                    <Users className="h-2.5 w-2.5" />
                    <span>Open Trip</span>
                  </span>
                </div>
                <h4 className="text-sm font-black text-white leading-tight mt-1 truncate">
                  {tripForm.title || 'Judul Paket Belum Ditentukan'}
                </h4>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-400 font-bold mt-1 font-mono">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-amber-500" />
                    <span>{tripForm.duration || '-'}</span>
                  </span>
                  <span className="text-neutral-600">•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-amber-500" />
                    <span>{tripForm.location || 'Jawa Timur'}</span>
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 leading-relaxed font-medium line-clamp-3 border-t border-neutral-850 pt-2.5">
                {tripForm.description || 'Deskripsi rincian paket open trip akan tampil di bagian ini pada halaman detail pemesanan pelanggan...'}
              </div>
            </div>
          </div>

          {/* Dynamic Side-by-Side Live Lists Previews based on selected Tab */}
          {activeTab === 'itinerary' && (
            <div className={`${t.card} border rounded-2xl p-5 space-y-4 shadow-sm animate-fade-in`}>
              <h4 className="text-xs font-black uppercase tracking-wider font-mono text-amber-500 border-b border-neutral-800 pb-2.5 flex items-center gap-1.5">
                <Compass className="h-4 w-4" />
                <span>Live Preview Agenda ({(tripForm.itinerary || []).length} Hari)</span>
              </h4>
              {(tripForm.itinerary || []).length > 0 ? (
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {tripForm.itinerary.map((d, idx) => (
                    <div key={idx} className="text-[11px] border-b border-neutral-850 pb-2">
                      <div className="font-bold text-amber-400">Hari {d.day}: {d.title}</div>
                      <div className="text-[10px] text-neutral-400">{d.timeSchedules?.length || 0} Aktivitas terjadwal</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-neutral-500 text-center py-4">Susun agenda harian di formulir sebelah kiri...</div>
              )}
            </div>
          )}

          {activeTab === 'includes' && (
            <div className={`${t.card} border rounded-2xl p-5 space-y-4 shadow-sm animate-fade-in`}>
              <h4 className="text-xs font-black uppercase tracking-wider font-mono text-emerald-400 border-b border-neutral-800 pb-2.5 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>Preview Sudah Termasuk</span>
              </h4>
              {tripForm.included && tripForm.included.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {tripForm.included.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[10px] font-semibold text-neutral-300">
                      <span className="text-emerald-400 shrink-0 font-bold">✓</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-neutral-500 text-center py-2">Ketik butir inklusi di kiri...</div>
              )}

              <h4 className="text-xs font-black uppercase tracking-wider font-mono text-red-400 border-b border-neutral-800 pb-2.5 pt-2 flex items-center gap-1.5">
                <X className="h-4 w-4" />
                <span>Preview Tidak Termasuk</span>
              </h4>
              {tripForm.excluded && tripForm.excluded.length > 0 ? (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {tripForm.excluded.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[10px] font-semibold text-neutral-300">
                      <span className="text-red-400 shrink-0 font-bold">✗</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-neutral-500 text-center py-2">Ketik butir eksklusi di kiri...</div>
              )}
            </div>
          )}

          {activeTab === 'batches' && (
            <div className={`${t.card} border rounded-2xl p-5 space-y-4 shadow-sm animate-fade-in`}>
              <h4 className="text-xs font-black uppercase tracking-wider font-mono text-amber-500 border-b border-neutral-800 pb-2.5 flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                <span>Ringkasan Batch Keberangkatan</span>
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-neutral-400">
                  <span>Total Jadwal Dibuka:</span>
                  <span className="font-mono font-bold text-amber-400">{tripBatches.length} Tanggal</span>
                </div>
                <div className="flex justify-between items-center text-neutral-400">
                  <span>Batch Status Open:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {tripBatches.filter((b) => b.status === 'Open').length} Batch
                  </span>
                </div>
                <p className="text-[10px] text-neutral-500 pt-2 border-t border-neutral-800">
                  Customer hanya dapat memilih tanggal yang dibuka pada tab Jadwal &amp; Batch.
                </p>
              </div>
            </div>
          )}

          {/* Form Submission Actions Card matching Private Tours lines 2167-2210 */}
          <div className={`${t.card} border border-amber-500/20 bg-amber-500/5 rounded-2xl p-5 flex flex-col gap-3 shadow-sm`}>
            <div className="text-[11px] text-neutral-400 font-semibold leading-relaxed">
              Pilih status penyimpanan paket open trip: Simpan sebagai <strong>Draft</strong> untuk persiapan internal, atau <strong>Publikasikan</strong> agar langsung tampil di katalog website pelanggan.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-1">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className={`px-3 py-3 rounded-xl border ${t.border} bg-neutral-900/60 hover:bg-neutral-900 text-xs font-bold text-neutral-300 hover:text-white transition-all cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => onSave('draft')}
                className="px-3 py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Clock className="h-4 w-4 shrink-0" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Draft'}</span>
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-3 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{isSaving ? 'Memproses...' : (editingTripId ? 'Perbarui Paket' : 'Publikasikan')}</span>
              </button>
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Users, FileText, CheckCircle2, Clock, AlertTriangle, 
  Plus, Edit, Trash2, Eye, EyeOff, Archive, Search, Filter, 
  Send, ExternalLink, Calendar, MapPin, DollarSign, Check, X,
  MessageSquare, Copy, ShieldCheck, ArrowRight, RefreshCw, Printer,
  Sparkles, HelpCircle
} from 'lucide-react';
import { 
  GatheringPackage, 
  GatheringQuotationRequest, 
  GatheringQuotation 
} from '../types';
import { 
  getGatheringPackages, 
  fetchGatheringPackages,
  apiSaveGatheringPackage,
  apiDeleteGatheringPackage,
  apiTogglePublishPackage,
  apiArchivePackage,
  getGatheringQuotationRequests, 
  fetchGatheringRequests,
  apiUpdateRequestStatus,
  getGatheringQuotations, 
  fetchGatheringQuotations,
  apiCreateGatheringQuotation,
  apiApproveGatheringQuotation,
  GATHERING_STORAGE_EVENT 
} from '../gatheringStore';
import { UnifiedBookingDetail } from '../../components/admin/BookingDetailModal';
import { useApp } from '../../AppContext';

interface GatheringAdminWorkspaceProps {
  isDark?: boolean;
  triggerToast: (msg: string) => void;
  onOpenBookingDetail?: (booking: UnifiedBookingDetail) => void;
  formatPrice?: (usd: number, idr: number) => string;
}

export default function GatheringAdminWorkspace({
  isDark = false,
  triggerToast,
  onOpenBookingDetail,
  formatPrice
}: GatheringAdminWorkspaceProps) {
  const { bookings, addBooking, updateBookingStatus } = useApp();

  const [activeTab, setActiveTab] = useState<'packages' | 'requests' | 'quotations' | 'confirmed'>('packages');

  // Data states
  const [packages, setPackages] = useState<GatheringPackage[]>(() => getGatheringPackages());
  const [requests, setRequests] = useState<GatheringQuotationRequest[]>(() => getGatheringQuotationRequests());
  const [quotations, setQuotations] = useState<GatheringQuotation[]>(() => getGatheringQuotations());

  const reloadData = async () => {
    try {
      const [pkgs, reqs, quots] = await Promise.all([
        fetchGatheringPackages(true),
        fetchGatheringRequests(),
        fetchGatheringQuotations()
      ]);
      setPackages(pkgs);
      setRequests(reqs);
      setQuotations(quots);
    } catch (e) {
      setPackages(getGatheringPackages());
      setRequests(getGatheringQuotationRequests());
      setQuotations(getGatheringQuotations());
    }
  };

  useEffect(() => {
    reloadData();
    window.addEventListener(GATHERING_STORAGE_EVENT, reloadData);
    return () => window.removeEventListener(GATHERING_STORAGE_EVENT, reloadData);
  }, []);

  // -------------------------------------------------------------
  // TAB A: PACKAGES STATE & HANDLERS
  // -------------------------------------------------------------
  const [pkgSearch, setPkgSearch] = useState('');
  const [pkgStatusFilter, setPkgStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [editingPkg, setEditingPkg] = useState<GatheringPackage | null>(null);
  const [isPkgModalOpen, setIsPkgModalOpen] = useState(false);

  // Form states for Package Editor
  const [pkgName, setPkgName] = useState('');
  const [pkgDestination, setPkgDestination] = useState('');
  const [pkgDuration, setPkgDuration] = useState('2 Hari 1 Malam (2D1N)');
  const [pkgDays, setPkgDays] = useState(2);
  const [pkgNights, setPkgNights] = useState(1);
  const [pkgDescription, setPkgDescription] = useState('');
  const [pkgFeaturedImage, setPkgFeaturedImage] = useState('');
  const [pkgIncludesRaw, setPkgIncludesRaw] = useState('');
  const [pkgExcludesRaw, setPkgExcludesRaw] = useState('');
  const [pkgFacilitiesRaw, setPkgFacilitiesRaw] = useState('');
  const [pkgNotesRaw, setPkgNotesRaw] = useState('');
  const [pkgPrice60, setPkgPrice60] = useState(950000);
  const [pkgPrice70, setPkgPrice70] = useState(890000);
  const [pkgPrice80, setPkgPrice80] = useState(840000);
  const [pkgPrice90, setPkgPrice90] = useState(795000);
  const [pkgPrice90PlusNote, setPkgPrice90PlusNote] = useState('Hubungi Admin untuk Penawaran Khusus');
  const [pkgStatus, setPkgStatus] = useState<'published' | 'draft' | 'archived'>('published');
  const [pkgFaq, setPkgFaq] = useState<Array<{ question: string; answer: string }>>([]);
  const [newPkgFaqQ, setNewPkgFaqQ] = useState('');
  const [newPkgFaqA, setNewPkgFaqA] = useState('');
  const [editingPkgFaqIdx, setEditingPkgFaqIdx] = useState<number | null>(null);

  const filteredPackages = useMemo(() => {
    return packages.filter(p => {
      if (pkgStatusFilter !== 'all' && p.status !== pkgStatusFilter) return false;
      if (pkgSearch.trim()) {
        const q = pkgSearch.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.destination.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [packages, pkgStatusFilter, pkgSearch]);

  const handleOpenCreatePkg = () => {
    setEditingPkg(null);
    setPkgName('');
    setPkgDestination('');
    setPkgDuration('2 Hari 1 Malam (2D1N)');
    setPkgDays(2);
    setPkgNights(1);
    setPkgDescription('');
    setPkgFeaturedImage('https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=1200&q=80');
    setPkgIncludesRaw('Transportasi Bus Eksekutif PP\nJeep 4x4 Resmi\nAkomodasi Hotel Bintang\nMakan Prasmanan 4x\nFun Outbound Games\nTiket Masuk Wisata\nDokumentasi Foto & Video');
    setPkgExcludesRaw('Pengeluaran pribadi\nTipping sukarela');
    setPkgFacilitiesRaw('Bus Eksekutif\nArmada Jeep 4x4\nSound System & Panggung\nFasilitator Outbound\nDrone Dokumentasi');
    setPkgNotesRaw('Harga estimasi per pax, finalisasi via quotation.');
    setPkgPrice60(950000);
    setPkgPrice70(890000);
    setPkgPrice80(840000);
    setPkgPrice90(795000);
    setPkgPrice90PlusNote('Hubungi Admin untuk Penawaran Khusus');
    setPkgStatus('published');
    setPkgFaq([]);
    setNewPkgFaqQ('');
    setNewPkgFaqA('');
    setEditingPkgFaqIdx(null);
    setIsPkgModalOpen(true);
  };

  const handleOpenEditPkg = (pkg: GatheringPackage) => {
    setEditingPkg(pkg);
    setPkgName(pkg.name);
    setPkgDestination(pkg.destination);
    setPkgDuration(pkg.duration);
    setPkgDays(pkg.days || 2);
    setPkgNights(pkg.nights || 1);
    setPkgDescription(pkg.description);
    setPkgFeaturedImage(pkg.featuredImage);
    setPkgIncludesRaw(pkg.includes.join('\n'));
    setPkgExcludesRaw(pkg.excludes.join('\n'));
    setPkgFacilitiesRaw(pkg.facilities.join('\n'));
    setPkgNotesRaw(Array.isArray(pkg.notes) ? pkg.notes.join('\n') : (pkg.notes || ''));
    setPkgPrice60(pkg.estimatedPrices.pax60);
    setPkgPrice70(pkg.estimatedPrices.pax70);
    setPkgPrice80(pkg.estimatedPrices.pax80);
    setPkgPrice90(pkg.estimatedPrices.pax90);
    setPkgPrice90PlusNote(pkg.estimatedPrices.pax90PlusNote || 'Hubungi Admin untuk Penawaran Khusus');
    setPkgStatus(pkg.status);
    setPkgFaq(Array.isArray(pkg.faq) ? pkg.faq.map(f => ({ question: f.question || (f as any).q || '', answer: f.answer || (f as any).a || '' })) : []);
    setNewPkgFaqQ('');
    setNewPkgFaqA('');
    setEditingPkgFaqIdx(null);
    setIsPkgModalOpen(true);
  };

  const handleSavePkg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgName.trim() || !pkgDestination.trim()) {
      triggerToast('Nama paket dan destinasi wajib diisi.');
      return;
    }

    const includes = pkgIncludesRaw.split('\n').map(s => s.trim()).filter(Boolean);
    const excludes = pkgExcludesRaw.split('\n').map(s => s.trim()).filter(Boolean);
    const facilities = pkgFacilitiesRaw.split('\n').map(s => s.trim()).filter(Boolean);
    const notes = pkgNotesRaw.split('\n').map(s => s.trim()).filter(Boolean);

    const now = new Date().toISOString();
    const pkg: GatheringPackage = {
      id: editingPkg ? editingPkg.id : `gp-${Date.now().toString().slice(-6)}`,
      slug: (pkgName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + pkgDuration.toLowerCase().replace(/[^a-z0-9]+/g, '-')).slice(0, 50),
      name: pkgName.trim(),
      destination: pkgDestination.trim(),
      duration: pkgDuration.trim(),
      days: Number(pkgDays) || 1,
      nights: Number(pkgNights) || 0,
      description: pkgDescription.trim(),
      featuredImage: pkgFeaturedImage.trim() || 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=1200&q=80',
      gallery: editingPkg?.gallery && editingPkg.gallery.length > 0 ? editingPkg.gallery : [pkgFeaturedImage.trim() || 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=1200&q=80'],
      itinerary: editingPkg?.itinerary && editingPkg.itinerary.length > 0 ? editingPkg.itinerary : [
        {
          day: 1,
          title: 'Hari 1 - Penjemputan, Outbound & Gala Dinner',
          activities: ['Penjemputan di Meeting Point dengan Bus AC', 'Outbound Teambuilding Games', 'Check-in Hotel', 'Gala Dinner & Entertainment']
        },
        {
          day: 2,
          title: 'Hari 2 - Eksplorasi Wisata & Kepulangan',
          activities: ['Sarapan pagi & Eksplorasi spot utama', 'Belanja oleh-oleh khas', 'Pengantaran kembali ke titik kumpul']
        }
      ],
      includes,
      excludes,
      facilities,
      notes,
      faq: pkgFaq,
      estimatedPrices: {
        pax60: Number(pkgPrice60) || 0,
        pax70: Number(pkgPrice70) || 0,
        pax80: Number(pkgPrice80) || 0,
        pax90: Number(pkgPrice90) || 0,
        pax90PlusNote: pkgPrice90PlusNote.trim() || 'Hubungi Admin untuk Penawaran Khusus'
      },
      status: pkgStatus,
      createdAt: editingPkg ? editingPkg.createdAt : now,
      updatedAt: now
    };

    try {
      await apiSaveGatheringPackage(pkg);
      await reloadData();
      setIsPkgModalOpen(false);
      triggerToast(editingPkg ? 'Paket berhasil diperbarui di database backend.' : 'Paket baru berhasil ditambahkan ke database backend.');
    } catch (err: any) {
      triggerToast(`Gagal menyimpan paket: ${err.message || 'Error'}`);
    }
  };

  const handleTogglePublishPkg = async (pkg: GatheringPackage) => {
    try {
      await apiTogglePublishPackage(pkg.id);
      await reloadData();
      triggerToast(`Status publish paket ${pkg.name} berhasil diperbarui.`);
    } catch (err: any) {
      triggerToast(`Gagal mengubah status publish: ${err.message || 'Error'}`);
    }
  };

  const handleArchivePkg = async (pkg: GatheringPackage) => {
    try {
      await apiArchivePackage(pkg.id);
      await reloadData();
      triggerToast(`Status arsip paket ${pkg.name} berhasil diperbarui.`);
    } catch (err: any) {
      triggerToast(`Gagal mengarsipkan paket: ${err.message || 'Error'}`);
    }
  };

  const handleDeletePkg = async (id: string) => {
    if (confirm('Yakin ingin menghapus paket gathering ini?')) {
      try {
        await apiDeleteGatheringPackage(id);
        await reloadData();
        triggerToast('Paket berhasil dihapus dari database.');
      } catch (err: any) {
        triggerToast(`Gagal menghapus paket: ${err.message || 'Error'}`);
      }
    }
  };

  // -------------------------------------------------------------
  // TAB B: QUOTATION REQUESTS
  // -------------------------------------------------------------
  const [selectedRequestForQuote, setSelectedRequestForQuote] = useState<GatheringQuotationRequest | null>(null);
  const [isCreateQuoteModalOpen, setIsCreateQuoteModalOpen] = useState(false);

  // Form states for creating Quotation from Request
  const [quotePricePerPax, setQuotePricePerPax] = useState<number>(0);
  const [quoteTotalPrice, setQuoteTotalPrice] = useState<number>(0);
  const [quoteValidDays, setQuoteValidDays] = useState<number>(14);
  const [quoteNotes, setQuoteNotes] = useState<string>('Harga penawaran mencakup seluruh fasilitas standar paket. DP minimal 30% untuk reservasi armada dan akomodasi.');

  const handleOpenCreateQuotation = (req: GatheringQuotationRequest) => {
    setSelectedRequestForQuote(req);
    // Find estimated price from package
    const pkg = packages.find(p => p.id === req.packageId);
    let estPerPax = 900000;
    if (pkg) {
      if (req.participants === '60') estPerPax = pkg.estimatedPrices.pax60;
      else if (req.participants === '70') estPerPax = pkg.estimatedPrices.pax70;
      else if (req.participants === '80') estPerPax = pkg.estimatedPrices.pax80;
      else if (req.participants === '90') estPerPax = pkg.estimatedPrices.pax90;
      else estPerPax = pkg.estimatedPrices.pax90;
    }
    const paxNum = parseInt(req.participants) || 60;
    setQuotePricePerPax(estPerPax);
    setQuoteTotalPrice(estPerPax * paxNum);
    setIsCreateQuoteModalOpen(true);
  };

  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequestForQuote) return;

    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + (quoteValidDays || 14));
    const paxNum = parseInt(selectedRequestForQuote.participants) || 60;

    try {
      const created = await apiCreateGatheringQuotation({
        requestId: selectedRequestForQuote.id,
        packageId: selectedRequestForQuote.packageId,
        packageName: selectedRequestForQuote.packageName,
        companyName: selectedRequestForQuote.company,
        customerName: selectedRequestForQuote.customerName,
        whatsapp: selectedRequestForQuote.whatsapp,
        email: selectedRequestForQuote.email,
        eventDate: selectedRequestForQuote.requestedDate,
        participantCount: paxNum,
        pricePerPaxIDR: Number(quotePricePerPax) || 0,
        totalPriceIDR: Number(quoteTotalPrice) || 0,
        validUntil: validUntilDate.toISOString().split('T')[0],
        lineItems: [
          {
            id: `item-${Date.now()}-1`,
            name: `Paket ${selectedRequestForQuote.packageName} (${paxNum} Pax)`,
            quantity: paxNum,
            unitPrice: Number(quotePricePerPax) || 0,
            subtotal: Number(quoteTotalPrice) || 0
          }
        ],
        terms: [
          'Harga berlaku sesuai masa validitas penawaran.',
          'Down Payment (DP) 30% dibayarkan saat konfirmasi booking.',
          'Pelunasan sisa 70% dilakukan H-3 sebelum keberangkatan.',
          'Pembatalan sepihak setelah DP dikenakan biaya administrasi 50% dari nilai DP.'
        ],
        notes: quoteNotes
      });

      await reloadData();
      setIsCreateQuoteModalOpen(false);
      setActiveTab('quotations');
      triggerToast(`Quotation resmi ${created.quotationNumber || created.id} berhasil diterbitkan di server database.`);
    } catch (err: any) {
      triggerToast(`Gagal menerbitkan quotation: ${err.message || 'Error'}`);
    }
  };

  // -------------------------------------------------------------
  // TAB C: QUOTATIONS HANDLERS & CONFIRM TO BOOKING
  // -------------------------------------------------------------
  const [selectedQuotationDetail, setSelectedQuotationDetail] = useState<GatheringQuotation | null>(null);

  const handleCopyQuoteWhatsApp = (quote: GatheringQuotation) => {
    const text = `*OFFICIAL QUOTATION SMART JOURNEY*\n` +
      `No Penawaran: ${quote.id}\n` +
      `Kepada Yth: ${quote.picName} (${quote.company})\n` +
      `Paket: ${quote.packageName}\n` +
      `Jumlah Peserta: ${quote.participants}\n` +
      `Tanggal Rencana: ${quote.eventDate}\n` +
      `---------------------------------\n` +
      `Harga per Pax: Rp ${quote.pricePerPaxIDR.toLocaleString('id-ID')}\n` +
      `TOTAL NILAI KONTRAK: Rp ${quote.totalPriceIDR.toLocaleString('id-ID')}\n` +
      `Masa Berlaku Sampai: ${quote.validUntil}\n` +
      `---------------------------------\n` +
      `Catatan: ${quote.notes}\n\n` +
      `Informasi lebih lanjut & konfirmasi: Hubungi Smart Journey Corporate Specialist.`;

    navigator.clipboard.writeText(text);
    triggerToast('Teks penawaran resmi berhasil disalin untuk WhatsApp!');
  };

  const handleConfirmQuotationToBooking = async (quote: GatheringQuotation) => {
    if (!confirm(`Konfirmasi penawaran ${quote.id} dari ${quote.company} menjadi Booking Resmi? Booking akan otomatis tercatat di Orders, Finance, dan Operations.`)) {
      return;
    }

    try {
      const res = await apiApproveGatheringQuotation(quote.id);
      await reloadData();
      setActiveTab('confirmed');
      triggerToast(`Booking berhasil dibuat dengan Kode: ${res.booking?.id || res.booking?.bookingCode}. Data telah tersinkronisasi ke Orders & Operations!`);
    } catch (err: any) {
      console.error('Failed to confirm gathering booking:', err);
      triggerToast(`Gagal mengonfirmasi booking: ${err.message || 'Error'}`);
    }
  };

  // -------------------------------------------------------------
  // TAB D: CONFIRMED BOOKINGS
  // -------------------------------------------------------------
  const confirmedGatheringBookings = useMemo(() => {
    return bookings.filter(b => {
      const isGathering = (b as any).serviceType === 'gathering' || (b as any).serviceType === 'event-gathering' || b.serviceName?.includes('Gathering') || b.serviceName?.includes('Corporate');
      return isGathering;
    });
  }, [bookings]);

  return (
    <div className={`p-6 min-h-screen ${isDark ? 'bg-neutral-900 text-neutral-100' : 'bg-slate-50 text-neutral-900'}`}>
      {/* Header Banner */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-neutral-800 p-6 rounded-3xl border border-neutral-200/80 dark:border-neutral-700 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold font-mono uppercase tracking-wider text-emerald-800 dark:text-emerald-400 mb-1">
            <Building2 className="w-4 h-4" />
            <span>Divisi Layanan & Katalog • Tours</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
            Event & Gathering Workspace
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Kelola katalog paket gathering, permintaan penawaran (quotation request), penerbitan proposal resmi, dan konfirmasi order korporasi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'packages' && (
            <button
              onClick={handleOpenCreatePkg}
              className="px-4 py-2.5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Paket Baru</span>
            </button>
          )}
          <button
            onClick={reloadData}
            className="p-2.5 rounded-2xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-neutral-600 dark:text-neutral-300 cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-700 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('packages')}
          className={`px-4 py-3 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'packages'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>A. Packages ({packages.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-3 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'requests'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>B. Quotation Requests ({requests.filter(r => r.status === 'REQUESTED').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('quotations')}
          className={`px-4 py-3 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'quotations'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>C. Quotations ({quotations.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('confirmed')}
          className={`px-4 py-3 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'confirmed'
              ? 'bg-emerald-800 text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>D. Confirmed Bookings ({confirmedGatheringBookings.length})</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB A: PACKAGES */}
      {/* ========================================================= */}
      {activeTab === 'packages' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {(['all', 'published', 'draft', 'archived'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setPkgStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize cursor-pointer transition-colors ${
                    pkgStatusFilter === st
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Cari paket..."
                value={pkgSearch}
                onChange={e => setPkgSearch(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Table / Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPackages.map(pkg => (
              <div
                key={pkg.id}
                className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 w-full">
                    <img
                      src={pkg.featuredImage}
                      alt={pkg.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono ${
                        pkg.status === 'published'
                          ? 'bg-emerald-500 text-white'
                          : pkg.status === 'draft'
                          ? 'bg-amber-500 text-white'
                          : 'bg-neutral-500 text-white'
                      }`}>
                        {pkg.status}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-neutral-600 dark:text-neutral-400">
                        {pkg.duration} • {pkg.destination}
                      </span>
                      <h4 className="font-bold text-neutral-900 dark:text-white text-base leading-snug mt-0.5">
                        {pkg.name}
                      </h4>
                    </div>

                    <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">
                      {pkg.description}
                    </p>

                    {/* Estimated pricing preview */}
                    <div className="bg-slate-50 dark:bg-neutral-900/60 p-3 rounded-2xl border border-neutral-100 dark:border-neutral-700/60">
                      <div className="text-[10px] font-bold font-mono text-neutral-600 dark:text-neutral-400 mb-1">
                        Estimasi Harga (60 - 90 Pax):
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                        <div>60p: Rp {pkg.estimatedPrices.pax60.toLocaleString('id-ID')}</div>
                        <div>70p: Rp {pkg.estimatedPrices.pax70.toLocaleString('id-ID')}</div>
                        <div>80p: Rp {pkg.estimatedPrices.pax80.toLocaleString('id-ID')}</div>
                        <div>90p: Rp {pkg.estimatedPrices.pax90.toLocaleString('id-ID')}</div>
                      </div>
                      <div className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold mt-1">
                        90+ Pax: {pkg.estimatedPrices.pax90PlusNote}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-5 pt-0 border-t border-neutral-100 dark:border-neutral-700/60 mt-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleTogglePublishPkg(pkg)}
                      className={`p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        pkg.status === 'published'
                          ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                          : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                      }`}
                      title={pkg.status === 'published' ? 'Jadikan Draft' : 'Publish Paket'}
                    >
                      {pkg.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => handleArchivePkg(pkg)}
                      className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-xs font-bold transition-colors cursor-pointer"
                      title={pkg.status === 'archived' ? 'Pulihkan dari Arsip' : 'Arsipkan Paket'}
                    >
                      <Archive className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeletePkg(pkg.id)}
                      className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold transition-colors cursor-pointer"
                      title="Hapus Paket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleOpenEditPkg(pkg)}
                    className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB B: QUOTATION REQUESTS */}
      {/* ========================================================= */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                  Daftar Permintaan Penawaran (Quotation Requests)
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Setiap kali customer mengisi form "Minta Penawaran" di halaman katalog, data tercatat di sini dengan status awal REQUESTED.
                </p>
              </div>
            </div>

            {requests.length === 0 ? (
              <div className="p-12 text-center text-neutral-500 dark:text-neutral-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold">Belum ada permintaan penawaran masuk.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-neutral-900 text-neutral-500 font-mono uppercase tracking-wider text-[11px] border-b border-neutral-200 dark:border-neutral-700">
                    <tr>
                      <th className="py-3.5 px-4">ID & Tanggal</th>
                      <th className="py-3.5 px-4">Perusahaan / PIC</th>
                      <th className="py-3.5 px-4">Paket Gathering</th>
                      <th className="py-3.5 px-4">Pax & Rencana</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/60 font-medium">
                    {requests.map(req => (
                      <tr key={req.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-700/20">
                        <td className="py-4 px-4 font-mono">
                          <div className="font-bold text-neutral-900 dark:text-white">{req.id}</div>
                          <div className="text-[10px] text-neutral-600 dark:text-neutral-400">{req.createdAt.slice(0, 10)}</div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-bold text-neutral-900 dark:text-white">{req.company}</div>
                          <div className="text-[11px] text-neutral-500">PIC: {req.customerName}</div>
                          <div className="text-[10px] font-mono text-emerald-800 dark:text-emerald-400 mt-0.5">
                            WA: {req.whatsapp}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-bold text-neutral-800 dark:text-neutral-200">{req.packageName}</div>
                          <div className="text-[10px] text-neutral-600 dark:text-neutral-400">{req.duration}</div>
                          {req.notes && (
                            <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 italic max-w-xs truncate" title={req.notes}>
                              Notes: "{req.notes}"
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-4">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold font-mono">
                            {req.participants} Pax
                          </span>
                          <div className="text-[10px] text-neutral-500 mt-1">
                            Tgl: {req.requestedDate}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider ${
                            req.status === 'REQUESTED'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                              : req.status === 'QUOTED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                              : 'bg-neutral-100 text-neutral-600'
                          }`}>
                            {req.status}
                          </span>
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={`https://wa.me/${req.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                `Halo ${req.customerName} dari ${req.company}, terima kasih telah menghubungi Smart Journey terkait paket gathering ${req.packageName} (${req.participants} Pax). Kami siap membuatkan penawaran resminya.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-xl text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                              title="Chat WhatsApp PIC"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </a>

                            <button
                              onClick={() => handleOpenCreateQuotation(req)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Buat Quotation</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB C: QUOTATIONS */}
      {/* ========================================================= */}
      {activeTab === 'quotations' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                Daftar Penawaran Resmi (Official Quotations)
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                Quotation yang telah diterbitkan untuk klien korporasi. Dapat dibagikan via WhatsApp atau langsung dikonversi menjadi Booking Resmi.
              </p>
            </div>

            {quotations.length === 0 ? (
              <div className="p-12 text-center text-neutral-500 dark:text-neutral-400">
                <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold">Belum ada quotation diterbitkan.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 font-mono uppercase tracking-wider text-[11px] font-bold border-b border-neutral-200 dark:border-neutral-700">
                    <tr>
                      <th className="py-3.5 px-4">No. Quotation</th>
                      <th className="py-3.5 px-4">Klien & PIC</th>
                      <th className="py-3.5 px-4">Paket & Peserta</th>
                      <th className="py-3.5 px-4">Nilai Penawaran</th>
                      <th className="py-3.5 px-4">Validitas</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/60 font-medium">
                    {quotations.map(quo => (
                      <tr key={quo.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-700/20">
                        <td className="py-4 px-4 font-mono">
                          <div className="font-bold text-neutral-900 dark:text-white">{quo.id}</div>
                          <div className="text-[10px] text-neutral-600 dark:text-neutral-400">{quo.createdAt.slice(0, 10)}</div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-bold text-neutral-900 dark:text-white">{quo.company}</div>
                          <div className="text-[11px] text-neutral-600 dark:text-neutral-400">{quo.picName} ({quo.whatsapp})</div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-bold text-neutral-800 dark:text-neutral-200">{quo.packageName}</div>
                          <div className="text-[11px] text-neutral-600 dark:text-neutral-400">
                            {quo.participants} • Tgl: {quo.eventDate}
                          </div>
                        </td>

                        <td className="py-4 px-4">
                          <div className="font-bold text-emerald-800 dark:text-emerald-400 text-sm">
                            Rp {quo.totalPriceIDR.toLocaleString('id-ID')}
                          </div>
                          <div className="text-[10px] text-neutral-600 dark:text-neutral-400">
                            @ Rp {quo.pricePerPaxIDR.toLocaleString('id-ID')} / pax
                          </div>
                        </td>

                        <td className="py-4 px-4 font-mono text-[11px]">
                          s/d {quo.validUntil}
                        </td>

                        <td className="py-4 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider ${
                            quo.status === 'CONFIRMED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                              : quo.status === 'QUOTED'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300'
                              : 'bg-neutral-100 text-neutral-600'
                          }`}>
                            {quo.status}
                          </span>
                          {quo.bookingId && (
                            <div className="text-[10px] font-mono text-neutral-600 dark:text-neutral-400 mt-1">
                              Booking: {quo.bookingId}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleCopyQuoteWhatsApp(quo)}
                              className="p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                              title="Salin Teks WhatsApp"
                            >
                              <Copy className="w-4 h-4" />
                            </button>

                            {quo.status !== 'CONFIRMED' && (
                              <button
                                onClick={() => handleConfirmQuotationToBooking(quo)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Konfirmasi Jadi Booking</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB D: CONFIRMED BOOKINGS */}
      {/* ========================================================= */}
      {activeTab === 'confirmed' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-neutral-800 rounded-3xl border border-neutral-200 dark:border-neutral-700 overflow-hidden shadow-xs">
            <div className="p-5 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="font-bold text-base text-neutral-900 dark:text-white">
                Daftar Booking Gathering Terkonfirmasi
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                Semua booking dari divisi Event & Gathering otomatis terintegrasi ke modul Orders, Finance, dan Operations.
              </p>
            </div>

            {confirmedGatheringBookings.length === 0 ? (
              <div className="p-12 text-center text-neutral-500 dark:text-neutral-400">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold">Belum ada booking gathering yang dikonfirmasi.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 font-mono uppercase tracking-wider text-[11px] font-bold border-b border-neutral-200 dark:border-neutral-700">
                    <tr>
                      <th className="py-3.5 px-4">Kode Booking</th>
                      <th className="py-3.5 px-4">Customer / Perusahaan</th>
                      <th className="py-3.5 px-4">Layanan & Destinasi</th>
                      <th className="py-3.5 px-4">Tgl Pelaksanaan</th>
                      <th className="py-3.5 px-4">Peserta</th>
                      <th className="py-3.5 px-4">Total Amount</th>
                      <th className="py-3.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-700/60 font-medium">
                    {confirmedGatheringBookings.map(b => (
                      <tr key={b.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-700/20">
                        <td className="py-4 px-4 font-mono font-bold text-neutral-900 dark:text-white">
                          {b.id}
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-bold text-neutral-900 dark:text-white">{b.customerName}</div>
                          <div className="text-[10px] text-neutral-600 dark:text-neutral-400">{b.customerPhone}</div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="font-bold text-neutral-800 dark:text-neutral-200">{b.serviceName}</div>
                          <div className="text-[10px] text-neutral-600 dark:text-neutral-400">{b.details?.destination || '-'}</div>
                        </td>
                        <td className="py-4 px-4 font-mono">
                          {b.details?.date || b.bookingDate}
                        </td>
                        <td className="py-4 px-4 font-mono">
                          {b.details?.guests || 60} Pax
                        </td>
                        <td className="py-4 px-4 font-bold text-emerald-800 dark:text-emerald-400">
                          Rp {(b.paymentAmount || b.totalPriceIDR || 0).toLocaleString('id-ID')}
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE / EDIT PACKAGE */}
      {/* ========================================================= */}
      {isPkgModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-neutral-800 rounded-3xl shadow-2xl max-w-3xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-700 mb-6">
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                {editingPkg ? 'Edit Paket Gathering' : 'Tambah Paket Gathering Baru'}
              </h3>
              <button
                onClick={() => setIsPkgModalOpen(false)}
                className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePkg} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Nama Paket *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Bromo Corporate Gathering 2D1N"
                    value={pkgName}
                    onChange={e => setPkgName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Destinasi *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Bromo - Pasuruan - Malang"
                    value={pkgDestination}
                    onChange={e => setPkgDestination(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Label Durasi
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="2 Hari 1 Malam (2D1N)"
                    value={pkgDuration}
                    onChange={e => setPkgDuration(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Jumlah Hari
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={pkgDays}
                    onChange={e => setPkgDays(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Jumlah Malam
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pkgNights}
                    onChange={e => setPkgNights(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Foto Utama (URL)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={pkgFeaturedImage}
                  onChange={e => setPkgFeaturedImage(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Deskripsi Paket
                </label>
                <textarea
                  rows={3}
                  value={pkgDescription}
                  onChange={e => setPkgDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900"
                />
              </div>

              {/* ESTIMATED PRICES TIERS (60, 70, 80, 90, 90+) */}
              <div className="bg-slate-50 dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 space-y-3">
                <div className="font-bold text-neutral-800 dark:text-neutral-200 text-xs">
                  Estimasi Harga per Peserta (Wajib 60, 70, 80, 90, 90+ Pax)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-neutral-500 mb-1">60 Pax (IDR)</label>
                    <input
                      type="number"
                      value={pkgPrice60}
                      onChange={e => setPkgPrice60(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-neutral-500 mb-1">70 Pax (IDR)</label>
                    <input
                      type="number"
                      value={pkgPrice70}
                      onChange={e => setPkgPrice70(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-neutral-500 mb-1">80 Pax (IDR)</label>
                    <input
                      type="number"
                      value={pkgPrice80}
                      onChange={e => setPkgPrice80(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-bold text-neutral-500 mb-1">90 Pax (IDR)</label>
                    <input
                      type="number"
                      value={pkgPrice90}
                      onChange={e => setPkgPrice90(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-500 mb-1">Keterangan 90+ Pax</label>
                  <input
                    type="text"
                    value={pkgPrice90PlusNote}
                    onChange={e => setPkgPrice90PlusNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Include (1 baris per item)
                  </label>
                  <textarea
                    rows={4}
                    value={pkgIncludesRaw}
                    onChange={e => setPkgIncludesRaw(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Exclude (1 baris per item)
                  </label>
                  <textarea
                    rows={4}
                    value={pkgExcludesRaw}
                    onChange={e => setPkgExcludesRaw(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Fasilitas Unggulan (1 baris per item)
                  </label>
                  <textarea
                    rows={3}
                    value={pkgFacilitiesRaw}
                    onChange={e => setPkgFacilitiesRaw(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                    Catatan / Notes (1 baris per item)
                  </label>
                  <textarea
                    rows={3}
                    value={pkgNotesRaw}
                    onChange={e => setPkgNotesRaw(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 font-mono"
                  />
                </div>
              </div>

              {/* FAQ Section */}
              <div className="bg-slate-50 dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-neutral-800 dark:text-neutral-200 text-xs flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Tanya Jawab (FAQ) Paket Gathering ({pkgFaq.length})</span>
                  </div>
                </div>

                {pkgFaq.length > 0 && (
                  <div className="space-y-2">
                    {pkgFaq.map((item, fIdx) => (
                      <div key={fIdx} className="bg-white dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-xs text-emerald-800 dark:text-emerald-400">Q: {item.question}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setNewPkgFaqQ(item.question);
                                setNewPkgFaqA(item.answer);
                                setEditingPkgFaqIdx(fIdx);
                              }}
                              className="p-1 text-neutral-500 hover:text-neutral-800 dark:hover:text-white cursor-pointer"
                              title="Edit FAQ"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPkgFaq(prev => prev.filter((_, i) => i !== fIdx));
                                if (editingPkgFaqIdx === fIdx) {
                                  setEditingPkgFaqIdx(null);
                                  setNewPkgFaqQ('');
                                  setNewPkgFaqA('');
                                }
                              }}
                              className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                              title="Hapus FAQ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[11px] text-neutral-600 dark:text-neutral-300">A: {item.answer}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-white dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                    <span>{editingPkgFaqIdx !== null ? `Edit FAQ #${editingPkgFaqIdx + 1}` : '+ Tambah FAQ Baru'}</span>
                    {editingPkgFaqIdx !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPkgFaqIdx(null);
                          setNewPkgFaqQ('');
                          setNewPkgFaqA('');
                        }}
                        className="text-[10px] text-neutral-400 hover:underline cursor-pointer"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Pertanyaan FAQ..."
                    value={newPkgFaqQ}
                    onChange={e => setNewPkgFaqQ(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 text-xs"
                  />
                  <textarea
                    rows={2}
                    placeholder="Jawaban FAQ..."
                    value={newPkgFaqA}
                    onChange={e => setNewPkgFaqA(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 text-xs resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newPkgFaqQ.trim() || !newPkgFaqA.trim()) return;
                      if (editingPkgFaqIdx !== null) {
                        setPkgFaq(prev => prev.map((f, i) => i === editingPkgFaqIdx ? { question: newPkgFaqQ.trim(), answer: newPkgFaqA.trim() } : f));
                        setEditingPkgFaqIdx(null);
                      } else {
                        setPkgFaq(prev => [...prev, { question: newPkgFaqQ.trim(), answer: newPkgFaqA.trim() }]);
                      }
                      setNewPkgFaqQ('');
                      setNewPkgFaqA('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-800 text-white font-bold text-[11px] hover:bg-emerald-900 cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{editingPkgFaqIdx !== null ? 'Simpan Perubahan' : 'Tambah ke FAQ'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="font-bold text-neutral-700 dark:text-neutral-300">Status Publikasi:</label>
                {(['published', 'draft', 'archived'] as const).map(st => (
                  <label key={st} className="flex items-center gap-1.5 cursor-pointer capitalize">
                    <input
                      type="radio"
                      name="pkgStatus"
                      checked={pkgStatus === st}
                      onChange={() => setPkgStatus(st)}
                    />
                    <span>{st}</span>
                  </label>
                ))}
              </div>

              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPkgModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold cursor-pointer shadow-md"
                >
                  Simpan Paket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE QUOTATION FROM REQUEST */}
      {/* ========================================================= */}
      {isCreateQuoteModalOpen && selectedRequestForQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-neutral-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 sm:p-8 border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-700 mb-6">
              <div>
                <span className="text-[10px] font-mono font-bold text-emerald-800 uppercase tracking-wider">
                  Generate Official Quotation
                </span>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  Penawaran: {selectedRequestForQuote.company}
                </h3>
              </div>
              <button
                onClick={() => setIsCreateQuoteModalOpen(false)}
                className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400 hover:text-neutral-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuotation} className="space-y-4 text-xs">
              <div className="bg-slate-50 dark:bg-neutral-900 p-3 rounded-2xl border border-neutral-200 dark:border-neutral-700 space-y-1">
                <div><strong>Klien:</strong> {selectedRequestForQuote.customerName} ({selectedRequestForQuote.company})</div>
                <div><strong>Paket:</strong> {selectedRequestForQuote.packageName}</div>
                <div><strong>Peserta:</strong> {selectedRequestForQuote.participants} Pax</div>
                <div><strong>Tanggal:</strong> {selectedRequestForQuote.requestedDate}</div>
              </div>

              <div>
                <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Harga Final per Peserta (IDR) *
                </label>
                <input
                  type="number"
                  required
                  value={quotePricePerPax}
                  onChange={e => {
                    const p = Number(e.target.value);
                    setQuotePricePerPax(p);
                    const pax = parseInt(selectedRequestForQuote.participants) || 60;
                    setQuoteTotalPrice(p * pax);
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Total Nilai Kontrak Penawaran (IDR) *
                </label>
                <input
                  type="number"
                  required
                  value={quoteTotalPrice}
                  onChange={e => setQuoteTotalPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 font-mono text-sm font-bold text-emerald-800 dark:text-emerald-400"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Masa Berlaku Penawaran (Hari)
                </label>
                <input
                  type="number"
                  min="1"
                  value={quoteValidDays}
                  onChange={e => setQuoteValidDays(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900 font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 dark:text-neutral-300 mb-1">
                  Catatan / Syarat Khusus
                </label>
                <textarea
                  rows={3}
                  value={quoteNotes}
                  onChange={e => setQuoteNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900"
                />
              </div>

              <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateQuoteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold cursor-pointer shadow-md"
                >
                  Terbitkan Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Building2, Users, Calendar, MapPin, Clock, Check, X, 
  Sparkles, PhoneCall, Mail, ArrowRight, ArrowLeft, ShieldCheck, 
  HelpCircle, ChevronRight, Send, AlertCircle, FileText, CheckCircle2,
  Info, Star, Award, Compass, MessageSquare, ChevronLeft, ChevronDown, ChevronUp, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../AppContext';
import CustomerReviewsSection from '../components/CustomerReviewsSection';
import { 
  GatheringPackage, 
  GatheringPaxOption, 
  GatheringQuotationRequest 
} from '../gathering/types';
import { 
  getGatheringPackages, 
  fetchGatheringPackages,
  fetchGatheringPackageById,
  apiCreateGatheringRequest,
  GATHERING_STORAGE_EVENT 
} from '../gathering/gatheringStore';
import { SEED_GATHERING_PACKAGES } from '../gathering/gatheringData';
import CustomerQuotationPortalModal from '../gathering/components/CustomerQuotationPortalModal';

/**
 * Robust helper to extract package identifier (slug or ID) from current browser URL.
 * Supports:
 * - Pathname: /event-gathering/<slug-or-id>
 * - Hash: #/event-gathering/<slug-or-id>
 * - Query param: ?package=<slug-or-id> / ?pkg=<slug-or-id> / ?id=<slug-or-id>
 */
function getPackageIdentifierFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const pathname = window.location.pathname || '';
  const fullHash = window.location.hash || '';
  const search = window.location.search || '';

  // 1. Pathname: /event-gathering/<slug-or-id>
  const pathParts = pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (pathParts[0] === 'event-gathering' && pathParts[1]) {
    const slug = decodeURIComponent(pathParts[1]).trim();
    if (slug) return slug;
  }

  // 2. Hash: #/event-gathering/<slug-or-id>
  if (fullHash) {
    const hashClean = fullHash.split('?')[0].replace(/^#\/?/, '');
    const hashParts = hashClean.split('/');
    if (hashParts[0] === 'event-gathering' && hashParts[1]) {
      const slug = decodeURIComponent(hashParts[1]).trim();
      if (slug) return slug;
    }
  }

  // 3. Query string: ?package=... or ?pkg=... or ?id=...
  const urlParams = new URLSearchParams(search);
  const hashParams = new URLSearchParams(fullHash.includes('?') ? fullHash.split('?')[1] : '');
  const qParam = urlParams.get('package') || urlParams.get('pkg') || urlParams.get('id') ||
                 hashParams.get('package') || hashParams.get('pkg') || hashParams.get('id');
  if (qParam) {
    const slug = decodeURIComponent(qParam).trim();
    if (slug) return slug;
  }

  return null;
}

export default function GatheringView() {
  const { formatPrice, searchParams, setSearchParams } = useApp();
  const [packages, setPackages] = useState<GatheringPackage[]>(() => getGatheringPackages());
  
  // Package detail active identifier from URL or AppContext
  const [activeSlugOrId, setActiveSlugOrId] = useState<string | null>(() => {
    return searchParams?.selectedGatheringPackageId || getPackageIdentifierFromUrl();
  });
  const [currentPackage, setCurrentPackage] = useState<GatheringPackage | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailNotFound, setDetailNotFound] = useState(false);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  // Request Quotation Modal State
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [quotationSuccess, setQuotationSuccess] = useState<GatheringQuotationRequest | null>(null);
  const [quotationPackage, setQuotationPackage] = useState<GatheringPackage | null>(null);

  // Portal State
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false);
  const [portalQuotationId, setPortalQuotationId] = useState('');
  const [portalToken, setPortalToken] = useState('');

  // Form State for Request Quotation
  const [picName, setPicName] = useState('');
  const [company, setCompany] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [participants, setParticipants] = useState<GatheringPaxOption>('60');
  const [requestedDate, setRequestedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter State in Catalog
  const [destinationFilter, setDestinationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Initial fetch of all published packages for catalog
  useEffect(() => {
    fetchGatheringPackages().then(pkgs => {
      if (pkgs && pkgs.length > 0) {
        setPackages(pkgs);
      }
    });

    const handleStorageUpdate = () => {
      setPackages(getGatheringPackages());
    };
    window.addEventListener(GATHERING_STORAGE_EVENT, handleStorageUpdate);
    return () => window.removeEventListener(GATHERING_STORAGE_EVENT, handleStorageUpdate);
  }, []);

  // Listen to browser Back / Forward buttons (popstate / hashchange)
  useEffect(() => {
    const syncFromUrl = () => {
      const fromUrl = getPackageIdentifierFromUrl();
      setActiveSlugOrId(fromUrl);
    };

    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('hashchange', syncFromUrl);

    return () => {
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('hashchange', syncFromUrl);
    };
  }, []);

  // Sync if AppContext searchParams.selectedGatheringPackageId changes
  useEffect(() => {
    if (searchParams?.selectedGatheringPackageId !== undefined) {
      if (searchParams.selectedGatheringPackageId !== activeSlugOrId) {
        setActiveSlugOrId(searchParams.selectedGatheringPackageId);
      }
    } else {
      const fromUrl = getPackageIdentifierFromUrl();
      if (fromUrl !== activeSlugOrId) {
        setActiveSlugOrId(fromUrl);
      }
    }
  }, [searchParams?.selectedGatheringPackageId]);

  // Fetch package details whenever activeSlugOrId changes
  useEffect(() => {
    if (!activeSlugOrId) {
      setCurrentPackage(null);
      setDetailNotFound(false);
      setIsLoadingDetail(false);
      return;
    }

    let isMounted = true;
    setIsLoadingDetail(true);
    setDetailNotFound(false);
    setActiveGalleryIndex(0);

    // Optimistic initial lookup from packages list if available
    const existingInList = packages.find(p => p.id === activeSlugOrId || p.slug === activeSlugOrId);
    if (existingInList) {
      setCurrentPackage(existingInList);
    }

    // Authoritative fetch from server API: GET /api/gathering/packages/:idOrSlug
    fetchGatheringPackageById(activeSlugOrId)
      .then(fetchedPkg => {
        if (!isMounted) return;
        if (fetchedPkg) {
          setCurrentPackage(fetchedPkg);
          setDetailNotFound(false);
        } else {
          if (!existingInList) {
            setCurrentPackage(null);
            setDetailNotFound(true);
          }
        }
      })
      .catch(err => {
        if (!isMounted) return;
        console.warn('[GatheringView] Error fetching package detail:', err);
        if (!existingInList) {
          setCurrentPackage(null);
          setDetailNotFound(true);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeSlugOrId, packages]);

  // Filter published packages for catalog
  const publishedPackages = useMemo(() => {
    return packages.filter(p => p.status === 'published' || p.isPublished);
  }, [packages]);

  const filteredPackages = useMemo(() => {
    return publishedPackages.filter(p => {
      if (destinationFilter !== 'all' && !p.destination.toLowerCase().includes(destinationFilter.toLowerCase())) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = 
          (p.name || p.title || '').toLowerCase().includes(q) ||
          p.destination.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [publishedPackages, destinationFilter, searchQuery]);

  // Navigation handlers
  const handleOpenDetail = useCallback((pkg: GatheringPackage) => {
    const slugOrId = pkg.slug || pkg.id;
    const targetUrl = `/event-gathering/${encodeURIComponent(slugOrId)}`;
    try {
      window.history.pushState({ gatheringPackage: slugOrId }, '', targetUrl);
    } catch {
      window.location.hash = `#/event-gathering/${encodeURIComponent(slugOrId)}`;
    }
    setActiveSlugOrId(slugOrId);
    setCurrentPackage(pkg);
    setDetailNotFound(false);
    setActiveGalleryIndex(0);
    setSearchParams((prev: any) => ({ ...prev, selectedGatheringPackageId: slugOrId }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSearchParams]);

  const handleBackToCatalog = useCallback(() => {
    const targetUrl = '/event-gathering';
    try {
      window.history.pushState({}, '', targetUrl);
    } catch {
      window.location.hash = '#/event-gathering';
    }
    setActiveSlugOrId(null);
    setCurrentPackage(null);
    setDetailNotFound(false);
    setSearchParams((prev: any) => ({ ...prev, selectedGatheringPackageId: undefined }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setSearchParams]);

  const handleOpenQuotationForm = useCallback((pkg: GatheringPackage) => {
    setQuotationPackage(pkg);
    setIsQuotationModalOpen(true);
    setQuotationSuccess(null);
    setFormError('');
  }, []);

  const handleSubmitQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPkg = quotationPackage || currentPackage;
    if (!targetPkg) return;

    if (!picName.trim()) {
      setFormError('Nama PIC wajib diisi.');
      return;
    }
    if (!company.trim()) {
      setFormError('Nama Perusahaan / Organisasi wajib diisi.');
      return;
    }
    if (!whatsapp.trim()) {
      setFormError('Nomor WhatsApp wajib diisi.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setFormError('Alamat email valid wajib diisi.');
      return;
    }
    if (!requestedDate) {
      setFormError('Tanggal rencana kegiatan wajib dipilih.');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      const newReq = await apiCreateGatheringRequest({
        packageId: targetPkg.id,
        packageName: targetPkg.name || targetPkg.title || 'Event & Gathering',
        duration: targetPkg.duration,
        customerName: picName.trim(),
        company: company.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim(),
        participants,
        requestedDate,
        notes: notes.trim()
      });

      setQuotationSuccess(newReq);
      // Reset form
      setPicName('');
      setCompany('');
      setWhatsapp('');
      setEmail('');
      setParticipants('60');
      setRequestedDate('');
      setNotes('');
    } catch (err: any) {
      setFormError(err.message || 'Gagal mengirim permintaan penawaran. Silakan coba kembali.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // RENDER: DETAIL VIEW OR NOT FOUND VIEW (WHEN activeSlugOrId IS SET)
  // -------------------------------------------------------------
  if (activeSlugOrId) {
    if (isLoadingDetail && !currentPackage) {
      return (
        <div className="min-h-screen bg-slate-50 text-neutral-900 pb-24 pt-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
            <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-neutral-800">Memuat Detail Paket Gathering...</h2>
            <p className="text-sm text-neutral-600 mt-1">Mengambil data resmi dari database Smart Journey...</p>
          </div>
        </div>
      );
    }

    if (detailNotFound || (!isLoadingDetail && !currentPackage)) {
      return (
        <div className="min-h-screen bg-slate-50 text-neutral-900 pb-24 pt-12">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center mb-5">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-neutral-900">
              Paket Gathering Tidak Ditemukan
            </h1>
            <p className="text-sm text-neutral-600 mt-2 max-w-md mx-auto leading-relaxed">
              Paket dengan tautan atau identifikasi <code className="bg-neutral-200 px-1.5 py-0.5 rounded text-xs font-mono font-bold text-neutral-800">{activeSlugOrId}</code> tidak tersedia, belum dipublikasikan, atau telah diperbarui.
            </p>
            <div className="mt-8 flex justify-center">
              <button
                onClick={handleBackToCatalog}
                className="px-6 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Katalog Event & Gathering</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (currentPackage) {
      const packageName = currentPackage.name || currentPackage.title || 'Event & Gathering Package';
      const mainImage = currentPackage.featuredImage || currentPackage.image || '/logo.png';
      const allGalleryImages = [
        mainImage,
        ...(Array.isArray(currentPackage.gallery) ? currentPackage.gallery : [])
      ].filter((img, idx, arr) => img && arr.indexOf(img) === idx);

      const displayImage = allGalleryImages[activeGalleryIndex] || mainImage;
      const facilitiesList = Array.isArray(currentPackage.facilities) ? currentPackage.facilities : [];
      const includesList = Array.isArray(currentPackage.includes) ? currentPackage.includes : (Array.isArray(currentPackage.included) ? currentPackage.included : []);
      const excludesList = Array.isArray(currentPackage.excludes) ? currentPackage.excludes : (Array.isArray(currentPackage.excluded) ? currentPackage.excluded : []);
      const itineraryList = Array.isArray(currentPackage.itinerary) ? currentPackage.itinerary : [];
      
      const price60 = currentPackage.estimatedPrices?.pax60 ?? currentPackage.price60Pax ?? 0;
      const price70 = currentPackage.estimatedPrices?.pax70 ?? currentPackage.price70Pax ?? 0;
      const price80 = currentPackage.estimatedPrices?.pax80 ?? currentPackage.price80Pax ?? 0;
      const price90 = currentPackage.estimatedPrices?.pax90 ?? currentPackage.price90Pax ?? 0;
      const price90PlusNote = currentPackage.estimatedPrices?.pax90PlusNote || currentPackage.price90PlusText || 'Hubungi Admin untuk Penawaran Khusus';

      const notesList = Array.isArray(currentPackage.notes) 
        ? currentPackage.notes 
        : (typeof currentPackage.notes === 'string' && currentPackage.notes.trim() ? currentPackage.notes.split('\n').filter(Boolean) : []);

      const rawFaq = (Array.isArray(currentPackage.faq) && currentPackage.faq.length > 0)
        ? currentPackage.faq
        : (() => {
            const seed = SEED_GATHERING_PACKAGES.find(s => 
              s.id === currentPackage.id || 
              s.slug === currentPackage.slug || 
              (currentPackage.name && s.name.toLowerCase().includes(currentPackage.name.toLowerCase())) || 
              (currentPackage.title && s.name.toLowerCase().includes(currentPackage.title.toLowerCase()))
            );
            return Array.isArray(seed?.faq) ? seed.faq : [];
          })();

      const faqList = rawFaq.map(item => ({
        question: item.question || (item as any).q || '',
        answer: item.answer || (item as any).a || ''
      })).filter(f => f.question.trim() !== '');

      return (
        <div className="min-h-screen bg-slate-50 text-neutral-900 pb-24">
          {/* Breadcrumbs & Navigation Bar */}
          <div className="bg-white border-b border-neutral-200/80 sticky top-16 z-30 shadow-xs">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
              <button
                onClick={handleBackToCatalog}
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-neutral-600 hover:text-emerald-800 transition-colors cursor-pointer group"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                <span>Kembali ke Katalog Gathering</span>
              </button>

              <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-600 font-medium overflow-hidden">
                <span className="shrink-0">Event & Gathering</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                <span className="text-neutral-700 font-bold truncate max-w-xs">{packageName}</span>
              </div>

              <button
                onClick={() => handleOpenQuotationForm(currentPackage)}
                className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-300" />
                <span>Minta Penawaran</span>
              </button>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
            {/* Hero & Gallery Section */}
            <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-md overflow-hidden mb-8">
              <div className="relative h-72 sm:h-96 md:h-[420px] w-full overflow-hidden bg-neutral-900">
                <img
                  src={displayImage}
                  alt={packageName}
                  className="w-full h-full object-cover transition-opacity duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

                {/* Top Badges */}
                <div className="absolute top-5 left-5 flex flex-wrap gap-2 z-10">
                  <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-white/95 text-neutral-900 shadow-md backdrop-blur-sm flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-700" />
                    {currentPackage.duration}
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-900/90 text-emerald-100 shadow-md backdrop-blur-sm flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    {currentPackage.destination}
                  </span>
                </div>

                {/* Bottom Title on Image */}
                <div className="absolute bottom-6 left-6 right-6 z-10">
                  <div className="text-emerald-300 text-xs font-bold uppercase tracking-wider font-mono mb-1">
                    Paket Gathering & Outbound Resmi
                  </div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white leading-tight drop-shadow-md">
                    {packageName}
                  </h1>
                </div>
              </div>

              {/* Gallery Thumbnails (if multiple images) */}
              {allGalleryImages.length > 1 && (
                <div className="p-4 bg-slate-900/5 border-t border-neutral-200/80 flex items-center gap-2.5 overflow-x-auto">
                  <div className="text-[11px] font-bold text-neutral-700 uppercase tracking-wider shrink-0 mr-2 flex items-center gap-1 font-mono">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Galeri Foto:
                  </div>
                  {allGalleryImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveGalleryIndex(idx)}
                      className={`relative w-16 h-12 sm:w-20 sm:h-14 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                        activeGalleryIndex === idx
                          ? 'border-emerald-600 scale-105 shadow-md ring-2 ring-emerald-500/20'
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={img} alt={`Gallery ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mandatory Disclaimer Banner */}
            <div className="mb-8 bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 text-amber-900 shadow-xs">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm leading-relaxed">
                <strong className="font-bold text-amber-950 block mb-1">Catatan Penting Estimasi Harga:</strong>
                Harga yang ditampilkan merupakan estimasi per peserta. Harga final resmi akan disesuaikan melalui quotation resmi dari tim Event Specialist Smart Journey berdasarkan tanggal pelaksanaan pasti, jumlah peserta final, kebutuhan fasilitas khusus, dan ketersediaan layanan.
              </div>
            </div>

            {/* Main Content Grid: Left Column Details, Right Column Sticky Action */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column (2 Cols) */}
              <div className="lg:col-span-2 space-y-8">
                {/* Description */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm">
                  <h3 className="text-xs font-bold text-neutral-600 uppercase tracking-wider font-mono mb-3">
                    Deskripsi Program
                  </h3>
                  <p className="text-neutral-700 text-sm sm:text-base leading-relaxed whitespace-pre-line">
                    {currentPackage.description}
                  </p>
                </div>

                {/* Facilities */}
                {facilitiesList.length > 0 && (
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm">
                    <h3 className="text-xs font-bold text-neutral-600 uppercase tracking-wider font-mono mb-4">
                      Fasilitas Unggulan Program
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {facilitiesList.map((fac, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-900 text-xs sm:text-sm font-semibold flex items-center gap-2.5"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>{fac}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Day-by-Day Itinerary */}
                {itineraryList.length > 0 && (
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm">
                    <h3 className="text-xs font-bold text-neutral-600 uppercase tracking-wider font-mono mb-6">
                      Itinerary Lengkap per Hari
                    </h3>
                    <div className="space-y-6">
                      {itineraryList.map(item => (
                        <div
                          key={item.day}
                          className="bg-slate-50 p-5 rounded-2xl border border-neutral-200/80 shadow-xs"
                        >
                          <div className="font-bold text-neutral-900 text-sm sm:text-base mb-2.5 flex items-center gap-2.5">
                            <span className="px-3 py-1 rounded-xl bg-emerald-800 text-white text-xs font-mono font-bold">
                              Hari {item.day}
                            </span>
                            <span className="leading-snug">{item.title}</span>
                          </div>

                          {item.desc && (
                            <p className="text-xs text-neutral-600 mb-3 italic">
                              {item.desc}
                            </p>
                          )}

                          {Array.isArray(item.activities) && item.activities.length > 0 && (
                            <ul className="space-y-2 pl-1 border-t border-neutral-200/60 pt-3">
                              {item.activities.map((act, actIdx) => (
                                <li key={actIdx} className="text-xs sm:text-sm text-neutral-700 flex items-start gap-2.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
                                  <span>{act}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Includes & Excludes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Includes */}
                  <div className="bg-white rounded-3xl p-6 border border-emerald-200/90 shadow-sm">
                    <h4 className="font-bold text-emerald-950 text-xs uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      Fasilitas Termasuk (Include)
                    </h4>
                    <ul className="space-y-2.5">
                      {includesList.map((inc, i) => (
                        <li key={i} className="text-xs sm:text-sm text-neutral-700 flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                          <span>{inc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Excludes */}
                  <div className="bg-white rounded-3xl p-6 border border-rose-200/90 shadow-sm">
                    <h4 className="font-bold text-rose-950 text-xs uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
                      <X className="w-4 h-4 text-rose-600" />
                      Belum Termasuk (Exclude)
                    </h4>
                    <ul className="space-y-2.5">
                      {excludesList.map((exc, i) => (
                        <li key={i} className="text-xs sm:text-sm text-neutral-700 flex items-start gap-2.5">
                          <X className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                          <span>{exc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Notes */}
                {notesList.length > 0 && (
                  <div className="bg-white rounded-3xl p-6 border border-neutral-200/90 shadow-sm text-xs sm:text-sm text-neutral-700">
                    <h4 className="font-bold text-neutral-800 text-xs uppercase tracking-wider font-mono mb-3">
                      Catatan Tambahan & Informasi Khusus
                    </h4>
                    <ul className="space-y-2">
                      {notesList.map((note, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-neutral-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 mt-2 shrink-0" />
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* FAQ Accordion Section */}
                {faqList.length > 0 && (
                  <div className="bg-white rounded-3xl p-6 sm:p-8 border border-neutral-200/90 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold text-neutral-600 uppercase tracking-wider font-mono flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-emerald-700" />
                      <span>Pertanyaan yang Sering Diajukan (FAQ)</span>
                    </h3>
                    <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-2xl overflow-hidden">
                      {faqList.map((item, idx) => {
                        const isOpen = expandedFaq === idx;
                        return (
                          <div key={idx} className="py-1">
                            <button
                              onClick={() => setExpandedFaq(isOpen ? null : idx)}
                              className="w-full flex items-center justify-between text-left font-bold text-xs sm:text-sm text-neutral-800 hover:text-emerald-700 transition-colors py-4 px-5 cursor-pointer"
                            >
                              <span>{item.question}</span>
                              {isOpen ? <ChevronUp className="h-4 w-4 text-emerald-600" /> : <ChevronDown className="h-4 w-4 text-neutral-500" />}
                            </button>
                            {isOpen && (
                              <div className="px-5 pb-4 text-xs sm:text-sm text-neutral-600 leading-relaxed">
                                {item.answer}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Customer Reviews Section (Specific to this Gathering Package) */}
                <CustomerReviewsSection
                  serviceType="gathering"
                  serviceId={currentPackage.id}
                  serviceName={packageName}
                />
              </div>

              {/* Right Column: Pricing Tiers & Action Card */}
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 sm:p-7 border border-neutral-200/90 shadow-lg sticky top-32">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-700" />
                      Estimasi Harga per Peserta
                    </span>
                    <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Harga Estimasi
                    </span>
                  </div>

                  {/* Price Tiers Grid */}
                  <div className="grid grid-cols-2 gap-2.5 mb-4 text-center">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-neutral-200/80">
                      <div className="text-[11px] font-bold text-neutral-600 font-mono">60 Pax</div>
                      <div className="text-sm font-black text-neutral-900 mt-1">
                        Rp {price60.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-neutral-600">/ orang</div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-neutral-200/80">
                      <div className="text-[11px] font-bold text-neutral-600 font-mono">70 Pax</div>
                      <div className="text-sm font-black text-neutral-900 mt-1">
                        Rp {price70.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-neutral-600">/ orang</div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-neutral-200/80">
                      <div className="text-[11px] font-bold text-neutral-600 font-mono">80 Pax</div>
                      <div className="text-sm font-black text-neutral-900 mt-1">
                        Rp {price80.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-neutral-600">/ orang</div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl border border-neutral-200/80">
                      <div className="text-[11px] font-bold text-neutral-600 font-mono">90 Pax</div>
                      <div className="text-sm font-black text-neutral-900 mt-1">
                        Rp {price90.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-neutral-600">/ orang</div>
                    </div>
                  </div>

                  {/* 90+ Pax Special Tier */}
                  <div className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 text-center mb-6">
                    <div className="text-[11px] font-bold text-emerald-900 font-mono">90+ Peserta</div>
                    <div className="text-xs font-black text-emerald-800 mt-0.5">
                      {price90PlusNote}
                    </div>
                  </div>

                  {/* CTAs */}
                  <div className="space-y-3">
                    <button
                      onClick={() => handleOpenQuotationForm(currentPackage)}
                      className="w-full py-3.5 px-6 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-emerald-300" />
                      <span>Minta Penawaran</span>
                    </button>

                    <a
                      href={`https://wa.me/6281234567890?text=${encodeURIComponent(
                        `Halo Smart Journey, saya tertarik dengan paket gathering "${packageName}" (${currentPackage.duration}). Mohon informasi dan estimasi penawarannya.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-6 rounded-2xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 font-bold text-xs transition-all flex items-center justify-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-600" />
                      <span>Konsultasi WhatsApp</span>
                    </a>

                    <button
                      onClick={handleBackToCatalog}
                      className="w-full py-2.5 px-4 rounded-xl text-neutral-600 hover:text-neutral-900 font-medium text-xs transition-colors cursor-pointer text-center"
                    >
                      ← Lihat Paket Lainnya
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quotation Modal */}
          {renderQuotationModal()}

          {/* Portal Modal */}
          <CustomerQuotationPortalModal
            isOpen={isPortalModalOpen}
            onClose={() => setIsPortalModalOpen(false)}
            initialQuotationId={portalQuotationId}
            initialToken={portalToken}
            formatPrice={formatPrice}
          />
        </div>
      );
    }
  }

  // -------------------------------------------------------------
  // RENDER: CATALOG VIEW (DEFAULT)
  // -------------------------------------------------------------
  function renderQuotationModal() {
    const pkgToUse = quotationPackage || currentPackage;
    if (!isQuotationModalOpen || !pkgToUse) return null;

    const pkgTitle = pkgToUse.name || pkgToUse.title || 'Event & Gathering';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 sm:p-8 border border-neutral-200 max-h-[90vh] overflow-y-auto"
        >
          {quotationSuccess ? (
            /* Success View */
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-neutral-900">
                Permintaan Penawaran Terkirim!
              </h3>
              <div className="mt-2 text-xs font-mono font-bold bg-neutral-100 text-neutral-600 px-3 py-1 rounded-full inline-block">
                ID Permintaan: {quotationSuccess.id}
              </div>
              <p className="mt-4 text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-md mx-auto">
                Terima kasih <strong>{quotationSuccess.customerName}</strong> dari <strong>{quotationSuccess.company}</strong>. Tim Event Specialist Smart Journey akan menyusun proposal penawaran resmi untuk paket <strong>{quotationSuccess.packageName}</strong> dan menghubungi Anda via WhatsApp ({quotationSuccess.whatsapp}) atau email dalam 1x24 jam.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setPortalQuotationId(quotationSuccess.id);
                    setPortalToken(quotationSuccess.secureToken || '');
                    setIsQuotationModalOpen(false);
                    setIsPortalModalOpen(true);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span>Buka di Portal Penawaran</span>
                </button>
                <a
                  href={`https://wa.me/6281234567890?text=${encodeURIComponent(
                    `Halo Smart Journey, saya ${quotationSuccess.customerName} dari ${quotationSuccess.company}. Saya baru saja mengirimkan permintaan penawaran gathering ID: ${quotationSuccess.id} untuk paket ${quotationSuccess.packageName} (${quotationSuccess.participants} Pax). Mohon info lebih lanjut.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-700 text-white font-bold text-xs shadow-md hover:bg-emerald-800 transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Chat WhatsApp</span>
                </a>
                <button
                  onClick={() => {
                    setIsQuotationModalOpen(false);
                    setQuotationSuccess(null);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-bold text-xs hover:bg-neutral-100 transition-all cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          ) : (
            /* Request Quotation Form */
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-6">
                <div>
                  <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider font-mono">
                    Formulir Permintaan Penawaran
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-neutral-900 mt-0.5">
                    {pkgTitle}
                  </h3>
                  <div className="text-xs text-neutral-500">
                    Durasi: {pkgToUse.duration} • ID: {pkgToUse.id}
                  </div>
                </div>
                <button
                  onClick={() => setIsQuotationModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitQuotation} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Nama PIC (Contact Person) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nama lengkap PIC"
                      value={picName}
                      onChange={e => setPicName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-neutral-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Perusahaan / Organisasi *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="PT / Instansi / Komunitas"
                      value={company}
                      onChange={e => setCompany(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-neutral-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Nomor WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Contoh: 08123456789"
                      value={whatsapp}
                      onChange={e => setWhatsapp(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-neutral-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Alamat Email *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="email@perusahaan.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-neutral-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Estimasi Jumlah Peserta *
                    </label>
                    <div className="grid grid-cols-5 gap-1">
                      {(['60', '70', '80', '90', '90+'] as GatheringPaxOption[]).map(pax => (
                        <button
                          type="button"
                          key={pax}
                          onClick={() => setParticipants(pax)}
                          className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            participants === pax
                              ? 'bg-emerald-800 text-white border-emerald-800 shadow-sm'
                              : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                          }`}
                        >
                          {pax} Pax
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-700 mb-1">
                      Rencana Tanggal Pelaksanaan *
                    </label>
                    <input
                      type="date"
                      required
                      value={requestedDate}
                      onChange={e => setRequestedDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-neutral-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Catatan Khusus / Kebutuhan Tambahan
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Contoh: Kebutuhan tema outbound khusus, artis/MC tamu, sewa ballroom bintang 5, permintaan menu makanan vegetarian, dll."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-neutral-50"
                  />
                </div>

                <div className="pt-4 border-t border-neutral-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsQuotationModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-bold text-xs hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Mengirim...' : 'Kirim Permintaan Penawaran'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-neutral-900 pb-24">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 text-white pt-24 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-5">
            <Building2 className="w-3.5 h-3.5" />
            <span>Corporate Gathering & Outing Services</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white max-w-3xl leading-tight">
            Event & Gathering Perusahaan Terbaik di Jawa Timur & Bali
          </h1>
          <p className="mt-4 text-base sm:text-lg text-emerald-100/90 max-w-2xl font-normal leading-relaxed">
            Spesialis pengorganisasian Corporate Gathering, Outbound Teambuilding, Company Anniversary, dan Family Gathering dengan pelayanan premium, armada terstandarisasi, dan fasilitator profesional.
          </p>

          {/* Estimation Mandatory Disclaimer Banner */}
          <div className="mt-8 max-w-3xl bg-amber-500/15 border border-amber-400/40 rounded-2xl p-4 sm:p-5 backdrop-blur-md flex items-start gap-3.5 text-amber-200">
            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm leading-relaxed">
              <strong className="font-bold text-amber-300 block mb-1">Informasi Estimasi Harga:</strong>
              Harga yang ditampilkan merupakan estimasi. Harga final akan disesuaikan melalui quotation resmi berdasarkan tanggal pelaksanaan, jumlah peserta pasti, kebutuhan fasilitas khusus, dan ketersediaan layanan.
            </div>
          </div>

          {/* Action CTAs: Browse or Check Existing Quotation */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => {
                setPortalQuotationId('');
                setPortalToken('');
                setIsPortalModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs sm:text-sm font-bold flex items-center gap-2 backdrop-blur-sm transition-all cursor-pointer shadow-sm"
            >
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Portal Penawaran / Cek Quotation Saya</span>
            </button>
          </div>
        </div>
      </section>

      {/* Catalogue Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-lg border border-neutral-200/80 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider shrink-0 mr-1">Destinasi:</span>
            {['all', 'Bromo', 'Batu', 'Banyuwangi', 'Bali'].map(dest => (
              <button
                key={dest}
                onClick={() => setDestinationFilter(dest)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  destinationFilter === dest
                    ? 'bg-emerald-800 text-white shadow-sm'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {dest === 'all' ? 'Semua Destinasi' : dest}
              </button>
            ))}
          </div>

          <div className="w-full md:w-72">
            <input
              type="text"
              placeholder="Cari paket gathering..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 bg-neutral-50"
            />
          </div>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {filteredPackages.map(pkg => {
            const pkgName = pkg.name || pkg.title || 'Event & Gathering Package';
            const price60 = pkg.estimatedPrices?.pax60 ?? pkg.price60Pax ?? 0;
            const price70 = pkg.estimatedPrices?.pax70 ?? pkg.price70Pax ?? 0;
            const price80 = pkg.estimatedPrices?.pax80 ?? pkg.price80Pax ?? 0;
            const price90 = pkg.estimatedPrices?.pax90 ?? pkg.price90Pax ?? 0;
            const price90Plus = pkg.estimatedPrices?.pax90PlusNote || pkg.price90PlusText || 'Hubungi Admin untuk Penawaran Khusus';
            const facilities = Array.isArray(pkg.facilities) ? pkg.facilities : [];

            return (
              <div
                key={pkg.id}
                onClick={() => handleOpenDetail(pkg)}
                className="bg-white rounded-3xl border border-neutral-200/90 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col cursor-pointer group"
              >
                {/* Image & Header */}
                <div className="relative h-60 w-full overflow-hidden">
                  <img
                    src={pkg.featuredImage || pkg.image}
                    alt={pkgName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-white/95 text-neutral-900 shadow-md backdrop-blur-sm flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-emerald-700" />
                      {pkg.duration}
                    </span>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-900/90 text-emerald-100 shadow-md backdrop-blur-sm flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      {pkg.destination}
                    </span>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-xl font-bold text-white leading-tight drop-shadow-md group-hover:text-emerald-200 transition-colors">
                      {pkgName}
                    </h3>
                  </div>
                </div>

                {/* Body */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <p className="text-neutral-600 text-xs sm:text-sm line-clamp-3 leading-relaxed mb-5">
                      {pkg.description}
                    </p>

                    {/* Highlights / Facilities */}
                    {facilities.length > 0 && (
                      <div className="mb-6">
                        <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-2 font-mono">
                          Fasilitas Unggulan Termasuk:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {facilities.slice(0, 4).map((fac, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 text-[11px] font-medium border border-emerald-200/60 flex items-center gap-1"
                            >
                              <Check className="w-3 h-3 text-emerald-600" />
                              {fac}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Estimated Price Tiers based on Participants (60, 70, 80, 90, 90+) */}
                    <div className="bg-slate-50 rounded-2xl p-4 border border-neutral-200/80 mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-700" />
                          Estimasi Harga per Peserta
                        </span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Harga Estimasi
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="bg-white p-2.5 rounded-xl border border-neutral-200/70 shadow-xs">
                          <div className="text-[10px] font-bold text-neutral-600 font-mono">60 Pax</div>
                          <div className="text-xs font-extrabold text-neutral-800 mt-0.5">
                            Rp {price60.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-neutral-200/70 shadow-xs">
                          <div className="text-[10px] font-bold text-neutral-600 font-mono">70 Pax</div>
                          <div className="text-xs font-extrabold text-neutral-800 mt-0.5">
                            Rp {price70.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-neutral-200/70 shadow-xs">
                          <div className="text-[10px] font-bold text-neutral-600 font-mono">80 Pax</div>
                          <div className="text-xs font-extrabold text-neutral-800 mt-0.5">
                            Rp {price80.toLocaleString('id-ID')}
                          </div>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-neutral-200/70 shadow-xs">
                          <div className="text-[10px] font-bold text-neutral-600 font-mono">90 Pax</div>
                          <div className="text-xs font-extrabold text-neutral-800 mt-0.5">
                            Rp {price90.toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2.5 border-t border-neutral-200/60 flex items-center justify-between text-[11px] text-neutral-600">
                        <span className="font-semibold text-neutral-700">90+ Pax:</span>
                        <span className="text-emerald-800 font-bold bg-emerald-100/70 px-2 py-0.5 rounded-md">
                          {price90Plus}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDetail(pkg);
                      }}
                      className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 font-bold text-xs transition-colors text-center cursor-pointer"
                    >
                      Lihat Detail Paket
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenQuotationForm(pkg);
                      }}
                      className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Minta Penawaran</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quotation Request Modal */}
      {renderQuotationModal()}

      {/* Customer Quotation Portal Modal */}
      <CustomerQuotationPortalModal
        isOpen={isPortalModalOpen}
        onClose={() => setIsPortalModalOpen(false)}
        initialQuotationId={portalQuotationId}
        initialToken={portalToken}
        formatPrice={formatPrice}
      />
    </div>
  );
}

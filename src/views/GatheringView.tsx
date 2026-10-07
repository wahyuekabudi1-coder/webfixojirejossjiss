import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Users, Calendar, MapPin, Clock, Check, X, 
  Sparkles, PhoneCall, Mail, ArrowRight, ShieldCheck, 
  HelpCircle, ChevronRight, Send, AlertCircle, FileText, CheckCircle2,
  Info, Star, Award, Compass, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../AppContext';
import { 
  GatheringPackage, 
  GatheringPaxOption, 
  GatheringQuotationRequest 
} from '../gathering/types';
import { 
  getGatheringPackages, 
  fetchGatheringPackages,
  addGatheringQuotationRequest, 
  apiCreateGatheringRequest,
  GATHERING_STORAGE_EVENT 
} from '../gathering/gatheringStore';
import CustomerQuotationPortalModal from '../gathering/components/CustomerQuotationPortalModal';

export default function GatheringView() {
  const { formatPrice } = useApp();
  const [packages, setPackages] = useState<GatheringPackage[]>(() => getGatheringPackages());
  const [selectedPackage, setSelectedPackage] = useState<GatheringPackage | null>(null);
  const [isQuotationModalOpen, setIsQuotationModalOpen] = useState(false);
  const [quotationSuccess, setQuotationSuccess] = useState<GatheringQuotationRequest | null>(null);

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

  // Filter State
  const [destinationFilter, setDestinationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Initial fetch from backend persistent database
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

  // Filter published packages
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

  const handleOpenQuotationForm = (pkg: GatheringPackage) => {
    setSelectedPackage(pkg);
    setIsQuotationModalOpen(true);
    setQuotationSuccess(null);
    setFormError('');
  };

  const handleSubmitQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) return;

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
        packageId: selectedPackage.id,
        packageName: selectedPackage.name || selectedPackage.title || 'Event & Gathering',
        duration: selectedPackage.duration,
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
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider shrink-0 mr-1">Destinasi:</span>
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
          {filteredPackages.map(pkg => (
            <div
              key={pkg.id}
              className="bg-white rounded-3xl border border-neutral-200/90 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col"
            >
              {/* Image & Header */}
              <div className="relative h-60 w-full overflow-hidden group">
                <img
                  src={pkg.featuredImage}
                  alt={pkg.name}
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
                  <h3 className="text-xl font-bold text-white leading-tight drop-shadow-md">
                    {pkg.name}
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
                  <div className="mb-6">
                    <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-2 font-mono">
                      Fasilitas Unggulan Termasuk:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {pkg.facilities.slice(0, 4).map((fac, idx) => (
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
                        <div className="text-[10px] font-bold text-neutral-400 font-mono">60 Pax</div>
                        <div className="text-xs font-extrabold text-neutral-800 mt-0.5">
                          Rp {pkg.estimatedPrices.pax60.toLocaleString('id-ID')}
                        </div>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-neutral-200/70 shadow-xs">
                        <div className="text-[10px] font-bold text-neutral-400 font-mono">70 Pax</div>
                        <div className="text-xs font-extrabold text-neutral-800 mt-0.5">
                          Rp {pkg.estimatedPrices.pax70.toLocaleString('id-ID')}
                        </div>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-neutral-200/70 shadow-xs">
                        <div className="text-[10px] font-bold text-neutral-400 font-mono">80 Pax</div>
                        <div className="text-xs font-extrabold text-neutral-800 mt-0.5">
                          Rp {pkg.estimatedPrices.pax80.toLocaleString('id-ID')}
                        </div>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-neutral-200/70 shadow-xs">
                        <div className="text-[10px] font-bold text-neutral-400 font-mono">90 Pax</div>
                        <div className="text-xs font-extrabold text-neutral-800 mt-0.5">
                          Rp {pkg.estimatedPrices.pax90.toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2.5 border-t border-neutral-200/60 flex items-center justify-between text-[11px] text-neutral-600">
                      <span className="font-semibold text-neutral-700">90+ Pax:</span>
                      <span className="text-emerald-800 font-bold bg-emerald-100/70 px-2 py-0.5 rounded-md">
                        {pkg.estimatedPrices.pax90PlusNote || 'Hubungi Admin untuk Penawaran Khusus'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <button
                    onClick={() => setSelectedPackage(pkg)}
                    className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-neutral-100 font-bold text-xs transition-colors text-center cursor-pointer"
                  >
                    Lihat Detail Paket
                  </button>
                  <button
                    onClick={() => handleOpenQuotationForm(pkg)}
                    className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Minta Penawaran</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Package Detail Modal */}
      <AnimatePresence>
        {selectedPackage && !isQuotationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-neutral-200"
            >
              {/* Modal Header Image */}
              <div className="relative h-64 sm:h-80 w-full overflow-hidden">
                <img
                  src={selectedPackage.featuredImage}
                  alt={selectedPackage.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <button
                  onClick={() => setSelectedPackage(null)}
                  className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-white text-neutral-900 shadow">
                      {selectedPackage.duration}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-900 text-emerald-100 shadow">
                      {selectedPackage.destination}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                    {selectedPackage.name}
                  </h2>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 sm:p-8 space-y-8">
                {/* Mandatory Disclaimer */}
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs sm:text-sm">
                  <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block mb-0.5">Catatan Penting Penawaran:</strong>
                    Harga yang ditampilkan merupakan estimasi. Harga final akan disesuaikan melalui quotation resmi berdasarkan tanggal, jumlah peserta, kebutuhan, dan ketersediaan layanan.
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider font-mono mb-2">
                    Deskripsi Program
                  </h4>
                  <p className="text-neutral-700 text-sm leading-relaxed">
                    {selectedPackage.description}
                  </p>
                </div>

                {/* Itinerary */}
                <div>
                  <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-wider font-mono mb-4">
                    Itinerary Lengkap
                  </h4>
                  <div className="space-y-4">
                    {selectedPackage.itinerary.map(item => (
                      <div key={item.day} className="bg-slate-50 p-4 rounded-2xl border border-neutral-200">
                        <div className="font-bold text-neutral-900 text-sm mb-2 flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-800 text-white text-xs font-mono">
                            Hari {item.day}
                          </span>
                          <span>{item.title}</span>
                        </div>
                        <ul className="space-y-1.5 pl-2">
                          {item.activities.map((act, idx) => (
                            <li key={idx} className="text-xs text-neutral-600 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                              <span>{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Includes & Excludes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-emerald-50/60 border border-emerald-200/80 p-5 rounded-2xl">
                    <h5 className="font-bold text-emerald-950 text-xs uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      Fasilitas Termasuk (Include)
                    </h5>
                    <ul className="space-y-2">
                      {selectedPackage.includes.map((inc, i) => (
                        <li key={i} className="text-xs text-neutral-700 flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                          <span>{inc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-rose-50/60 border border-rose-200/80 p-5 rounded-2xl">
                    <h5 className="font-bold text-rose-950 text-xs uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
                      <X className="w-4 h-4 text-rose-600" />
                      Belum Termasuk (Exclude)
                    </h5>
                    <ul className="space-y-2">
                      {selectedPackage.excludes.map((exc, i) => (
                        <li key={i} className="text-xs text-neutral-700 flex items-start gap-2">
                          <X className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                          <span>{exc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Estimated Price Breakdown (60, 70, 80, 90, 90+ Pax) */}
                <div className="bg-slate-50 border border-neutral-200 rounded-2xl p-5">
                  <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider font-mono mb-3">
                    Estimasi Harga Berdasarkan Jumlah Peserta
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="bg-white p-3 rounded-xl border border-neutral-200 shadow-xs">
                      <div className="text-xs font-bold text-neutral-400 font-mono">60 Pax</div>
                      <div className="text-sm font-black text-neutral-900 mt-1">
                        Rp {selectedPackage.estimatedPrices.pax60.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-neutral-400">/ orang</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-neutral-200 shadow-xs">
                      <div className="text-xs font-bold text-neutral-400 font-mono">70 Pax</div>
                      <div className="text-sm font-black text-neutral-900 mt-1">
                        Rp {selectedPackage.estimatedPrices.pax70.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-neutral-400">/ orang</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-neutral-200 shadow-xs">
                      <div className="text-xs font-bold text-neutral-400 font-mono">80 Pax</div>
                      <div className="text-sm font-black text-neutral-900 mt-1">
                        Rp {selectedPackage.estimatedPrices.pax80.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-neutral-400">/ orang</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-neutral-200 shadow-xs">
                      <div className="text-xs font-bold text-neutral-400 font-mono">90 Pax</div>
                      <div className="text-sm font-black text-neutral-900 mt-1">
                        Rp {selectedPackage.estimatedPrices.pax90.toLocaleString('id-ID')}
                      </div>
                      <div className="text-[10px] text-neutral-400">/ orang</div>
                    </div>
                  </div>
                  <div className="mt-3 text-center text-xs text-emerald-800 font-bold bg-emerald-50 py-2 rounded-xl border border-emerald-200">
                    90+ Pax: {selectedPackage.estimatedPrices.pax90PlusNote || 'Hubungi Admin'}
                  </div>
                </div>

                {/* Notes */}
                {selectedPackage.notes && selectedPackage.notes.length > 0 && (
                  <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200 text-xs text-neutral-600 space-y-1">
                    <strong className="font-bold text-neutral-800 block mb-1">Catatan Tambahan:</strong>
                    {selectedPackage.notes.map((note, idx) => (
                      <div key={idx}>• {note}</div>
                    ))}
                  </div>
                )}

                {/* Primary CTA: "Minta Penawaran" ONLY */}
                <div className="pt-4 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-neutral-500">
                    Konsultasikan jadwal & penyesuaian khusus dengan tim Event Specialist kami.
                  </div>
                  <button
                    onClick={() => {
                      setIsQuotationModalOpen(true);
                      setQuotationSuccess(null);
                    }}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-sm shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-emerald-300" />
                    <span>Minta Penawaran</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Request Quotation Modal */}
      <AnimatePresence>
        {isQuotationModalOpen && selectedPackage && (
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
                        setSelectedPackage(null);
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
                        {selectedPackage.name}
                      </h3>
                      <div className="text-xs text-neutral-500">
                        Durasi: {selectedPackage.duration} • ID: {selectedPackage.id}
                      </div>
                    </div>
                    <button
                      onClick={() => setIsQuotationModalOpen(false)}
                      className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
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
        )}
      </AnimatePresence>

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

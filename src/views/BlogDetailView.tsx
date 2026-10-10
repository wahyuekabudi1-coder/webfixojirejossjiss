import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../AppContext';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Calendar, 
  Share2, 
  Check, 
  ChevronRight, 
  Compass, 
  Sparkles, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  Car, 
  Camera, 
  AlertCircle,
  ExternalLink,
  MessageCircle,
  FileText,
  List
} from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import { BLOG_POSTS, BlogPost, FAQItem } from '../blogData';
import { Tour } from '../types';

interface BlogDetailViewProps {
  slug: string;
  onBack: () => void;
}

export default function BlogDetailView({ slug, onBack }: BlogDetailViewProps) {
  const { tours, setPage, setSearchParams, setActiveArticle } = useApp();

  // Pre-seed initial article state from static catalog if available for immediate hydration
  const initialArticleMatch = useMemo(() => {
    return BLOG_POSTS.find(p => p.slug === slug || (p as any).id === slug) || null;
  }, [slug]);

  const [article, setArticle] = useState<BlogPost | null>(initialArticleMatch);
  const [isLoading, setIsLoading] = useState<boolean>(!initialArticleMatch);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [openFaqIndices, setOpenFaqIndices] = useState<Record<number, boolean>>({ 0: true });

  // Fetch article detail by slug from /api/articles/:slug
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    const loadArticle = async () => {
      try {
        const cleanSlug = encodeURIComponent(slug.trim());
        const res = await fetch(`/api/articles/${cleanSlug}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            // Verify published status
            if (data.status && data.status !== 'published') {
              setErrorMessage('Artikel ini sedang dalam status draft atau diarsipkan dan tidak dapat diakses secara publik.');
              setArticle(null);
              setActiveArticle(null);
            } else {
              setArticle(data);
              setActiveArticle(data as any);
            }
          }
          return;
        }

        if (res.status === 404) {
          // Check static fallback catalog if API is in-memory or initializing
          const staticMatch = BLOG_POSTS.find(p => p.slug === slug || (p as any).id === slug);
          if (staticMatch && isMounted) {
            setArticle(staticMatch);
            setActiveArticle(staticMatch as any);
            return;
          }

          if (isMounted) {
            setErrorMessage('Artikel yang Anda cari tidak ditemukan atau telah dipindahkan.');
            setArticle(null);
            setActiveArticle(null);
          }
          return;
        }

        throw new Error(`Server returned HTTP ${res.status}`);
      } catch (err: any) {
        // Fallback to static catalog before giving up
        const staticMatch = BLOG_POSTS.find(p => p.slug === slug || (p as any).id === slug);
        if (staticMatch && isMounted) {
          setArticle(staticMatch);
          setActiveArticle(staticMatch as any);
          return;
        }

        if (isMounted) {
          setErrorMessage('Gagal memuat artikel dari server. Periksa koneksi internet Anda.');
          setArticle(null);
          setActiveArticle(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadArticle();

    return () => {
      isMounted = false;
      setActiveArticle(null);
    };
  }, [slug, setActiveArticle]);

  // Scroll to top on slug change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [slug]);

  // Handle Share functionality
  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : `https://smartjourney.id/blog/${slug}/`;
    const title = article ? article.title : 'Panduan Wisata Smart Journey';

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text: article?.excerpt || title,
          url
        });
        return;
      } catch (e) {
        // User cancelled or unsupported
      }
    }

    // Fallback: Copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback alert
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleWhatsAppShare = () => {
    const url = typeof window !== 'undefined' ? window.location.href : `https://smartjourney.id/blog/${slug}/`;
    const text = encodeURIComponent(`Baca panduan wisata ini di Smart Journey: ${article?.title || ''}\n${url}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const toggleFaq = (idx: number) => {
    setOpenFaqIndices(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Find relevant tour packages based on article destination or keywords
  const relevantTours = useMemo(() => {
    if (!article || !Array.isArray(tours) || tours.length === 0) return [];
    const dest = (article.destination || '').toLowerCase();
    const title = (article.title || '').toLowerCase();

    const matches = tours.filter((t: Tour) => {
      const tourName = (t.name || '').toLowerCase();
      const tourCat = (t.category || '').toLowerCase();
      const tourDesc = (t.description || '').toLowerCase();

      if (dest.includes('bromo') || title.includes('bromo')) {
        return tourName.includes('bromo') || tourDesc.includes('bromo');
      }
      if (dest.includes('ijen') || title.includes('ijen')) {
        return tourName.includes('ijen') || tourDesc.includes('ijen');
      }
      if (dest.includes('tumpak') || title.includes('tumpak')) {
        return tourName.includes('tumpak') || tourName.includes('malang');
      }
      if (dest.includes('bali') || dest.includes('ubud') || dest.includes('penida') || dest.includes('uluwatu')) {
        return tourName.includes('bali') || tourName.includes('nusa') || tourName.includes('penida');
      }
      if (dest.includes('malang') || dest.includes('batu')) {
        return tourName.includes('malang') || tourName.includes('batu') || tourName.includes('bromo');
      }
      if (dest.includes('banyuwangi')) {
        return tourName.includes('banyuwangi') || tourName.includes('ijen');
      }

      return tourCat.includes('adventure') || tourCat.includes('nature');
    });

    // Return at most 3 relevant tours, or slice top 3 if none specific
    if (matches.length > 0) {
      return matches.slice(0, 3);
    }
    return tours.slice(0, 3);
  }, [article, tours]);

  // Navigate directly to tour detail or catalog
  const handleSelectTour = (tour: Tour) => {
    setSearchParams((prev: any) => ({ ...prev, selectedTourId: tour.id }));
    setPage('tours');
  };

  // Build Table of Contents items dynamically based on non-empty sections
  const tableOfContents = useMemo(() => {
    if (!article) return [];
    const list: { id: string; title: string }[] = [];

    if (article.introduction) list.push({ id: 'introduction', title: 'Pengenalan & Gambaran Umum' });
    if (article.history) list.push({ id: 'history', title: 'Sejarah & Latar Belakang' });
    if (article.whyVisit) list.push({ id: 'why-visit', title: 'Mengapa Wajib Berkunjung' });
    if (article.bestTimeToVisit) list.push({ id: 'best-time', title: 'Waktu Terbaik Berkunjung' });
    if (article.topAttractions) list.push({ id: 'top-attractions', title: 'Daya Tarik Utama' });
    if (article.bestActivities) list.push({ id: 'best-activities', title: 'Aktivitas yang Direkomendasikan' });
    if (article.travelTips) list.push({ id: 'travel-tips', title: 'Tips Perjalanan & Persiapan' });
    if (article.transportation) list.push({ id: 'transportation', title: 'Rute & Akses Transportasi' });
    if (article.suggestedItinerary) list.push({ id: 'itinerary', title: 'Rekomendasi Rencana Perjalanan' });
    if (Array.isArray(article.gallery) && article.gallery.length > 0) list.push({ id: 'gallery', title: 'Galeri Foto Destinasi' });
    if (Array.isArray(article.faq) && article.faq.length > 0) list.push({ id: 'faq', title: 'Tanya Jawab (FAQ)' });
    if (article.conclusion) list.push({ id: 'conclusion', title: 'Kesimpulan' });

    return list;
  }, [article]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="w-full bg-[#F8FAF9] min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8 animate-pulse">
          <div className="h-4 bg-neutral-200 rounded w-1/4" />
          <div className="h-10 bg-neutral-200 rounded w-3/4" />
          <div className="h-5 bg-neutral-200 rounded w-1/2" />
          <div className="aspect-[16/9] bg-neutral-200 rounded-3xl" />
          <div className="space-y-4 pt-6">
            <div className="h-4 bg-neutral-200 rounded w-full" />
            <div className="h-4 bg-neutral-200 rounded w-5/6" />
            <div className="h-4 bg-neutral-200 rounded w-4/6" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Error / Not Found State (404)
  if (errorMessage || !article) {
    return (
      <div className="w-full bg-[#F8FAF9] min-h-[70vh] flex items-center justify-center py-16 px-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-neutral-200 p-8 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>
          
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">
            Panduan Tidak Ditemukan
          </h1>
          
          <p className="text-sm text-neutral-600 leading-relaxed">
            {errorMessage || 'Artikel yang Anda cari tidak tersedia, belum dipublikasikan, atau tautan telah diubah.'}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 bg-[#315B4F] text-white text-sm font-semibold rounded-xl hover:bg-[#27483f] transition-colors cursor-pointer"
            >
              Kembali ke Katalog Blog
            </button>
            <button
              type="button"
              onClick={() => setPage('home')}
              className="px-5 py-2.5 bg-neutral-100 text-neutral-700 text-sm font-semibold rounded-xl hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Render Published Article Detail
  return (
    <div className="w-full bg-[#F8FAF9] text-neutral-900 min-h-screen pb-20">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs
        items={[
          { label: 'Blog', page: 'blog', action: onBack },
          { label: article.title }
        ]}
      />

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        {/* Top Navigation Back Action */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-600 hover:text-[#315B4F] transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Kembali ke Semua Panduan Wisata</span>
          </button>

          {/* Social Share Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-700 transition-colors cursor-pointer"
              aria-label="Bagikan artikel ini"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Link Disalin!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Bagikan</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold transition-colors cursor-pointer"
              aria-label="Bagikan via WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Article Header */}
        <header className="space-y-4 mb-8">
          {/* Metadata Line */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 font-medium">
            {article.destination && (
              <span className="flex items-center gap-1 text-[#315B4F] font-semibold">
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                {article.destination}
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span>{article.category || 'Panduan Wisata'}</span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              {article.readTime || '5 min baca'}
            </span>
            {article.date && (
              <>
                <span aria-hidden="true">·</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                  {article.date}
                </span>
              </>
            )}
          </div>

          {/* Primary H1 */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-neutral-900 tracking-tight leading-tight">
            {article.title}
          </h1>

          {/* Author Byline */}
          <div className="text-xs sm:text-sm text-neutral-600">
            Ditulis oleh <strong className="font-semibold text-neutral-800">{article.author || 'Tim Editorial Smart Journey'}</strong>
          </div>
        </header>

        {/* Featured Hero Image */}
        <div className="mb-10 rounded-3xl overflow-hidden border border-neutral-200 bg-neutral-100 shadow-xs">
          <img
            src={article.image || '/bromo.png'}
            alt={article.featuredImageAltText || article.title}
            className="w-full aspect-[16/9] object-cover"
          />
          {article.destination && (
            <div className="p-3 bg-neutral-50 text-[11px] text-neutral-500 border-t border-neutral-200 flex items-center justify-between">
              <span>Destinasi: {article.destination}</span>
              <span>Dokumentasi Resmi Smart Journey</span>
            </div>
          )}
        </div>

        {/* Table of Contents (Daftar Isi) */}
        {tableOfContents.length > 3 && (
          <nav aria-label="Daftar Isi Artikel" className="mb-10 p-6 bg-white border border-neutral-200 rounded-3xl shadow-xs">
            <div className="flex items-center gap-2 mb-3 text-sm font-bold text-neutral-900">
              <List className="w-4 h-4 text-[#315B4F]" />
              <span>Daftar Isi Panduan</span>
            </div>
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {tableOfContents.map((item, idx) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className="text-left text-neutral-600 hover:text-[#315B4F] hover:underline font-medium flex items-start gap-1.5 transition-colors cursor-pointer w-full py-0.5"
                  >
                    <span className="text-neutral-400 font-mono text-[11px] shrink-0">{idx + 1}.</span>
                    <span className="truncate">{item.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Detailed Editorial Content Sections */}
        <div className="space-y-10 text-neutral-800 leading-relaxed text-base sm:text-lg">
          {/* Introduction */}
          {article.introduction && (
            <section id="introduction" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2">
                Pengenalan & Gambaran Umum
              </h2>
              <p className="text-neutral-700 whitespace-pre-line leading-relaxed">
                {article.introduction}
              </p>
            </section>
          )}

          {/* History */}
          {article.history && (
            <section id="history" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2">
                Sejarah & Latar Belakang
              </h2>
              <p className="text-neutral-700 whitespace-pre-line leading-relaxed">
                {article.history}
              </p>
            </section>
          )}

          {/* Why Visit */}
          {article.whyVisit && (
            <section id="why-visit" className="scroll-mt-24 space-y-4 bg-emerald-50/60 p-6 sm:p-8 rounded-3xl border border-emerald-100">
              <h2 className="text-xl sm:text-2xl font-bold text-emerald-950 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                <span>Mengapa Destinasi Ini Wajib Masuk Bucket List Anda</span>
              </h2>
              <p className="text-emerald-900/90 whitespace-pre-line leading-relaxed text-base">
                {article.whyVisit}
              </p>
            </section>
          )}

          {/* Best Time to Visit & Weather */}
          {(article.bestTimeToVisit || article.weather) && (
            <section id="best-time" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2">
                Waktu Terbaik Berkunjung & Informasi Cuaca
              </h2>
              {article.bestTimeToVisit && (
                <div className="space-y-2">
                  <h3 className="text-base font-bold text-neutral-800">Musim & Jam Terbaik:</h3>
                  <p className="text-neutral-700 whitespace-pre-line leading-relaxed">
                    {article.bestTimeToVisit}
                  </p>
                </div>
              )}
              {article.weather && (
                <div className="space-y-2 pt-2">
                  <h3 className="text-base font-bold text-neutral-800">Kondisi Suhu & Cuaca:</h3>
                  <p className="text-neutral-700 whitespace-pre-line leading-relaxed">
                    {article.weather}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Top Attractions & Activities */}
          {(article.topAttractions || article.bestActivities) && (
            <section id="top-attractions" className="scroll-mt-24 space-y-6">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2">
                Daya Tarik Utama & Aktivitas Unggulan
              </h2>
              {article.topAttractions && (
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-neutral-800">Spot & Tempat Wisata Populer:</h3>
                  <p className="text-neutral-700 whitespace-pre-line leading-relaxed">
                    {article.topAttractions}
                  </p>
                </div>
              )}
              {article.bestActivities && (
                <div id="best-activities" className="space-y-2 pt-2 scroll-mt-24">
                  <h3 className="text-lg font-bold text-neutral-800">Aktivitas Seru yang Tidak Boleh Terlewat:</h3>
                  <p className="text-neutral-700 whitespace-pre-line leading-relaxed">
                    {article.bestActivities}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Travel Tips */}
          {article.travelTips && (
            <section id="travel-tips" className="scroll-mt-24 space-y-4 bg-amber-50/70 p-6 sm:p-8 rounded-3xl border border-amber-200/80">
              <h2 className="text-xl sm:text-2xl font-bold text-amber-950 flex items-center gap-2">
                <Info className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Tips Perjalanan & Persiapan Penting</span>
              </h2>
              <p className="text-amber-900/90 whitespace-pre-line leading-relaxed text-base">
                {article.travelTips}
              </p>
            </section>
          )}

          {/* Transportation */}
          {article.transportation && (
            <section id="transportation" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2 flex items-center gap-2">
                <Car className="w-5 h-5 text-[#315B4F]" />
                <span>Rute & Akses Transportasi Menuju Lokasi</span>
              </h2>
              <p className="text-neutral-700 whitespace-pre-line leading-relaxed">
                {article.transportation}
              </p>
            </section>
          )}

          {/* Suggested Itinerary */}
          {article.suggestedItinerary && (
            <section id="itinerary" className="scroll-mt-24 space-y-4 bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-xs">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#315B4F]" />
                <span>Rekomendasi Rencana Perjalanan (Itinerary)</span>
              </h2>
              <div className="text-neutral-700 whitespace-pre-line leading-relaxed text-base pt-2">
                {article.suggestedItinerary}
              </div>
            </section>
          )}

          {/* Local Culture & Food */}
          {(article.localCulture || article.foodToTry) && (
            <section className="space-y-6">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2">
                Budaya Lokal & Kuliner Khas
              </h2>
              {article.localCulture && (
                <div className="space-y-2">
                  <h3 className="text-base font-bold text-neutral-800">Kearifan & Adat Budaya Setempat:</h3>
                  <p className="text-neutral-700 whitespace-pre-line leading-relaxed">
                    {article.localCulture}
                  </p>
                </div>
              )}
              {article.foodToTry && (
                <div className="space-y-2 pt-2">
                  <h3 className="text-base font-bold text-neutral-800">Kuliner yang Wajib Dicicipi:</h3>
                  <p className="text-neutral-700 whitespace-pre-line leading-relaxed">
                    {article.foodToTry}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Photo Gallery Grid */}
          {Array.isArray(article.gallery) && article.gallery.length > 0 && (
            <section id="gallery" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2 flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#315B4F]" />
                <span>Galeri Destinasi</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                {article.gallery.map((imgPrompt, idx) => (
                  <div key={idx} className="relative aspect-video rounded-2xl overflow-hidden bg-neutral-200 group">
                    <img
                      src={article.image || '/bromo.png'}
                      alt={`${article.title} dokumentasi foto ${idx + 1}`}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
                      <span className="text-[10px] text-white font-medium truncate">{imgPrompt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Frequently Asked Questions (FAQ) */}
          {Array.isArray(article.faq) && article.faq.length > 0 && (
            <section id="faq" className="scroll-mt-24 space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-600" />
                <span>Pertanyaan yang Sering Diajukan (FAQ)</span>
              </h2>

              <div className="space-y-3 pt-2">
                {article.faq.map((item: FAQItem, idx: number) => {
                  const isOpen = Boolean(openFaqIndices[idx]);
                  return (
                    <div
                      key={idx}
                      className="bg-white border border-neutral-200 rounded-2xl overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => toggleFaq(idx)}
                        className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-neutral-900 hover:text-[#315B4F] transition-colors cursor-pointer"
                        aria-expanded={isOpen}
                      >
                        <span>{item.question}</span>
                        {isOpen ? (
                          <ChevronUp className="w-5 h-5 text-neutral-400 shrink-0" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-neutral-400 shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <div className="px-4 sm:px-5 pb-5 pt-1 text-sm text-neutral-600 leading-relaxed border-t border-neutral-100 bg-neutral-50/50">
                          {item.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Conclusion & Editorial Signoff */}
          {(article.conclusion || article.callToAction) && (
            <section id="conclusion" className="scroll-mt-24 space-y-4 pt-6 border-t border-neutral-200">
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900">
                Kesimpulan
              </h2>
              {article.conclusion && (
                <p className="text-neutral-700 whitespace-pre-line leading-relaxed">
                  {article.conclusion}
                </p>
              )}
              {article.callToAction && (
                <div className="p-6 bg-emerald-50/80 border border-emerald-200 rounded-2xl text-emerald-950 text-base font-medium">
                  {article.callToAction}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Commercial Cross-Selling Section: Relevant Tours */}
        {relevantTours.length > 0 && (
          <aside aria-label="Rekomendasi Paket Wisata Terkait" className="mt-16 pt-10 border-t border-neutral-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="text-xs font-bold text-amber-600 uppercase tracking-wider font-mono flex items-center gap-1.5 mb-1">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Rekomendasi Paket Wisata</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-neutral-900">
                  Jelajahi {article.destination || 'Destinasi Ini'} Bersama Smart Journey
                </h2>
              </div>
              
              <button
                type="button"
                onClick={() => setPage('tours')}
                className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-[#315B4F] hover:text-amber-600 transition-colors cursor-pointer"
              >
                <span>Lihat Semua Paket</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {relevantTours.map((tour: Tour) => (
                <div
                  key={tour.id}
                  className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div>
                    <div className="aspect-[16/10] bg-neutral-200 relative overflow-hidden">
                      <img
                        src={tour.image || '/bromo.png'}
                        alt={tour.name}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {tour.duration && (
                        <div className="absolute bottom-2.5 left-2.5 text-[11px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-xs">
                          {tour.duration}
                        </div>
                      )}
                    </div>

                    <div className="p-4 space-y-2">
                      <h3 className="font-bold text-sm text-neutral-900 group-hover:text-[#315B4F] transition-colors line-clamp-2">
                        {tour.name}
                      </h3>
                      
                      <div className="text-xs text-neutral-500">
                        Mulai dari <strong className="text-amber-600 font-extrabold">IDR {(tour.startingPriceIDR || 0).toLocaleString('id-ID')}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-0">
                    <button
                      type="button"
                      onClick={() => handleSelectTour(tour)}
                      className="w-full py-2 bg-[#315B4F] hover:bg-[#27483f] active:scale-95 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer text-center"
                    >
                      Pilih Paket Tur
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Action Bottom Bar */}
        <footer className="mt-14 pt-8 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Daftar Panduan (/blog/)</span>
          </button>

          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={() => setPage('car-rental')}
              className="w-full sm:w-auto px-5 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            >
              Rental Mobil & Supir
            </button>
            <button
              type="button"
              onClick={() => setPage('tours')}
              className="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 font-bold rounded-xl text-sm transition-all cursor-pointer shadow-xs"
            >
              Lihat Seluruh Paket Tur
            </button>
          </div>
        </footer>
      </article>
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../AppContext';
import { 
  Search, 
  MapPin, 
  Clock, 
  Calendar, 
  ArrowRight, 
  Sparkles, 
  Compass, 
  RefreshCw,
  X,
  BookOpen
} from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';
import { BLOG_POSTS, BlogPost } from '../blogData';

interface BlogViewProps {
  onSelectArticle: (slug: string) => void;
}

export default function BlogView({ onSelectArticle }: BlogViewProps) {
  const { setPage, setActiveArticle } = useApp();

  const [articles, setArticles] = useState<BlogPost[]>(() => BLOG_POSTS || []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !BLOG_POSTS || BLOG_POSTS.length === 0);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDestination, setSelectedDestination] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const articlesPerPage = 9;

  // Fetch published articles from /api/articles
  const fetchArticles = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/articles');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setArticles(data);
          return;
        }
      }
      // Resilient fallback if database or API is temporarily initializing
      setArticles(BLOG_POSTS);
    } catch (err: any) {
      console.warn('[BlogView] Failed to fetch from /api/articles, falling back to static catalog:', err.message);
      setArticles(BLOG_POSTS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setActiveArticle(null);
    fetchArticles();
  }, [setActiveArticle]);

  // Compute unique destinations and categories from actual loaded articles
  const destinations = useMemo(() => {
    const set = new Set<string>();
    articles.forEach(a => {
      if (a.destination) set.add(a.destination.trim());
    });
    return ['All', ...Array.from(set).sort()];
  }, [articles]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    articles.forEach(a => {
      if (a.category) set.add(a.category.trim());
    });
    return ['All', ...Array.from(set).sort()];
  }, [articles]);

  // Filter articles based on search query, destination, and category
  const filteredArticles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return articles.filter(article => {
      const matchesDest = selectedDestination === 'All' || 
        article.destination?.toLowerCase() === selectedDestination.toLowerCase();
      
      const matchesCat = selectedCategory === 'All' || 
        article.category?.toLowerCase() === selectedCategory.toLowerCase();

      if (!matchesDest || !matchesCat) return false;

      if (!q) return true;

      const titleMatch = article.title?.toLowerCase().includes(q);
      const excerptMatch = article.excerpt?.toLowerCase().includes(q);
      const destMatch = article.destination?.toLowerCase().includes(q);
      const catMatch = article.category?.toLowerCase().includes(q);
      const keywordsMatch = Array.isArray(article.keywords) && 
        article.keywords.some(k => k.toLowerCase().includes(q));

      return titleMatch || excerptMatch || destMatch || catMatch || keywordsMatch;
    });
  }, [articles, searchQuery, selectedDestination, selectedCategory]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDestination, selectedCategory]);

  // Paginated slice
  const totalPages = Math.ceil(filteredArticles.length / articlesPerPage) || 1;
  const currentArticles = useMemo(() => {
    const start = (currentPage - 1) * articlesPerPage;
    return filteredArticles.slice(start, start + articlesPerPage);
  }, [filteredArticles, currentPage, articlesPerPage]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedDestination('All');
    setSelectedCategory('All');
  };

  return (
    <div className="w-full bg-[#F8FAF9] text-neutral-900 min-h-screen pb-20">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs items={[{ label: 'Blog & Panduan Wisata' }]} />

      {/* Hero Header Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#315B4F]/10 via-[#315B4F]/5 to-transparent pt-10 pb-16 px-4 sm:px-6 lg:px-8 border-b border-neutral-200/60">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#315B4F] tracking-wider uppercase font-mono">
            <Compass className="w-4 h-4 text-amber-600" aria-hidden="true" />
            <span>Smart Journey Travel Journal</span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-tight">
            Panduan Wisata & Inspirasi Perjalanan
          </h1>
          
          <p className="text-base sm:text-lg text-neutral-600 max-w-2xl mx-auto leading-relaxed">
            Eksplorasi mendalam rute terbaik Gunung Bromo, keajaiban Api Biru Kawah Ijen, eksotisme Bali, air terjun Tumpak Sewu, hingga tips sewa mobil dan transportasi resmi di Jawa Timur.
          </p>

          {/* Quick Search Bar */}
          <div className="pt-4 max-w-xl mx-auto">
            <div className="relative flex items-center">
              <Search className="absolute left-4 w-5 h-5 text-neutral-400 pointer-events-none" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari panduan wisata, destinasi, atau rute..."
                aria-label="Cari panduan wisata"
                className="w-full pl-12 pr-10 py-3.5 bg-white border border-neutral-300 rounded-2xl shadow-xs text-sm sm:text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#315B4F] focus:border-transparent transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Bersihkan pencarian"
                  className="absolute right-3 p-1.5 text-neutral-400 hover:text-neutral-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Interactive Filters Bar */}
        <section aria-label="Filter Artikel" className="mb-8 space-y-4">
          {/* Destination Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-neutral-200">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider whitespace-nowrap font-mono mr-1">
                Destinasi:
              </span>
              {destinations.map((dest) => (
                <button
                  key={dest}
                  type="button"
                  onClick={() => setSelectedDestination(dest)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    selectedDestination === dest
                      ? 'bg-[#315B4F] text-white shadow-xs'
                      : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200'
                  }`}
                >
                  {dest === 'All' ? 'Semua Destinasi' : dest}
                </button>
              ))}
            </div>

            {/* Total Results Count */}
            <div className="text-xs text-neutral-500 font-medium whitespace-nowrap">
              Menampilkan <span className="font-bold text-neutral-900">{filteredArticles.length}</span> panduan
            </div>
          </div>

          {/* Category Filter Tabs */}
          {categories.length > 2 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
              <span className="font-bold text-neutral-500 uppercase tracking-wider whitespace-nowrap font-mono mr-1">
                Kategori:
              </span>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                  }`}
                >
                  {cat === 'All' ? 'Semua Kategori' : cat}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Loading Skeletons State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white rounded-3xl border border-neutral-200 overflow-hidden shadow-xs animate-pulse flex flex-col justify-between">
                <div className="aspect-[16/10] bg-neutral-200" />
                <div className="p-6 space-y-4">
                  <div className="h-4 bg-neutral-200 rounded w-1/3" />
                  <div className="h-6 bg-neutral-200 rounded w-4/5" />
                  <div className="h-4 bg-neutral-200 rounded w-full" />
                  <div className="h-4 bg-neutral-200 rounded w-2/3" />
                </div>
                <div className="p-6 pt-0 border-t border-neutral-100 mt-4">
                  <div className="h-4 bg-neutral-200 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && loadError && (
          <div className="py-16 text-center max-w-lg mx-auto bg-white border border-red-200 rounded-3xl p-8 shadow-xs">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Gagal Memuat Artikel</h3>
            <p className="text-sm text-neutral-600 mb-6">{loadError}</p>
            <button
              type="button"
              onClick={fetchArticles}
              className="px-5 py-2.5 bg-[#315B4F] text-white text-sm font-semibold rounded-xl hover:bg-[#28493f] transition-colors"
            >
              Coba Muat Ulang
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !loadError && filteredArticles.length === 0 && (
          <div className="py-20 text-center max-w-lg mx-auto bg-white border border-neutral-200 rounded-3xl p-8 shadow-xs">
            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 mb-2">Tidak Menemukan Artikel</h3>
            <p className="text-sm text-neutral-600 mb-6">
              Tidak ada panduan wisata yang cocok dengan kata kunci atau filter yang Anda pilih. Coba gunakan kata kunci lain atau reset filter.
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-5 py-2.5 bg-[#315B4F] text-white text-sm font-semibold rounded-xl hover:bg-[#28493f] transition-colors cursor-pointer"
            >
              Reset Semua Filter
            </button>
          </div>
        )}

        {/* Articles Grid Catalog */}
        {!isLoading && !loadError && filteredArticles.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {currentArticles.map((article) => {
              const articleHref = `/blog/${encodeURIComponent(article.slug)}/`;
              return (
                <article
                  key={article.id || article.slug}
                  className="bg-white border border-neutral-200/90 rounded-3xl overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between group hover:border-[#315B4F]/40"
                >
                  <div>
                    {/* Featured Image Link */}
                    <a
                      href={articleHref}
                      onClick={(e) => {
                        e.preventDefault();
                        onSelectArticle(article.slug);
                      }}
                      className="block relative aspect-[16/10] overflow-hidden bg-neutral-100 cursor-pointer"
                      tabIndex={-1}
                    >
                      <img
                        src={article.image || '/bromo.png'}
                        alt={article.featuredImageAltText || article.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                      
                      {/* Destination Label */}
                      {article.destination && (
                        <div className="absolute bottom-3 left-3 text-xs font-semibold text-white flex items-center gap-1.5 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-lg">
                          <MapPin className="h-3.5 w-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                          <span>{article.destination}</span>
                        </div>
                      )}
                    </a>

                    {/* Metadata & Headline */}
                    <div className="p-6 space-y-3">
                      {/* Zero-Pill Metadata Line */}
                      <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
                        <span>{article.category || 'Panduan Wisata'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-neutral-400" aria-hidden="true" />
                          {article.readTime || '5 min baca'}
                        </span>
                        {article.date && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{article.date}</span>
                          </>
                        )}
                      </div>

                      {/* Main Title Anchor */}
                      <h2 className="text-lg sm:text-xl font-bold text-neutral-900 group-hover:text-[#315B4F] transition-colors leading-snug line-clamp-2">
                        <a
                          href={articleHref}
                          onClick={(e) => {
                            e.preventDefault();
                            onSelectArticle(article.slug);
                          }}
                          className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315B4F] rounded-xs"
                        >
                          {article.title}
                        </a>
                      </h2>

                      {/* Excerpt */}
                      <p className="text-sm text-neutral-600 leading-relaxed line-clamp-3">
                        {article.excerpt}
                      </p>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="px-6 pb-6 pt-2 border-t border-neutral-100 flex items-center justify-between mt-auto">
                    <span className="text-xs text-neutral-500">
                      Oleh <strong className="font-semibold text-neutral-700">{article.author || 'Tim Smart Journey'}</strong>
                    </span>

                    <a
                      href={articleHref}
                      onClick={(e) => {
                        e.preventDefault();
                        onSelectArticle(article.slug);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#315B4F] group-hover:text-amber-600 transition-colors"
                      aria-label={`Baca panduan lengkap: ${article.title}`}
                    >
                      <span>Baca Lengkap</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {!isLoading && totalPages > 1 && (
          <nav aria-label="Navigasi Halaman Blog" className="mt-12 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => {
                setCurrentPage(p => Math.max(1, p - 1));
                window.scrollTo({ top: 400, behavior: 'smooth' });
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-neutral-300 bg-white text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors"
            >
              Sebelumnya
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => {
                    setCurrentPage(pageNum);
                    window.scrollTo({ top: 400, behavior: 'smooth' });
                  }}
                  className={`w-9 h-9 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-[#315B4F] text-white shadow-xs'
                      : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200'
                  }`}
                  aria-current={currentPage === pageNum ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => {
                setCurrentPage(p => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 400, behavior: 'smooth' });
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-neutral-300 bg-white text-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-50 transition-colors"
            >
              Berikutnya
            </button>
          </nav>
        )}

        {/* Commercial Banner Cross-Sell */}
        <section className="mt-16 bg-gradient-to-r from-[#315B4F] to-[#26443c] rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-400 to-transparent pointer-events-none" />
          
          <div className="max-w-2xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">
              <Sparkles className="w-4 h-4" />
              <span>Paket Wisata & Transportasi Resmi</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Siap Menjelajahi Destinasi Impian Bersama Smart Journey?
            </h2>
            
            <p className="text-sm sm:text-base text-neutral-200 leading-relaxed">
              Dapatkan pengalaman liburan nyaman tanpa repot dengan armada terawat, driver profesional berpengalaman, dan paket tur private fleksibel sesuai jadwal Anda.
            </p>

            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setPage('tours')}
                className="px-5 py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-neutral-950 font-bold rounded-xl text-sm transition-all cursor-pointer shadow-md"
              >
                Jelajahi Paket Wisata
              </button>
              <button
                type="button"
                onClick={() => setPage('car-rental')}
                className="px-5 py-3 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer border border-white/20"
              >
                Rental Mobil Lepas Kunci / Driver
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

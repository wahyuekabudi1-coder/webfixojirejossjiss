import React from 'react';
import { useApp } from '../../AppContext';
import { BookOpen, Compass, ArrowLeft, ArrowRight, ShieldCheck, MapPin, Sparkles, Car, Calendar, ExternalLink } from 'lucide-react';

interface BlogPlaceholderProps {
  onSelectArticle: (slug: string) => void;
}

interface BlogDetailPlaceholderProps {
  slug: string;
  onBack: () => void;
}

// Sample articles to test slug-based routing
const SAMPLE_ARTICLES = [
  {
    slug: 'mount-bromo-travel-guide',
    title: 'Panduan Lengkap Wisata Gunung Bromo 2026: Rute, Tiket, Jeep & Tips Sunrise',
    category: 'Panduan Wisata',
    readTime: '6 min baca',
    description: 'Panduan terlengkap menjelajahi kawah Bromo, sunrise Penanjakan, Bukit Kingkong, Pasir Berbisik, dan sewa Jeep 4x4 resmi.'
  },
  {
    slug: 'tips-sewa-mobil-malang-bromo',
    title: 'Tips Memilih Rental Mobil Malang ke Bromo: Lepas Kunci vs dengan Driver',
    category: 'Transportasi',
    readTime: '4 min baca',
    description: 'Ketahui kelebihan rental mobil dengan driver lokal berpengalaman dibanding lepas kunci untuk rute tanjakan ekstrem pegunungan Tengger.'
  },
  {
    slug: 'kawah-ijen-blue-fire-guide',
    title: 'Eksplorasi Api Biru Kawah Ijen: Waktu Terbaik, Masker Gas & Persiapan Fisik',
    category: 'Petualangan',
    readTime: '5 min baca',
    description: 'Fenomena langka blue fire di dunia, tips mendaki tengah malam dari Paltuding, dan rekomendasi pemandu lokal bersertifikat.'
  }
];

export const BlogPlaceholder: React.FC<BlogPlaceholderProps> = ({ onSelectArticle }) => {
  const { setPage } = useApp();
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/blog/';

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Route Status Badge */}
      <div className="mb-8 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase font-extrabold tracking-wider text-emerald-800">
              Fondasi Routing Pathname SEO Aktif
            </div>
            <div className="text-sm text-emerald-950 font-medium">
              Mode: <span className="font-bold">Blog Index</span> | URL Browser: <code className="bg-white/80 px-2 py-0.5 rounded text-emerald-900 font-mono text-xs font-semibold">{currentPath}</code>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-white px-3 py-1.5 rounded-full border border-emerald-100 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Trailing Slash Normalized: <code className="font-mono">/blog/</code>
        </div>
      </div>

      {/* Hero Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100/80 text-amber-900 text-xs font-semibold mb-4 border border-amber-200">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          Smart Journey Travel Journal & Blog
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight mb-4">
          Inspirasi & Panduan Wisata Indonesia
        </h1>
        <p className="text-base sm:text-lg text-neutral-600 leading-relaxed">
          Temukan tips eksklusif, rute terbaik Gunung Bromo, Kawah Ijen, hingga sewa mobil dan airport transfer terpercaya dari Smart Journey.
        </p>
      </div>

      {/* Interactive Article Link Verification Cards */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" />
            Artikel Rekomendasi (Uji Routing Bersih)
          </h2>
          <span className="text-xs text-neutral-500">Klik untuk verifikasi navigasi /blog/:slug/</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SAMPLE_ARTICLES.map((article) => (
            <div
              key={article.slug}
              className="bg-white border border-neutral-200/80 rounded-2xl p-6 shadow-xs hover:shadow-md transition-all hover:border-amber-300 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-neutral-500 mb-3">
                  <span className="bg-neutral-100 text-neutral-800 font-semibold px-2.5 py-0.5 rounded-full">
                    {article.category}
                  </span>
                  <span>{article.readTime}</span>
                </div>
                <h3 className="font-bold text-lg text-neutral-900 group-hover:text-amber-600 transition-colors mb-2 line-clamp-2">
                  {article.title}
                </h3>
                <p className="text-sm text-neutral-600 mb-4 line-clamp-3 leading-relaxed">
                  {article.description}
                </p>
              </div>

              <div className="pt-4 border-t border-neutral-100 mt-2">
                <div className="text-xs font-mono text-neutral-400 mb-3 truncate">
                  /blog/{article.slug}/
                </div>
                <button
                  type="button"
                  onClick={() => onSelectArticle(article.slug)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer group-hover:bg-amber-600"
                >
                  Baca Selengkapnya
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cross-Routing Verification Controls */}
      <div className="p-6 bg-neutral-100/70 border border-neutral-200 rounded-2xl mb-8">
        <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-700 mb-3">
          Uji Navigasi Silang (Transisi Hash vs Pathname)
        </h3>
        <p className="text-xs text-neutral-600 mb-4">
          Pastikan transisi dari URL pathname (<code className="font-mono">/blog/</code>) ke route hash lama (<code className="font-mono">#/tours</code>, <code className="font-mono">#/car-rental</code>) berjalan mulus tanpa konflik history browser.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setPage('tours')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-amber-600" />
            Paket Wisata (#/tours)
          </button>
          <button
            type="button"
            onClick={() => setPage('car-rental')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            <Car className="w-3.5 h-3.5 text-blue-600" />
            Rental Mobil (#/car-rental)
          </button>
          <button
            type="button"
            onClick={() => setPage('about')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Tentang Kami (#/about)
          </button>
          <button
            type="button"
            onClick={() => setPage('home')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Kembali ke Beranda (#/home)
          </button>
        </div>
      </div>
    </div>
  );
};

export const BlogDetailPlaceholder: React.FC<BlogDetailPlaceholderProps> = ({ slug, onBack }) => {
  const { setPage } = useApp();
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : `/blog/${slug}/`;
  const article = SAMPLE_ARTICLES.find(a => a.slug === slug);
  const title = article ? article.title : slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
      {/* Back button */}
      <div className="mb-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-amber-600 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Indeks Blog (/blog/)
        </button>
      </div>

      {/* Route Status Badge */}
      <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase font-extrabold tracking-wider text-blue-800">
              Detail Artikel Pathname SEO Terdeteksi
            </div>
            <div className="text-sm text-blue-950 font-medium">
              Slug: <code className="bg-white/80 px-2 py-0.5 rounded text-blue-900 font-mono text-xs font-bold">{slug}</code>
            </div>
          </div>
        </div>
        <div className="text-xs font-mono text-blue-800 bg-white px-3 py-1.5 rounded-full border border-blue-100 shadow-xs">
          Path: {currentPath}
        </div>
      </div>

      {/* Article Detail Structured Preview */}
      <article className="bg-white border border-neutral-200 rounded-3xl p-6 sm:p-10 shadow-xs mb-10">
        <div className="flex items-center gap-2.5 text-xs text-neutral-500 mb-4">
          <span className="bg-amber-100 text-amber-800 font-bold px-3 py-1 rounded-full">
            {article?.category || 'Panduan Perjalanan'}
          </span>
          <span>•</span>
          <span>{article?.readTime || '5 min baca'}</span>
          <span>•</span>
          <span className="text-emerald-600 font-medium">Status: Published</span>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-neutral-900 leading-tight mb-6">
          {title}
        </h1>

        <div className="prose prose-neutral max-w-none text-neutral-700 leading-relaxed space-y-4">
          <p className="text-base sm:text-lg font-medium text-neutral-800 border-l-4 border-amber-500 pl-4 py-1 italic bg-amber-50/40 rounded-r-xl">
            {article?.description || 'Halaman detail artikel blog ini dimuat secara bersih menggunakan arsitektur URL canonical /blog/:slug/ tanpa fragment hash.'}
          </p>

          <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-200/80 my-6">
            <h3 className="text-sm font-bold text-neutral-900 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              Verifikasi State & Routing
            </h3>
            <ul className="text-xs text-neutral-600 space-y-1.5 list-disc list-inside">
              <li>URL Pathname: <code className="font-mono text-neutral-800 font-semibold">{currentPath}</code></li>
              <li>Parameter Slug: <code className="font-mono text-neutral-800 font-semibold">{slug}</code></li>
              <li>Trailing Slash: Dipertahankan secara konsisten untuk standarisasi SEO</li>
              <li>Browser Back/Forward: Didukung penuh via HTML5 History popstate listener</li>
            </ul>
          </div>
        </div>

        {/* Action Callouts */}
        <div className="mt-8 pt-6 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Ke Daftar Blog (/blog/)
          </button>

          <button
            type="button"
            onClick={() => setPage('tours')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold rounded-xl text-sm transition-colors cursor-pointer shadow-xs"
          >
            Lihat Paket Wisata Bromo
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </article>
    </div>
  );
};

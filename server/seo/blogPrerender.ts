// ==============================================================================
// SMART JOURNEY BLOG PRERENDERER (SERVER-SIDE HTML CONTENT DELIVERY)
// Renders clean, accessible, semantic HTML matching React frontend views.
// Ensures search engine bots receive full article & catalog content in raw HTML.
// ==============================================================================

import { BlogPost, FAQItem } from '../../src/blogData';
import { TourEntity } from '../db/repositories/tours.repository';
import { escapeHtml } from './blogSeo';

export interface RenderBlogIndexOptions {
  articles: BlogPost[];
  baseUrl: string;
}

export interface RenderBlogDetailOptions {
  article: BlogPost;
  relevantTours?: TourEntity[];
  baseUrl: string;
}

/**
 * Prerenders the Blog Index Page (/blog/) into the SPA root.
 * Produces semantic header, breadcrumbs, search placeholder, categories, and article cards.
 */
export function renderBlogIndexHtml(options: RenderBlogIndexOptions): string {
  const { articles, baseUrl } = options;

  // Compute unique destinations and categories
  const destSet = new Set<string>();
  const catSet = new Set<string>();
  articles.forEach(a => {
    if (a.destination) destSet.add(a.destination.trim());
    if (a.category) catSet.add(a.category.trim());
  });
  const destinations = ['All', ...Array.from(destSet).sort()];
  const categories = ['All', ...Array.from(catSet).sort()];

  // Take top 9 articles for page 1 (matches client articlesPerPage = 9)
  const displayArticles = articles.slice(0, 9);

  return `
    <div class="w-full bg-[#F8FAF9] text-neutral-900 min-h-screen pb-20">
      <!-- Breadcrumbs Navigation -->
      <nav aria-label="Breadcrumb" class="bg-white border-b border-neutral-200/80 px-4 sm:px-6 lg:px-8 py-3 text-xs sm:text-sm text-neutral-600">
        <div class="max-w-7xl mx-auto flex items-center gap-2">
          <a href="${escapeHtml(baseUrl)}/" class="hover:text-[#315B4F] transition-colors">Beranda</a>
          <span class="text-neutral-400" aria-hidden="true">/</span>
          <span class="text-[#315B4F] font-semibold" aria-current="page">Blog &amp; Panduan Wisata</span>
        </div>
      </nav>

      <!-- Hero Header Section -->
      <header class="relative overflow-hidden bg-gradient-to-b from-[#315B4F]/10 via-[#315B4F]/5 to-transparent pt-10 pb-16 px-4 sm:px-6 lg:px-8 border-b border-neutral-200/60">
        <div class="max-w-5xl mx-auto text-center space-y-4">
          <div class="inline-flex items-center gap-2 text-xs font-semibold text-[#315B4F] tracking-wider uppercase font-mono">
            <span>🧭</span>
            <span>Smart Journey Travel Journal</span>
          </div>
          
          <h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900 tracking-tight leading-tight">
            Panduan Wisata &amp; Inspirasi Perjalanan
          </h1>
          
          <p class="text-base sm:text-lg text-neutral-600 max-w-2xl mx-auto leading-relaxed">
            Eksplorasi mendalam rute terbaik Gunung Bromo, keajaiban Api Biru Kawah Ijen, eksotisme Bali, air terjun Tumpak Sewu, hingga tips sewa mobil dan transportasi resmi di Jawa Timur.
          </p>

          <!-- Quick Search Bar -->
          <div class="pt-4 max-w-xl mx-auto">
            <div class="relative flex items-center">
              <input
                type="text"
                placeholder="Cari panduan wisata, destinasi, atau rute..."
                aria-label="Cari panduan wisata"
                class="w-full pl-5 pr-10 py-3.5 bg-white border border-neutral-300 rounded-2xl shadow-xs text-sm sm:text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content Container -->
      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <!-- Filter Tabs Bar -->
        <section aria-label="Filter Artikel" class="mb-8 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-neutral-200">
            <div class="flex items-center gap-2 overflow-x-auto pb-1">
              <span class="text-xs font-bold text-neutral-500 uppercase tracking-wider whitespace-nowrap font-mono mr-1">
                Destinasi:
              </span>
              ${destinations.map(dest => `
                <a href="${escapeHtml(baseUrl)}/blog/" class="px-3 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap ${dest === 'All' ? 'bg-[#315B4F] text-white shadow-xs' : 'bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200'}">
                  ${dest === 'All' ? 'Semua Destinasi' : escapeHtml(dest)}
                </a>
              `).join('')}
            </div>

            <div class="text-xs text-neutral-500 font-medium whitespace-nowrap">
              Menampilkan <span class="font-bold text-neutral-900">${articles.length}</span> panduan
            </div>
          </div>

          ${categories.length > 2 ? `
            <div class="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span class="font-bold text-neutral-500 uppercase tracking-wider whitespace-nowrap font-mono mr-1">
                Kategori:
              </span>
              ${categories.map(cat => `
                <a href="${escapeHtml(baseUrl)}/blog/" class="px-2.5 py-1 font-medium rounded-lg whitespace-nowrap ${cat === 'All' ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300' : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'}">
                  ${cat === 'All' ? 'Semua Kategori' : escapeHtml(cat)}
                </a>
              `).join('')}
            </div>
          ` : ''}
        </section>

        <!-- Articles Grid Catalog -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          ${displayArticles.map(article => {
            const articleHref = `${baseUrl}/blog/${encodeURIComponent(article.slug)}/`;
            const articleImg = article.image || `${baseUrl}/bromo.png`;
            const altText = article.featuredImageAltText || article.title;

            return `
              <article class="bg-white border border-neutral-200/90 rounded-3xl overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between group hover:border-[#315B4F]/40">
                <div>
                  <!-- Featured Image Link -->
                  <a href="${escapeHtml(articleHref)}" class="block relative aspect-[16/10] overflow-hidden bg-neutral-100">
                    <img
                      src="${escapeHtml(articleImg)}"
                      alt="${escapeHtml(altText)}"
                      loading="lazy"
                      class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60"></div>
                    ${article.destination ? `
                      <div class="absolute bottom-3 left-3 text-xs font-semibold text-white flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-lg">
                        <span>📍</span>
                        <span>${escapeHtml(article.destination)}</span>
                      </div>
                    ` : ''}
                  </a>

                  <!-- Metadata & Headline -->
                  <div class="p-6 space-y-3">
                    <div class="flex items-center gap-2 text-xs text-neutral-500 font-medium">
                      <span>${escapeHtml(article.category || 'Panduan Wisata')}</span>
                      <span aria-hidden="true">·</span>
                      <span class="flex items-center gap-1">
                        <span>🕒</span>
                        <span>${escapeHtml(article.readTime || '5 min baca')}</span>
                      </span>
                      ${article.date ? `
                        <span aria-hidden="true">·</span>
                        <span>${escapeHtml(article.date)}</span>
                      ` : ''}
                    </div>

                    <h2 class="text-lg sm:text-xl font-bold text-neutral-900 group-hover:text-[#315B4F] transition-colors leading-snug line-clamp-2">
                      <a href="${escapeHtml(articleHref)}" class="hover:underline">
                        ${escapeHtml(article.title)}
                      </a>
                    </h2>

                    <p class="text-sm text-neutral-600 leading-relaxed line-clamp-3">
                      ${escapeHtml(article.excerpt || '')}
                    </p>
                  </div>
                </div>

                <!-- Card Action Footer -->
                <div class="px-6 pb-6 pt-2 border-t border-neutral-100 flex items-center justify-between mt-auto">
                  <span class="text-xs text-neutral-500">
                    Oleh <strong class="font-semibold text-neutral-700">${escapeHtml(article.author || 'Tim Smart Journey')}</strong>
                  </span>

                  <a href="${escapeHtml(articleHref)}" class="inline-flex items-center gap-1.5 text-xs font-bold text-[#315B4F] group-hover:text-amber-600 transition-colors" aria-label="Baca panduan lengkap: ${escapeHtml(article.title)}">
                    <span>Baca Lengkap</span>
                    <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              </article>
            `;
          }).join('')}
        </div>

        ${articles.length > 9 ? `
          <nav aria-label="Navigasi Halaman Blog" class="mt-12 flex items-center justify-center gap-2">
            <span class="px-4 py-2 rounded-xl text-xs font-semibold border border-neutral-300 bg-white text-neutral-700">
              Halaman 1 dari ${Math.ceil(articles.length / 9)}
            </span>
          </nav>
        ` : ''}
      </main>
    </div>
  `;
}

/**
 * Prerenders the Article Detail Page (/blog/:slug/) into the SPA root.
 * Produces full editorial content: H1, author, published date, hero image,
 * Table of Contents, editorial sections, photo gallery, interactive-compatible FAQ,
 * commercial CTA, related tour packages cross-sell, and internal links.
 */
export function renderBlogDetailHtml(options: RenderBlogDetailOptions): string {
  const { article, relevantTours = [], baseUrl } = options;

  const articleHref = `${baseUrl}/blog/${encodeURIComponent(article.slug)}/`;
  const heroImg = article.image || `${baseUrl}/bromo.png`;
  const altText = article.featuredImageAltText || article.title;
  const authorName = article.author || 'Tim Editorial Smart Journey';

  // Build Table of Contents list
  const tocList: { id: string; title: string }[] = [];
  if (article.introduction) tocList.push({ id: 'introduction', title: 'Pengenalan & Gambaran Umum' });
  if (article.history) tocList.push({ id: 'history', title: 'Sejarah & Latar Belakang' });
  if (article.whyVisit) tocList.push({ id: 'why-visit', title: 'Mengapa Wajib Berkunjung' });
  if (article.bestTimeToVisit || article.weather) tocList.push({ id: 'best-time', title: 'Waktu Terbaik Berkunjung & Informasi Cuaca' });
  if (article.topAttractions || article.bestActivities) tocList.push({ id: 'top-attractions', title: 'Daya Tarik Utama & Aktivitas Unggulan' });
  if (article.travelTips) tocList.push({ id: 'travel-tips', title: 'Tips Perjalanan & Persiapan' });
  if (article.transportation) tocList.push({ id: 'transportation', title: 'Rute & Akses Transportasi' });
  if (article.suggestedItinerary) tocList.push({ id: 'itinerary', title: 'Rekomendasi Rencana Perjalanan' });
  if (article.localCulture || article.foodToTry) tocList.push({ id: 'local-culture', title: 'Budaya Lokal & Kuliner Khas' });
  if (Array.isArray(article.gallery) && article.gallery.length > 0) tocList.push({ id: 'gallery', title: 'Galeri Foto Destinasi' });
  if (Array.isArray(article.faq) && article.faq.length > 0) tocList.push({ id: 'faq', title: 'Tanya Jawab (FAQ)' });
  if (article.conclusion || article.callToAction) tocList.push({ id: 'conclusion', title: 'Kesimpulan' });

  return `
    <div class="w-full bg-[#F8FAF9] text-neutral-900 min-h-screen pb-20">
      <!-- Breadcrumbs Navigation -->
      <nav aria-label="Breadcrumb" class="bg-white border-b border-neutral-200/80 px-4 sm:px-6 lg:px-8 py-3 text-xs sm:text-sm text-neutral-600">
        <div class="max-w-4xl mx-auto flex items-center gap-2">
          <a href="${escapeHtml(baseUrl)}/" class="hover:text-[#315B4F] transition-colors">Beranda</a>
          <span class="text-neutral-400" aria-hidden="true">/</span>
          <a href="${escapeHtml(baseUrl)}/blog/" class="hover:text-[#315B4F] transition-colors">Blog</a>
          <span class="text-neutral-400" aria-hidden="true">/</span>
          <span class="text-[#315B4F] font-semibold truncate max-w-[200px] sm:max-w-none" aria-current="page">${escapeHtml(article.title)}</span>
        </div>
      </nav>

      <article class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <!-- Top Navigation Back Action -->
        <div class="mb-6 flex items-center justify-between">
          <a
            href="${escapeHtml(baseUrl)}/blog/"
            class="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-neutral-600 hover:text-[#315B4F] transition-colors group"
          >
            <span aria-hidden="true">&larr;</span>
            <span>Kembali ke Semua Panduan Wisata</span>
          </a>

          <!-- Social Share Controls -->
          <div class="flex items-center gap-2">
            <a
              href="https://api.whatsapp.com/send?text=${encodeURIComponent(`Baca panduan wisata ini di Smart Journey: ${article.title}\n${articleHref}`)}"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold transition-colors"
              aria-label="Bagikan via WhatsApp"
            >
              <span>WhatsApp</span>
            </a>
          </div>
        </div>

        <!-- Article Header -->
        <header class="space-y-4 mb-8">
          <div class="flex flex-wrap items-center gap-2 text-xs text-neutral-500 font-medium">
            ${article.destination ? `
              <span class="flex items-center gap-1 text-[#315B4F] font-semibold">
                <span>📍</span>
                <span>${escapeHtml(article.destination)}</span>
              </span>
              <span aria-hidden="true">·</span>
            ` : ''}
            <span>${escapeHtml(article.category || 'Panduan Wisata')}</span>
            <span aria-hidden="true">·</span>
            <span class="flex items-center gap-1">
              <span>🕒</span>
              <span>${escapeHtml(article.readTime || '5 min baca')}</span>
            </span>
            ${article.date ? `
              <span aria-hidden="true">·</span>
              <span class="flex items-center gap-1">
                <span>📅</span>
                <span>${escapeHtml(article.date)}</span>
              </span>
            ` : ''}
          </div>

          <!-- Primary H1 -->
          <h1 class="text-2xl sm:text-3xl md:text-4xl font-extrabold text-neutral-900 tracking-tight leading-tight">
            ${escapeHtml(article.title)}
          </h1>

          <!-- Author Byline -->
          <div class="text-xs sm:text-sm text-neutral-600">
            Ditulis oleh <strong class="font-semibold text-neutral-800">${escapeHtml(authorName)}</strong>
          </div>
        </header>

        <!-- Featured Hero Image -->
        <div class="mb-10 rounded-3xl overflow-hidden border border-neutral-200 bg-neutral-100 shadow-xs">
          <img
            src="${escapeHtml(heroImg)}"
            alt="${escapeHtml(altText)}"
            class="w-full aspect-[16/9] object-cover"
          />
          ${article.destination ? `
            <div class="p-3 bg-neutral-50 text-[11px] text-neutral-500 border-t border-neutral-200 flex items-center justify-between">
              <span>Destinasi: ${escapeHtml(article.destination)}</span>
              <span>Dokumentasi Resmi Smart Journey</span>
            </div>
          ` : ''}
        </div>

        <!-- Table of Contents (Daftar Isi) -->
        ${tocList.length > 3 ? `
          <nav aria-label="Daftar Isi Artikel" class="mb-10 p-6 bg-white border border-neutral-200 rounded-3xl shadow-xs">
            <div class="flex items-center gap-2 mb-3 text-sm font-bold text-neutral-900">
              <span>📋</span>
              <span>Daftar Isi Panduan</span>
            </div>
            <ol class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              ${tocList.map((item, idx) => `
                <li>
                  <a href="#${item.id}" class="text-neutral-600 hover:text-[#315B4F] hover:underline font-medium flex items-start gap-1.5 transition-colors py-0.5">
                    <span class="text-neutral-400 font-mono text-[11px] shrink-0">${idx + 1}.</span>
                    <span class="truncate">${escapeHtml(item.title)}</span>
                  </a>
                </li>
              `).join('')}
            </ol>
          </nav>
        ` : ''}

        <!-- Detailed Editorial Content Sections -->
        <div class="space-y-10 text-neutral-800 leading-relaxed text-base sm:text-lg">
          <!-- Introduction -->
          ${article.introduction ? `
            <section id="introduction" class="scroll-mt-24 space-y-4">
              <h2 class="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2">
                Pengenalan &amp; Gambaran Umum
              </h2>
              <p class="text-neutral-700 whitespace-pre-line leading-relaxed">
                ${escapeHtml(article.introduction)}
              </p>
            </section>
          ` : ''}

          <!-- History -->
          ${article.history ? `
            <section id="history" class="scroll-mt-24 space-y-4">
              <h2 class="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2">
                Sejarah &amp; Latar Belakang
              </h2>
              <p class="text-neutral-700 whitespace-pre-line leading-relaxed">
                ${escapeHtml(article.history)}
              </p>
            </section>
          ` : ''}

          <!-- Why Visit -->
          ${article.whyVisit ? `
            <section id="why-visit" class="scroll-mt-24 space-y-4 bg-emerald-50/60 p-6 sm:p-8 rounded-3xl border border-emerald-100">
              <h2 class="text-xl sm:text-2xl font-bold text-emerald-950 flex items-center gap-2">
                <span>✨</span>
                <span>Mengapa Destinasi Ini Wajib Masuk Bucket List Anda</span>
              </h2>
              <p class="text-emerald-900/90 whitespace-pre-line leading-relaxed text-base">
                ${escapeHtml(article.whyVisit)}
              </p>
            </section>
          ` : ''}

          <!-- Best Time to Visit & Weather -->
          ${(article.bestTimeToVisit || article.weather) ? `
            <section id="best-time" class="scroll-mt-24 space-y-4">
              <h2 class="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2">
                Waktu Terbaik Berkunjung &amp; Informasi Cuaca
              </h2>
              ${article.bestTimeToVisit ? `
                <div class="space-y-2">
                  <h3 class="text-base font-bold text-neutral-800">Musim &amp; Jam Terbaik:</h3>
                  <p class="text-neutral-700 whitespace-pre-line leading-relaxed">
                    ${escapeHtml(article.bestTimeToVisit)}
                  </p>
                </div>
              ` : ''}
              ${article.weather ? `
                <div class="space-y-2 pt-2">
                  <h3 class="text-base font-bold text-neutral-800">Kondisi Suhu &amp; Cuaca:</h3>
                  <p class="text-neutral-700 whitespace-pre-line leading-relaxed">
                    ${escapeHtml(article.weather)}
                  </p>
                </div>
              ` : ''}
            </section>
          ` : ''}

          <!-- Top Attractions & Activities -->
          ${(article.topAttractions || article.bestActivities) ? `
            <section id="top-attractions" class="scroll-mt-24 space-y-6">
              <h2 class="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2">
                Daya Tarik Utama &amp; Aktivitas Unggulan
              </h2>
              ${article.topAttractions ? `
                <div class="space-y-2">
                  <h3 class="text-lg font-bold text-neutral-800">Spot &amp; Tempat Wisata Populer:</h3>
                  <p class="text-neutral-700 whitespace-pre-line leading-relaxed">
                    ${escapeHtml(article.topAttractions)}
                  </p>
                </div>
              ` : ''}
              ${article.bestActivities ? `
                <div id="best-activities" class="space-y-2 pt-2 scroll-mt-24">
                  <h3 class="text-lg font-bold text-neutral-800">Aktivitas Seru yang Tidak Boleh Terlewat:</h3>
                  <p class="text-neutral-700 whitespace-pre-line leading-relaxed">
                    ${escapeHtml(article.bestActivities)}
                  </p>
                </div>
              ` : ''}
            </section>
          ` : ''}

          <!-- Travel Tips -->
          ${article.travelTips ? `
            <section id="travel-tips" class="scroll-mt-24 space-y-4 bg-amber-50/70 p-6 sm:p-8 rounded-3xl border border-amber-200/80">
              <h2 class="text-xl sm:text-2xl font-bold text-amber-950 flex items-center gap-2">
                <span>ℹ️</span>
                <span>Tips Perjalanan &amp; Persiapan Penting</span>
              </h2>
              <p class="text-amber-900/90 whitespace-pre-line leading-relaxed text-base">
                ${escapeHtml(article.travelTips)}
              </p>
            </section>
          ` : ''}

          <!-- Transportation -->
          ${article.transportation ? `
            <section id="transportation" class="scroll-mt-24 space-y-4">
              <h2 class="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2 flex items-center gap-2">
                <span>🚗</span>
                <span>Rute &amp; Akses Transportasi Menuju Lokasi</span>
              </h2>
              <p class="text-neutral-700 whitespace-pre-line leading-relaxed">
                ${escapeHtml(article.transportation)}
              </p>
            </section>
          ` : ''}

          <!-- Suggested Itinerary -->
          ${article.suggestedItinerary ? `
            <section id="itinerary" class="scroll-mt-24 space-y-4 bg-white p-6 sm:p-8 rounded-3xl border border-neutral-200 shadow-xs">
              <h2 class="text-xl sm:text-2xl font-bold text-neutral-900 flex items-center gap-2">
                <span>📅</span>
                <span>Rekomendasi Rencana Perjalanan (Itinerary)</span>
              </h2>
              <div class="text-neutral-700 whitespace-pre-line leading-relaxed text-base pt-2">
                ${escapeHtml(article.suggestedItinerary)}
              </div>
            </section>
          ` : ''}

          <!-- Local Culture & Food -->
          ${(article.localCulture || article.foodToTry) ? `
            <section id="local-culture" class="space-y-6">
              <h2 class="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2">
                Budaya Lokal &amp; Kuliner Khas
              </h2>
              ${article.localCulture ? `
                <div class="space-y-2">
                  <h3 class="text-base font-bold text-neutral-800">Kearifan &amp; Adat Budaya Setempat:</h3>
                  <p class="text-neutral-700 whitespace-pre-line leading-relaxed">
                    ${escapeHtml(article.localCulture)}
                  </p>
                </div>
              ` : ''}
              ${article.foodToTry ? `
                <div class="space-y-2 pt-2">
                  <h3 class="text-base font-bold text-neutral-800">Kuliner yang Wajib Dicicipi:</h3>
                  <p class="text-neutral-700 whitespace-pre-line leading-relaxed">
                    ${escapeHtml(article.foodToTry)}
                  </p>
                </div>
              ` : ''}
            </section>
          ` : ''}

          <!-- Photo Gallery Grid -->
          ${Array.isArray(article.gallery) && article.gallery.length > 0 ? `
            <section id="gallery" class="scroll-mt-24 space-y-4">
              <h2 class="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2 flex items-center gap-2">
                <span>📷</span>
                <span>Galeri Destinasi</span>
              </h2>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                ${article.gallery.map((prompt, idx) => `
                  <div class="relative aspect-video rounded-2xl overflow-hidden bg-neutral-200 group">
                    <img
                      src="${escapeHtml(article.image || `${baseUrl}/bromo.png`)}"
                      alt="${escapeHtml(article.title)} dokumentasi foto ${idx + 1}"
                      loading="lazy"
                      class="w-full h-full object-cover"
                    />
                  </div>
                `).join('')}
              </div>
            </section>
          ` : ''}

          <!-- Frequently Asked Questions (FAQ) with details/summary for zero-JS crawlability -->
          ${Array.isArray(article.faq) && article.faq.length > 0 ? `
            <section id="faq" class="scroll-mt-24 space-y-4">
              <h2 class="text-xl sm:text-2xl font-bold text-neutral-900 border-b border-neutral-200 pb-2 flex items-center gap-2">
                <span>❓</span>
                <span>Pertanyaan yang Sering Diajukan (FAQ)</span>
              </h2>

              <div class="space-y-3 pt-2">
                ${article.faq.map((item: FAQItem, idx: number) => `
                  <div class="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
                    <div class="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-neutral-900">
                      <span>${escapeHtml(item.question)}</span>
                    </div>
                    <div class="px-4 sm:px-5 pb-5 pt-1 text-sm text-neutral-600 leading-relaxed border-t border-neutral-100 bg-neutral-50/50">
                      ${escapeHtml(item.answer)}
                    </div>
                  </div>
                `).join('')}
              </div>
            </section>
          ` : ''}

          <!-- Conclusion & Editorial Signoff -->
          ${(article.conclusion || article.callToAction) ? `
            <section id="conclusion" class="scroll-mt-24 space-y-4 pt-6 border-t border-neutral-200">
              <h2 class="text-xl sm:text-2xl font-bold text-neutral-900">
                Kesimpulan
              </h2>
              ${article.conclusion ? `
                <p class="text-neutral-700 whitespace-pre-line leading-relaxed">
                  ${escapeHtml(article.conclusion)}
                </p>
              ` : ''}
              ${article.callToAction ? `
                <div class="p-6 bg-emerald-50/80 border border-emerald-200 rounded-2xl text-emerald-950 text-base font-medium">
                  ${escapeHtml(article.callToAction)}
                </div>
              ` : ''}
            </section>
          ` : ''}
        </div>

        <!-- Commercial Cross-Selling Section: Relevant Tours -->
        ${relevantTours.length > 0 ? `
          <aside aria-label="Rekomendasi Paket Wisata Terkait" class="mt-16 pt-10 border-t border-neutral-300">
            <div class="flex items-center justify-between mb-6">
              <div>
                <div class="text-xs font-bold text-amber-600 uppercase tracking-wider font-mono flex items-center gap-1.5 mb-1">
                  <span>🧭</span>
                  <span>Rekomendasi Paket Wisata</span>
                </div>
                <h2 class="text-xl sm:text-2xl font-extrabold text-neutral-900">
                  Jelajahi ${escapeHtml(article.destination || 'Destinasi Ini')} Bersama Smart Journey
                </h2>
              </div>
              
              <a
                href="${escapeHtml(baseUrl)}/tours"
                class="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-[#315B4F] hover:text-amber-600 transition-colors"
              >
                <span>Lihat Semua Paket</span>
                <span aria-hidden="true">&rarr;</span>
              </a>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              ${relevantTours.map(tour => `
                <div class="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group">
                  <div>
                    <div class="aspect-[16/10] bg-neutral-200 relative overflow-hidden">
                      <img
                        src="${escapeHtml(tour.image || `${baseUrl}/bromo.png`)}"
                        alt="${escapeHtml(tour.name)}"
                        loading="lazy"
                        class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      ${tour.duration ? `
                        <div class="absolute bottom-2.5 left-2.5 text-[11px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-xs">
                          ${escapeHtml(tour.duration)}
                        </div>
                      ` : ''}
                    </div>

                    <div class="p-4 space-y-2">
                      <h3 class="font-bold text-sm text-neutral-900 group-hover:text-[#315B4F] transition-colors line-clamp-2">
                        ${escapeHtml(tour.name)}
                      </h3>
                      
                      <div class="text-xs text-neutral-500">
                        Mulai dari <strong class="text-amber-600 font-extrabold">IDR ${(tour.startingPriceIDR || 0).toLocaleString('id-ID')}</strong>
                      </div>
                    </div>
                  </div>

                  <div class="p-4 pt-0">
                    <a
                      href="${escapeHtml(baseUrl)}/tours"
                      class="block w-full py-2 bg-[#315B4F] hover:bg-[#27483f] text-white text-xs font-semibold rounded-xl transition-all text-center"
                    >
                      Pilih Paket Tur
                    </a>
                  </div>
                </div>
              `).join('')}
            </div>
          </aside>
        ` : ''}

        <!-- Action Bottom Bar -->
        <footer class="mt-14 pt-8 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <a
            href="${escapeHtml(baseUrl)}/blog/"
            class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 rounded-xl text-sm font-semibold transition-colors"
          >
            <span aria-hidden="true">&larr;</span>
            <span>Kembali ke Daftar Panduan (/blog/)</span>
          </a>

          <div class="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-3">
            <a
              href="${escapeHtml(baseUrl)}/car-rental"
              class="w-full sm:w-auto px-5 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-sm font-semibold transition-colors text-center"
            >
              Rental Mobil &amp; Supir
            </a>
            <a
              href="${escapeHtml(baseUrl)}/tours"
              class="w-full sm:w-auto px-6 py-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-sm transition-all text-center shadow-xs"
            >
              Lihat Seluruh Paket Tur
            </a>
          </div>
        </footer>
      </article>
    </div>
  `;
}

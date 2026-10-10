// ==============================================================================
// VERIFICATION TEST SUITE: TAHAP 5 AUTOMATIC BLOG PRERENDERING & SEO CONTENT
// ==============================================================================

const BASE = 'http://127.0.0.1:3000';

async function runTests() {
  console.log('--- Starting Tahap 5 Prerendering Verification Suite ---');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
    }
  }

  // 1. Test /blog/ raw HTML response
  try {
    const res = await fetch(`${BASE}/blog/`);
    const html = await res.text();
    assert(res.status === 200, 'GET /blog/ returns HTTP 200');
    assert(html.includes('<h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold text-neutral-900'), '/blog/ contains main H1 heading in initial HTML');
    assert(html.includes('Panduan Wisata &amp; Inspirasi Perjalanan'), '/blog/ contains H1 text in initial HTML');
    assert(html.includes('Menampilkan <span class="font-bold text-neutral-900">'), '/blog/ contains article count');
    assert(html.includes('<article class="bg-white border border-neutral-200/90 rounded-3xl'), '/blog/ contains prerendered article cards in initial HTML');
    assert(html.includes('The Ultimate Mount Bromo Travel Guide'), '/blog/ contains Bromo article title in initial HTML');
    assert(html.includes('Chasing the Electric Blue Fire of Ijen Crater'), '/blog/ contains Ijen article title in initial HTML');
    assert(html.includes('Baca Lengkap'), '/blog/ contains internal article action links in initial HTML');
    assert(res.headers.get('content-type')?.includes('text/html') || false, '/blog/ returns Content-Type text/html');
    assert(Boolean(res.headers.get('etag')), '/blog/ response includes ETag header for caching');
  } catch (e: any) {
    assert(false, `Error testing /blog/: ${e.message}`);
  }

  // 2. Test /blog/mount-bromo-travel-guide/ raw HTML response
  try {
    const res = await fetch(`${BASE}/blog/mount-bromo-travel-guide/`);
    const html = await res.text();
    assert(res.status === 200, 'GET /blog/mount-bromo-travel-guide/ returns HTTP 200');
    assert(html.includes('<h1 class="text-2xl sm:text-3xl md:text-4xl font-extrabold text-neutral-900'), 'Article contains H1 heading tag');
    assert(html.includes('The Ultimate Mount Bromo Travel Guide: Sunrise, Volcanic Caldrons &amp; Tengger Culture'), 'Article H1 text is present in initial HTML');
    assert(html.includes('SmartJourney Editorial Team'), 'Article author byline is present in initial HTML');
    assert(html.includes('id="introduction"'), 'Article contains Pengenalan (introduction) section');
    assert(html.includes('id="history"'), 'Article contains Sejarah (history) section');
    assert(html.includes('id="why-visit"'), 'Article contains Mengapa Wajib Berkunjung section');
    assert(html.includes('id="best-time"'), 'Article contains Waktu Terbaik Berkunjung section');
    assert(html.includes('id="top-attractions"'), 'Article contains Daya Tarik Utama section');
    assert(html.includes('id="travel-tips"'), 'Article contains Tips Perjalanan section');
    assert(html.includes('id="transportation"'), 'Article contains Rute & Akses Transportasi section');
    assert(html.includes('id="faq"'), 'Article contains FAQ section in initial HTML');
    assert(html.includes('Is Mount Bromo currently safe to visit?'), 'Article FAQ questions and answers are present in initial HTML');
    assert(html.includes('id="conclusion"'), 'Article contains Kesimpulan section');
    assert(html.includes('aria-label="Rekomendasi Paket Wisata Terkait"'), 'Article contains commercial cross-selling tour recommendations in initial HTML');
    assert(html.includes('Rental Mobil &amp; Supir'), 'Article contains commercial internal action links in initial HTML');
    assert(html.includes('<link rel="canonical" href="https://smartjourney.id/blog/mount-bromo-travel-guide/"'), 'Canonical tag is correct');
    assert(html.includes('<meta property="og:type" content="article"'), 'OpenGraph type is article');
    assert(html.includes('"@type":"Article"'), 'JSON-LD includes Article structured data');
    assert(html.includes('"@type":"FAQPage"'), 'JSON-LD includes FAQPage structured data');
  } catch (e: any) {
    assert(false, `Error testing article detail: ${e.message}`);
  }

  // 3. Test /blog/ijen-crater-blue-fire-guide/ raw HTML response
  try {
    const res = await fetch(`${BASE}/blog/ijen-crater-blue-fire-guide/`);
    const html = await res.text();
    assert(res.status === 200, 'GET /blog/ijen-crater-blue-fire-guide/ returns HTTP 200');
    assert(html.includes('Chasing the Electric Blue Fire of Ijen Crater: A Comprehensive Hiker’s Guide'), 'Ijen H1 is present in initial HTML');
    assert(html.includes('id="faq"'), 'Ijen article contains FAQ section in initial HTML');
  } catch (e: any) {
    assert(false, `Error testing Ijen detail: ${e.message}`);
  }

  // 4. Test 404 handling for non-existent slug
  try {
    const res = await fetch(`${BASE}/blog/random-non-existent-article-slug-xyz/`);
    const html = await res.text();
    assert(res.status === 404, 'GET invalid blog slug returns HTTP 404');
    assert(html.includes('Artikel Tidak Ditemukan (404)'), '404 page contains correct error title');
    assert(html.includes('<meta name="robots" content="noindex, follow"'), '404 page has noindex robot tag');
  } catch (e: any) {
    assert(false, `Error testing 404 slug: ${e.message}`);
  }

  // 5. Test Non-Blog route /tours
  try {
    const res = await fetch(`${BASE}/tours`);
    const html = await res.text();
    assert(res.status === 200, 'GET /tours returns HTTP 200');
    assert(html.includes('<div id="root"></div>'), 'Non-blog route preserves standard SPA root without blog injection');
  } catch (e: any) {
    assert(false, `Error testing /tours: ${e.message}`);
  }

  console.log(`\n--- Verification Completed: ${passed}/${total} assertions passed ---`);
  if (passed !== total) {
    process.exit(1);
  }
}

runTests();

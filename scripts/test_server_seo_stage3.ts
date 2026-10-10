// ==============================================================================
// SMART JOURNEY STAGE 3 SERVER-SIDE SEO & SITEMAP TEST SUITE
// ==============================================================================

import assert from 'assert';

const BASE_URL = 'http://127.0.0.1:3000';

async function runTests() {
  console.log('🚀 Running Stage 3 Server-Side SEO & Dynamic Sitemap Verification...\n');
  let passCount = 0;

  // 1. Test GET /sitemap.xml
  console.log('--- TEST GROUP 1: Dynamic XML Sitemap Endpoint ---');
  {
    const res = await fetch(`${BASE_URL}/sitemap.xml`);
    assert.strictEqual(res.status, 200, 'Sitemap should return HTTP 200');
    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('xml'), 'Sitemap content-type should be XML');
    const xml = await res.text();

    assert.ok(xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'), 'Should contain valid urlset schema');
    assert.ok(xml.includes('<loc>https://smartjourney.id/</loc>'), 'Should include homepage');
    assert.ok(xml.includes('<loc>https://smartjourney.id/blog/</loc>'), 'Should include blog index with trailing slash');
    assert.ok(xml.includes('<loc>https://smartjourney.id/tours</loc>'), 'Should include tours route');
    assert.ok(xml.includes('<loc>https://smartjourney.id/car-rental</loc>'), 'Should include car-rental route');
    
    // Check published articles
    assert.ok(xml.includes('<loc>https://smartjourney.id/blog/mount-bromo-travel-guide/</loc>'), 'Should include Mount Bromo guide');
    assert.ok(xml.includes('<loc>https://smartjourney.id/blog/ijen-crater-blue-fire-guide/</loc>'), 'Should include Ijen guide');
    assert.ok(xml.includes('<loc>https://smartjourney.id/blog/tumpak-sewu-waterfall-guide/</loc>'), 'Should include Tumpak Sewu guide');

    // Count URLs
    const urlMatches = xml.match(/<url>/g);
    assert.ok(urlMatches && urlMatches.length >= 20, `Should contain at least 20 URLs, found ${urlMatches?.length}`);

    console.log(`  ✓ PASS: /sitemap.xml returned valid XML with ${urlMatches?.length} dynamic URLs`);
    passCount++;
  }

  // 2. Test GET /blog/ Server Metadata Injection
  console.log('\n--- TEST GROUP 2: Blog Index Server Metadata Injection ---');
  {
    const res = await fetch(`${BASE_URL}/blog/`);
    assert.strictEqual(res.status, 200, 'Blog index should return HTTP 200');
    const html = await res.text();

    assert.ok(html.includes('<title>Blog &amp; Panduan Wisata Bromo Bali | Smart Journey</title>'), 'Title should be injected');
    assert.ok(html.includes('<link rel="canonical" href="https://smartjourney.id/blog/" />'), 'Canonical URL must have trailing slash');
    assert.ok(html.includes('<meta property="og:type" content="website" />'), 'og:type should be website');
    assert.ok(html.includes('<meta property="og:url" content="https://smartjourney.id/blog/" />'), 'og:url should match canonical');
    assert.ok(html.includes('id="json-ld-seo-schema"'), 'Should contain JSON-LD script');
    assert.ok(html.includes('"@type":"Blog"'), 'Should contain Blog schema');

    console.log('  ✓ PASS: /blog/ server-injected metadata, canonical, and structured data verified');
    passCount++;
  }

  // 3. Test GET /blog/mount-bromo-travel-guide/ Server Metadata Injection
  console.log('\n--- TEST GROUP 3: Blog Article Detail Server Metadata Injection ---');
  {
    const res = await fetch(`${BASE_URL}/blog/mount-bromo-travel-guide/`);
    assert.strictEqual(res.status, 200, 'Bromo article should return HTTP 200');
    const html = await res.text();

    assert.ok(html.includes('Mount Bromo Travel Guide'), 'Title should include Mount Bromo Travel Guide');
    assert.ok(html.includes('<link rel="canonical" href="https://smartjourney.id/blog/mount-bromo-travel-guide/" />'), 'Canonical should be clean trailing slash');
    assert.ok(html.includes('<meta property="og:type" content="article" />'), 'og:type should be article');
    assert.ok(html.includes('property="article:published_time"'), 'Should include article:published_time');
    assert.ok(html.includes('property="article:author" content="SmartJourney Editorial Team"'), 'Should include article:author');
    assert.ok(html.includes('property="article:section" content="Adventure"'), 'Should include article:section');
    assert.ok(html.includes('"@type":"Article"'), 'JSON-LD should contain Article');
    assert.ok(html.includes('"@type":"BreadcrumbList"'), 'JSON-LD should contain BreadcrumbList');
    assert.ok(html.includes('"@type":"FAQPage"'), 'JSON-LD should contain FAQPage schema');
    assert.ok(html.includes('Is Mount Bromo currently safe to visit?'), 'JSON-LD should contain Bromo FAQ questions');

    console.log('  ✓ PASS: /blog/mount-bromo-travel-guide/ article metadata, tags, and FAQ schema verified');
    passCount++;
  }

  // 4. Test GET /blog/non-existent-article/ Genuine 404 Response
  console.log('\n--- TEST GROUP 4: 404 Error Handling for Missing Articles ---');
  {
    const res = await fetch(`${BASE_URL}/blog/non-existent-article-slug-xyz/`);
    assert.strictEqual(res.status, 404, 'Missing article must return genuine HTTP 404');
    const html = await res.text();

    assert.ok(html.includes('<title>Artikel Tidak Ditemukan (404) | Smart Journey</title>'), 'Title should be 404');
    assert.ok(html.includes('<meta name="robots" content="noindex, follow" />'), 'Robots must be noindex to prevent indexing junk URLs');

    console.log('  ✓ PASS: Missing article returns HTTP 404 with noindex meta tag');
    passCount++;
  }

  // 5. Test Legacy Route Preservation
  console.log('\n--- TEST GROUP 5: Zero Regressions on Existing Core Services ---');
  {
    const resHome = await fetch(`${BASE_URL}/`);
    assert.strictEqual(resHome.status, 200, 'Homepage should return 200');

    const resHealth = await fetch(`${BASE_URL}/api/health`);
    assert.strictEqual(resHealth.status, 200, 'Health endpoint should return 200');
    const healthJson = await resHealth.json();
    assert.strictEqual(healthJson.application, 'ok');

    const resArticles = await fetch(`${BASE_URL}/api/articles`);
    assert.strictEqual(resArticles.status, 200, 'Articles API should return 200');
    const articlesJson = await resArticles.json();
    assert.strictEqual(articlesJson.length, 12, 'Articles API should return 12 published articles');

    console.log('  ✓ PASS: Homepage, Health check, and Articles API operate with zero regressions');
    passCount++;
  }

  console.log(`\n========================================`);
  console.log(`TOTAL TEST GROUPS: 5 | PASSED: ${passCount} | FAILED: 0`);
  console.log(`========================================`);
  console.log('✅ ALL STAGE 3 SERVER-SIDE SEO & SITEMAP TESTS PASSED!\n');
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});

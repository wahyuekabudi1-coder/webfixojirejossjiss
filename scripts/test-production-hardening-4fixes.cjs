/**
 * SMART JOURNEY — FINAL PRODUCTION HARDENING 4-FIX VERIFICATION TEST
 * 
 * Tests:
 * 1. FIX 1: Public /api/db must NOT expose bookings, adminSessions, adminDrafts, or margins
 * 2. FIX 2: paymentLimiter active on all payment-intent endpoints (enforces 25 req/15 min -> HTTP 429)
 * 3. FIX 3: Public /api/artopay/config has zero credential fingerprints (no prefix, suffix, length, secretKeyInfo)
 * 4. FIX 4: /sitemap.xml covers all active customer routes, no admin/internal routes, valid XML
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failedTests++;
  }
}

function request(method, pathUrl, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: pathUrl,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', (err) => reject(err));
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING PRODUCTION HARDENING 4-FIX TEST SUITE');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // FIX 1: PUBLIC /api/db MUST NOT EXPOSE BOOKINGS
  // ----------------------------------------------------
  console.log('--- FIX 1: Public /api/db Privacy & Zero Booking Exposure ---');

  // Seed a temporary booking in DB to ensure DB actually has a booking
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const testBookingId = 'book-fixture-' + Date.now();
  const testBookingCode = 'SJ-PRIV-TEST-' + Math.floor(Math.random() * 10000);
  db.bookings = db.bookings || [];
  db.bookings.push({
    id: testBookingId,
    bookingCode: testBookingCode,
    tripId: 'tour-bromo-sunrise-safari',
    status: 'Pending',
    paymentStatus: 'Pending',
    fullName: 'Privacy Test User',
    email: 'privacy@smartjourney.id',
    phone: '08123456789',
    participantsCount: 2,
    totalPrice: 2850000,
    totalPriceIDR: 2850000,
    createdAt: new Date().toISOString()
  });

  // Seed an admin session for authorized comparison
  const adminToken = 'admin-fixture-token-' + Date.now();
  db.adminSessions = db.adminSessions || [];
  db.adminSessions.push({
    token: adminToken,
    email: 'admin@smartjourney.id',
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + 3600000
  });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

  try {
    // 1A: Public Request to /api/db
    const publicDbRes = await request('GET', '/api/db');
    assert(publicDbRes.status === 200, 'Public GET /api/db returns HTTP 200');
    assert(Array.isArray(publicDbRes.body.bookings), 'Public response has bookings array');
    assert(publicDbRes.body.bookings.length === 0, 'Public bookings array is strictly [] (Zero bookings exposed)');
    
    const publicStr = JSON.stringify(publicDbRes.body);
    assert(!publicStr.includes(testBookingCode), 'Public response does NOT contain any customer bookingCode');
    assert(!publicStr.includes('Privacy Test User'), 'Public response does NOT contain any customer name / PII');
    assert(publicDbRes.body.adminSessions === undefined, 'Public response does NOT contain adminSessions');
    assert(publicDbRes.body.adminDrafts === undefined, 'Public response does NOT contain adminDrafts');
    
    if (publicDbRes.body.trips && publicDbRes.body.trips.length > 0) {
      const t0 = publicDbRes.body.trips[0];
      assert(t0.internalNotes === undefined, 'Public trips do NOT expose internalNotes');
      assert(t0.profitMargin === undefined, 'Public trips do NOT expose profitMargin');
      assert(t0.costBreakdown === undefined, 'Public trips do NOT expose costBreakdown');
    }

    // 1B: Admin Request to /api/db should still receive bookings
    const adminDbRes = await request('GET', '/api/db', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(adminDbRes.status === 200, 'Admin GET /api/db returns HTTP 200');
    assert(
      Array.isArray(adminDbRes.body.bookings) && adminDbRes.body.bookings.length >= 1,
      'Admin GET /api/db receives full booking list for dashboard operation'
    );

    // ----------------------------------------------------
    // FIX 2: ACTIVATE paymentLimiter
    // ----------------------------------------------------
    console.log('\n--- FIX 2: Activate paymentLimiter on Payment Intent Endpoints ---');

    // Use a dedicated client IP via X-Forwarded-For so this test does not interfere with other tests
    const testIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
    const rateLimitHeaders = {
      'X-Forwarded-For': testIp
    };

    let hit429 = false;
    let requestsBefore429 = 0;

    // Send requests up to 27 times to trigger the 25 limit
    for (let i = 1; i <= 27; i++) {
      const res = await request(
        'POST',
        '/api/artopay/payment-intent',
        { orderId: `TEST-RL-${i}`, amount: 100000 },
        rateLimitHeaders
      );

      if (res.status === 429) {
        hit429 = true;
        requestsBefore429 = i - 1;
        break;
      }
    }

    assert(hit429, `paymentLimiter successfully triggered HTTP 429 after ${requestsBefore429} requests`);
    assert(
      requestsBefore429 === 25,
      `paymentLimiter accurately blocked on 26th request (limit: 25 requests / 15 minutes)`
    );

    // Verify alias /api/payment/create-intent and /artopay/payment-intent respond
    const aliasRes = await request('POST', '/api/payment/create-intent', { orderId: 'ALIAS-TEST', amount: 50000 });
    assert(aliasRes.status === 400, 'Alias /api/payment/create-intent is active and validates order');

    // ----------------------------------------------------
    // FIX 3: REMOVE PUBLIC CREDENTIAL FINGERPRINT
    // ----------------------------------------------------
    console.log('\n--- FIX 3: Remove Public Credential Fingerprint (/api/artopay/config) ---');

    const publicConfigRes = await request('GET', '/api/artopay/config');
    assert(publicConfigRes.status === 200, 'Public GET /api/artopay/config returns HTTP 200');
    assert(typeof publicConfigRes.body.isConfigured === 'boolean', 'isConfigured boolean is present');
    assert(typeof publicConfigRes.body.env === 'string', 'env string is present');
    assert(publicConfigRes.body.secretKeyInfo === undefined, 'secretKeyInfo is strictly absent');
    assert(publicConfigRes.body.publicKeyInfo === undefined, 'publicKeyInfo is strictly absent');
    assert(publicConfigRes.body.businessUnitInfo === undefined, 'businessUnitInfo is strictly absent');
    assert(publicConfigRes.body.prefix === undefined, 'prefix is strictly absent');
    assert(publicConfigRes.body.suffix === undefined, 'suffix is strictly absent');
    assert(publicConfigRes.body.length === undefined, 'length is strictly absent');
    assert(typeof publicConfigRes.body.apiBaseUrl === 'string', 'apiBaseUrl is non-sensitive gateway endpoint string');

    const rawConfigBody = JSON.stringify(publicConfigRes.body);
    assert(!rawConfigBody.includes('prefix'), 'Response JSON does not contain the word "prefix"');
    assert(!rawConfigBody.includes('suffix'), 'Response JSON does not contain the word "suffix"');

    // ----------------------------------------------------
    // FIX 4: IMPROVE PRODUCTION SITEMAP
    // ----------------------------------------------------
    console.log('\n--- FIX 4: Improve Production Sitemap ---');

    const sitemapRes = await request('GET', '/sitemap.xml');
    assert(sitemapRes.status === 200, 'GET /sitemap.xml returns HTTP 200');
    assert(
      (sitemapRes.headers['content-type'] || '').includes('xml'),
      'Content-Type is application/xml'
    );

    const xmlContent = typeof sitemapRes.body === 'string' ? sitemapRes.body : JSON.stringify(sitemapRes.body);
    assert(xmlContent.startsWith('<?xml'), 'Sitemap starts with XML declaration');
    assert(xmlContent.includes('<urlset'), 'Sitemap contains <urlset');
    assert(xmlContent.includes('</urlset>'), 'Sitemap closes </urlset>');

    const requiredUrls = [
      'https://smartjourney.id/',
      'https://smartjourney.id/tours',
      'https://smartjourney.id/share-tour',
      'https://smartjourney.id/airport',
      'https://smartjourney.id/taxi',
      'https://smartjourney.id/rental',
      'https://smartjourney.id/bookings',
      'https://smartjourney.id/about',
      'https://smartjourney.id/partnerships'
    ];

    for (const url of requiredUrls) {
      assert(xmlContent.includes(`<loc>${url}</loc>`), `Sitemap includes valid route: ${url}`);
    }

    assert(!xmlContent.includes('/admin'), 'Sitemap does NOT include /admin');
    assert(!xmlContent.includes('/api/'), 'Sitemap does NOT include /api/');

    // Also check public/sitemap.xml on disk
    const diskSitemap = fs.readFileSync(path.join(process.cwd(), 'public', 'sitemap.xml'), 'utf8');
    assert(diskSitemap.includes('https://smartjourney.id/tours'), 'public/sitemap.xml on disk includes /tours');
    assert(diskSitemap.includes('https://smartjourney.id/rental'), 'public/sitemap.xml on disk includes /rental');
  } finally {
    // ----------------------------------------------------
    // CLEANUP - Always restores pristine DB
    // ----------------------------------------------------
    const finalDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    finalDb.bookings = (finalDb.bookings || []).filter((b) => b.id !== testBookingId);
    finalDb.adminSessions = (finalDb.adminSessions || []).filter((s) => s.token !== adminToken);
    fs.writeFileSync(DB_PATH, JSON.stringify(finalDb, null, 2), 'utf8');
  }

  console.log('\n====================================================');
  console.log(`TOTAL 4-FIX CHECKS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

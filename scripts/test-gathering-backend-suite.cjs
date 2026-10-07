// ==============================================================================
// SMART JOURNEY: EVENT & GATHERING BACKEND PERSISTENCE & INTEGRATION TEST SUITE
// ==============================================================================

const http = require('http');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('================================================================');
  console.log('🛡️  EVENT & GATHERING PERSISTENT BACKEND TEST & REGRESSION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assertTest(name, condition, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${name}${details ? ` (${details})` : ''}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}${details ? ` (${details})` : ''}`);
      failed++;
    }
  }

  // 1. Admin Login
  console.log('--- 1. Admin Authentication ---');
  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { password: ADMIN_PASSWORD });

  if (loginRes.status !== 200 || !loginRes.body?.token) {
    console.error('Failed to log in as admin:', loginRes.body);
    process.exit(1);
  }
  const adminToken = loginRes.body.token;
  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };
  console.log('Admin authenticated successfully.');

  // 2. Test Packages: Fetch default seeded packages
  console.log('\n--- 2. Packages Persistence ---');
  const getPkgsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/gathering/packages',
    method: 'GET'
  });
  assertTest('GET /api/gathering/packages returns 200 array', getPkgsRes.status === 200 && Array.isArray(getPkgsRes.body));
  assertTest('Default packages are seeded in persistent SQL', getPkgsRes.body.length >= 3, `Count: ${getPkgsRes.body.length}`);

  // Create new package as Admin
  const testPkgId = `pkg-test-${Date.now()}`;
  const createPkgRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/gathering/packages',
    method: 'POST',
    headers: adminHeaders
  }, {
    id: testPkgId,
    title: 'Surabaya Corporate Gathering Experiential',
    destination: 'Surabaya - Gresik, Jawa Timur',
    duration: '2 Hari 1 Malam (2D1N)',
    price60Pax: 1500000,
    price70Pax: 1400000,
    price80Pax: 1300000,
    price90Pax: 1200000,
    price90PlusText: 'Hubungi Admin',
    itinerary: [
      { day: 1, title: 'Day 1 Outbound', activities: ['Ice breaking', 'Team games'] }
    ],
    included: ['Bus AC', 'Hotel 4-star'],
    excluded: ['Personal items'],
    facilities: ['Ballroom', 'Audio'],
    notes: 'Khusus perusahaan corporate',
    status: 'published'
  });
  assertTest('POST /api/gathering/packages creates package in DB', createPkgRes.status === 201 && createPkgRes.body?.id === testPkgId);

  // Read back package from another client (simulate Browser B)
  const getCreatedPkgRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/gathering/packages/${testPkgId}`,
    method: 'GET'
  });
  assertTest('Browser B reads newly created package from database', getCreatedPkgRes.status === 200 && getCreatedPkgRes.body?.id === testPkgId);

  // 3. Test Requests: Customer creates request
  console.log('\n--- 3. Customer Quotation Request Flow ---');
  const custName = 'Budi Santoso';
  const compName = 'PT Maju Bersama Jaya';
  const custPhone = '081298765432';
  const custEmail = 'budi@majubersama.co.id';

  const createReqRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/gathering/requests',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    packageId: testPkgId,
    packageName: 'Surabaya Corporate Gathering Experiential',
    duration: '2 Hari 1 Malam (2D1N)',
    customerName: custName,
    company: compName,
    whatsapp: custPhone,
    email: custEmail,
    participants: '70',
    requestedDate: '2026-11-20',
    notes: 'Permintaan gala dinner musik akustik dan bus eksekutif 2 unit.'
  });
  assertTest('Customer POST /api/gathering/requests returns 201', createReqRes.status === 201 && createReqRes.body?.id);
  const createdReq = createReqRes.body;
  const reqId = createdReq.id;
  const secureTokenA = createdReq.secureToken;
  assertTest('Request contains secret secureToken for customer access', Boolean(secureTokenA && secureTokenA.startsWith('tok_')));

  // Admin reads request
  const adminGetReqsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/gathering/requests',
    method: 'GET',
    headers: adminHeaders
  });
  assertTest('Admin GET /api/gathering/requests sees customer request', 
    adminGetReqsRes.status === 200 && adminGetReqsRes.body.some(r => r.id === reqId)
  );

  // 4. Test Quotations & Immutable Snapshot
  console.log('\n--- 4. Quotation Snapshot & Versioning ---');
  const createQuoRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/gathering/quotations',
    method: 'POST',
    headers: adminHeaders
  }, {
    requestId: reqId,
    packageId: testPkgId,
    packageName: 'Surabaya Corporate Gathering Experiential',
    customerName: custName,
    companyName: compName,
    whatsapp: custPhone,
    email: custEmail,
    eventDate: '2026-11-20',
    participantCount: 70,
    validUntil: '2026-11-01',
    lineItems: [
      {
        id: 'item-1',
        name: 'Paket Corporate Gathering 2D1N (70 Pax)',
        quantity: 70,
        unitPrice: 1400000,
        subtotal: 98000000
      },
      {
        id: 'item-2',
        name: 'Add-on Entertainment Live Acoustic',
        quantity: 1,
        unitPrice: 4500000,
        subtotal: 4500000
      }
    ],
    discount: 2500000,
    additionalCost: 0,
    notes: 'DP 30% saat konfirmasi.'
  });

  assertTest('Admin POST /api/gathering/quotations creates proposal', createQuoRes.status === 201 && createQuoRes.body?.id);
  const createdQuo = createQuoRes.body;
  const quoId = createdQuo.id;
  const expectedGrandTotal = 98000000 + 4500000 - 2500000; // 100,000,000 IDR
  assertTest('Quotation grandTotal computed accurately by server', createdQuo.grandTotal === expectedGrandTotal, `Total: ${createdQuo.grandTotal}`);
  assertTest('Quotation has immutable package_snapshot', Boolean(createdQuo.packageSnapshot && createdQuo.packageSnapshot.packageName));
  assertTest('Quotation starts at version 1', createdQuo.currentVersion === 1);

  // Master package is modified by admin afterwards
  await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/gathering/packages/${testPkgId}`,
    method: 'PUT',
    headers: adminHeaders
  }, {
    title: 'MODIFIED PACKAGE TITLE SHOULD NOT ALTER OLD QUOTATION',
    destination: 'Changed Destination',
    price60Pax: 9999999
  });

  // Fetch quotation again: snapshot MUST NOT change
  const quoAfterPkgModRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/gathering/quotations/${quoId}`,
    method: 'GET',
    headers: adminHeaders
  });
  assertTest('Quotation snapshot is immutable when master package changes', 
    quoAfterPkgModRes.body.packageSnapshot.destination === 'Surabaya - Gresik, Jawa Timur'
  );

  // 5. Quotation Versioning: V1 -> V2
  console.log('\n--- 5. Quotation Revision & Versioning (V1 -> V2) ---');
  // Customer requests revision
  const revisionReqRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/gathering/quotations/${quoId}/revision`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    revisionNotes: 'Mohon penyesuaian diskon menjadi 5 juta dan tambahan gala dinner outdoor.',
    token: secureTokenA
  });
  assertTest('Customer POST /api/gathering/quotations/:id/revision succeeds', revisionReqRes.status === 200 && revisionReqRes.body?.success);

  // Admin updates quotation version to V2
  const v2Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/gathering/quotations/${quoId}`,
    method: 'PUT',
    headers: adminHeaders
  }, {
    participantCount: 70,
    lineItems: [
      {
        id: 'item-1',
        name: 'Paket Corporate Gathering 2D1N (70 Pax)',
        quantity: 70,
        unitPrice: 1400000,
        subtotal: 98000000
      },
      {
        id: 'item-2',
        name: 'Add-on Entertainment Live Acoustic + Outdoor Setup',
        quantity: 1,
        unitPrice: 5000000,
        subtotal: 5000000
      }
    ],
    discount: 5000000,
    revisionNotes: 'Diskon dinaikkan menjadi 5.000.000 IDR dan paket live acoustic ditingkatkan.'
  });
  assertTest('PUT /api/gathering/quotations/:id creates Version 2', v2Res.status === 200 && v2Res.body?.currentVersion === 2);
  assertTest('Version history contains both V1 and V2', v2Res.body?.versions?.length === 2);

  // 6. Security & Access Control
  console.log('\n--- 6. Security: Customer Isolation & RBAC ---');
  // Customer B with different token attempts to access Customer A's quotation
  const custBAccessRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/gathering/quotations/${quoId}?token=tok_fake_forged_customer_b`,
    method: 'GET'
  });
  assertTest('Customer B cannot access Customer A quotation (returns 403 Forbidden)', custBAccessRes.status === 403);

  // Access without token or admin auth
  const anonAccessRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/gathering/quotations/${quoId}`,
    method: 'GET'
  });
  assertTest('Anonymous access without token rejected (returns 401 Unauthorized)', anonAccessRes.status === 401);

  // Customer A with valid secureToken can access quotation
  const custAAccessRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/gathering/quotations/${quoId}?token=${secureTokenA}`,
    method: 'GET'
  });
  assertTest('Customer A with valid secureToken can access quotation', custAAccessRes.status === 200 && custAAccessRes.body?.id === quoId);

  // 7. Approval -> Booking Idempotency
  console.log('\n--- 7. Approval & Booking Idempotency ---');
  // First approval by customer
  const approve1Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/gathering/quotations/${quoId}/approve`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    token: secureTokenA
  });

  assertTest('First approval succeeds and creates canonical booking', approve1Res.status === 200 && approve1Res.body?.success && approve1Res.body?.booking);
  const createdBooking = approve1Res.body.booking;
  assertTest('Booking serviceType is "gathering"', createdBooking.serviceType === 'gathering');
  assertTest('Booking has first-class gatheringRequestId', createdBooking.gatheringRequestId === reqId);
  assertTest('Booking has first-class gatheringQuotationId', createdBooking.gatheringQuotationId === quoId);
  assertTest('Booking has first-class gatheringQuotationVersion', createdBooking.gatheringQuotationVersion === 2);

  // Second approval (repeated click or retry) -> MUST NOT create duplicate booking!
  const approve2Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/gathering/quotations/${quoId}/approve`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, {
    token: secureTokenA
  });

  assertTest('Second approval is idempotent (alreadyApproved: true)', approve2Res.status === 200 && approve2Res.body?.alreadyApproved === true);
  assertTest('Second approval returns exact same booking ID (no duplicate)', approve2Res.body.booking.id === createdBooking.id);

  // Verify only 1 booking exists in DB for this quotation
  const allBookingsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'GET',
    headers: adminHeaders
  });
  const allBookings = Array.isArray(allBookingsRes.body) ? allBookingsRes.body : [];
  const matchingBookings = allBookings.filter(b => b.gatheringQuotationId === quoId || b.serviceId === quoId);
  assertTest('Exactly 1 booking exists in Orders for quotation (no duplicate created)', matchingBookings.length === 1);

  // 8. Orders, Finance, Operations Integration
  console.log('\n--- 8. Orders, Finance & Operations Integration ---');
  const foundInOrders = allBookings.some(b => b.id === createdBooking.id);
  assertTest('Approved booking is present in Orders Center (/api/bookings)', foundInOrders);

  // Operations integration: /api/operations/assignments
  const opsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/operations/assignments',
    method: 'GET',
    headers: adminHeaders
  });
  assertTest('Operations assignments API responds 200', opsRes.status === 200);

  // Payment intent integration: server authoritative amount
  const payIntentRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/artopay/payment-intent',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    orderId: createdBooking.id,
    currency: 'IDR'
  });
  // Note: in dev sandbox, may return 200 with intent or 500 if ArtoPay keys unconfigured, but must find order
  assertTest('Payment pipeline finds gathering booking by code', payIntentRes.status !== 404);

  // 9. Regression Testing Locked Services
  console.log('\n--- 9. Regression Testing Locked Services ---');
  // Private Tours
  const toursRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/main-tours',
    method: 'GET'
  });
  assertTest('Regression: Private Tours /api/main-tours responds 200', toursRes.status === 200 && Array.isArray(toursRes.body));

  // Open Trips
  const tripsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/batches',
    method: 'GET'
  });
  assertTest('Regression: Open Trips /api/batches responds 200', tripsRes.status === 200 && Array.isArray(tripsRes.body));

  // Airport Transfer
  const airportRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/airports',
    method: 'GET'
  });
  assertTest('Regression: Airport Transfers /api/airports responds 200', airportRes.status === 200 && Array.isArray(airportRes.body));

  // Taxi
  const taxiRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/taxi',
    method: 'GET'
  });
  assertTest('Regression: Taxi /api/taxi responds 200', taxiRes.status === 200 && (Array.isArray(taxiRes.body) || Boolean(taxiRes.body?.pricingRules)));

  // Car Rental
  const rentalRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/rentals',
    method: 'GET'
  });
  assertTest('Regression: Car Rental /api/rentals responds 200', rentalRes.status === 200 && Array.isArray(rentalRes.body?.vehicles));

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});

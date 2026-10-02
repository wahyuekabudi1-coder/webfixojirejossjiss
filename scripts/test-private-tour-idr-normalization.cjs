// ==============================================================================
// SMART JOURNEY: PRIVATE TOUR IDR-ONLY NORMALIZATION TEST SUITE
// Tests Requirements A, B, C, D, E, and Legacy Handling
// ==============================================================================

const http = require('http');

const BASE_URL = 'http://localhost:3000';
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
  console.log('🛡️  TEST SUITE: PRIVATE TOUR IDR-ONLY PRICING NORMALIZATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Authenticate Admin
  console.log('--- 1. Admin Authentication ---');
  const loginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { password: ADMIN_PASSWORD });

  assert(loginRes.status === 200 && loginRes.body.token, 'Admin login succeeded');
  const adminToken = loginRes.body.token;
  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };

  // 2. Test A: Admin saves WNI IDR + WNA IDR
  console.log('\n--- 2. Test A: Admin saves WNI IDR + WNA IDR ---');
  const testTourId = `tour-norm-${Date.now()}`;
  const tourPayload = {
    id: testTourId,
    name: 'Tour Normalization IDR Test',
    description: 'Testing strict IDR currency normalization for Private Tour',
    category: 'Adventure',
    days: 2,
    nights: 1,
    duration: '2D / 1N',
    startingPriceIDR: 1500000, // WNI: Rp 1.500.000
    wniPrice: 1500000,
    wnaPriceIDR: 2400000, // WNA: Rp 2.400.000 (Authoritative IDR)
    status: 'published'
  };

  const createRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/main-tours',
    method: 'POST',
    headers: adminHeaders
  }, tourPayload);

  assert(createRes.status === 201, `Admin POST /api/main-tours returned 201 Created (got ${createRes.status})`);
  assert(Number(createRes.body.startingPriceIDR) === 1500000, 'WNI IDR saved as 1,500,000');
  assert(Number(createRes.body.wnaPriceIDR) === 2400000, 'Authoritative WNA IDR saved as 2,400,000');

  // Verify via GET
  const getRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/main-tours/${testTourId}`,
    method: 'GET',
    headers: adminHeaders
  });
  assert(Number(getRes.body.wnaPriceIDR) === 2400000, 'GET /api/main-tours/:id returns persisted wnaPriceIDR');

  // 3. Test B: WNA booking uses WNA IDR exactly
  console.log('\n--- 3. Test B: WNA booking uses WNA IDR exactly ---');
  // Use dynamic future weekday dates (non-weekend / no peak surcharge, and fresh daily capacity)
  let dayOffset = 400 + Math.floor(Math.random() * 400);
  function getNextWeekday() {
    while (true) {
      dayOffset++;
      const d = new Date(Date.now() + dayOffset * 86400000);
      const day = d.getDay();
      if (day >= 1 && day <= 5) {
        return d.toISOString().split('T')[0];
      }
    }
  }

  const testDateB = getNextWeekday();
  const wnaBookingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    tripId: testTourId,
    serviceType: 'tour',
    date: testDateB,
    nationalityType: 'WNA',
    participantsCount: 2,
    fullName: 'Foreign Traveler',
    email: 'traveler@intl.com',
    phone: '+1234567890'
  });

  assert(wnaBookingRes.status === 201, `WNA booking created with HTTP 201 (got ${wnaBookingRes.status})`);
  // Expected: 2,400,000 * 2 = 4,800,000
  const expectedWnaTotal = 2400000 * 2;
  assert(
    wnaBookingRes.body.baseAmount === expectedWnaTotal && wnaBookingRes.body.totalPriceIDR === expectedWnaTotal,
    `WNA booking baseAmount matches exact WNA IDR (expected Rp ${expectedWnaTotal.toLocaleString('id-ID')}, got Rp ${wnaBookingRes.body.baseAmount?.toLocaleString('id-ID')})`
  );
  assert(wnaBookingRes.body.currency === 'IDR', 'Booking currency is strictly IDR');

  // 4. Test C: Client attempts to manipulate wnaPrice USD -> ignored
  console.log('\n--- 4. Test C: Client manipulation of wnaPrice USD is ignored ---');
  const testDateC = getNextWeekday();
  const usdExploitRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    tripId: testTourId,
    serviceType: 'tour',
    date: testDateC,
    nationalityType: 'WNA',
    participantsCount: 2,
    fullName: 'Manipulative Traveler',
    email: 'exploit@intl.com',
    phone: '+1234567890',
    wnaPrice: 1, // Attacker attempts to inject $1
    startingPrice: 1,
    unitPriceUSD: 1
  });

  assert(usdExploitRes.status === 201, 'Booking processed safely');
  assert(
    usdExploitRes.body.baseAmount === expectedWnaTotal,
    `Client wnaPrice USD manipulation ignored (still charged exact authoritative Rp ${expectedWnaTotal.toLocaleString('id-ID')})`
  );

  // 5. Test D: Client attempts totalPrice/totalPriceIDR manipulation -> ignored
  console.log('\n--- 5. Test D: Client manipulation of totalPrice/totalPriceIDR is ignored ---');
  const testDateD = getNextWeekday();
  const totalExploitRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    tripId: testTourId,
    serviceType: 'tour',
    date: testDateD,
    nationalityType: 'WNA',
    participantsCount: 2,
    fullName: 'Total Tamper Traveler',
    email: 'tamper@intl.com',
    phone: '+1234567890',
    totalPrice: 1000, // Attacker claims total is Rp 1000
    totalPriceIDR: 1000,
    amount: 1000
  });

  assert(totalExploitRes.status === 201, 'Booking processed safely');
  assert(
    totalExploitRes.body.baseAmount === expectedWnaTotal,
    `Client totalPrice manipulation ignored (authoritative server calculation is Rp ${expectedWnaTotal.toLocaleString('id-ID')})`
  );

  // 6. Test E: Existing Private Tour WNI pricing remains unchanged
  console.log('\n--- 6. Test E: Existing Private Tour WNI pricing remains unchanged ---');
  const wniBookingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    tripId: testTourId,
    serviceType: 'tour',
    date: '2026-11-18', // Unique non-weekend future date
    nationalityType: 'WNI',
    participantsCount: 2,
    fullName: 'Wisatawan Domestik',
    email: 'domestik@travel.id',
    phone: '+628123456789'
  });

  const expectedWniTotal = 1500000 * 2;
  assert(wniBookingRes.status === 201, `WNI booking created successfully (got status ${wniBookingRes.status})`);
  assert(
    wniBookingRes.body.baseAmount === expectedWniTotal && wniBookingRes.body.totalPriceIDR === expectedWniTotal,
    `WNI booking uses unchanged WNI price (expected Rp ${expectedWniTotal.toLocaleString('id-ID')}, got Rp ${wniBookingRes.body.baseAmount?.toLocaleString('id-ID')})`
  );

  // 7. Legacy Compatibility: Tour with NO authoritative WNA IDR value is reported, not guessed
  console.log('\n--- 7. Legacy Compatibility: Tour without WNA IDR reports error ---');
  const legacyTourId = `tour-legacy-${Date.now()}`;
  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/main-tours',
    method: 'POST',
    headers: adminHeaders
  }, {
    id: legacyTourId,
    name: 'Legacy Tour Without WNA IDR',
    category: 'Nature',
    startingPriceIDR: 1000000, // Has WNI IDR
    wniPrice: 1000000,
    startingPrice: 80, // Legacy USD
    wnaPrice: 80,
    wnaPriceIDR: 0, // No authoritative WNA IDR!
    status: 'published'
  });

  // Attempt booking for WNA on legacy tour without WNA IDR
  const legacyBookingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    tripId: legacyTourId,
    serviceType: 'tour',
    date: '2026-11-19',
    nationalityType: 'WNA',
    participantsCount: 1,
    fullName: 'Legacy Foreigner',
    email: 'legacy@intl.com',
    phone: '+1234567890'
  });

  assert(
    legacyBookingRes.status === 400 && legacyBookingRes.body.code === 'MISSING_WNA_IDR_PRICE',
    `Legacy tour without authoritative WNA IDR safely rejects WNA booking with MISSING_WNA_IDR_PRICE (Status: ${legacyBookingRes.status})`
  );

  // Verify WNI booking on this legacy tour STILL WORKS properly!
  const legacyWniRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    tripId: legacyTourId,
    serviceType: 'tour',
    date: '2026-11-20',
    nationalityType: 'WNI',
    participantsCount: 1,
    fullName: 'Legacy Domestik',
    email: 'domestik-legacy@travel.id',
    phone: '+628123456789'
  });
  assert(
    legacyWniRes.status === 201 && legacyWniRes.body.baseAmount === 1000000,
    `Legacy tour WNI booking still works at Rp 1.000.000 (got ${legacyWniRes.body.baseAmount})`
  );

  // 8. Test F: Existing Open Trip / Airport / Taxi / Car Rental regression tests
  console.log('\n--- 8. Test F: Regression verification for Open Trip, Airport, Taxi, and Rental ---');

  // F.1 Open Trip / Share Tour
  const batchesRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/batches',
    method: 'GET'
  });
  assert(batchesRes.status === 200 && Array.isArray(batchesRes.body), 'GET /api/batches succeeds');
  const availableBatch = (batchesRes.body || []).find(b => b.status === 'Open' && b.availableSeats >= 1);
  if (availableBatch) {
    const openTripRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      bookingType: 'shared',
      batchId: availableBatch.id,
      tripId: availableBatch.tripId,
      participantsCount: 1,
      fullName: 'Open Trip Traveler',
      email: 'opentrip@traveler.com',
      phone: '+628111222333'
    });
    assert(
      openTripRes.status === 201 && openTripRes.body.currency === 'IDR',
      `Open Trip booking succeeds in IDR without regression (Booking Code: ${openTripRes.body.bookingCode})`
    );
  } else {
    console.log('ℹ️ [SKIP] No open batch available for Open Trip test');
  }

  // F.2 Airport Transfer
  const airportCatRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/transport/category/airportTransfers',
    method: 'GET'
  });
  assert(airportCatRes.status === 200, 'GET /api/transport/category/airportTransfers succeeds');
  const airportRoute = (airportCatRes.body?.routes || [])[0];
  if (airportRoute) {
    const airportBookingRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      serviceType: 'airport',
      serviceId: airportRoute.id,
      date: '2026-11-21',
      fullName: 'Airport Traveler',
      email: 'airport@traveler.com',
      phone: '+628999888777'
    });
    assert(
      airportBookingRes.status === 201 && airportBookingRes.body.currency === 'IDR' && airportBookingRes.body.baseAmount === airportRoute.priceIDR,
      `Airport Transfer booking succeeds at Rp ${airportRoute.priceIDR.toLocaleString('id-ID')} IDR without regression`
    );
  }

  // F.3 Taxi Service
  const taxiCatRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/transport/category/taxiServices',
    method: 'GET'
  });
  assert(taxiCatRes.status === 200, 'GET /api/transport/category/taxiServices succeeds');
  const taxiRule = (taxiCatRes.body?.pricingRules || []).find(r => r.status === 'Active');
  if (taxiRule) {
    const taxiBookingRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      serviceType: 'taxi',
      serviceId: taxiRule.id,
      date: '2026-11-22',
      fullName: 'Taxi Traveler',
      email: 'taxi@traveler.com',
      phone: '+628777666555'
    });
    assert(
      taxiBookingRes.status === 201 && taxiBookingRes.body.currency === 'IDR',
      `Taxi booking succeeds in IDR without regression (Base Amount: Rp ${taxiBookingRes.body.baseAmount?.toLocaleString('id-ID')})`
    );
  }

  // F.4 Car Rental
  const rentalCatRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/transport/category/rentals',
    method: 'GET'
  });
  assert(rentalCatRes.status === 200, 'GET /api/transport/category/rentals succeeds');
  const rentalVehicle = (rentalCatRes.body?.vehicles || []).find(v => v.status === 'Active' || !v.status);
  if (rentalVehicle) {
    const rentalBookingRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      serviceType: 'rental',
      vehicleId: rentalVehicle.id,
      date: '2026-11-23',
      days: 2,
      fullName: 'Rental Traveler',
      email: 'rental@traveler.com',
      phone: '+628555444333'
    });
    const expectedRentalTotal = Number(rentalVehicle.pricePerDayIDR) * 2;
    assert(
      rentalBookingRes.status === 201 && rentalBookingRes.body.currency === 'IDR' && rentalBookingRes.body.baseAmount === expectedRentalTotal,
      `Car Rental booking succeeds at Rp ${expectedRentalTotal.toLocaleString('id-ID')} IDR without regression`
    );
  }

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

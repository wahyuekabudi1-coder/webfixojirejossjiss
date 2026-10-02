// ==============================================================================
// SMART JOURNEY: TAXI IDR-ONLY NORMALIZATION TEST SUITE (PHASE 4)
// Tests Requirements A to Q:
// A. Admin creates Taxi route with IDR.
// B. Normal Taxi booking remains exact IDR.
// C. Avanza multiplier remains unchanged (0.9x).
// D. Innova multiplier remains unchanged (1.0x).
// E. Alphard multiplier remains unchanged (1.5x).
// F. HiAce multiplier remains unchanged (1.8x).
// G. Area surcharge remains unchanged.
// H. Bidirectional route matching remains unchanged.
// I. Client priceUSD manipulation ignored.
// J. Client totalPrice/totalPriceIDR manipulation ignored.
// K. USD-only legacy rule safely rejected.
// L. Excel import with IDR-only columns succeeds.
// M. Excel import containing USD columns must not use USD for pricing.
// N. Private Tour regression.
// O. Open Trip regression.
// P. Airport Transfer regression.
// Q. Car Rental regression.
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

let dayOffset = 1500 + Math.floor(Math.random() * 500);
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

async function run() {
  console.log('================================================================');
  console.log('🚖  TEST SUITE: TAXI IDR-ONLY PRICING NORMALIZATION (PHASE 4)');
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

  assert(loginRes.status === 200 && loginRes.body?.token, 'Admin login succeeded');
  const token = loginRes.body?.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // Helper: Release unique code after successful booking to prevent 1-99 exhaustion
  async function completeBooking(bookingId) {
    if (!bookingId) return;
    await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/admin/bookings/${bookingId}/status`,
      method: 'PATCH',
      headers: authHeaders
    }, { status: 'Confirmed', paymentStatus: 'Paid' }).catch(() => {});
  }

  // Clear any existing pending test unique codes
  try {
    const { getDB } = require('../server/db/pool');
    const db = await getDB();
    await db.execute("UPDATE bookings SET status = 'Completed', payment_status = 'Paid' WHERE status = 'Pending Payment' OR payment_status = 'Pending'");
  } catch (e) {}

  // Test A: Admin creates Taxi route with IDR
  console.log('\n--- Test A: Admin creates Taxi route with IDR ---');
  const testRuleId = `taxi-rule-norm-${Date.now()}`;
  const testLegacyRuleId = `taxi-legacy-usd-${Date.now()}`;
  const testBidiRuleId = `taxi-bidi-${Date.now()}`;
  const testBuilderRouteId = `tx-builder-${Date.now()}`;

  // Fetch initial taxi services
  const initialTaxi = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/taxi/all',
    method: 'GET',
    headers: authHeaders
  });

  const existingAreas = [
    { id: 'area-sub', code: 'SUB', name: 'Surabaya', type: 'City' },
    { id: 'area-mlg', code: 'MLG', name: 'Malang', type: 'City' },
    { id: 'area-brm', code: 'BRM', name: 'Bromo', type: 'City' },
    { id: 'area-bidi-a', code: 'BIDA', name: 'Bidi Origin', type: 'City' },
    { id: 'area-bidi-b', code: 'BIDB', name: 'Bidi Destination', type: 'City' }
  ];
  const existingRules = initialTaxi.body?.pricingRules || [];
  const existingAreaRules = initialTaxi.body?.areaRules || [
    { id: 'ar-brm-surcharge', area_id: 'area-brm', surcharge_idr: 50000, surcharge_usd: 4, is_blackout: false }
  ];

  // Create authoritative IDR rule between Surabaya (area-sub) and Malang (area-mlg): Rp 300.000
  const newRule = {
    id: testRuleId,
    source_id: 'area-sub',
    destination_id: 'area-mlg',
    price_idr: 300000,
    status: 'Active'
  };

  // Create bidirectional test rule between area-bidi-a and area-bidi-b: Rp 320.000
  const bidiRule = {
    id: testBidiRuleId,
    source_id: 'area-bidi-a',
    destination_id: 'area-bidi-b',
    price_idr: 320000,
    status: 'Active'
  };

  // Create legacy USD-only rule for Test K
  const legacyRule = {
    id: testLegacyRuleId,
    source_id: 'area-sub',
    destination_id: 'area-mlg',
    price_usd: 25,
    price_idr: 0,
    status: 'Active'
  };

  const syncRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/taxi/sync',
    method: 'POST',
    headers: authHeaders
  }, {
    masterAreas: existingAreas,
    pricingRules: [...existingRules.filter(r => r.id !== testRuleId && r.id !== testLegacyRuleId && r.id !== testBidiRuleId), newRule, bidiRule, legacyRule],
    areaRules: existingAreaRules
  });

  assert(syncRes.status === 200 && syncRes.body?.success, 'Admin creates Taxi rule with IDR via /api/taxi/sync');

  // Also test Builder Taxi Route sync with IDR
  const builderSyncRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/builder/taxi-routes/sync',
    method: 'POST',
    headers: authHeaders
  }, {
    routes: [
      {
        id: testBuilderRouteId,
        code: 'TX-BUILD-01',
        pickupCity: 'Malang',
        pickupArea: 'Stasiun Kota',
        destinationCity: 'Surabaya',
        destinationArea: 'Bandara Juanda T2',
        vehicle: 'Toyota Innova Reborn',
        priceIDR: 450000,
        status: 'Active'
      }
    ]
  });
  assert(builderSyncRes.status === 200 && builderSyncRes.body?.success, 'Admin syncs builder Taxi route with authoritative IDR');

  // Test B: Normal Taxi booking remains exact IDR
  console.log('\n--- Test B: Normal Taxi booking remains exact IDR ---');
  const dateB = getNextWeekday();
  const bookBRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'taxi',
    serviceType: 'taxi',
    serviceId: testRuleId,
    customerName: 'Budi Santoso',
    email: 'budi.santoso@example.com',
    phone: '081234567891',
    date: dateB,
    departureDate: dateB,
    vehicleId: 'innova', // multiplier 1.0x
    pickupAreaId: 'area-sub',
    destAreaId: 'area-mlg',
    details: {
      ruleId: testRuleId,
      vehicleId: 'innova'
    }
  });

  assert(bookBRes.status === 201, `Taxi booking created successfully (HTTP ${bookBRes.status})`);
  assert(bookBRes.body?.currency === 'IDR', 'Taxi booking currency is IDR');
  assert(bookBRes.body?.baseAmount === 300000, `Taxi booking baseAmount is exactly Rp 300.000 (actual: ${bookBRes.body?.baseAmount})`);
  assert(bookBRes.body?.totalPrice === 300000, `Taxi booking totalPrice is Rp 300.000`);
  await completeBooking(bookBRes.body?.id);

  // Test C: Avanza multiplier remains unchanged (0.9x)
  console.log('\n--- Test C: Avanza multiplier remains unchanged (0.9x) ---');
  const dateC = getNextWeekday();
  const bookCRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'taxi',
    serviceType: 'taxi',
    serviceId: testRuleId,
    customerName: 'Avanza Passenger',
    email: 'avanza@example.com',
    phone: '081234567892',
    date: dateC,
    departureDate: dateC,
    vehicleId: 'avanza', // multiplier 0.9x -> 300000 * 0.9 = 270000
    pickupAreaId: 'area-sub',
    destAreaId: 'area-mlg',
    details: {
      ruleId: testRuleId,
      vehicleId: 'avanza'
    }
  });

  assert(bookCRes.status === 201 && bookCRes.body?.baseAmount === 270000, `Avanza multiplier 0.9x applies correctly: 300.000 * 0.9 = Rp 270.000 (actual: ${bookCRes.body?.baseAmount})`);
  await completeBooking(bookCRes.body?.id);

  // Test D: Innova multiplier remains unchanged (1.0x)
  console.log('\n--- Test D: Innova multiplier remains unchanged (1.0x) ---');
  const dateD = getNextWeekday();
  const bookDRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'taxi',
    serviceType: 'taxi',
    serviceId: testRuleId,
    customerName: 'Innova Passenger',
    email: 'innova@example.com',
    phone: '081234567893',
    date: dateD,
    departureDate: dateD,
    vehicleId: 'innova', // multiplier 1.0x -> 300000 * 1.0 = 300000
    pickupAreaId: 'area-sub',
    destAreaId: 'area-mlg',
    details: {
      ruleId: testRuleId,
      vehicleId: 'innova'
    }
  });

  assert(bookDRes.status === 201 && bookDRes.body?.baseAmount === 300000, `Innova multiplier 1.0x applies correctly: 300.000 * 1.0 = Rp 300.000 (actual: ${bookDRes.body?.baseAmount})`);
  await completeBooking(bookDRes.body?.id);

  // Test E: Alphard multiplier remains unchanged (1.5x)
  console.log('\n--- Test E: Alphard multiplier remains unchanged (1.5x) ---');
  const dateE = getNextWeekday();
  const bookERes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'taxi',
    serviceType: 'taxi',
    serviceId: testRuleId,
    customerName: 'Alphard VIP Passenger',
    email: 'alphard@example.com',
    phone: '081234567894',
    date: dateE,
    departureDate: dateE,
    vehicleId: 'alphard', // multiplier 1.5x -> 300000 * 1.5 = 450000
    pickupAreaId: 'area-sub',
    destAreaId: 'area-mlg',
    details: {
      ruleId: testRuleId,
      vehicleId: 'alphard'
    }
  });

  assert(bookERes.status === 201 && bookERes.body?.baseAmount === 450000, `Alphard multiplier 1.5x applies correctly: 300.000 * 1.5 = Rp 450.000 (actual: ${bookERes.body?.baseAmount})`);
  await completeBooking(bookERes.body?.id);

  // Test F: HiAce multiplier remains unchanged (1.8x)
  console.log('\n--- Test F: HiAce multiplier remains unchanged (1.8x) ---');
  const dateF = getNextWeekday();
  const bookFRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'taxi',
    serviceType: 'taxi',
    serviceId: testRuleId,
    customerName: 'HiAce Group Passenger',
    email: 'hiace@example.com',
    phone: '081234567895',
    date: dateF,
    departureDate: dateF,
    vehicleId: 'hiace', // multiplier 1.8x -> 300000 * 1.8 = 540000
    pickupAreaId: 'area-sub',
    destAreaId: 'area-mlg',
    details: {
      ruleId: testRuleId,
      vehicleId: 'hiace'
    }
  });

  assert(bookFRes.status === 201 && bookFRes.body?.baseAmount === 540000, `HiAce multiplier 1.8x applies correctly: 300.000 * 1.8 = Rp 540.000 (actual: ${bookFRes.body?.baseAmount})`);
  await completeBooking(bookFRes.body?.id);

  // Test G: Area surcharge remains unchanged
  console.log('\n--- Test G: Area surcharge remains unchanged ---');
  // Check Bromo area surcharge: area-brm has surcharge_idr 50000
  // taxi-rule-sub-brm has base price 650000. With Innova (1.0x) + 50000 surcharge = 700000
  const dateG = getNextWeekday();
  const bookGRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'taxi',
    serviceType: 'taxi',
    customerName: 'Bromo Surcharge Passenger',
    email: 'bromo@example.com',
    phone: '081234567896',
    date: dateG,
    departureDate: dateG,
    vehicleId: 'innova',
    pickupAreaId: 'area-sub',
    destAreaId: 'area-brm',
    details: {
      pickupLocation: 'Surabaya',
      destination: 'Bromo',
      vehicleId: 'innova'
    }
  });

  assert(bookGRes.status === 201, `Booking with Area surcharge succeeded (HTTP ${bookGRes.status})`);
  assert(bookGRes.body?.baseAmount === 700000, `Area surcharge +Rp 50.000 IDR added correctly: 650.000 + 50.000 = Rp 700.000 (actual: ${bookGRes.body?.baseAmount})`);
  await completeBooking(bookGRes.body?.id);

  // Test H: Bidirectional route matching remains unchanged
  console.log('\n--- Test H: Bidirectional route matching remains unchanged ---');
  // bidiRule was created with source area-bidi-a and dest area-bidi-b: 320000 IDR
  // Now book reversed: pickup in area-bidi-b and destination in area-bidi-a.
  const dateH = getNextWeekday();
  const bookHRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'taxi',
    serviceType: 'taxi',
    customerName: 'Reversed Route Passenger',
    email: 'reverse@example.com',
    phone: '081234567897',
    date: dateH,
    departureDate: dateH,
    vehicleId: 'innova', // 1.0x
    pickupAreaId: 'area-bidi-b',
    destAreaId: 'area-bidi-a',
    details: {
      pickupLocation: 'Bidi Destination',
      destination: 'Bidi Origin',
      vehicleId: 'innova'
    }
  });

  assert(bookHRes.status === 201, `Bidirectional route booking succeeded (HTTP ${bookHRes.status})`);
  assert(bookHRes.body?.baseAmount === 320000, `Bidirectional matched rule price accurately: Rp 320.000 (actual: ${bookHRes.body?.baseAmount})`);
  await completeBooking(bookHRes.body?.id);

  // Test I: Client priceUSD manipulation ignored
  console.log('\n--- Test I: Client priceUSD manipulation ignored ---');
  const dateI = getNextWeekday();
  const bookIRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'taxi',
    serviceType: 'taxi',
    serviceId: testRuleId,
    customerName: 'Hacker USD',
    email: 'hacker1@example.com',
    phone: '081234567898',
    date: dateI,
    departureDate: dateI,
    vehicleId: 'innova',
    pickupAreaId: 'area-sub',
    destAreaId: 'area-mlg',
    priceUSD: 1, // Manipulated
    price_usd: 1, // Manipulated
    customPrice: 1, // Manipulated
    details: {
      ruleId: testRuleId,
      vehicleId: 'innova',
      priceUSD: 1
    }
  });

  assert(bookIRes.status === 201, `Booking created (HTTP ${bookIRes.status})`);
  assert(bookIRes.body?.currency === 'IDR' && bookIRes.body?.baseAmount === 300000, `Client priceUSD manipulation ignored; server authoritative price Rp 300.000 enforced (actual: ${bookIRes.body?.baseAmount})`);
  await completeBooking(bookIRes.body?.id);

  // Test J: Client totalPrice/totalPriceIDR manipulation ignored
  console.log('\n--- Test J: Client totalPrice/totalPriceIDR manipulation ignored ---');
  const dateJ = getNextWeekday();
  const bookJRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'taxi',
    serviceType: 'taxi',
    serviceId: testRuleId,
    customerName: 'Hacker Total',
    email: 'hacker2@example.com',
    phone: '081234567899',
    date: dateJ,
    departureDate: dateJ,
    vehicleId: 'innova',
    pickupAreaId: 'area-sub',
    destAreaId: 'area-mlg',
    totalPrice: 100, // Manipulated
    totalPriceIDR: 100, // Manipulated
    amount: 100, // Manipulated
    details: {
      ruleId: testRuleId,
      vehicleId: 'innova',
      totalPrice: 100,
      totalPriceIDR: 100
    }
  });

  assert(bookJRes.status === 201, `Booking created (HTTP ${bookJRes.status})`);
  assert(bookJRes.body?.currency === 'IDR' && bookJRes.body?.baseAmount === 300000 && bookJRes.body?.totalPrice === 300000, `Client totalPrice/totalPriceIDR manipulation ignored; server authoritative price Rp 300.000 enforced (actual base: ${bookJRes.body?.baseAmount}, total: ${bookJRes.body?.totalPrice})`);
  await completeBooking(bookJRes.body?.id);

  // Test K: USD-only legacy rule safely rejected
  console.log('\n--- Test K: USD-only legacy rule safely rejected ---');
  const dateK = getNextWeekday();
  const bookKRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'taxi',
    serviceType: 'taxi',
    serviceId: testLegacyRuleId,
    customerName: 'Legacy Rule Tester',
    email: 'legacy@example.com',
    phone: '081234567810',
    date: dateK,
    departureDate: dateK,
    vehicleId: 'innova',
    details: {
      ruleId: testLegacyRuleId,
      vehicleId: 'innova'
    }
  });

  assert(bookKRes.status === 400, `USD-only legacy taxi rule safely rejected with HTTP 400 (actual: ${bookKRes.status})`);
  assert(bookKRes.body?.code === 'TAXI_LEGACY_USD_UNSUPPORTED', `Rejection error code is TAXI_LEGACY_USD_UNSUPPORTED (actual: ${bookKRes.body?.code})`);

  // Test L: Excel import with IDR-only columns succeeds
  console.log('\n--- Test L: Excel import with IDR-only columns succeeds ---');
  const importedRuleIdL = `taxi-imported-idr-only-${Date.now()}`;
  const importLRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/taxi/import-excel',
    method: 'POST',
    headers: authHeaders
  }, {
    importedRules: [
      {
        id: importedRuleIdL,
        source_id: 'area-sub',
        destination_id: 'area-mlg',
        vehicle_type: 'Family',
        price_idr: 350000,
        status: 'Active'
      }
    ],
    historyEntry: {
      id: `IMP-TEST-L`,
      date: new Date().toISOString(),
      filename: 'idr_only_routes.xlsx',
      importedBy: 'Admin Test',
      importedRows: 1,
      status: 'Success'
    }
  });

  assert(importLRes.status === 200 && importLRes.body?.success, 'Excel import with IDR-only columns succeeds');

  // Verify the imported IDR-only rule works in booking
  const dateL = getNextWeekday();
  const bookLRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'taxi',
    serviceType: 'taxi',
    serviceId: importedRuleIdL,
    customerName: 'Import IDR Only Passenger',
    email: 'importl@example.com',
    phone: '081234567811',
    date: dateL,
    departureDate: dateL,
    vehicleId: 'innova',
    details: {
      ruleId: importedRuleIdL,
      vehicleId: 'innova'
    }
  });

  assert(bookLRes.status === 201 && bookLRes.body?.baseAmount === 350000, `Imported IDR-only rule books at exact Rp 350.000 IDR (actual: ${bookLRes.body?.baseAmount})`);
  await completeBooking(bookLRes.body?.id);

  // Test M: Excel import containing USD columns must not use USD for pricing
  console.log('\n--- Test M: Excel import containing USD columns must not use USD for pricing ---');
  const importedRuleIdM = `taxi-imported-with-usd-${Date.now()}`;
  const importMRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/taxi/import-excel',
    method: 'POST',
    headers: authHeaders
  }, {
    importedRules: [
      {
        id: importedRuleIdM,
        source_id: 'area-sub',
        destination_id: 'area-mlg',
        vehicle_type: 'Family',
        price_idr: 400000,
        price_usd: 999, // Conflicting USD value from Excel column
        status: 'Active'
      }
    ]
  });

  assert(importMRes.status === 200 && importMRes.body?.success, 'Import with USD column succeeds');

  const dateM = getNextWeekday();
  const bookMRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'taxi',
    serviceType: 'taxi',
    serviceId: importedRuleIdM,
    customerName: 'Import USD Column Passenger',
    email: 'importm@example.com',
    phone: '081234567812',
    date: dateM,
    departureDate: dateM,
    vehicleId: 'innova',
    details: {
      ruleId: importedRuleIdM,
      vehicleId: 'innova'
    }
  });

  assert(bookMRes.status === 201 && bookMRes.body?.baseAmount === 400000, `Excel USD column ignored for transaction pricing; exact authoritative IDR Rp 400.000 used (actual: ${bookMRes.body?.baseAmount})`);
  await completeBooking(bookMRes.body?.id);

  // Test N: Private Tour regression
  console.log('\n--- Test N: Private Tour regression check ---');
  const toursRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/main-tours',
    method: 'GET'
  });
  assert(toursRes.status === 200, 'GET /api/main-tours succeeds');
  const sampleTour = (Array.isArray(toursRes.body) ? toursRes.body : [])[0];
  if (sampleTour) {
    const dateN = getNextWeekday();
    const tourBookRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      type: 'tour',
      serviceType: 'tour',
      tripId: sampleTour.id,
      tourId: sampleTour.id,
      customerName: 'Private Tour Regr Traveler',
      email: 'tour.regr@example.com',
      phone: '081234567813',
      date: dateN,
      departureDate: dateN,
      participantsCount: 2,
      count: 2,
      nationalityType: 'WNI',
      details: {
        tourId: sampleTour.id,
        participantsCount: 2,
        nationalityType: 'WNI'
      }
    });
    assert(tourBookRes.status === 201 && tourBookRes.body?.currency === 'IDR', `Private tour booking succeeds at Rp ${tourBookRes.body?.baseAmount?.toLocaleString('id-ID')} IDR without regression`);
    await completeBooking(tourBookRes.body?.id);
  } else {
    console.log('ℹ️  No tours configured; skipping private tour booking test.');
  }

  // Test O: Open Trip regression
  console.log('\n--- Test O: Open Trip regression check ---');
  const shareTripsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/trips',
    method: 'GET'
  });
  assert(shareTripsRes.status === 200, 'GET /api/trips succeeds');
  const sampleShareTrip = (Array.isArray(shareTripsRes.body) ? shareTripsRes.body : (shareTripsRes.body?.trips || []))[0];
  if (sampleShareTrip) {
    const batchesRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/trips/${sampleShareTrip.id}/batches`,
      method: 'GET'
    });
    const sampleBatch = (Array.isArray(batchesRes.body) ? batchesRes.body : [])[0];
    if (sampleBatch) {
      const openTripBookingRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/bookings',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        type: 'share-tour',
        serviceType: 'share-tour',
        tripId: sampleShareTrip.id,
        batchId: sampleBatch.id,
        customerName: 'Open Trip Regr Traveler',
        email: 'opentrip.regr@example.com',
        phone: '081234567814',
        participants: 1,
        count: 1,
        nationalityType: 'WNI',
        details: {
          tripId: sampleShareTrip.id,
          batchId: sampleBatch.id,
          participants: 1,
          nationalityType: 'WNI'
        }
      });
      assert(openTripBookingRes.status === 201 && openTripBookingRes.body?.currency === 'IDR', `Open Trip booking succeeds in IDR without regression`);
      await completeBooking(openTripBookingRes.body?.id);
    } else {
      console.log('ℹ️  No open trip batch found; skipping open trip booking test.');
    }
  } else {
    console.log('ℹ️  No open trips found; skipping open trip booking test.');
  }

  // Test P: Airport Transfer regression
  console.log('\n--- Test P: Airport Transfer regression check ---');
  const airportRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/airport-routes',
    method: 'GET'
  });
  assert(airportRes.status === 200, 'GET /api/airport-routes succeeds');
  const airportRoute = (Array.isArray(airportRes.body) ? airportRes.body : (airportRes.body?.routes || []))[0];
  if (airportRoute) {
    const dateP = getNextWeekday();
    const airportBookingRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      type: 'airport',
      serviceType: 'airport',
      serviceId: airportRoute.id,
      customerName: 'Airport Regr Traveler',
      email: 'airport.regr@example.com',
      phone: '081234567815',
      date: dateP,
      departureDate: dateP,
      vehicleId: 'innova',
      airport: airportRoute.airport,
      destination: airportRoute.city,
      details: {
        routeId: airportRoute.id,
        airport: airportRoute.airport,
        destination: airportRoute.city,
        vehicleId: 'innova'
      }
    });
    assert(airportBookingRes.status === 201 && airportBookingRes.body?.currency === 'IDR', `Airport Transfer booking succeeds in IDR without regression (Rp ${airportBookingRes.body?.baseAmount?.toLocaleString('id-ID')})`);
    await completeBooking(airportBookingRes.body?.id);
  } else {
    console.log('ℹ️  No airport routes found; skipping airport transfer booking test.');
  }

  // Test Q: Car Rental regression
  console.log('\n--- Test Q: Car Rental regression check ---');
  const rentalRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/rentals',
    method: 'GET'
  });
  assert(rentalRes.status === 200, 'GET /api/rentals succeeds');
  const rentalVehicle = (rentalRes.body?.vehicles || [])[0];
  if (rentalVehicle) {
    const dateQ = getNextWeekday();
    const rentalBookingRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      type: 'rental',
      serviceType: 'rental',
      serviceId: rentalVehicle.id,
      customerName: 'Rental Regr Traveler',
      email: 'rental.regr@example.com',
      phone: '081234567816',
      date: dateQ,
      departureDate: dateQ,
      rentalDays: 1,
      details: {
        vehicleId: rentalVehicle.id,
        rentalDays: 1
      }
    });
    assert(rentalBookingRes.status === 201 && rentalBookingRes.body?.currency === 'IDR', `Car rental booking succeeds in IDR without regression (Rp ${rentalBookingRes.body?.baseAmount?.toLocaleString('id-ID')})`);
    await completeBooking(rentalBookingRes.body?.id);
  } else {
    console.log('ℹ️  No rental vehicles configured; skipping rental booking test.');
  }

  // Summary
  console.log('\n================================================================');
  console.log(`📊 FINAL TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

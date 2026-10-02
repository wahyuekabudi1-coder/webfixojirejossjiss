// ==============================================================================
// SMART JOURNEY: AIRPORT TRANSFER IDR-ONLY NORMALIZATION TEST SUITE
// Tests Requirements A to M:
// A. Admin creates route with IDR.
// B. Route booking uses exact IDR.
// C. Round-trip formula remains unchanged (routePrice * 2 * 0.95).
// D. Vehicle multipliers remain unchanged (Avanza 0.9x, Innova 1.0x, Hiace Commuter 1.5x, Hiace Premio 1.8x).
// E. Child-seat surcharge remains unchanged (+Rp 75.000 IDR).
// F. Airport surcharge uses authoritative IDR.
// G. Client priceUSD manipulation is ignored.
// H. Client totalPrice/totalPriceIDR manipulation is ignored.
// I. Legacy USD-only route is safely rejected.
// J. Private Tour regression.
// K. Open Trip regression.
// L. Taxi regression.
// M. Car Rental regression.
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

let dayOffset = 500 + Math.floor(Math.random() * 300);
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
  console.log('✈️  TEST SUITE: AIRPORT TRANSFER IDR-ONLY PRICING NORMALIZATION');
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

  // Test A: Admin creates route with IDR
  console.log('\n--- Test A: Admin creates Airport Transfer route with IDR ---');
  const routeIDRPrice = 450000;
  const testSubRouteId = `airport-route-sub-${Date.now()}`;
  const testMlgRouteId = `airport-route-mlg-${Date.now()}`;
  const legacyRouteId = `legacy-usd-only-${Date.now()}`;

  const syncPayload = {
    airports: [
      {
        code: 'SUB',
        name: 'Juanda International Airport (SUB)',
        surchargeIDR: 0,
        status: 'Active'
      },
      {
        code: 'MLG',
        name: 'Abdul Rachman Saleh Airport (MLG)',
        surchargeIDR: 50000,
        surchargeUSD: 3,
        status: 'Active'
      }
    ],
    routes: [
      {
        id: testSubRouteId,
        airport: 'SUB',
        city: 'Surabaya Center',
        priceIDR: routeIDRPrice,
        priceUSD: 999, // Should be normalized/derived from IDR
        status: 'Published'
      },
      {
        id: testMlgRouteId,
        airport: 'MLG',
        city: 'Batu Highlands',
        priceIDR: routeIDRPrice,
        priceUSD: 999,
        status: 'Published'
      },
      {
        id: legacyRouteId,
        airport: 'SUB',
        city: 'Legacy Forgotten City',
        priceUSD: 40,
        priceIDR: 0, // Legacy USD-only
        status: 'Published'
      }
    ]
  };

  const syncRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/airport-transfers/sync',
    method: 'POST',
    headers: authHeaders
  }, syncPayload);

  assert(syncRes.status === 200 && syncRes.body?.success, 'POST /api/airport-transfers/sync succeeds');
  const savedSubRoute = (syncRes.body?.airportTransfers?.routes || []).find(r => r.id === testSubRouteId);
  assert(savedSubRoute && savedSubRoute.priceIDR === routeIDRPrice, `Route saved with authoritative IDR price: Rp ${routeIDRPrice.toLocaleString('id-ID')}`);
  assert(savedSubRoute && savedSubRoute.priceUSD === Math.round(routeIDRPrice / 16000), `Route priceUSD normalized to display preview (${Math.round(routeIDRPrice / 16000)})`);

  // Builder sync verification (Requirement 3)
  console.log('\n--- Requirement 3: Builder Transfer Sync uses IDR as transactional source ---');
  const testBuilderTransferId = `builder-ap-${Date.now()}`;
  const builderIDRPrice = 600000;
  const builderSyncPayload = {
    transfers: [
      {
        id: testBuilderTransferId,
        airportName: 'Bandara Juanda (SUB)',
        direction: 'Arrival',
        destinationArea: 'Malang Kota Center',
        vehicle: 'Toyota Innova Reborn',
        maxPassengers: 6,
        maxLuggage: 4,
        meetAndGreet: true,
        flightNumRequired: true,
        priceIDR: builderIDRPrice,
        price: 999, // Sent by legacy builder client; backend must normalize
        status: 'Active'
      }
    ]
  };

  const builderSyncRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/builder/airport-transfers/sync',
    method: 'POST',
    headers: authHeaders
  }, builderSyncPayload);

  assert(builderSyncRes.status === 200 && builderSyncRes.body?.success, 'POST /api/builder/airport-transfers/sync succeeds');
  const savedBuilderItem = (builderSyncRes.body?.transfers || []).find(t => t.id === testBuilderTransferId);
  assert(savedBuilderItem && savedBuilderItem.priceIDR === builderIDRPrice, `Builder transfer saved with IDR price: Rp ${builderIDRPrice.toLocaleString('id-ID')}`);
  assert(savedBuilderItem && savedBuilderItem.price === Math.round(builderIDRPrice / 16000), `Builder transfer price (USD) normalized to derived display preview: $${Math.round(builderIDRPrice / 16000)}`);

  // Test B: Route booking uses exact IDR
  console.log('\n--- Test B: Route booking uses exact authoritative IDR ---');
  const dateB = getNextWeekday();
  const bookingBRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'airport',
    serviceType: 'airport',
    serviceId: testSubRouteId,
    customerName: 'Test Traveler B',
    email: 'traveler.b@example.com',
    phone: '081234567890',
    date: dateB,
    departureDate: dateB,
    vehicleId: 'innova',
    routeType: 'One Way',
    airport: 'SUB', // SUB has 0 surcharge
    details: {
      routeId: testSubRouteId,
      airport: 'SUB',
      routeType: 'One Way',
      vehicleId: 'innova'
    }
  });

  assert(bookingBRes.status === 201, `Booking B created successfully with HTTP 201 (got ${bookingBRes.status})`);
  assert(bookingBRes.body?.currency === 'IDR', 'Booking B currency is authoritative IDR');
  assert(bookingBRes.body?.baseAmount === routeIDRPrice, `Booking B baseAmount matches exact IDR price (Rp ${routeIDRPrice.toLocaleString('id-ID')})`);
  assert(bookingBRes.body?.paymentAmount === routeIDRPrice + bookingBRes.body?.uniqueCode, 'Booking B paymentAmount matches baseAmount + uniqueCode');

  // Test C: Round-trip formula remains unchanged (routePrice * 2 * 0.95)
  console.log('\n--- Test C: Round-trip formula remains unchanged (5% discount) ---');
  const dateC = getNextWeekday();
  const expectedRoundTripBase = Math.round(routeIDRPrice * 2 * 0.95); // 450,000 * 2 * 0.95 = 855,000
  const bookingCRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'airport',
    serviceType: 'airport',
    serviceId: testSubRouteId,
    customerName: 'Test Traveler C',
    email: 'traveler.c@example.com',
    phone: '081234567891',
    date: dateC,
    departureDate: dateC,
    vehicleId: 'innova',
    routeType: 'Round Trip',
    airport: 'SUB',
    details: {
      routeId: testSubRouteId,
      airport: 'SUB',
      routeType: 'Round Trip',
      vehicleId: 'innova'
    }
  });

  assert(bookingCRes.status === 201, `Booking C (Round Trip) created successfully (got ${bookingCRes.status})`);
  assert(bookingCRes.body?.baseAmount === expectedRoundTripBase, `Booking C round trip baseAmount matches canonical formula (Rp ${expectedRoundTripBase.toLocaleString('id-ID')})`);

  // Test D: Vehicle multipliers remain unchanged
  console.log('\n--- Test D: Vehicle multipliers remain unchanged ---');
  // Avanza = 0.9x, HiAce Commuter = 1.5x, HiAce Premio = 1.8x
  const avanzaExpected = Math.round(routeIDRPrice * 0.9); // 405,000
  const hiaceCommuterExpected = Math.round(routeIDRPrice * 1.5); // 675,000
  const hiacePremioExpected = Math.round(routeIDRPrice * 1.8); // 810,000

  const dateD1 = getNextWeekday();
  const bookingDAvanza = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'airport',
    serviceType: 'airport',
    serviceId: testSubRouteId,
    customerName: 'Test Traveler Avanza',
    email: 'avanza@example.com',
    phone: '081234567892',
    date: dateD1,
    departureDate: dateD1,
    vehicleId: 'avanza',
    airport: 'SUB',
    details: { routeId: testSubRouteId, airport: 'SUB', vehicleId: 'avanza' }
  });
  assert(bookingDAvanza.status === 201 && bookingDAvanza.body?.baseAmount === avanzaExpected, `Avanza multiplier (0.9x) gives Rp ${avanzaExpected.toLocaleString('id-ID')}`);

  const dateD2 = getNextWeekday();
  const bookingDHiace = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'airport',
    serviceType: 'airport',
    serviceId: testSubRouteId,
    customerName: 'Test Traveler Hiace',
    email: 'hiace@example.com',
    phone: '081234567893',
    date: dateD2,
    departureDate: dateD2,
    vehicleId: 'hiace-commuter',
    airport: 'SUB',
    details: { routeId: testSubRouteId, airport: 'SUB', vehicleId: 'hiace-commuter' }
  });
  assert(bookingDHiace.status === 201 && bookingDHiace.body?.baseAmount === hiaceCommuterExpected, `Hiace Commuter multiplier (1.5x) gives Rp ${hiaceCommuterExpected.toLocaleString('id-ID')}`);

  const dateD3 = getNextWeekday();
  const bookingDPremio = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'airport',
    serviceType: 'airport',
    serviceId: testSubRouteId,
    customerName: 'Test Traveler Premio',
    email: 'premio@example.com',
    phone: '081234567894',
    date: dateD3,
    departureDate: dateD3,
    vehicleId: 'hiace-premio',
    airport: 'SUB',
    details: { routeId: testSubRouteId, airport: 'SUB', vehicleId: 'hiace-premio' }
  });
  assert(bookingDPremio.status === 201 && bookingDPremio.body?.baseAmount === hiacePremioExpected, `Hiace Premio multiplier (1.8x) gives Rp ${hiacePremioExpected.toLocaleString('id-ID')}`);

  // Test E: Child-seat surcharge remains unchanged (+Rp 75.000 IDR)
  console.log('\n--- Test E: Child-seat surcharge remains unchanged (+Rp 75.000 IDR) ---');
  const dateE = getNextWeekday();
  const expectedWithChildSeat = routeIDRPrice + 75000; // 525,000
  const bookingERes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'airport',
    serviceType: 'airport',
    serviceId: testSubRouteId,
    customerName: 'Test Traveler E',
    email: 'traveler.e@example.com',
    phone: '081234567895',
    date: dateE,
    departureDate: dateE,
    vehicleId: 'innova',
    airport: 'SUB',
    childSeat: true,
    details: {
      routeId: testSubRouteId,
      airport: 'SUB',
      vehicleId: 'innova',
      childSeat: true
    }
  });

  assert(bookingERes.status === 201, `Booking E (with Child Seat) created successfully (got ${bookingERes.status})`);
  assert(bookingERes.body?.baseAmount === expectedWithChildSeat, `Booking E baseAmount includes exact child seat surcharge (+Rp 75.000 -> Rp ${expectedWithChildSeat.toLocaleString('id-ID')})`);

  // Test F: Airport surcharge uses authoritative IDR
  console.log('\n--- Test F: Airport surcharge uses authoritative IDR ---');
  const dateF = getNextWeekday();
  // MLG hub has surchargeIDR = 50,000
  const expectedWithHubSurcharge = routeIDRPrice + 50000; // 500,000
  const bookingFRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'airport',
    serviceType: 'airport',
    serviceId: testMlgRouteId,
    customerName: 'Test Traveler F',
    email: 'traveler.f@example.com',
    phone: '081234567896',
    date: dateF,
    departureDate: dateF,
    vehicleId: 'innova',
    airport: 'MLG',
    details: {
      routeId: testMlgRouteId,
      airport: 'MLG',
      vehicleId: 'innova'
    }
  });

  assert(bookingFRes.status === 201, `Booking F (with Airport Hub Surcharge) created successfully (got ${bookingFRes.status})`);
  assert(bookingFRes.body?.baseAmount === expectedWithHubSurcharge, `Booking F baseAmount includes authoritative IDR surcharge (+Rp 50.000 -> Rp ${expectedWithHubSurcharge.toLocaleString('id-ID')})`);

  // Test G: Client priceUSD manipulation is ignored
  console.log('\n--- Test G: Client priceUSD manipulation is ignored ---');
  const dateG = getNextWeekday();
  const bookingGRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'airport',
    serviceType: 'airport',
    serviceId: testSubRouteId,
    customerName: 'Test Traveler G Attacker',
    email: 'attacker.g@example.com',
    phone: '081234567897',
    date: dateG,
    departureDate: dateG,
    vehicleId: 'innova',
    airport: 'SUB',
    priceUSD: 1, // Attacker attempts $1 USD
    price: 1,
    details: {
      routeId: testSubRouteId,
      airport: 'SUB',
      vehicleId: 'innova',
      priceUSD: 1
    }
  });

  assert(bookingGRes.status === 201, 'Booking G processed');
  assert(bookingGRes.body?.baseAmount === routeIDRPrice, `Client priceUSD manipulation ignored; baseAmount remains Rp ${routeIDRPrice.toLocaleString('id-ID')}`);

  // Test H: Client totalPrice / totalPriceIDR manipulation is ignored
  console.log('\n--- Test H: Client totalPrice / totalPriceIDR manipulation is ignored ---');
  const dateH = getNextWeekday();
  const bookingHRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'airport',
    serviceType: 'airport',
    serviceId: testSubRouteId,
    customerName: 'Test Traveler H Attacker',
    email: 'attacker.h@example.com',
    phone: '081234567898',
    date: dateH,
    departureDate: dateH,
    vehicleId: 'innova',
    airport: 'SUB',
    totalPrice: 100,
    totalPriceIDR: 100, // Attacker attempts Rp 100 IDR
    details: {
      routeId: testSubRouteId,
      airport: 'SUB',
      vehicleId: 'innova',
      totalPriceIDR: 100
    }
  });

  assert(bookingHRes.status === 201, 'Booking H processed');
  assert(bookingHRes.body?.baseAmount === routeIDRPrice, `Client totalPriceIDR manipulation ignored; baseAmount remains Rp ${routeIDRPrice.toLocaleString('id-ID')}`);

  // Test I: Legacy USD-only route is safely rejected
  console.log('\n--- Test I: Legacy USD-only route is safely rejected ---');
  const dateI = getNextWeekday();
  const bookingIRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'airport',
    serviceType: 'airport',
    serviceId: legacyRouteId,
    customerName: 'Test Traveler I',
    email: 'traveler.i@example.com',
    phone: '081234567899',
    date: dateI,
    departureDate: dateI,
    vehicleId: 'innova',
    airport: 'SUB',
    details: {
      routeId: legacyRouteId,
      airport: 'SUB',
      vehicleId: 'innova'
    }
  });

  assert(bookingIRes.status === 400, `Booking for legacy USD-only route is safely rejected with HTTP 400 (got ${bookingIRes.status})`);
  assert(
    bookingIRes.body?.code === 'AIRPORT_LEGACY_USD_UNSUPPORTED' || String(bookingIRes.body?.error).includes('IDR'),
    `Rejection error message clearly indicates missing IDR configuration: "${bookingIRes.body?.error}"`
  );

  // Test J: Private Tour regression
  console.log('\n--- Test J: Private Tour regression check ---');
  const testTourId = `tour-regr-${Date.now()}`;
  const tourCreateRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/main-tours',
    method: 'POST',
    headers: authHeaders
  }, {
    id: testTourId,
    name: 'Private Tour Regression Test',
    description: 'Testing private tour regression',
    category: 'Adventure',
    days: 2,
    nights: 1,
    duration: '2D / 1N',
    startingPriceIDR: 1500000,
    wniPrice: 1500000,
    wnaPriceIDR: 2400000,
    status: 'published'
  });
  assert(tourCreateRes.status === 201, 'POST /api/main-tours succeeds');

  const dateJ = getNextWeekday();
  const tourBookingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'tour',
    serviceType: 'tour',
    serviceId: testTourId,
    customerName: 'Private Tour Regr Traveler',
    email: 'private.tour@example.com',
    phone: '081234567800',
    date: dateJ,
    departureDate: dateJ,
    participants: 2,
    count: 2,
    nationalityType: 'WNI',
    details: {
      participants: 2,
      nationalityType: 'WNI'
    }
  });
  assert(tourBookingRes.status === 201 && tourBookingRes.body?.currency === 'IDR', `Private tour booking succeeds at Rp ${tourBookingRes.body?.baseAmount?.toLocaleString('id-ID')} IDR without regression`);

  // Test K: Open Trip regression
  console.log('\n--- Test K: Open Trip regression check ---');
  const testTripId = `trip-regr-${Date.now()}`;
  const testBatchId = `batch-regr-${Date.now()}`;
  const dateK = getNextWeekday();

  const tripCreateRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/trips',
    method: 'POST',
    headers: authHeaders
  }, {
    id: testTripId,
    title: 'Open Trip Regression Test',
    location: 'East Java',
    category: 'Adventure',
    duration: '2D / 1N',
    days: 2,
    nights: 1,
    description: 'Testing Open Trip regression',
    startingPriceIDR: 450000,
    wniPrice: 450000,
    price: 450000,
    wnaPriceIDR: 650000,
    status: 'published'
  });
  assert(tripCreateRes.status === 201, 'POST /api/trips succeeds');

  const batchCreateRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/batches',
    method: 'POST',
    headers: authHeaders
  }, {
    id: testBatchId,
    tripId: testTripId,
    departureDate: dateK,
    quota: 10,
    availableSeats: 10,
    price: 450000,
    status: 'open'
  });
  assert(batchCreateRes.status === 201, 'POST /api/batches succeeds');

  const openTripBookingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'share-tour',
    serviceType: 'share-tour',
    tripId: testTripId,
    batchId: testBatchId,
    customerName: 'Open Trip Regr Traveler',
    email: 'opentrip.regr@example.com',
    phone: '081234567801',
    participants: 1,
    count: 1,
    nationalityType: 'WNI',
    details: {
      tripId: testTripId,
      batchId: testBatchId,
      participants: 1,
      nationalityType: 'WNI'
    }
  });
  assert(openTripBookingRes.status === 201 && openTripBookingRes.body?.currency === 'IDR' && openTripBookingRes.body?.baseAmount === 450000, `Open Trip booking succeeds at authoritative batch price Rp 450.000 without regression`);

  // Test L: Taxi regression
  console.log('\n--- Test L: Taxi regression check ---');
  const taxiRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/taxi',
    method: 'GET'
  });
  assert(taxiRes.status === 200, 'GET /api/taxi succeeds');
  const taxiRule = (taxiRes.body?.pricingRules || [])[0];
  if (taxiRule) {
    const dateL = getNextWeekday();
    const taxiBookingRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      type: 'taxi',
      serviceType: 'taxi',
      serviceId: taxiRule.id,
      customerName: 'Taxi Regr Traveler',
      email: 'taxi.regr@example.com',
      phone: '081234567802',
      date: dateL,
      departureDate: dateL,
      vehicleId: 'innova',
      details: {
        ruleId: taxiRule.id,
        vehicleId: 'innova'
      }
    });
    assert(taxiBookingRes.status === 201 && taxiBookingRes.body?.currency === 'IDR', `Taxi booking succeeds at Rp ${taxiBookingRes.body?.baseAmount?.toLocaleString('id-ID')} without regression`);
  } else {
    console.log('ℹ️  No taxi pricing rules configured; skipping taxi booking test.');
  }

  // Test M: Car Rental regression
  console.log('\n--- Test M: Car Rental regression check ---');
  const rentalRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/rentals',
    method: 'GET'
  });
  assert(rentalRes.status === 200, 'GET /api/rentals succeeds');
  const rentalVehicle = (rentalRes.body?.vehicles || [])[0];
  if (rentalVehicle) {
    const dateM = getNextWeekday();
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
      phone: '081234567803',
      date: dateM,
      departureDate: dateM,
      rentalDays: 1,
      details: {
        vehicleId: rentalVehicle.id,
        rentalDays: 1
      }
    });
    assert(rentalBookingRes.status === 201 && rentalBookingRes.body?.currency === 'IDR', `Car rental booking succeeds at Rp ${rentalBookingRes.body?.baseAmount?.toLocaleString('id-ID')} without regression`);
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

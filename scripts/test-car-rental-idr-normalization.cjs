// ==============================================================================
// SMART JOURNEY: CAR RENTAL IDR-ONLY NORMALIZATION TEST SUITE (PHASE 5A)
// Tests Requirements:
// 1. Vehicle Fleet: pricePerDayIDR is the only authoritative price; USD is derived preview.
// 2. Category / Zone Pricing: IDR is authoritative; USD derived from IDR.
// 3. Zone Rates by Category: IDR remains the single pricing source.
// 4. Add-ons: priceIDR is authoritative; Per Day vs Fixed preserved.
// 5. Legacy Data: USD-only vehicle records safely rejected (never auto-converted).
// 6. Client priceUSD & totalPrice manipulation ignored by backend.
// 7. Driver multiplier (With Driver 1.0x vs Without Driver 0.8x) preserved.
// 8. Regressions: Private Tour, Open Trip, Airport Transfer, and Taxi remain intact.
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

let dayOffset = 2500 + Math.floor(Math.random() * 500);
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
  console.log('🚗 TEST SUITE: CAR RENTAL IDR-ONLY PRICING NORMALIZATION (PHASE 5A)');
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

  // 2. Sync Car Rental Data with IDR Authoritative Prices
  console.log('\n--- 2. Admin Syncs Car Rental with Authoritative IDR ---');
  const testVehicleId = `car-test-${Date.now()}`;
  const legacyVehicleId = `legacy-usd-only-${Date.now()}`;
  const testCategoryId = `cat-test-${Date.now()}`;
  const testAddonFixedId = `addon-fixed-${Date.now()}`;
  const testAddonDailyId = `addon-daily-${Date.now()}`;

  const vehicleDailyPriceIDR = 450000;
  const fixedAddonPriceIDR = 75000;
  const dailyAddonPriceIDR = 50000;

  const syncPayload = {
    cities: [
      { id: 'city-malang', name: 'Malang & Batu', code: 'MLG', status: 'Active' }
    ],
    locations: [
      { id: 'loc-1', cityId: 'city-malang', name: 'Kota Malang', zone: 'Zone 0', status: 'Active' }
    ],
    categories: [
      {
        id: testCategoryId,
        name: 'Standard MPV Test',
        description: 'Avanza/Xenia Class',
        displayOrder: 1,
        status: 'Active',
        priceZone0IDR: 400000,
        priceZone0USD: 999, // Should be normalized by backend
        priceZone1IDR: 500000,
        priceZone1USD: 999,
        priceZone2IDR: 650000,
        priceZone2USD: 999
      }
    ],
    vehicles: [
      {
        id: testVehicleId,
        name: 'Toyota All New Avanza (IDR Test)',
        categoryId: testCategoryId,
        cityId: 'city-malang',
        passengers: 6,
        luggage: 3,
        hasAC: true,
        pricePerDayIDR: vehicleDailyPriceIDR,
        pricePerDay: 999, // Sent by legacy client, backend must derive from IDR
        status: 'Active',
        supportedZones: ['Zone 0', 'Zone 1', 'Zone 2']
      },
      {
        id: legacyVehicleId,
        name: 'Legacy USD Only Car (Unconverted)',
        categoryId: testCategoryId,
        cityId: 'city-malang',
        passengers: 4,
        luggage: 2,
        hasAC: true,
        pricePerDay: 35, // USD only, no IDR
        pricePerDayIDR: 0,
        status: 'Active',
        supportedZones: ['Zone 0']
      }
    ],
    addons: [
      {
        id: testAddonFixedId,
        name: 'GPS Navigator Unit',
        priceIDR: fixedAddonPriceIDR,
        priceUSD: 99, // Should be normalized
        pricingType: 'Fixed',
        status: 'Active',
        isRequired: false
      },
      {
        id: testAddonDailyId,
        name: 'Child Safety Car Seat',
        priceIDR: dailyAddonPriceIDR,
        priceUSD: 99, // Should be normalized
        pricingType: 'Per Day',
        status: 'Active',
        isRequired: false
      }
    ],
    zonePricing: [
      {
        id: 'zp-test-1',
        cityId: 'city-malang',
        pickupZoneCode: 'Zone 0',
        dropoffZoneCode: 'Zone 1',
        priceIDR: 50000,
        priceUSD: 99,
        status: 'Active'
      }
    ]
  };

  const syncRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/rentals/sync',
    method: 'POST',
    headers: authHeaders
  }, syncPayload);

  assert(syncRes.status === 200 && syncRes.body?.success, 'POST /api/rentals/sync succeeded');

  const savedVehicles = syncRes.body?.rentals?.vehicles || [];
  const savedCar = savedVehicles.find(v => v.id === testVehicleId);
  assert(savedCar && savedCar.pricePerDayIDR === vehicleDailyPriceIDR, `Vehicle saved with authoritative IDR: Rp ${vehicleDailyPriceIDR.toLocaleString('id-ID')}`);
  assert(savedCar && savedCar.pricePerDay === Math.round(vehicleDailyPriceIDR / 16000), `Vehicle pricePerDay (USD) derived as preview: $${Math.round(vehicleDailyPriceIDR / 16000)}`);

  // Verify Category Zone IDR normalization
  const savedCats = syncRes.body?.rentals?.categories || [];
  const savedCat = savedCats.find(c => c.id === testCategoryId);
  assert(savedCat && savedCat.priceZone0IDR === 400000, 'Category Zone 0 IDR price saved correctly');
  assert(savedCat && savedCat.priceZone0USD === Math.round(400000 / 16000), 'Category Zone 0 USD derived from IDR');
  assert(savedCat && savedCat.priceZone1IDR === 500000, 'Category Zone 1 IDR price saved correctly');
  assert(savedCat && savedCat.priceZone2IDR === 650000, 'Category Zone 2 IDR price saved correctly');

  // Verify Add-on IDR normalization
  const savedAddons = syncRes.body?.rentals?.addons || [];
  const savedFixed = savedAddons.find(a => a.id === testAddonFixedId);
  const savedDaily = savedAddons.find(a => a.id === testAddonDailyId);
  assert(savedFixed && savedFixed.priceIDR === fixedAddonPriceIDR, `Fixed Addon saved with IDR: Rp ${fixedAddonPriceIDR}`);
  assert(savedFixed && savedFixed.priceUSD === Math.round(fixedAddonPriceIDR / 16000), `Fixed Addon priceUSD derived: $${Math.round(fixedAddonPriceIDR / 16000)}`);
  assert(savedDaily && savedDaily.priceIDR === dailyAddonPriceIDR, `Per Day Addon saved with IDR: Rp ${dailyAddonPriceIDR}`);

  // 3. Car Rental Booking uses exact authoritative IDR
  console.log('\n--- 3. Car Rental Booking with Authoritative IDR Calculation ---');
  const dateRent = getNextWeekday();
  const durationDays = 3;
  const expectedWithDriverBase = vehicleDailyPriceIDR * durationDays; // 450,000 * 3 = 1,350,000

  const bookingRes1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: testVehicleId,
    customerName: 'Traveler Rental A',
    email: 'traveler.rental@example.com',
    phone: '081234567800',
    date: dateRent,
    departureDate: dateRent,
    details: {
      vehicleId: testVehicleId,
      days: durationDays,
      withDriver: true
    }
  });

  assert(bookingRes1.status === 201, `Rental booking with driver created HTTP 201 (got ${bookingRes1.status})`);
  assert(bookingRes1.body?.currency === 'IDR', 'Rental booking currency is IDR');
  assert(bookingRes1.body?.baseAmount === expectedWithDriverBase, `Rental baseAmount matches exact IDR calculation: Rp ${expectedWithDriverBase.toLocaleString('id-ID')}`);

  // 4. Driver Multiplier (Without Driver = 0.8x)
  console.log('\n--- 4. Driver Multiplier (Without Driver 0.8x) ---');
  const expectedWithoutDriverBase = Math.round(vehicleDailyPriceIDR * 0.8) * durationDays; // 360,000 * 3 = 1,080,000
  const bookingRes2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: testVehicleId,
    customerName: 'Traveler Rental B',
    email: 'traveler.rental.b@example.com',
    phone: '081234567801',
    date: dateRent,
    departureDate: dateRent,
    details: {
      vehicleId: testVehicleId,
      days: durationDays,
      withDriver: false,
      serviceType: 'without_driver'
    }
  });

  assert(bookingRes2.status === 201, `Rental booking without driver created HTTP 201 (got ${bookingRes2.status})`);
  assert(bookingRes2.body?.baseAmount === expectedWithoutDriverBase, `Without driver baseAmount matches 0.8x IDR rate: Rp ${expectedWithoutDriverBase.toLocaleString('id-ID')}`);

  // 5. Add-ons Calculation (Fixed vs Per Day)
  console.log('\n--- 5. Add-ons Calculation (Fixed vs Per Day) ---');
  // Fixed addon: 75,000
  // Per Day addon: 50,000 * 3 = 150,000
  // Total addons: 225,000
  // Total booking base: 1,350,000 + 225,000 = 1,575,000
  const expectedAddonsTotal = fixedAddonPriceIDR + (dailyAddonPriceIDR * durationDays);
  const expectedGrandTotal = expectedWithDriverBase + expectedAddonsTotal;

  const bookingRes3 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: testVehicleId,
    customerName: 'Traveler Rental C (Addons)',
    email: 'traveler.rental.c@example.com',
    phone: '081234567802',
    date: dateRent,
    departureDate: dateRent,
    details: {
      vehicleId: testVehicleId,
      days: durationDays,
      withDriver: true,
      selectedAddons: [testAddonFixedId, testAddonDailyId]
    }
  });

  assert(bookingRes3.status === 201, `Rental booking with add-ons created HTTP 201 (got ${bookingRes3.status})`);
  assert(bookingRes3.body?.baseAmount === expectedGrandTotal, `Addons baseAmount correctly combines Fixed and Per Day rates: Rp ${expectedGrandTotal.toLocaleString('id-ID')}`);

  // 6. Client priceUSD and totalPrice Manipulation Ignored
  console.log('\n--- 6. Client priceUSD & totalPrice Manipulation Ignored ---');
  const bookingTamperRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: testVehicleId,
    customerName: 'Hacker Tamperer',
    email: 'hacker@example.com',
    phone: '081234567899',
    date: dateRent,
    departureDate: dateRent,
    priceUSD: 1,
    totalPrice: 1,
    totalPriceIDR: 1000, // Attacker tries to set total to Rp 1.000
    baseAmount: 500,
    details: {
      vehicleId: testVehicleId,
      days: durationDays,
      withDriver: true,
      priceUSD: 1,
      totalPriceIDR: 1000
    }
  });

  assert(bookingTamperRes.status === 201, 'Tampered payload received 201');
  assert(bookingTamperRes.body?.baseAmount === expectedWithDriverBase, `Server authoritative calculation ignored forged amounts (got Rp ${bookingTamperRes.body?.baseAmount.toLocaleString('id-ID')}, expected Rp ${expectedWithDriverBase.toLocaleString('id-ID')})`);

  // 7. Legacy USD-Only Vehicle Safely Rejected
  console.log('\n--- 7. Legacy USD-Only Vehicle Safely Rejected ---');
  const savedLegacyCar = savedVehicles.find(v => v.id === legacyVehicleId);
  assert(savedLegacyCar && (!savedLegacyCar.pricePerDayIDR || savedLegacyCar.pricePerDayIDR === 0), 'Legacy USD-only vehicle was NOT auto-converted or guessed');

  const legacyBookingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: legacyVehicleId,
    customerName: 'Legacy Test User',
    email: 'legacy@example.com',
    phone: '081234567888',
    date: dateRent,
    departureDate: dateRent,
    details: {
      vehicleId: legacyVehicleId,
      days: 2,
      withDriver: true
    }
  });

  assert(legacyBookingRes.status === 400, `Legacy USD-only booking rejected with HTTP 400 (got ${legacyBookingRes.status})`);
  assert(
    legacyBookingRes.body?.error?.includes('Tarif sewa kendaraan di database backend tidak valid'),
    `Correct error message returned: "${legacyBookingRes.body?.error}"`
  );

  // 8. Regression Suite Across Other Services
  console.log('\n--- 8. Regression Checks (Private Tour, Open Trip, Airport Transfer, Taxi) ---');

  // 8a. Private Tour Regression
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

  // 8b. Open Trip Regression
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

  // 8c. Airport Transfer Regression
  const testSubRouteId = `airport-route-sub-${Date.now()}`;
  const apSyncPayload = {
    airports: [
      { code: 'SUB', name: 'Bandara Internasional Juanda', city: 'Surabaya', surchargeIDR: 0, surchargeUSD: 0 }
    ],
    routes: [
      {
        id: testSubRouteId,
        airport: 'SUB',
        city: 'Malang Kota Center',
        priceIDR: 450000,
        priceUSD: 28,
        status: 'Published'
      }
    ]
  };

  const apSyncRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/airport-transfers/sync',
    method: 'POST',
    headers: authHeaders
  }, apSyncPayload);
  assert(apSyncRes.status === 200, 'POST /api/airport-transfers/sync succeeds');

  const dateAp = getNextWeekday();
  const apBookingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'airport',
    serviceType: 'airport',
    serviceId: testSubRouteId,
    customerName: 'Airport Regr Traveler',
    email: 'airport.regr@example.com',
    phone: '081234567890',
    date: dateAp,
    departureDate: dateAp,
    vehicleId: 'innova',
    routeType: 'One Way',
    airport: 'SUB',
    details: {
      routeId: testSubRouteId,
      airport: 'SUB',
      routeType: 'One Way',
      vehicleId: 'innova'
    }
  });
  assert(apBookingRes.status === 201 && apBookingRes.body?.currency === 'IDR', `Airport transfer booking succeeds at Rp ${apBookingRes.body?.baseAmount?.toLocaleString('id-ID')} IDR without regression`);

  // 8d. Taxi Regression
  const testTaxiRuleId = `taxi-rule-regr-${Date.now()}`;
  const taxiSyncPayload = {
    masterAreas: [
      { id: 'area-sub', code: 'SUB', name: 'Surabaya', type: 'City' },
      { id: 'area-mlg', code: 'MLG', name: 'Malang', type: 'City' }
    ],
    destinations: [],
    pricingRules: [{
      id: testTaxiRuleId,
      source_id: 'area-sub',
      destination_id: 'area-mlg',
      price_idr: 300000,
      status: 'Active'
    }],
    areaRules: []
  };

  const taxiSyncRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/taxi/sync',
    method: 'POST',
    headers: authHeaders
  }, taxiSyncPayload);
  assert(taxiSyncRes.status === 200, 'POST /api/taxi/sync succeeds');

  const dateTaxi = getNextWeekday();
  const taxiBookingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'taxi',
    serviceType: 'taxi',
    serviceId: testTaxiRuleId,
    customerName: 'Taxi Regr Traveler',
    email: 'taxi.regr@example.com',
    phone: '081234567802',
    date: dateTaxi,
    departureDate: dateTaxi,
    vehicleId: 'innova',
    pickupAreaId: 'area-sub',
    destAreaId: 'area-mlg',
    details: {
      ruleId: testTaxiRuleId,
      vehicleId: 'innova'
    }
  });
  assert(taxiBookingRes.status === 201 && taxiBookingRes.body?.currency === 'IDR', `Taxi booking succeeds at Rp ${taxiBookingRes.body?.baseAmount?.toLocaleString('id-ID')} without regression`);

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

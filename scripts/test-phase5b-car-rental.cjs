// ==============================================================================
// SMART JOURNEY: PHASE 5B — CAR RENTAL BACKEND SECURITY & REGRESSION TEST SUITE
// Tests Requirements A to P:
// A. 1-day exact IDR
// B. multi-day
// C. With Driver (1.0x)
// D. Without Driver (0.8x)
// E. Per Day addon
// F. Fixed addon
// G. zone surcharge
// H. promo discount
// I. unique payment code
// J. forged client USD ignored
// K. forged totalPrice/totalPriceIDR/amount ignored
// L. USD-only legacy rejected (fail-closed HTTP 400)
// M. Private Tour regression
// N. Open Trip regression
// O. Airport Transfer regression
// P. Taxi regression
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

let dayOffset = 3000 + Math.floor(Math.random() * 500);
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
  console.log('🛡️  TEST SUITE: PHASE 5B CAR RENTAL BACKEND SECURITY & REGRESSION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  const results = {};

  function record(letter, condition, message) {
    if (condition) {
      console.log(`✅ [PASS] [Test ${letter}] ${message}`);
      passed++;
      results[letter] = { status: 'PASS', message };
    } else {
      console.error(`❌ [FAIL] [Test ${letter}] ${message}`);
      failed++;
      results[letter] = { status: 'FAIL', message };
    }
  }

  // 1. Admin Authentication
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
  const token = loginRes.body.token;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  console.log('Admin authenticated successfully.');

  // 2. Setup Car Rental Master Data via /api/rentals/sync
  console.log('\n--- 2. Setting Up Car Rental Data ---');
  const vehicleId = `car-p5b-avanza-${Date.now()}`;
  const legacyVehicleId = `car-p5b-legacy-usd-${Date.now()}`;
  const addonFixedId = `addon-p5b-gps-${Date.now()}`;
  const addonDailyId = `addon-p5b-seat-${Date.now()}`;
  const legacyAddonId = `addon-p5b-legacy-usd-${Date.now()}`;
  const zonePricingId = `zp-p5b-${Date.now()}`;
  const legacyZoneId = `zp-p5b-legacy-usd-${Date.now()}`;

  const dailyRateIDR = 450000;
  const fixedAddonIDR = 75000;
  const dailyAddonIDR = 50000;
  const zoneSurchargeIDR = 60000;

  const rentalSyncRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/rentals/sync',
    method: 'POST',
    headers: authHeaders
  }, {
    cities: [{ id: 'city-mlg', name: 'Malang & Batu', code: 'MLG', status: 'Active' }],
    locations: [
      { id: 'loc-0', cityId: 'city-mlg', name: 'Malang Kota', zone: 'Zone 0', status: 'Active' },
      { id: 'loc-1', cityId: 'city-mlg', name: 'Batu Suburban', zone: 'Zone 1', status: 'Active' },
      { id: 'loc-2', cityId: 'city-mlg', name: 'Bromo Region', zone: 'Zone 2', status: 'Active' }
    ],
    categories: [
      {
        id: 'cat-mpv',
        name: 'Standard MPV',
        status: 'Active',
        priceZone0IDR: 400000,
        priceZone1IDR: 500000,
        priceZone2IDR: 650000
      }
    ],
    vehicles: [
      {
        id: vehicleId,
        name: 'Toyota Avanza 2024 (Phase 5B Verified)',
        categoryId: 'cat-mpv',
        cityId: 'city-mlg',
        passengers: 6,
        luggage: 3,
        hasAC: true,
        pricePerDayIDR: dailyRateIDR,
        pricePerDay: 28,
        status: 'Active',
        supportedZones: ['Zone 0', 'Zone 1', 'Zone 2']
      },
      {
        id: legacyVehicleId,
        name: 'Legacy USD Vehicle (Unconverted)',
        categoryId: 'cat-mpv',
        cityId: 'city-mlg',
        passengers: 4,
        luggage: 2,
        hasAC: true,
        pricePerDay: 35,
        pricePerDayIDR: 0,
        status: 'Active',
        supportedZones: ['Zone 0']
      }
    ],
    addons: [
      {
        id: addonFixedId,
        name: 'GPS Navigator Pro',
        priceIDR: fixedAddonIDR,
        priceUSD: 5,
        pricingType: 'Fixed',
        status: 'Active',
        isRequired: false
      },
      {
        id: addonDailyId,
        name: 'Child Safety Car Seat',
        priceIDR: dailyAddonIDR,
        priceUSD: 3,
        pricingType: 'Per Day',
        status: 'Active',
        isRequired: false
      },
      {
        id: legacyAddonId,
        name: 'Legacy USD Only Addon',
        priceIDR: 0,
        priceUSD: 10,
        pricingType: 'Fixed',
        status: 'Active',
        isRequired: false
      }
    ],
    zonePricing: [
      {
        id: zonePricingId,
        cityId: 'city-mlg',
        pickupZoneCode: 'Zone 0',
        dropoffZoneCode: 'Zone 1',
        priceIDR: zoneSurchargeIDR,
        surchargeIDR: zoneSurchargeIDR,
        status: 'Active'
      },
      {
        id: legacyZoneId,
        cityId: 'city-mlg',
        pickupZoneCode: 'Zone 0',
        dropoffZoneCode: 'Zone 2',
        priceIDR: 0,
        surchargeIDR: 0,
        priceUSD: 10,
        surchargeUSD: 10,
        status: 'Active'
      }
    ]
  });

  if (rentalSyncRes.status !== 200 || !rentalSyncRes.body?.success) {
    console.error('Failed to sync rental master data:', rentalSyncRes.body);
    process.exit(1);
  }
  console.log('Rental master data synced successfully.');

  // Create test promo code
  const promoCode = `PROMO5B_${Date.now()}`;
  const promoDiscountVal = 50000;
  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/promos',
    method: 'POST',
    headers: authHeaders
  }, {
    code: promoCode,
    discountType: 'fixed',
    discountValue: promoDiscountVal,
    minSpendIDR: 100000,
    validUntil: '2026-12-31',
    isActive: true,
    description: 'Phase 5B 50k discount test'
  });

  // ============================================================================
  // Test A: 1-day exact IDR
  // ============================================================================
  console.log('\n--- Test A: 1-day exact IDR ---');
  const dateA = getNextWeekday();
  const resA = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: vehicleId,
    customerName: 'Customer A',
    email: 'custA@example.com',
    phone: '081111111111',
    date: dateA,
    departureDate: dateA,
    details: {
      vehicleId,
      days: 1,
      withDriver: true
    }
  });

  record('A',
    resA.status === 201 &&
    resA.body?.currency === 'IDR' &&
    resA.body?.baseAmount === dailyRateIDR &&
    resA.body?.totalPrice === dailyRateIDR,
    `1-day rental booking priced exactly at Rp ${dailyRateIDR.toLocaleString('id-ID')} IDR`
  );

  // ============================================================================
  // Test B: multi-day
  // ============================================================================
  console.log('\n--- Test B: multi-day ---');
  const daysB = 4;
  const expectedB = dailyRateIDR * daysB; // 450,000 * 4 = 1,800,000
  const dateB = getNextWeekday();
  const resB = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: vehicleId,
    customerName: 'Customer B',
    email: 'custB@example.com',
    phone: '081111111112',
    date: dateB,
    departureDate: dateB,
    details: {
      vehicleId,
      days: daysB,
      withDriver: true
    }
  });

  record('B',
    resB.status === 201 &&
    resB.body?.baseAmount === expectedB,
    `Multi-day (${daysB} days) rental baseAmount is exactly ${daysB} x Rp ${dailyRateIDR.toLocaleString('id-ID')} = Rp ${expectedB.toLocaleString('id-ID')}`
  );

  // ============================================================================
  // Test C: With Driver (1.0x)
  // ============================================================================
  console.log('\n--- Test C: With Driver (1.0x) ---');
  const daysC = 2;
  const expectedC = Math.round(dailyRateIDR * 1.0) * daysC; // 900,000
  const dateC = getNextWeekday();
  const resC = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: vehicleId,
    customerName: 'Customer C',
    email: 'custC@example.com',
    phone: '081111111113',
    date: dateC,
    departureDate: dateC,
    details: {
      vehicleId,
      days: daysC,
      withDriver: true
    }
  });

  record('C',
    resC.status === 201 &&
    resC.body?.baseAmount === expectedC,
    `With Driver multiplier 1.0x applies correctly: ${daysC} days = Rp ${expectedC.toLocaleString('id-ID')}`
  );

  // ============================================================================
  // Test D: Without Driver (0.8x)
  // ============================================================================
  console.log('\n--- Test D: Without Driver (0.8x) ---');
  const daysD = 2;
  const expectedD = Math.round(dailyRateIDR * 0.8) * daysD; // 360,000 * 2 = 720,000
  const dateD = getNextWeekday();
  const resD = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: vehicleId,
    customerName: 'Customer D',
    email: 'custD@example.com',
    phone: '081111111114',
    date: dateD,
    departureDate: dateD,
    details: {
      vehicleId,
      days: daysD,
      withDriver: false,
      serviceType: 'without_driver'
    }
  });

  record('D',
    resD.status === 201 &&
    resD.body?.baseAmount === expectedD,
    `Without Driver multiplier 0.8x applies correctly: ${daysD} days = Rp ${expectedD.toLocaleString('id-ID')}`
  );

  // ============================================================================
  // Test E: Per Day addon
  // ============================================================================
  console.log('\n--- Test E: Per Day addon ---');
  const daysE = 3;
  // Base: 450,000 * 3 = 1,350,000. Addon: 50,000 * 3 = 150,000. Total = 1,500,000
  const expectedE = (dailyRateIDR * daysE) + (dailyAddonIDR * daysE);
  const dateE = getNextWeekday();
  const resE = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: vehicleId,
    customerName: 'Customer E',
    email: 'custE@example.com',
    phone: '081111111115',
    date: dateE,
    departureDate: dateE,
    details: {
      vehicleId,
      days: daysE,
      withDriver: true,
      selectedAddons: [addonDailyId]
    }
  });

  record('E',
    resE.status === 201 &&
    resE.body?.baseAmount === expectedE,
    `Per Day addon multiplied by ${daysE} days: Rp ${(dailyAddonIDR * daysE).toLocaleString('id-ID')} -> Total baseAmount Rp ${expectedE.toLocaleString('id-ID')}`
  );

  // ============================================================================
  // Test F: Fixed addon
  // ============================================================================
  console.log('\n--- Test F: Fixed addon ---');
  const daysF = 3;
  // Base: 450,000 * 3 = 1,350,000. Fixed Addon: 75,000 (flat once). Total = 1,425,000
  const expectedF = (dailyRateIDR * daysF) + fixedAddonIDR;
  const dateF = getNextWeekday();
  const resF = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: vehicleId,
    customerName: 'Customer F',
    email: 'custF@example.com',
    phone: '081111111116',
    date: dateF,
    departureDate: dateF,
    details: {
      vehicleId,
      days: daysF,
      withDriver: true,
      selectedAddons: [addonFixedId]
    }
  });

  record('F',
    resF.status === 201 &&
    resF.body?.baseAmount === expectedF,
    `Fixed addon applied as flat rate (not multiplied by days): +Rp ${fixedAddonIDR.toLocaleString('id-ID')} -> Total baseAmount Rp ${expectedF.toLocaleString('id-ID')}`
  );

  // ============================================================================
  // Test G: zone surcharge
  // ============================================================================
  console.log('\n--- Test G: zone surcharge ---');
  // 1 day base 450,000 + zone surcharge 60,000 = 510,000
  const expectedG = dailyRateIDR + zoneSurchargeIDR;
  const dateG = getNextWeekday();
  const resG = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: vehicleId,
    customerName: 'Customer G',
    email: 'custG@example.com',
    phone: '081111111117',
    date: dateG,
    departureDate: dateG,
    details: {
      vehicleId,
      days: 1,
      withDriver: true,
      pickupZone: 'Zone 0',
      dropoffZone: 'Zone 1'
    }
  });

  record('G',
    resG.status === 201 &&
    resG.body?.baseAmount === expectedG,
    `Zone surcharge applied correctly: +Rp ${zoneSurchargeIDR.toLocaleString('id-ID')} -> Total baseAmount Rp ${expectedG.toLocaleString('id-ID')}`
  );

  // ============================================================================
  // Test H: promo discount
  // ============================================================================
  console.log('\n--- Test H: promo discount ---');
  // 2 days = 900,000. Promo discount = 50,000. finalBase = 850,000
  const expectedHBase = dailyRateIDR * 2;
  const expectedHFinal = expectedHBase - promoDiscountVal;
  const dateH = getNextWeekday();
  const resH = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: vehicleId,
    customerName: 'Customer H',
    email: 'custH@example.com',
    phone: '081111111118',
    date: dateH,
    departureDate: dateH,
    promoCode: promoCode,
    details: {
      vehicleId,
      days: 2,
      withDriver: true,
      promoCode: promoCode
    }
  });

  record('H',
    resH.status === 201 &&
    resH.body?.baseAmount === expectedHBase &&
    resH.body?.discount === promoDiscountVal &&
    resH.body?.totalPrice === expectedHFinal,
    `Promo discount (-Rp ${promoDiscountVal.toLocaleString('id-ID')}) applied: baseAmount Rp ${expectedHBase.toLocaleString('id-ID')} -> totalPrice Rp ${expectedHFinal.toLocaleString('id-ID')}`
  );

  // ============================================================================
  // Test I: unique payment code
  // ============================================================================
  console.log('\n--- Test I: unique payment code ---');
  const uCode = resA.body?.uniqueCode;
  const payAmt = resA.body?.paymentAmount;
  const totPrice = resA.body?.totalPrice;

  record('I',
    typeof uCode === 'number' &&
    uCode >= 1 && uCode <= 99 &&
    payAmt === totPrice + uCode,
    `Unique payment code generated (${uCode}) and exact paymentAmount = totalPrice + uniqueCode (Rp ${payAmt.toLocaleString('id-ID')})`
  );

  // ============================================================================
  // Test J: forged client USD ignored
  // ============================================================================
  console.log('\n--- Test J: forged client USD ignored ---');
  const dateJ = getNextWeekday();
  const resJ = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: vehicleId,
    customerName: 'Customer J Tamperer',
    email: 'custJ@example.com',
    phone: '081111111119',
    date: dateJ,
    departureDate: dateJ,
    priceUSD: 1, // Attacker tries USD $1
    details: {
      vehicleId,
      days: 1,
      withDriver: true,
      priceUSD: 1,
      pricePerDay: 1
    }
  });

  record('J',
    resJ.status === 201 &&
    resJ.body?.baseAmount === dailyRateIDR &&
    resJ.body?.currency === 'IDR',
    `Forged client priceUSD: 1 ignored; server enforced authoritative IDR Rp ${dailyRateIDR.toLocaleString('id-ID')}`
  );

  // ============================================================================
  // Test K: forged totalPrice/totalPriceIDR/amount ignored
  // ============================================================================
  console.log('\n--- Test K: forged totalPrice/totalPriceIDR/amount ignored ---');
  const dateK = getNextWeekday();
  const resK = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: vehicleId,
    customerName: 'Customer K Tamperer',
    email: 'custK@example.com',
    phone: '081111111120',
    date: dateK,
    departureDate: dateK,
    totalPrice: 1000,
    totalPriceIDR: 1000,
    amount: 500,
    overKmPrice: 0,
    overtimePrice: 0,
    details: {
      vehicleId,
      days: 1,
      withDriver: true,
      totalPrice: 1000,
      totalPriceIDR: 1000,
      amount: 500
    }
  });

  record('K',
    resK.status === 201 &&
    resK.body?.baseAmount === dailyRateIDR &&
    resK.body?.totalPrice === dailyRateIDR,
    `Forged totalPrice/totalPriceIDR/amount (1000 IDR) ignored; server enforced authoritative IDR Rp ${dailyRateIDR.toLocaleString('id-ID')}`
  );

  // ============================================================================
  // Test L: USD-only legacy rejected
  // ============================================================================
  console.log('\n--- Test L: USD-only legacy rejected ---');
  const dateL = getNextWeekday();

  // Subtest L1: Booking USD-only legacy vehicle
  const resL1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: legacyVehicleId,
    customerName: 'Customer L1',
    email: 'custL1@example.com',
    phone: '081111111121',
    date: dateL,
    departureDate: dateL,
    details: {
      vehicleId: legacyVehicleId,
      days: 1,
      withDriver: true
    }
  });

  // Subtest L2: Booking vehicle with USD-only legacy addon
  const resL2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: vehicleId,
    customerName: 'Customer L2',
    email: 'custL2@example.com',
    phone: '081111111122',
    date: dateL,
    departureDate: dateL,
    details: {
      vehicleId,
      days: 1,
      withDriver: true,
      selectedAddons: [legacyAddonId]
    }
  });

  // Subtest L3: Booking with USD-only legacy zone pricing
  const resL3 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'rental',
    serviceType: 'rental',
    serviceId: vehicleId,
    customerName: 'Customer L3',
    email: 'custL3@example.com',
    phone: '081111111123',
    date: dateL,
    departureDate: dateL,
    details: {
      vehicleId,
      days: 1,
      withDriver: true,
      pickupZone: 'Zone 0',
      dropoffZone: 'Zone 2'
    }
  });

  record('L',
    resL1.status === 400 && resL2.status === 400 && resL3.status === 400,
    `USD-only legacy vehicle (HTTP ${resL1.status}), addon (HTTP ${resL2.status}), and zone surcharge (HTTP ${resL3.status}) all safely rejected with HTTP 400`
  );

  // ============================================================================
  // Test M: Private Tour regression
  // ============================================================================
  console.log('\n--- Test M: Private Tour regression ---');
  const testTourId = `tour-p5b-${Date.now()}`;
  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/main-tours',
    method: 'POST',
    headers: authHeaders
  }, {
    id: testTourId,
    name: 'Bromo Sunrise Tour (Phase 5B Check)',
    category: 'Adventure',
    days: 1,
    nights: 0,
    duration: '1D',
    startingPriceIDR: 1200000,
    wniPrice: 1200000,
    wnaPriceIDR: 1800000,
    status: 'published'
  });

  const dateM = getNextWeekday();
  const resM = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'tour',
    serviceType: 'tour',
    serviceId: testTourId,
    customerName: 'Tour Traveler M',
    email: 'tourM@example.com',
    phone: '081111111124',
    date: dateM,
    departureDate: dateM,
    participants: 2,
    count: 2,
    nationalityType: 'WNI',
    details: { participants: 2, nationalityType: 'WNI' }
  });

  record('M',
    resM.status === 201 &&
    resM.body?.currency === 'IDR' &&
    resM.body?.baseAmount === 1200000,
    `Private Tour booking succeeded at Rp 1.200.000 IDR without regression`
  );

  // ============================================================================
  // Test N: Open Trip regression
  // ============================================================================
  console.log('\n--- Test N: Open Trip regression ---');
  const testTripId = `trip-p5b-${Date.now()}`;
  const testBatchId = `batch-p5b-${Date.now()}`;
  const dateN = getNextWeekday();

  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/trips',
    method: 'POST',
    headers: authHeaders
  }, {
    id: testTripId,
    title: 'Open Trip Ijen Blue Fire (Phase 5B)',
    location: 'Banyuwangi',
    category: 'Adventure',
    duration: '2D / 1N',
    days: 2,
    nights: 1,
    startingPriceIDR: 450000,
    wniPrice: 450000,
    price: 450000,
    wnaPriceIDR: 650000,
    status: 'published'
  });

  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/batches',
    method: 'POST',
    headers: authHeaders
  }, {
    id: testBatchId,
    tripId: testTripId,
    departureDate: dateN,
    quota: 10,
    availableSeats: 10,
    price: 450000,
    status: 'open'
  });

  const resN = await request({
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
    customerName: 'Open Trip Traveler N',
    email: 'opentripN@example.com',
    phone: '081111111125',
    participants: 1,
    count: 1,
    nationalityType: 'WNI',
    details: { tripId: testTripId, batchId: testBatchId, participants: 1, nationalityType: 'WNI' }
  });

  record('N',
    resN.status === 201 &&
    resN.body?.currency === 'IDR' &&
    resN.body?.baseAmount === 450000,
    `Open Trip booking succeeded at batch price Rp 450.000 IDR without regression`
  );

  // ============================================================================
  // Test O: Airport Transfer regression
  // ============================================================================
  console.log('\n--- Test O: Airport Transfer regression ---');
  const testAirportRouteId = `ap-route-p5b-${Date.now()}`;
  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/airport-transfers/sync',
    method: 'POST',
    headers: authHeaders
  }, {
    airports: [
      { code: 'SUB', name: 'Bandara Juanda', city: 'Surabaya', surchargeIDR: 0, surchargeUSD: 0 }
    ],
    routes: [
      {
        id: testAirportRouteId,
        airport: 'SUB',
        city: 'Malang Kota Center',
        priceIDR: 450000,
        priceUSD: 28,
        status: 'Published'
      }
    ]
  });

  const dateO = getNextWeekday();
  const resO = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'airport',
    serviceType: 'airport',
    serviceId: testAirportRouteId,
    customerName: 'Airport Traveler O',
    email: 'airportO@example.com',
    phone: '081111111126',
    date: dateO,
    departureDate: dateO,
    vehicleId: 'innova',
    routeType: 'One Way',
    airport: 'SUB',
    details: { routeId: testAirportRouteId, airport: 'SUB', routeType: 'One Way', vehicleId: 'innova' }
  });

  record('O',
    resO.status === 201 &&
    resO.body?.currency === 'IDR' &&
    resO.body?.baseAmount === 450000,
    `Airport Transfer booking succeeded at Rp 450.000 IDR without regression`
  );

  // ============================================================================
  // Test P: Taxi regression
  // ============================================================================
  console.log('\n--- Test P: Taxi regression ---');
  const testTaxiRuleId = `tx-rule-p5b-${Date.now()}`;
  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/taxi/sync',
    method: 'POST',
    headers: authHeaders
  }, {
    masterAreas: [
      { id: 'area-sub-p5b', code: 'SUB', name: 'Surabaya', type: 'City' },
      { id: 'area-mlg-p5b', code: 'MLG', name: 'Malang', type: 'City' }
    ],
    destinations: [],
    pricingRules: [{
      id: testTaxiRuleId,
      source_id: 'area-sub-p5b',
      destination_id: 'area-mlg-p5b',
      price_idr: 300000,
      status: 'Active'
    }],
    areaRules: []
  });

  const dateP = getNextWeekday();
  const resP = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    type: 'taxi',
    serviceType: 'taxi',
    serviceId: testTaxiRuleId,
    customerName: 'Taxi Traveler P',
    email: 'taxiP@example.com',
    phone: '081111111127',
    date: dateP,
    departureDate: dateP,
    vehicleId: 'innova',
    pickupAreaId: 'area-sub-p5b',
    destAreaId: 'area-mlg-p5b',
    details: { ruleId: testTaxiRuleId, vehicleId: 'innova' }
  });

  record('P',
    resP.status === 201 &&
    resP.body?.currency === 'IDR' &&
    resP.body?.baseAmount === 300000,
    `Taxi booking succeeded at Rp 300.000 IDR without regression`
  );

  console.log('\n================================================================');
  console.log(`🏁 TEST RESULTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  console.log(JSON.stringify(results, null, 2));

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal test error in Phase 5B:', err);
  process.exit(1);
});

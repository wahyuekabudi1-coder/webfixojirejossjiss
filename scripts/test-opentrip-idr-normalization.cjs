// ==============================================================================
// SMART JOURNEY: OPEN TRIP / SHARE TOUR IDR-ONLY PRICING NORMALIZATION TEST SUITE
// Tests Requirements A, B, C, D, E, F, G, H, I, J, K
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

// Generate future dates ensuring fresh daily capacity limits
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
  console.log('🛡️  TEST SUITE: OPEN TRIP IDR-ONLY PRICING NORMALIZATION');
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

  // 2. Test A: New Open Trip created with IDR price
  console.log('\n--- 2. Test A: New Open Trip created with IDR price ---');
  const testTripId = `trip-norm-${Date.now()}`;
  const tripPayload = {
    id: testTripId,
    title: 'Open Trip IDR Normalization Test',
    slug: `open-trip-norm-${Date.now()}`,
    location: 'Bromo & Ijen',
    duration: '2D / 1N',
    days: 2,
    nights: 1,
    description: 'Testing strict IDR normalization for Open Trip',
    startingPriceIDR: 450000, // WNI: Rp 450.000
    wniPrice: 450000,
    price: 450000,
    wnaPriceIDR: 650000, // WNA: Rp 650.000 (Authoritative IDR)
    status: 'published'
  };

  const createTripRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/trips',
    method: 'POST',
    headers: adminHeaders
  }, tripPayload);

  assert(createTripRes.status === 201, `Admin POST /api/trips returned 201 Created (got ${createTripRes.status})`);
  assert(Number(createTripRes.body.startingPriceIDR || createTripRes.body.price) === 450000, 'Trip WNI IDR saved as 450,000');
  assert(Number(createTripRes.body.wnaPriceIDR) === 650000, 'Trip Authoritative WNA IDR saved as 650,000');

  // Verify via GET /api/trips/:id or /api/trips
  const getTripsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/trips?all=true',
    method: 'GET',
    headers: adminHeaders
  });
  const savedTrip = (getTripsRes.body || []).find(t => t.id === testTripId);
  assert(savedTrip && Number(savedTrip.wnaPriceIDR) === 650000, 'Persisted trip includes authoritative wnaPriceIDR 650,000');

  // 3. Test B: Batch price IDR is authoritative
  console.log('\n--- 3. Test B: Batch price IDR is authoritative ---');
  const testBatchDate = getNextWeekday();
  const testBatchId = `batch-norm-${Date.now()}`;
  const createBatchRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/batches',
    method: 'POST',
    headers: adminHeaders
  }, {
    id: testBatchId,
    tripId: testTripId,
    departureDate: testBatchDate,
    quota: 10,
    availableSeats: 10,
    price: 450000, // Authoritative batch price Rp 450.000
    wnaPriceIDR: 650000,
    status: 'open'
  });

  assert(createBatchRes.status === 201, `Batch created with HTTP 201 (got ${createBatchRes.status})`);
  assert(Number(createBatchRes.body.price) === 450000, 'Batch price is strictly 450,000 IDR');

  // Book 2 domestic (WNI) participants on this batch
  const wniBookingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    bookingType: 'shared',
    tripId: testTripId,
    batchId: testBatchId,
    nationalityType: 'WNI',
    participantsCount: 2,
    fullName: 'Peserta Domestik',
    email: 'domestik@opentrip.id',
    phone: '+6281122334455'
  });

  const expectedWniBatchTotal = 450000 * 2; // 900,000
  assert(wniBookingRes.status === 201, `WNI Open Trip booking returned HTTP 201 (got ${wniBookingRes.status})`);
  assert(
    wniBookingRes.body.baseAmount === expectedWniBatchTotal && wniBookingRes.body.totalPriceIDR === expectedWniBatchTotal,
    `WNI Open Trip booking uses authoritative batch price Rp ${expectedWniBatchTotal.toLocaleString('id-ID')} (got Rp ${wniBookingRes.body.baseAmount?.toLocaleString('id-ID')})`
  );
  assert(wniBookingRes.body.currency === 'IDR', 'Booking currency is strictly IDR');

  // 4. Test C: WNA booking uses explicit authoritative IDR price if available
  console.log('\n--- 4. Test C: WNA booking uses explicit authoritative IDR price ---');
  const wnaBookingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    bookingType: 'shared',
    tripId: testTripId,
    batchId: testBatchId,
    nationalityType: 'WNA',
    participantsCount: 2,
    fullName: 'International Explorer',
    email: 'intl@explorer.com',
    phone: '+14155552671'
  });

  const expectedWnaTotal = 650000 * 2; // 1,300,000
  assert(wnaBookingRes.status === 201, `WNA Open Trip booking returned HTTP 201 (got ${wnaBookingRes.status})`);
  assert(
    wnaBookingRes.body.baseAmount === expectedWnaTotal && wnaBookingRes.body.totalPriceIDR === expectedWnaTotal,
    `WNA Open Trip booking uses exact authoritative WNA IDR Rp ${expectedWnaTotal.toLocaleString('id-ID')} (got Rp ${wnaBookingRes.body.baseAmount?.toLocaleString('id-ID')})`
  );
  assert(wnaBookingRes.body.currency === 'IDR', 'Booking currency is strictly IDR');

  // 5. Test D: Client USD manipulation ignored
  console.log('\n--- 5. Test D: Client manipulation of USD prices is ignored ---');
  const usdTamperRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    bookingType: 'shared',
    tripId: testTripId,
    batchId: testBatchId,
    nationalityType: 'WNA',
    participantsCount: 1,
    fullName: 'USD Manipulator',
    email: 'tamper@usd.com',
    phone: '+1999888777',
    startingPrice: 1, // Attacker attempts to inject $1
    wnaPrice: 1,
    unitPriceUSD: 1
  });

  const expectedSingleWna = 650000;
  assert(usdTamperRes.status === 201, 'Booking processed safely');
  assert(
    usdTamperRes.body.baseAmount === expectedSingleWna,
    `Client USD manipulation ignored (charged exact authoritative Rp ${expectedSingleWna.toLocaleString('id-ID')}, got Rp ${usdTamperRes.body.baseAmount?.toLocaleString('id-ID')})`
  );

  // 6. Test E: Client totalPrice/totalPriceIDR manipulation ignored
  console.log('\n--- 6. Test E: Client manipulation of totalPrice/totalPriceIDR is ignored ---');
  const totalTamperRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    bookingType: 'shared',
    tripId: testTripId,
    batchId: testBatchId,
    nationalityType: 'WNI',
    participantsCount: 1,
    fullName: 'Total Manipulator',
    email: 'tamper@total.com',
    phone: '+6281999888777',
    totalPrice: 500, // Attacker claims total is Rp 500
    totalPriceIDR: 500,
    amount: 500
  });

  const expectedSingleWni = 450000;
  assert(totalTamperRes.status === 201, 'Booking processed safely');
  assert(
    totalTamperRes.body.baseAmount === expectedSingleWni,
    `Client totalPrice manipulation ignored (authoritative calculation is Rp ${expectedSingleWni.toLocaleString('id-ID')}, got Rp ${totalTamperRes.body.baseAmount?.toLocaleString('id-ID')})`
  );

  // 7. Test F: Existing batch-4 and batch-5 remain Rp2.250.000
  console.log('\n--- 7. Test F: Existing batch-4 and batch-5 remain Rp 2.250.000 ---');
  const batch4Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/batches/batch-4',
    method: 'GET',
    headers: adminHeaders
  });
  assert(batch4Res.status === 200, `GET /api/batches/batch-4 returned 200 OK (got ${batch4Res.status})`);
  assert(Number(batch4Res.body.price) === 2250000, `batch-4 price remains exactly Rp 2.250.000 (got ${batch4Res.body.price})`);

  const batch5Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/batches/batch-5',
    method: 'GET',
    headers: adminHeaders
  });
  assert(batch5Res.status === 200, `GET /api/batches/batch-5 returned 200 OK (got ${batch5Res.status})`);
  assert(Number(batch5Res.body.price) === 2250000, `batch-5 price remains exactly Rp 2.250.000 (got ${batch5Res.body.price})`);

  // Book 1 seat on batch-4 to verify transaction pricing
  const batch4BookingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    bookingType: 'shared',
    tripId: 'trip-2',
    batchId: 'batch-4',
    nationalityType: 'WNI',
    participantsCount: 1,
    fullName: 'Bromo Ijen Traveler',
    email: 'traveler@bromoijen.com',
    phone: '+6281144556677'
  });
  assert(batch4BookingRes.status === 201, `Booking on batch-4 succeeded with HTTP 201`);
  assert(
    batch4BookingRes.body.baseAmount === 2250000,
    `batch-4 transaction charged exactly Rp 2.250.000 (got Rp ${batch4BookingRes.body.baseAmount?.toLocaleString('id-ID')})`
  );

  // 8. Test G: Existing Open Trip bookings remain functional
  console.log('\n--- 8. Test G: Existing Open Trip bookings remain functional ---');
  const getBookingsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'GET',
    headers: adminHeaders
  });
  assert(getBookingsRes.status === 200, `GET /api/bookings returned 200 OK (got ${getBookingsRes.status})`);
  const openTripBookings = (getBookingsRes.body || []).filter(b => b.bookingType === 'shared' || b.tourBookingType === 'shared' || b.serviceType === 'shared');
  assert(openTripBookings.length > 0, `Existing Open Trip bookings retrieved (${openTripBookings.length} bookings found)`);
  const sampleBooking = openTripBookings[0];
  assert(sampleBooking.bookingCode && sampleBooking.currency === 'IDR', `Sample Open Trip booking ${sampleBooking.bookingCode} is valid IDR transaction`);

  // 9. Test H: Private Tour regression
  console.log('\n--- 9. Test H: Private Tour regression ---');
  const privTourId = `tour-reg-${Date.now()}`;
  await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/main-tours',
    method: 'POST',
    headers: adminHeaders
  }, {
    id: privTourId,
    name: 'Private Tour Regression Test',
    category: 'Adventure',
    days: 2,
    nights: 1,
    startingPriceIDR: 1800000,
    wniPrice: 1800000,
    wnaPriceIDR: 2600000,
    status: 'published'
  });

  const privDate = getNextWeekday();
  const privBookingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    tripId: privTourId,
    serviceType: 'tour',
    date: privDate,
    nationalityType: 'WNA',
    participantsCount: 2,
    fullName: 'Private Traveler',
    email: 'private@traveler.com',
    phone: '+12223334444'
  });
  const expectedPrivTotal = 2600000 * 2;
  assert(privBookingRes.status === 201, `Private tour booking succeeds with HTTP 201 (got ${privBookingRes.status})`);
  assert(
    privBookingRes.body.baseAmount === expectedPrivTotal && privBookingRes.body.currency === 'IDR',
    `Private tour charged exact WNA IDR Rp ${expectedPrivTotal.toLocaleString('id-ID')} without regression`
  );

  // 10. Test I: Airport Transfer regression
  console.log('\n--- 10. Test I: Airport Transfer regression ---');
  const airportCatRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/transport/category/airportTransfers',
    method: 'GET'
  });
  assert(airportCatRes.status === 200, 'GET /api/transport/category/airportTransfers succeeds');
  const airportRoute = (airportCatRes.body?.routes || [])[0];
  if (airportRoute) {
    const airportDate = getNextWeekday();
    const airportBookingRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      serviceType: 'airport',
      serviceId: airportRoute.id,
      date: airportDate,
      fullName: 'Airport Passenger',
      email: 'airport@passenger.com',
      phone: '+628999111222'
    });
    assert(
      airportBookingRes.status === 201 && airportBookingRes.body.currency === 'IDR' && airportBookingRes.body.baseAmount === airportRoute.priceIDR,
      `Airport Transfer booking succeeds at Rp ${airportRoute.priceIDR.toLocaleString('id-ID')} without regression`
    );
  }

  // 11. Test J: Taxi Service regression
  console.log('\n--- 11. Test J: Taxi Service regression ---');
  const taxiCatRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/transport/category/taxiServices',
    method: 'GET'
  });
  assert(taxiCatRes.status === 200, 'GET /api/transport/category/taxiServices succeeds');
  const taxiRule = (taxiCatRes.body?.pricingRules || []).find(r => r.status === 'Active');
  if (taxiRule) {
    const taxiDate = getNextWeekday();
    const taxiBookingRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      serviceType: 'taxi',
      serviceId: taxiRule.id,
      date: taxiDate,
      fullName: 'Taxi Rider',
      email: 'rider@taxitravel.com',
      phone: '+628777111222'
    });
    assert(
      taxiBookingRes.status === 201 && taxiBookingRes.body.currency === 'IDR',
      `Taxi Service booking succeeds in IDR without regression (Base: Rp ${taxiBookingRes.body.baseAmount?.toLocaleString('id-ID')})`
    );
  }

  // 12. Test K: Car Rental regression
  console.log('\n--- 12. Test K: Car Rental regression ---');
  const rentalCatRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/transport/category/rentals',
    method: 'GET'
  });
  assert(rentalCatRes.status === 200, 'GET /api/transport/category/rentals succeeds');
  const rentalVehicle = (rentalCatRes.body?.vehicles || []).find(v => v.status === 'Active' || !v.status);
  if (rentalVehicle) {
    const rentalDate = getNextWeekday();
    const rentalBookingRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      serviceType: 'rental',
      vehicleId: rentalVehicle.id,
      date: rentalDate,
      days: 2,
      fullName: 'Car Renter',
      email: 'renter@carrental.com',
      phone: '+628555111222'
    });
    const expectedRentalTotal = Number(rentalVehicle.pricePerDayIDR) * 2;
    assert(
      rentalBookingRes.status === 201 && rentalBookingRes.body.currency === 'IDR' && rentalBookingRes.body.baseAmount === expectedRentalTotal,
      `Car Rental booking succeeds at Rp ${expectedRentalTotal.toLocaleString('id-ID')} without regression`
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

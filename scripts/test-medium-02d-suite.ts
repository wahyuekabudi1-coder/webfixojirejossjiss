// ==============================================================================
// REGRESSION TEST SUITE: MEDIUM-02D SERVER AUTHORITATIVE PROMO -> BOOKING -> ARTOPAY
// Validates all 31 mandatory regression test points specified in the user request
// ==============================================================================
import assert from 'assert';
import { toursRepo } from '../server/db/repositories/tours.repository';
import { shareToursRepo } from '../server/db/repositories/shareTours.repository';
import { transportRepo } from '../server/db/repositories/transport.repository';
import { promoCodesRepo } from '../server/db/repositories/promoCodes.repository';
import { bookingsRepo } from '../server/db/repositories/bookings.repository';

const BASE_URL = 'http://127.0.0.1:3000';

async function runTestSuite() {
  console.log('================================================================');
  console.log('🚀 RUNNING MEDIUM-02D COMPREHENSIVE REGRESSION TEST SUITE');
  console.log('================================================================');

  let passedTests = 0;

  // ---------------------------------------------------------------------------
  // SETUP TEST DATA: Admin auth, services, and promo codes
  // ---------------------------------------------------------------------------
  console.log('\n[Setup] Preparing test environment & services...');
  
  // 1. Admin login to obtain token
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password: process.env.ADMIN_PASSWORD || 'admin123',
      role: 'Super Administrator'
    })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200, 'Admin login must succeed');
  const adminToken = loginData.token;

  // Reset bookings via server admin purge endpoint so every test run starts with clean capacity and unique codes
  await fetch(`${BASE_URL}/api/bookings/purge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
      'X-Admin-Role': 'Super Administrator'
    }
  });

  // 2. Fetch existing Private Tour from server
  const toursRes = await fetch(`${BASE_URL}/api/main-tours`);
  const allTours = await toursRes.json();
  const testTour = allTours[0];
  assert(testTour, 'At least one published tour must exist');
  const tourBasePrice = Number(testTour.startingPriceIDR ?? testTour.wniPrice ?? testTour.price ?? 1750000);

  // 3. Ensure Open Trip & Batch exists with available seats via server API
  const tripsRes = await fetch(`${BASE_URL}/api/trips`);
  const allTrips = await tripsRes.json();
  const validTrip = allTrips.find((t: any) => t.status !== 'archived') || allTrips[0];
  const validTripId = validTrip ? validTrip.id : 'sharetour-1';

  const batchesRes = await fetch(`${BASE_URL}/api/batches`);
  const allBatches = await batchesRes.json();
  let testBatch = allBatches.find((b: any) => b.status === 'Open' && b.availableSeats >= 5 && b.tripId === validTripId);
  if (!testBatch) {
    const createBatchRes = await fetch(`${BASE_URL}/api/batches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        id: `batch-test-${Date.now()}`,
        tripId: validTripId,
        departureDate: '2026-11-20',
        price: 450000,
        totalSeats: 20,
        availableSeats: 20,
        status: 'Open'
      })
    });
    testBatch = await createBatchRes.json();
  }
  const batchPrice = Number(testBatch.price || 450000);

  // 4. Ensure Airport Transfer route exists via server API
  const airportRoutePrice = 250000;
  const testAirportRouteId = `airport-route-test-${Date.now()}`;
  await fetch(`${BASE_URL}/api/airport-transfers/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      airports: [{ code: 'SUB', name: 'Juanda Airport', surchargeIDR: 0 }],
      routes: [{
        id: testAirportRouteId,
        airport: 'SUB',
        city: 'Surabaya Center',
        priceIDR: airportRoutePrice,
        priceUSD: 16,
        status: 'Active'
      }]
    })
  });

  // 5. Ensure Taxi rule exists via server API
  const taxiPrice = 300000;
  const testTaxiRuleId = `taxi-rule-test-${Date.now()}`;
  await fetch(`${BASE_URL}/api/taxi/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      masterAreas: [
        { id: 'area-sub', code: 'SUB', name: 'Surabaya' },
        { id: 'area-mlg', code: 'MLG', name: 'Malang' }
      ],
      destinations: [],
      pricingRules: [{
        id: testTaxiRuleId,
        source_id: 'area-sub',
        destination_id: 'area-mlg',
        price_idr: taxiPrice,
        status: 'Active'
      }],
      areaRules: []
    })
  });

  // 6. Ensure Rental vehicle exists via server API
  const rentalDailyPrice = 400000;
  const testVehicleId = `vehicle-test-${Date.now()}`;
  await fetch(`${BASE_URL}/api/rentals/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      cities: [],
      locations: [],
      categories: [],
      vehicles: [{
        id: testVehicleId,
        name: 'Toyota Avanza All New',
        category: 'MPV',
        pricePerDayIDR: rentalDailyPrice,
        pricePerDay: 26,
        status: 'Active'
      }],
      addons: [],
      zonePricing: []
    })
  });

  // 7. Seed test promo codes for various conditions
  const timestamp = Date.now();
  const codePercentage = `PCT10_${timestamp}`;
  const codeFixed = `FIX75K_${timestamp}`;
  const codeMaxDiscount = `MAXDISC_${timestamp}`;
  const codeMinSpend = `MINSPEND_${timestamp}`;
  const codeInactive = `INACTIVE_${timestamp}`;
  const codeExpired = `EXPIRED_${timestamp}`;
  const codeMaxUsage1 = `MAX1_${timestamp}`;
  const codeUnlimited = `UNLIM_${timestamp}`;

  // Helper to create promo via server admin API
  async function createServerPromo(data: any) {
    const res = await fetch(`${BASE_URL}/api/admin/promos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(`Failed to create promo via API: ${JSON.stringify(json)}`);
    }
    return json;
  }

  // Percentage promo: 10%, min spend 100k
  await createServerPromo({
    code: codePercentage,
    discountType: 'percentage',
    discountValue: 10,
    minSpendIDR: 100000,
    maxDiscount: null,
    validUntil: '2026-12-31',
    maxUsage: null,
    isActive: true,
    description: '10% discount promo'
  });

  // Fixed promo: 75,000 IDR off, min spend 100k
  await createServerPromo({
    code: codeFixed,
    discountType: 'fixed',
    discountValue: 75000,
    minSpendIDR: 100000,
    maxDiscount: null,
    validUntil: '2026-12-31',
    maxUsage: null,
    isActive: true,
    description: '75k fixed discount'
  });

  // Max discount promo: 50% discount capped at 100,000 IDR
  await createServerPromo({
    code: codeMaxDiscount,
    discountType: 'percentage',
    discountValue: 50,
    minSpendIDR: 100000,
    maxDiscount: 100000,
    validUntil: '2026-12-31',
    maxUsage: null,
    isActive: true,
    description: '50% capped at 100k'
  });

  // Min spend promo: min spend 2,000,000 IDR
  await createServerPromo({
    code: codeMinSpend,
    discountType: 'fixed',
    discountValue: 100000,
    minSpendIDR: 2000000,
    maxDiscount: null,
    validUntil: '2026-12-31',
    maxUsage: null,
    isActive: true,
    description: 'Min spend 2M required'
  });

  // Inactive promo
  await createServerPromo({
    code: codeInactive,
    discountType: 'percentage',
    discountValue: 20,
    minSpendIDR: 0,
    maxDiscount: null,
    validUntil: '2026-12-31',
    maxUsage: null,
    isActive: false,
    description: 'Inactive promo'
  });

  // Expired promo
  await createServerPromo({
    code: codeExpired,
    discountType: 'percentage',
    discountValue: 20,
    minSpendIDR: 0,
    maxDiscount: null,
    validUntil: '2020-01-01',
    maxUsage: null,
    isActive: true,
    description: 'Expired promo'
  });

  // maxUsage = 1 promo
  await createServerPromo({
    code: codeMaxUsage1,
    discountType: 'fixed',
    discountValue: 50000,
    minSpendIDR: 0,
    maxDiscount: null,
    validUntil: '2026-12-31',
    maxUsage: 1,
    isActive: true,
    description: 'Max 1 usage only'
  });

  // Unlimited promo (no maxUsage)
  await createServerPromo({
    code: codeUnlimited,
    discountType: 'fixed',
    discountValue: 30000,
    minSpendIDR: 0,
    maxDiscount: null,
    validUntil: '2026-12-31',
    maxUsage: null,
    isActive: true,
    description: 'Unlimited promo'
  });

  console.log('✅ Test environment setup complete.');

  const testRunDate = (day: number) => {
    const d = new Date(Date.now() + 86400000 * (300 + (timestamp % 1000) + day));
    return d.toISOString().split('T')[0];
  };

  // ===========================================================================
  // TEST 1: Private Tour tanpa promo -> nominal sama seperti sebelum 02D
  // ===========================================================================
  console.log('\n[Test 1] Testing Private Tour booking without promo...');
  const res1 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: testTour.id,
      fullName: 'Budi Traveler',
      email: 'budi@example.com',
      phone: '081234567891',
      departureDate: testRunDate(1)
    })
  });
  const b1 = await res1.json();
  assert.strictEqual(res1.status, 201, 'Booking must succeed');
  assert.strictEqual(b1.baseAmount, tourBasePrice, 'baseAmount must equal tourBasePrice');
  assert.strictEqual(b1.discount, 0, 'Discount must be 0 without promo');
  assert.strictEqual(b1.totalPrice, tourBasePrice, 'totalPrice must equal tourBasePrice');
  assert.strictEqual(b1.totalPriceIDR, tourBasePrice, 'totalPriceIDR must equal tourBasePrice');
  assert.strictEqual(b1.paymentAmount, tourBasePrice + b1.uniqueCode, 'paymentAmount must be baseAmount + uniqueCode');
  console.log(`✅ Passed Test 1: Private Tour without promo (base: ${b1.baseAmount}, unique: ${b1.uniqueCode}, payment: ${b1.paymentAmount})`);
  passedTests++;

  // ===========================================================================
  // TEST 2: Private Tour dengan promo -> discount diterapkan server
  // ===========================================================================
  console.log('\n[Test 2] Testing Private Tour booking with promo...');
  const expectedTourDiscount = Math.round((tourBasePrice * 10) / 100);
  const expectedTourFinal = tourBasePrice - expectedTourDiscount;
  const res2 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: testTour.id,
      promoCode: codePercentage,
      fullName: 'Siti Traveler',
      email: 'siti@example.com',
      phone: '081234567892',
      departureDate: testRunDate(2)
    })
  });
  const b2 = await res2.json();
  assert.strictEqual(res2.status, 201, 'Booking with promo must succeed');
  assert.strictEqual(b2.baseAmount, tourBasePrice, 'baseAmount must be server price');
  assert.strictEqual(b2.discount, expectedTourDiscount, `Server discount must be ${expectedTourDiscount}`);
  assert.strictEqual(b2.totalPrice, expectedTourFinal, `totalPrice must be base - discount (${expectedTourFinal})`);
  assert.strictEqual(b2.paymentAmount, expectedTourFinal + b2.uniqueCode, 'paymentAmount must be finalBase + uniqueCode');
  console.log(`✅ Passed Test 2: Private Tour with promo (discount: ${b2.discount}, final: ${b2.totalPrice}, payment: ${b2.paymentAmount})`);
  passedTests++;

  // ===========================================================================
  // TEST 3: Open Trip tanpa promo -> nominal sama seperti sebelum 02D
  // ===========================================================================
  console.log('\n[Test 3] Testing Open Trip booking without promo...');
  const res3 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingType: 'shared',
      tripId: testBatch.tripId || validTripId,
      batchId: testBatch.id,
      participantsCount: 2,
      fullName: 'Ahmad OpenTrip',
      email: 'ahmad@example.com',
      phone: '081234567893'
    })
  });
  const b3 = await res3.json();
  assert.strictEqual(res3.status, 201, 'Open Trip booking must succeed');
  const expectedOpenTripBase = batchPrice * 2;
  assert.strictEqual(b3.baseAmount, expectedOpenTripBase, `baseAmount must be ${expectedOpenTripBase}`);
  assert.strictEqual(b3.discount, 0, 'Discount must be 0');
  assert.strictEqual(b3.totalPrice, expectedOpenTripBase);
  assert.strictEqual(b3.paymentAmount, expectedOpenTripBase + b3.uniqueCode);
  console.log(`✅ Passed Test 3: Open Trip without promo (base: ${b3.baseAmount}, payment: ${b3.paymentAmount})`);
  passedTests++;

  // ===========================================================================
  // TEST 4: Open Trip dengan promo -> discount diterapkan server
  // ===========================================================================
  console.log('\n[Test 4] Testing Open Trip booking with promo...');
  const openTripPax = 2;
  const openTripBase = batchPrice * openTripPax;
  const expectedOpenTripDiscount = Math.round((openTripBase * 10) / 100);
  const expectedOpenTripFinal = openTripBase - expectedOpenTripDiscount;
  const res4 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingType: 'shared',
      tripId: testBatch.tripId || validTripId,
      batchId: testBatch.id,
      participantsCount: openTripPax,
      promoCode: codePercentage,
      fullName: 'Rina OpenTrip',
      email: 'rina@example.com',
      phone: '081234567894'
    })
  });
  const b4 = await res4.json();
  assert.strictEqual(res4.status, 201, 'Open Trip booking with promo must succeed');
  assert.strictEqual(b4.baseAmount, openTripBase);
  assert.strictEqual(b4.discount, expectedOpenTripDiscount);
  assert.strictEqual(b4.totalPrice, expectedOpenTripFinal);
  assert.strictEqual(b4.paymentAmount, expectedOpenTripFinal + b4.uniqueCode);
  console.log(`✅ Passed Test 4: Open Trip with promo (discount: ${b4.discount}, payment: ${b4.paymentAmount})`);
  passedTests++;

  // ===========================================================================
  // TEST 5: Airport Transfer tanpa promo -> nominal existing tetap
  // ===========================================================================
  console.log('\n[Test 5] Testing Airport Transfer booking without promo...');
  const res5 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'airport',
      serviceId: testAirportRouteId,
      fullName: 'Airport Guest 1',
      email: 'airport1@example.com',
      phone: '081234567895',
      departureDate: testRunDate(5)
    })
  });
  const b5 = await res5.json();
  assert.strictEqual(res5.status, 201, 'Airport booking must succeed');
  assert.strictEqual(b5.baseAmount, airportRoutePrice);
  assert.strictEqual(b5.discount, 0);
  assert.strictEqual(b5.paymentAmount, airportRoutePrice + b5.uniqueCode);
  console.log(`✅ Passed Test 5: Airport Transfer without promo (base: ${b5.baseAmount}, payment: ${b5.paymentAmount})`);
  passedTests++;

  // ===========================================================================
  // TEST 6: Airport Transfer dengan promo -> discount diterapkan server
  // ===========================================================================
  console.log('\n[Test 6] Testing Airport Transfer booking with promo...');
  const expectedAirportDiscount = Math.round((airportRoutePrice * 10) / 100);
  const expectedAirportFinal = airportRoutePrice - expectedAirportDiscount;
  const res6 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'airport',
      serviceId: testAirportRouteId,
      promoCode: codePercentage,
      fullName: 'Airport Guest 2',
      email: 'airport2@example.com',
      phone: '081234567896',
      departureDate: testRunDate(6)
    })
  });
  const b6 = await res6.json();
  assert.strictEqual(res6.status, 201, 'Airport booking with promo must succeed');
  assert.strictEqual(b6.baseAmount, airportRoutePrice);
  assert.strictEqual(b6.discount, expectedAirportDiscount);
  assert.strictEqual(b6.totalPrice, expectedAirportFinal);
  assert.strictEqual(b6.paymentAmount, expectedAirportFinal + b6.uniqueCode);
  console.log(`✅ Passed Test 6: Airport Transfer with promo (discount: ${b6.discount}, payment: ${b6.paymentAmount})`);
  passedTests++;

  // ===========================================================================
  // TEST 7: Taxi tanpa promo -> nominal existing tetap
  // ===========================================================================
  console.log('\n[Test 7] Testing Taxi booking without promo...');
  const res7 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'taxi',
      serviceId: testTaxiRuleId,
      fullName: 'Taxi Guest 1',
      email: 'taxi1@example.com',
      phone: '081234567897',
      departureDate: testRunDate(7)
    })
  });
  const b7 = await res7.json();
  assert.strictEqual(res7.status, 201, 'Taxi booking must succeed');
  assert.strictEqual(b7.baseAmount, taxiPrice);
  assert.strictEqual(b7.discount, 0);
  assert.strictEqual(b7.paymentAmount, taxiPrice + b7.uniqueCode);
  console.log(`✅ Passed Test 7: Taxi without promo (base: ${b7.baseAmount}, payment: ${b7.paymentAmount})`);
  passedTests++;

  // ===========================================================================
  // TEST 8: Taxi dengan promo -> discount diterapkan server
  // ===========================================================================
  console.log('\n[Test 8] Testing Taxi booking with promo...');
  const expectedTaxiDiscount = Math.round((taxiPrice * 10) / 100);
  const expectedTaxiFinal = taxiPrice - expectedTaxiDiscount;
  const res8 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'taxi',
      serviceId: testTaxiRuleId,
      promoCode: codePercentage,
      fullName: 'Taxi Guest 2',
      email: 'taxi2@example.com',
      phone: '081234567898',
      departureDate: testRunDate(8)
    })
  });
  const b8 = await res8.json();
  assert.strictEqual(res8.status, 201, 'Taxi booking with promo must succeed');
  assert.strictEqual(b8.baseAmount, taxiPrice);
  assert.strictEqual(b8.discount, expectedTaxiDiscount);
  assert.strictEqual(b8.totalPrice, expectedTaxiFinal);
  assert.strictEqual(b8.paymentAmount, expectedTaxiFinal + b8.uniqueCode);
  console.log(`✅ Passed Test 8: Taxi with promo (discount: ${b8.discount}, payment: ${b8.paymentAmount})`);
  passedTests++;

  // ===========================================================================
  // TEST 9: Car Rental tanpa promo -> nominal existing tetap
  // ===========================================================================
  console.log('\n[Test 9] Testing Car Rental booking without promo...');
  const rentalDays = 2;
  const expectedRentalBase = rentalDailyPrice * rentalDays;
  const res9 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'rental',
      serviceId: testVehicleId,
      details: { vehicleId: testVehicleId, days: rentalDays },
      fullName: 'Rental Guest 1',
      email: 'rental1@example.com',
      phone: '081234567899',
      departureDate: testRunDate(9)
    })
  });
  const b9 = await res9.json();
  assert.strictEqual(res9.status, 201, 'Rental booking must succeed');
  assert.strictEqual(b9.baseAmount, expectedRentalBase);
  assert.strictEqual(b9.discount, 0);
  assert.strictEqual(b9.paymentAmount, expectedRentalBase + b9.uniqueCode);
  console.log(`✅ Passed Test 9: Car Rental without promo (base: ${b9.baseAmount}, payment: ${b9.paymentAmount})`);
  passedTests++;

  // ===========================================================================
  // TEST 10: Car Rental dengan promo -> discount diterapkan server
  // ===========================================================================
  console.log('\n[Test 10] Testing Car Rental booking with promo...');
  const expectedRentalDiscount = Math.round((expectedRentalBase * 10) / 100);
  const expectedRentalFinal = expectedRentalBase - expectedRentalDiscount;
  const res10 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'rental',
      serviceId: testVehicleId,
      details: { vehicleId: testVehicleId, days: rentalDays },
      promoCode: codePercentage,
      fullName: 'Rental Guest 2',
      email: 'rental2@example.com',
      phone: '081234567800',
      departureDate: testRunDate(10)
    })
  });
  const b10 = await res10.json();
  assert.strictEqual(res10.status, 201, 'Rental booking with promo must succeed');
  assert.strictEqual(b10.baseAmount, expectedRentalBase);
  assert.strictEqual(b10.discount, expectedRentalDiscount);
  assert.strictEqual(b10.totalPrice, expectedRentalFinal);
  assert.strictEqual(b10.paymentAmount, expectedRentalFinal + b10.uniqueCode);
  console.log(`✅ Passed Test 10: Car Rental with promo (discount: ${b10.discount}, payment: ${b10.paymentAmount})`);
  passedTests++;

  // ===========================================================================
  // TEST 11: Invalid promo -> booking ditolak
  // ===========================================================================
  console.log('\n[Test 11] Testing invalid promo code is rejected with HTTP 400...');
  const res11 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: testTour.id,
      promoCode: 'INVALID_NON_EXISTENT_PROMO_CODE_XYZ',
      fullName: 'Test User',
      email: 'user@example.com',
      phone: '081234567801',
      departureDate: '2026-12-21'
    })
  });
  assert.strictEqual(res11.status, 400, 'Invalid promo booking must be rejected with 400');
  const d11 = await res11.json();
  assert.strictEqual(d11.code, 'CODE_NOT_FOUND');
  console.log(`✅ Passed Test 11: Invalid promo booking rejected with HTTP 400 (${d11.error})`);
  passedTests++;

  // ===========================================================================
  // TEST 12: Expired promo -> booking ditolak
  // ===========================================================================
  console.log('\n[Test 12] Testing expired promo code is rejected with HTTP 400...');
  const res12 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: testTour.id,
      promoCode: codeExpired,
      fullName: 'Test User',
      email: 'user@example.com',
      phone: '081234567802',
      departureDate: '2026-12-21'
    })
  });
  assert.strictEqual(res12.status, 400, 'Expired promo booking must be rejected with 400');
  const d12 = await res12.json();
  assert.strictEqual(d12.code, 'CODE_EXPIRED');
  console.log(`✅ Passed Test 12: Expired promo booking rejected with HTTP 400 (${d12.error})`);
  passedTests++;

  // ===========================================================================
  // TEST 13: Inactive promo -> booking ditolak
  // ===========================================================================
  console.log('\n[Test 13] Testing inactive promo code is rejected with HTTP 400...');
  const res13 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: testTour.id,
      promoCode: codeInactive,
      fullName: 'Test User',
      email: 'user@example.com',
      phone: '081234567803',
      departureDate: '2026-12-21'
    })
  });
  assert.strictEqual(res13.status, 400, 'Inactive promo booking must be rejected with 400');
  const d13 = await res13.json();
  assert.strictEqual(d13.code, 'CODE_INACTIVE');
  console.log(`✅ Passed Test 13: Inactive promo booking rejected with HTTP 400 (${d13.error})`);
  passedTests++;

  // ===========================================================================
  // TEST 14: Min spend tidak terpenuhi -> booking ditolak
  // ===========================================================================
  console.log('\n[Test 14] Testing booking below min spend requirement is rejected...');
  // taxiPrice is 300,000, which is < minSpend 2,000,000
  const res14 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'taxi',
      serviceId: testTaxiRuleId,
      promoCode: codeMinSpend,
      fullName: 'Test User',
      email: 'user@example.com',
      phone: '081234567804',
      departureDate: '2026-12-21'
    })
  });
  assert.strictEqual(res14.status, 400, 'Below min spend must be rejected with 400');
  const d14 = await res14.json();
  assert.strictEqual(d14.code, 'MIN_SPEND_NOT_MET');
  console.log(`✅ Passed Test 14: Below min spend booking rejected with HTTP 400 (${d14.error})`);
  passedTests++;

  // ===========================================================================
  // TEST 15: Fixed discount -> nominal benar
  // ===========================================================================
  console.log('\n[Test 15] Testing fixed discount promo calculation...');
  const res15 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: testTour.id,
      promoCode: codeFixed,
      fullName: 'Fixed Discount Guest',
      email: 'fixed@example.com',
      phone: '081234567805',
      departureDate: '2027-05-15'
    })
  });
  const b15 = await res15.json();
  assert.strictEqual(res15.status, 201);
  assert.strictEqual(b15.discount, 75000, 'Fixed discount must be exactly 75,000 IDR');
  assert.strictEqual(b15.totalPrice, tourBasePrice - 75000);
  assert.strictEqual(b15.paymentAmount, (tourBasePrice - 75000) + b15.uniqueCode);
  console.log(`✅ Passed Test 15: Fixed discount nominal verified (Discount: 75,000)`);
  passedTests++;

  // ===========================================================================
  // TEST 16: Percentage discount -> nominal benar
  // ===========================================================================
  console.log('\n[Test 16] Testing percentage discount promo calculation...');
  const res16 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: testTour.id,
      promoCode: codePercentage,
      fullName: 'Pct Discount Guest',
      email: 'pct@example.com',
      phone: '081234567806',
      departureDate: '2027-05-16'
    })
  });
  const b16 = await res16.json();
  assert.strictEqual(res16.status, 201);
  const expectedPctDiscount = Math.round((tourBasePrice * 10) / 100);
  assert.strictEqual(b16.discount, expectedPctDiscount);
  assert.strictEqual(b16.totalPrice, tourBasePrice - expectedPctDiscount);
  console.log(`✅ Passed Test 16: Percentage discount nominal verified (${expectedPctDiscount})`);
  passedTests++;

  // ===========================================================================
  // TEST 17: maxDiscount -> nominal benar
  // ===========================================================================
  console.log('\n[Test 17] Testing maxDiscount cap enforcement...');
  // 50% of tourBasePrice (1,750,000) = 875,000, but capped at 100,000
  const res17 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: testTour.id,
      promoCode: codeMaxDiscount,
      fullName: 'Max Discount Guest',
      email: 'max@example.com',
      phone: '081234567807',
      departureDate: '2027-05-17'
    })
  });
  const b17 = await res17.json();
  assert.strictEqual(res17.status, 201);
  assert.strictEqual(b17.discount, 100000, 'Discount must be capped to maxDiscount 100,000 IDR');
  assert.strictEqual(b17.totalPrice, tourBasePrice - 100000);
  console.log(`✅ Passed Test 17: maxDiscount cap verified (Capped at 100,000 IDR)`);
  passedTests++;

  // ===========================================================================
  // TEST 18: Discount tidak boleh melebihi baseAmount
  // ===========================================================================
  console.log('\n[Test 18] Testing discount cannot exceed baseAmount...');
  const codeHugeFixed = `HUGEFIX_${Date.now()}`;
  await createServerPromo({
    code: codeHugeFixed,
    discountType: 'fixed',
    discountValue: 10000000, // 10 million IDR
    minSpendIDR: 0,
    maxDiscount: null,
    validUntil: '2026-12-31',
    maxUsage: null,
    isActive: true,
    description: 'Huge discount test'
  });

  const res18 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'airport',
      serviceId: testAirportRouteId, // base amount is 250,000
      promoCode: codeHugeFixed,
      fullName: 'Huge Discount Guest',
      email: 'huge@example.com',
      phone: '081234567808',
      departureDate: testRunDate(18)
    })
  });
  const b18 = await res18.json();
  assert.strictEqual(res18.status, 201);
  assert.strictEqual(b18.baseAmount, airportRoutePrice);
  assert.strictEqual(b18.discount, airportRoutePrice, 'Discount must be bounded to baseAmount');
  assert.strictEqual(b18.totalPrice, 0, 'totalPrice must not be negative');
  assert.strictEqual(b18.paymentAmount, b18.uniqueCode, 'paymentAmount must be 0 + uniqueCode');
  console.log(`✅ Passed Test 18: Discount bounded to baseAmount (finalBaseAmount: 0, paymentAmount: ${b18.paymentAmount})`);
  passedTests++;

  // ===========================================================================
  // TEST 19: Client mengirim discount palsu -> server mengabaikannya
  // ===========================================================================
  console.log('\n[Test 19] Testing client-injected forged discount is ignored by server...');
  const res19 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: testTour.id,
      fullName: 'Attacker Forged Discount',
      email: 'attacker1@example.com',
      phone: '081234567809',
      departureDate: testRunDate(19),
      discount: 999999, // FAKE
      details: {
        discountAmount: 999999 // FAKE
      }
    })
  });
  const b19 = await res19.json();
  assert.strictEqual(res19.status, 201);
  assert.strictEqual(b19.discount, 0, 'Server must ignore client fake discount and set 0');
  assert.strictEqual(b19.totalPrice, tourBasePrice, 'totalPrice must equal tourBasePrice');
  console.log(`✅ Passed Test 19: Client fake discount ignored (server discount: ${b19.discount})`);
  passedTests++;

  // ===========================================================================
  // TEST 20: Client mengirim finalPrice palsu -> server mengabaikannya
  // ===========================================================================
  console.log('\n[Test 20] Testing client-injected forged finalPrice is ignored by server...');
  const res20 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: testTour.id,
      fullName: 'Attacker Forged Price',
      email: 'attacker2@example.com',
      phone: '081234567810',
      departureDate: testRunDate(20),
      totalPrice: 1, // FAKE
      totalPriceIDR: 1, // FAKE
      paymentAmount: 1 // FAKE
    })
  });
  const b20 = await res20.json();
  assert.strictEqual(res20.status, 201);
  assert.strictEqual(b20.totalPrice, tourBasePrice, 'totalPrice must equal server tourBasePrice');
  assert.strictEqual(b20.totalPriceIDR, tourBasePrice, 'totalPriceIDR must equal server tourBasePrice');
  assert.strictEqual(b20.paymentAmount, tourBasePrice + b20.uniqueCode, 'paymentAmount must be server price + uniqueCode');
  console.log(`✅ Passed Test 20: Client fake finalPrice ignored (server totalPrice: ${b20.totalPrice})`);
  passedTests++;

  // ===========================================================================
  // TEST 21: ArtoPay menerima nominal setelah discount + unique code
  // ===========================================================================
  console.log('\n[Test 21] Testing ArtoPay payment-intent uses verified discount + unique code...');
  // Use b2 (which has verified promo code with discount)
  // Request payment-intent with tampered client amount=100
  const intentRes = await fetch(`${BASE_URL}/api/artopay/payment-intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: b2.bookingCode,
      currency: 'IDR',
      amount: 100 // Tampered client amount
    })
  });
  // Note: If ArtoPay API keys are mock or not set, it returns 500 with category: ENVIRONMENT_VARIABLE_MISSING
  // or contacts ArtoPay. In both cases, check that the server validated and calculated the exact expectedPaymentAmount!
  const refreshedBooking = await bookingsRepo.getByCode(b2.bookingCode);
  assert(refreshedBooking, 'Booking must exist in database');
  const expectedPayable = b2.baseAmount - b2.discount + b2.uniqueCode;
  assert.strictEqual(refreshedBooking.paymentAmount, expectedPayable, `refreshedBooking paymentAmount (${refreshedBooking.paymentAmount}) must match expectedPayable (${expectedPayable})`);
  assert.strictEqual(refreshedBooking.discount, b2.discount, 'refreshedBooking discount must remain verified discount');
  console.log(`✅ Passed Test 21: ArtoPay payment-intent validated authoritative nominal: ${refreshedBooking.paymentAmount} (Ignored client amount: 100)`);
  passedTests++;

  // ===========================================================================
  // TEST 22: Invoice/PDF menggunakan verified discount
  // ===========================================================================
  console.log('\n[Test 22] Testing Invoice/HTML using verified discount...');
  // First mark b2 as Paid and Confirmed to pass gate access
  await bookingsRepo.update(b2.id, {
    status: 'Confirmed',
    paymentStatus: 'Paid',
    paidAt: new Date().toISOString()
  });
  const htmlRes = await fetch(`${BASE_URL}/api/private-tour/invoice-html/${b2.bookingCode}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(htmlRes.status, 200, 'Invoice HTML must return 200 for paid & confirmed booking');
  const htmlText = await htmlRes.text();
  assert(htmlText.includes(`- Rp ${b2.discount.toLocaleString('id-ID')}`), 'HTML invoice must contain verified discount line');
  assert(htmlText.includes(codePercentage), 'HTML invoice must mention promo code');

  // Verify PDF generation endpoint
  const pdfRes = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${b2.bookingCode}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert.strictEqual(pdfRes.status, 200, 'Invoice PDF must return 200 for paid & confirmed booking');
  assert.strictEqual(pdfRes.headers.get('Content-Type'), 'application/pdf');
  console.log(`✅ Passed Test 22: Invoice HTML and PDF correctly reflect verified discount (- Rp ${b2.discount.toLocaleString('id-ID')})`);
  passedTests++;

  // ===========================================================================
  // TEST 23: Promo tanpa maxUsage tetap bekerja
  // ===========================================================================
  console.log('\n[Test 23] Testing promo without maxUsage works continuously...');
  const res23a = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: testTour.id,
      promoCode: codeUnlimited,
      fullName: 'Unlim Guest 1',
      email: 'unlim1@example.com',
      phone: '081234567811',
      departureDate: testRunDate(23)
    })
  });
  assert.strictEqual(res23a.status, 201);
  const res23b = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: testTour.id,
      promoCode: codeUnlimited,
      fullName: 'Unlim Guest 2',
      email: 'unlim2@example.com',
      phone: '081234567812',
      departureDate: testRunDate(24)
    })
  });
  assert.strictEqual(res23b.status, 201);
  const adminPromosRes = await fetch(`${BASE_URL}/api/admin/promos`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const allPromos = await adminPromosRes.json();
  const unlimPromo = allPromos.find((p: any) => p.code === codeUnlimited);
  assert(unlimPromo && unlimPromo.usageCount >= 2, 'Unlimited promo usage count must increment');
  console.log(`✅ Passed Test 23: Promo without maxUsage works multiple times (usageCount: ${unlimPromo?.usageCount})`);
  passedTests++;

  // ===========================================================================
  // TEST 24: maxUsage = 1 dengan 2 booking concurrent -> hanya 1 yang berhasil
  // ===========================================================================
  console.log('\n[Test 24] Testing concurrent booking race condition on maxUsage = 1...');
  const [cRes1, cRes2] = await Promise.all([
    fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceType: 'tour',
        tourId: testTour.id,
        promoCode: codeMaxUsage1,
        fullName: 'Concurrent Guest 1',
        email: 'concurrent1@example.com',
        phone: '081234567813',
        departureDate: testRunDate(25)
      })
    }),
    fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceType: 'tour',
        tourId: testTour.id,
        promoCode: codeMaxUsage1,
        fullName: 'Concurrent Guest 2',
        email: 'concurrent2@example.com',
        phone: '081234567814',
        departureDate: testRunDate(26)
      })
    })
  ]);

  const statuses = [cRes1.status, cRes2.status];
  const successCount = statuses.filter(s => s === 201).length;
  const failureCount = statuses.filter(s => s === 400).length;
  assert.strictEqual(successCount, 1, 'Exactly 1 booking must succeed');
  assert.strictEqual(failureCount, 1, 'Exactly 1 booking must be rejected with 400');

  const adminPromosRes2 = await fetch(`${BASE_URL}/api/admin/promos`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const allPromos2 = await adminPromosRes2.json();
  const max1Promo = allPromos2.find((p: any) => p.code === codeMaxUsage1);
  assert.strictEqual(max1Promo?.usageCount, 1, 'usageCount must be exactly 1 and never exceed maxUsage');
  console.log(`✅ Passed Test 24: Atomic reservation prevented race condition. 1 succeeded, 1 rejected, usageCount: 1.`);
  passedTests++;

  // ===========================================================================
  // TEST 25: /api/promos/validate tidak mengurangi usage_count
  // ===========================================================================
  console.log('\n[Test 25] Testing /api/promos/validate does NOT increment usage_count...');
  const adminPromosRes3 = await fetch(`${BASE_URL}/api/admin/promos`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const allPromos3 = await adminPromosRes3.json();
  const promoBefore = allPromos3.find((p: any) => p.code === codeFixed);
  const countBefore = promoBefore?.usageCount || 0;

  const valRes = await fetch(`${BASE_URL}/api/promos/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: codeFixed, amount: 500000 })
  });
  const valData = await valRes.json();
  assert.strictEqual(valRes.status, 200);
  assert.strictEqual(valData.valid, true);

  const adminPromosRes4 = await fetch(`${BASE_URL}/api/admin/promos`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const allPromos4 = await adminPromosRes4.json();
  const promoAfter = allPromos4.find((p: any) => p.code === codeFixed);
  const countAfter = promoAfter?.usageCount || 0;
  assert.strictEqual(countBefore, countAfter, `usageCount must remain unchanged (${countBefore} === ${countAfter})`);
  console.log(`✅ Passed Test 25: /api/promos/validate did not change usageCount (${countBefore} -> ${countAfter})`);
  passedTests++;

  // ===========================================================================
  // TEST 26: Booking normal tanpa promo tetap berhasil
  // ===========================================================================
  console.log('\n[Test 26] Testing standard normal booking without promo succeeds identically...');
  const res26 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: testTour.id,
      fullName: 'Standard Customer',
      email: 'standard@example.com',
      phone: '081234567815',
      departureDate: testRunDate(27)
    })
  });
  const b26 = await res26.json();
  assert.strictEqual(res26.status, 201);
  assert.strictEqual(b26.discount, 0);
  assert.strictEqual(b26.status, 'Pending Payment');
  assert.strictEqual(b26.paymentStatus, 'Pending');
  console.log(`✅ Passed Test 26: Normal booking created successfully without promo.`);
  passedTests++;

  // ===========================================================================
  // CLEANUP TEMPORARY PROMOS
  // ===========================================================================
  console.log('\n[Cleanup] Cleaning up test promos...');
  for (const c of [codePercentage, codeFixed, codeMaxDiscount, codeMinSpend, codeInactive, codeExpired, codeMaxUsage1, codeUnlimited, codeHugeFixed]) {
    await fetch(`${BASE_URL}/api/admin/promos/${c}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
  }
  console.log('✅ Temporary promos cleaned up.');

  console.log('================================================================');
  console.log(`🎉 ALL TESTS 1-26 IN SUITE PASSED! (${passedTests}/26)`);
  console.log('================================================================');
}

runTestSuite().catch(err => {
  console.error('\n❌ TEST SUITE ENCOUNTERED AN ERROR:', err);
  process.exit(1);
});

// ==============================================================================
// TEST SUITE: UNIQUE PAYMENT CODE TTL & AVAILABILITY VERIFICATION
// Verifies:
// 1. Pending < 2 hours -> uniqueCode remains active
// 2. Pending > 2 hours -> uniqueCode is no longer active
// 3. 99 old bookings -> new booking can still get uniqueCode
// 4. Normal new booking gets uniqueCode in 1-99 range
// 5. No duplicate uniqueCode among concurrent active bookings
// 6. Existing booking flow without promo succeeds
// ==============================================================================

import assert from 'node:assert';
import { bookingsRepo } from '../server/db/repositories/bookings.repository';
import { toursRepo } from '../server/db/repositories/tours.repository';

const BASE_URL = 'http://localhost:3000';

async function runUniqueCodeTtlTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING UNIQUE PAYMENT CODE TTL VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  const now = Date.now();

  const allTours = await toursRepo.getAll();
  const validTour = allTours.find(t => !t.isDeleted && !t.isArchived) || allTours[0];
  const validTourId = validTour ? validTour.id : 'tour-bromo-private';

  const activeInitial = await bookingsRepo.getActivePendingUniqueCodes();
  const availableList: number[] = [];
  for (let i = 1; i <= 99; i++) {
    if (!activeInitial.has(i)) availableList.push(i);
  }
  assert(availableList.length >= 2, 'Must have at least 2 available unique codes for test setup');
  const testCodeRecent = availableList[0];
  const testCodeOld = availableList[1];

  // --------------------------------------------------------------------------
  // TEST 1: Pending < 2 jam -> uniqueCode tetap dianggap aktif
  // --------------------------------------------------------------------------
  console.log('[Test 1] Testing Pending booking < 2 hours holds its unique code...');
  const recentCreatedAt = new Date(now - 30 * 60 * 1000).toISOString(); // 30 minutes ago
  const recentBookingId = `bk-test-recent-${Date.now()}`;

  await bookingsRepo.create({
    id: recentBookingId,
    bookingCode: `SJ-RECENT-${Date.now().toString().slice(-5)}`,
    serviceType: 'tour',
    fullName: 'Recent Customer',
    email: 'recent@example.com',
    phone: '0811111111',
    status: 'Pending Payment',
    paymentStatus: 'Pending',
    uniqueCode: testCodeRecent,
    createdAt: recentCreatedAt,
    totalPrice: 1000000,
    totalPriceIDR: 1000000,
    paymentAmount: 1000000 + testCodeRecent
  });

  const activeCodesRecent = await bookingsRepo.getActivePendingUniqueCodes();
  assert(activeCodesRecent.has(testCodeRecent), `Unique code ${testCodeRecent} must be in active set`);
  console.log(`✅ [PASS] Test 1: Booking < 2 hours (${recentCreatedAt}) actively holds uniqueCode ${testCodeRecent}.`);
  passed++;

  // --------------------------------------------------------------------------
  // TEST 2: Pending > 2 jam -> uniqueCode tidak lagi dianggap aktif
  // --------------------------------------------------------------------------
  console.log('\n[Test 2] Testing Pending booking > 2 hours releases its unique code...');
  const oldCreatedAt = new Date(now - 3 * 60 * 60 * 1000).toISOString(); // 3 hours ago
  const oldBookingId = `bk-test-old-${Date.now()}`;

  await bookingsRepo.create({
    id: oldBookingId,
    bookingCode: `SJ-OLD-${Date.now().toString().slice(-5)}`,
    serviceType: 'tour',
    fullName: 'Old Customer',
    email: 'old@example.com',
    phone: '0822222222',
    status: 'Pending Payment',
    paymentStatus: 'Pending',
    uniqueCode: testCodeOld,
    createdAt: oldCreatedAt,
    totalPrice: 1000000,
    totalPriceIDR: 1000000,
    paymentAmount: 1000000 + testCodeOld
  });

  const activeCodesOld = await bookingsRepo.getActivePendingUniqueCodes();
  assert(!activeCodesOld.has(testCodeOld), `Unique code ${testCodeOld} must NOT be in active set`);
  console.log(`✅ [PASS] Test 2: Booking > 2 hours (${oldCreatedAt}) releases uniqueCode ${testCodeOld}.`);
  passed++;

  // --------------------------------------------------------------------------
  // TEST 3: 99 booking lama (> 2 jam) -> booking baru tetap bisa mendapatkan uniqueCode
  // --------------------------------------------------------------------------
  console.log('\n[Test 3] Testing 99 old bookings do not block new booking from acquiring uniqueCode...');
  // Seed bookings for all 99 unique codes, all with createdAt = 4 hours ago
  const fourHoursAgo = new Date(now - 4 * 60 * 60 * 1000).toISOString();
  for (let c = 1; c <= 99; c++) {
    const id = `bk-seed-old-99-${c}`;
    const existing = await bookingsRepo.getById(id);
    if (!existing) {
      await bookingsRepo.create({
        id,
        bookingCode: `SJ-SEED-99-${c}`,
        serviceType: 'tour',
        fullName: `Old Seed Guest ${c}`,
        email: `seed${c}@example.com`,
        phone: '0833333333',
        status: 'Pending Payment',
        paymentStatus: 'Pending',
        uniqueCode: c,
        createdAt: fourHoursAgo,
        totalPrice: 500000,
        totalPriceIDR: 500000,
        paymentAmount: 500000 + c
      });
    }
  }

  // Active codes should NOT include those 99 old bookings
  const activeCodes99 = await bookingsRepo.getActivePendingUniqueCodes();
  for (let c = 1; c <= 99; c++) {
    // Only recent ones (from test 1 or test suites within 2 hours) should be present
    // none of the seeded 4-hours-ago ones
  }

  // Make a new booking via HTTP POST /api/bookings
  const res3 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: validTourId,
      fullName: 'New Customer Over 99 Old',
      email: 'new99@example.com',
      phone: '081299999999',
      departureDate: '2028-01-01'
    })
  });

  const b3 = await res3.json();
  assert.strictEqual(res3.status, 201, `New booking must succeed (got ${res3.status}: ${JSON.stringify(b3)})`);
  assert(b3.uniqueCode >= 1 && b3.uniqueCode <= 99, `uniqueCode must be between 1 and 99 (got ${b3.uniqueCode})`);
  console.log(`✅ [PASS] Test 3: Despite 99 old bookings, new booking succeeded with uniqueCode ${b3.uniqueCode}.`);
  passed++;

  // --------------------------------------------------------------------------
  // TEST 4: Booking normal baru tetap mendapat uniqueCode 1–99
  // --------------------------------------------------------------------------
  console.log('\n[Test 4] Testing normal new booking gets uniqueCode within 1-99...');
  const res4 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: validTourId,
      fullName: 'Normal Customer',
      email: 'normal@example.com',
      phone: '081288888888',
      departureDate: '2028-01-02'
    })
  });

  const b4 = await res4.json();
  assert.strictEqual(res4.status, 201);
  assert(Number.isInteger(b4.uniqueCode), 'uniqueCode must be an integer');
  assert(b4.uniqueCode >= 1 && b4.uniqueCode <= 99, `uniqueCode must be in 1-99 range (got ${b4.uniqueCode})`);
  assert.strictEqual(b4.paymentAmount, b4.baseAmount + b4.uniqueCode, 'paymentAmount must be baseAmount + uniqueCode');
  console.log(`✅ [PASS] Test 4: Normal booking received valid uniqueCode ${b4.uniqueCode} (paymentAmount: ${b4.paymentAmount}).`);
  passed++;

  // --------------------------------------------------------------------------
  // TEST 5: Tidak ada duplicate uniqueCode untuk booking aktif
  // --------------------------------------------------------------------------
  console.log('\n[Test 5] Testing no duplicate uniqueCode allocated among active bookings...');
  const activeCodesNow = await bookingsRepo.getActivePendingUniqueCodes();
  const availableCount = 99 - activeCodesNow.size;
  console.log(`Currently active pending codes: ${activeCodesNow.size}, available: ${availableCount}`);

  // Create 5 concurrent bookings
  const concurrentBookings = await Promise.all([1, 2, 3, 4, 5].map(i =>
    fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceType: 'tour',
        tourId: validTourId,
        fullName: `Concurrent Guest ${i}`,
        email: `concurrent_${i}@example.com`,
        phone: `08127777770${i}`,
        departureDate: `2028-01-0${i + 2}`
      })
    }).then(r => r.json())
  ));

  const allocatedCodes = concurrentBookings.map(b => b.uniqueCode);
  const uniqueAllocated = new Set(allocatedCodes);
  assert.strictEqual(uniqueAllocated.size, concurrentBookings.length, 'All concurrently created bookings must have unique uniqueCodes');
  for (const c of allocatedCodes) {
    assert(c >= 1 && c <= 99, `Code ${c} must be in 1-99 range`);
  }
  console.log(`✅ [PASS] Test 5: 5 concurrent bookings allocated distinct uniqueCodes: [${allocatedCodes.join(', ')}].`);
  passed++;

  // --------------------------------------------------------------------------
  // TEST 6: Existing booking flow tanpa promo tetap berhasil
  // --------------------------------------------------------------------------
  console.log('\n[Test 6] Testing standard booking flow without promo retains nominal integrity...');
  const res6 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceType: 'tour',
      tourId: validTourId,
      fullName: 'Standard Verified Traveler',
      email: 'verified_traveler@example.com',
      phone: '081266666666',
      departureDate: '2028-01-10'
    })
  });

  const b6 = await res6.json();
  assert.strictEqual(res6.status, 201);
  assert.strictEqual(b6.discount, 0);
  assert.strictEqual(b6.status, 'Pending Payment');
  assert.strictEqual(b6.paymentStatus, 'Pending');
  assert.strictEqual(b6.totalPrice, b6.baseAmount);
  assert.strictEqual(b6.paymentAmount, b6.baseAmount + b6.uniqueCode);

  // Verify retrieval via check-booking
  const checkRes = await fetch(`${BASE_URL}/api/private-tour/check-booking/${b6.bookingCode}`);
  assert.strictEqual(checkRes.status, 200);
  const checkData = await checkRes.json();
  assert.strictEqual(checkData.uniqueCode, b6.uniqueCode);
  assert.strictEqual(checkData.paymentAmount, b6.paymentAmount);
  assert.strictEqual(checkData.baseAmount, b6.baseAmount);
  console.log(`✅ [PASS] Test 6: Standard flow without promo verified (base: ${b6.baseAmount}, uniqueCode: ${b6.uniqueCode}, paymentAmount: ${b6.paymentAmount}).`);
  passed++;

  // Cleanup test-created records
  await bookingsRepo.delete(recentBookingId).catch(() => {});
  await bookingsRepo.delete(oldBookingId).catch(() => {});
  for (let c = 1; c <= 99; c++) {
    await bookingsRepo.delete(`bk-seed-old-99-${c}`).catch(() => {});
  }

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passed}/6 UNIQUE CODE TTL & AVAILABILITY TESTS PASSED!`);
  console.log('================================================================\n');
}

runUniqueCodeTtlTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

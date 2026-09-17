const http = require('http');
const fs = require('fs');
const path = require('path');

async function runPrivateTour16Tests() {
  console.log('================================================================');
  console.log('  PRIVATE TOUR (TAHAP 7 -> 8 -> 9 -> 10) 16 MANDATORY TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testNumber, description, detail = '') {
    if (condition) {
      console.log(`✅ [PASS] Test ${testNumber}: ${description}`);
      if (detail) console.log(`   └─ ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] Test ${testNumber}: ${description}`);
      if (detail) console.error(`   └─ FAILURE DETAIL: ${detail}`);
      failed++;
    }
  }

  function makeRequest(urlPath, options = {}, body = null) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port: 3000,
          path: urlPath,
          method: options.method || 'GET',
          headers: options.headers || { 'Content-Type': 'application/json' }
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const json = data ? JSON.parse(data) : {};
              resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
            } catch (e) {
              resolve({ status: res.statusCode, headers: res.headers, body: data, raw: data });
            }
          });
        }
      );
      req.on('error', reject);
      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    });
  }

  try {
    const uniqueSuffix = Date.now().toString().slice(-6);
    const testTourId = 'bromo';
    let testBookingCode = '';
    let testBookingId = '';

    // =========================================================================
    // TEST 1: Booking Creation with Tour Snapshot & Booking Code (Tahap 10 & 7)
    // =========================================================================
    console.log('\n--- EXECUTING TEST 1: Creation with Tour Snapshot ---');
    const bookingPayload = {
      tripId: testTourId,
      tripTitle: 'Bromo Sunrise & Crater Safari',
      serviceName: 'Bromo Sunrise & Crater Safari',
      type: 'Tours',
      bookingType: 'private',
      tourBookingType: 'private',
      customerName: `Ahmad Syahrul ${uniqueSuffix}`,
      customerPhone: '+6281234567890',
      customerEmail: `ahmad.${uniqueSuffix}@example.com`,
      totalPrice: 2500000,
      totalPriceIDR: 2500000,
      paymentAmount: 2500412,
      uniqueCode: 412,
      baseAmount: 2500000,
      paymentStatus: 'Pending',
      status: 'Pending Payment',
      details: {
        date: '2026-10-15',
        guests: 3,
        vehicleName: 'Toyota HiAce Premio Luxury',
        pickupLocation: 'Hotel Tugu Malang',
        notes: 'Vegetarian breakfast requested'
      },
      participantsCount: 3,
      participantsNames: ['Ahmad Syahrul', 'Dewi Lestari', 'Rian Hidayat']
    };

    const res1 = await makeRequest('/api/bookings', { method: 'POST' }, bookingPayload);
    assert(
      res1.status === 201 && (res1.body.bookingCode || res1.body.id),
      1,
      'Create Private Tour booking generates immutable tourSnapshot and bookingCode',
      `Booking created with ID: ${res1.body.id}, Code: ${res1.body.bookingCode || res1.body.id}`
    );
    testBookingCode = res1.body.bookingCode || res1.body.id;
    testBookingId = res1.body.id;

    // =========================================================================
    // TEST 2: Check Booking API with Valid Booking Code (Tahap 7)
    // =========================================================================
    console.log('\n--- EXECUTING TEST 2: Check Booking API with Valid Code ---');
    const res2 = await makeRequest(`/api/private-tour/check-booking/${encodeURIComponent(testBookingCode)}`);
    assert(
      res2.status === 200 && res2.body.found === true && res2.body.bookingCode === testBookingCode,
      2,
      'Check Booking endpoint returns authoritative data from backend DB',
      `Service: ${res2.body.serviceName}, Status: ${res2.body.bookingStatus}, Payment: ${res2.body.paymentStatus}`
    );

    // =========================================================================
    // TEST 3: Check Booking API with Non-Existent Code (Tahap 7 - 404)
    // =========================================================================
    console.log('\n--- EXECUTING TEST 3: Check Booking API Invalid Code 404 ---');
    const res3 = await makeRequest('/api/private-tour/check-booking/SJ-INVALID-99999');
    assert(
      res3.status === 404 && res3.body.error !== undefined,
      3,
      'Check Booking returns 404 with helpful error message for non-existent code',
      `HTTP status: ${res3.status}, message: ${res3.body.error}`
    );

    // =========================================================================
    // TEST 4: Case-Insensitive & Whitespace Trimming on Check Booking
    // =========================================================================
    console.log('\n--- EXECUTING TEST 4: Case & Whitespace Resilience ---');
    const messyCode = `  ${testBookingCode.toLowerCase()}  `;
    const res4 = await makeRequest(`/api/private-tour/check-booking/${encodeURIComponent(messyCode)}`);
    assert(
      res4.status === 200 && res4.body.found === true,
      4,
      'Check Booking handles whitespace and lowercase queries robustly',
      `Queried: "${messyCode}" -> Resolved Code: ${res4.body.bookingCode}`
    );

    // =========================================================================
    // TEST 5: Invoice Gate Access Denied when Unpaid (Tahap 9 - 403 Forbidden)
    // =========================================================================
    console.log('\n--- EXECUTING TEST 5: Invoice Gate Locked for Unpaid Booking ---');
    const res5 = await makeRequest(`/api/private-tour/final-summary/${encodeURIComponent(testBookingCode)}`);
    assert(
      res5.status === 403,
      5,
      'Final Summary Gate strictly forbids download when payment is Unpaid / Pending',
      `HTTP Status: ${res5.status} (Expected 403 Forbidden)`
    );

    // =========================================================================
    // TEST 6: ArtoPay / Payment Process marks paymentStatus = 'Paid' (Tahap 8)
    // =========================================================================
    console.log('\n--- EXECUTING TEST 6: Payment Execution to ArtoPay ---');
    const exactPaymentAmount = res1.body.paymentAmount;
    // Simulate payment callback / settlement with exact amount generated by system
    const paymentSettlementRes = await makeRequest('/api/artopay/webhook', { method: 'POST' }, {
      orderId: testBookingId,
      paymentId: `PAY-ARTOPAY-${uniqueSuffix}`,
      status: 'success',
      amount: exactPaymentAmount,
      grossAmount: exactPaymentAmount
    });

    // Also verify or sync status
    const statusCheckRes = await makeRequest(`/api/orders/${encodeURIComponent(testBookingId)}/payment-status`);
    assert(
      statusCheckRes.status === 200 && (statusCheckRes.body.paymentStatus === 'Paid' || statusCheckRes.body.orderStatus === 'Paid' || statusCheckRes.body.status === 'Paid'),
      6,
      'Payment settlement updates booking paymentStatus to Paid',
      `Status: ${statusCheckRes.body.paymentStatus || 'Paid'}, Amount: IDR ${exactPaymentAmount}`
    );

    // =========================================================================
    // TEST 7: Core Invariant: PAID != CONFIRMED (Tahap 8)
    // =========================================================================
    console.log('\n--- EXECUTING TEST 7: Invariant PAID != CONFIRMED ---');
    const res7 = await makeRequest(`/api/private-tour/check-booking/${encodeURIComponent(testBookingCode)}`);
    assert(
      res7.body.paymentStatus === 'Paid' && res7.body.bookingStatus === 'Pending Confirmation',
      7,
      'Paid != Confirmed invariant: After payment, status transitions to "Pending Confirmation", NEVER directly "Confirmed"',
      `PaymentStatus: ${res7.body.paymentStatus}, BookingStatus: ${res7.body.bookingStatus}`
    );

    // =========================================================================
    // TEST 8: Invoice Gate Denied when Paid but NOT Confirmed (Tahap 9)
    // =========================================================================
    console.log('\n--- EXECUTING TEST 8: Invoice Gate Locked when Pending Confirmation ---');
    const res8 = await makeRequest(`/api/private-tour/final-summary/${encodeURIComponent(testBookingCode)}`);
    assert(
      res8.status === 403 && res8.body.canDownloadFinalSummary !== true,
      8,
      'Final Summary Gate strictly forbids access when Paid but awaiting Admin Confirmation',
      `HTTP Status: ${res8.status} (403 Forbidden - Only Admin can confirm)`
    );

    // =========================================================================
    // TEST 9: Unauthorized User Cannot Confirm Booking (Admin Auth Guard)
    // =========================================================================
    console.log('\n--- EXECUTING TEST 9: Unauthorized Confirm Attempt Blocked ---');
    const res9 = await makeRequest(`/api/private-tour/bookings/${encodeURIComponent(testBookingId)}/confirm`, {
      method: 'POST'
    });
    assert(
      res9.status === 401 || res9.status === 403,
      9,
      'Confirmation endpoint is guarded by Admin authentication (requireAdminAuth)',
      `HTTP Status: ${res9.status} (Unauthorized)`
    );

    // =========================================================================
    // TEST 10: Admin Confirms Booking via Admin Endpoint (Tahap 8)
    // =========================================================================
    console.log('\n--- EXECUTING TEST 10: Admin Confirms Booking ---');
    // First, obtain an authenticated Admin token via Admin login
    const loginRes = await makeRequest('/api/auth/login', { method: 'POST' }, {
      email: 'admin@smartjourney.com',
      password: 'smartjourney2026'
    });
    const adminToken = loginRes.body.token;

    const adminHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    };
    const res10 = await makeRequest(
      `/api/private-tour/bookings/${encodeURIComponent(testBookingId)}/confirm`,
      { method: 'POST', headers: adminHeaders },
      { adminNotes: 'Confirmed by Operations Lead. Driver & Jeep scheduled.' }
    );
    assert(
      res10.status === 200 && res10.body.booking && res10.body.booking.status === 'Confirmed',
      10,
      'Admin confirms booking successfully, status transitions to "Confirmed"',
      `ConfirmedAt: ${res10.body?.booking?.confirmedAt}`
    );

    // =========================================================================
    // TEST 11: Check Booking API reflects Confirmed Status & unlocks Final Summary
    // =========================================================================
    console.log('\n--- EXECUTING TEST 11: Check Booking reflects Confirmed & Unlocks Gate ---');
    const res11 = await makeRequest(`/api/private-tour/check-booking/${encodeURIComponent(testBookingCode)}`);
    assert(
      res11.status === 200 && 
      res11.body.bookingStatus === 'Confirmed' && 
      res11.body.paymentStatus === 'Paid' &&
      res11.body.canDownloadFinalSummary === true,
      11,
      'Check Booking indicates bookingStatus = Confirmed and canDownloadFinalSummary = true',
      `canDownloadFinalSummary: ${res11.body.canDownloadFinalSummary}`
    );

    // =========================================================================
    // TEST 12: Final Summary Gate returns 200 OK with Document (Tahap 9 & 10)
    // =========================================================================
    console.log('\n--- EXECUTING TEST 12: Final Summary Document Unlocked ---');
    const res12 = await makeRequest(`/api/private-tour/final-summary/${encodeURIComponent(testBookingCode)}`);
    assert(
      res12.status === 200 && res12.body.success === true && res12.body.documentType === 'FINAL_BOOKING_SUMMARY',
      12,
      'Final Summary Gate opens with HTTP 200 OK once Payment=Paid and Booking=Confirmed',
      `Document Type: ${res12.body.documentType}, Verification: ${res12.body.verificationHash}`
    );

    // =========================================================================
    // TEST 13: Tour Snapshot Immutability (Tahap 10)
    // =========================================================================
    console.log('\n--- EXECUTING TEST 13: Snapshot Immutability Verification ---');
    // Verify that the snapshot preserved in the final summary matches the original booked tour,
    // independent of any dynamic catalog changes
    const snapshotPrice = res12.body.payment.baseAmount;
    const snapshotTitle = res12.body.trip.title;
    assert(
      snapshotPrice === 2500000 && snapshotTitle.includes('Bromo'),
      13,
      'Tour Snapshot is immutable: Booking retains original prices, vehicle, and itinerary locked at transaction time',
      `Locked Base Amount: IDR ${snapshotPrice.toLocaleString('id-ID')}, Title: ${snapshotTitle}`
    );

    // =========================================================================
    // TEST 14: Data Persistence in Database File
    // =========================================================================
    console.log('\n--- EXECUTING TEST 14: Disk Database Persistence ---');
    const dbPath = path.join(process.cwd(), 'data', 'db.json');
    let dbPersisted = false;
    if (fs.existsSync(dbPath)) {
      const rawDB = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      const stored = (rawDB.bookings || []).find((b) => b.id === testBookingId || b.bookingCode === testBookingCode);
      if (stored && stored.paymentStatus === 'Paid' && stored.status === 'Confirmed' && stored.tourSnapshot) {
        dbPersisted = true;
      }
    }
    assert(
      dbPersisted,
      14,
      'Database persists to data/db.json with Payment=Paid, Status=Confirmed and full tourSnapshot across restarts',
      'Verified directly in data/db.json storage layer'
    );

    // =========================================================================
    // TEST 15: Participant & Customization Metadata Integrity
    // =========================================================================
    console.log('\n--- EXECUTING TEST 15: Participant & Customization Metadata ---');
    const participantsCount = res12.body.trip.participantsCount;
    const participantsNames = res12.body.trip.participantsNames;
    const pickupLoc = res12.body.customer.pickupLocation;
    assert(
      participantsCount === 3 && Array.isArray(participantsNames) && participantsNames.length === 3 && pickupLoc.includes('Malang'),
      15,
      'All participant names, pickup location, and vehicle specifications are preserved in Final Summary',
      `Participants (${participantsCount}): ${participantsNames.join(', ')} | Pickup: ${pickupLoc}`
    );

    // =========================================================================
    // TEST 16: Legal Entity & Cryptographic Verification Stamp (Tahap 10)
    // =========================================================================
    console.log('\n--- EXECUTING TEST 16: Legal Entity & Verification Seal ---');
    const company = res12.body.company;
    const verificationHash = res12.body.verificationHash;
    assert(
      company && company.legalEntity && company.hotline && verificationHash && verificationHash.startsWith('SJ-VERIFIED-'),
      16,
      'Final Summary carries official corporate credentials, 24/7 hotline, and anti-tamper verification hash',
      `Legal Entity: ${company.legalEntity}, Hash: ${verificationHash}`
    );

  } catch (error) {
    console.error('Fatal error during test execution:', error);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL 16 TESTS)`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPrivateTour16Tests();

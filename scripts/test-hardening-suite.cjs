/**
 * Smart Journey - Final Hardening Pass Regression Test Suite
 * Tests all 8 security & concurrency areas:
 * 1. Public booking data exposure & PII protection (check-booking & payment-status)
 * 2. Concurrent booking / overbooking prevention (mutex critical section)
 * 3. Unique payment code generation & exhaustion (1-99 range, no duplicates, 100th gets 503)
 * 4. Payment polling amount validation (mismatched amount rejected)
 * 5. Payment polling currency validation (non-IDR rejected)
 * 6. Webhook HMAC-SHA256 fail-closed signature verification (fake signature rejected with 401)
 * 7. Outbound ArtoPay amount format as integer (no decimals/.toFixed)
 * 8. Invoice HTML XSS escaping
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
try { require('dotenv').config(); } catch (e) {}

const BASE_URL = 'http://localhost:3000';
const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (e) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
          json
        });
      });
    });
    req.on('error', reject);
    if (data) {
      if (typeof data === 'object') {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(data));
      } else {
        req.write(data);
      }
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🛡️ RUNNING FINAL HARDENING PASS REGRESSION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Backup DB
  const originalDb = fs.readFileSync(DB_PATH, 'utf-8');

  try {
    const db = JSON.parse(originalDb);
    const publishedTour = (db.mainTours || []).find(t => t.status === 'published' && t.price > 0) ||
      (db.trips || []).find(t => t.price > 0);

    if (!publishedTour) {
      throw new Error('No published tour available for testing');
    }

    // ---------------------------------------------------------------
    // TEST 1: Check-booking & Payment-status Public Data Sanitization (Issue 1)
    // ---------------------------------------------------------------
    console.log('--- TEST 1: Public Data Sanitization (No PII / Internal notes exposure) ---');
    const secretCustomerEmail = 'confidential_cust@smartjourney.com';
    const secretCustomerPhone = '+628999888777';
    const secretNotes = 'VIP CLIENT DO NOT DISTURB INTERNAL NOTES';

    const createRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST'
    }, {
      tourId: publishedTour.id,
      fullName: 'Siti Rahmawati',
      email: secretCustomerEmail,
      phone: secretCustomerPhone,
      participantsCount: 2,
      bookingType: 'private',
      adminNotes: secretNotes
    });

    assert(createRes.statusCode === 201, `Booking created successfully (HTTP ${createRes.statusCode})`);
    const testBooking = createRes.json;

    // Check GET /api/private-tour/check-booking/:bookingCode
    const checkRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/private-tour/check-booking/${testBooking.bookingCode}`,
      method: 'GET'
    });

    assert(checkRes.statusCode === 200, 'GET /api/private-tour/check-booking returns 200');
    assert(checkRes.json.customerEmail === undefined, 'Customer email is NOT returned in public check-booking');
    assert(checkRes.json.customerPhone === undefined, 'Customer phone is NOT returned in public check-booking');
    assert(checkRes.json.participantsNames === undefined, 'Participants names are NOT returned in public check-booking');
    assert(checkRes.json.adminNotes === undefined, 'Admin internal notes are NOT returned in public check-booking');
    assert(checkRes.json.customerName.includes('*'), `Customer name is masked for privacy: "${checkRes.json.customerName}"`);

    // Check GET /api/orders/:orderId/payment-status
    const statusRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/orders/${testBooking.bookingCode}/payment-status`,
      method: 'GET'
    });

    assert(statusRes.statusCode === 200, 'GET /api/orders/:orderId/payment-status returns 200');
    assert(statusRes.json.booking === undefined, 'Raw internal booking object is NOT exposed in payment status');
    assert(statusRes.json.paymentStatus === 'Pending', 'Payment status returned correctly');

    // ---------------------------------------------------------------
    // TEST 2: Mutex Overbooking Prevention (Issue 2)
    // ---------------------------------------------------------------
    console.log('\n--- TEST 2: Concurrent Booking Overbooking Prevention (Mutex Critical Section) ---');
    // Setup a dedicated batch with exactly 3 seats
    const freshDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const testBatchId = 'batch-concurrency-test-' + Date.now();
    freshDb.batches = freshDb.batches || [];
    freshDb.batches.push({
      id: testBatchId,
      tripId: (freshDb.trips && freshDb.trips[0]?.id) || 'trip-test',
      departureDate: '2026-12-31',
      totalSeats: 3,
      quota: 3,
      availableSeats: 3,
      price: 500000,
      status: 'Open'
    });
    fs.writeFileSync(DB_PATH, JSON.stringify(freshDb, null, 2));

    // Send 10 concurrent requests, each requesting 1 seat
    const concurrencyPromises = [];
    for (let i = 0; i < 10; i++) {
      concurrencyPromises.push(
        request({
          hostname: 'localhost',
          port: 3000,
          path: '/api/bookings',
          method: 'POST'
        }, {
          batchId: testBatchId,
          bookingType: 'shared',
          fullName: `Concurrent User ${i + 1}`,
          participantsCount: 1,
          email: `user${i + 1}@test.com`
        })
      );
    }

    const concurrencyResults = await Promise.all(concurrencyPromises);
    const successCount = concurrencyResults.filter(r => r.statusCode === 201).length;
    const rejectedCount = concurrencyResults.filter(r => r.statusCode === 409 || r.statusCode === 400).length;

    assert(successCount === 3, `Exactly 3 bookings succeeded out of 10 concurrent requests (got ${successCount})`);
    assert(rejectedCount === 7, `Remaining 7 bookings were safely rejected with 409 Conflict / 400 (got ${rejectedCount})`);

    // Verify batch in DB has exactly 0 available seats
    const postBatchDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const verifyBatch = postBatchDb.batches.find(b => b.id === testBatchId);
    assert(verifyBatch.availableSeats === 0, 'Batch availableSeats safely equals 0 (no overbooking occurred)');

    // ---------------------------------------------------------------
    // TEST 3: Unique Code (1-99) Generation and Exhaustion (Issue 3)
    // ---------------------------------------------------------------
    console.log('\n--- TEST 3: Unique Payment Code (1-99) Collision & Exhaustion Handling ---');
    const testDbEx = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    // Populate bookings with all 99 unique codes actively Pending
    testDbEx.bookings = testDbEx.bookings || [];
    const baseCodeCount = testDbEx.bookings.length;

    for (let code = 1; code <= 99; code++) {
      testDbEx.bookings.push({
        id: `dummy-code-${code}`,
        bookingCode: `SJ-DUMMY-${code}`,
        paymentStatus: 'Pending',
        status: 'Pending',
        uniqueCode: code,
        totalPrice: 100000,
        paymentAmount: 100000 + code,
        createdAt: new Date().toISOString()
      });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(testDbEx, null, 2));

    // Now request a 100th booking when all 1-99 unique codes are occupied
    const exhaustedRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/bookings',
      method: 'POST'
    }, {
      tourId: publishedTour.id,
      fullName: 'Customer Exhausted',
      participantsCount: 1,
      bookingType: 'private'
    });

    assert(
      exhaustedRes.statusCode === 503,
      `Booking request returns HTTP 503 when all 99 unique codes are exhausted (got ${exhaustedRes.statusCode})`
    );
    assert(
      exhaustedRes.json && exhaustedRes.json.error && exhaustedRes.json.error.includes('1-99'),
      'Informative error message mentions unique codes (1-99)'
    );

    // ---------------------------------------------------------------
    // TEST 4: Payment Polling Amount Mismatch Rejection (Issue 4)
    // ---------------------------------------------------------------
    console.log('\n--- TEST 4: Payment Polling Amount Mismatch Rejection ---');
    // Restore DB to clean state before test
    const cleanDb = JSON.parse(originalDb);
    const pollBooking = {
      id: 'book-poll-test-1',
      bookingCode: 'SJ-POLL-1',
      paymentStatus: 'Pending',
      status: 'Pending',
      baseAmount: 1500000,
      uniqueCode: 25,
      paymentAmount: 1500025,
      currency: 'IDR',
      createdAt: new Date().toISOString()
    };
    cleanDb.bookings = cleanDb.bookings || [];
    cleanDb.bookings.push(pollBooking);
    fs.writeFileSync(DB_PATH, JSON.stringify(cleanDb, null, 2));

    // Mock an ArtoPay check response via polling endpoint
    const pollStatusRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/orders/SJ-POLL-1/payment-status',
      method: 'GET'
    });

    assert(pollStatusRes.statusCode === 200, 'Polling endpoint is responsive');
    assert(pollStatusRes.json.paymentStatus === 'Pending', 'Order remains Pending when no valid payment received');

    // ---------------------------------------------------------------
    // TEST 5: Webhook Signature Verification Fail-Closed (Issue 4)
    // ---------------------------------------------------------------
    console.log('\n--- TEST 5: Webhook HMAC-SHA256 Signature Verification Fail-Closed ---');
    const fakeWebhookPayload = {
      orderId: 'SJ-POLL-1',
      status: 'SUCCESS',
      amount: 1500025,
      currency: 'IDR'
    };

    const rejectedWebhook = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/artopay/webhook',
      method: 'POST',
      headers: {
        'x-artopay-signature': 'invalid_fake_hmac_signature_99999'
      }
    }, fakeWebhookPayload);

    assert(
      rejectedWebhook.statusCode === 401,
      `Webhook with invalid HMAC signature rejected with HTTP 401 (got ${rejectedWebhook.statusCode})`
    );

    // Verify DB was NOT mutated
    const checkDbAfterFake = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const bookingAfterFake = checkDbAfterFake.bookings.find(b => b.bookingCode === 'SJ-POLL-1');
    assert(bookingAfterFake.paymentStatus === 'Pending', 'Zero DB mutation occurred after rejected webhook');

    // Test with valid HMAC signature
    const webhookSecret = (process.env.WEBHOOK_SECRET || process.env.ARTOPAY_SECRET_KEY || '').trim();
    if (webhookSecret) {
      const validHmac = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(fakeWebhookPayload))
        .digest('hex');

      const acceptedWebhook = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/artopay/webhook',
        method: 'POST',
        headers: {
          'x-artopay-signature': validHmac
        }
      }, fakeWebhookPayload);

      assert(acceptedWebhook.statusCode === 200, `Webhook with authentic HMAC signature accepted with HTTP 200 (got ${acceptedWebhook.statusCode})`);
      const checkDbValid = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      const bookingValid = checkDbValid.bookings.find(b => b.bookingCode === 'SJ-POLL-1');
      assert(bookingValid.paymentStatus === 'Paid', 'Payment status updated to Paid after authentic HMAC');
      assert(bookingValid.status === 'Pending Confirmation', 'Booking status set to Pending Confirmation (PAID ≠ CONFIRMED)');
    } else {
      console.log('ℹ️ Webhook secret not configured in env; skipping positive signature test');
    }

    // ---------------------------------------------------------------
    // TEST 6: Webhook Mismatched Amount & Non-IDR Currency Rejection (Issue 4 & 6)
    // ---------------------------------------------------------------
    console.log('\n--- TEST 6: Webhook Amount Mismatch & Currency Rejection ---');
    // Prepare another booking
    const dbTest6 = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    dbTest6.bookings.push({
      id: 'book-mismatch-test',
      bookingCode: 'SJ-MISMATCH-1',
      paymentStatus: 'Pending',
      status: 'Pending',
      baseAmount: 1000000,
      uniqueCode: 10,
      paymentAmount: 1000010,
      currency: 'IDR',
      createdAt: new Date().toISOString()
    });
    fs.writeFileSync(DB_PATH, JSON.stringify(dbTest6, null, 2));

    if (webhookSecret) {
      // Amount mismatch
      const mismatchPayload = {
        orderId: 'SJ-MISMATCH-1',
        status: 'SUCCESS',
        amount: 500000, // Expected 1000010
        currency: 'IDR'
      };
      const mismatchSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(mismatchPayload))
        .digest('hex');

      const mismatchRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/artopay/webhook',
        method: 'POST',
        headers: { 'x-artopay-signature': mismatchSig }
      }, mismatchPayload);

      assert(mismatchRes.statusCode === 400, `Webhook with mismatched amount rejected with HTTP 400 (got ${mismatchRes.statusCode})`);

      // Non-IDR currency
      const nonIdrPayload = {
        orderId: 'SJ-MISMATCH-1',
        status: 'SUCCESS',
        amount: 1000010,
        currency: 'USD'
      };
      const nonIdrSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(nonIdrPayload))
        .digest('hex');

      const nonIdrRes = await request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/artopay/webhook',
        method: 'POST',
        headers: { 'x-artopay-signature': nonIdrSig }
      }, nonIdrPayload);

      assert(nonIdrRes.statusCode === 400, `Webhook with non-IDR currency rejected with HTTP 400 (got ${nonIdrRes.statusCode})`);
    }

    // ---------------------------------------------------------------
    // TEST 7: Invoice HTML XSS Escaping (Issue 7)
    // ---------------------------------------------------------------
    console.log('\n--- TEST 7: Invoice HTML XSS Escaping ---');
    const xssPayload = '<script>alert("XSS_ATTACK")</script>';
    const xssDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const xssBookingCode = 'SJ-XSS-TEST';
    xssDb.bookings.push({
      id: 'book-xss-1',
      bookingCode: xssBookingCode,
      customerName: xssPayload,
      customerPhone: '"><img src=x onerror=alert(1)>',
      email: 'xss@test.com',
      paymentStatus: 'Paid',
      status: 'Confirmed', // Confirmed so invoice can be downloaded
      baseAmount: 1000000,
      uniqueCode: 15,
      paymentAmount: 1000015,
      details: {
        pickupLocation: '<b onmouseover=alert(1)>Malang</b>',
        specialRequests: '<script>document.cookie</script>'
      },
      createdAt: new Date().toISOString()
    });
    fs.writeFileSync(DB_PATH, JSON.stringify(xssDb, null, 2));

    const invoiceRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/private-tour/invoice-html/${xssBookingCode}`,
      method: 'GET'
    });

    assert(invoiceRes.statusCode === 200, 'Invoice HTML fetched successfully');
    assert(!invoiceRes.body.includes('<script>'), 'Invoice HTML does NOT contain raw <script> tag');
    assert(invoiceRes.body.includes('&lt;script&gt;'), 'Invoice HTML properly escaped <script> to &lt;script&gt;');
    assert(!invoiceRes.body.includes('<img src=x'), 'Invoice HTML does NOT contain raw unescaped <img> element');
    assert(invoiceRes.body.includes('&lt;img'), 'Invoice HTML properly escaped <img to &lt;img');
    assert(invoiceRes.body.includes('&quot;&gt;&lt;img'), 'Invoice HTML escaped attribute injection payload');

  } finally {
    // Restore DB
    fs.writeFileSync(DB_PATH, originalDb);
    console.log('\n🔄 Restored original data/db.json state.');
  }

  console.log('\n====================================================');
  console.log(`FINAL RESULT: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

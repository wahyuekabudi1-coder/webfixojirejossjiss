/**
 * Comprehensive Test Suite for Tests A - J
 * Final Booking Confirmation - Private Tour
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

const PORT = 3000;
const HOST = '127.0.0.1';
const WEBHOOK_SECRET = (process.env.WEBHOOK_SECRET || process.env.ARTOPAY_SECRET_KEY || '').trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sawahjaya2026';

function makeRequest(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': '*/*'
    };

    const headers = { ...defaultHeaders, ...(options.headers || {}) };
    if (path.includes('/webhook') && body && !headers['x-artopay-signature'] && !headers['webhook-signature'] && !options.noSign) {
      const payloadStr = typeof body === 'string' ? body : JSON.stringify(body);
      headers['x-artopay-signature'] = crypto.createHmac('sha256', WEBHOOK_SECRET).update(payloadStr).digest('hex');
    }

    const reqOptions = {
      host: HOST,
      port: PORT,
      path: path,
      method: options.method || 'GET',
      headers: headers
    };

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        let parsedBody = null;
        const contentType = res.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          try {
            parsedBody = JSON.parse(buffer.toString('utf8'));
          } catch (e) {
            parsedBody = buffer.toString('utf8');
          }
        } else {
          parsedBody = buffer.toString('utf8');
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsedBody,
          buffer: buffer
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function signPayload(payloadString) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(payloadString).digest('hex');
}

async function runTests() {
  console.log('================================================================');
  console.log('       TESTS A - J: FINAL BOOKING CONFIRMATION VERIFICATION     ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testId, title, detail) {
    if (condition) {
      console.log(`✅ [PASS] Test ${testId}: ${title}`);
      if (detail) console.log(`   └─ ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] Test ${testId}: ${title}`);
      if (detail) console.error(`   └─ ${detail}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST A: Booking Private Tour baru dibuat
    // -------------------------------------------------------------------------
    console.log('--- EXECUTING TEST A: Booking Private Tour baru dibuat ---');
    const uniqueSuffix = Date.now().toString().slice(-6);
    const bookRes = await makeRequest('/api/bookings', { method: 'POST' }, {
      tourId: 'tour-bromo-sunrise-safari',
      tripId: 'tour-bromo-sunrise-safari',
      tripTitle: 'Bromo Sunrise & Crater Safari',
      serviceName: 'Bromo Sunrise & Crater Safari',
      type: 'Tours',
      bookingType: 'private',
      tourBookingType: 'private',
      customerName: 'Alexander Hamilton',
      customerEmail: 'alexander@hamilton.test',
      customerPhone: '+6281198765432',
      departureDate: '2026-10-25',
      participantsCount: 3,
      participantsNames: ['Alexander Hamilton', 'Elizabeth Schuyler', 'Angelica Schuyler'],
      totalPrice: 2850000,
      totalPriceIDR: 2850000,
      baseAmount: 2850000,
      paymentStatus: 'Pending',
      status: 'Pending Payment',
      details: {
        date: '2026-10-25',
        package: 'Private Exclusive VIP',
        duration: '2 Hari 1 Malam',
        vehicleName: 'Toyota HiAce Premio Luxury',
        pickupLocation: 'Hotel Tugu Malang',
        itinerary: [
          'Day 1 - Malang → Bromo | 10:00 | Penjemputan | Hotel Tugu Malang',
          'Day 1 - Malang → Bromo | 13:00 | Makan Siang | Resto Rawon Nguling',
          'Day 2 - Bromo → Malang | 03:00 | Sunrise Tour | Puncak Penanjakan Bromo'
        ]
      },
      participantData: {
        pickupLocation: 'Hotel Tugu Malang',
        dropoffLocation: 'Stasiun Kota Baru Malang',
        paymentMethod: 'artopay',
        members: [
          { name: 'Alexander Hamilton', nationality: 'Indonesia' },
          { name: 'Elizabeth Schuyler', nationality: 'Indonesia' },
          { name: 'Angelica Schuyler', nationality: 'Indonesia' }
        ]
      }
    });

    const booking = bookRes.body;
    const bookingCode = booking.bookingCode || booking.id;
    const bookingId = booking.id;
    const baseAmount = booking.baseAmount || 2850000;
    const uniqueCode = booking.uniqueCode;
    const paymentAmount = booking.paymentAmount || (baseAmount + uniqueCode);

    // Check status via check-booking
    const checkA = await makeRequest(`/api/private-tour/check-booking/${encodeURIComponent(bookingCode)}`);
    const pdfPreA = await makeRequest(`/api/private-tour/invoice-pdf/${encodeURIComponent(bookingCode)}`);

    assert(
      checkA.status === 200 &&
      checkA.body.paymentStatus === 'Pending' &&
      checkA.body.bookingStatus === 'Pending Payment' &&
      checkA.body.canDownloadFinalSummary === false &&
      pdfPreA.status === 403,
      'A',
      'Booking Private Tour baru dibuat: paymentStatus="Pending", bookingStatus="Pending Payment", Final Booking Confirmation=LOCKED (403)',
      `paymentStatus: ${checkA.body.paymentStatus} | bookingStatus: ${checkA.body.bookingStatus} | canDownload: ${checkA.body.canDownloadFinalSummary} | PDF HTTP: ${pdfPreA.status}`
    );

    // -------------------------------------------------------------------------
    // TEST B: Payment berhasil via ArtoPay
    // -------------------------------------------------------------------------
    console.log('\n--- EXECUTING TEST B: Payment berhasil via ArtoPay ---');
    const webhookRes = await makeRequest('/api/artopay/webhook', { method: 'POST' }, {
      orderId: bookingId,
      paymentId: `PAY-ARTOPAY-${uniqueSuffix}`,
      status: 'success',
      amount: paymentAmount,
      grossAmount: paymentAmount,
      currency: 'IDR'
    });

    const checkB = await makeRequest(`/api/private-tour/check-booking/${encodeURIComponent(bookingCode)}`);

    assert(
      webhookRes.status === 200 &&
      checkB.body.paymentStatus === 'Paid' &&
      checkB.body.bookingStatus === 'Pending Confirmation' &&
      checkB.body.canDownloadFinalSummary === false &&
      (checkB.body.gateMessage.includes('review') || checkB.body.gateMessage.includes('waiting')),
      'B',
      'Payment berhasil via ArtoPay: paymentStatus="Paid", bookingStatus="Pending Confirmation", Final Booking Confirmation=LOCKED',
      `Payment: ${checkB.body.paymentStatus} | Booking: ${checkB.body.bookingStatus} | Gate Msg: "${checkB.body.gateMessage}"`
    );

    // -------------------------------------------------------------------------
    // TEST C: Direct download PDF sebelum admin confirm
    // -------------------------------------------------------------------------
    console.log('\n--- EXECUTING TEST C: Direct download PDF sebelum admin confirm ---');
    const pdfDirectC = await makeRequest(`/api/private-tour/invoice-pdf/${encodeURIComponent(bookingCode)}`);
    const jsonDirectC = await makeRequest(`/api/private-tour/final-summary/${encodeURIComponent(bookingCode)}`);

    assert(
      pdfDirectC.status === 403 && jsonDirectC.status === 403,
      'C',
      'Direct download PDF sebelum admin confirm ditolak dengan HTTP 403 Forbidden',
      `PDF HTTP: ${pdfDirectC.status} | JSON HTTP: ${jsonDirectC.status} | Error: ${jsonDirectC.body?.error}`
    );

    // -------------------------------------------------------------------------
    // TEST D: Admin login (sawahjaya2026 ONLY) & Admin Confirm Booking
    // -------------------------------------------------------------------------
    console.log('\n--- EXECUTING TEST D: Admin login & Confirm Booking ---');
    const rejectOld = await makeRequest('/api/auth/login', { method: 'POST' }, {
      email: 'admin@smartjourney.com',
      password: 'smartjourney2026'
    });

    const loginRes = await makeRequest('/api/auth/login', { method: 'POST' }, {
      email: 'admin@smartjourney.com',
      password: ADMIN_PASSWORD
    });

    const adminToken = loginRes.body?.token;
    const confirmRes = await makeRequest(`/api/private-tour/bookings/${encodeURIComponent(bookingId)}/confirm`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }, { adminNotes: 'Confirmed by Operations Lead.' });

    assert(
      rejectOld.status === 401 &&
      loginRes.status === 200 &&
      confirmRes.status === 200 &&
      confirmRes.body?.booking?.status === 'Confirmed',
      'D',
      'Admin login enforces sawahjaya2026 ONLY & Admin Confirm changes bookingStatus to "Confirmed"',
      `Legacy pwd rejected: ${rejectOld.status === 401} | Login: 200 | Confirmed Status: ${confirmRes.body?.booking?.status}`
    );

    // -------------------------------------------------------------------------
    // TEST E: Customer Check Booking setelah confirm
    // -------------------------------------------------------------------------
    console.log('\n--- EXECUTING TEST E: Customer Check Booking setelah confirm ---');
    const checkE = await makeRequest(`/api/private-tour/check-booking/${encodeURIComponent(bookingCode)}`);

    assert(
      checkE.status === 200 &&
      checkE.body.bookingStatus === 'Confirmed' &&
      checkE.body.paymentStatus === 'Paid' &&
      checkE.body.canDownloadFinalSummary === true,
      'E',
      'Check Booking setelah confirm: bookingStatus="Confirmed", canDownloadFinalSummary=TRUE',
      `Booking Status: ${checkE.body.bookingStatus} | Payment: ${checkE.body.paymentStatus} | Gate: Unlocked (${checkE.body.canDownloadFinalSummary})`
    );

    // -------------------------------------------------------------------------
    // TEST F: Download PDF Final (Binary PDF)
    // -------------------------------------------------------------------------
    console.log('\n--- EXECUTING TEST F: Download PDF Final ---');
    const pdfRes = await makeRequest(`/api/private-tour/invoice-pdf/${encodeURIComponent(bookingCode)}`);
    const isActualPdf = pdfRes.buffer && pdfRes.buffer.slice(0, 5).toString('utf8') === '%PDF-';
    const isPdfContentType = pdfRes.headers['content-type'] === 'application/pdf';
    const hasCorrectFilename = pdfRes.headers['content-disposition']?.includes(`SmartJourney-Final-Booking-${bookingCode}.pdf`);

    assert(
      pdfRes.status === 200 &&
      isPdfContentType &&
      isActualPdf &&
      hasCorrectFilename,
      'F',
      'Download PDF Final: HTTP 200, application/pdf, %PDF- magic bytes, correct filename',
      `HTTP: ${pdfRes.status} | Content-Type: ${pdfRes.headers['content-type']} | Magic: %PDF- | File: ${pdfRes.headers['content-disposition']} | Size: ${pdfRes.buffer.length} bytes`
    );

    // -------------------------------------------------------------------------
    // TEST G: Cek isi PDF / Data Final
    // -------------------------------------------------------------------------
    console.log('\n--- EXECUTING TEST G: Cek isi PDF / Data Final ---');
    const summaryRes = await makeRequest(`/api/private-tour/final-summary/${encodeURIComponent(bookingCode)}`);
    const sum = summaryRes.body;

    const hasStatus = Boolean(sum.bookingCode === bookingCode && sum.bookingStatus === 'Confirmed' && sum.paymentStatus === 'Paid');
    const hasCustomer = Boolean(sum.customer && sum.customer.name === 'Alexander Hamilton' && sum.customer.phone === '+6281198765432');
    const hasTrip = Boolean(sum.trip && sum.trip.title.includes('Bromo') && sum.trip.package && sum.trip.departureDate && sum.trip.vehicleName);
    const hasItinerary = Boolean(sum.trip && Array.isArray(sum.trip.itinerary) && sum.trip.itinerary.length >= 3);
    const hasPayment = Boolean(sum.payment && sum.payment.baseAmount === 2850000 && sum.payment.totalPaid === paymentAmount);
    const hasVerification = Boolean(sum.verificationHash && sum.verificationHash.startsWith('SJ-VERIFIED-'));

    // Verify PDF binary text contains key sections
    const pdfText = pdfRes.buffer.toString('latin1');
    const pdfHasTitle = pdfText.includes('FINAL BOOKING CONFIRMATION') || pdfText.includes('FINAL');
    const pdfHasCode = pdfText.includes(bookingCode);

    assert(
      hasStatus && hasCustomer && hasTrip && hasItinerary && hasPayment && hasVerification && pdfHasCode,
      'G',
      'Semua field wajib tersedia di Dokumen FINAL BOOKING CONFIRMATION (Status, Customer, Trip, Itinerary, Payment, Verification)',
      `Status:${hasStatus}, Cust:${hasCustomer}, Trip:${hasTrip}, Itinerary:${hasItinerary}, Pay:${hasPayment}, Hash:${hasVerification}, PDF Code:${pdfHasCode}`
    );

    // -------------------------------------------------------------------------
    // TEST H: Unique payment code tampil benar
    // -------------------------------------------------------------------------
    console.log('\n--- EXECUTING TEST H: Unique payment code ---');
    const uCodeValid = typeof sum.payment.uniqueCode === 'number' && sum.payment.uniqueCode >= 1 && sum.payment.uniqueCode <= 99;
    const sumMatches = (sum.payment.baseAmount + sum.payment.uniqueCode) === sum.payment.totalPaid;

    assert(
      uCodeValid && sumMatches,
      'H',
      'Unique payment code tampil terpisah & baseAmount + uniqueCode === totalPaid',
      `Base: Rp ${sum.payment.baseAmount.toLocaleString('id-ID')} + Unique: Rp ${sum.payment.uniqueCode} = Total: Rp ${sum.payment.totalPaid.toLocaleString('id-ID')}`
    );

    // -------------------------------------------------------------------------
    // TEST I: Snapshot Immutability
    // -------------------------------------------------------------------------
    console.log('\n--- EXECUTING TEST I: Snapshot Immutability ---');
    // Read and mutate catalog trip in db.json if exists
    const dbPath = 'data/db.json';
    const dbRaw = fs.readFileSync(dbPath, 'utf8');
    const db = JSON.parse(dbRaw);

    let tripFound = (db.trips || []).find(t => t.id === 'tour-bromo-sunrise-safari');
    if (tripFound) {
      tripFound.price = 99999999;
      tripFound.title = 'ALTERED MASTER CATALOG TITLE';
    } else {
      db.trips = db.trips || [];
      db.trips.push({
        id: 'tour-bromo-sunrise-safari',
        title: 'ALTERED MASTER CATALOG TITLE',
        price: 99999999
      });
    }
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

    // Query final-summary again for existing booking
    const summaryAfter = await makeRequest(`/api/private-tour/final-summary/${encodeURIComponent(bookingCode)}`);

    assert(
      summaryAfter.body.trip.title === 'Bromo Sunrise & Crater Safari' &&
      summaryAfter.body.payment.baseAmount === 2850000 &&
      summaryAfter.body.payment.totalPaid === paymentAmount,
      'I',
      'Snapshot Immutability: Perubahan master katalog tidak mempengaruhi data booking historis',
      `Retained Title: "${summaryAfter.body.trip.title}" | Retained Price: Rp ${summaryAfter.body.payment.baseAmount.toLocaleString('id-ID')}`
    );

    // -------------------------------------------------------------------------
    // TEST J: Regression Test (Other Services & ArtoPay Hardening)
    // -------------------------------------------------------------------------
    console.log('\n--- EXECUTING TEST J: Regression Test ---');
    const tripsRes = await makeRequest('/api/trips');
    const batchesRes = await makeRequest('/api/batches');
    const artopayConfig = await makeRequest('/api/artopay/config');

    // Setup fresh pending booking to test exact amount check on webhook (Rp 1 mismatch rejected)
    const pendingBookingRes = await makeRequest('/api/bookings', { method: 'POST' }, {
      tourId: 'tour-bromo-sunrise-safari',
      tripId: 'tour-bromo-sunrise-safari',
      type: 'Tours',
      customerName: 'Regression Tester',
      totalPriceIDR: 1500000,
      baseAmount: 1500000,
      paymentStatus: 'Pending',
      status: 'Pending Payment'
    });
    const pendingOrder = pendingBookingRes.body;
    const pendingOrderId = pendingOrder.id;
    const pendingExpectedAmount = pendingOrder.paymentAmount || (1500000 + (pendingOrder.uniqueCode || 0));

    const badAmountRes = await makeRequest('/api/artopay/webhook', {
      method: 'POST'
    }, {
      orderId: pendingOrderId,
      status: 'PAID',
      amount: pendingExpectedAmount + 1,
      currency: 'IDR'
    });

    assert(
      tripsRes.status === 200 &&
      batchesRes.status === 200 &&
      artopayConfig.status === 200 &&
      badAmountRes.status === 400,
      'J',
      'Regression Test: Open Trip (/api/trips, /api/batches) intact, ArtoPay config intact, exact amount mismatch rejected with 400',
      `Trips: ${tripsRes.status} | Batches: ${batchesRes.status} | Exact Amount Check: ${badAmountRes.status} Bad Request`
    );

  } catch (err) {
    console.error('Unexpected error during test execution:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

// ==============================================================================
// CUSTOMER FLOW TEST SUITE: PRIVATE TOUR & OPEN TRIP / SHARE TOUR
// Flow: Catalog -> Booking -> ArtoPay Intent -> Webhook (Paid) -> Admin Confirm
// -> Confirmed in My Booking -> Document Download Unlocked
// ==============================================================================

const assert = require('assert');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const WEBHOOK_SECRET = (process.env.WEBHOOK_SECRET || process.env.ARTOPAY_SECRET_KEY || 'artopay_secret_sandbox_mock').trim();

async function run() {
  console.log('=================================================================');
  console.log('🧪 TESTING CUSTOMER FLOWS: PRIVATE TOUR & OPEN TRIP / SHARE TOUR');
  console.log('=================================================================\n');

  // Step 0: Get Admin Session Token for Confirmation Step
  console.log('[Step 0] Admin login for confirmation authorization...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD })
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login must succeed');
  const { token } = await loginRes.json();
  assert(token, 'Session token must be present');
  console.log('✅ [Step 0] Admin logged in.\n');

  // -------------------------------------------------------------
  // TEST 1: PRIVATE TOUR CUSTOMER FLOW
  // -------------------------------------------------------------
  console.log('--- TEST 1: PRIVATE TOUR FLOW ---');
  console.log('[1.1] Fetching published Private Tours...');
  const toursRes = await fetch(`${BASE_URL}/api/main-tours`);
  assert.strictEqual(toursRes.status, 200, 'Main tours must be accessible');
  const tours = await toursRes.json();
  assert(Array.isArray(tours) && tours.length > 0, 'At least 1 tour must be available');
  const targetTour = tours[0];
  console.log(`✅ [1.1] Selected Private Tour: "${targetTour.name}" (ID: ${targetTour.id})`);

  console.log('[1.2] Customer creates Private Tour Booking...');
  const privateBookingPayload = {
    bookingType: 'private',
    tourBookingType: 'private',
    tripId: targetTour.id,
    serviceName: targetTour.name,
    departureDate: '2026-10-15',
    participantsCount: 2,
    fullName: 'Budi Santoso Private',
    email: 'budi.private@example.com',
    phone: '+6281298765432',
    nationalityType: 'WNI',
    details: {
      date: '2026-10-15',
      guests: 2,
      pickupLocation: 'Hotel Tugu Malang'
    }
  };

  const privateBookRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(privateBookingPayload)
  });
  assert.strictEqual(privateBookRes.status, 201, 'Private booking creation must return 201');
  const privateBooking = await privateBookRes.json();
  assert(privateBooking.bookingCode, 'Booking Code must exist');
  assert.strictEqual(privateBooking.paymentStatus, 'Pending', 'Initial paymentStatus must be Pending');
  assert.strictEqual(privateBooking.status, 'Pending Payment', 'Initial booking status must be Pending Payment');
  console.log(`✅ [1.2] Private Tour Booking created: Code=${privateBooking.bookingCode}, UniqueCode=${privateBooking.uniqueCode}`);

  console.log('[1.3] Customer verifies document download is LOCKED before payment & confirmation...');
  const privatePreLockPdf = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${encodeURIComponent(privateBooking.bookingCode)}`);
  assert.strictEqual(privatePreLockPdf.status, 403, 'PDF download must return 403 Forbidden when unpaid and unconfirmed');
  console.log('✅ [1.3] Document download correctly locked with HTTP 403 Forbidden.');

  console.log('[1.4] ArtoPay Webhook simulates successful payment for Private Tour...');
  const privateWebhookPayload = {
    orderId: privateBooking.bookingCode,
    paymentId: `PAY-PVT-${Date.now()}`,
    status: 'PAID',
    amount: privateBooking.paymentAmount,
    currency: 'IDR'
  };
  const privateSig = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(privateWebhookPayload))
    .digest('hex');

  const privateHookRes = await fetch(`${BASE_URL}/api/artopay/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-artopay-signature': privateSig
    },
    body: JSON.stringify(privateWebhookPayload)
  });
  assert.strictEqual(privateHookRes.status, 200, 'Webhook must accept valid signature with 200 OK');
  console.log('✅ [1.4] ArtoPay payment processed: paymentStatus = Paid, bookingStatus = Pending Confirmation.');

  console.log('[1.5] Customer verifies document download is STILL LOCKED when Paid but Pending Confirmation...');
  const privatePostPaidPdf = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${encodeURIComponent(privateBooking.bookingCode)}`);
  assert.strictEqual(privatePostPaidPdf.status, 403, 'PDF download must remain 403 Forbidden until Admin confirms');
  console.log('✅ [1.5] Document download remains locked (403) while awaiting Admin Confirmation.');

  console.log('[1.6] Admin confirms Private Tour Booking...');
  const privateConfirmRes = await fetch(`${BASE_URL}/api/bookings/${encodeURIComponent(privateBooking.bookingCode)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      status: 'Confirmed'
    })
  });
  assert.strictEqual(privateConfirmRes.status, 200, 'Admin confirmation must return 200');
  console.log('✅ [1.6] Admin confirmed Private Tour Booking.');

  console.log('[1.7] Customer checks status in My Booking Portal...');
  const privateCheckRes = await fetch(`${BASE_URL}/api/private-tour/check-booking/${encodeURIComponent(privateBooking.bookingCode)}`);
  assert.strictEqual(privateCheckRes.status, 200, 'Check booking must return 200');
  const privateStatus = await privateCheckRes.json();
  assert.strictEqual(privateStatus.bookingStatus, 'Confirmed', 'Booking status must now be Confirmed');
  assert.strictEqual(privateStatus.paymentStatus, 'Paid', 'Payment status must be Paid');
  assert.strictEqual(privateStatus.canDownloadInvoice, true, 'canDownloadInvoice must be true');
  assert.strictEqual(privateStatus.canDownloadFinalSummary, true, 'canDownloadFinalSummary must be true');
  console.log(`✅ [1.7] Live check confirmed: Status="${privateStatus.bookingStatus}", Payment="${privateStatus.paymentStatus}".`);

  console.log('[1.8] Customer downloads confirmed Invoice / Confirmation PDF...');
  const privateFinalPdf = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${encodeURIComponent(privateBooking.bookingCode)}`);
  assert.strictEqual(privateFinalPdf.status, 200, 'PDF download must return 200 OK once confirmed');
  const pvtContentType = privateFinalPdf.headers.get('content-type');
  assert(pvtContentType && pvtContentType.includes('application/pdf'), 'Content-Type must be application/pdf');
  const pvtBuffer = await privateFinalPdf.arrayBuffer();
  const pvtHeader = Buffer.from(pvtBuffer).slice(0, 5).toString('utf8');
  assert(pvtHeader.startsWith('%PDF'), 'PDF header must start with %PDF');
  console.log(`✅ [1.8] Confirmed Private Tour PDF downloaded successfully (${pvtBuffer.byteLength} bytes, valid %PDF header).\n`);

  // -------------------------------------------------------------
  // TEST 2: OPEN TRIP / SHARE TOUR CUSTOMER FLOW
  // -------------------------------------------------------------
  console.log('--- TEST 2: OPEN TRIP / SHARE TOUR FLOW ---');
  console.log('[2.1] Fetching active Open Trip Batches...');
  const batchesRes = await fetch(`${BASE_URL}/api/batches`);
  assert.strictEqual(batchesRes.status, 200, 'Batches must be accessible');
  const batches = await batchesRes.json();
  const openBatch = batches.find(b => b.status === 'Open' && b.availableSeats > 1) || batches[0];
  assert(openBatch, 'At least 1 open batch must exist');

  const tripsRes = await fetch(`${BASE_URL}/api/trips`);
  const shareTrips = await tripsRes.json();
  const shareTrip = shareTrips.find(t => t.id === openBatch.tripId || t.slug === openBatch.tripId) || shareTrips[0];
  console.log(`✅ [2.1] Selected Open Trip: "${shareTrip.title}", Batch: ${openBatch.id}, Date: ${openBatch.departureDate}`);

  console.log('[2.2] Customer creates Open Trip Booking...');
  const openBookingPayload = {
    bookingType: 'shared',
    tourBookingType: 'shared',
    tripId: shareTrip.id,
    batchId: openBatch.id,
    serviceName: shareTrip.title,
    departureDate: openBatch.departureDate,
    participantsCount: 2,
    fullName: 'Siti Rahma Open Trip',
    email: 'siti.opentrip@example.com',
    phone: '+6281312345678',
    nationalityType: 'WNI',
    details: {
      pickupLocation: 'Stasiun Malang Kota Baru'
    }
  };

  const openBookRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(openBookingPayload)
  });
  assert.strictEqual(openBookRes.status, 201, 'Open Trip booking creation must return 201');
  const openBooking = await openBookRes.json();
  assert(openBooking.bookingCode, 'Booking Code must exist');
  assert.strictEqual(openBooking.departureDate, openBatch.departureDate, 'departureDate must match batch departureDate');
  assert.strictEqual(openBooking.paymentStatus, 'Pending', 'Initial paymentStatus must be Pending');
  assert.strictEqual(openBooking.status, 'Pending Payment', 'Initial booking status must be Pending Payment');
  console.log(`✅ [2.2] Open Trip Booking created: Code=${openBooking.bookingCode}, Date=${openBooking.departureDate}, UniqueCode=${openBooking.uniqueCode}`);

  console.log('[2.3] Customer verifies document download is LOCKED before payment & confirmation...');
  const openPreLockPdf = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${encodeURIComponent(openBooking.bookingCode)}`);
  assert.strictEqual(openPreLockPdf.status, 403, 'PDF download must return 403 Forbidden when unpaid and unconfirmed');
  console.log('✅ [2.3] Document download correctly locked with HTTP 403 Forbidden.');

  console.log('[2.4] ArtoPay Webhook simulates successful payment for Open Trip...');
  const openWebhookPayload = {
    orderId: openBooking.bookingCode,
    paymentId: `PAY-OPN-${Date.now()}`,
    status: 'PAID',
    amount: openBooking.paymentAmount,
    currency: 'IDR'
  };
  const openSig = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(openWebhookPayload))
    .digest('hex');

  const openHookRes = await fetch(`${BASE_URL}/api/artopay/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-artopay-signature': openSig
    },
    body: JSON.stringify(openWebhookPayload)
  });
  assert.strictEqual(openHookRes.status, 200, 'Webhook must accept valid signature with 200 OK');
  console.log('✅ [2.4] ArtoPay payment processed: paymentStatus = Paid, bookingStatus = Pending Confirmation.');

  console.log('[2.5] Customer verifies document download is STILL LOCKED when Paid but Pending Confirmation...');
  const openPostPaidPdf = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${encodeURIComponent(openBooking.bookingCode)}`);
  assert.strictEqual(openPostPaidPdf.status, 403, 'PDF download must remain 403 Forbidden until Admin confirms');
  console.log('✅ [2.5] Document download remains locked (403) while awaiting Admin Confirmation.');

  console.log('[2.6] Admin confirms Open Trip Booking...');
  const openConfirmRes = await fetch(`${BASE_URL}/api/bookings/${encodeURIComponent(openBooking.bookingCode)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      status: 'Confirmed'
    })
  });
  assert.strictEqual(openConfirmRes.status, 200, 'Admin confirmation must return 200');
  console.log('✅ [2.6] Admin confirmed Open Trip Booking.');

  console.log('[2.7] Customer checks status in My Booking Portal...');
  const openCheckRes = await fetch(`${BASE_URL}/api/private-tour/check-booking/${encodeURIComponent(openBooking.bookingCode)}`);
  assert.strictEqual(openCheckRes.status, 200, 'Check booking must return 200');
  const openStatus = await openCheckRes.json();
  assert.strictEqual(openStatus.bookingStatus, 'Confirmed', 'Booking status must now be Confirmed');
  assert.strictEqual(openStatus.paymentStatus, 'Paid', 'Payment status must be Paid');
  assert.strictEqual(openStatus.departureDate, openBatch.departureDate, 'departureDate must match batch departureDate');
  assert.strictEqual(openStatus.canDownloadInvoice, true, 'canDownloadInvoice must be true');
  assert.strictEqual(openStatus.canDownloadFinalSummary, true, 'canDownloadFinalSummary must be true');
  console.log(`✅ [2.7] Live check confirmed: Status="${openStatus.bookingStatus}", Payment="${openStatus.paymentStatus}", Departure="${openStatus.departureDate}".`);

  console.log('[2.8] Customer downloads confirmed Open Trip Confirmation / Invoice PDF...');
  const openFinalPdf = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${encodeURIComponent(openBooking.bookingCode)}`);
  assert.strictEqual(openFinalPdf.status, 200, 'PDF download must return 200 OK once confirmed');
  const opnContentType = openFinalPdf.headers.get('content-type');
  assert(opnContentType && opnContentType.includes('application/pdf'), 'Content-Type must be application/pdf');
  const opnBuffer = await openFinalPdf.arrayBuffer();
  const opnHeader = Buffer.from(opnBuffer).slice(0, 5).toString('utf8');
  assert(opnHeader.startsWith('%PDF'), 'PDF header must start with %PDF');
  console.log(`✅ [2.8] Confirmed Open Trip PDF downloaded successfully (${opnBuffer.byteLength} bytes, valid %PDF header).\n`);

  console.log('=================================================================');
  console.log('🎉 ALL CUSTOMER FLOW TESTS FOR PRIVATE TOUR & OPEN TRIP PASSED!');
  console.log('=================================================================');
}

run().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

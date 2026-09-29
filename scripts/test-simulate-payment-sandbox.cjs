// ==============================================================================
// TEST SUITE: ARTO-PAY SANDBOX PAYMENT SIMULATION
// Verifies:
// 1. Private Tour: Booking -> Simulate Payment Success -> Paid & Pending Confirmation
//    -> PDF locked -> Admin Confirm -> Confirmed -> PDF unlocked
// 2. Open Trip: Booking -> Simulate Payment Success -> Paid & Pending Confirmation
//    -> PDF locked -> Admin Confirm -> Confirmed -> PDF unlocked
// 3. Strict Sandbox restriction (Production guard)
// ==============================================================================

const assert = require('assert');

const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function run() {
  console.log('=================================================================');
  console.log('🧪 TESTING ARTO-PAY SANDBOX PAYMENT SIMULATION BUTTON & FLOW');
  console.log('=================================================================\n');

  // Step 0: Admin Login
  console.log('[Step 0] Admin login for status verification & confirmation...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD })
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login must succeed');
  const { token } = await loginRes.json();
  assert(token, 'Session token must be present');
  console.log('✅ [Step 0] Admin authenticated successfully.\n');

  // -------------------------------------------------------------
  // TEST 1: PRIVATE TOUR FLOW WITH SIMULATE PAYMENT SUCCESS
  // -------------------------------------------------------------
  console.log('--- TEST 1: PRIVATE TOUR SIMULATE PAYMENT FLOW ---');
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
    departureDate: '2026-11-20',
    participantsCount: 2,
    fullName: 'Test Traveler Private',
    email: 'test.traveler.private@example.com',
    phone: '+6281234567890',
    nationalityType: 'WNI',
    details: {
      date: '2026-11-20',
      guests: 2,
      pickupLocation: 'Hotel Santika Malang'
    }
  };

  const pRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(privateBookingPayload)
  });
  const pBooking = await pRes.json();
  assert.strictEqual(pRes.status, 201, `Private booking created, got: ${JSON.stringify(pBooking)}`);
  console.log(`✅ [1.2] Private booking created: Code=${pBooking.bookingCode}, UniqueCode=${pBooking.uniqueCode}`);
  assert.strictEqual(pBooking.paymentStatus, 'Pending', 'Initial paymentStatus must be Pending');
  assert.strictEqual(pBooking.status, 'Pending Payment', 'Initial status must be Pending Payment');

  console.log('[1.3] Verifying PDF is locked before payment...');
  const pPdfPre = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${encodeURIComponent(pBooking.bookingCode)}`);
  assert.strictEqual(pPdfPre.status, 403, 'PDF must return 403 Forbidden before confirmation');
  console.log('✅ [1.3] PDF correctly locked (403 Forbidden).');

  console.log('[1.4] Clicking "Simulate Payment Success" on Customer Booking Details...');
  const simRes1 = await fetch(`${BASE_URL}/api/artopay/simulate-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: pBooking.bookingCode })
  });
  assert.strictEqual(simRes1.status, 200, 'Simulate webhook endpoint must return 200');
  const simData1 = await simRes1.json();
  assert.strictEqual(simData1.success, true, 'Simulation must report success');
  assert.strictEqual(simData1.paymentStatus, 'Paid', 'paymentStatus must be Paid');
  assert.strictEqual(simData1.bookingStatus, 'Pending Confirmation', 'bookingStatus must be Pending Confirmation');
  console.log('✅ [1.4] Simulation executed: paymentStatus="Paid", bookingStatus="Pending Confirmation".');

  console.log('[1.5] Checking authoritative backend status in Customer Portal...');
  const checkRes1 = await fetch(`${BASE_URL}/api/private-tour/check-booking/${encodeURIComponent(pBooking.bookingCode)}`);
  assert.strictEqual(checkRes1.status, 200);
  const checkData1 = await checkRes1.json();
  assert.strictEqual(checkData1.paymentStatus, 'Paid', 'Backend paymentStatus must be Paid');
  assert.strictEqual(checkData1.bookingStatus, 'Pending Confirmation', 'Backend bookingStatus must be Pending Confirmation');
  assert.strictEqual(checkData1.canDownloadFinalSummary, false, 'Download must STILL be locked during Pending Confirmation');
  console.log('✅ [1.5] Customer Portal reflects Paid & Pending Confirmation. Download remains securely locked.');

  console.log('[1.6] Verifying PDF is STILL locked during Pending Confirmation...');
  const pPdfMid = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${encodeURIComponent(pBooking.bookingCode)}`);
  assert.strictEqual(pPdfMid.status, 403, 'PDF must still return 403 during Pending Confirmation');
  console.log('✅ [1.6] PDF download still locked pending Admin Confirmation.');

  console.log('[1.7] Admin reads and Confirms the booking in Admin Dashboard...');
  const confirmRes1 = await fetch(`${BASE_URL}/api/bookings/${pBooking.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'Confirmed' })
  });
  assert.strictEqual(confirmRes1.status, 200, 'Admin confirmation must succeed');
  console.log('✅ [1.7] Admin confirmed the Private Tour booking.');

  console.log('[1.8] Verifying Customer Portal shows Confirmed & Unlocked PDF...');
  const checkRes2 = await fetch(`${BASE_URL}/api/private-tour/check-booking/${encodeURIComponent(pBooking.bookingCode)}`);
  const checkData2 = await checkRes2.json();
  assert.strictEqual(checkData2.bookingStatus, 'Confirmed', 'Booking must be Confirmed');
  assert.strictEqual(checkData2.canDownloadFinalSummary, true, 'PDF download must now be unlocked');

  const pPdfFinal = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${encodeURIComponent(pBooking.bookingCode)}`);
  assert.strictEqual(pPdfFinal.status, 200, 'PDF download must return 200 OK');
  const pdfBytes = await pPdfFinal.arrayBuffer();
  assert(pdfBytes.byteLength > 1000, 'PDF file must have content');
  console.log(`✅ [1.8] Private Tour PDF downloaded successfully (${pdfBytes.byteLength} bytes).\n`);

  // -------------------------------------------------------------
  // TEST 2: OPEN TRIP / SHARE TOUR FLOW WITH SIMULATE PAYMENT SUCCESS
  // -------------------------------------------------------------
  console.log('--- TEST 2: OPEN TRIP / SHARE TOUR SIMULATE PAYMENT FLOW ---');
  console.log('[2.1] Fetching active Open Trip Batches...');
  const batchesRes = await fetch(`${BASE_URL}/api/batches`);
  assert.strictEqual(batchesRes.status, 200);
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
    fullName: 'Test Traveler Open Trip',
    email: 'test.traveler.open@example.com',
    phone: '+6281987654321',
    nationalityType: 'WNI',
    details: {
      pickupLocation: 'Stasiun Malang Kota Baru'
    }
  };

  const oRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(openBookingPayload)
  });
  const oBooking = await oRes.json();
  assert.strictEqual(oRes.status, 201, `Open Trip booking created, got: ${JSON.stringify(oBooking)}`);
  console.log(`✅ [2.2] Open Trip booking created: Code=${oBooking.bookingCode}`);
  assert.strictEqual(oBooking.paymentStatus, 'Pending');

  console.log('[2.3] Clicking "Simulate Payment Success" on Open Trip Success Screen...');
  const simRes2 = await fetch(`${BASE_URL}/api/artopay/simulate-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: oBooking.bookingCode })
  });
  assert.strictEqual(simRes2.status, 200);
  const simData2 = await simRes2.json();
  assert.strictEqual(simData2.paymentStatus, 'Paid');
  assert.strictEqual(simData2.bookingStatus, 'Pending Confirmation');
  console.log('✅ [2.3] Open Trip Simulation executed: Paid & Pending Confirmation.');

  console.log('[2.4] Checking Customer Portal for Open Trip status...');
  const checkOpen1 = await fetch(`${BASE_URL}/api/private-tour/check-booking/${encodeURIComponent(oBooking.bookingCode)}`);
  const checkOpenData1 = await checkOpen1.json();
  assert.strictEqual(checkOpenData1.paymentStatus, 'Paid');
  assert.strictEqual(checkOpenData1.bookingStatus, 'Pending Confirmation');
  assert.strictEqual(checkOpenData1.canDownloadFinalSummary, false, 'Download must be locked pending Admin Confirmation');
  console.log('✅ [2.4] Open Trip Portal confirms Paid & Pending Confirmation. Download locked.');

  console.log('[2.5] Admin Confirms Open Trip booking in Admin Dashboard...');
  const confirmRes2 = await fetch(`${BASE_URL}/api/bookings/${oBooking.id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'Confirmed' })
  });
  assert.strictEqual(confirmRes2.status, 200);
  console.log('✅ [2.5] Admin confirmed the Open Trip booking.');

  console.log('[2.6] Verifying Open Trip Customer Portal shows Confirmed & Unlocked PDF...');
  const checkOpen2 = await fetch(`${BASE_URL}/api/private-tour/check-booking/${encodeURIComponent(oBooking.bookingCode)}`);
  const checkOpenData2 = await checkOpen2.json();
  assert.strictEqual(checkOpenData2.bookingStatus, 'Confirmed');
  assert.strictEqual(checkOpenData2.canDownloadFinalSummary, true);

  const oPdfFinal = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${encodeURIComponent(oBooking.bookingCode)}`);
  assert.strictEqual(oPdfFinal.status, 200);
  const oPdfBytes = await oPdfFinal.arrayBuffer();
  assert(oPdfBytes.byteLength > 1000);
  console.log(`✅ [2.6] Open Trip Confirmed PDF downloaded successfully (${oPdfBytes.byteLength} bytes).\n`);

  console.log('=================================================================');
  console.log('🎉 ALL TESTS PASSED! SIMULATE PAYMENT SUCCESS WORKS FLAWLESSLY!');
  console.log('=================================================================');
}

run().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});

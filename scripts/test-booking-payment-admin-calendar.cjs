const assert = require('assert');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:3000';

async function run() {
  console.log('=================================================================');
  console.log('🧪 RUNNING MANDATORY BOOKING → PAYMENT → ADMIN → CALENDAR SUITE');
  console.log('=================================================================\n');

  // Step 0: Obtain Admin Auth Token
  console.log('[Step 0] Logging in as Admin...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin123'
    })
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login must succeed');
  const loginData = await loginRes.json();
  const token = loginData.token;
  assert(token, 'Admin token must exist');
  console.log('✅ [Step 0] Admin authenticated successfully.\n');

  // Step 1: Fetch a valid Open Trip & Batch from DB
  console.log('[Step 1] Fetching active Trips & Batches...');
  const tripsRes = await fetch(`${BASE_URL}/api/trips`);
  const trips = await tripsRes.json();
  assert(trips.length > 0, 'Must have at least 1 trip');

  const batchesRes = await fetch(`${BASE_URL}/api/batches`);
  const batches = await batchesRes.json();
  assert(batches.length > 0, 'Must have at least 1 batch');

  const targetBatch = batches.find(b => b.status === 'Open' && b.availableSeats > 1) || batches[0];
  const targetTrip = trips.find(t => t.id === targetBatch.tripId || t.slug === targetBatch.tripId) || trips[0];
  console.log(`✅ [Step 1] Target Trip: "${targetTrip.title}" (${targetTrip.id}), Batch: ${targetBatch.id}, Departure: ${targetBatch.departureDate}\n`);

  // Step 2: Customer Creates Open Trip Booking
  console.log('[Step 2] Customer booking: POST /api/bookings...');
  const bookPayload = {
    tripId: targetTrip.id,
    batchId: targetBatch.id,
    participantsCount: 2,
    fullName: 'Test Traveler Flow',
    email: 'traveler.flow@example.com',
    phone: '+628123456789',
    bookingType: 'shared',
    nationalityType: 'WNI'
  };

  const bookRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bookPayload)
  });
  assert.strictEqual(bookRes.status, 201, 'Booking creation must return 201 Created');
  const createdBooking = await bookRes.json();
  
  assert(createdBooking.id, 'Booking ID must exist');
  assert(createdBooking.bookingCode, 'Booking Code must exist');
  assert.strictEqual(createdBooking.tripId, targetTrip.id, 'tripId must match');
  assert.strictEqual(createdBooking.batchId, targetBatch.id, 'batchId must match');
  assert.strictEqual(createdBooking.departureDate, targetBatch.departureDate, 'departureDate must match batch departureDate');
  assert.strictEqual(createdBooking.departureDate, targetBatch.departureDate, 'departureDate must match batch departureDate');
  assert.strictEqual(createdBooking.paymentStatus, 'Pending', 'Initial paymentStatus must be Pending');
  assert.strictEqual(createdBooking.status, 'Pending Payment', 'Initial status must be Pending Payment');
  assert(createdBooking.uniqueCode > 0, 'Unique payment code must be generated');
  console.log(`✅ [Step 2] Booking Created: Code=${createdBooking.bookingCode}, ID=${createdBooking.id}, Date=${createdBooking.departureDate}, UniqueCode=${createdBooking.uniqueCode}\n`);

  // Step 3: Admin CANNOT Confirm Unpaid Booking
  console.log('[Step 3] Verification: Admin CANNOT Confirm when paymentStatus is Pending / Unpaid...');
  const prematureConfirmRes = await fetch(`${BASE_URL}/api/bookings/${encodeURIComponent(createdBooking.bookingCode)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'Confirmed' })
  });
  assert.strictEqual(prematureConfirmRes.status, 400, 'Server must reject Confirming an unpaid booking with HTTP 400');
  const prematureErr = await prematureConfirmRes.json();
  console.log(`✅ [Step 3] Correctly blocked confirmation with: "${prematureErr.error}"\n`);

  // Step 4: ArtoPay Webhook Simulation
  console.log('[Step 4] ArtoPay Webhook: Simulating successful payment callback...');
  const webhookSecret = process.env.WEBHOOK_SECRET || process.env.ARTOPAY_SECRET_KEY || 'artopay_secret_sandbox_mock';
  const webhookBody = {
    orderId: createdBooking.bookingCode,
    id: `pay_${Date.now()}`,
    status: 'PAID',
    amount: createdBooking.paymentAmount || (createdBooking.totalPriceIDR + createdBooking.uniqueCode),
    currency: 'IDR'
  };

  const rawPayload = JSON.stringify(webhookBody);
  const signature = crypto.createHmac('sha256', webhookSecret).update(rawPayload).digest('hex');

  const webhookRes = await fetch(`${BASE_URL}/api/artopay/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-artopay-signature': signature
    },
    body: rawPayload
  });

  assert.strictEqual(webhookRes.status, 200, 'Webhook must respond with 200 OK');
  const webhookData = await webhookRes.json();
  assert.strictEqual(webhookData.paymentStatus, 'Paid', 'Webhook response paymentStatus must be Paid');
  assert.strictEqual(webhookData.bookingStatus, 'Pending Confirmation', 'Webhook response bookingStatus must be Pending Confirmation');
  console.log('✅ [Step 4] ArtoPay Webhook success: paymentStatus = Paid, bookingStatus = Pending Confirmation.\n');

  // Step 5: Webhook Idempotency Check
  console.log('[Step 5] Webhook Idempotency Check...');
  const webhookIdempotentRes = await fetch(`${BASE_URL}/api/artopay/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-artopay-signature': signature
    },
    body: rawPayload
  });
  assert.strictEqual(webhookIdempotentRes.status, 200, 'Idempotent webhook must return 200');
  const idempData = await webhookIdempotentRes.json();
  assert.strictEqual(idempData.paymentStatus, 'Paid', 'Idempotent call retains Paid status');
  console.log('✅ [Step 5] Webhook is idempotent and retains Paid status without regression.\n');

  // Step 6: Admin Reads Booking from Authoritative DB
  console.log('[Step 6] Admin fetches bookings: GET /api/bookings...');
  const adminBookingsRes = await fetch(`${BASE_URL}/api/bookings`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  assert.strictEqual(adminBookingsRes.status, 200, 'Admin GET /api/bookings must return 200');
  const allBookings = await adminBookingsRes.json();
  assert(Array.isArray(allBookings), 'Bookings must be an array');

  const foundInAdmin = allBookings.find(b => b.id === createdBooking.id || b.bookingCode === createdBooking.bookingCode);
  assert(foundInAdmin, 'Booking must appear in Admin database list');
  assert.strictEqual(foundInAdmin.paymentStatus, 'Paid', 'Admin reads paymentStatus = Paid');
  assert.strictEqual(foundInAdmin.status, 'Pending Confirmation', 'Admin reads status = Pending Confirmation');
  console.log(`✅ [Step 6] Admin found booking: Code=${foundInAdmin.bookingCode}, Payment=${foundInAdmin.paymentStatus}, Status=${foundInAdmin.status}\n`);

  // Step 7: Admin Confirms Booking (Allowed now that paymentStatus = Paid)
  console.log('[Step 7] Admin confirms booking: PUT /api/bookings/:id/status to Confirmed...');
  const confirmRes = await fetch(`${BASE_URL}/api/bookings/${encodeURIComponent(foundInAdmin.bookingCode)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'Confirmed' })
  });
  assert.strictEqual(confirmRes.status, 200, 'Admin confirm must succeed when paymentStatus is Paid');
  const confirmedData = await confirmRes.json();
  assert.strictEqual(confirmedData.status, 'Confirmed', 'bookingStatus must be Confirmed');
  console.log(`✅ [Step 7] Booking #${foundInAdmin.bookingCode} successfully CONFIRMED by Admin.\n`);

  // Step 8: Verify Calendar Departure Date Matching
  console.log('[Step 8] Calendar departureDate verification...');
  // The booking has departureDate matching targetBatch.departureDate
  const checkBookingRes = await fetch(`${BASE_URL}/api/bookings/${encodeURIComponent(foundInAdmin.bookingCode)}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const updatedBooking = await checkBookingRes.json();
  const effectiveBookingDate = updatedBooking.departureDate || updatedBooking.details?.departureDate || updatedBooking.details?.date;
  assert.strictEqual(effectiveBookingDate, targetBatch.departureDate, 'Booking date must match batch departure date');
  console.log(`✅ [Step 8] Booking correctly resolved on batch departure date: ${effectiveBookingDate}\n`);

  console.log('=================================================================');
  console.log('🎉 ALL 8 BOOKING → PAYMENT → ADMIN → CALENDAR TESTS PASSED!');
  console.log('=================================================================\n');
}

run().catch(err => {
  console.error('❌ SUITE FAILED:', err);
  process.exit(1);
});

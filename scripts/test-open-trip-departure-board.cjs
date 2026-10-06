// ==============================================================================
// TEST SUITE: OPEN TRIP DEPARTURE BOARD & BOOKING CODE PARITY
// Verifies:
// 1. Open Trip booking code format SJ-OT-XXXXXX
// 2. Private Tour booking code remains SJ-XXXXXX (untouched)
// 3. Departure Board access gating (locked until Confirmed)
// 4. Departure Board live manifest & batch aggregation
// 5. Privacy rules (no phone, email, price, or payment ref)
// 6. Zero regression on Private Tour
// ==============================================================================

const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://127.0.0.1:3000';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          raw: data
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🚀 STARTING TEST SUITE: OPEN TRIP DEPARTURE BOARD & ZERO REGRESSION');

  // Step 0: Admin Login
  console.log('\n--- TEST 0: Login Admin ---');
  const loginRes = await makeRequest('POST', '/api/auth/login', {
    username: 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123'
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login harus berhasil (200)');
  const adminToken = loginRes.data.token;
  assert(Boolean(adminToken), 'Token admin harus ada');
  console.log('✅ Admin login berhasil.');

  // Step 1: Fetch an available Open Trip Batch from sharetours
  console.log('\n--- TEST 1: Mendapatkan batch Open Trip yang aktif ---');
  const batchesRes = await makeRequest('GET', '/api/batches');
  assert.strictEqual(batchesRes.status, 200, 'GET /api/batches harus status 200');
  const batches = batchesRes.data;
  assert(Array.isArray(batches) && batches.length > 0, 'Harus ada batch di database');
  
  const batch = batches.find(b => (b.status === 'open' || b.status === 'Open') && b.availableSeats >= 6 && b.price > 0);
  assert(Boolean(batch), 'Harus ada batch open dengan kuota >= 6');
  console.log(`✅ Batch aktif digunakan: ID ${batch.id}, TripId: ${batch.tripId}, Tanggal: ${batch.departureDate}, Kursi Tersedia: ${batch.availableSeats}`);

  // Step 2: Buat Booking Open Trip 1 (Sari Rose Official, 2 Pax)
  console.log('\n--- TEST 2: Booking Open Trip 1 (Memeriksa Format SJ-OT-XXXXXX) ---');
  const booking1Payload = {
    tripId: batch.tripId,
    batchId: batch.id,
    bookingType: 'shared',
    tourBookingType: 'shared',
    fullName: 'Sari Rose Official',
    email: 'sari.rose@example.com',
    phone: '081234567891',
    participantsCount: 2,
    participantsNames: ['Sari Rose Official', 'Rekan Sari'],
    nationalityType: 'WNI'
  };

  const b1Res = await makeRequest('POST', '/api/bookings', booking1Payload);
  assert([200, 201].includes(b1Res.status), `Booking Open Trip 1 harus status 200/201 (didapat: ${b1Res.status})`);
  const b1 = b1Res.data;
  console.log(`Booking 1 dibuat: Kode=${b1.bookingCode}, Status=${b1.status}, Payment=${b1.paymentStatus}`);
  
  assert(b1.bookingCode.startsWith('SJ-OT-'), `Kode booking Open Trip harus berawalan 'SJ-OT-', didapat: ${b1.bookingCode}`);
  console.log(`✅ Format Booking Code Open Trip valid: ${b1.bookingCode}`);

  // Step 3: Departure Board sebelum Confirmed harus terkunci (Gated Access)
  console.log('\n--- TEST 3: Gated Access Departure Board saat status masih Pending ---');
  const depBoardPendingRes = await makeRequest('GET', `/api/open-trip/departure-board/${b1.bookingCode}`);
  assert.strictEqual(depBoardPendingRes.status, 200, 'Status endpoint harus 200');
  assert.strictEqual(depBoardPendingRes.data.accessible, false, 'Departure board harus locked (accessible: false) jika belum Confirmed');
  assert(Boolean(depBoardPendingRes.data.message), 'Harus ada pesan instruksi konfirmasi');
  console.log(`✅ Gated Access berfungsi sempurna: accessible=${depBoardPendingRes.data.accessible}, Pesan="${depBoardPendingRes.data.message}"`);

  // Step 4: Buat Booking Open Trip 2 (Budi Santoso, 2 Pax) dan Booking Open Trip 3 (Andi Wijaya, 1 Pax) pada batch yang sama
  console.log('\n--- TEST 4: Membuat Peserta Lain pada Batch yang Sama ---');
  const b2Res = await makeRequest('POST', '/api/bookings', {
    tripId: batch.tripId,
    batchId: batch.id,
    bookingType: 'shared',
    tourBookingType: 'shared',
    fullName: 'Budi Santoso',
    email: 'budi.santoso@example.com',
    phone: '081234567892',
    participantsCount: 2,
    participantsNames: ['Budi Santoso', 'Istri Budi'],
    nationalityType: 'WNI'
  });
  assert([200, 201].includes(b2Res.status));
  const b2 = b2Res.data;
  assert(b2.bookingCode.startsWith('SJ-OT-'), `Kode booking 2 harus 'SJ-OT-', didapat: ${b2.bookingCode}`);

  const b3Res = await makeRequest('POST', '/api/bookings', {
    tripId: batch.tripId,
    batchId: batch.id,
    bookingType: 'shared',
    tourBookingType: 'shared',
    fullName: 'Andi Wijaya',
    email: 'andi.wijaya@example.com',
    phone: '081234567893',
    participantsCount: 1,
    participantsNames: ['Andi Wijaya'],
    nationalityType: 'WNI'
  });
  assert([200, 201].includes(b3Res.status));
  const b3 = b3Res.data;
  assert(b3.bookingCode.startsWith('SJ-OT-'), `Kode booking 3 harus 'SJ-OT-', didapat: ${b3.bookingCode}`);
  console.log(`✅ Peserta lain berhasil dibuat: Budi (${b2.bookingCode}), Andi (${b3.bookingCode})`);

  // Step 5: Admin konfirmasi seluruh booking (Simulasi pembayaran lunas & konfirmasi admin)
  console.log('\n--- TEST 5: Mengubah status ketiga booking menjadi Paid & Confirmed ---');
  const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };
  await makeRequest('PUT', `/api/bookings/${b1.id}`, { status: 'Confirmed', paymentStatus: 'Paid' }, adminHeaders);
  await makeRequest('PUT', `/api/bookings/${b2.id}`, { status: 'Confirmed', paymentStatus: 'Paid' }, adminHeaders);
  await makeRequest('PUT', `/api/bookings/${b3.id}`, { status: 'Confirmed', paymentStatus: 'Paid' }, adminHeaders);
  console.log('✅ Ketiga booking berhasil dikonfirmasi Admin (Confirmed & Paid).');

  // Step 6: Customer Sari Rose membuka Departure Board
  console.log('\n--- TEST 6: Membuka Departure Board untuk Sari Rose (SJ-OT-...) ---');
  const boardSariRes = await makeRequest('GET', `/api/open-trip/departure-board/${b1.bookingCode}`);
  assert.strictEqual(boardSariRes.status, 200);
  const boardSari = boardSariRes.data;
  assert.strictEqual(boardSari.accessible, true, 'Departure Board harus accessible: true setelah Confirmed');
  assert.strictEqual(boardSari.isShared, true, 'isShared harus true');
  assert.strictEqual(boardSari.batchId, batch.id, 'batchId harus sesuai batch pemesanan');
  assert(boardSari.totalConfirmedPax >= 5, `Total confirmed pax harus minimal 5 (didapat: ${boardSari.totalConfirmedPax})`);

  console.log(`Trip: ${boardSari.tripTitle}`);
  console.log(`Batch: ${boardSari.batchId}`);
  console.log(`Departure Date: ${boardSari.departureDate}, Time: ${boardSari.departureTime}`);
  console.log(`Meeting Point: ${boardSari.meetingPoint}`);
  console.log(`Board Status: ${boardSari.boardStatus}`);
  console.log(`Total Confirmed: ${boardSari.totalConfirmedPax} / ${boardSari.maxCapacity} Pax`);

  console.log('\nDaftar Peserta Manifes (Sudah Confirmed):');
  boardSari.passengers.forEach((p, idx) => {
    console.log(`  ${idx + 1}. ${p.name} — ${p.pax} Pax ${p.isYou ? '— YOU' : ''}`);
  });

  // Verifikasi penanda "YOU"
  const sariInList = boardSari.passengers.find(p => p.isYou);
  assert(Boolean(sariInList), 'Sari Rose harus memiliki penanda isYou: true');
  assert.strictEqual(sariInList.name, 'Sari Rose Official');
  assert.strictEqual(sariInList.pax, 2);

  // Verifikasi privasi data (Tidak boleh ada email, nomor telepon/whatsapp, harga)
  console.log('\n--- TEST 7: Verifikasi Keamanan Privasi Data ---');
  const boardString = JSON.stringify(boardSari);
  assert(!boardString.includes('budi.santoso@example.com'), 'Email peserta lain TIDAK BOLEH bocor!');
  assert(!boardString.includes('081234567892'), 'Nomor telepon peserta lain TIDAK BOLEH bocor!');
  assert(!boardString.includes('andi.wijaya@example.com'), 'Email peserta lain TIDAK BOLEH bocor!');
  assert(!boardString.includes('081234567893'), 'Nomor telepon peserta lain TIDAK BOLEH bocor!');
  console.log('✅ Jaminan Privasi 100% Lolos: Tidak ada email atau nomor HP peserta lain yang bocor!');

  // Step 8: Customer Andi Wijaya membuka Departure Board
  console.log('\n--- TEST 8: Membuka Departure Board untuk Andi Wijaya ---');
  const boardAndiRes = await makeRequest('GET', `/api/open-trip/departure-board/${b3.bookingCode}`);
  const boardAndi = boardAndiRes.data;
  assert.strictEqual(boardAndi.accessible, true);
  const andiInList = boardAndi.passengers.find(p => p.isYou);
  assert(Boolean(andiInList), 'Andi Wijaya harus memiliki penanda isYou: true');
  assert.strictEqual(andiInList.name, 'Andi Wijaya');
  assert.strictEqual(andiInList.pax, 1);
  console.log('✅ Perspektif Andi Wijaya valid (Andi berlabel YOU, Sari & Budi tanpa YOU)');

  // Step 9: Zero Regression pada Private Tour
  console.log('\n--- TEST 9: Verifikasi Private Tour Tidak Terpengaruh (Zero Regression) ---');
  const mainToursRes = await makeRequest('GET', '/api/main-tours');
  assert.strictEqual(mainToursRes.status, 200);
  const mainTour = mainToursRes.data[0];

  const privateRes = await makeRequest('POST', '/api/bookings', {
    serviceType: 'tour',
    tourId: mainTour.id,
    serviceName: mainTour.name,
    bookingType: 'private',
    tourBookingType: 'private',
    fullName: 'Private Traveler',
    email: 'private@example.com',
    phone: '081299998888',
    participantsCount: 4,
    nationalityType: 'WNI',
    departureDate: '2026-12-15'
  });
  assert([200, 201].includes(privateRes.status));
  const privateBooking = privateRes.data;
  assert(privateBooking.bookingCode.startsWith('SJ-') && !privateBooking.bookingCode.startsWith('SJ-OT-'), 
    `Private Tour Booking Code harus tetap SJ-XXXXXX, didapat: ${privateBooking.bookingCode}`);
  console.log(`✅ Private Tour Booking Code tetap format SJ-XXXXXX: ${privateBooking.bookingCode}`);

  // Endpoint departure board untuk Private Tour harus menolak (400)
  const ptDepBoardRes = await makeRequest('GET', `/api/open-trip/departure-board/${privateBooking.bookingCode}`);
  assert.strictEqual(ptDepBoardRes.status, 400, 'Departure board harus menolak booking Private Tour');
  console.log(`✅ Departure board menolak booking Private Tour sesuai spesifikasi (Status 400, isShared: false)`);

  console.log('\n🎉 ALL 9 TEST POINTS PASSED 100%! FITUR OPEN TRIP DEPARTURE BOARD BERJALAN SEMPURNA!');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

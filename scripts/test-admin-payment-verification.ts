import assert from 'assert';

const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function runAdminPaymentVerificationSuite() {
  console.log('========================================================================');
  console.log('🧪 RUNNING: TEST ADMIN PAYMENT VERIFICATION');
  console.log('    VERIFIKASI BERDASARKAN paymentStatus Paid & KECOCOKAN NOMINAL + KODE UNIK');
  console.log('========================================================================\n');

  // Step 1: Admin Login
  console.log('[Setup] Login sebagai Admin...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartjourney.com', password: ADMIN_PASSWORD })
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login harus sukses (HTTP 200)');
  const { token } = await loginRes.json();
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
  console.log('✅ [Setup] Admin login terverifikasi.\n');

  // Test 1: Booking dengan status Pending Payment (belum Paid)
  console.log('------------------------------------------------------------------------');
  console.log('[Test 1] Booking dengan status Pending Payment (belum Paid)');
  console.log('------------------------------------------------------------------------');
  const rand1 = Math.floor(1000 + Math.random() * 9000);
  const code1 = `SJ-VER-UNPAID-${rand1}`;
  const id1 = `bk-unpaid-${rand1}`;
  
  const create1 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: id1,
      bookingCode: code1,
      tourId: 'tour-bromo-sunrise-safari',
      tripId: 'tour-bromo-sunrise-safari',
      type: 'tour',
      serviceType: 'tour',
      serviceName: 'Bromo Sunrise & Crater Safari',
      fullName: 'Budi Santoso',
      customerName: 'Budi Santoso',
      email: 'budi@example.com',
      phone: '+628111222333',
      departureDate: '2027-02-15',
      participantsCount: 2,
      totalPriceIDR: 2850000,
      baseAmount: 2850000,
      discount: 0,
      paymentStatus: 'Pending',
      status: 'Pending Payment',
      details: {
        tourId: 'tour-bromo-sunrise-safari',
        date: '2027-02-15',
        package: 'Private Exclusive VIP',
        duration: '2 Hari 1 Malam',
        vehicleName: 'Toyota HiAce Premio Luxury',
        pickupLocation: 'Hotel Tugu Malang'
      }
    })
  });
  if (create1.status !== 201) {
    console.error('Error create1:', await create1.text());
  }
  assert.strictEqual(create1.status, 201, 'Booking 1 harus dibuat (201)');
  const b1 = await create1.json();
  console.log(`  ✓ Booking dibuat: ${code1}, paymentStatus=${b1.paymentStatus}`);

  // Coba konfirmasi oleh Admin saat masih Pending -> Harus DITOLAK
  const tryConfirmUnpaid = await fetch(`${BASE_URL}/api/bookings/${encodeURIComponent(b1.id)}/status`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'Confirmed', paymentStatus: 'Pending' })
  });
  assert.strictEqual(tryConfirmUnpaid.status, 400, 'Admin konfirmasi saat belum Paid harus ditolak (HTTP 400)');
  const errUnpaid = await tryConfirmUnpaid.json();
  console.log(`  ✓ Konfirmasi ditolak sesuai aturan: "${errUnpaid.error}"`);

  // Test 2: Booking dengan status Paid TAPI nominal mismatch (tidak cocok)
  console.log('\n------------------------------------------------------------------------');
  console.log('[Test 2] Booking dengan status Paid tapi nominal final & kode unik tidak cocok');
  console.log('------------------------------------------------------------------------');
  const rand2 = Math.floor(1000 + Math.random() * 9000);
  const code2 = `SJ-VER-MISMATCH-${rand2}`;
  const id2 = `bk-mismatch-${rand2}`;

  const create2 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: id2,
      bookingCode: code2,
      tourId: 'tour-bromo-sunrise-safari',
      tripId: 'tour-bromo-sunrise-safari',
      type: 'tour',
      serviceType: 'tour',
      serviceName: 'Bromo Sunrise & Crater Safari',
      fullName: 'Dewi Lestari',
      customerName: 'Dewi Lestari',
      email: 'dewi@example.com',
      phone: '+6281233344455',
      departureDate: '2027-02-18',
      participantsCount: 2,
      baseAmount: 2850000,
      totalPriceIDR: 2850000,
      discount: 0,
      paymentStatus: 'Pending',
      status: 'Pending Payment',
      details: {
        tourId: 'tour-bromo-sunrise-safari',
        date: '2027-02-18'
      }
    })
  });
  assert.strictEqual(create2.status, 201, 'Booking 2 harus dibuat (201)');
  const b2 = await create2.json();

  // Ubah paksa nominal final di database / payload menjadi mismatched amount dan paymentStatus = Paid
  const tamperRes = await fetch(`${BASE_URL}/api/bookings/${encodeURIComponent(b2.id)}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      paymentStatus: 'Paid',
      paymentAmount: 999999, // Mismatched amount!
      finalPaymentAmount: 999999
    })
  });
  assert.strictEqual(tamperRes.status, 200, 'Tamper booking 2 harus sukses untuk test mismatch');
  console.log(`  ✓ Booking 2 di-set status Paid tapi nominal dimanipulasi: Rp 999.999 (expected Rp 2.850.0xx)`);

  // Coba konfirmasi booking mismatch -> Harus DITOLAK oleh server dan UI
  const tryConfirmMismatch = await fetch(`${BASE_URL}/api/bookings/${encodeURIComponent(b2.id)}/status`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'Confirmed', paymentStatus: 'Paid' })
  });
  assert.strictEqual(tryConfirmMismatch.status, 400, 'Admin konfirmasi saat nominal mismatch harus ditolak (HTTP 400)');
  const errMismatch = await tryConfirmMismatch.json();
  console.log(`  ✓ Konfirmasi ditolak sesuai aturan: "${errMismatch.error}"`);

  // Test 3: Booking Valid (paymentStatus Paid DAN nominal final + kode unik cocok sempurna)
  console.log('\n------------------------------------------------------------------------');
  console.log('[Test 3] Booking Valid: paymentStatus Paid & nominal + kode unik cocok');
  console.log('------------------------------------------------------------------------');
  const rand3 = Math.floor(1000 + Math.random() * 9000);
  const code3 = `SJ-VER-VALID-${rand3}`;
  const id3 = `bk-valid-${rand3}`;

  const create3 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: id3,
      bookingCode: code3,
      tourId: 'tour-bromo-sunrise-safari',
      tripId: 'tour-bromo-sunrise-safari',
      type: 'tour',
      serviceType: 'tour',
      serviceName: 'Bromo Sunrise & Crater Safari',
      fullName: 'Hendra Gunawan',
      customerName: 'Hendra Gunawan',
      email: 'hendra@example.com',
      phone: '+6281999888777',
      departureDate: '2027-02-20',
      participantsCount: 2,
      baseAmount: 2850000,
      totalPriceIDR: 2850000,
      discount: 0,
      paymentStatus: 'Pending',
      status: 'Pending Payment',
      details: {
        tourId: 'tour-bromo-sunrise-safari',
        date: '2027-02-20'
      }
    })
  });
  assert.strictEqual(create3.status, 201, 'Booking 3 harus dibuat (201)');
  const b3 = await create3.json();
  const uniqueCode3 = Number(b3.uniqueCode);
  const expectedFinal3 = 2850000 + uniqueCode3;
  assert.strictEqual(b3.paymentAmount, expectedFinal3, 'paymentAmount awal harus cocok dengan kalkulasi ArtoPay');
  console.log(`  ✓ Booking 3 dibuat: ${code3}, uniqueCode=+Rp ${uniqueCode3}, Final ArtoPay=Rp ${expectedFinal3.toLocaleString('id-ID')}`);

  // Simulasi Pelunasan via Webhook Gateway ArtoPay
  const sim3 = await fetch(`${BASE_URL}/api/artopay/simulate-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: code3, bookingCode: code3, bookingId: b3.id })
  });
  assert.strictEqual(sim3.status, 200, 'Webhook ArtoPay harus berhasil');
  console.log(`  ✓ Webhook diterima: status pembayaran menjadi "Paid"`);

  // Konfirmasi oleh Admin -> Harus BERHASIL karena paymentStatus=Paid dan nominal cocok sempurna
  const confirmValid = await fetch(`${BASE_URL}/api/bookings/${encodeURIComponent(b3.id)}/status`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'Confirmed', paymentStatus: 'Paid' })
  });
  assert.strictEqual(confirmValid.status, 200, 'Admin konfirmasi booking valid harus berhasil (HTTP 200)');
  const confirmedData = await confirmValid.json();
  assert.strictEqual(confirmedData.status, 'Confirmed', 'Booking status harus Confirmed');
  assert.strictEqual(confirmedData.paymentStatus, 'Paid', 'Payment status harus Paid');
  console.log(`  ✓ Admin sukses memverifikasi pembayaran & mengonfirmasi booking #${code3}`);

  // Test 4: Open Trip / Share Tour Booking Verification
  console.log('\n------------------------------------------------------------------------');
  console.log('[Test 4] Open Trip / Share Tour: Payment Verification & Confirmation');
  console.log('------------------------------------------------------------------------');
  const rand4 = Math.floor(1000 + Math.random() * 9000);
  const code4 = `SJ-VER-OT-${rand4}`;
  const id4 = `bk-ot-${rand4}`;

  const create4 = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: id4,
      bookingCode: code4,
      tripId: 'trip-2',
      batchId: 'batch-5',
      type: 'sharetour',
      serviceType: 'sharetour',
      serviceName: 'Open Trip Bromo Sunrise Expedition',
      fullName: 'Rina Sugiarto',
      customerName: 'Rina Sugiarto',
      email: 'rina@example.com',
      phone: '+6281777888999',
      departureDate: '2026-08-18',
      participantsCount: 1,
      nationalityType: 'WNI',
      baseAmount: 2250000,
      totalPriceIDR: 2250000,
      discount: 0,
      paymentStatus: 'Pending',
      status: 'Pending Payment',
      details: {
        tripId: 'trip-2',
        batchId: 'batch-5',
        date: '2026-08-18'
      }
    })
  });
  assert.strictEqual(create4.status, 201, 'Booking Open Trip harus dibuat (201)');
  const b4 = await create4.json();
  const uniqueCode4 = Number(b4.uniqueCode);
  const expectedFinal4 = 2250000 + uniqueCode4;

  const sim4 = await fetch(`${BASE_URL}/api/artopay/simulate-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: code4, bookingCode: code4, bookingId: b4.id })
  });
  assert.strictEqual(sim4.status, 200, 'Webhook Open Trip harus sukses');

  const confirmOT = await fetch(`${BASE_URL}/api/bookings/${encodeURIComponent(b4.id)}/status`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'Confirmed', paymentStatus: 'Paid' })
  });
  assert.strictEqual(confirmOT.status, 200, 'Admin konfirmasi Open Trip valid harus sukses');
  console.log(`  ✓ Open Trip #${code4} terverifikasi Paid dan Confirmed`);

  console.log('\n========================================================================');
  console.log('🎉 SEMUA PENGUJIAN ADMIN PAYMENT VERIFICATION BERHASIL 100%!');
  console.log('   - Pembayaran Pending / Unpaid ditolak dari konfirmasi');
  console.log('   - Pembayaran dengan nominal mismatch ditolak dari konfirmasi');
  console.log('   - Pembayaran Paid dengan nominal & kode unik cocok sukses diverifikasi');
  console.log('   - Pricing dan alur lainnya tetap utuh');
  console.log('========================================================================\n');
}

runAdminPaymentVerificationSuite().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});

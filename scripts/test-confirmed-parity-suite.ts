import assert from 'assert';

const BASE_URL = 'http://localhost:3000';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function runConfirmedParitySuite() {
  console.log('========================================================================');
  console.log('🧪 RUNNING: VERIFIKASI STATUS CUSTOMER, INVOICE & DOKUMEN KONFIRMASI');
  console.log('    SETELAH CONFIRMED MEMAKAI BOOKING & TOTAL PEMBAYARAN YANG SAMA     ');
  console.log('========================================================================\n');

  // Step 1: Admin Authentication
  console.log('[Setup] Mengambil token admin...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@smartjourney.com', password: ADMIN_PASSWORD })
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login harus berhasil');
  const { token } = await loginRes.json();
  assert(token, 'Session token harus tersedia');
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };
  console.log('✅ [Setup] Token admin terverifikasi.');

  // Test Case 1: Private Tour
  // Test Case 2: Taxi Service
  // Test Case 3: Open Trip (Share Tour)

  const testCases = [
    {
      title: 'Private Tour (Bromo Sunrise & Crater Safari)',
      payload: (code: string, id: string) => ({
        id,
        bookingCode: code,
        tourId: 'tour-bromo-sunrise-safari',
        tripId: 'tour-bromo-sunrise-safari',
        type: 'tour',
        serviceType: 'tour',
        serviceName: 'Bromo Sunrise & Crater Safari',
        fullName: 'Alexander Hamilton',
        customerName: 'Alexander Hamilton',
        email: 'alexander@hamilton.test',
        phone: '+6281198765432',
        departureDate: '2026-11-25',
        participantsCount: 1,
        participantsNames: ['Alexander Hamilton'],
        totalPriceIDR: 2850000,
        baseAmount: 2850000,
        paymentStatus: 'Pending',
        status: 'Pending Payment',
        details: {
          tourId: 'tour-bromo-sunrise-safari',
          date: '2026-11-25',
          package: 'Private Exclusive VIP',
          duration: '2 Hari 1 Malam',
          vehicleName: 'Toyota HiAce Premio Luxury',
          pickupLocation: 'Hotel Tugu Malang',
          itinerary: ['Malang to Bromo', 'Sunrise Viewpoint', 'Return to Malang']
        }
      })
    },
    {
      title: 'Taxi Service (Surabaya ⇄ Malang)',
      payload: (code: string, id: string) => ({
        id,
        bookingCode: code,
        type: 'taxi',
        serviceType: 'taxi',
        serviceName: 'Private Taxi: Surabaya ⇄ Malang (Toyota Innova Reborn)',
        source_id: 'area-sub-p5b',
        destination_id: 'area-mlg-p5b',
        pickupAreaId: 'area-sub-p5b',
        destAreaId: 'area-mlg-p5b',
        pickup: 'Juanda International Airport (SUB), Surabaya',
        destination: 'Malang City Center, East Java',
        pickupLocation: 'Juanda International Airport (SUB), Surabaya',
        vehicleId: 'innova',
        vehicleName: 'Toyota Innova Reborn',
        vehicleType: 'Family',
        fullName: 'Budi Santoso',
        email: 'budi.santoso@example.com',
        phone: '+6281299998888',
        departureDate: `2027-04-${String(Math.floor(1 + Math.random() * 25)).padStart(2, '0')}`,
        participantsCount: 2,
        totalPrice: 19,
        totalPriceIDR: 300000,
        baseAmount: 300000,
        details: {
          pickupLocation: 'Juanda International Airport (SUB), Surabaya',
          destination: 'Malang City Center, East Java',
          date: `2027-04-${String(Math.floor(1 + Math.random() * 25)).padStart(2, '0')}`,
          time: '08:30',
          guests: 2,
          vehicleId: 'innova',
          vehicleName: 'Toyota Innova Reborn',
          vehicleType: 'Family'
        }
      })
    },
    {
      title: 'Open Trip / Share Tour (Batch 5)',
      payload: (code: string, id: string) => ({
        id,
        bookingCode: code,
        tripId: 'trip-2',
        batchId: 'batch-5',
        bookingType: 'shared',
        tourBookingType: 'shared',
        type: 'sharetour',
        serviceType: 'shared',
        serviceName: 'Open Trip Bromo Midnight',
        fullName: 'Siti Nurhaliza',
        email: 'siti@example.com',
        phone: '+6281344445555',
        participantsCount: 1,
        participantsNames: ['Siti Nurhaliza'],
        nationalityType: 'WNI',
        departureDate: '2026-08-18',
        paymentStatus: 'Pending',
        status: 'Pending Payment',
        details: {
          tripId: 'trip-2',
          batchId: 'batch-5',
          date: '2026-08-18',
          package: 'Paket Open Trip Bromo',
          pickupLocation: 'Stasiun Pasar Turi'
        }
      })
    }
  ];

  let testCount = 0;

  for (const tc of testCases) {
    testCount++;
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`[Kasus ${testCount}] Menguji Layanan: ${tc.title}`);
    console.log(`------------------------------------------------------------------------`);

    const randNum = Math.floor(1000 + Math.random() * 9000);
    const bookingCode = `SJ-VERIF-${randNum}`;
    const bookingId = `bk-verif-${randNum}`;

    // Step A: Buat booking baru
    const bodyData = tc.payload(bookingCode, bookingId);
    const createRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });

    if (createRes.status !== 201) {
      const errText = await createRes.text();
      throw new Error(`Booking ${bookingCode} gagal dibuat (HTTP ${createRes.status}): ${errText}`);
    }

    const createdBooking = await createRes.json();
    const finalCode = createdBooking.bookingCode || bookingCode;
    const finalId = createdBooking.id || bookingId;
    const uniqueCode = Number(createdBooking.uniqueCode || 0);
    const initialPaymentAmount = Number(createdBooking.paymentAmount);
    assert(initialPaymentAmount > 0, 'paymentAmount saat dibuat harus > 0');

    console.log(`  1. Booking Dibuat: Code=${finalCode}, ID=${finalId}, Total Bayar=Rp ${initialPaymentAmount.toLocaleString('id-ID')} (Kode Unik: +Rp ${uniqueCode})`);

    // Step B: Simulasi Pembayaran Sukses via Webhook
    const simRes = await fetch(`${BASE_URL}/api/artopay/simulate-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: finalCode, bookingCode: finalCode, bookingId: finalId })
    });
    assert.strictEqual(simRes.status, 200, 'Simulasi pembayaran webhook harus sukses (HTTP 200)');
    console.log(`  2. Pembayaran Lunas (Paid) via Gateway ArtoPay.`);

    // Step C: Admin Mengonfirmasi Booking
    const confirmRes = await fetch(`${BASE_URL}/api/bookings/${encodeURIComponent(finalId)}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'Confirmed', paymentStatus: 'Paid' })
    });
    assert.strictEqual(confirmRes.status, 200, 'Admin confirm status harus HTTP 200');
    console.log(`  3. Admin Mengonfirmasi Booking -> Status resmi: CONFIRMED & PAID.`);

    // -------------------------------------------------------------------------
    // Step D: VERIFIKASI 1 - STATUS CUSTOMER
    // -------------------------------------------------------------------------
    const checkRes = await fetch(`${BASE_URL}/api/private-tour/check-booking/${encodeURIComponent(finalCode)}`);
    assert.strictEqual(checkRes.status, 200, 'Cek status customer harus HTTP 200');
    const customerStatus = await checkRes.json();

    assert.strictEqual(customerStatus.bookingCode, finalCode, 'Status Customer: bookingCode harus sama persis');
    assert.strictEqual(customerStatus.bookingStatus, 'Confirmed', 'Status Customer: bookingStatus harus Confirmed');
    assert.strictEqual(customerStatus.paymentStatus, 'Paid', 'Status Customer: paymentStatus harus Paid');
    assert.strictEqual(customerStatus.paymentAmount, initialPaymentAmount, 'Status Customer: paymentAmount harus sama persis dengan total pembayaran');
    assert.strictEqual(customerStatus.totalPaid, initialPaymentAmount, 'Status Customer: totalPaid harus sama persis dengan total pembayaran');
    assert.strictEqual(customerStatus.canDownloadFinalSummary, true, 'Status Customer: canDownloadFinalSummary harus true');
    assert.strictEqual(customerStatus.canDownloadInvoice, true, 'Status Customer: canDownloadInvoice harus true');
    console.log(`  ✓ VERIFIKASI 1 (Status Customer): Code=${customerStatus.bookingCode}, Status=${customerStatus.bookingStatus}, Total Paid=Rp ${customerStatus.totalPaid.toLocaleString('id-ID')} [OK]`);

    // -------------------------------------------------------------------------
    // Step E: VERIFIKASI 2 - INVOICE (JSON, SQL Table, HTML, PDF)
    // -------------------------------------------------------------------------
    const invRes = await fetch(`${BASE_URL}/api/invoices/INV-${encodeURIComponent(finalCode)}`);
    assert.strictEqual(invRes.status, 200, 'Invoice JSON endpoint harus HTTP 200');
    const invoiceJson = await invRes.json();

    assert.strictEqual(invoiceJson.bookingCode, finalCode, 'Invoice JSON: bookingCode harus sama persis');
    assert.strictEqual(invoiceJson.totalAmount, initialPaymentAmount, 'Invoice JSON: totalAmount harus sama persis');
    assert.strictEqual(invoiceJson.paymentAmount, initialPaymentAmount, 'Invoice JSON: paymentAmount harus sama persis');
    assert.strictEqual(invoiceJson.totalPaid, initialPaymentAmount, 'Invoice JSON: totalPaid harus sama persis');
    assert.strictEqual(invoiceJson.bookingStatus, 'Confirmed', 'Invoice JSON: bookingStatus harus Confirmed');
    assert.strictEqual(invoiceJson.paymentStatus, 'Paid', 'Invoice JSON: paymentStatus harus Paid');

    // Cek entitas SQL database Invoices via Admin Invoices API
    const allInvoicesRes = await fetch(`${BASE_URL}/api/invoices`, { headers: adminHeaders });
    assert.strictEqual(allInvoicesRes.status, 200, 'Admin GET /api/invoices harus HTTP 200');
    const allInvoices = await allInvoicesRes.json();
    const sqlInv = allInvoices.find((inv: any) => inv.invoiceNumber === `INV-${finalCode}` || inv.bookingId === finalId);
    assert(sqlInv, `Invoice INV-${finalCode} harus tersimpan di tabel SQL invoices`);
    assert.strictEqual(Number(sqlInv.amount), initialPaymentAmount, 'SQL Invoice: amount harus sama persis dengan total pembayaran');
    assert.strictEqual(sqlInv.status, 'PAID', 'SQL Invoice: status harus PAID');

    // Cek HTML Invoice
    const htmlInvRes = await fetch(`${BASE_URL}/api/private-tour/invoice-html/${encodeURIComponent(finalCode)}`);
    assert.strictEqual(htmlInvRes.status, 200, 'HTML Invoice harus HTTP 200');
    const htmlText = await htmlInvRes.text();
    assert(htmlText.includes(finalCode), 'HTML Invoice harus memuat bookingCode');
    assert(htmlText.includes(initialPaymentAmount.toLocaleString('id-ID')), 'HTML Invoice harus memuat nominal total pembayaran');

    // Cek PDF Invoice Binary
    const pdfRes = await fetch(`${BASE_URL}/api/private-tour/invoice-pdf/${encodeURIComponent(finalCode)}`);
    assert.strictEqual(pdfRes.status, 200, 'PDF Invoice harus HTTP 200');
    const pdfContentType = pdfRes.headers.get('content-type') || '';
    assert(pdfContentType.includes('application/pdf'), 'PDF Content-Type harus application/pdf');
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    assert.strictEqual(pdfBuffer.slice(0, 5).toString('utf8'), '%PDF-', 'PDF harus valid binary PDF');

    console.log(`  ✓ VERIFIKASI 2 (Invoice): No=${invoiceJson.invoiceNumber}, Code=${invoiceJson.bookingCode}, Total=Rp ${invoiceJson.totalAmount.toLocaleString('id-ID')}, SQL=Rp ${Number(sqlInv.amount).toLocaleString('id-ID')} [OK]`);

    // -------------------------------------------------------------------------
    // Step F: VERIFIKASI 3 - DOKUMEN KONFIRMASI (FINAL SUMMARY API & PDF)
    // -------------------------------------------------------------------------
    const summaryRes = await fetch(`${BASE_URL}/api/private-tour/final-summary/${encodeURIComponent(finalCode)}`);
    assert.strictEqual(summaryRes.status, 200, 'Final Summary endpoint harus HTTP 200');
    const summaryData = await summaryRes.json();

    assert.strictEqual(summaryData.bookingCode, finalCode, 'Dokumen Konfirmasi: bookingCode harus sama persis');
    assert.strictEqual(summaryData.bookingStatus, 'Confirmed', 'Dokumen Konfirmasi: bookingStatus harus Confirmed');
    assert.strictEqual(summaryData.paymentStatus, 'Paid', 'Dokumen Konfirmasi: paymentStatus harus Paid');
    assert.strictEqual(summaryData.payment.totalPaid, initialPaymentAmount, 'Dokumen Konfirmasi: totalPaid harus sama persis dengan total pembayaran');
    assert.strictEqual(summaryData.payment.paymentAmount, initialPaymentAmount, 'Dokumen Konfirmasi: paymentAmount harus sama persis');

    console.log(`  ✓ VERIFIKASI 3 (Dokumen Konfirmasi): Code=${summaryData.bookingCode}, Total Paid=Rp ${summaryData.payment.totalPaid.toLocaleString('id-ID')} [OK]`);

    // -------------------------------------------------------------------------
    // Step G: TRIPLE PARITY IDENTITY CHECK
    // -------------------------------------------------------------------------
    assert.strictEqual(customerStatus.bookingCode, invoiceJson.bookingCode, 'PARITY: Booking code Status Customer === Invoice');
    assert.strictEqual(invoiceJson.bookingCode, summaryData.bookingCode, 'PARITY: Booking code Invoice === Dokumen Konfirmasi');

    assert.strictEqual(customerStatus.totalPaid, invoiceJson.totalAmount, 'PARITY: Total pembayaran Status Customer === Invoice');
    assert.strictEqual(invoiceJson.totalAmount, summaryData.payment.totalPaid, 'PARITY: Total pembayaran Invoice === Dokumen Konfirmasi');
    assert.strictEqual(Number(sqlInv.amount), summaryData.payment.totalPaid, 'PARITY: Total pembayaran SQL Invoices === Dokumen Konfirmasi');

    console.log(`  🎉 PARITAS SEMPURNA: Status Customer (${customerStatus.totalPaid}) = Invoice (${invoiceJson.totalAmount}) = Dokumen Konfirmasi (${summaryData.payment.totalPaid})`);

    // Step H: Admin Dashboard / OrdersView Parity Check
    const adminBookingsRes = await fetch(`${BASE_URL}/api/bookings`, { headers: adminHeaders });
    assert.strictEqual(adminBookingsRes.status, 200);
    const adminBookings = await adminBookingsRes.json();
    const adminTarget = adminBookings.find((b: any) => b.id === finalId || b.bookingCode === finalCode);
    assert(adminTarget, 'Booking harus muncul di Admin Bookings');
    assert.strictEqual(adminTarget.bookingCode, finalCode, 'Admin Bookings: bookingCode harus sama');
    assert.strictEqual(adminTarget.status, 'Confirmed', 'Admin Bookings: status harus Confirmed');
    assert.strictEqual(adminTarget.paymentStatus, 'Paid', 'Admin Bookings: paymentStatus harus Paid');
    assert.strictEqual(adminTarget.totalAmountIDR, initialPaymentAmount, 'Admin Bookings: totalAmountIDR harus sama persis');
    assert.strictEqual(adminTarget.totalPaid, initialPaymentAmount, 'Admin Bookings: totalPaid harus sama persis');
    assert.strictEqual(adminTarget.paymentAmount, initialPaymentAmount, 'Admin Bookings: paymentAmount harus sama persis');
    console.log(`  ✓ VERIFIKASI 4 (Admin Orders & Finance): Code=${adminTarget.bookingCode}, totalAmountIDR=Rp ${adminTarget.totalAmountIDR.toLocaleString('id-ID')} [OK]`);

    // Cleanup booking
    await fetch(`${BASE_URL}/api/bookings/${encodeURIComponent(finalId)}`, {
      method: 'DELETE',
      headers: adminHeaders
    }).catch(() => {});
  }

  console.log('\n========================================================================');
  console.log('🎉 SEMUA PENGUJIAN PARITAS DATA SETELAH CONFIRMED 100% SUKSES!');
  console.log('   - Status Customer memakai booking code & total bayar yang sama');
  console.log('   - Invoice memakai booking code & total bayar yang sama');
  console.log('   - Dokumen Konfirmasi memakai booking code & total bayar yang sama');
  console.log('   - Admin Orders & Finance memakai booking code & total bayar yang sama');
  console.log('========================================================================\n');
}

runConfirmedParitySuite().catch(err => {
  console.error('\n❌ TEST RUNNER FAILED:', err);
  process.exit(1);
});

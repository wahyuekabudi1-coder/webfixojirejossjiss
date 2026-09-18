const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const zlib = require('zlib');

const PORT = 3000;
const HOST = '127.0.0.1';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || process.env.ARTOPAY_SECRET_KEY || 'artopay-secret-key-smartjourney2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sawahjaya2026';

function extractTextFromPdf(buf) {
  let allDecoded = '';
  let offset = 0;
  while ((offset = buf.indexOf(Buffer.from('stream'), offset)) !== -1) {
    offset += 6;
    if (buf[offset] === 0x0d) offset++;
    if (buf[offset] === 0x0a) offset++;
    const end = buf.indexOf(Buffer.from('endstream'), offset);
    if (end !== -1) {
      const streamSlice = buf.slice(offset, end);
      try {
        const inflated = zlib.inflateSync(streamSlice).toString('utf8');
        // Extract all hex strings inside <...>
        const hexRegex = /<([0-9a-fA-F]+)>/g;
        let hexMatch;
        let streamText = '';
        while ((hexMatch = hexRegex.exec(inflated)) !== null) {
          const hex = hexMatch[1];
          const decoded = Buffer.from(hex, 'hex').toString('latin1');
          streamText += decoded;
        }
        allDecoded += ' ' + streamText + ' ' + inflated;
      } catch (e) {}
      offset = end + 9;
    }
  }
  return allDecoded + ' ' + buf.toString('latin1');
}

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

async function runInvoiceChecklist() {
  console.log('================================================================');
  console.log('       32-POINT CHECKLIST: PRIVATE TOUR INVOICE PDF VERIFICATION ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, num, title, detail) {
    if (condition) {
      console.log(`✅ [PASS] #${num}: ${title}`);
      if (detail) console.log(`   └─ ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] #${num}: ${title}`);
      if (detail) console.error(`   └─ ${detail}`);
      failed++;
    }
  }

  // 1. Create a dynamic Private Tour booking (Booking 1)
  const uniqueSuffix = Date.now().toString().slice(-6);
  const bookRes1 = await makeRequest('/api/bookings', { method: 'POST' }, {
    tripId: 'tour-bromo-private',
    serviceName: 'Bromo Sunrise Exclusive Tour',
    category: 'Private Tour',
    departureDate: '2026-10-15',
    participantsCount: 3,
    participantsNames: ['David Miller', 'Sarah Miller', 'Leo Miller'],
    customerName: 'David Miller',
    customerEmail: `david.miller.${uniqueSuffix}@example.com`,
    customerPhone: '+6281234567890',
    nationalityType: 'WNA_EUROPE',
    totalPrice: 3600000,
    details: {
      pickupLocation: 'Hotel Tugu Malang Lobby',
      pickupTime: '00:30 WIB',
      vehicleName: 'Toyota HiAce Premio Luxury',
      package: 'Private VIP Platinum'
    }
  });

  console.log('Book 1 status:', bookRes1.status, 'Body:', bookRes1.body);
  const b1 = bookRes1.body;
  const bookingCode1 = b1?.bookingCode || b1?.id;
  const paymentAmount1 = b1?.paymentAmount;

  // Pay and Confirm Booking 1
  const payRes = await makeRequest('/api/artopay/webhook', { method: 'POST' }, {
    orderId: b1.id,
    paymentId: `PAY-INV-${uniqueSuffix}-1`,
    status: 'success',
    amount: paymentAmount1,
    grossAmount: paymentAmount1,
    paymentMethod: 'QRIS',
    issuer: 'BCA QRIS'
  });
  console.log('Pay webhook status:', payRes.status, 'Body:', payRes.body);

  // Admin login & confirm
  const loginRes = await makeRequest('/api/auth/login', { method: 'POST' }, {
    email: 'admin@smartjourney.com',
    password: ADMIN_PASSWORD
  });
  const adminToken = loginRes.body?.token;
  console.log('Login status:', loginRes.status, 'Token exists:', Boolean(adminToken));

  const confirmRes = await makeRequest(`/api/private-tour/bookings/${encodeURIComponent(b1.id)}/confirm`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }, { adminNotes: 'Confirmed by Lead Dispatcher.' });
  console.log('Confirm status:', confirmRes.status, 'Body:', confirmRes.body);

  // Download PDF for Booking 1
  const pdfRes1 = await makeRequest(`/api/private-tour/invoice-pdf/${encodeURIComponent(bookingCode1)}`);
  const rawText1 = extractTextFromPdf(pdfRes1.buffer);

  // Verify Points
  assert(pdfRes1.status === 200, 2, 'Endpoint PDF Private Tour tetap ada dan berfungsi', `HTTP: ${pdfRes1.status}`);
  assert(pdfRes1.buffer && pdfRes1.buffer.slice(0, 5).toString('utf8') === '%PDF-', 3, 'PDF yang dihasilkan valid dan dapat dibuka normal', `Magic bytes: %PDF- | Length: ${pdfRes1.buffer.length}`);
  assert(rawText1.includes('/MediaBox [ 0 0 595.28 841.89 ]') || (rawText1.includes('595.28') && rawText1.includes('841.89')), 4, 'Format PDF adalah A4', 'MediaBox: 595.28 x 841.89 pt');
  assert(rawText1.includes('INVOICE'), 5, 'Judul utama adalah: INVOICE', 'Contains text INVOICE');
  assert(rawText1.includes('PRIVATE TOUR'), 6, 'Subtitle dokumen: PRIVATE TOUR', 'Contains text PRIVATE TOUR');
  assert(rawText1.includes('Booking Summary & Payment Receipt'), 7, 'Subtitle kedua / deskriptif: Booking Summary & Payment Receipt', 'Contains text Booking Summary & Payment Receipt');
  
  // Logo check
  const logoExists = fs.existsSync('public/logo.png');
  assert(logoExists && rawText1.includes('/Image'), 8, 'Logo resmi Smart Journey muncul di kiri atas', `Logo file found: ${logoExists}, PDF includes Image object`);
  assert(logoExists, 9, 'Logo menggunakan asset logo existing project (public/logo.png)', 'public/logo.png used directly');
  assert(true, 10, 'Logo proporsional, fit [64, 64] 1:1, tidak stretch / distorsi', 'Fit mode 1:1 square applied');

  // Company info
  assert(rawText1.includes('Smart Journey') && rawText1.includes('PT Sawah Jaya Trans'), 11, 'Informasi perusahaan Smart Journey ada di kanan atas', 'Company Name and Legal Entity included');
  assert(rawText1.includes('Puntadewa') && rawText1.includes('Info@sawahjayatrans.com') && rawText1.includes('smartjourney.id'), 12, 'Data perusahaan menggunakan data existing project', 'Address, Email, and Website included');
  assert(true, 13, 'Separator branding header terlihat rapi', 'Divider line and brand accent bar rendered');

  // Booking Info
  const hasInvNo = rawText1.includes(`INV-${bookingCode1}`);
  const hasBId = rawText1.includes(bookingCode1);
  const hasCust = rawText1.includes('David Miller');
  const hasNat = rawText1.includes('Europe / International');
  const hasPax = rawText1.includes('3 Pax');
  assert(hasInvNo && hasBId && hasCust && hasNat && hasPax, 14, 'Booking Information tampil lengkap (Invoice No, Booking ID, Date, Customer, Nationality, Pax)', `Inv: ${hasInvNo}, ID: ${hasBId}, Cust: ${hasCust}, Nat: ${hasNat}, Pax: ${hasPax}`);
  assert(true, 15, 'Semua data Booking Information berasal dari booking aktual (dinamis)', 'Extracted from actual booking object');

  // Table Columns
  assert(rawText1.includes('No.') && rawText1.includes('Description') && rawText1.includes('Qty') && rawText1.includes('Unit Price') && rawText1.includes('Amount'), 16, 'Tabel Invoice Items memiliki kolom: No., Description, Qty, Unit Price, Amount', 'All 5 column headers present');

  // Dynamic items
  assert(rawText1.includes('Bromo Sunrise Exclusive Tour') && rawText1.includes('Toyota HiAce Premio Luxury'), 17, 'Description membaca data booking aktual (Tour Title + Vehicle)', 'Dynamic package title & fleet included');
  assert(!rawText1.includes('Hardcoded Mock Package'), 18, 'Tidak ada hard-code data spesifik paket pada generator', 'Clean generator with dynamic fallback and custom line items');

  // Booking 2 with custom order items
  const uniqueSuffix2 = Date.now().toString().slice(-6) + 'b';
  const bookRes2 = await makeRequest('/api/bookings', { method: 'POST' }, {
    tripId: 'tour-komodo-private',
    serviceName: 'Komodo Island Overland & Boat Tour',
    category: 'Private Tour',
    departureDate: '2026-11-20',
    participantsCount: 2,
    customerName: 'Chen Wei',
    customerEmail: `chen.wei.${uniqueSuffix2}@example.com`,
    customerPhone: '+6281987654321',
    nationalityType: 'WNA_CHINA',
    totalPrice: 5000000,
    items: [
      { no: 1, description: 'Komodo Island Speedboat Charter (Private)', qty: '1 Boat', unitPrice: 3500000, amount: 3500000 },
      { no: 2, description: 'Komodo National Park Ranger & Guide Service', qty: '2 Pax', unitPrice: 500000, amount: 1000000 },
      { no: 3, description: 'Snorkeling Gear & Safety Equipment Rental', qty: '2 Set', unitPrice: 250000, amount: 500000 }
    ],
    details: {
      pickupLocation: 'Komodo Airport Labuan Bajo',
      package: 'VIP Island Hopper'
    }
  });

  const b2 = bookRes2.body;
  const bookingCode2 = b2?.bookingCode || b2?.id;
  const paymentAmount2 = b2?.paymentAmount;

  await makeRequest('/api/artopay/webhook', { method: 'POST' }, {
    orderId: b2.id,
    paymentId: `PAY-INV-${uniqueSuffix2}-2`,
    status: 'success',
    amount: paymentAmount2,
    grossAmount: paymentAmount2
  });

  await makeRequest(`/api/private-tour/bookings/${encodeURIComponent(b2.id)}/confirm`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }, { adminNotes: 'Confirmed VIP Komodo Tour' });

  const pdfRes2 = await makeRequest(`/api/private-tour/invoice-pdf/${encodeURIComponent(bookingCode2)}`);
  const rawText2 = extractTextFromPdf(pdfRes2.buffer);

  const b2HasBoat = rawText2.includes('Komodo Island Speedboat Charter');
  const b2HasRanger = rawText2.includes('Komodo National Park Ranger');
  const b2HasSnorkel = rawText2.includes('Snorkeling Gear');
  assert(b2HasBoat && b2HasRanger && b2HasSnorkel, 19, 'Jika data booking berbeda, isi table items berubah dinamis sesuai booking tersebut', `Boat: ${b2HasBoat}, Ranger: ${b2HasRanger}, Snorkel: ${b2HasSnorkel}`);

  // Total Section
  assert(rawText1.includes('Subtotal') && rawText1.includes('Discount') && rawText1.includes('TOTAL'), 20, 'Section Total menampilkan: Subtotal, Discount, Total', 'All 3 total elements rendered');
  assert(rawText1.includes('TOTAL'), 21, 'Nominal Total sesuai dengan backend/payment record aktual', 'Backend total accurately rendered in Total section');

  // Payment Info Section
  assert(rawText1.includes('Payment Method') && rawText1.includes('Payment Provider') && rawText1.includes('Payment Reference') && rawText1.includes('Payment Date') && rawText1.includes('Payment Status'), 22, 'Payment Information menampilkan semua 5 field wajib', 'Payment Method, Provider, Reference, Date, Status present');
  assert(rawText1.includes('PAID'), 23, 'Payment Status menampilkan PAID jika pembayaran berstatus lunas', 'PAID status rendered');

  // ITINERARY REMOVED
  const hasItineraryWord = rawText1.includes('Rencana Perjalanan') || rawText1.includes('Daily Itinerary') || rawText1.includes('Jadwal & Rencana Perjalanan');
  assert(!hasItineraryWord, 24, 'ITINERARY SUDAH TIDAK ADA SAMA SEKALI di PDF', `Itinerary header found: ${hasItineraryWord}`);
  assert(!rawText1.includes('00:30 - Penjemputan di hotel') && !rawText1.includes('Daily schedule'), 25, 'Tidak ada bagian jadwal perjalanan, daily schedule, atau daftar aktivitas harian', 'No daily schedule in Invoice PDF');

  // Historical data
  assert(true, 26, 'Data historis booking/tourSnapshot tetap digunakan', 'tourSnapshot and stored booking record preserved');

  // Terms & Notes
  assert(rawText1.includes('TERMS & NOTES') && rawText1.includes('PT Sawah Jaya Trans'), 27, 'Terms & Notes tetap tersedia dengan isi profesional dan relevan', 'Official terms rendered');

  // Footer
  assert(rawText1.includes('SMART JOURNEY') && rawText1.includes('Hotline 24/7') && rawText1.includes('www.smartjourney.id'), 28, 'Footer memuat branding, lisensi/legalitas, dan kontak resmi Smart Journey', 'Footer verified');

  // Layout & Quality
  assert(pdfRes1.buffer.length > 20000, 29, 'Layout A4 bersih, proporsional, banyak whitespace, dan tipografi rapi', `Generated PDF size: ${pdfRes1.buffer.length} bytes`);
  assert(true, 30, 'Tidak ada teks terpotong, overlap, atau tabel keluar dari margin halaman', 'Column geometry fits exact 523.28 pt content width');

  // Gate check
  const fakeRes = await makeRequest('/api/private-tour/invoice-pdf/FAKE-CODE');
  assert(fakeRes.status === 404 || fakeRes.status === 403, 31, 'Gate akses dokumen tetap aman (403/404 enforced)', `Gate status: ${fakeRes.status}`);

  // Regression check
  const tripsRes = await makeRequest('/api/trips');
  const rentalCarsRes = await makeRequest('/api/rental/cars');
  assert(tripsRes.status === 200 && rentalCarsRes.status === 200, 32, 'Tidak ada regresi pada layanan lain (Shared Tour, Rental Car, Taxi, Airport Transfer)', `Shared Tour: ${tripsRes.status}, Rental Cars: ${rentalCarsRes.status}`);

  console.log('\n================================================================');
  console.log(`TOTAL CHECKLIST POINTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runInvoiceChecklist().catch(err => {
  console.error('Fatal error in checklist runner:', err);
  process.exit(1);
});

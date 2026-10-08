import http from 'http';

function makeRequest(options: http.RequestOptions, postData?: any): Promise<{ status: number; data: any; headers: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        let parsed = body;
        try { parsed = JSON.parse(body); } catch {}
        resolve({ status: res.statusCode || 0, data: parsed, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (postData) {
      const dataStr = typeof postData === 'string' ? postData : JSON.stringify(postData);
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(dataStr));
      req.write(dataStr);
    }
    req.end();
  });
}

async function run() {
  console.log('================================================================');
  console.log('🧪 VERIFYING FAQ & REVIEWS COMPREHENSIVE SUITE');
  console.log('================================================================\n');

  // 1. Health check
  const health = await makeRequest({ host: 'localhost', port: 3000, path: '/api/health', method: 'GET' });
  if (health.status !== 200) {
    throw new Error('Health check failed: ' + JSON.stringify(health.data));
  }
  console.log('✅ 1. Health Check PASSED: Database engine active.');

  // 2. Admin Login to get token for moderation and admin tests
  const adminLogin = await makeRequest({
    host: 'localhost',
    port: 3000,
    path: '/api/admin/login',
    method: 'POST'
  }, { email: process.env.ADMIN_EMAIL || 'admin@smartjourney.com', password: process.env.ADMIN_PASSWORD || 'admin123' });

  let adminToken = '';
  if (adminLogin.status === 200 && adminLogin.data?.token) {
    adminToken = adminLogin.data.token;
    console.log('✅ 2. Admin Login PASSED: Session active.');
  } else {
    // Attempt fallback or demo secret key
    adminToken = 'admin-test-token';
    console.log('⚠️ 2. Admin Login fallback used.');
  }

  // -------------------------------------------------------------
  // TEST SUITE A: OPEN TRIP REVIEW SUBMISSION & RESOLUTION
  // -------------------------------------------------------------
  console.log('\n--- SUITE A: Open Trip Review Submission ---');

  // Create an Open Trip test booking directly
  const openTripCode = `OT-TEST-${Date.now().toString().slice(-5)}`;
  const tripIdA = 'trip-p5b-1791025346210';
  const batchIdA = 'batch-test-p5b-1';
  
  // Directly insert a confirmed booking for Open Trip
  const createBookingRes = await makeRequest({
    host: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }, {
    id: `book-${Date.now()}-1`,
    bookingCode: openTripCode,
    serviceType: 'shared',
    serviceId: batchIdA, // Stored as batchId per original design!
    tripId: tripIdA,     // Canonical trip identity
    bookingType: 'shared',
    fullName: 'Budi Santoso',
    customerName: 'Budi Santoso',
    email: 'budi.santoso@example.com',
    phone: '081234567890',
    status: 'Confirmed',
    paymentStatus: 'Paid',
    details: {
      tripId: tripIdA,
      batchId: batchIdA,
      departureDate: '2026-11-20'
    }
  });

  console.log('   Open Trip test booking created:', openTripCode, 'Status:', createBookingRes.status);

  // Customer submits review for Open Trip passing serviceId = trip.id (TripDetail.tsx pattern)
  const submitOpenTripRev = await makeRequest({
    host: 'localhost',
    port: 3000,
    path: '/api/reviews',
    method: 'POST'
  }, {
    author: 'Budi Santoso',
    bookingCode: openTripCode,
    country: 'Indonesia',
    serviceType: 'sharetour',
    serviceId: tripIdA, // Trip ID from TripDetail.tsx!
    serviceName: 'Open Trip Ijen Blue Fire',
    rating: 5,
    content: 'Pengalaman open trip yang luar biasa seru dan tertata rapi!'
  });

  if (submitOpenTripRev.status === 201) {
    console.log('✅ A1. [PASS] Open Trip review successfully submitted with trip.id! (No false mismatch error).');
  } else {
    console.error('❌ A1. [FAIL] Open Trip review failed:', submitOpenTripRev.status, submitOpenTripRev.data);
    throw new Error('Open Trip review submission failed');
  }

  const openTripRevId = submitOpenTripRev.data.id;

  // -------------------------------------------------------------
  // TEST SUITE B: EVENT & GATHERING REVIEW SUBMISSION
  // -------------------------------------------------------------
  console.log('\n--- SUITE B: Event & Gathering Review Submission ---');

  const gatheringCode = `GAT-TEST-${Date.now().toString().slice(-5)}`;
  const quotationId = `quo-test-8899`;
  const packageIdA = `gp-bromo-2d1n`;

  // Create confirmed Gathering booking (stores serviceId = quotationId, details.packageId = packageId)
  await makeRequest({
    host: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }, {
    id: `book-${Date.now()}-2`,
    bookingCode: gatheringCode,
    serviceType: 'gathering',
    serviceId: quotationId, // Stored as quotation.id per approval flow!
    bookingType: 'gathering',
    fullName: 'Siti Rahma',
    customerName: 'Siti Rahma (PT Nusantara Tech)',
    email: 'siti@nusantaratech.com',
    phone: '081987654321',
    status: 'Confirmed',
    paymentStatus: 'Paid',
    details: {
      quotationId: quotationId,
      packageId: packageIdA, // Canonical package identity
      packageName: 'Bromo Corporate Gathering'
    }
  });

  console.log('   Gathering test booking created:', gatheringCode);

  // Customer submits review for Gathering passing serviceId = package.id (GatheringView.tsx pattern)
  const submitGatheringRev = await makeRequest({
    host: 'localhost',
    port: 3000,
    path: '/api/reviews',
    method: 'POST'
  }, {
    author: 'Siti Rahma',
    bookingCode: gatheringCode,
    country: 'Indonesia',
    serviceType: 'gathering',
    serviceId: packageIdA, // Package ID from GatheringView.tsx!
    serviceName: 'Bromo Corporate Gathering',
    rating: 5,
    content: 'Acara gathering perusahaan kami di Bromo berjalan sangat sukses!'
  });

  if (submitGatheringRev.status === 201) {
    console.log('✅ B1. [PASS] Gathering review successfully submitted with package.id! (No false mismatch error).');
  } else {
    console.error('❌ B1. [FAIL] Gathering review failed:', submitGatheringRev.status, submitGatheringRev.data);
    throw new Error('Gathering review submission failed');
  }

  // -------------------------------------------------------------
  // TEST SUITE C: SERVICE-ID SAFETY & OMISSION AUTO-DERIVATION
  // -------------------------------------------------------------
  console.log('\n--- SUITE C: Auto-Derivation of Omitted serviceId ---');

  const tourCodeC = `TR-TEST-${Date.now().toString().slice(-5)}`;
  const tourIdC = 'tour-bromo-sunrise-special';

  await makeRequest({
    host: 'localhost',
    port: 3000,
    path: '/api/bookings',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }, {
    id: `book-${Date.now()}-3`,
    bookingCode: tourCodeC,
    serviceType: 'tour',
    serviceId: tourIdC,
    bookingType: 'tour',
    fullName: 'Michael Tan',
    customerName: 'Michael Tan',
    email: 'michael.tan@example.com',
    phone: '08155555555',
    status: 'Confirmed',
    paymentStatus: 'Paid',
    details: {
      tourId: tourIdC
    }
  });

  // Submit review WITHOUT serviceId in payload
  const submitOmittedRev = await makeRequest({
    host: 'localhost',
    port: 3000,
    path: '/api/reviews',
    method: 'POST'
  }, {
    author: 'Michael Tan',
    bookingCode: tourCodeC,
    country: 'Singapore',
    serviceType: 'tour',
    // serviceId is intentionally omitted!
    serviceName: 'Bromo Sunrise Tour',
    rating: 5,
    content: 'Incredible sunrise view and punctual driver!'
  });

  if (submitOmittedRev.status === 201 && submitOmittedRev.data.serviceId === tourIdC) {
    console.log(`✅ C1. [PASS] Omitted serviceId automatically derived from verified booking: "${submitOmittedRev.data.serviceId}".`);
  } else {
    console.error('❌ C1. [FAIL] Omitted serviceId not properly derived:', submitOmittedRev.status, submitOmittedRev.data);
    throw new Error('Auto-derivation failed');
  }

  // -------------------------------------------------------------
  // TEST SUITE D: SECURITY & ABUSE GUARDS
  // -------------------------------------------------------------
  console.log('\n--- SUITE D: Security, Impersonation & Abuse Guards ---');

  // D1: Identity Hardening: Name mismatch
  const submitImpersonation = await makeRequest({
    host: 'localhost',
    port: 3000,
    path: '/api/reviews',
    method: 'POST'
  }, {
    author: 'Attacker John Doe', // Mismatched name!
    bookingCode: tourCodeC,
    country: 'USA',
    serviceType: 'tour',
    serviceId: tourIdC,
    rating: 1,
    content: 'Spam fake review using stolen code.'
  });

  if (submitImpersonation.status === 400 && submitImpersonation.data.error?.includes('tidak sesuai')) {
    console.log('✅ D1. [PASS] Stolen booking code with mismatched reviewer name strictly rejected with HTTP 400.');
  } else {
    console.error('❌ D1. [FAIL] Identity mismatch not rejected:', submitImpersonation.status, submitImpersonation.data);
    throw new Error('Identity hardening failed');
  }

  // D2: Wrong package / trip manipulation
  const submitWrongPkg = await makeRequest({
    host: 'localhost',
    port: 3000,
    path: '/api/reviews',
    method: 'POST'
  }, {
    author: 'Michael Tan',
    bookingCode: tourCodeC,
    country: 'Singapore',
    serviceType: 'tour',
    serviceId: 'malicious-different-tour-id', // Different tour!
    rating: 5,
    content: 'Review for wrong tour.'
  });

  if (submitWrongPkg.status === 400 && submitWrongPkg.data.error?.includes('berbeda')) {
    console.log('✅ D2. [PASS] Mismatched serviceId for another package strictly rejected.');
  } else {
    console.error('❌ D2. [FAIL] Mismatched serviceId was not rejected:', submitWrongPkg.status, submitWrongPkg.data);
    throw new Error('Wrong package protection failed');
  }

  // D3: Duplicate review prevention
  const submitDuplicate = await makeRequest({
    host: 'localhost',
    port: 3000,
    path: '/api/reviews',
    method: 'POST'
  }, {
    author: 'Michael Tan',
    bookingCode: tourCodeC,
    country: 'Singapore',
    serviceType: 'tour',
    serviceId: tourIdC,
    rating: 5,
    content: 'Duplicate review attempt.'
  });

  if (submitDuplicate.status === 400 && submitDuplicate.data.error?.includes('sudah pernah')) {
    console.log('✅ D3. [PASS] Duplicate review for same booking strictly rejected.');
  } else {
    console.error('❌ D3. [FAIL] Duplicate review was not rejected:', submitDuplicate.status, submitDuplicate.data);
    throw new Error('Duplicate review protection failed');
  }

  // D4: Public isolation & unapproved reviews privacy
  const publicReviews = await makeRequest({
    host: 'localhost',
    port: 3000,
    path: '/api/reviews',
    method: 'GET'
  });

  const isPendingExposed = Array.isArray(publicReviews.data) && publicReviews.data.some((r: any) => r.status === 'pending');
  if (!isPendingExposed) {
    console.log('✅ D4. [PASS] Public /api/reviews strictly hides pending reviews (Privacy enforced).');
  } else {
    console.error('❌ D4. [FAIL] Pending reviews exposed to unauthenticated public!');
    throw new Error('Public review privacy failed');
  }

  // -------------------------------------------------------------
  // TEST SUITE E: ADMIN MODERATION & LIVE APPROVAL
  // -------------------------------------------------------------
  console.log('\n--- SUITE E: Admin Moderation Lifecycle ---');

  // Unauthorized patch attempt
  const unauthPatch = await makeRequest({
    host: 'localhost',
    port: 3000,
    path: `/api/reviews/${openTripRevId}/status`,
    method: 'PATCH'
  }, { status: 'approved' });

  if (unauthPatch.status === 401 || unauthPatch.status === 403) {
    console.log('✅ E1. [PASS] Unauthorized review status moderation safely rejected with HTTP 401/403.');
  } else {
    console.error('❌ E1. [FAIL] Unauthorized patch was not rejected:', unauthPatch.status);
    throw new Error('RBAC check failed');
  }

  // -------------------------------------------------------------
  // TEST SUITE F: EVENT & GATHERING SEED FAQ
  // -------------------------------------------------------------
  console.log('\n--- SUITE F: Event & Gathering Seed FAQ ---');

  const { SEED_GATHERING_PACKAGES } = await import('../src/gathering/gatheringData.ts');
  const bromoSeed = SEED_GATHERING_PACKAGES.find(p => p.id === 'gp-bromo-2d1n');
  if (bromoSeed && Array.isArray(bromoSeed.faq) && bromoSeed.faq.length > 0) {
    console.log(`✅ F1. [PASS] Gathering SEED_GATHERING_PACKAGES has ${bromoSeed.faq.length} default FAQs.`);
  } else {
    console.error('❌ F1. [FAIL] Gathering seed FAQs missing!');
    throw new Error('Seed FAQ check failed');
  }

  console.log('\n================================================================');
  console.log('🎉 ALL FAQ & REVIEWS PARITY & SECURITY TESTS PASSED!');
  console.log('================================================================');
}

run().catch(err => {
  console.error('\n❌ TEST RUNNER ERROR:', err.message);
  process.exit(1);
});

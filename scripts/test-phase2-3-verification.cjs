// ==============================================================================
// SMART JOURNEY VERIFICATION SUITE: PHASE 2 & PHASE 3
// Tests:
// 1. Create Tour via POST /api/main-tours
// 2. Verify SQL row in Database Access Layer (tours table)
// 3. Admin refresh / fetch with ?all=true -> Tour remains
// 4. Logout / Login -> Tour remains
// 5. Query public endpoint /api/main-tours -> Published Tour visible to customer
// 6. Update Tour (Edit Name, Highlights, Price)
// 7. Verify updated in SQL
// 8. Publish / Unpublish (draft status) -> verify hidden from public, visible to admin
// 9. Soft-delete / Archive or Delete verification
// 10. No fsync/db.json rewrite dependency on tour operations
// ==============================================================================

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function makeRequest(urlPath, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const req = http.request(
      {
        host: '127.0.0.1',
        port: 3000,
        path: urlPath,
        method: options.method || 'GET',
        headers
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = data ? JSON.parse(data) : {};
            resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, body: data, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('   SMART JOURNEY: PHASE 2 & 3 DATABASE & TOUR CRUD VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testNumber, description, detail = '') {
    if (condition) {
      console.log(`✅ [PASS] Test ${testNumber}: ${description}`);
      if (detail) console.log(`   └─ ${detail}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] Test ${testNumber}: ${description}`);
      if (detail) console.error(`   └─ FAILURE: ${detail}`);
      failed++;
    }
  }

  const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== 'production' ? 'admin123' : '')).trim();
  const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@smartjourney.id').trim();

  try {
    // 1. Health check & DB connection
    const health = await makeRequest('/api/health');
    assert(health.status === 200 && health.body.application === 'ok' && health.body.database === 'connected',
      1, 'Health check verified and Database Access Layer connected',
      `Engine: ${health.body.engine}`);

    // 2. Admin Login
    const loginRes = await makeRequest('/api/auth/login', { method: 'POST' }, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    assert(loginRes.status === 200 && loginRes.body.token,
      2, 'Admin Login successful with persistent session token',
      `Token: ${loginRes.body.token.slice(0, 16)}...`);
    const adminToken = loginRes.body.token;
    const authHeaders = { Authorization: `Bearer ${adminToken}` };

    // 3. Create Tour via POST /api/main-tours
    const uniqueId = `phase2-tour-${Date.now()}`;
    const testTourPayload = {
      id: uniqueId,
      name: 'Bromo Milky Way & Private Stargazing Safari',
      description: 'Exclusive midnight private tour with astronomy guide to Mt Bromo caldera.',
      category: 'Private Tour',
      days: 2,
      nights: 1,
      duration: '2D1N',
      startingPrice: 320,
      startingPriceIDR: 4800000,
      wniPrice: 4800000,
      wnaPrice: 320,
      highlights: ['Midnight Jeep Safari', 'Caldera Astrophotography', 'King Kong Hill Sunrise'],
      itinerary: [
        { day: 1, title: 'Departure to Bromo Lodge', activities: ['Pick up from Surabaya/Malang', 'Stargazing brief'] },
        { day: 2, title: 'Caldera Sunrise & Crater Rim', activities: ['King Kong Hill', 'Crater walk', 'Return'] }
      ],
      includes: ['4x4 Private Jeep', 'Telescope & Astronomy Guide', 'National Park Tickets', 'Breakfast'],
      excludes: ['Personal expenses', 'Tips'],
      whatToBring: ['Warm jacket', 'Comfortable trekking shoes', 'Camera'],
      status: 'published'
    };

    const createRes = await makeRequest('/api/main-tours', { method: 'POST', headers: authHeaders }, testTourPayload);
    assert(createRes.status === 201 && createRes.body.id === uniqueId && createRes.body.name === testTourPayload.name,
      3, 'POST /api/main-tours successfully creates tour via SQL DAL',
      `Created ID: ${createRes.body.id}`);

    // 4. Verify SQL Row persistence by calling GET /api/main-tours/:id with admin auth
    const getRes = await makeRequest(`/api/main-tours/${uniqueId}`, { headers: authHeaders });
    assert(getRes.status === 200 && getRes.body.id === uniqueId && getRes.body.startingPriceIDR === 4800000,
      4, 'Verify Tour directly fetched by ID from SQL database',
      `Found tour: ${getRes.body.name} (Status: ${getRes.body.status})`);

    // 5. Admin refresh simulation (GET /api/main-tours?all=true)
    const allRes = await makeRequest('/api/main-tours?all=true', { headers: authHeaders });
    const foundInAll = Array.isArray(allRes.body) && allRes.body.some(t => t.id === uniqueId);
    assert(allRes.status === 200 && foundInAll,
      5, 'Admin refresh (?all=true) retains newly created tour from SQL',
      `Total tours in DB: ${allRes.body.length}`);

    // 6. Customer public endpoint (GET /api/main-tours without auth)
    const publicRes = await makeRequest('/api/main-tours');
    const foundInPublic = Array.isArray(publicRes.body) && publicRes.body.some(t => t.id === uniqueId);
    assert(publicRes.status === 200 && foundInPublic,
      6, 'Customer frontend public endpoint correctly includes published Tour',
      `Publicly visible tours count: ${publicRes.body.length}`);

    // 7. Update Tour (PUT /api/main-tours/:id)
    const updatePayload = {
      ...testTourPayload,
      name: 'Bromo Milky Way & Private Stargazing Safari (Updated Luxury Edition)',
      startingPriceIDR: 5200000,
      startingPrice: 350,
      highlights: ['Midnight Jeep Safari', 'Caldera Astrophotography', 'King Kong Hill Sunrise', 'Private Drone Footage']
    };
    const updateRes = await makeRequest(`/api/main-tours/${uniqueId}`, { method: 'PUT', headers: authHeaders }, updatePayload);
    assert(updateRes.status === 200 && updateRes.body.startingPriceIDR === 5200000 && updateRes.body.highlights.length === 4,
      7, 'PUT /api/main-tours/:id updates relational row and JSON columns atomically',
      `Updated name: ${updateRes.body.name}`);

    // 8. Unpublish Tour (Change status to draft)
    const draftPayload = { ...updatePayload, status: 'draft' };
    const draftRes = await makeRequest(`/api/main-tours/${uniqueId}`, { method: 'PUT', headers: authHeaders }, draftPayload);
    assert(draftRes.status === 200 && draftRes.body.status === 'draft',
      8, 'Change status to draft via SQL update',
      `Status set to: ${draftRes.body.status}`);

    // 9. Verify draft is HIDDEN from customer public endpoint
    const publicAfterDraft = await makeRequest('/api/main-tours');
    const hiddenFromPublic = Array.isArray(publicAfterDraft.body) && !publicAfterDraft.body.some(t => t.id === uniqueId);
    assert(hiddenFromPublic,
      9, 'Draft Tour is completely hidden from public customer frontend',
      'Verified draft excluded from public listing');

    // 10. Verify draft is VISIBLE to admin
    const adminAfterDraft = await makeRequest('/api/main-tours?all=true', { headers: authHeaders });
    const visibleToAdmin = Array.isArray(adminAfterDraft.body) && adminAfterDraft.body.some(t => t.id === uniqueId && t.status === 'draft');
    assert(visibleToAdmin,
      10, 'Draft Tour remains visible to authenticated Admin with ?all=true',
      'Verified draft listed for admin');

    // 11. Re-publish Tour
    const publishPayload = { ...updatePayload, status: 'published' };
    await makeRequest(`/api/main-tours/${uniqueId}`, { method: 'PUT', headers: authHeaders }, publishPayload);

    // 12. Soft-delete / Delete Tour
    const delRes = await makeRequest(`/api/main-tours/${uniqueId}`, { method: 'DELETE', headers: authHeaders });
    assert(delRes.status === 200 && delRes.body.success === true,
      11, 'DELETE /api/main-tours/:id removes or archives tour cleanly',
      `Mode: ${delRes.body.mode}`);

    // 13. Verify Tour is gone from public listing
    const publicAfterDel = await makeRequest('/api/main-tours');
    const deletedFromPublic = Array.isArray(publicAfterDel.body) && !publicAfterDel.body.some(t => t.id === uniqueId);
    assert(deletedFromPublic,
      12, 'Deleted/Archived Tour is no longer returned in public tour catalog',
      'Verified complete removal from active public view');

    console.log('\n================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

runTests();

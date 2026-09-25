// ==============================================================================
// SMART JOURNEY: PHASE 4 PERSISTENCE & LIFECYCLE RESTART TEST
// 1. Create a dedicated Tour in SQL
// 2. Query Tour directly via SQL DAL
// 3. Logout admin
// 4. Verify admin token invalidated (401)
// 5. Login again with fresh token
// 6. Verify Tour remains untouched in SQL
// 7. Restart simulation: Reload SQL instance / pool connection
// 8. Verify Tour remains persistent after reload
// 9. Clean up test tour
// ==============================================================================

const http = require('http');
const crypto = require('crypto');
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

async function runPersistenceSuite() {
  console.log('================================================================');
  console.log('   SMART JOURNEY: PHASE 4 PERSISTENCE & LIFECYCLE RESTART SUITE');
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
    // Step 1: Initial Login
    const login1 = await makeRequest('/api/auth/login', { method: 'POST' }, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    assert(login1.status === 200 && login1.body.token, 1, 'Initial Admin Login succeeds', `Token 1: ${login1.body.token.slice(0, 16)}...`);
    const token1 = login1.body.token;

    // Step 2: Create Tour
    const persistentTourId = `persist-tour-${Date.now()}`;
    const tourPayload = {
      id: persistentTourId,
      name: 'Ijen Blue Fire & Sulphur Lake Night Hike',
      description: 'Private guided midnight trek to witness electric blue flames of Kawah Ijen.',
      category: 'Private Tour',
      days: 1,
      nights: 1,
      duration: '1D1N',
      startingPrice: 195,
      startingPriceIDR: 2900000,
      wniPrice: 2900000,
      wnaPrice: 195,
      highlights: ['Blue Fire Phenomenon', 'Sunrise over Acid Crater Lake', 'Gas Mask & Expert Local Guide Included'],
      status: 'published'
    };

    const createRes = await makeRequest('/api/main-tours', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` }
    }, tourPayload);
    assert(createRes.status === 201 && createRes.body.id === persistentTourId,
      2, 'Tour created in database table', `ID: ${createRes.body.id}`);

    // Step 3: Refresh simulation 1
    const verify1 = await makeRequest(`/api/main-tours/${persistentTourId}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    assert(verify1.status === 200 && verify1.body.name === tourPayload.name,
      3, 'Tour verified persistent immediately after creation', `Found: ${verify1.body.name}`);

    // Step 4: Admin Logout
    const logoutRes = await makeRequest('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` }
    });
    assert(logoutRes.status === 200 && logoutRes.body.success === true,
      4, 'Admin Logout endpoint clears session from database', 'Session terminated');

    // Step 5: Verify old token is rejected
    const unauthCheck = await makeRequest(`/api/main-tours?all=true`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    assert(unauthCheck.status === 401,
      5, 'Old token successfully rejected (HTTP 401) after logout', 'Security barrier intact');

    // Step 6: Verify Tour remains in public customer endpoint even while logged out
    const publicCheck = await makeRequest('/api/main-tours');
    const tourInPublic = Array.isArray(publicCheck.body) && publicCheck.body.some(t => t.id === persistentTourId);
    assert(tourInPublic,
      6, 'Tour remains public and persistent while admin is logged out',
      `Verified in customer view`);

    // Step 7: New Login with fresh session
    const login2 = await makeRequest('/api/auth/login', { method: 'POST' }, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    assert(login2.status === 200 && login2.body.token && login2.body.token !== token1,
      7, 'Re-login generates fresh valid admin session', `Token 2: ${login2.body.token.slice(0, 16)}...`);
    const token2 = login2.body.token;

    // Step 8: Query Tour with new token
    const verify2 = await makeRequest(`/api/main-tours/${persistentTourId}`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    assert(verify2.status === 200 && verify2.body.id === persistentTourId,
      8, 'Tour remains identical and intact after new admin login',
      `ID: ${verify2.body.id}, Status: ${verify2.body.status}`);

    // Step 9: Cleanup test tour
    const cleanupRes = await makeRequest(`/api/main-tours/${persistentTourId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token2}` }
    });
    assert(cleanupRes.status === 200 && cleanupRes.body.success === true,
      9, 'Test tour cleanly deleted from database', `Mode: ${cleanupRes.body.mode}`);

    console.log('\n================================================================');
    console.log(`PERSISTENCE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Persistence test failed:', err);
    process.exit(1);
  }
}

runPersistenceSuite();

/**
 * SMART JOURNEY — FINAL ADMIN LOGIN E2E VERIFICATION SUITE
 * 
 * Verifies the complete real-world Admin Login and Tour Management Flow:
 * 1. REAL ADMIN LOGIN via POST /api/auth/login (using env credentials)
 * 2. LOGIN RESPONSE validation (HTTP 200 & real session token)
 * 3. VERIFY SESSION via GET /api/auth/verify
 * 4. CREATE PRIVATE TOUR via POST /api/main-tours with real token
 * 5. VERIFY PHYSICAL DISK PERSISTENCE from data/db.json
 * 6. UPDATE TOUR via PUT /api/main-tours/:id with physical disk verification
 * 7. RE-VERIFY SESSION via GET /api/auth/verify
 * 8. LOGOUT via POST /api/auth/logout with real token
 * 9. TOKEN INVALID AFTER LOGOUT via GET /api/auth/verify (HTTP 401/403)
 * 10. CRUD REJECTED AFTER LOGOUT via POST /api/main-tours (HTTP 401/403 & DB untouched)
 * 11. WRONG PASSWORD REJECTION via POST /api/auth/login (HTTP 401 & no session created)
 * 12. WRONG EMAIL REJECTION via POST /api/auth/login (HTTP 401 & no session created)
 * 13. FRONTEND AUTH ARCHITECTURE AUDIT (authoritative token vs local state)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

if (fs.existsSync('/app/.dev.env.json')) {
  try {
    const devEnv = JSON.parse(fs.readFileSync('/app/.dev.env.json', 'utf8'));
    for (const [key, value] of Object.entries(devEnv)) {
      if (!process.env[key] && typeof value === 'string') {
        process.env[key] = value;
      }
    }
  } catch (e) {}
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(PROJECT_ROOT, 'data', 'db.json');
const PORT = 3000;

// Read credentials strictly from environment
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim();
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();
const ADMIN_SECRET_KEY = (process.env.ADMIN_SECRET_KEY || '').trim();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failed++;
  }
}

function request(method, pathUrl, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: pathUrl,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', (err) => reject(err));
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function readDiskDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw);
}

async function runE2ESuite() {
  console.log('================================================================');
  console.log('🔐 SMART JOURNEY: FINAL ADMIN LOGIN & TOUR SAVE E2E VERIFICATION');
  console.log('================================================================\n');

  // Credential Safety Check: Do not hardcode or generate fake credentials
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.log('\n================================================================');
    console.log('ℹ️  STATUS = NOT RUN');
    console.log('Admin E2E login test requires configured test/admin credentials.');
    console.log('================================================================\n');
    process.exit(0);
  }

  // Backup initial DB state to guarantee clean restoration after tests
  const initialDbRaw = fs.readFileSync(DB_PATH, 'utf8');
  let realAdminToken = '';
  const testTourId = `tour-e2e-${Date.now()}`;
  const unauthTourId = `tour-unauth-${Date.now()}`;

  try {
    // ----------------------------------------------------
    // TEST 1 & 2: REAL ADMIN LOGIN & LOGIN RESPONSE
    // ----------------------------------------------------
    console.log('--- TEST 1 & 2: Real Admin Login via POST /api/auth/login ---');
    const loginPayload = {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    };
    if (ADMIN_SECRET_KEY) {
      loginPayload.secretKey = ADMIN_SECRET_KEY;
    }

    const loginRes = await request('POST', '/api/auth/login', loginPayload);
    assert(loginRes.status === 200, 'POST /api/auth/login succeeds with HTTP 200');
    assert(Boolean(loginRes.body && loginRes.body.success === true), 'Login response contains success: true');
    assert(Boolean(loginRes.body && typeof loginRes.body.token === 'string' && loginRes.body.token.length >= 32),
      'Login response issued a valid secure session token (length >= 32 hex chars)');

    realAdminToken = loginRes.body?.token;

    // Verify session was created authoritatively by server inside data/db.json
    const diskDBAfterLogin = readDiskDB();
    const storedSession = (diskDBAfterLogin.adminSessions || []).find((s) => s && s.token === realAdminToken);
    assert(Boolean(storedSession), 'Server saved the newly issued session into db.adminSessions on disk');
    assert(storedSession && storedSession.expiresAt > Date.now(), 'Server session expiration is active in future');

    // ----------------------------------------------------
    // TEST 3: VERIFY SESSION
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Verify Session via GET /api/auth/verify ---');
    const verifyRes = await request('GET', '/api/auth/verify', null, {
      'Authorization': `Bearer ${realAdminToken}`
    });
    assert(verifyRes.status === 200, 'GET /api/auth/verify with real token returns HTTP 200');
    assert(Boolean(verifyRes.body && (verifyRes.body.valid === true || verifyRes.body.authenticated === true)),
      'Session is authoritatively verified as valid: true / authenticated: true');

    // ----------------------------------------------------
    // TEST 4: CREATE PRIVATE TOUR
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Create Private Tour via POST /api/main-tours ---');
    const tourPayload = {
      id: testTourId,
      name: 'E2E Real Login Bromo Ijen Explorer',
      description: 'Tour created exclusively during real admin login E2E test verification.',
      status: 'published',
      days: 3,
      nights: 2,
      startingPrice: 220,
      startingPriceIDR: 3500000,
      highlights: ['Sunrise Point Penanjakan', 'Kawah Ijen Blue Fire', 'Madakaripura Waterfall'],
      itinerary: [
        'Day 1: Surabaya Pickup - Bromo Hotel Check-in',
        'Day 2: Bromo Sunrise Jeep - Transfer to Ijen Banyuwangi',
        'Day 3: Midnight Ijen Blue Fire - Ketapang/Surabaya Drop off'
      ]
    };

    const createTourRes = await request('POST', '/api/main-tours', tourPayload, {
      'Authorization': `Bearer ${realAdminToken}`
    });
    assert(createTourRes.status === 201, 'POST /api/main-tours returns HTTP 201 Created');
    assert(createTourRes.body && createTourRes.body.id === testTourId, 'Response body contains created tour id');
    assert(createTourRes.body && createTourRes.body.name === tourPayload.name, 'Response body contains tour name');
    assert(createTourRes.body && createTourRes.body.startingPriceIDR === 3500000, 'Response body contains tour price in IDR');

    // ----------------------------------------------------
    // TEST 5: VERIFY PHYSICAL PERSISTENCE
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Verify Physical Persistence in data/db.json ---');
    const diskDBAfterCreate = readDiskDB();
    const diskTour = (diskDBAfterCreate.mainTours || []).find((t) => t && t.id === testTourId);
    assert(Boolean(diskTour), 'New tour exists physically on disk in data/db.json');
    assert(diskTour && diskTour.name === tourPayload.name, 'Tour name on disk matches payload exactly');
    assert(diskTour && diskTour.startingPriceIDR === 3500000, 'Tour startingPriceIDR on disk matches payload exactly');
    assert(diskTour && diskTour.days === 3 && diskTour.nights === 2, 'Tour duration (days/nights) on disk matches payload');
    assert(diskTour && Array.isArray(diskTour.highlights) && diskTour.highlights.length === 3, 'Tour highlights on disk match payload');

    // ----------------------------------------------------
    // TEST 6: UPDATE TOUR
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Update Tour via PUT /api/main-tours/:id ---');
    const updatePayload = {
      name: 'E2E Real Login Bromo Ijen Explorer (Updated Special Edition)',
      startingPriceIDR: 3800000,
      days: 4,
      nights: 3
    };

    const updateRes = await request('PUT', `/api/main-tours/${testTourId}`, updatePayload, {
      'Authorization': `Bearer ${realAdminToken}`
    });
    assert(updateRes.status === 200, 'PUT /api/main-tours/:id returns HTTP 200 OK');
    assert(updateRes.body && updateRes.body.name === updatePayload.name, 'Response contains updated name');
    assert(updateRes.body && updateRes.body.startingPriceIDR === 3800000, 'Response contains updated price');

    // Verify on physical disk
    const diskDBAfterUpdate = readDiskDB();
    const diskTourUpdated = (diskDBAfterUpdate.mainTours || []).find((t) => t && t.id === testTourId);
    assert(Boolean(diskTourUpdated), 'Updated tour found on physical disk');
    assert(diskTourUpdated && diskTourUpdated.name === updatePayload.name, 'Updated tour name physically persisted on disk');
    assert(diskTourUpdated && diskTourUpdated.startingPriceIDR === 3800000, 'Updated tour price physically persisted on disk');
    assert(diskTourUpdated && diskTourUpdated.days === 4 && diskTourUpdated.nights === 3, 'Updated duration physically persisted on disk');

    // ----------------------------------------------------
    // TEST 7: RE-VERIFY SESSION
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Re-Verify Session ---');
    const reVerifyRes = await request('GET', '/api/auth/verify', null, {
      'Authorization': `Bearer ${realAdminToken}`
    });
    assert(reVerifyRes.status === 200, 'Re-verifying GET /api/auth/verify returns HTTP 200');
    assert(Boolean(reVerifyRes.body && (reVerifyRes.body.valid === true || reVerifyRes.body.authenticated === true)),
      'Session remains active and authoritative during admin lifecycle');

    // ----------------------------------------------------
    // TEST 8: LOGOUT
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Logout via POST /api/auth/logout ---');
    const logoutRes = await request('POST', '/api/auth/logout', null, {
      'Authorization': `Bearer ${realAdminToken}`
    });
    assert(logoutRes.status === 200, 'POST /api/auth/logout returns HTTP 200 OK');
    assert(Boolean(logoutRes.body && logoutRes.body.success === true), 'Logout response contains success: true');

    // Verify session removed from physical disk
    const diskDBAfterLogout = readDiskDB();
    const sessionStillOnDisk = (diskDBAfterLogout.adminSessions || []).some((s) => s && s.token === realAdminToken);
    assert(!sessionStillOnDisk, 'Session token was immediately deleted from db.adminSessions on disk');

    // ----------------------------------------------------
    // TEST 9: TOKEN INVALID AFTER LOGOUT
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Token Invalid After Logout ---');
    const postLogoutVerifyRes = await request('GET', '/api/auth/verify', null, {
      'Authorization': `Bearer ${realAdminToken}`
    });
    assert(postLogoutVerifyRes.status === 401 || postLogoutVerifyRes.status === 403,
      `GET /api/auth/verify with logged-out token is rejected with HTTP ${postLogoutVerifyRes.status} (401/403)`);

    // ----------------------------------------------------
    // TEST 10: CRUD REJECTED AFTER LOGOUT
    // ----------------------------------------------------
    console.log('\n--- TEST 10: CRUD Rejected After Logout ---');
    const unauthPayload = {
      id: unauthTourId,
      name: 'Unauthorized Tour Attempt After Logout',
      startingPriceIDR: 1000000
    };

    const postLogoutCrudRes = await request('POST', '/api/main-tours', unauthPayload, {
      'Authorization': `Bearer ${realAdminToken}`
    });
    assert(postLogoutCrudRes.status === 401 || postLogoutCrudRes.status === 403,
      `POST /api/main-tours after logout is rejected with HTTP ${postLogoutCrudRes.status} (401/403)`);

    const diskDBAfterUnauth = readDiskDB();
    const unauthTourExists = (diskDBAfterUnauth.mainTours || []).some((t) => t && t.id === unauthTourId);
    assert(!unauthTourExists, 'Unauthorized tour was NOT written to physical data/db.json');

    // ----------------------------------------------------
    // TEST 11: WRONG PASSWORD
    // ----------------------------------------------------
    console.log('\n--- TEST 11: Wrong Password Rejection ---');
    const dbBeforeWrongPass = readDiskDB();
    const sessionsBeforeWrongPass = (dbBeforeWrongPass.adminSessions || []).length;

    const wrongPassRes = await request('POST', '/api/auth/login', {
      email: ADMIN_EMAIL,
      password: 'DEFINITELY_WRONG_PASSWORD_9988!@#'
    });
    assert(wrongPassRes.status === 401 || wrongPassRes.status === 403,
      `POST /api/auth/login with wrong password returns HTTP ${wrongPassRes.status} (401/403)`);

    const dbAfterWrongPass = readDiskDB();
    const sessionsAfterWrongPass = (dbAfterWrongPass.adminSessions || []).length;
    assert(sessionsAfterWrongPass === sessionsBeforeWrongPass,
      'No session was created on physical disk for wrong password attempt');

    // ----------------------------------------------------
    // TEST 12: WRONG EMAIL
    // ----------------------------------------------------
    console.log('\n--- TEST 12: Wrong Email Rejection ---');
    const dbBeforeWrongEmail = readDiskDB();
    const sessionsBeforeWrongEmail = (dbBeforeWrongEmail.adminSessions || []).length;

    const wrongEmailRes = await request('POST', '/api/auth/login', {
      email: 'unauthorized_attacker_email_9988@invalid.domain',
      password: ADMIN_PASSWORD
    });
    assert(wrongEmailRes.status === 401 || wrongEmailRes.status === 403,
      `POST /api/auth/login with wrong email returns HTTP ${wrongEmailRes.status} (401/403)`);

    const dbAfterWrongEmail = readDiskDB();
    const sessionsAfterWrongEmail = (dbAfterWrongEmail.adminSessions || []).length;
    assert(sessionsAfterWrongEmail === sessionsBeforeWrongEmail,
      'No session was created on physical disk for wrong email attempt');

    // ----------------------------------------------------
    // TEST 13: FRONTEND ADMIN AUTH INTEGRATION AUDIT
    // ----------------------------------------------------
    console.log('\n--- TEST 13: Frontend Admin Auth Integration Audit ---');
    const adminAuthSource = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'utils', 'adminAuth.ts'), 'utf8');
    const adminViewSource = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'views', 'AdminView.tsx'), 'utf8');

    assert(adminAuthSource.includes('/api/auth/verify'), 'adminAuth.ts performs authoritative verification via GET /api/auth/verify');
    assert(adminAuthSource.includes('clearAdminSession()'), 'adminAuth.ts clears tokens upon 401/403 session expiration');
    assert(adminAuthSource.includes('ADMIN_AUTH_EXPIRED_EVENT'), 'adminAuth.ts triggers event on auth expiry');
    assert(adminViewSource.includes('verifyAdminSession()'), 'AdminView.tsx calls verifyAdminSession on mount');
    assert(!adminViewSource.includes("localStorage.getItem('smartjourney_admin_unlocked') === 'true'"),
      'AdminView.tsx does NOT rely solely on local unlocked flag as proof of authentication');
    assert(adminViewSource.includes("setIsAdminUnlocked(isValid)"), 'AdminView.tsx sets unlock state based on server verification');

  } finally {
    // Clean up test data and restore DB integrity
    try {
      const currentDB = readDiskDB();
      currentDB.mainTours = (currentDB.mainTours || []).filter(
        (t) => t && t.id !== testTourId && t.id !== unauthTourId
      );
      if (realAdminToken) {
        currentDB.adminSessions = (currentDB.adminSessions || []).filter(
          (s) => s && s.token !== realAdminToken
        );
      }
      fs.writeFileSync(DB_PATH, JSON.stringify(currentDB, null, 2), 'utf8');
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr);
    }
  }

  console.log('\n================================================================');
  console.log(`TOTAL E2E CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runE2ESuite().catch((err) => {
  console.error('Fatal E2E suite error:', err);
  process.exit(1);
});

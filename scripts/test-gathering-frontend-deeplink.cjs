const http = require('http');
const assert = require('assert');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          parsed = body;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

let passCount = 0;
let failCount = 0;

function assertTest(name, condition, errorMsg = '') {
  if (condition) {
    console.log(`✅ [PASS] ${name}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${name}: ${errorMsg}`);
    failCount++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🎯  EVENT & GATHERING FRONT-END & DEEP-LINK TEST SUITE');
  console.log('================================================================\n');

  // 1. Direct URL: /event-gathering/bromo-gathering-2d1n
  console.log('--- 1. Direct URL Routing & SPA HTML Server Serving ---');
  const directHtmlRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/event-gathering/bromo-gathering-2d1n',
    method: 'GET'
  });
  assertTest(
    'Direct URL GET /event-gathering/bromo-gathering-2d1n responds 200 OK',
    directHtmlRes.status === 200
  );
  assertTest(
    'Direct URL returns HTML entry point with #root and scripts',
    typeof directHtmlRes.body === 'string' && directHtmlRes.body.includes('<div id="root"></div>')
  );

  // 2. Direct URL: /event-gathering (Catalog)
  const catalogHtmlRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/event-gathering',
    method: 'GET'
  });
  assertTest(
    'Direct URL GET /event-gathering responds 200 OK',
    catalogHtmlRes.status === 200
  );

  // 3. API: GET /api/gathering/packages/bromo-gathering-2d1n (by slug)
  console.log('\n--- 2. Package Detail API Resolution by Slug ---');
  const slugApiRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/gathering/packages/bromo-gathering-2d1n',
    method: 'GET'
  });
  assertTest('API GET /api/gathering/packages/bromo-gathering-2d1n responds 200', slugApiRes.status === 200);
  const pkg = slugApiRes.body;
  assertTest('Package has valid ID', pkg && (pkg.id === 'pkg-bromo-gathering-2d1n' || pkg.slug === 'bromo-gathering-2d1n'));
  assertTest('Package has title/name', Boolean(pkg && (pkg.title || pkg.name)));
  assertTest('Package has destination', Boolean(pkg && pkg.destination));
  assertTest('Package has duration', Boolean(pkg && pkg.duration));
  assertTest('Package has description', Boolean(pkg && pkg.description));
  assertTest('Package has itinerary array with days & activities', Array.isArray(pkg && pkg.itinerary) && pkg.itinerary.length > 0);
  assertTest('Package has includes/included', Array.isArray(pkg && (pkg.includes || pkg.included)));
  assertTest('Package has excludes/excluded', Array.isArray(pkg && (pkg.excludes || pkg.excluded)));
  assertTest('Package has facilities list', Array.isArray(pkg && pkg.facilities));
  assertTest('Package has notes', Boolean(pkg && pkg.notes));
  assertTest(
    'Package has estimated prices for 60, 70, 80, 90 Pax',
    Boolean(
      pkg &&
      (pkg.estimatedPrices?.pax60 || pkg.price60Pax) &&
      (pkg.estimatedPrices?.pax70 || pkg.price70Pax) &&
      (pkg.estimatedPrices?.pax80 || pkg.price80Pax) &&
      (pkg.estimatedPrices?.pax90 || pkg.price90Pax)
    )
  );
  assertTest(
    'Package has 90+ Pax note/contact admin',
    Boolean(pkg && (pkg.estimatedPrices?.pax90PlusNote || pkg.price90PlusText))
  );

  // 4. API: GET /api/gathering/packages/pkg-bromo-gathering-2d1n (by ID)
  console.log('\n--- 3. Package Detail API Resolution by ID ---');
  const idApiRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/gathering/packages/pkg-bromo-gathering-2d1n',
    method: 'GET'
  });
  assertTest('API GET /api/gathering/packages/pkg-bromo-gathering-2d1n responds 200', idApiRes.status === 200);
  assertTest('Returns matching package by ID', idApiRes.body && idApiRes.body.id === 'pkg-bromo-gathering-2d1n');

  // 5. API: GET non-existent package
  console.log('\n--- 4. Non-Existent Package 404 Safety ---');
  const notFoundRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/gathering/packages/unknown-package-slug-xyz-999',
    method: 'GET'
  });
  assertTest('API returns 404 for non-existent package', notFoundRes.status === 404);

  // 6. Direct URL for non-existent package serves HTML (client will render clean Not Found UI without white screen)
  const notFoundHtmlRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/event-gathering/unknown-package-slug-xyz-999',
    method: 'GET'
  });
  assertTest('Server serves index.html on arbitrary gathering slug for client SPA handling', notFoundHtmlRes.status === 200);

  // 7. Regression Testing Locked Services
  console.log('\n--- 5. Regression Check for Locked Services ---');
  const toursRes = await request({ hostname: 'localhost', port: 3000, path: '/api/main-tours', method: 'GET' });
  assertTest('Regression: Private Tours /api/main-tours responds 200', toursRes.status === 200);

  const batchesRes = await request({ hostname: 'localhost', port: 3000, path: '/api/batches', method: 'GET' });
  assertTest('Regression: Open Trips /api/batches responds 200', batchesRes.status === 200);

  const airportsRes = await request({ hostname: 'localhost', port: 3000, path: '/api/airports', method: 'GET' });
  assertTest('Regression: Airport Transfers /api/airports responds 200', airportsRes.status === 200);

  const taxiRes = await request({ hostname: 'localhost', port: 3000, path: '/api/taxi', method: 'GET' });
  assertTest('Regression: Taxi /api/taxi responds 200', taxiRes.status === 200);

  const rentalsRes = await request({ hostname: 'localhost', port: 3000, path: '/api/rentals', method: 'GET' });
  assertTest('Regression: Car Rental /api/rentals responds 200', rentalsRes.status === 200);

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log('================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

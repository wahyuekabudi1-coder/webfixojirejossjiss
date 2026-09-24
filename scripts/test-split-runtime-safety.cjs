// =================================================================
// RUNTIME SAFETY TEST SUITE: .split() OF UNDEFINED / NULL DEFENSE
// =================================================================

const assert = require("assert");
const fs = require("fs");
const path = require("path");

console.log("=================================================================");
console.log("🛡️  VERIFYING FRONTEND RUNTIME SAFETY FOR .split() INVOCATIONS");
console.log("=================================================================");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// Test Case 1: Duration formatting logic (as used in HomeView & ToursView)
// Expression: (tour.duration ? tour.duration.split('(')[0].trim() : '')
// -------------------------------------------------------------
function formatDuration(duration) {
  return duration ? duration.split('(')[0].trim() : '';
}

test("Valid duration '3D2N' formats correctly", () => {
  const result = formatDuration("3D2N");
  assert.strictEqual(result, "3D2N");
});

test("Valid duration with parentheses '3 Hari 2 Malam (3D2N)' strips parentheses", () => {
  const result = formatDuration("3 Hari 2 Malam (3D2N)");
  assert.strictEqual(result, "3 Hari 2 Malam");
});

test("Undefined duration does NOT crash and returns empty string", () => {
  const result = formatDuration(undefined);
  assert.strictEqual(result, "");
});

test("Null duration does NOT crash and returns empty string", () => {
  const result = formatDuration(null);
  assert.strictEqual(result, "");
});

test("Empty string duration does NOT crash and returns empty string", () => {
  const result = formatDuration("");
  assert.strictEqual(result, "");
});

test("Missing property duration does NOT crash", () => {
  const tour = { id: "tour-archived-security-test", name: "Archived Tour" };
  const result = formatDuration(tour.duration);
  assert.strictEqual(result, "");
});

// -------------------------------------------------------------
// Test Case 2: Location splitting logic (as used in TripListing)
// Expression: (t(trip.location || "") || "").split(",")[0]
// -------------------------------------------------------------
function formatLocation(location) {
  // mock translation fallback
  const translated = location || "";
  return (translated || "").split(",")[0];
}

test("Valid location 'Malang, Jawa Timur' extracts city 'Malang'", () => {
  const result = formatLocation("Malang, Jawa Timur");
  assert.strictEqual(result, "Malang");
});

test("Undefined location does NOT crash and returns empty string", () => {
  const result = formatLocation(undefined);
  assert.strictEqual(result, "");
});

test("Null location does NOT crash and returns empty string", () => {
  const result = formatLocation(null);
  assert.strictEqual(result, "");
});

test("Empty string location does NOT crash", () => {
  const result = formatLocation("");
  assert.strictEqual(result, "");
});

// -------------------------------------------------------------
// Test Case 3: City name splitting in ServiceAreaMap
// Expression: (city.name || '').split(' ')[0]
// -------------------------------------------------------------
function formatCityName(city) {
  return (city.name || '').split(' ')[0];
}

test("Valid city name 'Surabaya Kota' extracts 'Surabaya'", () => {
  const result = formatCityName({ name: "Surabaya Kota" });
  assert.strictEqual(result, "Surabaya");
});

test("Undefined city name does NOT crash and returns empty string", () => {
  const result = formatCityName({ name: undefined });
  assert.strictEqual(result, "");
});

test("Null city name does NOT crash and returns empty string", () => {
  const result = formatCityName({ name: null });
  assert.strictEqual(result, "");
});

// -------------------------------------------------------------
// Test Case 4: Airport name splitting in AirportTransferView
// Expression: airportNames[code] ? (airportNames[code] || '').split(' (')[0] : `${code} Airport`
// -------------------------------------------------------------
function formatAirport(airportNames, code) {
  return airportNames[code] ? (airportNames[code] || '').split(' (')[0] : `${code} Airport`;
}

test("Valid airport name 'Juanda International Airport (SUB)' extracts airport", () => {
  const result = formatAirport({ SUB: "Juanda International Airport (SUB)" }, "SUB");
  assert.strictEqual(result, "Juanda International Airport");
});

test("Missing airport name falls back to code Airport", () => {
  const result = formatAirport({}, "SUB");
  assert.strictEqual(result, "SUB Airport");
});

test("Undefined airport name entry does NOT crash", () => {
  const result = formatAirport({ SUB: undefined }, "SUB");
  assert.strictEqual(result, "SUB Airport");
});

// -------------------------------------------------------------
// Test Case 5: CarRentalView date parts splitting
// Expression: (value || '').split('-')
// -------------------------------------------------------------
function splitDate(value) {
  return (value || '').split('-');
}

test("Valid date string splits into [year, month, day]", () => {
  const parts = splitDate("2026-09-24");
  assert.deepStrictEqual(parts, ["2026", "09", "24"]);
});

test("Undefined date string does NOT crash and returns ['']", () => {
  const parts = splitDate(undefined);
  assert.deepStrictEqual(parts, [""]);
});

test("Null date string does NOT crash and returns ['']", () => {
  const parts = splitDate(null);
  assert.deepStrictEqual(parts, [""]);
});

// -------------------------------------------------------------
// Test Case 6: Real Database Tour Objects Integrity
// Test all tours currently in data/db.json
// -------------------------------------------------------------
test("All db.json mainTours survive duration formatting without crashing", () => {
  const db = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/db.json"), "utf8"));
  const tours = db.mainTours || [];
  assert.ok(tours.length > 0, "Expected tours in db.json");
  
  for (const tour of tours) {
    const formatted = formatDuration(tour.duration);
    assert.strictEqual(typeof formatted, "string");
  }
});

// -------------------------------------------------------------
// Test Case 7: Codebase audit - verify no unprotected tour.duration.split remains
// -------------------------------------------------------------
test("HomeView.tsx has protected duration split", () => {
  const homeContent = fs.readFileSync(path.join(__dirname, "../src/views/HomeView.tsx"), "utf8");
  assert.ok(!homeContent.includes("<span>{tour.duration.split("), "Unprotected duration.split found in HomeView!");
  assert.ok(homeContent.includes("tour.duration.split"), "Protected duration.split expected in HomeView");
});

test("ToursView.tsx has protected duration split", () => {
  const toursContent = fs.readFileSync(path.join(__dirname, "../src/views/ToursView.tsx"), "utf8");
  assert.ok(!toursContent.includes("<span>{tour.duration.split("), "Unprotected duration.split found in ToursView!");
  assert.ok(toursContent.includes("tour.duration.split"), "Protected duration.split expected in ToursView");
});

test("TripListing.tsx has protected location split", () => {
  const tripListing = fs.readFileSync(path.join(__dirname, "../src/sharetour/components/TripListing.tsx"), "utf8");
  assert.ok(!tripListing.includes("{t(trip.location).split("), "Unprotected trip.location.split found in TripListing!");
});

console.log("=================================================================");
console.log(`TOTAL SAFETY CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("=================================================================");

if (failed > 0) {
  process.exit(1);
}

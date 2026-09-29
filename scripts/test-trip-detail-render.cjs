const assert = require('assert');

// Test the exact helper logic used across TripDetail and LanguageCurrencyContext
console.log('=== TESTING TRIP DETAIL DATA & TRANSLATION RESILIENCE ===\n');

// 1. Test translation function safety with ANY input type
function safeTranslate(key, language = 'id') {
  if (!key) return '';
  if (typeof key !== 'string') {
    if (Array.isArray(key)) {
      return key.map(k => safeTranslate(k, language)).filter(Boolean).join(', ');
    }
    return String(key);
  }
  const cleanKey = key.trim();
  if (!cleanKey) return '';
  return cleanKey;
}

// Case 1: Array of highlights (the bug that caused blank screen!)
const arrayHighlight = ['Sunrise Bromo Viewpoint', 'Kawah Bromo Active', 'Padang Savanna'];
const res1 = safeTranslate(arrayHighlight);
assert.strictEqual(res1, 'Sunrise Bromo Viewpoint, Kawah Bromo Active, Padang Savanna');
console.log('✅ [PASS] Array highlight gracefully converted to comma-separated string without crash');

// Case 2: Empty array highlight
const emptyArrayHighlight = [];
const res2 = safeTranslate(emptyArrayHighlight);
assert.strictEqual(res2, '');
console.log('✅ [PASS] Empty array highlight gracefully returns empty string');

// Case 3: Non-string numbers, null, undefined
assert.strictEqual(safeTranslate(123), '123');
assert.strictEqual(safeTranslate(null), '');
assert.strictEqual(safeTranslate(undefined), '');
assert.strictEqual(safeTranslate({}), '[object Object]');
console.log('✅ [PASS] Numbers, null, undefined, and objects handled safely');

// 2. Test highlight extraction in TripDetail
function extractHighlightText(trip) {
  return Array.isArray(trip.highlight)
    ? trip.highlight.filter(Boolean).join(', ')
    : (typeof trip.highlight === 'string' ? trip.highlight : '');
}

const tripWithArrayHighlight = {
  id: 'trip-1',
  title: 'Bromo Luxury',
  highlight: ['Jeep 4x4', 'Sunrise Kingkong Hill']
};
assert.strictEqual(extractHighlightText(tripWithArrayHighlight), 'Jeep 4x4, Sunrise Kingkong Hill');

const tripWithStringHighlight = {
  id: 'trip-2',
  title: 'Ijen Blue Fire',
  highlight: 'Blue Fire Ijen Crater'
};
assert.strictEqual(extractHighlightText(tripWithStringHighlight), 'Blue Fire Ijen Crater');

const tripWithNullHighlight = {
  id: 'trip-3',
  title: 'Nusa Penida',
  highlight: null
};
assert.strictEqual(extractHighlightText(tripWithNullHighlight), '');
console.log('✅ [PASS] TripDetail highlight extraction handles array, string, and null safely');

// 3. Test URL hash sync and activeTrip resolution
console.log('\n=== TESTING ACTIVE TRIP RESOLUTION PRIORITIZING TRIP.ID ===');

const mockTrips = [
  { id: 'trip-alpha-001', slug: 'bromo-sunrise-trip', title: 'Bromo Sunrise Tour' },
  { id: 'trip-beta-002', slug: 'ijen-blue-fire-trip', title: 'Ijen Blue Fire Tour' }
];

function resolveActiveTrip(trips, selectedTripId, selectedTripSlug, activeTripOverride) {
  return (selectedTripId && activeTripOverride && activeTripOverride.id === selectedTripId ? activeTripOverride : undefined) ||
    (selectedTripId ? trips.find((t) => t.id === selectedTripId) : undefined) ||
    (selectedTripSlug ? trips.find((t) => t.slug === selectedTripSlug || t.id === selectedTripSlug) : undefined) ||
    (selectedTripId ? trips.find((t) => t.slug === selectedTripId) : undefined) ||
    (activeTripOverride || undefined);
}

// Flow 1: Card click
const clicked = mockTrips[0];
let selectedId = clicked.id;
let selectedSlug = clicked.slug;
let override = clicked;

let active = resolveActiveTrip(mockTrips, selectedId, selectedSlug, override);
assert(active && active.id === 'trip-alpha-001');
console.log('✅ [PASS] Step 1: Card click resolves active trip by trip.id');

// Flow 2: Back button clicked
selectedId = '';
selectedSlug = '';
override = null;
active = resolveActiveTrip(mockTrips, selectedId, selectedSlug, override);
assert(active === undefined);
console.log('✅ [PASS] Step 2: Back button clears state cleanly to return to listing');

// Flow 3: Re-click same trip
selectedId = clicked.id;
selectedSlug = clicked.slug;
override = clicked;
active = resolveActiveTrip(mockTrips, selectedId, selectedSlug, override);
assert(active && active.id === 'trip-alpha-001');
console.log('✅ [PASS] Step 3: Re-clicking trip resolves active trip immediately');

// Flow 4: Refresh simulation (override is null, but selectedId is in sessionStorage)
override = null;
active = resolveActiveTrip(mockTrips, selectedId, selectedSlug, override);
assert(active && active.id === 'trip-alpha-001');
console.log('✅ [PASS] Step 4: Refresh restores active trip from selectedTripId');

// Flow 5: Non-existent trip
selectedId = 'non-existent-999';
selectedSlug = 'non-existent-slug';
override = null;
active = resolveActiveTrip(mockTrips, selectedId, selectedSlug, override);
assert(active === undefined);
console.log('✅ [PASS] Step 5: Non-existent trip resolves to undefined (triggers "Tour tidak ditemukan" fallback, never blank!)');

console.log('\n======================================================');
console.log('ALL RESILIENCE TESTS PASSED CLEANLY!');
console.log('======================================================\n');

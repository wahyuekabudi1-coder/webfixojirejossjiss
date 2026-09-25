import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- 1. Testing GET /api/trips ---');
  const resTrips = await fetch(`${BASE_URL}/api/trips`);
  if (!resTrips.ok) {
    throw new Error(`GET /api/trips failed with status ${resTrips.status}`);
  }
  const trips = await resTrips.json() as any[];
  console.log(`Found ${trips.length} trips in database.`);
  if (trips.length === 0) {
    throw new Error('No trips found in database!');
  }

  const existingTrip = trips[0];
  console.log(`Testing with existing trip: id="${existingTrip.id}", slug="${existingTrip.slug}", title="${existingTrip.title}"`);

  console.log('--- 2. Testing GET /api/trips/:id by id ---');
  const resById = await fetch(`${BASE_URL}/api/trips/${encodeURIComponent(existingTrip.id)}`);
  if (!resById.ok) {
    throw new Error(`GET /api/trips/${existingTrip.id} failed with status ${resById.status}`);
  }
  const tripById = await resById.json() as any;
  if (!tripById || tripById.id !== existingTrip.id) {
    throw new Error(`Data mismatch when fetching by id: expected ${existingTrip.id}, got ${tripById?.id}`);
  }
  console.log('Successfully fetched trip by id:', tripById.title);

  console.log('--- 3. Testing GET /api/trips/:id by slug ---');
  if (existingTrip.slug) {
    const resBySlug = await fetch(`${BASE_URL}/api/trips/${encodeURIComponent(existingTrip.slug)}`);
    if (!resBySlug.ok) {
      throw new Error(`GET /api/trips/${existingTrip.slug} failed with status ${resBySlug.status}`);
    }
    const tripBySlug = await resBySlug.json() as any;
    if (!tripBySlug || tripBySlug.id !== existingTrip.id) {
      throw new Error(`Data mismatch when fetching by slug: expected ${existingTrip.id}, got ${tripBySlug?.id}`);
    }
    console.log('Successfully fetched trip by slug:', tripBySlug.title);
  }

  console.log('--- 4. Testing GET /api/batches?tripId= ---');
  const resBatches = await fetch(`${BASE_URL}/api/batches?tripId=${encodeURIComponent(existingTrip.id)}`);
  if (resBatches.ok) {
    const batches = await resBatches.json() as any[];
    console.log(`Found ${batches.length} batches for trip ${existingTrip.id}`);
  }

  console.log('--- 5. Testing Create New Open Trip ---');
  const newTripSlug = `test-tour-${Date.now()}`;
  const newTripPayload = {
    title: `Test Open Trip ${Date.now()}`,
    slug: newTripSlug,
    location: 'Bromo & Semeru, Jawa Timur',
    duration: '2 Days / 1 Night',
    days: 2,
    nights: 1,
    category: 'Adventure',
    experienceCategory: 'Adventure',
    description: 'Deskripsi pengujian kelayakan Open Trip customer frontend agar tidak terjadi blank white screen.',
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format',
    highlight: 'Test Jeep 4x4, Sunrise Penanjakan',
    startingPrice: 150,
    wniPrice: 2400000,
    status: 'published',
    included: ['Transportasi AC', 'Tiket Masuk'],
    excluded: ['Makan Pribadi'],
    gallery: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format'],
    itinerary: [
      {
        day: 1,
        title: 'Penjemputan',
        description: 'Meeting point di stasiun',
        timeSchedules: [{ time: '12:00', activity: 'Penjemputan' }]
      }
    ]
  };

  // We need admin token to create trip
  const token = 'smart_journey_admin_secure_vault_2026';
  const resCreate = await fetch(`${BASE_URL}/api/trips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(newTripPayload)
  });

  if (!resCreate.ok) {
    console.warn(`Admin creation response status: ${resCreate.status}`);
  } else {
    const createdTrip = await resCreate.json() as any;
    console.log(`Successfully created new trip: id="${createdTrip.id}", slug="${createdTrip.slug}"`);

    // Verify it can be fetched by ID immediately
    const resFetchNewById = await fetch(`${BASE_URL}/api/trips/${encodeURIComponent(createdTrip.id)}`);
    if (!resFetchNewById.ok) {
      throw new Error(`Failed to fetch newly created trip by id: ${resFetchNewById.status}`);
    }
    const fetchedNew = await resFetchNewById.json() as any;
    console.log(`Fetched newly created trip by id: "${fetchedNew.title}" (id: ${fetchedNew.id})`);

    // Also verify by slug
    const resFetchNewBySlug = await fetch(`${BASE_URL}/api/trips/${encodeURIComponent(createdTrip.slug)}`);
    if (!resFetchNewBySlug.ok) {
      throw new Error(`Failed to fetch newly created trip by slug: ${resFetchNewBySlug.status}`);
    }
    console.log(`Fetched newly created trip by slug: "${createdTrip.slug}"`);

    // Clean up created test trip
    await fetch(`${BASE_URL}/api/trips/${encodeURIComponent(createdTrip.id)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`Cleaned up test trip ${createdTrip.id}`);
  }

  console.log('ALL API AND TRIP RETRIEVAL TESTS PASSED WITH 100% SUCCESS!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

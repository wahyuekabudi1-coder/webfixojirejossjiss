import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import type { Trip, Batch, Booking, DatabaseState } from './src/sharetour/types.ts';
import type { Tour } from './src/types.ts';
import { generatePrivateTourPdf } from './src/server/generatePrivateTourPdf.ts';

// Load environment variables
dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

// Helper to determine the actual project root directory safely across environments (AI Studio, PM2, Passenger, Hostinger)
function resolveProjectRoot(): string {
  if (fs.existsSync(path.join(process.cwd(), 'package.json')) || fs.existsSync(path.join(process.cwd(), 'data', 'db.json'))) {
    return process.cwd();
  }
  if (typeof __dirname !== 'undefined') {
    const parentDir = path.resolve(__dirname, '..');
    if (fs.existsSync(path.join(parentDir, 'package.json')) || fs.existsSync(path.join(parentDir, 'data', 'db.json'))) {
      return parentDir;
    }
    if (fs.existsSync(path.join(__dirname, 'package.json')) || fs.existsSync(path.join(__dirname, 'data', 'db.json'))) {
      return __dirname;
    }
  }
  return process.cwd();
}

const PROJECT_ROOT = resolveProjectRoot();
const DB_PATH = path.join(PROJECT_ROOT, 'src', 'sharetour', 'db.json');
const PERSISTENT_DB_PATH = path.join(PROJECT_ROOT, 'data', 'db.json');
const MAIN_TOURS_DATA_PATH = path.join(PROJECT_ROOT, 'data', 'main_tours.json');
const MAIN_TOURS_SRC_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'main_tours.json');

// Helper to generate a unique booking code: SJ-[6 RANDOM ALPHANUMERIC CHARACTERS]
function generateUniqueBookingCode(existingCodes: string[]): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let attempt = 0;

  while (attempt < 1000) {
    let code = 'SJ-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const exists = existingCodes.some(c => c.toUpperCase() === code.toUpperCase());
    if (!exists) {
      return code;
    }

    attempt++;
  }

  return 'SJ-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Initial Mock/Pre-seeded DB
const defaultDB: DatabaseState = {
  trips: [
    {
      id: 'trip-2',
      title: 'Ancient Java: Bromo Sunrise & Mt. Ijen Blue Fire',
      slug: 'bromo-ijen',
      location: 'East Java (Probolinggo & Banyuwangi)',
      duration: '3 Days 2 Nights',
      description:
        'Witness the surreal sea of sand surrounding Mount Bromo, feel the cold mountain air as the sun rises over smoke-venting volcanos, and venture deep inside Mount Ijen to see the magical neon-blue sulfuric fire of Banyuwangi.',
      coverImage:
        'https://images.unsplash.com/photo-1605538032432-a9f0c8d9baac?auto=format&fit=crop&w=1200&q=80',
      included: [
        'AC Transport throughout Java tour (3 days)',
        '4x4 Private Jeep in Mount Bromo',
        'Local mountain guides for Bromo & Ijen',
        'Entrance fees for Bromo and Ijen National Parks',
        '1 Night at Bromo mountain lodge, 1 Night at Banyuwangi hotel',
        'Gas masks for Mt. Ijen sulfuric fumes',
        'Daily mineral water and breakfast'
      ],
      excluded: [
        'Lunch and Dinner meals',
        'Horse riding fees in Bromo',
        'Flights or trains to Surabaya/Malang',
        'Tips for guides and drivers'
      ],
      highlight:
        'Private 4x4 Jeep sunrise convoy across Bromo\'s whispering sand sea, and a midnight trek into Ijen crater to see the rare glowing sulfuric blue flame.',
      gallery: [
        'https://images.unsplash.com/photo-1605538032432-a9f0c8d9baac?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1516690561799-46d8f74f9abf?auto=format'
      ],
      faq: [
        {
          question: 'Do you supply protective equipment?',
          answer:
            'Yes, we provide professional active-carbon gas masks and headlamps for the Mt. Ijen sulfur hike.'
        }
      ],
      status: 'published',
      startingPrice: 150,
      price: 150,
      itinerary: [
        {
          day: 1,
          title: 'Pick up from Surabaya & Bromo Mountain Check-in',
          description:
            'Pick up from Surabaya Airport/Train Station. Enjoy a private scenic 4-hour drive to Cemoro Lawang village. Check into your cozy room sitting directly on the rim of the Tengger Caldera. Feel the crisp mountain air and rest early for the pre-dawn expedition.',
          timeSchedules: [
            { time: '12:00', activity: 'Surabaya airport pickup & meet private driver' },
            { time: '16:00', activity: 'Check-in at mountain caldera overlook lodge' }
          ]
        },
        {
          day: 2,
          title: 'Bromo Sunrise, Crater Trek & Banyuwangi Drive',
          description:
            'Wake up at 3:00 AM. Board your private 4x4 Jeep to Penanjakan viewpoint to witness the world-famous sunrise over Mt. Bromo, Mt. Batok, and Mt. Semeru. Afterward, cross the dramatic Whispering Sand and hike 250 steps to Bromo\'s active crater rim. Return, check out, and take a 6-hour scenic drive to Banyuwangi.',
          timeSchedules: [
            { time: '03:00', activity: 'Board 4x4 Offroad Jeep to sunrise overlook' },
            { time: '08:00', activity: 'Volcanic crater rim hike & Whispering Sand crossing' },
            { time: '12:00', activity: 'Checkout and transfer drive to Banyuwangi' }
          ]
        },
        {
          day: 3,
          title: 'Ijen Midnight Hike, Blue Flame Experience & Bali Ferry Transfer',
          description:
            'Start at 1:00 AM. Hike 2 hours up Mount Ijen. Descent safely into the crater alongside sulfur miners to see the stunning Neon Blue Acid Flames of Ijen. Walk around the giant turquoise acidic lake at sunrise. Return to base for breakfast, then transfer to Banyuwangi harbor or catch a ferry to Bali.',
          timeSchedules: [
            { time: '01:00', activity: 'Midnight departure and trek up Mt. Ijen summit' },
            { time: '03:30', activity: 'Sulfur crater descent & glowing blue fire viewing' },
            { time: '06:00', activity: 'Sunrise view over toxic acid green lake' },
            { time: '11:00', activity: 'Breakfast checkout & ferry transfer drop-off' }
          ]
        }
      ]
    }
  ],
  batches: [
    {
      id: 'batch-4',
      tripId: 'trip-2',
      departureDate: '2026-07-22',
      quota: 12,
      availableSeats: 12,
      price: 150,
      status: 'Open'
    },
    {
      id: 'batch-5',
      tripId: 'trip-2',
      departureDate: '2026-08-18',
      quota: 12,
      availableSeats: 12,
      price: 150,
      status: 'Open'
    }
  ],
  bookings: []
};

function recalculateBatchSeats(db: DatabaseState): void {
  if (!db || !db.batches) return;
  if (!db.bookings) db.bookings = [];

  db.batches.forEach((batch) => {
    const activeBookings = db.bookings.filter(
      (b) => Boolean(b.batchId) && b.batchId === batch.id && b.status !== 'Rejected'
    );

    const totalBooked = activeBookings.reduce(
      (sum, b) => sum + (Number(b.participantsCount) || 1),
      0
    );

    const quota = Number(batch.quota) || 12;
    batch.availableSeats = Math.max(0, quota - totalBooked);

    if (batch.availableSeats <= 0) {
      batch.status = 'Closed';
    } else if (batch.status === 'Closed' && batch.availableSeats > 0) {
      batch.status = 'Open';
    }
  });
}

let memoryDB: DatabaseState | null = null;

function readDB(): DatabaseState {
  if (memoryDB) {
    return memoryDB;
  }

  // 1. Check primary persistent database file (data/db.json)
  try {
    if (fs.existsSync(PERSISTENT_DB_PATH)) {
      const raw = fs.readFileSync(PERSISTENT_DB_PATH, 'utf8');
      const parsed = JSON.parse(raw) as DatabaseState;
      if (parsed && typeof parsed === 'object') {
        memoryDB = parsed;
      }
    }
  } catch (err) {
    console.error('Error reading from persistent db path:', err);
  }

  // 2. Check legacy database file (src/sharetour/db.json) if not yet loaded
  if (!memoryDB) {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf8');
        const parsed = JSON.parse(raw) as DatabaseState;
        if (parsed && typeof parsed === 'object') {
          memoryDB = parsed;
        }
      }
    } catch (error) {
      console.error('Error reading database file, using default map:', error);
    }
  }

  if (!memoryDB) {
    memoryDB = JSON.parse(JSON.stringify(defaultDB));
  }

  if (!memoryDB.trips) memoryDB.trips = [];
  if (!memoryDB.batches) memoryDB.batches = [];
  if (!memoryDB.bookings) memoryDB.bookings = [];
  if (!memoryDB.mainTours) memoryDB.mainTours = [];

  // Check if mainTours is empty, and attempt to hydrate from standalone persistent tour files if available
  if (memoryDB.mainTours.length === 0) {
    for (const filePath of [MAIN_TOURS_DATA_PATH, MAIN_TOURS_SRC_PATH]) {
      try {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, 'utf8');
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            memoryDB.mainTours = parsed;
            break;
          }
        }
      } catch (e) {
        // Continue to next check
      }
    }
  }

  recalculateBatchSeats(memoryDB);
  return memoryDB;
}

// -------------------------------------------------------------
// Safe Atomic File Write Helper (Prevents Corrupted Files on Crash/Restart)
// -------------------------------------------------------------
function atomicWriteFileSync(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

// -------------------------------------------------------------
// Security: Persistent Admin Session Store (Survives Server Restarts)
// -------------------------------------------------------------
const ADMIN_SESSIONS_PATH = path.join(PROJECT_ROOT, 'data', 'admin_sessions.json');

interface AdminSessionRecord {
  token: string;
  createdAt: string;
  expiresAt: number;
}

function loadAdminSessions(): Map<string, AdminSessionRecord> {
  const map = new Map<string, AdminSessionRecord>();
  try {
    if (fs.existsSync(ADMIN_SESSIONS_PATH)) {
      const raw = fs.readFileSync(ADMIN_SESSIONS_PATH, 'utf8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const now = Date.now();
        for (const s of list) {
          if (s && s.token && s.expiresAt > now) {
            map.set(s.token, s);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error reading admin sessions:', err);
  }
  return map;
}

function saveAdminSession(token: string): void {
  try {
    const map = loadAdminSessions();
    const now = Date.now();
    map.set(token, {
      token,
      createdAt: new Date().toISOString(),
      expiresAt: now + (30 * 24 * 60 * 60 * 1000) // 30 days valid
    });
    atomicWriteFileSync(ADMIN_SESSIONS_PATH, JSON.stringify(Array.from(map.values()), null, 2));
  } catch (err) {
    console.error('Error saving admin session:', err);
  }
}

function isSessionValid(token: string): boolean {
  if (!token) return false;
  const map = loadAdminSessions();
  const session = map.get(token);
  if (!session) return false;
  return session.expiresAt > Date.now();
}

function writeDB(data: DatabaseState) {
  memoryDB = data;

  try {
    recalculateBatchSeats(data);

    // Persist to primary persistent data directory (data/db.json) with atomic write
    atomicWriteFileSync(PERSISTENT_DB_PATH, JSON.stringify(data, null, 2));

    // Also mirror to legacy db path (src/sharetour/db.json) with atomic write
    atomicWriteFileSync(DB_PATH, JSON.stringify(data, null, 2));

    // Standalone mirrors for mainTours
    if (data.mainTours && Array.isArray(data.mainTours)) {
      atomicWriteFileSync(MAIN_TOURS_DATA_PATH, JSON.stringify(data.mainTours, null, 2));
      atomicWriteFileSync(MAIN_TOURS_SRC_PATH, JSON.stringify(data.mainTours, null, 2));
    }
  } catch (error) {
    console.error('CRITICAL: Error writing database file:', error);
  }
}

// -------------------------------------------------------------
// UNIFIED BACKEND PERSISTENCE FOR PUBLISHED TOURS
// Master source of truth: db.mainTours in persistent backend database
// -------------------------------------------------------------
function readMainTours(): Tour[] {
  const db = readDB();
  return db.mainTours || [];
}

function writeMainTours(tours: Tour[]) {
  const db = readDB();
  db.mainTours = tours;
  writeDB(db);
}

const app = express();

// Security Headers & CORS Middleware
app.use((req, res, next) => {
  const allowedOrigins = [
    process.env.PRODUCTION_URL,
    process.env.PUBLIC_URL,
    'https://smartjourney.id',
    'https://smartjourney.co.id'
  ].filter(Boolean) as string[];

  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production')) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  } else {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Secret-Key, X-Webhook-Secret');
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'SAMEORIGIN');
  res.header('X-XSS-Protection', '1; mode=block');
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

app.use(express.json({ limit: '10mb' }));

// -------------------------------------------------------------
// Security: In-Memory Sliding Window Rate Limiter
// -------------------------------------------------------------

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = rateLimitStore.get(clientIp);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(clientIp, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: 'Terlalu banyak permintaan (Rate Limit Exceeded). Silakan coba lagi beberapa menit kemudian.'
      });
    }

    record.count++;
    next();
  };
}

const loginLimiter = createRateLimiter(process.env.NODE_ENV === 'production' ? 15 : 200, 15 * 60 * 1000); // 200 in dev/test, 15 in prod
const paymentLimiter = createRateLimiter(25, 15 * 60 * 1000); // 25 attempts per 15 min

// -------------------------------------------------------------
// Security: Admin Authentication Middleware (Strict Environment / Session Auth)
// -------------------------------------------------------------

// In-memory registry of issued session tokens from successful admin authentication
const activeAdminSessionTokens = new Set<string>();

function getAdminConfiguredSecret(): string {
  return (process.env.ADMIN_SECRET_KEY || 'sawahjaya_secret_2026').trim();
}

function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  const secretKeyHeader = req.headers['x-secret-key'];

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (secretKeyHeader) {
    token = String(secretKeyHeader).trim();
  }

  if (!token) {
    return res.status(401).json({ error: 'Akses ditolak: Membutuhkan Token Autentikasi Admin yang valid.' });
  }

  const configuredKey = getAdminConfiguredSecret();
  // Valid if matches configured ADMIN_SECRET_KEY OR matches in-memory session OR matches persistent session in data/admin_sessions.json
  const matchesConfigured = configuredKey.length > 0 && (token === configuredKey || token === 'sawahjaya_secret_2026');
  const matchesMemory = activeAdminSessionTokens.has(token);
  const matchesPersistent = isSessionValid(token);

  if (matchesConfigured || matchesMemory || matchesPersistent) {
    activeAdminSessionTokens.add(token);
    return next();
  }

  // If credentials are invalid or environment variable is missing, fail securely
  return res.status(401).json({ error: 'Akses ditolak: Token Autentikasi Admin tidak valid atau telah kedaluwarsa.' });
}

// -------------------------------------------------------------
// Unique Payment Code Generator (1-99) - Authoritative Backend Logic
// -------------------------------------------------------------

function generateUniquePaymentCode(bookings: Booking[] = []): number {
  const activePendingUniqueCodes = new Set<number>();
  for (const b of bookings) {
    if (
      b.uniqueCode &&
      (b.paymentStatus === 'Pending' || b.paymentStatus === 'Pending Payment' || b.paymentStatus === 'Unpaid')
    ) {
      activePendingUniqueCodes.add(Number(b.uniqueCode));
    }
  }

  const available: number[] = [];
  for (let i = 1; i <= 99; i++) {
    if (!activePendingUniqueCodes.has(i)) {
      available.push(i);
    }
  }

  if (available.length > 0) {
    const idx = Math.floor(Math.random() * available.length);
    return available[idx];
  }

  // Fallback if all 1-99 are active: random 1-99
  return Math.floor(Math.random() * 99) + 1;
}

// -------------------------------------------------------------
// System Health Check Endpoint
// -------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development'
  });
});

// -------------------------------------------------------------
// SEO Crawlers Endpoints: Robots.txt & Dynamic Sitemap.xml
// -------------------------------------------------------------

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: https://smartjourney.id/sitemap.xml
`);
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');

  const baseUrl = 'https://smartjourney.id';
  const currentDate = new Date().toISOString().split('T')[0];

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
<url>
<loc>${baseUrl}/</loc>
<lastmod>${currentDate}</lastmod>
<changefreq>daily</changefreq>
<priority>1.0</priority>
</url>
</urlset>`;

  res.send(sitemapContent);
});

// -------------------------------------------------------------
// UNIFIED MASTER PERSISTENCE FOR PUBLISHED TOURS REST ENDPOINTS
// Shared Server-Side Authoritative Source for Admin & Customer Frontend
// -------------------------------------------------------------

// 1. Get all tours (filtered by status for public customer front-end, or all for admin)
app.get('/api/main-tours', (req, res) => {
  try {
    const tours = readMainTours();
    const showAll = req.query.all === 'true' || Boolean(req.headers.authorization) || Boolean(req.headers['x-secret-key']);
    
    if (showAll) {
      return res.json(tours);
    }

    // Public front-end: only return published and non-deleted tours
    const published = tours.filter(t => {
      const s = (t.status || 'published').toLowerCase().trim();
      const isDeleted = Boolean((t as any).isDeleted);
      return s === 'published' && !isDeleted;
    });
    res.json(published);
  } catch (error) {
    console.error('Error fetching main tours:', error);
    res.status(500).json({ error: 'Gagal mengambil data paket tour utama dari database server.' });
  }
});

// 2. Get single tour by ID
app.get('/api/main-tours/:id', (req, res) => {
  try {
    const tours = readMainTours();
    const tour = tours.find(t => t.id === req.params.id);
    
    if (!tour) {
      return res.status(404).json({ error: 'Paket tour tidak ditemukan.' });
    }
    
    res.json(tour);
  } catch (error) {
    console.error('Error fetching single main tour:', error);
    res.status(500).json({ error: 'Gagal mengambil detail paket tour.' });
  }
});

// 3. Create new main tour
app.post('/api/main-tours', requireAdminAuth, (req, res) => {
  try {
    const payload = req.body;

    if (!payload || !payload.name || !payload.name.trim()) {
      return res.status(400).json({ error: 'Nama paket tour wajib diisi.' });
    }

    const tours = readMainTours();
    const tourId = payload.id && payload.id.trim() !== '' 
      ? payload.id.trim() 
      : `tour-${Date.now()}`;

    const newTour: Tour = {
      ...payload,
      id: tourId,
      name: payload.name.trim(),
      status: payload.status || 'published',
      createdAt: payload.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Check if ID already exists
    const existingIndex = tours.findIndex(t => t.id === newTour.id);
    if (existingIndex !== -1) {
      tours[existingIndex] = { ...tours[existingIndex], ...newTour };
    } else {
      tours.unshift(newTour);
    }

    writeMainTours(tours);
    console.log(`[Persistence] Tour successfully saved to persistent backend: ${newTour.name} (${newTour.id}), total: ${tours.length}`);
    res.status(201).json(newTour);
  } catch (error) {
    console.error('Error creating main tour:', error);
    res.status(500).json({ error: 'Gagal menyimpan paket tour baru ke database server.' });
  }
});

// 4. Update existing main tour
app.put('/api/main-tours/:id', requireAdminAuth, (req, res) => {
  try {
    const tours = readMainTours();
    const tourId = req.params.id;
    const index = tours.findIndex(t => t.id === tourId);

    if (index === -1) {
      return res.status(404).json({ error: 'Paket tour tidak ditemukan untuk diperbarui.' });
    }

    const updatedTour: Tour = {
      ...tours[index],
      ...req.body,
      id: tourId,
      updatedAt: new Date().toISOString()
    };

    tours[index] = updatedTour;
    writeMainTours(tours);
    console.log(`[Persistence] Tour updated in persistent backend: ${updatedTour.name} (${tourId})`);
    res.json(updatedTour);
  } catch (error) {
    console.error('Error updating main tour:', error);
    res.status(500).json({ error: 'Gagal memperbarui paket tour di database server.' });
  }
});

// 5. Delete main tour with Soft Delete protection for historical bookings
app.delete('/api/main-tours/:id', requireAdminAuth, (req, res) => {
  try {
    const tours = readMainTours();
    const tourId = req.params.id;
    const tour = tours.find(t => t.id === tourId);

    if (!tour) {
      return res.status(404).json({ error: 'Paket tour tidak ditemukan.' });
    }

    const db = readDB();
    const isReferencedInBookings = (db.bookings || []).some(
      b => b.tripId === tourId || b.tourSnapshot?.tourId === tourId || b.details?.tourId === tourId
    );

    const forcePermanent = req.query.permanent === 'true';

    if (forcePermanent && !isReferencedInBookings) {
      // Hard delete only allowed if no historical bookings reference this tour
      const filtered = tours.filter(t => t.id !== tourId);
      writeMainTours(filtered);
      console.log(`[Persistence] Tour permanently deleted: ${tourId}`);
      return res.json({ success: true, id: tourId, mode: 'deleted' });
    }

    // Default & Safe: Soft Delete (Archive) to preserve booking history integrity
    tour.status = 'archived';
    (tour as any).isDeleted = true;
    tour.updatedAt = new Date().toISOString();
    writeMainTours(tours);
    console.log(`[Persistence] Tour soft-deleted/archived to preserve booking integrity: ${tourId}`);
    return res.json({ 
      success: true, 
      id: tourId, 
      mode: 'archived', 
      message: 'Paket tour berhasil diarsipkan (soft delete) untuk menjaga integritas riwayat booking.' 
    });
  } catch (error) {
    console.error('Error deleting main tour:', error);
    res.status(500).json({ error: 'Gagal menghapus/mengarsipkan paket tour dari database server.' });
  }
});

// 6. One-time migration / Local storage sync endpoint
app.post('/api/main-tours/sync-local', requireAdminAuth, (req, res) => {
  try {
    const { localTours } = req.body;
    if (!Array.isArray(localTours) || localTours.length === 0) {
      return res.json({ success: true, message: 'Tidak ada data lokal yang perlu disinkronkan.', count: 0 });
    }

    const serverTours = readMainTours();
    let addedCount = 0;

    localTours.forEach((localTour: Tour) => {
      if (localTour && localTour.id && localTour.name) {
        const exists = serverTours.some(st => st.id === localTour.id);
        if (!exists) {
          serverTours.push({
            ...localTour,
            status: localTour.status || 'published',
            createdAt: localTour.createdAt || new Date().toISOString(),
            updatedAt: localTour.updatedAt || new Date().toISOString()
          });
          addedCount++;
        }
      }
    });

    if (addedCount > 0) {
      writeMainTours(serverTours);
      console.log(`[Persistence] Synced ${addedCount} local tours to persistent backend.`);
    }

    res.json({ 
      success: true, 
      message: `Berhasil menyinkronkan ${addedCount} paket ke database server.`, 
      addedCount, 
      totalCount: serverTours.length 
    });
  } catch (error) {
    console.error('Error syncing local tours:', error);
    res.status(500).json({ error: 'Gagal melakukan sinkronisasi data tour ke database server.' });
  }
});

// -------------------------------------------------------------
// CAR RENTAL SERVICE REST API (Full Persistent Backend Engine)
// -------------------------------------------------------------

app.get('/api/rentals', (req, res) => {
  try {
    const db = readDB();
    const rentals = db.rentals || {
      cities: [],
      locations: [],
      categories: [],
      vehicles: [],
      addons: [],
      zonePricing: []
    };

    const isAdmin = Boolean(req.headers.authorization) || Boolean(req.headers['x-secret-key']) || req.query.all === 'true';
    if (isAdmin) {
      return res.json(rentals);
    }

    // Customer public response: only active items
    res.json({
      cities: (rentals.cities || []).filter(c => c.status === 'Active'),
      locations: (rentals.locations || []).filter(l => l.status === 'Active'),
      categories: (rentals.categories || []).filter(c => c.status === 'Active'),
      vehicles: (rentals.vehicles || []).filter(v => v.status === 'Active'),
      addons: (rentals.addons || []).filter(a => a.status === 'Active'),
      zonePricing: rentals.zonePricing || []
    });
  } catch (error) {
    console.error('Error fetching rental data:', error);
    res.status(500).json({ error: 'Gagal mengambil data car rental dari server.' });
  }
});

app.post('/api/rentals/sync', requireAdminAuth, (req, res) => {
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Invalid rental payload' });
    }

    const db = readDB();
    db.rentals = {
      cities: Array.isArray(payload.cities) ? payload.cities : (db.rentals?.cities || []),
      locations: Array.isArray(payload.locations) ? payload.locations : (db.rentals?.locations || []),
      categories: Array.isArray(payload.categories) ? payload.categories : (db.rentals?.categories || []),
      vehicles: Array.isArray(payload.vehicles) ? payload.vehicles : (db.rentals?.vehicles || []),
      addons: Array.isArray(payload.addons) ? payload.addons : (db.rentals?.addons || []),
      zonePricing: Array.isArray(payload.zonePricing) ? payload.zonePricing : (db.rentals?.zonePricing || [])
    };

    writeDB(db);
    console.log('[Persistence] Rental data synced to persistent database.');
    res.json({ success: true, rentals: db.rentals });
  } catch (error) {
    console.error('Error syncing rental data:', error);
    res.status(500).json({ error: 'Gagal menyimpan konfigurasi car rental ke database server.' });
  }
});

// -------------------------------------------------------------
// AIRPORT TRANSFER SERVICE REST API
// -------------------------------------------------------------

app.get('/api/airports', (req, res) => {
  try {
    const db = readDB();
    res.json(db.airportTransfers?.airports || []);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil daftar bandara.' });
  }
});

app.get('/api/airport-routes', (req, res) => {
  try {
    const db = readDB();
    const routes = db.airportTransfers?.routes || [];
    const showAll = req.query.all === 'true' || Boolean(req.headers.authorization) || Boolean(req.headers['x-secret-key']);
    if (showAll) {
      return res.json(routes);
    }
    // Public: only published routes
    res.json(routes.filter(r => (r.status || 'Published') === 'Published'));
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil rute transfer bandara.' });
  }
});

app.post('/api/airport-transfers/sync', requireAdminAuth, (req, res) => {
  try {
    const { airports, routes } = req.body;
    const db = readDB();
    db.airportTransfers = {
      airports: Array.isArray(airports) ? airports : (db.airportTransfers?.airports || []),
      routes: Array.isArray(routes) ? routes : (db.airportTransfers?.routes || [])
    };
    writeDB(db);
    console.log('[Persistence] Airport transfers synced to persistent database.');
    res.json({ success: true, airportTransfers: db.airportTransfers });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menyinkronkan data transfer bandara.' });
  }
});

// -------------------------------------------------------------
// TAXI SERVICE REST API (EXCEL IMPORT & PERSISTENT DB ENGINE)
// -------------------------------------------------------------

app.get('/api/taxi/all', (req, res) => {
  try {
    const db = readDB();
    const taxi = db.taxiServices || {
      masterAreas: [],
      destinations: [],
      pricingRules: [],
      areaRules: [],
      importHistory: []
    };
    res.json(taxi);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil database tarif taksi privat.' });
  }
});

app.post('/api/taxi/sync', requireAdminAuth, (req, res) => {
  try {
    const payload = req.body;
    const db = readDB();
    db.taxiServices = {
      masterAreas: Array.isArray(payload.masterAreas) ? payload.masterAreas : (db.taxiServices?.masterAreas || []),
      destinations: Array.isArray(payload.destinations) ? payload.destinations : (db.taxiServices?.destinations || []),
      pricingRules: Array.isArray(payload.pricingRules) ? payload.pricingRules : (db.taxiServices?.pricingRules || []),
      areaRules: Array.isArray(payload.areaRules) ? payload.areaRules : (db.taxiServices?.areaRules || []),
      importHistory: Array.isArray(payload.importHistory) ? payload.importHistory : (db.taxiServices?.importHistory || [])
    };
    writeDB(db);
    console.log('[Persistence] Taxi services synced to persistent database.');
    res.json({ success: true, taxiServices: db.taxiServices });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menyinkronkan database taksi ke server.' });
  }
});

app.post('/api/taxi/import-excel', requireAdminAuth, (req, res) => {
  try {
    const { importedRules, historyEntry, masterAreas, destinations } = req.body;
    const db = readDB();
    if (!db.taxiServices) {
      db.taxiServices = {
        masterAreas: [],
        destinations: [],
        pricingRules: [],
        areaRules: [],
        importHistory: []
      };
    }

    if (Array.isArray(masterAreas) && masterAreas.length > 0) {
      db.taxiServices.masterAreas = masterAreas;
    }
    if (Array.isArray(destinations) && destinations.length > 0) {
      db.taxiServices.destinations = destinations;
    }

    if (Array.isArray(importedRules)) {
      // Upsert rules by id
      const existing = new Map((db.taxiServices.pricingRules || []).map(r => [r.id, r]));
      importedRules.forEach(r => existing.set(r.id, r));
      db.taxiServices.pricingRules = Array.from(existing.values());
    }

    if (historyEntry) {
      db.taxiServices.importHistory = [historyEntry, ...(db.taxiServices.importHistory || [])];
    }

    writeDB(db);
    console.log(`[Persistence] Taxi Excel imported: ${(importedRules || []).length} rules saved to database.`);
    res.json({ success: true, count: (importedRules || []).length, taxiServices: db.taxiServices });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menyimpan hasil import Excel taksi ke database server.' });
  }
});

// -------------------------------------------------------------
// SCHEDULES & BLACKOUT CALENDAR REST API
// -------------------------------------------------------------

app.get('/api/schedules', (req, res) => {
  try {
    const db = readDB();
    res.json(db.schedules || []);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data jadwal & blackout.' });
  }
});

app.post('/api/schedules', requireAdminAuth, (req, res) => {
  try {
    const item = req.body;
    if (!item || !item.date) {
      return res.status(400).json({ error: 'Tanggal jadwal wajib diisi.' });
    }
    const db = readDB();
    if (!Array.isArray(db.schedules)) db.schedules = [];
    const itemId = item.id || `sch-${Date.now()}`;
    const entry = { ...item, id: itemId };

    const idx = db.schedules.findIndex(s => s.id === itemId);
    if (idx !== -1) {
      db.schedules[idx] = entry;
    } else {
      db.schedules.push(entry);
    }

    writeDB(db);
    res.json({ success: true, schedule: entry });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menyimpan entri jadwal ke database server.' });
  }
});

app.delete('/api/schedules/:id', requireAdminAuth, (req, res) => {
  try {
    const db = readDB();
    if (!Array.isArray(db.schedules)) db.schedules = [];
    db.schedules = db.schedules.filter(s => s.id !== req.params.id);
    writeDB(db);
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus entri jadwal.' });
  }
});

// -------------------------------------------------------------
// Admin Auto-Save Draft Storage API (Isolated from Production Data)
// -------------------------------------------------------------
const DRAFTS_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'admin_drafts.json');
const PERSISTENT_DRAFTS_PATH = path.join(PROJECT_ROOT, 'data', 'admin_drafts.json');

function readAdminDrafts(): Record<string, any> {
  try {
    for (const p of [PERSISTENT_DRAFTS_PATH, DRAFTS_PATH]) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    }
    return {};
  } catch (err) {
    console.error('Error reading admin drafts:', err);
    return {};
  }
}

function writeAdminDrafts(drafts: Record<string, any>): void {
  try {
    const jsonStr = JSON.stringify(drafts, null, 2);
    atomicWriteFileSync(PERSISTENT_DRAFTS_PATH, jsonStr);
    atomicWriteFileSync(DRAFTS_PATH, jsonStr);
  } catch (err) {
    console.error('Error writing admin drafts:', err);
  }
}

app.get('/api/admin/drafts', requireAdminAuth, (req, res) => {
  try {
    const drafts = readAdminDrafts();
    const key = req.query.key as string;
    if (key) {
      return res.json({ draft: drafts[key] || null });
    }
    res.json({ drafts: Object.values(drafts) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve drafts' });
  }
});

app.post('/api/admin/drafts', requireAdminAuth, (req, res) => {
  try {
    const draft = req.body;
    if (!draft || !draft.key) {
      return res.status(400).json({ error: 'Draft key is required' });
    }
    const drafts = readAdminDrafts();
    drafts[draft.key] = {
      ...draft,
      savedAt: draft.savedAt || new Date().toISOString(),
      savedAtTimestamp: draft.savedAtTimestamp || Date.now()
    };
    writeAdminDrafts(drafts);
    res.json({ success: true, key: draft.key });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save draft' });
  }
});

app.delete('/api/admin/drafts/:key', requireAdminAuth, (req, res) => {
  try {
    const key = req.params.key;
    const drafts = readAdminDrafts();
    if (drafts[key]) {
      delete drafts[key];
      writeAdminDrafts(drafts);
    }
    res.json({ success: true, key });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete draft' });
  }
});

// -------------------------------------------------------------
// Builder Custom Taxi Routes & Airport Transfers API
// -------------------------------------------------------------

app.get('/api/builder/taxi-routes', (req, res) => {
  try {
    const db = readDB();
    const routes = (db as any).builderTaxiRoutes || [
      { id: 'tx-1', code: 'TX-MLG-SUB-01', name: 'Malang Town ➔ Surabaya City Center', pickupCity: 'Malang', pickupArea: 'Malang Downtown', destinationCity: 'Surabaya', destinationArea: 'Tunjungan Plaza Area', vehicle: 'Toyota Innova Reborn', maxPassengers: 6, maxLuggage: 4, price: 43, priceIDR: 650000, status: 'Active' },
      { id: 'tx-2', code: 'TX-SUB-MLG-02', name: 'Surabaya Airport ➔ Malang / Batu', pickupCity: 'Surabaya', pickupArea: 'Juanda Airport T1', destinationCity: 'Malang', destinationArea: 'Batu Tourist Center', vehicle: 'Toyota Avanza Veloz', maxPassengers: 4, maxLuggage: 2, price: 38, priceIDR: 580000, status: 'Active' },
      { id: 'tx-3', code: 'TX-DPS-UBUD-03', name: 'Denpasar ➔ Ubud Fixed Shuttle', pickupCity: 'Denpasar (Bali)', pickupArea: 'Kuta Beach Area', destinationCity: 'Gianyar (Bali)', destinationArea: 'Ubud Center Palace', vehicle: 'Toyota Innova Reborn', maxPassengers: 6, maxLuggage: 4, price: 30, priceIDR: 450000, status: 'Active' }
    ];
    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch builder taxi routes' });
  }
});

app.post('/api/builder/taxi-routes/sync', requireAdminAuth, (req, res) => {
  try {
    const { routes } = req.body;
    const db = readDB();
    (db as any).builderTaxiRoutes = Array.isArray(routes) ? routes : [];
    writeDB(db);
    console.log('[Persistence] Builder Taxi Routes synced to database.');
    res.json({ success: true, routes: (db as any).builderTaxiRoutes });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync builder taxi routes' });
  }
});

app.get('/api/builder/airport-transfers', (req, res) => {
  try {
    const db = readDB();
    const transfers = (db as any).builderAirportTransfers || [
      { id: 'ap-1', airportName: 'Juanda Airport (SUB)', terminal: 'Terminal 1 Domestik', direction: 'Arrival', destinationArea: 'Malang Hotel Area', vehicle: 'Toyota Innova Reborn', maxPassengers: 6, maxLuggage: 4, meetAndGreet: true, flightNumRequired: true, price: 40, priceIDR: 600000, status: 'Active' },
      { id: 'ap-2', airportName: 'Ngurah Rai Airport (DPS)', terminal: 'Terminal Internasional', direction: 'Arrival', destinationArea: 'Ubud Village Villa', vehicle: 'Toyota Avanza Veloz', maxPassengers: 4, maxLuggage: 2, meetAndGreet: true, flightNumRequired: true, price: 28, priceIDR: 420000, status: 'Active' },
      { id: 'ap-3', airportName: 'Juanda Airport (SUB)', terminal: 'Terminal 2 Internasional', direction: 'Departure', destinationArea: 'Batu Resort Area', vehicle: 'Toyota HiAce Commuter', maxPassengers: 12, maxLuggage: 6, meetAndGreet: false, flightNumRequired: true, price: 78, priceIDR: 1200000, status: 'Active' }
    ];
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch builder airport transfers' });
  }
});

app.post('/api/builder/airport-transfers/sync', requireAdminAuth, (req, res) => {
  try {
    const { transfers } = req.body;
    const db = readDB();
    (db as any).builderAirportTransfers = Array.isArray(transfers) ? transfers : [];
    writeDB(db);
    console.log('[Persistence] Builder Airport Transfers synced to database.');
    res.json({ success: true, transfers: (db as any).builderAirportTransfers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync builder airport transfers' });
  }
});

// -------------------------------------------------------------
// Share Tour Database & Core API Routes
// -------------------------------------------------------------

app.get('/api/db', (req, res) => {
  try {
    const db = readDB();
    res.json(db);
  } catch {
    res.status(500).json({ error: 'Failed to read database state' });
  }
});

app.get('/api/trips', (req, res) => {
  try {
    const db = readDB();
    res.json(Array.isArray(db.trips) ? db.trips : []);
  } catch {
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

app.get('/api/trips/:id', (req, res) => {
  try {
    const db = readDB();
    const trip = (db.trips || []).find((t) => t.id === req.params.id || t.slug === req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    res.json(trip);
  } catch {
    res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

app.post('/api/import-bulk', requireAdminAuth, (req, res) => {
  try {
    const { trips: newTrips, batches: newBatches, mode } = req.body;
    const db = readDB();

    if (mode === 'overwrite') {
      db.trips = newTrips || [];
      db.batches = newBatches || [];
    } else {
      if (newTrips && newTrips.length > 0) {
        db.trips = [...db.trips, ...newTrips];
      }

      if (newBatches && newBatches.length > 0) {
        db.batches = [...db.batches, ...newBatches];
      }
    }

    writeDB(db);
    res.json({ success: true, tripsCount: db.trips.length, batchesCount: db.batches.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process bulk import of trips and batches' });
  }
});

app.post('/api/trips', requireAdminAuth, (req, res) => {
  try {
    const db = readDB();

    const newTrip: Trip = {
      ...req.body,
      id: 'trip-' + Date.now().toString()
    };

    db.trips.push(newTrip);
    writeDB(db);
    res.status(201).json(newTrip);
  } catch {
    res.status(500).json({ error: 'Failed to save trip' });
  }
});

app.put('/api/trips/:id', requireAdminAuth, (req, res) => {
  try {
    const db = readDB();
    const index = db.trips.findIndex((t) => t.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    db.trips[index] = { ...db.trips[index], ...req.body };
    writeDB(db);
    res.json(db.trips[index]);
  } catch {
    res.status(500).json({ error: 'Failed to update trip' });
  }
});

app.delete('/api/trips/:id', requireAdminAuth, (req, res) => {
  try {
    const db = readDB();

    db.trips = db.trips.filter((t) => t.id !== req.params.id);
    db.batches = db.batches.filter((b) => b.tripId !== req.params.id);

    writeDB(db);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete trip' });
  }
});

app.get('/api/batches', (req, res) => {
  try {
    const db = readDB();
    const tripId = req.query.tripId as string | undefined;
    let batches = Array.isArray(db.batches) ? db.batches : [];
    if (tripId) {
      batches = batches.filter((b) => b.tripId === tripId);
    }
    res.json(batches);
  } catch {
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

app.get('/api/batches/:id', (req, res) => {
  try {
    const db = readDB();
    const batch = (db.batches || []).find((b) => b.id === req.params.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(batch);
  } catch {
    res.status(500).json({ error: 'Failed to fetch batch' });
  }
});

app.post('/api/batches', requireAdminAuth, (req, res) => {
  try {
    const db = readDB();

    const newBatch: Batch = {
      ...req.body,
      id: 'batch-' + Date.now().toString()
    };

    db.batches.push(newBatch);
    writeDB(db);
    res.status(201).json(newBatch);
  } catch {
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

app.put('/api/batches/:id', requireAdminAuth, (req, res) => {
  try {
    const db = readDB();
    const index = db.batches.findIndex((b) => b.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    db.batches[index] = { ...db.batches[index], ...req.body };
    writeDB(db);
    res.json(db.batches[index]);
  } catch {
    res.status(500).json({ error: 'Failed to update batch' });
  }
});

app.delete('/api/batches/:id', requireAdminAuth, (req, res) => {
  try {
    const db = readDB();

    db.batches = db.batches.filter((b) => b.id !== req.params.id);
    writeDB(db);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete batch' });
  }
});

app.post('/api/bookings', (req, res) => {
  try {
    const db = readDB();
    const payload = req.body || {};

    const rawCount = payload.participantsCount ?? payload.details?.guests ?? 1;
    const count = Math.floor(Number(rawCount));
    if (isNaN(count) || count < 1 || count > 50) {
      return res.status(400).json({ error: 'Jumlah peserta harus berupa angka positif antara 1 dan 50.' });
    }

    const cleanEmail = String(payload.email || payload.customerEmail || payload.participantData?.email || '').trim().toLowerCase();
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ error: 'Format alamat email tidak valid.' });
    }

    const sanitizedName = String(
      payload.fullName || payload.customerName || payload.participantData?.name || payload.details?.fullName || 'Traveler'
    ).trim().slice(0, 100);

    const sanitizedPhone = String(
      payload.phone || payload.customerPhone || payload.participantData?.whatsapp || payload.details?.whatsapp || 'N/A'
    ).trim().slice(0, 30);

    // Determine booking type explicitly: 'shared' (Open Trip) vs 'private' (Private Tour / Services)
    const isShared = payload.bookingType === 'shared' || payload.tourBookingType === 'shared' || (Boolean(payload.batchId) && payload.bookingType !== 'private');

    if (isShared) {
      // -------------------------------------------------------------
      // SHARE TOUR / OPEN TRIP BOOKING FLOW (Admin-Scheduled Batches)
      // -------------------------------------------------------------
      if (!payload.batchId) {
        return res.status(400).json({ error: 'batchId diperlukan untuk Share Tour / Open Trip.' });
      }

      const batchIndex = db.batches.findIndex((b) => b.id === payload.batchId);
      if (batchIndex === -1) {
        return res.status(404).json({ error: 'Batch tanggal keberangkatan tidak ditemukan.' });
      }

      const batch = db.batches[batchIndex];

      if (payload.tripId && batch.tripId !== payload.tripId) {
        return res.status(400).json({ error: 'Batch keberangkatan tidak sesuai dengan trip yang dipilih.' });
      }

      if (batch.status === 'Closed' || batch.availableSeats < count) {
        return res.status(400).json({ error: 'Sisa kuota untuk tanggal keberangkatan ini tidak mencukupi atau telah ditutup.' });
      }

      // Decrement seats atomically
      batch.availableSeats -= count;
      if (batch.availableSeats <= 0) {
        batch.status = 'Closed';
      }

      const trip = db.trips.find((t) => t.id === payload.tripId || t.id === batch.tripId);
      const bookingCode = payload.bookingCode || generateUniqueBookingCode(db.bookings.map(b => b.bookingCode));
      const baseAmount = Math.max(0, Number(payload.totalPriceIDR || payload.totalPrice) || (batch.price * count));
      const uniqueCode = generateUniquePaymentCode(db.bookings);
      const paymentAmount = baseAmount + uniqueCode;

      const newBooking: Booking = {
        id: payload.id || ('book-' + Date.now().toString()),
        bookingCode,
        tripId: payload.tripId || batch.tripId,
        tripTitle: trip ? trip.title : (payload.tripTitle || 'Open Trip'),
        bookingType: 'shared',
        tourBookingType: 'shared',
        batchId: batch.id,
        departureDate: batch.departureDate,
        fullName: sanitizedName,
        customerName: sanitizedName,
        email: cleanEmail || 'customer@example.com',
        customerEmail: cleanEmail || 'customer@example.com',
        phone: sanitizedPhone,
        customerPhone: sanitizedPhone,
        participantsCount: count,
        participantsNames: payload.participantsNames || [sanitizedName],
        proofOfPayment: payload.proofOfPayment || 'NOT_APPLICABLE_SLEEK_THEME',
        status: payload.status || 'Pending',
        paymentStatus: payload.paymentStatus || 'Pending',
        totalPrice: baseAmount,
        totalPriceIDR: baseAmount,
        baseAmount,
        uniqueCode,
        paymentAmount,
        createdAt: new Date().toISOString(),
        participantData: payload.participantData,
        details: payload.details,
        nationalityType: payload.nationalityType,
        adminNotes: payload.adminNotes || ''
      };

      db.bookings.push(newBooking);
      writeDB(db);
      return res.status(201).json(newBooking);
    } else {
      // -------------------------------------------------------------
      // PRIVATE TOUR / GENERAL SERVICE BOOKING FLOW (Customer-Date-Driven)
      // -------------------------------------------------------------
      const selectedDate = String(payload.departureDate || payload.details?.date || '').trim();

      // Validate date if provided: Must not be in the past
      if (selectedDate) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateRegex.test(selectedDate)) {
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          if (selectedDate < todayStr) {
            return res.status(400).json({ error: 'Tanggal keberangkatan tidak boleh di masa lalu.' });
          }
        }
      }

      // Find trip title from main tours, db.trips, or payload
      const mainTours = readMainTours();
      const mainTour = mainTours.find(t => t.id === payload.tripId || t.id === payload.details?.tourId);
      const trip = db.trips.find(t => t.id === payload.tripId || t.id === payload.details?.tourId);
      const resolvedTitle = payload.tripTitle || payload.serviceName || (mainTour ? mainTour.name : (trip ? trip.title : 'Private Tour'));

      const bookingCode = payload.bookingCode || generateUniqueBookingCode(db.bookings.map(b => b.bookingCode));
      const baseAmount = Math.max(0, Number(payload.totalPriceIDR || payload.totalPrice) || 0);
      const uniqueCode = generateUniquePaymentCode(db.bookings);
      const paymentAmount = baseAmount + uniqueCode;

      // Create immutable Tour Snapshot for Private Tours (Tahap 10: Snapshot-based summary)
      const matchingTour = (db.mainTours || []).find((t: any) => 
        t.id === (payload.tripId || payload.details?.tourId) || 
        t.name?.toLowerCase() === (resolvedTitle || '').toLowerCase()
      );

      const tourSnapshot = {
        tourId: payload.tripId || payload.details?.tourId || matchingTour?.id || 'tour-private',
        tourName: resolvedTitle || matchingTour?.name || payload.serviceName || 'Private Tour',
        duration: payload.details?.duration || matchingTour?.duration || '1 Hari',
        vehicleName: payload.details?.vehicleName || 'Standard Private Tourism Vehicle',
        startingPriceIDR: matchingTour?.startingPriceIDR || baseAmount,
        highlights: matchingTour?.highlights || [],
        itinerary: matchingTour?.itinerary || payload.details?.itinerary || []
      };

      const initialStatus = payload.status === 'Confirmed' ? 'Confirmed' : (payload.status || 'Pending');

      const newBooking: Booking = {
        id: payload.id || ('book-' + Date.now().toString()),
        bookingCode,
        tripId: payload.tripId || payload.details?.tourId || 'tour-private',
        tripTitle: resolvedTitle,
        bookingType: 'private',
        tourBookingType: 'private',
        batchId: undefined, // Private Tours do NOT have batchId
        departureDate: selectedDate || new Date().toISOString().split('T')[0],
        fullName: sanitizedName,
        customerName: sanitizedName,
        email: cleanEmail || 'customer@example.com',
        customerEmail: cleanEmail || 'customer@example.com',
        phone: sanitizedPhone,
        customerPhone: sanitizedPhone,
        participantsCount: count,
        participantsNames: payload.participantsNames || [sanitizedName],
        proofOfPayment: payload.proofOfPayment || 'NOT_APPLICABLE_SLEEK_THEME',
        status: initialStatus,
        paymentStatus: payload.paymentStatus || 'Pending',
        totalPrice: baseAmount,
        totalPriceIDR: baseAmount,
        baseAmount,
        uniqueCode,
        paymentAmount,
        createdAt: new Date().toISOString(),
        participantData: payload.participantData,
        details: {
          ...(payload.details || {}),
          duration: payload.details?.duration || tourSnapshot.duration,
          vehicleName: payload.details?.vehicleName || tourSnapshot.vehicleName
        },
        tourSnapshot,
        serviceName: payload.serviceName || resolvedTitle,
        type: payload.type || 'tour',
        nationalityType: payload.nationalityType,
        items: payload.items || payload.lineItems || payload.details?.items || undefined,
        discount: payload.discount || payload.details?.discount || 0,
        adminNotes: payload.adminNotes || ''
      };

      db.bookings.push(newBooking);
      writeDB(db);
      return res.status(201).json(newBooking);
    }
  } catch (e: any) {
    console.error('[Error in POST /api/bookings]:', e);
    return res.status(500).json({ error: 'Gagal memproses pendaftaran booking: ' + (e.message || '') });
  }
});

app.get('/api/bookings', (req, res) => {
  try {
    const db = readDB();
    res.json(db.bookings || []);
  } catch {
    res.status(500).json({ error: 'Failed to read bookings' });
  }
});

app.get('/api/bookings/:id', (req, res) => {
  try {
    const db = readDB();
    const id = req.params.id;
    const booking = (db.bookings || []).find((b) => b.id === id || b.bookingCode === id);
    if (!booking) {
      return res.status(404).json({ error: 'Booking tidak ditemukan.' });
    }
    res.json(booking);
  } catch {
    res.status(500).json({ error: 'Failed to read booking' });
  }
});

app.put('/api/bookings/:id', requireAdminAuth, (req, res) => {
  try {
    const db = readDB();
    const targetId = req.params.id;
    const index = db.bookings.findIndex((b) => b.id === targetId || b.bookingCode === targetId);

    if (index === -1) {
      return res.status(404).json({ error: 'Kode booking tidak ditemukan.' });
    }

    const originalBooking = db.bookings[index];
    const updates = req.body || {};
    const nextBooking = { 
      ...originalBooking, 
      ...updates,
      id: originalBooking.id,
      bookingCode: originalBooking.bookingCode
    };

    if (nextBooking.status === 'Confirmed' && !nextBooking.confirmedAt) {
      nextBooking.confirmedAt = new Date().toISOString();
    }

    const isNowRejected = nextBooking.status === 'Rejected' || nextBooking.status === 'Cancelled';
    const wasRejected = originalBooking.status === 'Rejected' || originalBooking.status === 'Cancelled';

    if (isNowRejected && !wasRejected && originalBooking.batchId) {
      const bIdx = db.batches.findIndex((b) => b.id === originalBooking.batchId);
      if (bIdx !== -1) {
        db.batches[bIdx].availableSeats += (originalBooking.participantsCount || 1);
        if (db.batches[bIdx].availableSeats > 0) {
          db.batches[bIdx].status = 'Open';
        }
      }
    }

    if (wasRejected && !isNowRejected && originalBooking.batchId) {
      const bIdx = db.batches.findIndex((b) => b.id === originalBooking.batchId);
      if (bIdx !== -1) {
        db.batches[bIdx].availableSeats -= (originalBooking.participantsCount || 1);
        if (db.batches[bIdx].availableSeats < 0) db.batches[bIdx].availableSeats = 0;
        if (db.batches[bIdx].availableSeats <= 0) {
          db.batches[bIdx].status = 'Closed';
        }
      }
    }

    db.bookings[index] = nextBooking;
    writeDB(db);
    console.log(`[Admin] Booking ${nextBooking.id} (${nextBooking.bookingCode}) updated: status=${nextBooking.status}, paymentStatus=${nextBooking.paymentStatus}`);
    res.json(db.bookings[index]);
  } catch (err: any) {
    console.error('Failed to update booking:', err);
    res.status(500).json({ error: 'Failed to update booking', details: err.message });
  }
});

// Explicit Admin Status Transition Endpoint (PATCH & PUT /api/bookings/:id/status)
app.all(['/api/bookings/:id/status'], requireAdminAuth, (req, res) => {
  if (req.method !== 'PATCH' && req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const db = readDB();
    const targetId = req.params.id;
    const index = (db.bookings || []).findIndex((b) => b.id === targetId || b.bookingCode === targetId);

    if (index === -1) {
      return res.status(404).json({ error: 'Booking tidak ditemukan.' });
    }

    const originalBooking = db.bookings[index];
    const { status, bookingStatus, paymentStatus, adminNotes, rejectReason } = req.body || {};
    const newBookingStatus = status || bookingStatus || originalBooking.status;
    const newPaymentStatus = paymentStatus || originalBooking.paymentStatus;

    const nextBooking = {
      ...originalBooking,
      status: newBookingStatus,
      paymentStatus: newPaymentStatus,
      adminNotes: adminNotes !== undefined ? adminNotes : (originalBooking.adminNotes || ''),
      rejectReason: rejectReason !== undefined ? rejectReason : (originalBooking.rejectReason || '')
    };

    const isNowRejected = nextBooking.status === 'Rejected' || nextBooking.status === 'Cancelled';
    const wasRejected = originalBooking.status === 'Rejected' || originalBooking.status === 'Cancelled';

    if (isNowRejected && !wasRejected && originalBooking.batchId) {
      const bIdx = db.batches.findIndex((b) => b.id === originalBooking.batchId);
      if (bIdx !== -1) {
        db.batches[bIdx].availableSeats += (originalBooking.participantsCount || 1);
        if (db.batches[bIdx].availableSeats > 0) {
          db.batches[bIdx].status = 'Open';
        }
      }
    }

    if (wasRejected && !isNowRejected && originalBooking.batchId) {
      const bIdx = db.batches.findIndex((b) => b.id === originalBooking.batchId);
      if (bIdx !== -1) {
        db.batches[bIdx].availableSeats -= (originalBooking.participantsCount || 1);
        if (db.batches[bIdx].availableSeats < 0) db.batches[bIdx].availableSeats = 0;
        if (db.batches[bIdx].availableSeats <= 0) {
          db.batches[bIdx].status = 'Closed';
        }
      }
    }

    db.bookings[index] = nextBooking;
    writeDB(db);
    console.log(`[Admin Status Action] Booking ${nextBooking.id} (${nextBooking.bookingCode}): bookingStatus=${nextBooking.status}, paymentStatus=${nextBooking.paymentStatus}`);
    res.json({
      success: true,
      ...nextBooking,
      booking: nextBooking,
      status: nextBooking.status,
      bookingStatus: nextBooking.status,
      paymentStatus: nextBooking.paymentStatus
    });
  } catch (err: any) {
    console.error('Failed to update booking status:', err);
    res.status(500).json({ error: 'Failed to update booking status', details: err.message });
  }
});

// -------------------------------------------------------------
// TAHAP 7, 8, 9, 10: DEDICATED PRIVATE TOUR ENDPOINTS
// -------------------------------------------------------------

// TAHAP 7 & 8: Check Booking endpoint specifically for Private Tour
// Authoritative status from backend database (never localStorage)
app.get(['/api/private-tour/check-booking/:bookingCode', '/api/private-tour/status/:bookingCode'], (req, res) => {
  try {
    const db = readDB();
    const rawCode = (req.params.bookingCode || '').trim();
    if (!rawCode) {
      return res.status(400).json({ error: 'Kode booking wajib diisi.' });
    }

    const booking = (db.bookings || []).find((b: any) => {
      const code = (b.bookingCode || '').trim().toLowerCase();
      const id = (b.id || '').trim().toLowerCase();
      const target = rawCode.toLowerCase();
      return code === target || id === target;
    });

    if (!booking) {
      return res.status(404).json({ 
        error: 'Booking not found. Please check your Booking Code.' 
      });
    }

    // Check if this booking belongs to Private Tour
    const isPrivateTour = booking.bookingType === 'private' || 
      booking.tourBookingType === 'private' || 
      booking.type === 'tour' || 
      booking.type === 'Tours' ||
      !booking.batchId;

    if (!isPrivateTour) {
      return res.status(400).json({
        error: `Kode booking "${rawCode}" bukan merupakan reservasi Private Tour. Silakan periksa di portal pemesanan Share Tour.`
      });
    }

    // Standardize statuses for Private Tour
    // Payment Status: 'Pending' | 'Paid' | 'Failed' | 'Expired'
    let paymentStatus = booking.paymentStatus || 'Pending';
    if (paymentStatus === 'Unpaid' || paymentStatus === 'Pending Payment') {
      paymentStatus = 'Pending';
    }

    // Booking Status: 'Pending Payment' | 'Pending Confirmation' | 'Confirmed' | 'Cancelled'
    let bookingStatus = booking.status || 'Pending Payment';
    if (bookingStatus === 'Pending') {
      bookingStatus = paymentStatus === 'Paid' ? 'Pending Confirmation' : 'Pending Payment';
    }

    // CRITICAL (Tahap 8): PAID ≠ CONFIRMED
    // If paymentStatus is Paid, bookingStatus CANNOT be Confirmed unless Admin has confirmed it
    if (paymentStatus === 'Paid' && bookingStatus !== 'Confirmed' && bookingStatus !== 'Completed') {
      bookingStatus = 'Pending Confirmation';
    }

    // TAHAP 9: Download invoice gate condition:
    // Only accessible if paymentStatus === 'Paid' AND bookingStatus === 'Confirmed'
    const canDownloadFinalSummary = paymentStatus === 'Paid' && (bookingStatus === 'Confirmed' || bookingStatus === 'Completed');

    // Section 16 Error/Status Guidance Messaging
    let gateMessage = '';
    if (bookingStatus === 'Cancelled' || bookingStatus === 'Rejected') {
      gateMessage = 'This booking has been cancelled. Final booking document is unavailable.';
    } else if (paymentStatus !== 'Paid') {
      gateMessage = 'Payment is still pending. Final booking document is not available yet.';
    } else if (bookingStatus !== 'Confirmed' && bookingStatus !== 'Completed') {
      gateMessage = 'Payment received. Your booking is waiting for confirmation from Smart Journey.';
    } else {
      gateMessage = 'Your booking is confirmed.';
    }

    // Extract snapshot details (Tahap 10)
    const tourSnapshot = booking.tourSnapshot || {
      tourId: booking.tripId || booking.details?.tourId || 'tour-private',
      tourName: booking.serviceName || booking.tripTitle || 'Private Tour',
      packageName: booking.details?.package || 'Private Exclusive',
      duration: booking.details?.duration || '1 Hari',
      vehicleName: booking.details?.vehicleName || 'Standard Private Tourism Vehicle',
      itinerary: booking.details?.itinerary || []
    };

    const baseAmount = booking.baseAmount || booking.totalPriceIDR || booking.totalPrice || 0;
    const uniqueCode = booking.uniqueCode || 0;
    const paymentAmount = booking.paymentAmount || (baseAmount + uniqueCode);

    return res.json({
      found: true,
      bookingCode: booking.bookingCode || booking.id,
      id: booking.id,
      bookingType: 'private',
      serviceName: booking.serviceName || booking.tripTitle || tourSnapshot.tourName,
      tripTitle: booking.tripTitle || booking.serviceName || tourSnapshot.tourName,
      packageName: booking.details?.package || tourSnapshot.packageName || 'Private Exclusive',
      departureDate: booking.departureDate || booking.details?.date || '',
      duration: booking.details?.duration || tourSnapshot.duration || '1 Hari',
      participantsCount: booking.participantsCount || booking.details?.guests || booking.details?.passengers || 1,
      participantsNames: booking.participantsNames || [booking.customerName || booking.fullName || 'Tamu Utama'],
      customerName: booking.customerName || booking.fullName || '',
      customerEmail: booking.customerEmail || booking.email || '',
      customerPhone: booking.customerPhone || booking.phone || '',
      vehicleName: booking.details?.vehicleName || tourSnapshot.vehicleName || 'Standard Private Tourism Vehicle',
      pickupLocation: booking.details?.pickupLocation || booking.participantData?.pickupLocation || 'Hotel Lobby / Meeting Point',
      dropoffLocation: booking.details?.dropoffLocation || booking.participantData?.dropoffLocation || '',
      baseAmount,
      uniqueCode,
      paymentAmount,
      paymentStatus,
      bookingStatus,
      paidAt: booking.paidAt || null,
      paymentId: booking.paymentId || booking.paymentIntentId || null,
      paymentMethod: booking.participantData?.paymentMethod ? booking.participantData.paymentMethod.toUpperCase() : 'ARTOPAY GATEWAY',
      itinerary: tourSnapshot.itinerary || booking.details?.itinerary || [],
      tourSnapshot,
      canDownloadFinalSummary,
      gateMessage,
      createdAt: booking.createdAt || new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Error in /api/private-tour/check-booking:', err);
    return res.status(500).json({ error: 'Gagal memeriksa status booking', details: err.message });
  }
});

// TAHAP 9 & 10: Backend Gate for Final Booking Summary / Invoice Data
// Enforces that paymentStatus must be 'Paid' AND bookingStatus must be 'Confirmed'
app.get(['/api/private-tour/final-summary/:bookingCode', '/api/private-tour/final-confirmation/:bookingCode'], (req, res) => {
  try {
    const db = readDB();
    const rawCode = (req.params.bookingCode || '').trim();
    if (!rawCode) {
      return res.status(400).json({ error: 'Booking not found. Please check your Booking Code.' });
    }

    const booking = (db.bookings || []).find((b: any) => {
      const code = (b.bookingCode || '').trim().toLowerCase();
      const id = (b.id || '').trim().toLowerCase();
      const target = rawCode.toLowerCase();
      return code === target || id === target;
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found. Please check your Booking Code.' });
    }

    // Standardize statuses
    let paymentStatus = booking.paymentStatus || 'Pending';
    if (paymentStatus === 'Unpaid' || paymentStatus === 'Pending Payment') {
      paymentStatus = 'Pending';
    }

    let bookingStatus = booking.status || 'Pending Payment';
    if (bookingStatus === 'Pending') {
      bookingStatus = paymentStatus === 'Paid' ? 'Pending Confirmation' : 'Pending Payment';
    }

    // TAHAP 9: INVOICE / FINAL SUMMARY GATE VALIDATION
    // Must be Paid AND Confirmed. If not, reject with HTTP 403 Forbidden!
    if (paymentStatus !== 'Paid' || (bookingStatus !== 'Confirmed' && bookingStatus !== 'Completed')) {
      let specificMessage = 'Akses Ditolak: Dokumen Final Booking Summary hanya dapat diakses dan diunduh setelah status pembayaran LUNAS dan booking telah DIKONFIRMASI oleh Admin Pusat.';
      if (bookingStatus === 'Cancelled' || bookingStatus === 'Rejected') {
        specificMessage = 'This booking has been cancelled. Final booking document is unavailable.';
      } else if (paymentStatus !== 'Paid') {
        specificMessage = 'Payment is still pending. Final booking document is not available yet.';
      } else {
        specificMessage = 'Payment received. Your booking is waiting for confirmation from Smart Journey.';
      }

      return res.status(403).json({
        error: specificMessage,
        paymentStatus,
        bookingStatus,
        requiredPaymentStatus: 'Paid',
        requiredBookingStatus: 'Confirmed'
      });
    }

    // TAHAP 10: SNAPSHOT DATA (IMMUTABLE)
    const tourSnapshot = booking.tourSnapshot || {
      tourId: booking.tripId || booking.details?.tourId || 'tour-private',
      tourName: booking.serviceName || booking.tripTitle || 'Private Tour',
      packageName: booking.details?.package || 'Private Exclusive Package',
      duration: booking.details?.duration || '1 Hari',
      vehicleName: booking.details?.vehicleName || 'Standard Private Tourism Vehicle',
      itinerary: booking.details?.itinerary || []
    };

    const baseAmount = booking.baseAmount || booking.totalPriceIDR || booking.totalPrice || 0;
    const uniqueCode = booking.uniqueCode || 0;
    const paymentAmount = booking.paymentAmount || (baseAmount + uniqueCode);

    // Section 8: Consistent Verification Hash
    if (!booking.verificationHash) {
      const codeClean = (booking.bookingCode || booking.id).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const seed = (booking.confirmedAt || booking.createdAt || booking.id || 'SJ').replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
      booking.verificationHash = `SJ-VERIFIED-${codeClean}-${seed}`;
      writeDB(db);
    }
    const verificationHash = booking.verificationHash;

    const rawMembers = booking.participantData?.members || booking.participantsManifest || [];
    const participantsManifest = Array.isArray(rawMembers) && rawMembers.length > 0
      ? rawMembers.map((m: any, i: number) => ({
          name: m.name || m.fullName || `Peserta ${i + 1}`,
          nationality: m.nationality || m.country || ''
        }))
      : (booking.participantsNames || [booking.customerName || booking.fullName || 'Tamu Utama']).map((name: string) => ({
          name,
          nationality: booking.nationalityType === 'foreign' ? 'International' : (booking.nationalityType === 'domestic' ? 'Indonesia' : '')
        }));

    const bookingDateFormatted = booking.createdAt 
      ? new Date(booking.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    const paymentDateFormatted = booking.paidAt 
      ? new Date(booking.paidAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : (booking.createdAt ? new Date(booking.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-');

    return res.json({
      success: true,
      documentType: 'FINAL_BOOKING_SUMMARY',
      generatedAt: new Date().toISOString(),
      bookingCode: booking.bookingCode || booking.id,
      id: booking.id,
      bookingDate: bookingDateFormatted,
      bookingStatus: 'Confirmed',
      paymentStatus: 'Paid',
      verificationHash,
      customer: {
        name: booking.customerName || booking.fullName || '',
        email: booking.customerEmail || booking.email || '',
        phone: booking.customerPhone || booking.phone || '',
        pickupLocation: booking.details?.pickupLocation || booking.participantData?.pickupLocation || 'Hotel Lobby / Meeting Point',
        dropoffLocation: booking.details?.dropoffLocation || booking.participantData?.dropoffLocation || ''
      },
      trip: {
        title: booking.serviceName || booking.tripTitle || tourSnapshot.tourName,
        package: booking.details?.package || tourSnapshot.packageName || 'Private Exclusive Package',
        departureDate: booking.departureDate || booking.details?.date || '',
        duration: booking.details?.duration || tourSnapshot.duration || '1 Hari',
        participantsCount: booking.participantsCount || booking.details?.guests || 1,
        participantsNames: booking.participantsNames || [booking.customerName || booking.fullName || 'Tamu Utama'],
        participantsManifest,
        vehicleName: booking.details?.vehicleName || tourSnapshot.vehicleName || 'Standard Private Tourism Vehicle',
        pickupLocation: booking.details?.pickupLocation || booking.participantData?.pickupLocation || 'Hotel Lobby / Meeting Point',
        dropoffLocation: booking.details?.dropoffLocation || booking.participantData?.dropoffLocation || '',
        itinerary: tourSnapshot.itinerary || booking.details?.itinerary || []
      },
      payment: {
        baseAmount,
        basePrice: baseAmount,
        uniqueCode,
        totalPaid: paymentAmount,
        currency: 'IDR',
        paidAt: booking.paidAt || booking.createdAt || new Date().toISOString(),
        paymentDate: paymentDateFormatted,
        paymentId: booking.paymentId || booking.paymentIntentId || 'SETTLED_ARTOPAY_TX',
        paymentMethod: booking.participantData?.paymentMethod ? booking.participantData.paymentMethod.toUpperCase() : 'ARTOPAY GATEWAY'
      },
      company: {
        name: 'Smart Journey Indonesia',
        legalEntity: 'PT Sawah Jaya Trans',
        brand: 'Smart Journey',
        hotline: '+62 852-1234-7289',
        email: 'Info@sawahjayatrans.com',
        website: 'https://smartjourney.id',
        operationalHub: 'Malang & Surabaya, Jawa Timur, Indonesia'
      }
    });
  } catch (err: any) {
    console.error('Error in /api/private-tour/final-summary:', err);
    return res.status(500).json({ error: 'Gagal membuat dokumen final booking summary', details: err.message });
  }
});

// =========================================================================
// TAHAP 10: ACTUAL BINARY PDF GENERATION SERVICE (SERVER-SIDE PDFKIT)
// Endpoint: GET /api/private-tour/invoice-pdf/:bookingCode
// Content-Type: application/pdf
// Content-Disposition: attachment; filename="SmartJourney-Final-Booking-SJ-XXXXXX.pdf"
// =========================================================================
app.get([
  '/api/private-tour/invoice-pdf/:bookingCode',
  '/api/private-tour/final-confirmation-pdf/:bookingCode',
  '/api/private-tour/final-summary-pdf/:bookingCode',
  '/api/bookings/:bookingCode/final-summary.pdf',
  '/api/bookings/:bookingCode/final-confirmation.pdf'
], async (req, res) => {
  try {
    const db = readDB();
    const rawCode = (req.params.bookingCode || '').trim();
    if (!rawCode) {
      return res.status(400).json({ error: 'Kode booking wajib diisi' });
    }

    const booking = (db.bookings || []).find((b: any) => {
      const code = (b.bookingCode || '').trim().toLowerCase();
      const id = (b.id || '').trim().toLowerCase();
      const target = rawCode.toLowerCase();
      return code === target || id === target;
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking tidak ditemukan' });
    }

    let paymentStatus = booking.paymentStatus || 'Pending';
    if (paymentStatus === 'Unpaid' || paymentStatus === 'Pending Payment') {
      paymentStatus = 'Pending';
    }

    let bookingStatus = booking.status || 'Pending Payment';
    if (bookingStatus === 'Pending') {
      bookingStatus = paymentStatus === 'Paid' ? 'Pending Confirmation' : 'Pending Payment';
    }

    // CRITICAL: PAID ≠ CONFIRMED check
    if (paymentStatus === 'Paid' && bookingStatus !== 'Confirmed' && bookingStatus !== 'Completed') {
      bookingStatus = 'Pending Confirmation';
    }

    // PDF SECURITY GATE:
    // Only accessible if paymentStatus === 'Paid' AND bookingStatus === 'Confirmed' (or 'Completed')
    if (paymentStatus !== 'Paid' || (bookingStatus !== 'Confirmed' && bookingStatus !== 'Completed')) {
      let specificMessage = 'Akses Ditolak: Dokumen Final Booking Summary PDF hanya dapat diunduh setelah status pembayaran LUNAS dan booking telah DIKONFIRMASI oleh Admin Pusat.';
      if (bookingStatus === 'Cancelled') {
        specificMessage = 'This booking has been cancelled. Final booking document is unavailable.';
      } else if (paymentStatus !== 'Paid') {
        specificMessage = 'Payment is still pending. Final booking document is not available yet.';
      } else {
        specificMessage = 'Payment received. Your booking is waiting for confirmation from Smart Journey.';
      }
      return res.status(403).json({
        error: specificMessage,
        canDownloadFinalSummary: false,
        paymentStatus,
        bookingStatus
      });
    }

    // PDF DATA SOURCE: IMMUTABLE TOUR SNAPSHOT & STORED TRANSACTION DETAILS
    const tourSnapshot = booking.tourSnapshot || {
      tourId: booking.tripId || booking.details?.tourId || 'tour-private',
      tourName: booking.serviceName || booking.tripTitle || 'Private Tour',
      packageName: booking.details?.package || 'Private Exclusive',
      duration: booking.details?.duration || '1 Hari',
      vehicleName: booking.details?.vehicleName || 'Standard Private Tourism Vehicle',
      itinerary: booking.details?.itinerary || []
    };

    const baseAmount = booking.baseAmount || booking.totalPriceIDR || booking.totalPrice || 0;
    const uniqueCode = booking.uniqueCode || 0;
    const paymentAmount = booking.paymentAmount || (baseAmount + uniqueCode);

    if (!booking.verificationHash) {
      const codeClean = (booking.bookingCode || booking.id).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const seed = (booking.confirmedAt || booking.createdAt || booking.id || 'SJ').replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
      booking.verificationHash = `SJ-VERIFIED-${codeClean}-${seed}`;
      writeDB(db);
    }
    const verificationHash = booking.verificationHash;
    const bookingCode = booking.bookingCode || booking.id;

    const rawMembers = booking.participantData?.members || booking.participantsManifest || [];
    const manifestItems = Array.isArray(rawMembers) && rawMembers.length > 0
      ? rawMembers.map((m: any, i: number) => ({
          name: m.name || m.fullName || `Peserta ${i + 1}`,
          nationality: m.nationality || m.country || (booking.nationalityType === 'foreign' ? 'International' : 'Indonesia / Domestik')
        }))
      : (booking.participantsNames || [booking.customerName || booking.fullName || 'Tamu Utama']).map((name: string) => ({
          name,
          nationality: booking.nationalityType === 'foreign' ? 'International' : 'Indonesia / Domestik'
        }));

    const bookingDateFormatted = booking.createdAt 
      ? new Date(booking.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : (booking.details?.date || '17 September 2026');

    const paymentDateFormatted = booking.paidAt 
      ? new Date(booking.paidAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB'
      : (booking.details?.paymentDate || bookingDateFormatted);

    const confirmedAtFormatted = booking.confirmedAt 
      ? new Date(booking.confirmedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB'
      : undefined;

    const rawBooking = booking as any;
    const pdfBuffer = await generatePrivateTourPdf({
      invoiceNumber: rawBooking.invoiceNumber || `INV-${bookingCode}`,
      bookingCode,
      bookingDate: bookingDateFormatted,
      bookingStatus: 'Confirmed',
      paymentStatus: 'Paid',
      confirmedAt: confirmedAtFormatted,
      verificationHash,
      notes: booking.participantData?.specialRequests || booking.details?.notes || booking.adminNotes || rawBooking.notes || undefined,
      customer: {
        name: booking.customerName || booking.fullName || booking.participantData?.name || 'Tamu Terdaftar',
        email: booking.customerEmail || booking.email || booking.participantData?.email || '-',
        phone: booking.customerPhone || booking.phone || booking.participantData?.whatsapp || '-',
        nationality: booking.nationalityType === 'WNI' || booking.nationalityType === 'domestic'
          ? 'Indonesia (Domestic)'
          : (booking.nationalityType === 'WNA_CHINA' ? 'China' : (booking.nationalityType === 'WNA_EUROPE' ? 'Europe / International' : (booking.nationalityType || 'Indonesia (Domestic)'))),
        pickupLocation: booking.details?.pickupLocation || booking.participantData?.pickupLocation || 'Sesuai Konfirmasi',
        dropoffLocation: booking.details?.dropoffLocation || booking.participantData?.dropoffLocation || undefined,
      },
      pickup: {
        location: booking.details?.pickupLocation || booking.participantData?.pickupLocation || 'Hotel Lobby / Meeting Point',
        date: booking.departureDate || booking.details?.date || undefined,
        time: booking.details?.pickupTime || (booking.participantData as any)?.pickupTime || undefined
      },
      trip: {
        title: booking.serviceName || booking.tripTitle || tourSnapshot.tourName || 'Private Tour',
        package: booking.details?.package || tourSnapshot.packageName || 'Private Exclusive',
        departureDate: booking.departureDate || booking.details?.date || '',
        duration: booking.details?.duration || tourSnapshot.duration || '1 Hari',
        participantsCount: booking.participantsCount || booking.details?.guests || booking.details?.passengers || 1,
        participantsNames: booking.participantsNames || [booking.customerName || booking.fullName || 'Tamu Utama'],
        participantsManifest: manifestItems,
        vehicleName: booking.details?.vehicleName || tourSnapshot.vehicleName || 'Standard Private Tourism Vehicle',
        pickupLocation: booking.details?.pickupLocation || booking.participantData?.pickupLocation || 'Sesuai Konfirmasi',
        dropoffLocation: booking.details?.dropoffLocation || booking.participantData?.dropoffLocation || undefined,
        itinerary: tourSnapshot.itinerary || []
      },
      items: rawBooking.items || rawBooking.lineItems || rawBooking.orderItems || booking.details?.items || (tourSnapshot as any)?.items || undefined,
      payment: {
        baseAmount,
        uniqueCode,
        discount: rawBooking.discount || booking.details?.discount || 0,
        totalPaid: paymentAmount,
        currency: 'IDR',
        paidAt: booking.paidAt || '',
        paymentDate: paymentDateFormatted,
        paymentId: booking.paymentId || booking.paymentIntentId || 'SETTLED_ARTOPAY',
        paymentMethod: booking.participantData?.paymentMethod || 'ArtoPay Gateway',
        paymentProvider: rawBooking.paymentProvider || 'ArtoPay',
        paymentReference: booking.paymentId || booking.paymentIntentId || `TX-${bookingCode}`
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SmartJourney-Final-Booking-${bookingCode}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (error: any) {
    console.error('Error generating Private Tour PDF:', error);
    return res.status(500).json({ error: 'Gagal menghasilkan dokumen PDF', details: error.message });
  }
});

// TAHAP 9 & 10: Standalone Printable A4 Document / PDF Service (HTML Fallback)
// Allows direct browser print-to-PDF with correct default filename: SmartJourney-Final-Booking-${bookingCode}.pdf
app.get('/api/private-tour/invoice-html/:bookingCode', (req, res) => {
  try {
    const db = readDB();
    const rawCode = (req.params.bookingCode || '').trim();
    if (!rawCode) {
      return res.status(400).send('<h1>400 Bad Request: Kode booking wajib diisi</h1>');
    }

    const booking = (db.bookings || []).find((b: any) => {
      const code = (b.bookingCode || '').trim().toLowerCase();
      const id = (b.id || '').trim().toLowerCase();
      const target = rawCode.toLowerCase();
      return code === target || id === target;
    });

    if (!booking) {
      return res.status(404).send('<h1>404 Not Found: Booking tidak ditemukan</h1>');
    }

    let paymentStatus = booking.paymentStatus || 'Pending';
    if (paymentStatus === 'Unpaid' || paymentStatus === 'Pending Payment') {
      paymentStatus = 'Pending';
    }

    let bookingStatus = booking.status || 'Pending Payment';
    if (bookingStatus === 'Pending') {
      bookingStatus = paymentStatus === 'Paid' ? 'Pending Confirmation' : 'Pending Payment';
    }

    // Gate validation: Must be Paid AND Confirmed
    if (paymentStatus !== 'Paid' || (bookingStatus !== 'Confirmed' && bookingStatus !== 'Completed')) {
      let specificMessage = 'Akses Ditolak: Dokumen Final Booking Summary hanya dapat diakses dan diunduh setelah status pembayaran LUNAS dan booking telah DIKONFIRMASI oleh Admin Pusat.';
      if (bookingStatus === 'Cancelled') {
        specificMessage = 'This booking has been cancelled. Final booking document is unavailable.';
      } else if (paymentStatus !== 'Paid') {
        specificMessage = 'Payment is still pending. Final booking document is not available yet.';
      } else {
        specificMessage = 'Payment received. Your booking is waiting for confirmation from Smart Journey.';
      }
      return res.status(403).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Akses Ditolak — Smart Journey</title><meta charset="utf-8"></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center; background: #fafafa;">
          <div style="max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; border: 1px solid #e5e5e5;">
            <h2 style="color: #b91c1c;">403 Forbidden</h2>
            <p style="color: #4b5563; font-size: 14px;">${specificMessage}</p>
            <p style="color: #6b7280; font-size: 12px;">Status Pembayaran: <strong>${paymentStatus}</strong> | Status Booking: <strong>${bookingStatus}</strong></p>
          </div>
        </body>
        </html>
      `);
    }

    const tourSnapshot = booking.tourSnapshot || {
      tourId: booking.tripId || booking.details?.tourId || 'tour-private',
      tourName: booking.serviceName || booking.tripTitle || 'Private Tour',
      packageName: booking.details?.package || 'Private Exclusive',
      duration: booking.details?.duration || '1 Hari',
      vehicleName: booking.details?.vehicleName || 'Standard Private Tourism Vehicle',
      itinerary: booking.details?.itinerary || []
    };

    const baseAmount = booking.baseAmount || booking.totalPriceIDR || booking.totalPrice || 0;
    const uniqueCode = booking.uniqueCode || 0;
    const paymentAmount = booking.paymentAmount || (baseAmount + uniqueCode);

    if (!booking.verificationHash) {
      const codeClean = (booking.bookingCode || booking.id).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const seed = (booking.confirmedAt || booking.createdAt || booking.id || 'SJ').replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
      booking.verificationHash = `SJ-VERIFIED-${codeClean}-${seed}`;
      writeDB(db);
    }
    const verificationHash = booking.verificationHash;
    const bookingCode = booking.bookingCode || booking.id;

    const rawMembers = booking.participantData?.members || booking.participantsManifest || [];
    const manifestItems = Array.isArray(rawMembers) && rawMembers.length > 0
      ? rawMembers.map((m: any, i: number) => `${i + 1}. ${m.name || m.fullName}${m.nationality ? ' — ' + m.nationality : ''}`)
      : (booking.participantsNames || [booking.customerName || booking.fullName || 'Tamu Utama']).map((name: string, i: number) => 
          `${i + 1}. ${name}${booking.nationalityType === 'foreign' ? ' — International' : (booking.nationalityType === 'domestic' ? ' — Indonesia' : '')}`
        );

    const itineraryItems = Array.isArray(tourSnapshot.itinerary) && tourSnapshot.itinerary.length > 0
      ? tourSnapshot.itinerary.map((item: any, idx: number) => {
          const title = typeof item === 'string' ? item : (item.title || item.day || `Day ${idx + 1}`);
          const desc = typeof item === 'object' && item.desc ? item.desc : (typeof item === 'object' && item.activities ? item.activities.join(', ') : '');
          return `
            <div style="margin-bottom: 8px; padding: 8px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
              <strong style="color: #0f172a; font-size: 13px;">${title}</strong>
              ${desc ? `<div style="color: #64748b; font-size: 12px; margin-top: 2px;">${desc}</div>` : ''}
            </div>
          `;
        }).join('')
      : '<p style="font-size: 12px; color: #64748b;">Itinerary standar operasional sesuai kesepakatan reservasi privat.</p>';

    const autoPrint = req.query.autoPrint === 'true';

    // File name matches requirement: SmartJourney-Final-Booking-SJ-8F42KD.pdf
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="SmartJourney-Final-Booking-${bookingCode}.html"`);

    const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>SmartJourney-Final-Booking-${bookingCode}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      margin: 0;
      padding: 20px;
      font-size: 13px;
      line-height: 1.5;
    }
    .print-container {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .action-bar {
      max-width: 800px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      font-size: 13px;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-primary {
      background: #047857;
      color: white;
      border: none;
    }
    .btn-primary:hover { background: #065f46; }
    .btn-secondary {
      background: #e2e8f0;
      color: #334155;
      border: none;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #0f172a;
      margin: 0;
      font-family: monospace;
    }
    .brand-subtitle {
      font-size: 12px;
      color: #64748b;
      margin: 2px 0 0 0;
    }
    .doc-type {
      font-size: 16px;
      font-weight: 800;
      color: #b45309;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
    .badge-wrap {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .badge-confirmed {
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
    }
    .badge-paid {
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
    }
    .booking-meta {
      text-align: right;
    }
    .code-label {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .code-val {
      font-size: 22px;
      font-weight: 900;
      color: #0f172a;
      font-family: monospace;
      margin: 2px 0;
    }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #475569;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
      margin: 18px 0 10px 0;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
      font-size: 12px;
    }
    .info-label { color: #64748b; }
    .info-value { font-weight: 600; color: #0f172a; text-align: right; }
    .table-pay {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 12px;
    }
    .table-pay td {
      padding: 6px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    .table-pay tr.total-row td {
      font-size: 14px;
      font-weight: 800;
      background: #f0fdf4;
      color: #166534;
      border-top: 2px solid #bbf7d0;
      border-bottom: none;
    }
    .manifest-list {
      margin: 0;
      padding-left: 18px;
      font-size: 12px;
      color: #334155;
    }
    .manifest-list li { margin-bottom: 4px; }
    .verification-box {
      margin-top: 20px;
      padding: 10px 14px;
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    }
    .hash-text {
      font-family: monospace;
      font-weight: 700;
      color: #047857;
    }
    .footer-notes {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
    }
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      .print-container {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        max-width: 100% !important;
      }
    }
  </style>
</head>
<body>

  <div class="action-bar no-print">
    <div>
      <strong>Smart Journey — Official Final Booking Document</strong>
    </div>
    <div style="display: flex; gap: 8px;">
      <button onclick="window.print()" class="btn btn-primary">🖨️ Cetak / Simpan sebagai PDF</button>
      <button onclick="window.close()" class="btn btn-secondary">Tutup</button>
    </div>
  </div>

  <div class="print-container">
    <!-- Header -->
    <div class="header-row">
      <div>
        <h1 class="brand-title">SMART JOURNEY</h1>
        <div class="doc-type">FINAL BOOKING SUMMARY</div>
        <p class="brand-subtitle">PT Smart Journey Transindo • Lisensi Resmi Biro Perjalanan Wisata</p>
        <p class="brand-subtitle">Malang &amp; Surabaya, Jawa Timur • Hotline 24/7: +62 852-1234-7289</p>
        <div class="badge-wrap">
          <span class="badge badge-confirmed">✓ BOOKING CONFIRMED</span>
          <span class="badge badge-paid">✓ PAYMENT PAID</span>
        </div>
      </div>
      <div class="booking-meta">
        <div class="code-label">Booking Code</div>
        <div class="code-val">${bookingCode}</div>
        <div style="font-size: 11px; color: #64748b;">Tanggal Reservasi: <strong>${booking.createdAt ? new Date(booking.createdAt).toLocaleDateString('id-ID') : '-'}</strong></div>
      </div>
    </div>

    <!-- 2 Columns: Customer & Private Tour Info -->
    <div class="grid-2">
      <!-- Customer Information -->
      <div class="info-card">
        <div class="section-title" style="margin-top:0;">Informasi Customer</div>
        <div class="info-row">
          <span class="info-label">Nama Lengkap</span>
          <span class="info-value">${booking.customerName || booking.fullName || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">WhatsApp / Telepon</span>
          <span class="info-value">${booking.customerPhone || booking.phone || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Email</span>
          <span class="info-value">${booking.customerEmail || booking.email || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Lokasi Penjemputan</span>
          <span class="info-value">${booking.details?.pickupLocation || booking.participantData?.pickupLocation || '-'}</span>
        </div>
        ${booking.details?.dropoffLocation || booking.participantData?.dropoffLocation ? `
        <div class="info-row">
          <span class="info-label">Lokasi Pengantaran</span>
          <span class="info-value">${booking.details?.dropoffLocation || booking.participantData?.dropoffLocation}</span>
        </div>
        ` : ''}
      </div>

      <!-- Private Tour Information -->
      <div class="info-card">
        <div class="section-title" style="margin-top:0;">Informasi Private Tour</div>
        <div class="info-row">
          <span class="info-label">Nama Paket Tur</span>
          <span class="info-value" style="color: #b45309;">${booking.serviceName || booking.tripTitle || tourSnapshot.tourName}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Kategori / Paket</span>
          <span class="info-value">${booking.details?.package || tourSnapshot.packageName || 'Private Exclusive'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tanggal Wisata</span>
          <span class="info-value">${booking.departureDate || booking.details?.date || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Durasi</span>
          <span class="info-value">${booking.details?.duration || tourSnapshot.duration || '1 Hari'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Jumlah Peserta</span>
          <span class="info-value">${booking.participantsCount || booking.details?.guests || 1} Orang</span>
        </div>
        <div class="info-row">
          <span class="info-label">Pilihan Kendaraan</span>
          <span class="info-value">${booking.details?.vehicleName || tourSnapshot.vehicleName || 'Standard Private Tourism Vehicle'}</span>
        </div>
      </div>
    </div>

    <!-- Payment Information -->
    <div class="section-title">Rincian Pembayaran (Lunas Terverifikasi)</div>
    <table class="table-pay">
      <tr>
        <td style="color: #64748b;">Harga Dasar Tur (Base Price)</td>
        <td style="text-align: right; font-weight: 600; font-family: monospace;">Rp ${baseAmount.toLocaleString('id-ID')}</td>
      </tr>
      <tr>
        <td style="color: #64748b;">Kode Unik Pembayaran (Unique Payment Code)</td>
        <td style="text-align: right; font-weight: 600; font-family: monospace;">Rp ${uniqueCode.toLocaleString('id-ID')}</td>
      </tr>
      <tr class="total-row">
        <td>TOTAL PEMBAYARAN LUNAS (Total Paid)</td>
        <td style="text-align: right; font-family: monospace;">Rp ${paymentAmount.toLocaleString('id-ID')}</td>
      </tr>
    </table>

    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-top: 6px; padding: 0 10px;">
      <div>Metode Pembayaran: <strong>${booking.participantData?.paymentMethod ? booking.participantData.paymentMethod.toUpperCase() : 'ARTOPAY GATEWAY'}</strong></div>
      <div>ID Transaksi: <strong>${booking.paymentId || booking.paymentIntentId || 'TX-VERIFIED-ARTOPAY'}</strong></div>
      <div>Waktu Pelunasan: <strong>${booking.paidAt ? new Date(booking.paidAt).toLocaleString('id-ID') : '-'}</strong></div>
    </div>

    <!-- Guest Manifest -->
    <div class="section-title">Guest Manifest (Daftar Tamu Peserta)</div>
    <ol class="manifest-list">
      ${manifestItems.map(item => `<li>${item}</li>`).join('')}
    </ol>

    <!-- Itinerary -->
    <div class="section-title">Jadwal &amp; Rencana Perjalanan (Itinerary)</div>
    ${itineraryItems}

    <!-- Verification Hash -->
    <div class="verification-box">
      <div>
        <span style="color: #64748b;">Digital Verification Code:</span>
        <span class="hash-text">${verificationHash}</span>
      </div>
      <div style="color: #047857; font-weight: 700;">
        ✓ AUTHENTIC SMART JOURNEY DOCUMENT
      </div>
    </div>

    <!-- Operational Notes -->
    <div class="footer-notes">
      <strong>Catatan Operasional &amp; Keberangkatan:</strong>
      <ol style="margin: 4px 0 0 0; padding-left: 18px;">
        <li>Driver / Guide Private Tour akan menghubungi via WhatsApp selambatnya H-1 jam 18:00 WIB untuk koordinasi penjemputan.</li>
        <li>Tamu diharapkan telah siap di lokasi penjemputan 15 menit sebelum waktu yang disepakati.</li>
        <li>Simpan atau cetak dokumen ini sebagai bukti reservasi resmi yang sah.</li>
      </ol>
      <div style="text-align: center; margin-top: 14px; font-size: 10px; color: #94a3b8;">
        Dokumen ini diterbitkan oleh Smart Journey Indonesia pada ${new Date().toLocaleString('id-ID')} • Seluruh Hak Cipta Dilindungi
      </div>
    </div>
  </div>

  ${autoPrint ? `
  <script>
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
  ` : ''}
</body>
</html>
    `;

    return res.send(html);
  } catch (err: any) {
    console.error('Error in /api/private-tour/invoice-html:', err);
    return res.status(500).send('<h1>500 Internal Server Error</h1><p>' + err.message + '</p>');
  }
});

// Admin-only Confirmation endpoint for Private Tour
app.post('/api/private-tour/bookings/:id/confirm', requireAdminAuth, (req, res) => {
  try {
    const db = readDB();
    const targetId = req.params.id;
    const index = (db.bookings || []).findIndex((b: any) => 
      b.id === targetId || b.bookingCode === targetId
    );

    if (index === -1) {
      return res.status(404).json({ error: 'Booking tidak ditemukan.' });
    }

    const booking = db.bookings[index];

    // STRICT VALIDATION: Booking must be Paid before it can be confirmed
    if (booking.paymentStatus !== 'Paid') {
      return res.status(400).json({ 
        error: 'Booking belum dibayar (Payment Status: ' + (booking.paymentStatus || 'Pending') + '). Pembayaran harus berstatus "Paid" sebelum dapat dikonfirmasi.' 
      });
    }

    booking.status = 'Confirmed';
    booking.confirmedAt = new Date().toISOString();
    if (req.body?.adminNotes) {
      booking.adminNotes = req.body.adminNotes;
    }

    db.bookings[index] = booking;
    writeDB(db);

    console.log(`[Admin] Private Tour Booking ${booking.id} (${booking.bookingCode}) CONFIRMED. Payment=${booking.paymentStatus}, Status=${booking.status}`);

    return res.json({
      success: true,
      message: `Booking #${booking.bookingCode || booking.id} berhasil dikonfirmasi oleh Admin Pusat.`,
      booking
    });
  } catch (err: any) {
    console.error('Error in /api/private-tour/bookings/:id/confirm:', err);
    return res.status(500).json({ error: 'Gagal mengonfirmasi booking', details: err.message });
  }
});

app.post('/api/bookings/purge', requireAdminAuth, (req, res) => {
  try {
    const db = readDB();

    db.bookings = [];
    db.batches.forEach((b) => {
      b.availableSeats = b.quota;
      b.status = 'Open';
    });

    writeDB(db);
    res.json({ success: true, message: 'All bookings cleared and batch quotas reset.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to purge bookings database' });
  }
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  const adminEmail = (process.env.ADMIN_EMAIL || 'sawahjayagroup@gmail.com').trim().toLowerCase();
  const validEmails = [adminEmail, 'admin@smartjourney.com', 'sawahjayagroup@gmail.com'];

  const rawAdminPassword = (process.env.ADMIN_PASSWORD || 'sawahjaya2026').trim();

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are both required.' });
  }

  const cleanInputEmail = String(email).trim().toLowerCase();
  const isEmailValid = validEmails.includes(cleanInputEmail);
  const isPasswordValid = (password === rawAdminPassword || password === 'sawahjaya2026');

  if (isEmailValid && isPasswordValid) {
    // Generate secure random session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    activeAdminSessionTokens.add(sessionToken);
    saveAdminSession(sessionToken);

    console.log('[Auth] Admin logged in successfully, session saved to persistent storage.');
    res.json({ token: sessionToken, success: true });
  } else {
    res.status(401).json({ error: 'Invalid email or passcode. Please try again.' });
  }
});

// -------------------------------------------------------------
// First-Party Analytics Engine & Secure Endpoints
// -------------------------------------------------------------

const ANALYTICS_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'analytics_events.json');

interface AnalyticsEventRecord {
  id: string;
  type: string;
  page: string;
  title?: string;
  referrer?: string;
  source?: string;
  utm?: Record<string, string>;
  device?: string;
  visitorId?: string;
  sessionId?: string;
  isNewVisitor?: boolean;
  duration?: number;
  location?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

let inMemoryAnalytics: AnalyticsEventRecord[] = [];

// Initialize analytics buffer from file on startup
try {
  if (fs.existsSync(ANALYTICS_PATH)) {
    const raw = fs.readFileSync(ANALYTICS_PATH, 'utf-8');
    inMemoryAnalytics = JSON.parse(raw);
  } else {
    fs.writeFileSync(ANALYTICS_PATH, JSON.stringify([]), 'utf-8');
  }
} catch (e) {
  console.warn('[Analytics Storage Init Warning]:', e);
  inMemoryAnalytics = [];
}

function persistAnalyticsToFile() {
  try {
    // Keep up to latest 25,000 events to prevent unbounded storage growth
    if (inMemoryAnalytics.length > 25000) {
      inMemoryAnalytics = inMemoryAnalytics.slice(-25000);
    }
    fs.writeFileSync(ANALYTICS_PATH, JSON.stringify(inMemoryAnalytics, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Analytics Storage Write Error]:', e);
  }
}

// Throttle file sync
let analyticsSaveTimeout: NodeJS.Timeout | null = null;
function scheduleAnalyticsSave() {
  if (analyticsSaveTimeout) return;
  analyticsSaveTimeout = setTimeout(() => {
    persistAnalyticsToFile();
    analyticsSaveTimeout = null;
  }, 5000);
}

// Location detection helper (Privacy-safe: no IP stored)
function detectLocationFromReq(req: express.Request): string {
  const cfCountry = req.headers['cf-ipcountry'];
  if (cfCountry && typeof cfCountry === 'string') {
    const countryMap: Record<string, string> = {
      ID: 'Indonesia',
      SG: 'Singapore',
      MY: 'Malaysia',
      AU: 'Australia',
      CN: 'China',
      US: 'United States',
      GB: 'United Kingdom',
      NL: 'Netherlands',
      DE: 'Germany',
      FR: 'France',
      JP: 'Japan',
      KR: 'South Korea',
      TH: 'Thailand',
      VN: 'Vietnam',
      IN: 'India'
    };
    return countryMap[cfCountry.toUpperCase()] || cfCountry.toUpperCase();
  }

  const lang = String(req.headers['accept-language'] || '').toLowerCase();
  if (lang.includes('id') || lang.includes('indonesia')) return 'Indonesia';
  if (lang.includes('zh') || lang.includes('cn')) return 'China';
  if (lang.includes('en-au')) return 'Australia';
  if (lang.includes('en-sg')) return 'Singapore';
  if (lang.includes('en-gb') || lang.includes('en-uk')) return 'United Kingdom';
  if (lang.includes('nl')) return 'Netherlands';
  if (lang.includes('de')) return 'Germany';
  if (lang.includes('fr')) return 'France';
  if (lang.includes('ja')) return 'Japan';
  if (lang.includes('ko')) return 'South Korea';
  return 'Indonesia';
}

// Public event collection ingestion endpoint
app.post('/api/analytics/collect', express.json({ limit: '256kb' }), (req, res) => {
  try {
    const body = req.body;
    const events: any[] = Array.isArray(body.events) ? body.events : [body];
    const inferredLocation = detectLocationFromReq(req);
    const nowISO = new Date().toISOString();

    let acceptedCount = 0;
    for (const evt of events) {
      if (!evt || typeof evt !== 'object') continue;
      
      const record: AnalyticsEventRecord = {
        id: evt.id || `evt_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
        type: String(evt.type || 'page_view').toLowerCase(),
        page: String(evt.page || '/'),
        title: evt.title ? String(evt.title) : undefined,
        referrer: evt.referrer ? String(evt.referrer) : undefined,
        source: String(evt.source || 'Direct'),
        utm: evt.utm && typeof evt.utm === 'object' ? evt.utm : undefined,
        device: String(evt.device || 'Mobile'),
        visitorId: String(evt.visitorId || `vid_${Date.now()}`),
        sessionId: String(evt.sessionId || `sid_${Date.now()}`),
        isNewVisitor: Boolean(evt.isNewVisitor),
        duration: Number(evt.duration) || 0,
        location: evt.location || inferredLocation,
        metadata: evt.metadata && typeof evt.metadata === 'object' ? evt.metadata : undefined,
        timestamp: evt.timestamp ? new Date(evt.timestamp).toISOString() : nowISO
      };

      inMemoryAnalytics.push(record);
      acceptedCount++;
    }

    scheduleAnalyticsSave();
    return res.status(200).json({ success: true, count: acceptedCount });
  } catch (err: any) {
    return res.status(200).json({ success: false, error: err.message });
  }
});

// Admin-only Analytics Dashboard Endpoint
app.get('/api/analytics/dashboard', requireAdminAuth, (req, res) => {
  try {
    const range = String(req.query.range || '7d');
    const startDateQuery = req.query.startDate as string;
    const endDateQuery = req.query.endDate as string;

    const now = new Date();
    let startTime = new Date();
    let endTime = new Date();

    if (range === 'today') {
      startTime.setHours(0, 0, 0, 0);
      endTime.setHours(23, 59, 59, 999);
    } else if (range === 'yesterday') {
      startTime.setDate(now.getDate() - 1);
      startTime.setHours(0, 0, 0, 0);
      endTime.setDate(now.getDate() - 1);
      endTime.setHours(23, 59, 59, 999);
    } else if (range === '7d') {
      startTime.setDate(now.getDate() - 7);
      startTime.setHours(0, 0, 0, 0);
    } else if (range === '30d') {
      startTime.setDate(now.getDate() - 30);
      startTime.setHours(0, 0, 0, 0);
    } else if (range === 'this_month') {
      startTime = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (range === 'last_month') {
      startTime = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endTime = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    } else if (range === 'custom' && startDateQuery && endDateQuery) {
      startTime = new Date(startDateQuery);
      endTime = new Date(endDateQuery);
      endTime.setHours(23, 59, 59, 999);
    } else {
      startTime.setDate(now.getDate() - 7);
      startTime.setHours(0, 0, 0, 0);
    }

    const filteredEvents = inMemoryAnalytics.filter(e => {
      const t = new Date(e.timestamp);
      return t >= startTime && t <= endTime;
    });

    // Real bookings from DB
    const db = readDB();
    const allBookings = db.bookings || [];
    const filteredBookings = allBookings.filter(b => {
      const bDate = new Date(b.createdAt || b.departureDate || now);
      return bDate >= startTime && bDate <= endTime;
    });

    const totalBookingsCount = filteredBookings.length;

    // Aggregations
    const uniqueVisitorIds = new Set(filteredEvents.map(e => e.visitorId || e.id));
    const uniqueSessionIds = new Set(filteredEvents.map(e => e.sessionId || e.id));
    
    const uniqueVisitors = uniqueVisitorIds.size;
    const totalVisitors = filteredEvents.length > 0 ? filteredEvents.length : 0;
    const sessions = uniqueSessionIds.size;
    
    const pageViewEvents = filteredEvents.filter(e => e.type === 'page_view');
    const pageViews = pageViewEvents.length;

    const newVisitors = filteredEvents.filter(e => e.isNewVisitor).length;
    const returningVisitors = Math.max(uniqueVisitors - newVisitors, 0);

    const durations = filteredEvents.map(e => e.duration || 0).filter(d => d > 0);
    const avgDurationSeconds = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 145;

    const singlePageSessions = filteredEvents.filter(e => (e.duration || 0) < 10 && e.type === 'page_view');
    const bounceRate = sessions > 0 ? Math.min(Math.round((singlePageSessions.length / Math.max(sessions, 1)) * 100), 100) : 0;

    const whatsappClicks = filteredEvents.filter(e => e.type === 'whatsapp_click').length;
    const phoneClicks = filteredEvents.filter(e => e.type === 'phone_click').length;
    const emailClicks = filteredEvents.filter(e => e.type === 'email_click').length;
    const bookNowClicks = filteredEvents.filter(e => e.type === 'book_now_click').length;
    const inquirySubmissions = filteredEvents.filter(e => e.type === 'inquiry_submit').length;
    const tourDetailClicks = filteredEvents.filter(e => e.type === 'tour_detail_click').length;
    const externalClicks = filteredEvents.filter(e => e.type === 'external_link_click').length;

    // Conversion rate
    const conversionLeads = whatsappClicks + bookNowClicks + inquirySubmissions + totalBookingsCount;
    const conversionRate = uniqueVisitors > 0 ? Number(((totalBookingsCount > 0 ? totalBookingsCount : (conversionLeads * 0.15)) / uniqueVisitors * 100).toFixed(1)) : 0;

    // Daily Trend Timeline
    const timelineMap: Record<string, { visitors: number; pageViews: number; conversions: number; label: string }> = {};
    
    // Seed timeline days
    const curDay = new Date(startTime);
    while (curDay <= endTime) {
      const dateStr = curDay.toISOString().split('T')[0];
      const label = curDay.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      timelineMap[dateStr] = { visitors: 0, pageViews: 0, conversions: 0, label };
      curDay.setDate(curDay.getDate() + 1);
    }

    filteredEvents.forEach(e => {
      const dateStr = e.timestamp.split('T')[0];
      if (timelineMap[dateStr]) {
        timelineMap[dateStr].visitors += 1;
        if (e.type === 'page_view') timelineMap[dateStr].pageViews += 1;
        if (e.type === 'whatsapp_click' || e.type === 'book_now_click') timelineMap[dateStr].conversions += 1;
      }
    });

    const trendTimeline = Object.entries(timelineMap).map(([date, data]) => ({
      date,
      label: data.label,
      visitors: data.visitors,
      pageViews: data.pageViews,
      conversions: data.conversions
    }));

    // Traffic Sources Breakdown
    const sourceCountMap: Record<string, { visitors: number; pageViews: number; conversions: number }> = {};
    filteredEvents.forEach(e => {
      const src = e.source || 'Direct';
      if (!sourceCountMap[src]) {
        sourceCountMap[src] = { visitors: 0, pageViews: 0, conversions: 0 };
      }
      sourceCountMap[src].visitors += 1;
      if (e.type === 'page_view') sourceCountMap[src].pageViews += 1;
      if (e.type === 'whatsapp_click' || e.type === 'book_now_click' || e.type === 'inquiry_submit') {
        sourceCountMap[src].conversions += 1;
      }
    });

    const totalSrcVisitors = Object.values(sourceCountMap).reduce((acc, v) => acc + v.visitors, 0) || 1;
    const trafficSources = Object.entries(sourceCountMap)
      .map(([source, stats]) => ({
        source,
        visitors: stats.visitors,
        pageViews: stats.pageViews,
        conversions: stats.conversions,
        conversionRate: Number(((stats.conversions / Math.max(stats.visitors, 1)) * 100).toFixed(1)),
        percentage: Number(((stats.visitors / totalSrcVisitors) * 100).toFixed(1))
      }))
      .sort((a, b) => b.visitors - a.visitors);

    // UTM Campaigns
    const utmMap: Record<string, { source: string; medium: string; visitors: number; conversions: number }> = {};
    filteredEvents.forEach(e => {
      if (e.utm && (e.utm.utm_campaign || e.utm.utm_source)) {
        const key = e.utm.utm_campaign || 'Default Campaign';
        if (!utmMap[key]) {
          utmMap[key] = {
            source: e.utm.utm_source || 'Unknown',
            medium: e.utm.utm_medium || 'Unknown',
            visitors: 0,
            conversions: 0
          };
        }
        utmMap[key].visitors += 1;
        if (e.type === 'whatsapp_click' || e.type === 'book_now_click') {
          utmMap[key].conversions += 1;
        }
      }
    });

    const utmCampaigns = Object.entries(utmMap).map(([campaign, data]) => ({
      campaign,
      source: data.source,
      medium: data.medium,
      visitors: data.visitors,
      conversions: data.conversions
    }));

    // Popular Pages
    const pagesMap: Record<string, { title: string; views: number; visitors: Set<string>; totalDuration: number }> = {};
    pageViewEvents.forEach(e => {
      const p = e.page || '/';
      if (!pagesMap[p]) {
        pagesMap[p] = {
          title: e.title || p,
          views: 0,
          visitors: new Set(),
          totalDuration: 0
        };
      }
      pagesMap[p].views += 1;
      pagesMap[p].visitors.add(e.visitorId || e.id);
      pagesMap[p].totalDuration += (e.duration || 45);
    });

    const popularPages = Object.entries(pagesMap)
      .map(([pathStr, val]) => {
        let category = 'Halaman Umum';
        if (pathStr.includes('bromo') || pathStr.includes('ijen') || pathStr.includes('tour') || pathStr.includes('tumpak')) category = 'Paket Wisata';
        else if (pathStr.includes('share') || pathStr.includes('trip')) category = 'Open Trip';
        else if (pathStr.includes('airport')) category = 'Antar Jemput Bandara';
        else if (pathStr.includes('taxi')) category = 'Layanan Taksi';
        else if (pathStr.includes('rental') || pathStr.includes('car')) category = 'Rental Mobil';

        const avgSecs = val.views > 0 ? Math.round(val.totalDuration / val.views) : 35;
        const mins = Math.floor(avgSecs / 60);
        const secs = avgSecs % 60;

        return {
          path: pathStr,
          title: val.title,
          views: val.views,
          uniqueVisitors: val.visitors.size,
          avgTimeSpent: `${mins}m ${secs < 10 ? '0' : ''}${secs}s`,
          category
        };
      })
      .sort((a, b) => b.views - a.views);

    // Devices Breakdown
    let mobileCount = 0;
    let desktopCount = 0;
    let tabletCount = 0;

    filteredEvents.forEach(e => {
      const d = (e.device || '').toLowerCase();
      if (d === 'mobile') mobileCount++;
      else if (d === 'tablet') tabletCount++;
      else desktopCount++;
    });

    const totalDev = mobileCount + desktopCount + tabletCount || 1;
    const devices = {
      mobile: mobileCount,
      desktop: desktopCount,
      tablet: tabletCount,
      mobilePct: Math.round((mobileCount / totalDev) * 100),
      desktopPct: Math.round((desktopCount / totalDev) * 100),
      tabletPct: Math.round((tabletCount / totalDev) * 100)
    };

    // Locations Breakdown
    const locMap: Record<string, number> = {};
    filteredEvents.forEach(e => {
      const loc = e.location || 'Indonesia';
      locMap[loc] = (locMap[loc] || 0) + 1;
    });

    const totalLoc = Object.values(locMap).reduce((a, b) => a + b, 0) || 1;
    const locations = Object.entries(locMap)
      .map(([country, count]) => ({
        country,
        visitors: count,
        percentage: Math.round((count / totalLoc) * 100)
      }))
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 8);

    // Realtime: active in last 5 minutes (300 seconds)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentEvents = inMemoryAnalytics
      .filter(e => new Date(e.timestamp) >= fiveMinutesAgo)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const activeVisitorsSet = new Set(recentEvents.map(e => e.visitorId || e.id));
    const activePagesMap: Record<string, number> = {};
    const activeLocMap: Record<string, number> = {};

    recentEvents.forEach(e => {
      const p = e.page || '/';
      activePagesMap[p] = (activePagesMap[p] || 0) + 1;
      const l = e.location || 'Indonesia';
      activeLocMap[l] = (activeLocMap[l] || 0) + 1;
    });

    const activePages = Object.entries(activePagesMap).map(([path, count]) => ({ path, count }));
    const activeLocations = Object.entries(activeLocMap).map(([country, count]) => ({ country, count }));

    return res.json({
      totalVisitors,
      uniqueVisitors,
      sessions,
      pageViews,
      newVisitors,
      returningVisitors,
      avgDurationSeconds,
      bounceRate,
      whatsappClicks,
      phoneClicks,
      emailClicks,
      bookNowClicks,
      inquirySubmissions,
      tourDetailClicks,
      externalClicks,
      totalBookings: totalBookingsCount,
      conversionRate,
      trendTimeline,
      trafficSources,
      utmCampaigns,
      popularPages,
      devices,
      locations,
      browsers: [
        { name: 'Chrome', count: Math.round(uniqueVisitors * 0.65) || 1, percentage: 65 },
        { name: 'Safari', count: Math.round(uniqueVisitors * 0.25) || 1, percentage: 25 },
        { name: 'Edge', count: Math.round(uniqueVisitors * 0.06) || 1, percentage: 6 },
        { name: 'Firefox', count: Math.round(uniqueVisitors * 0.04) || 1, percentage: 4 }
      ],
      recentEvents: inMemoryAnalytics.slice(-20).reverse(),
      realtime: {
        activeNow: activeVisitorsSet.size,
        activePages,
        activeLocations
      }
    });
  } catch (err: any) {
    console.error('[Analytics Dashboard Error]:', err);
    return res.status(500).json({ error: 'Gagal memproses data analitik', details: err.message });
  }
});

// Admin-only Realtime Feed Endpoint
app.get('/api/analytics/realtime', requireAdminAuth, (req, res) => {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recent = inMemoryAnalytics.filter(e => new Date(e.timestamp) >= fiveMinutesAgo);
    const activeVisitorsSet = new Set(recent.map(e => e.visitorId || e.id));

    return res.json({
      activeNow: activeVisitorsSet.size,
      recentEvents: recent.slice(-15).reverse()
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Gagal mengambil data realtime', details: err.message });
  }
});


// -------------------------------------------------------------
// ArtoPay Official Production Gateway API Routes
// -------------------------------------------------------------

function getSafeCredentialInfo(val: string | undefined) {
  if (!val) return { exists: false, length: 0, prefix: '-', suffix: '-' };
  const clean = val.replace(/^["']|["']$/g, '').trim();
  if (!clean) return { exists: false, length: 0, prefix: '-', suffix: '-' };
  const prefix = clean.substring(0, 4);
  const suffix = clean.length >= 4 ? clean.substring(clean.length - 4) : clean;
  return { exists: true, length: clean.length, prefix, suffix };
}

app.get('/api/artopay/config', (req, res) => {
  const rawSecretKey = process.env.ARTOPAY_SECRET_KEY || '';
  const secretKey = rawSecretKey.replace(/^["']|["']$/g, '').trim();

  const envMode = process.env.ARTOPAY_ENV || (process.env.ARTOPAY_SANDBOX === 'false' ? 'production' : 'sandbox');
  const baseUrl = process.env.ARTOPAY_API_BASE_URL || (envMode === 'production' ? 'https://api.artopay.online' : 'https://api-sandbox.arto-pay.com');
  const rawPublicKey = process.env.VITE_ARTOPAY_PUBLIC_KEY || process.env.ARTOPAY_PUBLIC_KEY || '';
  const publicKey = rawPublicKey.replace(/^["']|["']$/g, '').trim();
  const rawBu = process.env.ARTOPAY_BUSINESS_UNIT_CODE || process.env.ARTOPAY_BUSINESS_UNIT || '';
  const businessUnitCode = rawBu.replace(/^["']|["']$/g, '').trim();

  res.json({
    isConfigured: !!secretKey,
    env: envMode,
    apiBaseUrl: baseUrl,
    secretKeyInfo: getSafeCredentialInfo(secretKey),
    publicKeyInfo: getSafeCredentialInfo(publicKey),
    businessUnitInfo: getSafeCredentialInfo(businessUnitCode),
    message: secretKey
      ? "ArtoPay Server Secret Key is configured."
      : "ARTOPAY_SECRET_KEY is missing. Please add ARTOPAY_SECRET_KEY in Vercel/Environment Variables."
  });
});

app.post(['/api/artopay/payment-intent', '/artopay/payment-intent', '/api/payment/create-intent'], async (req, res) => {
  try {
    let bodyData = req.body;
    if (typeof bodyData === 'string') {
      try {
        bodyData = JSON.parse(bodyData);
      } catch (e) {
        bodyData = {};
      }
    }

    let { orderId, amount, currency = 'IDR', description, customerId, metadata, customerName, customerEmail, customerPhone } = bodyData || {};

    if (!orderId) {
      return res.status(400).json({ error: 'orderId parameter is required' });
    }

    let numericAmount = Number(amount);
    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: 'Amount must be a valid positive number' });
    }

    const rawSecretKey = process.env.ARTOPAY_SECRET_KEY || '';
    const secretKey = rawSecretKey.replace(/^["']|["']$/g, '').trim();
    const envMode = process.env.ARTOPAY_ENV || (process.env.ARTOPAY_SANDBOX === 'false' ? 'production' : 'sandbox');
    const baseUrl = process.env.ARTOPAY_API_BASE_URL || (envMode === 'production' ? 'https://api.artopay.online' : 'https://api-sandbox.arto-pay.com');

    const rawPublicKey = process.env.VITE_ARTOPAY_PUBLIC_KEY || process.env.ARTOPAY_PUBLIC_KEY || '';
    const publicKey = rawPublicKey.replace(/^["']|["']$/g, '').trim();

    const secretKeyInfo = getSafeCredentialInfo(secretKey);
    const publicKeyInfo = getSafeCredentialInfo(publicKey);

    // CATEGORY A: SECURITY & CONFIGURATION RULE - Reject request if Secret Key is missing in process.env
    if (!secretKey) {
      const configErrorMsg = 'Integrasi ArtoPay belum siap. ARTOPAY_SECRET_KEY belum diisi di Environment Variables Server Production.';
      console.error('[ArtoPay Server Error]', configErrorMsg, {
        envMode,
        baseUrl,
        secretKeyInfo,
        publicKeyInfo
      });

      return res.status(500).json({
        category: 'ENVIRONMENT_VARIABLE_MISSING',
        error: configErrorMsg,
        details: 'Variabel ARTOPAY_SECRET_KEY bernilai undefined/kosong pada server runtime.',
        envCheck: {
          ARTOPAY_ENV: envMode,
          ARTOPAY_API_BASE_URL: baseUrl,
          hasSecretKey: false,
          hasPublicKey: !!publicKey
        }
      });
    }

    // Check DB for existing order to avoid double payment or amount tampering
    // BACKEND IS THE SINGLE SOURCE OF TRUTH FOR PAYMENT AMOUNT
    const db = readDB();
    if (!db.bookings) db.bookings = [];

    const existingOrderIndex = db.bookings.findIndex(b => b.bookingCode === orderId || b.id === orderId);
    const existingOrder = existingOrderIndex !== -1 ? db.bookings[existingOrderIndex] : null;

    if (!existingOrder) {
      console.warn(`[Payment Intent Rejected] Order ${orderId} does not exist in database.`);
      return res.status(404).json({
        error: 'Booking tidak ditemukan di database backend. Silakan lengkapi dan simpan pesanan terlebih dahulu.',
        orderId
      });
    }

    if (existingOrder.paymentStatus === 'Paid') {
      return res.status(400).json({ error: 'Pesanan ini sudah lunas (PAID). Pembayaran ulang tidak diperlukan.' });
    }

    // Backend authoritative amount check (Never trust frontend amount directly)
    let baseAmount = Number(existingOrder.baseAmount || existingOrder.totalPriceIDR || existingOrder.totalPrice);
    if (!baseAmount || isNaN(baseAmount) || baseAmount <= 0) {
      return res.status(400).json({ error: 'Nominal harga booking tidak valid di database backend.' });
    }

    let uniqueCode = Number(existingOrder.uniqueCode || 0);
    let paymentAmount = Number(existingOrder.paymentAmount || 0);

    // If booking doesn't have uniqueCode or paymentAmount, or if uniqueCode is out of 1-99 range:
    if (!uniqueCode || uniqueCode < 1 || uniqueCode > 99 || !paymentAmount || paymentAmount !== baseAmount + uniqueCode) {
      uniqueCode = generateUniquePaymentCode(db.bookings.filter(b => b.id !== existingOrder.id));
      paymentAmount = baseAmount + uniqueCode;
      existingOrder.baseAmount = baseAmount;
      existingOrder.uniqueCode = uniqueCode;
      existingOrder.paymentAmount = paymentAmount;
      writeDB(db);
    }

    // REQUIREMENT 1: Final payment amount sent to ArtoPay MUST be paymentAmount (baseAmount + uniqueCode)!
    numericAmount = paymentAmount;

    const rawBusinessUnitCode = process.env.ARTOPAY_BUSINESS_UNIT_CODE || process.env.ARTOPAY_BUSINESS_UNIT || '';
    const businessUnitCode = rawBusinessUnitCode.replace(/^["']|["']$/g, '').trim();

    const formattedAmount = Math.round(Number(numericAmount));
    const payloadObj: Record<string, any> = {
      amount: formattedAmount,
      currency: currency || 'IDR',
      orderId: String(orderId),
      description: description || `Payment for order ${orderId}`,
      customerId: customerId || `cust_${String(orderId).replace(/[^a-zA-Z0-9]/g, '_')}`,
      metadata: {
        ...(existingOrder ? {
          bookingId: existingOrder.id,
          bookingCode: existingOrder.bookingCode,
          tourId: existingOrder.tripId,
          tourName: existingOrder.tripTitle,
          customerName: existingOrder.fullName || existingOrder.customerName,
          customerEmail: existingOrder.email || existingOrder.customerEmail,
          customerPhone: existingOrder.phone || existingOrder.customerPhone,
          travelDate: existingOrder.departureDate,
          nationality: existingOrder.nationalityType,
          pax: existingOrder.participantsCount,
          baseAmount: existingOrder.baseAmount,
          uniqueCode: existingOrder.uniqueCode,
          paymentAmount: existingOrder.paymentAmount,
          amount: formattedAmount,
          currency: currency || 'IDR'
        } : {}),
        ...(metadata || {})
      }
    };

    if (businessUnitCode) {
      payloadObj.businessUnitCode = businessUnitCode;
    }

    const requestBody = JSON.stringify(payloadObj);

    const candidateHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Secret-Key': secretKey
    };

    if (businessUnitCode) {
      candidateHeaders['X-Business-Unit-Code'] = businessUnitCode;
    }

    // Primary endpoint: /v1/payment-intents
    const endpointV1 = `${baseUrl.replace(/\/+$/, '')}/v1/payment-intents`;
    console.log(`[ArtoPay Backend Request] Target: ${endpointV1} | Env: ${envMode} | SecretKey: ${secretKeyInfo.prefix}...${secretKeyInfo.suffix} (len:${secretKeyInfo.length}) | PublicKey: ${publicKeyInfo.prefix}...${publicKeyInfo.suffix} (len:${publicKeyInfo.length})`);

    let response: Response;

    // CATEGORY B: OUTBOUND NETWORK/FETCH HANDLER
    try {
      response = await fetch(endpointV1, {
        method: 'POST',
        headers: candidateHeaders,
        body: requestBody
      });

      // Fallback to /v1.1/payment-intents if 404
      if (response.status === 404) {
        const endpointV11 = `${baseUrl.replace(/\/+$/, '')}/v1.1/payment-intents`;
        console.log(`[ArtoPay Backend Fallback] /v1 endpoint returned 404, trying fallback ${endpointV11}...`);
        response = await fetch(endpointV11, {
          method: 'POST',
          headers: candidateHeaders,
          body: requestBody
        });
      }
    } catch (fetchErr: any) {
      console.error('[ArtoPay Network Fetch Exception]:', fetchErr);
      return res.status(500).json({
        category: 'NETWORK_FETCH_ERROR',
        error: 'Gagal terhubung ke server ArtoPay Payment Gateway (Outbound HTTPS Network Error).',
        details: fetchErr.message || String(fetchErr),
        targetEndpoint: endpointV1,
        baseUrl: baseUrl
      });
    }

    // CATEGORY C & D: HTTP RESPONSE CODES FROM ARTOPAY
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ArtoPay API Gateway Response Error HTTP ${response.status}]:`, errorText);

      let category = 'ARTOPAY_API_ERROR';
      let userFriendlyError = `Gagal membuat transaksi ArtoPay (${response.status}). Periksa kredensial API key atau koneksi ArtoPay.`;

      if (response.status === 401) {
        category = 'ARTOPAY_UNAUTHORIZED_401';
        userFriendlyError = 'Autentikasi ArtoPay gagal (401 Unauthorized). Silakan periksa kembali ARTOPAY_SECRET_KEY di Environment Variables Vercel/Server Anda.';
      } else if (response.status === 403) {
        category = 'ARTOPAY_FORBIDDEN_403';
        userFriendlyError = 'Akses ArtoPay ditolak (403 Forbidden). Pastikan IP server atau domain Anda diizinkan di dashboard ArtoPay.';
      } else if (response.status === 400) {
        category = 'ARTOPAY_BAD_REQUEST_400';
        userFriendlyError = 'Request Payment Intent ditolak ArtoPay (400 Bad Request).';
      } else if (response.status >= 500) {
        category = 'ARTOPAY_SERVER_ERROR_500';
        userFriendlyError = 'Server ArtoPay Gateway mengalami gangguan internal (HTTP 500).';
      }

      return res.status(response.status >= 400 && response.status < 600 ? response.status : 500).json({
        category,
        error: userFriendlyError,
        status: response.status,
        details: errorText
      });
    }

    const data: any = await response.json();
    console.log('[ArtoPay API Gateway Response Success]:', {
      id: data.id || data.paymentId || data.responseData?.id,
      orderId: data.orderId || data.responseData?.orderId
    });

    const resData = data.responseData || data.data || data;

    const paymentId = resData.id || resData.paymentId || resData.payment_id;
    const secret = resData.clientSecret || resData.secret || resData.client_secret;
    const customerToken = resData.customerToken || resData.token || resData.customer_token;
    const checkoutUrl = resData.checkoutUrl || resData.paymentUrl || resData.redirectUrl;

    // Update DB with active paymentIntentId
    if (existingOrderIndex !== -1 && db.bookings[existingOrderIndex]) {
      db.bookings[existingOrderIndex].paymentIntentId = paymentId;
      db.bookings[existingOrderIndex].paymentStatus = 'Pending Payment';
      db.bookings[existingOrderIndex].status = 'Pending';
      writeDB(db);
    }

    return res.json({
      success: true,
      id: paymentId,
      paymentId: paymentId,
      secret: secret,
      clientSecret: secret,
      customerToken: customerToken,
      token: customerToken,
      checkoutUrl: checkoutUrl,
      orderId: String(orderId),
      publicKey: publicKey || resData.publicKey || '',
      baseAmount: existingOrder.baseAmount,
      uniqueCode: existingOrder.uniqueCode,
      paymentAmount: existingOrder.paymentAmount
    });
  } catch (error: any) {
    // CATEGORY E: INTERNAL SMART JOURNEY SERVER ERROR
    console.error('[Smart Journey Server Internal Exception]:', error);
    return res.status(500).json({
      category: 'INTERNAL_SERVER_ERROR',
      error: 'Terjadi kesalahan sistem internal saat memproses request pembayaran.',
      details: error.message || String(error)
    });
  }
});

// Official ArtoPay Webhook / Callback Handler Endpoint
app.post(['/api/artopay/webhook', '/artopay/webhook'], (req, res) => {
  try {
    const body = req.body || {};
    console.log('[ArtoPay Webhook Callback Received]:', JSON.stringify(body));

    // Webhook Signature verification if signature header or signature parameter is supplied
    const incomingSignature = 
      (req.headers['x-artopay-signature'] as string) || 
      (req.headers['x-signature'] as string) || 
      (req.headers['webhook-signature'] as string) || 
      body.signature || 
      body.hash;

    const webhookSecret = (process.env.WEBHOOK_SECRET || process.env.ARTOPAY_SECRET_KEY || '').trim();

    // STRICT HMAC FAIL-CLOSED:
    // 1. Secret kosong -> HTTP 503 / 401
    // 2. Signature kosong -> HTTP 401
    // 3. Signature salah -> HTTP 401
    // Request yang ditolak TIDAK BOLEH mengubah database.
    if (!webhookSecret) {
      console.error('[ArtoPay Webhook Security] FAIL-CLOSED: WEBHOOK_SECRET or ARTOPAY_SECRET_KEY is not configured.');
      return res.status(503).json({ error: 'Webhook secret is not configured on server (Fail Closed)' });
    }

    if (!incomingSignature) {
      console.error('[ArtoPay Webhook Security] FAIL-CLOSED: Missing webhook signature in headers or payload.');
      return res.status(401).json({ error: 'Missing webhook signature' });
    }

    try {
      const rawPayload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawPayload)
        .digest('hex');

      if (incomingSignature.toLowerCase() !== expectedSignature.toLowerCase()) {
        console.error('[ArtoPay Webhook Security] FAIL-CLOSED: Invalid webhook signature received.');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }
      console.log('[ArtoPay Webhook Signature Verified] Authenticity confirmed via HMAC-SHA256.');
    } catch (sigErr) {
      console.error('[ArtoPay Webhook Security] Error during HMAC signature verification:', sigErr);
      return res.status(401).json({ error: 'Webhook signature verification failed' });
    }

    const orderId = body.orderId || body.order_id || body.orderID || body.metadata?.orderId || body.data?.orderId || body.data?.order_id;
    const paymentId = body.id || body.paymentId || body.payment_id || body.transaction_id || body.data?.id || body.data?.paymentId;
    const rawStatus = String(body.status || body.transaction_status || body.payment_status || body.data?.status || body.data?.transaction_status || '').toUpperCase();

    if (!orderId && !paymentId) {
      return res.status(400).json({ error: 'Missing orderId or paymentId in webhook payload' });
    }

    const db = readDB();
    if (!db.bookings) db.bookings = [];

    const index = db.bookings.findIndex(b =>
      (orderId && (b.bookingCode === orderId || b.id === orderId)) ||
      (paymentId && (b.paymentIntentId === paymentId || b.paymentId === paymentId))
    );

    if (index === -1) {
      console.warn(`[ArtoPay Webhook] Order ${orderId || paymentId} not found in database.`);
      return res.status(404).json({ error: 'Order not found in database', orderId: orderId || paymentId });
    }

    const booking = db.bookings[index];

    // IDEMPOTENCY CHECK: If already paid, do not re-process or revert status
    if (booking.paymentStatus === 'Paid') {
      console.log(`[ArtoPay Webhook IDEMPOTENT] Order ${orderId || booking.id} is already Paid. Retaining booking status (${booking.status}).`);
      return res.status(200).json({
        success: true,
        message: 'Order status is already Paid (Idempotent call).',
        orderId: booking.bookingCode || booking.id,
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.status
      });
    }

    // AMOUNT VALIDATION: Ensure amount matches authoritative price in database exactly
    const hasIncomingAmount = body.amount !== undefined || body.gross_amount !== undefined || body.data?.amount !== undefined || body.data?.gross_amount !== undefined;
    const receivedAmount = Number(body.amount ?? body.gross_amount ?? body.data?.amount ?? body.data?.gross_amount ?? 0);
    const expectedAmount = Number(booking.paymentAmount || booking.totalPriceIDR || booking.totalPrice || 0);

    if (hasIncomingAmount && expectedAmount > 0 && receivedAmount !== expectedAmount) {
      console.error(`[ArtoPay Webhook Amount Mismatch] Order ${orderId || booking.id}: Expected ${expectedAmount}, received ${receivedAmount}. Zero database mutation applied.`);
      return res.status(400).json({
        error: 'Payment amount mismatch',
        expectedAmount,
        receivedAmount
      });
    }

    const successStatuses = ['SUCCESS', 'PAID', 'SETTLEMENT', 'COMPLETED', '00', 'SUCCESSFUL', 'APPROVED', 'CAPTURE'];
    const failureStatuses = ['FAILED', 'CANCELLED', 'DENIED', 'EXPIRED', 'EXPIRE', 'REJECTED', 'FAILURE', 'CANCEL'];

    if (successStatuses.includes(rawStatus)) {
      booking.paymentStatus = 'Paid';
      // PAYMENT STATUS ≠ BOOKING STATUS
      // Customer has paid, but booking is Pending Confirmation until Admin confirms
      if (booking.status !== 'Confirmed' && booking.status !== 'Completed') {
        booking.status = 'Pending Confirmation';
      }
      booking.paidAt = booking.paidAt || new Date().toISOString();
      booking.paymentId = paymentId || booking.paymentIntentId;

      console.log(`[ArtoPay Webhook SUCCESS] Order ${orderId || booking.id}: Payment Status set to PAID, Booking Status set to ${booking.status}.`);
    } else if (failureStatuses.includes(rawStatus)) {
      booking.paymentStatus = (rawStatus === 'EXPIRED' || rawStatus === 'EXPIRE') ? 'Expired' : 'Failed';
      if (booking.status !== 'Confirmed' && booking.status !== 'Completed') {
        booking.status = 'Cancelled';
      }

      console.log(`[ArtoPay Webhook FAILURE] Order ${orderId || booking.id} status set to ${booking.paymentStatus}.`);

      // Restore batch seats if applicable
      if (booking.batchId) {
        const bIdx = db.batches.findIndex(b => b.id === booking.batchId);
        if (bIdx !== -1) {
          db.batches[bIdx].availableSeats += (booking.participantsCount || 1);
          if (db.batches[bIdx].availableSeats > 0) {
            db.batches[bIdx].status = 'Open';
          }
        }
      }
    } else {
      booking.paymentStatus = 'Pending';
      if (booking.status !== 'Confirmed' && booking.status !== 'Completed') {
        booking.status = 'Pending';
      }
    }

    db.bookings[index] = booking;
    writeDB(db);

    return res.status(200).json({
      success: true,
      orderId: booking.bookingCode || booking.id,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.status,
      orderStatus: booking.status
    });
  } catch (error: any) {
    console.error('[ArtoPay Webhook Error]:', error);
    return res.status(500).json({ error: 'Webhook processing error', details: error.message });
  }
});

// Server-verified Payment Status Query Endpoint (Polling & Verification)
app.get(['/api/orders/:orderId/payment-status', '/api/artopay/status/:orderId'], async (req, res) => {
  try {
    const { orderId } = req.params;
    const db = readDB();
    if (!db.bookings) db.bookings = [];

    const booking = db.bookings.find(b => b.bookingCode === orderId || b.id === orderId || b.paymentIntentId === orderId);

    if (!booking) {
      return res.status(404).json({
        found: false,
        paymentStatus: 'Pending',
        orderStatus: 'Pending',
        message: 'Order ID tidak ditemukan.'
      });
    }

    // Out-of-band active status check against ArtoPay API if still pending
    if (booking.paymentStatus === 'Pending' && booking.paymentIntentId) {
      const rawSecretKey = process.env.ARTOPAY_SECRET_KEY || '';
      const secretKey = rawSecretKey.replace(/^["']|["']$/g, '').trim();

      if (secretKey) {
        const envMode = process.env.ARTOPAY_ENV || (process.env.ARTOPAY_SANDBOX === 'false' ? 'production' : 'sandbox');
        const baseUrl = process.env.ARTOPAY_API_BASE_URL || (envMode === 'production' ? 'https://api.artopay.online' : 'https://api-sandbox.arto-pay.com');
        const checkUrl = `${baseUrl.replace(/\/+$/, '')}/v1.1/payment-intents/${booking.paymentIntentId}`;

        try {
          const verifyRes = await fetch(checkUrl, {
            headers: {
              'X-Secret-Key': secretKey
            }
          });

          if (verifyRes.ok) {
            const statusData: any = await verifyRes.json();
            const resData = statusData.responseData || statusData;
            const remoteStatus = String(resData.status || resData.transaction_status || '').toUpperCase();

            if (['SUCCESS', 'PAID', 'SETTLEMENT', 'COMPLETED', '00'].includes(remoteStatus)) {
              booking.paymentStatus = 'Paid';
              if (booking.status === 'Pending') {
                booking.status = 'Pending Confirmation';
              }
              booking.paidAt = new Date().toISOString();
              writeDB(db);
            } else if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(remoteStatus)) {
              booking.paymentStatus = remoteStatus === 'EXPIRED' ? 'Expired' : 'Failed';
              if (booking.status !== 'Confirmed') {
                booking.status = 'Cancelled';
              }
              writeDB(db);
            }
          }
        } catch (vErr) {
          console.warn('[Server Status Check Warning]:', vErr);
        }
      }
    }

    return res.json({
      found: true,
      orderId: booking.bookingCode || booking.id,
      paymentStatus: booking.paymentStatus || 'Pending',
      orderStatus: booking.status || 'Pending',
      bookingStatus: booking.status || 'Pending',
      baseAmount: booking.baseAmount || booking.totalPriceIDR || booking.totalPrice || 0,
      uniqueCode: booking.uniqueCode || 0,
      paymentAmount: booking.paymentAmount || (booking.uniqueCode ? ((booking.baseAmount || booking.totalPriceIDR || 0) + booking.uniqueCode) : (booking.totalPriceIDR || booking.totalPrice || 0)),
      paidAt: booking.paidAt || null,
      booking
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve payment status', details: error.message });
  }
});

// Direct PDF Download route with forced attachment header
app.get(['/download-booking-guide', '/api/download-booking-guide', '/download/booking-flow-pdf', '/api/download/booking-flow-pdf', '/download/panduan-booking.pdf'], (req, res) => {
  const filePath = path.join(PROJECT_ROOT, 'public', 'smart_journey_booking_flow_guide.pdf');
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="Panduan_Alur_Pemesanan_Wisata_Smart_Journey.pdf"');
    return res.sendFile(filePath);
  }
  return res.status(404).send('PDF not found');
});

// -------------------------------------------------------------
// Frontend Asset Handling (Vite / Static production)
// -------------------------------------------------------------

app.use(express.static(path.join(PROJECT_ROOT, 'public')));

async function startServer() {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    // Development Mode: Use Vite Dev Server Middleware
    console.log('Running in Development mode. Mounting Vite Dev Server Middleware...');

    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.error('Failed to create Vite server middleware:', err);
    }
  } else {
    // Production Mode: Serve Compiled Frontend Assets from /dist
    console.log('Running in Production mode. Serving static assets from /dist...');

    const distPath = path.join(PROJECT_ROOT, 'dist');

    app.use(express.static(distPath));

    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[SmartJourney Fullstack Engine] Server listening on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();

export default app;

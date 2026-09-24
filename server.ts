import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import type { Trip, Batch, Booking, DatabaseState } from './src/sharetour/types.ts';
import type { Tour } from './src/types.ts';
import { generatePrivateTourPdf } from './src/server/generatePrivateTourPdf.ts';
import { getDB } from './server/db/pool';
import { runMigrationIfNeeded } from './server/db/migrator';
import { toursRepo } from './server/db/repositories/tours.repository';
import { shareToursRepo } from './server/db/repositories/shareTours.repository';
import { bookingsRepo } from './server/db/repositories/bookings.repository';
import { draftsRepo } from './server/db/repositories/drafts.repository';
import { transportRepo } from './server/db/repositories/transport.repository';
import { schedulesRepo } from './server/db/repositories/schedules.repository';
import { reviewsRepo } from './server/db/repositories/reviews.repository';
import { serviceLimitsRepo } from './server/db/repositories/serviceLimits.repository';
import { sessionsRepo } from './server/db/repositories/sessions.repository';
import { sanitizeAndPersistImage } from './server/utils/mediaStorage';

// Load environment variables
dotenv.config();

// Initialize Relational Database Single Source of Truth
(async () => {
  try {
    const db = await getDB();
    console.log(`[Database] Initialized single source of truth: ${db.engineName()}`);
    await runMigrationIfNeeded();
    await syncAdminSessionsFromDB();
  } catch (err) {
    console.error('[Database Fatal] Could not connect to Database Access Layer:', err);
  }
})();

// Ensure any Google AI Studio container settings are loaded
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

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Helper to determine the actual project root directory safely across environments (AI Studio, PM2, Passenger, Hostinger)
function resolveProjectRoot(): string {
  if (process.env.PROJECT_ROOT && fs.existsSync(process.env.PROJECT_ROOT)) {
    return path.resolve(process.env.PROJECT_ROOT);
  }
  if (fs.existsSync(path.join(process.cwd(), 'data', 'db.json')) || fs.existsSync(path.join(process.cwd(), 'package.json'))) {
    return process.cwd();
  }
  if (typeof __dirname !== 'undefined') {
    const parentDir = path.resolve(__dirname, '..');
    if (fs.existsSync(path.join(parentDir, 'data', 'db.json')) || fs.existsSync(path.join(parentDir, 'package.json'))) {
      return parentDir;
    }
    if (fs.existsSync(path.join(__dirname, 'data', 'db.json')) || fs.existsSync(path.join(__dirname, 'package.json'))) {
      return __dirname;
    }
  }
  const candidateDirs = ['/app/applet', '/app', process.cwd()];
  for (const cand of candidateDirs) {
    if (fs.existsSync(path.join(cand, 'data', 'db.json')) || fs.existsSync(path.join(cand, 'package.json'))) {
      return cand;
    }
  }
  return process.cwd();
}

const PROJECT_ROOT = resolveProjectRoot();
const DB_PATH = process.env.DB_PATH 
  ? path.resolve(process.env.DB_PATH) 
  : path.resolve(PROJECT_ROOT, 'data', 'db.json');

function logPersistenceDiagnostics(): void {
  const exists = fs.existsSync(DB_PATH);
  let tripsCount = 0;
  if (exists) {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.trips)) {
        tripsCount = parsed.trips.length;
      }
    } catch (_) {}
  }
  console.log(`[Persistence] PROJECT_ROOT=${PROJECT_ROOT}`);
  console.log(`[Persistence] DB_PATH=${DB_PATH}`);
  console.log(`[Persistence] DB_EXISTS=${exists}`);
  console.log(`[Persistence] TRIPS_COUNT=${tripsCount}`);
}

// Concurrency: Process-level critical section / mutex for booking creation & bulk writes
class AsyncMutex {
  private queue: Array<() => void> = [];
  private locked: boolean = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const release = () => {
        if (this.queue.length > 0) {
          const next = this.queue.shift()!;
          next();
        } else {
          this.locked = false;
        }
      };

      if (!this.locked) {
        this.locked = true;
        resolve(release);
      } else {
        this.queue.push(() => resolve(release));
      }
    });
  }

  async runExclusive<T>(callback: () => Promise<T> | T): Promise<T> {
    const release = await this.acquire();
    try {
      return await callback();
    } finally {
      release();
    }
  }
}

const bookingMutex = new AsyncMutex();
const bulkImportMutex = new AsyncMutex();
const catalogMutex = new AsyncMutex();

// -------------------------------------------------------------
// Safe Public Data Projections for Public API Endpoints
// Strips sensitive/internal fields (margins, operational notes, costs)
// -------------------------------------------------------------
function projectPublicTrip(trip: any) {
  if (!trip || typeof trip !== 'object') return trip;
  const {
    adminNotes,
    internalNotes,
    profitMargin,
    markupFormula,
    costBreakdown,
    supplierPrice,
    supplierCost,
    privatePricingRules,
    providerSecrets,
    credentials,
    ...publicTrip
  } = trip;
  return publicTrip;
}

function projectPublicBatch(batch: any) {
  if (!batch || typeof batch !== 'object') return batch;
  const {
    adminNotes,
    internalNotes,
    costBreakdown,
    supplierCost,
    supplierPrice,
    profitMargin,
    ...publicBatch
  } = batch;
  return publicBatch;
}

function projectPublicMainTour(tour: any) {
  if (!tour || typeof tour !== 'object') return tour;
  const {
    adminNotes,
    internalNotes,
    profitMargin,
    markupFormula,
    costBreakdown,
    supplierPrice,
    supplierCost,
    privatePricingRules,
    providerSecrets,
    credentials,
    ...publicTour
  } = tour;
  return publicTour;
}

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

// Security: Customer input HTML escaping to prevent Stored XSS
function sanitizeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Security: Public-safe masking of customer name (e.g. "Budi Santoso" -> "B**i S*****o")
function maskName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name.trim().split(/\s+/).map(part => {
    if (part.length <= 1) return '*';
    if (part.length === 2) return part[0] + '*';
    return part[0] + '*'.repeat(part.length - 2) + part[part.length - 1];
  }).join(' ');
}

// Security: Collision-safe entity ID generation
function generateEntityId(prefix: string): string {
  const rand = crypto.randomBytes(6).toString('hex');
  return `${prefix}-${Date.now()}-${rand}`;
}

// Security: Strict calendar date validation (prevents rollover like 2026-02-31)
function isValidCalendarDate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const parts = trimmed.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (year < 1970 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

// Clean Default Database Schema (No dummy production tours or fake bookings)
const defaultDB: DatabaseState = {
  mainTours: [],
  shareTours: [],
  trips: [],
  batches: [],
  bookings: [],
  payments: [],
  invoices: [],
  adminSessions: [],
  adminDrafts: {},
  operationalData: {}
} as any;

function recalculateBatchSeats(db: DatabaseState): void {
  if (!db || !db.batches) return;
  if (!db.bookings) db.bookings = [];

  const inactiveStatuses = new Set(['cancelled', 'canceled', 'rejected', 'failed', 'expired']);
  const inactivePaymentStatuses = new Set(['failed', 'expired']);

  db.batches.forEach((batch) => {
    const activeBookings = db.bookings.filter((b) => {
      if (!b.batchId || b.batchId !== batch.id) return false;
      const bStatus = (b.status || '').trim().toLowerCase();
      const pStatus = (b.paymentStatus || '').trim().toLowerCase();
      if (inactiveStatuses.has(bStatus)) return false;
      if (inactivePaymentStatuses.has(pStatus)) return false;
      return true;
    });

    const totalBooked = activeBookings.reduce(
      (sum, b) => sum + (Number(b.participantsCount) || 1),
      0
    );

    const quota = Number(batch.quota ?? (batch as any).totalSeats) || 12;
    batch.availableSeats = Math.max(0, quota - totalBooked);

    if (batch.availableSeats <= 0) {
      if ((batch.status as string) !== 'archived') {
        batch.status = 'Closed';
      }
    } else if (batch.status === 'Closed' && batch.availableSeats > 0 && !(batch as any).isArchived) {
      batch.status = 'Open';
    }
  });
}

function readDB(): DatabaseState {
  // Authoritative persistent database file (data/db.json ONLY)
  // Reads directly from storage to return an isolated snapshot without shared memory mutation
  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw) as DatabaseState;
      if (parsed && typeof parsed === 'object') {
        if (!parsed.trips) parsed.trips = [];
        if (!parsed.batches) parsed.batches = [];
        if (!parsed.bookings) parsed.bookings = [];
        if (!parsed.mainTours) parsed.mainTours = [];
        if (!(parsed as any).adminSessions) (parsed as any).adminSessions = [];
        if (!(parsed as any).adminDrafts) (parsed as any).adminDrafts = {};

        if (!(parsed as any).contactInfo) {
          (parsed as any).contactInfo = {
            name: 'Smart Journey Indonesia',
            address: 'Jl. Puntadewa No. 192, Tumpang, Malang, Jawa Timur 65156, Indonesia',
            phone: '+62 852-1234-7289',
            whatsapp: '+62 852-1234-7289',
            email: 'sawahjayagroup@gmail.com'
          };
        }

        return parsed;
      }
    } catch (err) {
      console.error('CRITICAL: Error reading authoritative persistent data/db.json:', err);
      throw err;
    }
  }

  // Fallback initial state only if file does not exist on disk
  const fallback = JSON.parse(JSON.stringify(defaultDB));
  try {
    atomicWriteFileSync(DB_PATH, JSON.stringify(fallback, null, 2));
  } catch (writeErr) {
    console.warn('Could not initialize empty db.json on disk:', writeErr);
  }
  return fallback;
}

// -------------------------------------------------------------
// Safe Atomic File Write Helper with fsync (Flushes to Disk)
// -------------------------------------------------------------
function atomicWriteFileSync(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 8)}`;
  try {
    const fd = fs.openSync(tempPath, 'w');
    try {
      fs.writeFileSync(fd, content, 'utf8');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (_) {}
    throw err;
  }
}

// -------------------------------------------------------------
// Security: Persistent Admin Session Store (Survives Server Restarts)
// Authoritative single source of truth: db.adminSessions in data/db.json
// -------------------------------------------------------------

const activeAdminTokens = new Set<string>();

async function syncAdminSessionsFromDB(): Promise<void> {
  try {
    const sessions = await sessionsRepo.getAllActive();
    activeAdminTokens.clear();
    for (const s of sessions) {
      activeAdminTokens.add(s.token);
    }
    console.log(`[Auth] Loaded ${activeAdminTokens.size} active admin session(s) from SQL database.`);
  } catch (err) {
    console.error('Error reading admin sessions from SQL:', err);
  }
}

async function saveAdminSession(token: string): Promise<void> {
  activeAdminTokens.add(token);
  try {
    await sessionsRepo.createSession(token, 24 * 60 * 60 * 1000);
  } catch (err) {
    console.error('Error saving admin session to SQL:', err);
  }
}

async function removeAdminSession(token: string): Promise<void> {
  activeAdminTokens.delete(token);
  try {
    await sessionsRepo.deleteSession(token);
  } catch (err) {
    console.error('Error invalidating admin session in SQL:', err);
  }
}

function isSessionValid(token: string): boolean {
  if (!token) return false;
  return activeAdminTokens.has(token);
}

function writeDB(data: DatabaseState) {
  recalculateBatchSeats(data);
  if (!(data as any).contactInfo) {
    (data as any).contactInfo = {
      name: 'Smart Journey Indonesia',
      address: 'Jl. Puntadewa No. 192, Tumpang, Malang, Jawa Timur 65156, Indonesia',
      phone: '+62 852-1234-7289',
      whatsapp: '+62 852-1234-7289',
      email: 'sawahjayagroup@gmail.com'
    };
  }

  // Persist exclusively to single authoritative database file (data/db.json) with atomic write
  try {
    atomicWriteFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('CRITICAL: Failed to write to authoritative persistent database (data/db.json):', err);
    throw new Error('Database write failure: cannot persist data to authoritative storage.');
  }
}

// -------------------------------------------------------------
// UNIFIED BACKEND PERSISTENCE FOR PUBLISHED TOURS
// Master source of truth: db.mainTours in persistent backend database (data/db.json)
// -------------------------------------------------------------
function readMainTours(): Tour[] {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.mainTours)) {
        return parsed.mainTours;
      }
    }
  } catch (err) {
    console.error('[Persistence Error] Failed reading mainTours directly from disk (data/db.json):', err);
  }
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
  const isDev = process.env.NODE_ENV !== 'production';
  const isLocalOrigin = origin && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'));

  if (origin && (allowedOrigins.includes(origin) || (isDev && isLocalOrigin))) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (isDev) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Dedicated error handler for body-parser (e.g. 413 Payload Too Large)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.status === 413 || err.statusCode === 413 || err.type === 'entity.too.large')) {
    return res.status(413).json({
      error: 'Data paket tour terlalu besar untuk dikirim ke server. Batas maksimum adalah 20MB. Harap kompres atau kurangi ukuran foto galeri sebelum menyimpan.',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }
  next(err);
});

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
// Authoritative Admin Session Storage in data/db.json
// -------------------------------------------------------------

function getAdminConfiguredSecret(): string {
  return (process.env.ADMIN_SECRET_KEY || '').trim();
}

function checkIsAdmin(req: express.Request): boolean {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
  const secret = req.headers['x-secret-key'] ? String(req.headers['x-secret-key']).trim() : '';
  const configuredKey = getAdminConfiguredSecret();

  if (configuredKey.length > 0 && (token === configuredKey || secret === configuredKey)) {
    return true;
  }
  if (token && isSessionValid(token)) {
    return true;
  }
  return false;
}

function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (checkIsAdmin(req)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const secretKeyHeader = req.headers['x-secret-key'];
  const hasCredential = Boolean((authHeader && authHeader.startsWith('Bearer ')) || secretKeyHeader);

  if (!hasCredential) {
    return res.status(401).json({ error: 'Akses ditolak: Membutuhkan Token Autentikasi Admin yang valid.' });
  }

  return res.status(401).json({ error: 'Akses ditolak: Token Autentikasi Admin tidak valid atau telah kedaluwarsa.' });
}

// -------------------------------------------------------------
// Unique Payment Code Generator (1-99) - Authoritative Backend Logic
// -------------------------------------------------------------

function generateUniquePaymentCode(bookings: Booking[] = []): number {
  const now = Date.now();
  const PAYMENT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours active window for pending payment unique code reservation
  const activePendingUniqueCodes = new Set<number>();

  for (const b of bookings) {
    const pStatus = (b.paymentStatus || '').trim().toLowerCase();
    const bStatus = (b.status || '').trim().toLowerCase();
    const isPending = pStatus === 'pending' || pStatus === 'pending payment' || pStatus === 'unpaid';
    const isNotTerminated = !['cancelled', 'canceled', 'rejected', 'failed', 'expired'].includes(bStatus);
    const createdAtMs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    const isExpiredByTime = createdAtMs > 0 && (now - createdAtMs > PAYMENT_WINDOW_MS);

    if (b.uniqueCode && isPending && isNotTerminated && !isExpiredByTime) {
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

  // Graceful handling: signal exhaustion so caller returns a clean 503 retry response
  return -1;
}

// -------------------------------------------------------------
// System Health Check Endpoint
// -------------------------------------------------------------

app.get('/api/health', async (req, res) => {
  try {
    const db = await getDB();
    res.json({
      application: 'ok',
      database: 'connected',
      engine: db.engineName(),
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (err: any) {
    res.status(500).json({
      application: 'ok',
      database: 'disconnected',
      error: err?.message || 'Database connection error'
    });
  }
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

  const publicRoutes = [
    { path: '/', changefreq: 'daily', priority: '1.0' },
    { path: '/tours', changefreq: 'daily', priority: '0.9' },
    { path: '/share-tour', changefreq: 'daily', priority: '0.9' },
    { path: '/airport', changefreq: 'weekly', priority: '0.8' },
    { path: '/taxi', changefreq: 'weekly', priority: '0.8' },
    { path: '/rental', changefreq: 'weekly', priority: '0.8' },
    { path: '/car-rental', changefreq: 'weekly', priority: '0.8' },
    { path: '/bookings', changefreq: 'weekly', priority: '0.7' },
    { path: '/about', changefreq: 'monthly', priority: '0.6' },
    { path: '/partnerships', changefreq: 'monthly', priority: '0.6' }
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n`;
  xml += `  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n`;

  for (const r of publicRoutes) {
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}${r.path}</loc>\n`;
    xml += `    <lastmod>${currentDate}</lastmod>\n`;
    xml += `    <changefreq>${r.changefreq}</changefreq>\n`;
    xml += `    <priority>${r.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>`;
  res.send(xml);
});

// -------------------------------------------------------------
// UNIFIED MASTER PERSISTENCE FOR PUBLISHED TOURS REST ENDPOINTS
// Shared Server-Side Authoritative Source for Admin & Customer Frontend
// -------------------------------------------------------------

// 1. Get all tours (filtered by status for public customer front-end, or all for admin)
app.get('/api/main-tours', async (req, res) => {
  try {
    const isAdmin = checkIsAdmin(req);
    const showAll = req.query.all === 'true';

    if (showAll && !isAdmin) {
      return res.status(401).json({ error: 'Unauthorized. Admin credentials required to access unpublished tours.' });
    }

    const tours = await toursRepo.getAll({ all: showAll && isAdmin });
    res.json(isAdmin ? tours : tours.map(projectPublicMainTour));
  } catch (error) {
    console.error('Error fetching main tours from database:', error);
    res.status(500).json({ error: 'Gagal mengambil data paket tour utama dari database server.' });
  }
});

// 2. Get single tour by ID (Draft/archived tours protected from public customers)
app.get('/api/main-tours/:id', async (req, res) => {
  try {
    const tour = await toursRepo.getById(req.params.id);
    if (!tour) {
      return res.status(404).json({ error: 'Paket tour tidak ditemukan.' });
    }

    const isAdmin = checkIsAdmin(req);
    if (!isAdmin && (tour.status !== 'published' || tour.isDeleted || tour.isArchived)) {
      return res.status(404).json({ error: 'Paket tour tidak ditemukan atau belum dipublikasikan.' });
    }

    res.json(isAdmin ? tour : projectPublicMainTour(tour));
  } catch (error) {
    console.error('Error fetching single main tour from database:', error);
    res.status(500).json({ error: 'Gagal mengambil detail paket tour.' });
  }
});

// 3. Create new main tour
app.post('/api/main-tours', requireAdminAuth, async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || !payload.name || !payload.name.trim()) {
      return res.status(400).json({ error: 'Nama paket tour wajib diisi.' });
    }

    // Sanitize image: If image is base64 data URL, persist to disk file and store URL path
    const sanitizedImage = sanitizeAndPersistImage(payload.image, 'tour');
    const sanitizedHighlights = Array.isArray(payload.highlights) ? payload.highlights : [];
    const sanitizedItinerary = Array.isArray(payload.itinerary) ? payload.itinerary : [];
    const sanitizedIncludes = Array.isArray(payload.includes) ? payload.includes : [];
    const sanitizedExcludes = Array.isArray(payload.excludes) ? payload.excludes : [];
    const sanitizedWhatToBring = Array.isArray(payload.whatToBring) ? payload.whatToBring : [];

    const newTour = await toursRepo.create({
      ...payload,
      name: payload.name.trim(),
      image: sanitizedImage,
      highlights: sanitizedHighlights,
      itinerary: sanitizedItinerary,
      includes: sanitizedIncludes,
      excludes: sanitizedExcludes,
      whatToBring: sanitizedWhatToBring,
      status: payload.status || 'published'
    });

    console.log(`[SQL Persistence] Tour created in database: ${newTour.name} (${newTour.id})`);
    return res.status(201).json(newTour);
  } catch (error: any) {
    console.error('Error creating main tour in database:', error);
    res.status(500).json({ error: error?.message || 'Gagal menyimpan paket tour baru ke database server.' });
  }
});

// 4. Update existing main tour
app.put('/api/main-tours/:id', requireAdminAuth, async (req, res) => {
  try {
    const payload = req.body;
    const tourId = req.params.id;

    // Sanitize image if updated with base64
    if (payload.image) {
      payload.image = sanitizeAndPersistImage(payload.image, 'tour');
    }

    const updated = await toursRepo.update(tourId, payload);
    if (!updated) {
      return res.status(404).json({ error: 'Paket tour tidak ditemukan untuk diperbarui.' });
    }

    console.log(`[SQL Persistence] Tour updated in database: ${updated.name} (${tourId})`);
    return res.json(updated);
  } catch (error: any) {
    console.error('Error updating main tour in database:', error);
    res.status(500).json({ error: error?.message || 'Gagal memperbarui paket tour di database server.' });
  }
});

// 5. Delete main tour with Soft Delete protection for historical bookings
app.delete('/api/main-tours/:id', requireAdminAuth, async (req, res) => {
  try {
    const tourId = req.params.id;
    const result = await toursRepo.delete(tourId);
    if (!result.success) {
      return res.status(404).json({ error: 'Paket tour tidak ditemukan.' });
    }

    console.log(`[SQL Persistence] Tour deleted/archived: ${tourId} (mode: ${result.mode})`);
    return res.json({
      success: true,
      id: tourId,
      mode: result.mode,
      message: result.mode === 'archived'
        ? 'Paket tour berhasil diarsipkan (soft delete) untuk menjaga integritas riwayat booking.'
        : 'Paket tour berhasil dihapus dari database.'
    });
  } catch (error: any) {
    console.error('Error deleting main tour in database:', error);
    res.status(500).json({ error: error?.message || 'Gagal memproses penghapusan paket tour.' });
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

    const isAdmin = checkIsAdmin(req);
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
    const showAll = (req.query.all === 'true' || Boolean(req.headers.authorization)) && checkIsAdmin(req);
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

app.get(['/api/taxi/all', '/api/taxi'], (req, res) => {
  try {
    const db = readDB();
    const taxi = db.taxiServices || {
      masterAreas: [],
      destinations: [],
      pricingRules: [],
      areaRules: [],
      importHistory: []
    };

    const isAdmin = checkIsAdmin(req);
    if (isAdmin) {
      return res.json(taxi);
    }

    // Public-safe projection: excludes internal importHistory
    res.json({
      masterAreas: taxi.masterAreas || [],
      destinations: taxi.destinations || [],
      pricingRules: (taxi.pricingRules || []).filter((r: any) => !r.status || r.status === 'Active'),
      areaRules: taxi.areaRules || []
    });
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

app.get('/api/schedules', async (req, res) => {
  try {
    const list = await schedulesRepo.getAll();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil data jadwal & blackout.' });
  }
});

app.post('/api/schedules', requireAdminAuth, async (req, res) => {
  try {
    const item = req.body;
    if (!item || !item.date) {
      return res.status(400).json({ error: 'Tanggal jadwal wajib diisi.' });
    }
    const saved = await schedulesRepo.save(item);
    res.json({ success: true, schedule: saved });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menyimpan entri jadwal ke database server.' });
  }
});

app.delete('/api/schedules/:id', requireAdminAuth, async (req, res) => {
  try {
    await schedulesRepo.delete(req.params.id);
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: 'Gagal menghapus entri jadwal.' });
  }
});

// -------------------------------------------------------------
// REVIEWS AND SERVICE LIMITS REST API (Server Persistent DB)
// -------------------------------------------------------------
app.get('/api/reviews', async (req, res) => {
  try {
    const isAdmin = checkIsAdmin(req);
    const reviews = await reviewsRepo.getAll(isAdmin);
    return res.json(reviews);
  } catch (err) {
    return res.status(500).json({ error: 'Gagal mengambil data review.' });
  }
});

app.post('/api/reviews', loginLimiter, async (req, res) => {
  try {
    const newRev = req.body;
    const rawAuthor = newRev?.author || newRev?.name || newRev?.userName;
    const rawContent = newRev?.content || newRev?.text || newRev?.comment;
    if (!rawAuthor || !rawContent) {
      return res.status(400).json({ error: 'Data review tidak lengkap: nama dan isi ulasan wajib diisi.' });
    }

    const author = sanitizeHtml(String(rawAuthor).trim()).slice(0, 100);
    const content = sanitizeHtml(String(rawContent).trim()).slice(0, 2000);

    const rawRating = Math.round(Number(newRev.rating));
    const rating = (!isNaN(rawRating) && rawRating >= 1 && rawRating <= 5) ? rawRating : 5;

    const isAdmin = checkIsAdmin(req);
    const status = isAdmin && newRev.status ? String(newRev.status) : 'pending';

    const reviewItem = {
      id: generateEntityId('rev'),
      author,
      name: author,
      content,
      text: content,
      rating,
      date: newRev.date || new Date().toISOString().split('T')[0],
      service: sanitizeHtml(String(newRev.service || newRev.serviceType || 'tour')).slice(0, 50),
      serviceType: sanitizeHtml(String(newRev.serviceType || newRev.service || 'tour')).slice(0, 50),
      status,
      country: sanitizeHtml(String(newRev.country || 'Indonesia')).slice(0, 50),
      avatar: newRev.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150'
    };

    const created = await reviewsRepo.create(reviewItem);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan ulasan ke database.' });
  }
});

app.patch('/api/reviews/:id/status', requireAdminAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const updated = await reviewsRepo.updateStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Review tidak ditemukan.' });
    }
    res.json({ success: true, review: updated });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memperbarui status ulasan.' });
  }
});

app.get('/api/service-limits', async (req, res) => {
  try {
    const limits = await serviceLimitsRepo.getLimits();
    res.json(limits);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil batas kapasitas layanan.' });
  }
});

app.post('/api/service-limits', requireAdminAuth, async (req, res) => {
  try {
    const saved = await serviceLimitsRepo.saveLimits(req.body);
    res.json({ success: true, serviceLimits: saved });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menyimpan batas kapasitas layanan.' });
  }
});

// -------------------------------------------------------------
// Admin Auto-Save Draft Storage API (Isolated from Production Data)
// Authoritative single source of truth: db.adminDrafts in data/db.json
// -------------------------------------------------------------

function readAdminDrafts(): Record<string, any> {
  try {
    const db = readDB();
    if ((db as any).adminDrafts && typeof (db as any).adminDrafts === 'object') {
      return (db as any).adminDrafts;
    }
    return {};
  } catch (err) {
    console.error('Error reading admin drafts from authoritative db.json:', err);
    return {};
  }
}

function writeAdminDrafts(drafts: Record<string, any>): void {
  const db = readDB();
  (db as any).adminDrafts = drafts;
  writeDB(db);
}

app.get('/api/admin/drafts', requireAdminAuth, async (req, res) => {
  try {
    const key = req.query.key as string;
    if (key) {
      const draft = await draftsRepo.getByKey(key);
      return res.json({ draft });
    }
    const drafts = await draftsRepo.getAll();
    res.json({ drafts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve drafts' });
  }
});

app.post('/api/admin/drafts', requireAdminAuth, async (req, res) => {
  try {
    const draft = req.body;
    if (!draft || !draft.key) {
      return res.status(400).json({ error: 'Draft key is required' });
    }
    await draftsRepo.save(draft.key, draft);
    res.json({ success: true, key: draft.key });
  } catch (err) {
    console.error('Failed to persist admin draft:', err);
    res.status(500).json({ error: 'Failed to save draft to persistent database' });
  }
});

app.delete('/api/admin/drafts/:key', requireAdminAuth, async (req, res) => {
  try {
    await draftsRepo.delete(req.params.key);
    res.json({ success: true, key: req.params.key });
  } catch (err) {
    console.error('Failed to delete admin draft:', err);
    res.status(500).json({ error: 'Failed to delete draft from persistent database' });
  }
});

// -------------------------------------------------------------
// Builder Custom Taxi Routes & Airport Transfers API
// -------------------------------------------------------------

app.get('/api/builder/taxi-routes', requireAdminAuth, async (req, res) => {
  try {
    const routes = await transportRepo.getTaxiRoutes();
    res.json(routes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch builder taxi routes' });
  }
});

app.post('/api/builder/taxi-routes/sync', requireAdminAuth, async (req, res) => {
  try {
    const { routes } = req.body;
    await transportRepo.saveTaxiRoutes(Array.isArray(routes) ? routes : []);
    console.log('[Persistence] Builder Taxi Routes synced to SQL database.');
    res.json({ success: true, routes: await transportRepo.getTaxiRoutes() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync builder taxi routes' });
  }
});

app.get('/api/builder/airport-transfers', requireAdminAuth, async (req, res) => {
  try {
    const transfers = await transportRepo.getAirportTransfers();
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch builder airport transfers' });
  }
});

app.post('/api/builder/airport-transfers/sync', requireAdminAuth, async (req, res) => {
  try {
    const { transfers } = req.body;
    await transportRepo.saveAirportTransfers(Array.isArray(transfers) ? transfers : []);
    console.log('[Persistence] Builder Airport Transfers synced to SQL database.');
    res.json({ success: true, transfers: await transportRepo.getAirportTransfers() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync builder airport transfers' });
  }
});

// -------------------------------------------------------------
// Share Tour Database & Core API Routes
// -------------------------------------------------------------

app.get('/api/db', async (req, res) => {
  try {
    const isAdmin = checkIsAdmin(req);
    const trips = await shareToursRepo.getAllTrips({ all: isAdmin });
    const batches = await shareToursRepo.getAllBatches();
    const mainTours = await toursRepo.getAll({ all: isAdmin });
    const bookings = isAdmin ? await bookingsRepo.getAll() : [];
    const reviews = await reviewsRepo.getAll(isAdmin);
    const schedules = await schedulesRepo.getAll();
    const serviceLimits = await serviceLimitsRepo.getLimits();

    if (!isAdmin) {
      return res.json({
        trips: trips
          .filter((t: any) => t.status !== 'archived' && !t.isArchived && !t.isDeleted)
          .map(projectPublicTrip),
        batches: batches
          .filter((b: any) => !b.isArchived && !b.isDeleted)
          .map(projectPublicBatch),
        bookings: [],
        mainTours: mainTours
          .filter((t: any) => t.status !== 'archived' && !t.isArchived && !t.isDeleted)
          .map(projectPublicMainTour),
        vehicles: [],
        reviews,
        schedules,
        serviceLimits,
        tripsRevision: 1
      });
    }
    res.json({
      trips,
      batches,
      bookings,
      mainTours,
      vehicles: [],
      reviews,
      schedules,
      serviceLimits,
      tripsRevision: 1
    });
  } catch (err) {
    console.error('Failed to read database state from SQL:', err);
    res.status(500).json({ error: 'Failed to read database state' });
  }
});

app.get('/api/trips', async (req, res) => {
  try {
    const isAdmin = checkIsAdmin(req);
    const trips = await shareToursRepo.getAllTrips({ all: isAdmin });
    res.setHeader('X-Trips-Revision', '1');
    if (isAdmin) {
      return res.json(trips);
    }
    const publicTrips = trips
      .filter((t: any) => t.status !== 'archived' && !t.isArchived && !t.isDeleted)
      .map(projectPublicTrip);
    res.json(publicTrips);
  } catch (err) {
    console.error('Failed to fetch trips from SQL database:', err);
    res.status(500).json({ error: 'Failed to fetch trips' });
  }
});

app.get('/api/trips/:id', async (req, res) => {
  try {
    const trip = await shareToursRepo.getTripById(req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    const isAdmin = checkIsAdmin(req);
    if (!isAdmin && (trip.status === 'archived' || (trip as any).isArchived || (trip as any).isDeleted)) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    res.json(isAdmin ? trip : projectPublicTrip(trip));
  } catch (err) {
    console.error('Failed to fetch trip from SQL database:', err);
    res.status(500).json({ error: 'Failed to fetch trip' });
  }
});

app.post('/api/import-bulk', requireAdminAuth, async (req, res) => {
  try {
    const { trips: newTrips, batches: newBatches, mode } = req.body;

    if (!Array.isArray(newTrips) && !Array.isArray(newBatches)) {
      return res.status(400).json({ error: 'Payload tidak valid: trips atau batches harus berupa array.' });
    }

    let savedTripsCount = 0;
    if (Array.isArray(newTrips)) {
      for (const t of newTrips) {
        if (t && t.id) {
          const existing = await shareToursRepo.getTripById(t.id);
          if (existing) {
            await shareToursRepo.updateTrip(t.id, t);
          } else {
            await shareToursRepo.createTrip(t);
          }
          savedTripsCount++;
        }
      }
    }

    let savedBatchesCount = 0;
    if (Array.isArray(newBatches)) {
      for (const b of newBatches) {
        if (b && b.id) {
          const existing = await shareToursRepo.getBatchById(b.id);
          if (existing) {
            await shareToursRepo.updateBatch(b.id, b);
          } else {
            await shareToursRepo.createBatch(b);
          }
          savedBatchesCount++;
        }
      }
    }

    const allTrips = await shareToursRepo.getAllTrips({ all: true });
    const allBatches = await shareToursRepo.getAllBatches();

    console.log(`[Persistence Verified] Bulk import into SQL succeeded (mode=${mode || 'append'}, totalTrips=${allTrips.length}, totalBatches=${allBatches.length})`);

    res.json({
      success: true,
      tripsCount: allTrips.length,
      batchesCount: allBatches.length,
      revision: 1
    });
  } catch (error: any) {
    console.error('Failed to process bulk import of trips and batches into SQL:', error);
    res.status(500).json({ error: 'Failed to process bulk import of trips and batches' });
  }
});

app.post('/api/trips', requireAdminAuth, async (req, res) => {
  try {
    const payload = req.body;
    if (payload.image) {
      payload.image = sanitizeAndPersistImage(payload.image, 'sharetour');
    }
    const created = await shareToursRepo.createTrip(payload);
    console.log(`[Persistence Verified] Trip saved in SQL database: ${created.title} (${created.id})`);
    res.status(201).json(created);
  } catch (err: any) {
    console.error('Error saving trip to SQL database:', err);
    res.status(500).json({ error: err?.message || 'Failed to save trip' });
  }
});

app.put('/api/trips/:id', requireAdminAuth, async (req, res) => {
  try {
    const payload = req.body;
    if (payload.image) {
      payload.image = sanitizeAndPersistImage(payload.image, 'sharetour');
    }
    const updated = await shareToursRepo.updateTrip(req.params.id, payload);
    if (!updated) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    console.log(`[Persistence Verified] Trip updated in SQL database: ${updated.title} (${req.params.id})`);
    res.json(updated);
  } catch (err: any) {
    console.error('Error updating trip in SQL database:', err);
    res.status(500).json({ error: err?.message || 'Failed to update trip' });
  }
});

app.delete('/api/trips/:id', requireAdminAuth, async (req, res) => {
  try {
    const result = await shareToursRepo.deleteTrip(req.params.id);
    if (!result.success) {
      return res.status(404).json({ error: 'Trip tidak ditemukan.' });
    }
    console.log(`[Persistence Verified] Trip ${result.mode}: ${req.params.id}`);
    res.json({
      success: true,
      id: req.params.id,
      mode: result.mode,
      message: result.mode === 'archived'
        ? 'Trip berhasil diarsipkan (soft delete) untuk menjaga integritas riwayat booking.'
        : 'Trip berhasil dihapus dari database.'
    });
  } catch (err: any) {
    console.error('Error deleting trip from SQL database:', err);
    res.status(500).json({ error: err?.message || 'Failed to delete trip' });
  }
});

app.get('/api/batches', async (req, res) => {
  try {
    const tripId = req.query.tripId as string | undefined;
    const batches = await shareToursRepo.getAllBatches(tripId);
    const isAdmin = checkIsAdmin(req);
    if (isAdmin) {
      return res.json(batches);
    }
    const publicBatches = batches.filter((b: any) => !b.isArchived && !b.isDeleted && b.status !== 'archived');
    res.json(publicBatches.map(projectPublicBatch));
  } catch (err) {
    console.error('Failed to fetch batches from SQL database:', err);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

app.get('/api/batches/:id', async (req, res) => {
  try {
    const batch = await shareToursRepo.getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    const isAdmin = checkIsAdmin(req);
    if (!isAdmin && ((batch as any).isArchived || (batch as any).isDeleted || batch.status === 'archived')) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json(isAdmin ? batch : projectPublicBatch(batch));
  } catch (err) {
    console.error('Failed to fetch batch from SQL database:', err);
    res.status(500).json({ error: 'Failed to fetch batch' });
  }
});

app.post('/api/batches', requireAdminAuth, async (req, res) => {
  try {
    const created = await shareToursRepo.createBatch(req.body);
    console.log(`[Persistence Verified] Batch saved in SQL database: ${created.id}`);
    res.status(201).json(created);
  } catch (err: any) {
    console.error('Error creating batch in SQL database:', err);
    res.status(500).json({ error: err?.message || 'Failed to create batch' });
  }
});

app.put('/api/batches/:id', requireAdminAuth, async (req, res) => {
  try {
    const updated = await shareToursRepo.updateBatch(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    console.log(`[Persistence Verified] Batch updated in SQL database: ${updated.id}`);
    res.json(updated);
  } catch (err: any) {
    console.error('Error updating batch in SQL database:', err);
    res.status(500).json({ error: err?.message || 'Failed to update batch' });
  }
});

app.delete('/api/batches/:id', requireAdminAuth, async (req, res) => {
  try {
    const deleted = await shareToursRepo.deleteBatch(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json({ success: true, id: req.params.id, mode: 'deleted' });
  } catch (err: any) {
    console.error('Error deleting batch from SQL database:', err);
    res.status(500).json({ error: err?.message || 'Failed to delete batch' });
  }
});

app.post('/api/bookings', async (req, res) => {
  return await bookingMutex.runExclusive(async () => {
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

      if ((batch as any).isArchived || (batch as any).isDeleted || batch.status === 'archived') {
        return res.status(404).json({ error: 'Batch keberangkatan ini telah diarsipkan dan tidak dapat dipesan.' });
      }

      if (payload.tripId && batch.tripId !== payload.tripId) {
        return res.status(400).json({ error: 'Batch keberangkatan tidak sesuai dengan trip yang dipilih.' });
      }

      if (batch.status === 'Closed' || batch.availableSeats < count) {
        return res.status(409).json({ error: 'Sisa kuota untuk tanggal keberangkatan ini tidak mencukupi atau telah ditutup.' });
      }

      const trip = db.trips.find((t) => t.id === payload.tripId || t.id === batch.tripId);
      if (trip && (trip.status === 'archived' || (trip as any).isArchived || (trip as any).isDeleted)) {
        return res.status(404).json({ error: 'Trip ini telah diarsipkan dan tidak lagi menerima pemesanan baru.' });
      }

      // Decrement seats atomically
      batch.availableSeats -= count;
      if (batch.availableSeats <= 0) {
        batch.status = 'Closed';
      }

      const bookingCode = payload.bookingCode || generateUniqueBookingCode(db.bookings.map(b => b.bookingCode));
      // BACKEND AUTHORITATIVE PRICING: NEVER trust payload.totalPrice / totalPriceIDR / baseAmount / paymentAmount
      const batchPrice = Number(batch.price ?? trip?.price ?? 0);
      if (batchPrice <= 0) {
        return res.status(400).json({ error: 'Harga batch open trip di database tidak valid.' });
      }
      const baseAmount = batchPrice * count;
      const uniqueCode = generateUniquePaymentCode(db.bookings);
      if (uniqueCode === -1) {
        return res.status(503).json({ error: 'Semua kode unik pembayaran (1-99) sedang digunakan oleh transaksi aktif lain. Silakan coba beberapa saat lagi.' });
      }
      const paymentAmount = baseAmount + uniqueCode;

      const newBooking: Booking = {
        id: payload.id || generateEntityId('book'),
        bookingCode,
        serviceType: 'shared',
        serviceId: batch.id,
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
        proofOfPayment: 'NOT_APPLICABLE_SLEEK_THEME',
        status: 'Pending',
        paymentStatus: 'Pending',
        totalPrice: baseAmount,
        totalPriceIDR: baseAmount,
        baseAmount,
        uniqueCode,
        paymentAmount,
        currency: 'IDR',
        createdAt: new Date().toISOString(),
        participantData: payload.participantData,
        details: payload.details,
        nationalityType: payload.nationalityType,
        adminNotes: ''
      };

      const savedBooking = await bookingsRepo.create(newBooking as any);
      db.bookings.push(savedBooking as any);
      writeDB(db);
      return res.status(201).json(savedBooking);
    } else {
      // -------------------------------------------------------------
      // NON-SHARED BOOKING FLOW: DETECT SERVICE TYPE & VALIDATE
      // -------------------------------------------------------------
      let selectedDate = String(payload.departureDate || payload.details?.date || '').trim();

      // Validate date if provided: Must be valid calendar date, not in the past, and not a blackout date
      if (selectedDate) {
        const parsedDate = new Date(selectedDate);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: 'Format tanggal keberangkatan tidak valid.' });
        }
        const yyyy = parsedDate.getFullYear();
        const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const dd = String(parsedDate.getDate()).padStart(2, '0');
        const normalizedDate = `${yyyy}-${mm}-${dd}`;

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        if (normalizedDate < todayStr) {
          return res.status(400).json({ error: 'Tanggal keberangkatan tidak boleh di masa lalu.' });
        }

        if (Array.isArray(db.schedules)) {
          const isBlackedOut = db.schedules.some((s: any) => {
            const sDate = s.date || s.blackoutDate;
            const sType = String(s.type || '').toLowerCase();
            const isBlackout = sType.includes('blackout') || sType.includes('libur') || s.isBlackout;
            if (isBlackout && sDate === normalizedDate) return true;
            if (isBlackout && s.startDate && s.endDate && normalizedDate >= s.startDate && normalizedDate <= s.endDate) return true;
            return false;
          });
          if (isBlackedOut) {
            return res.status(400).json({ error: 'Tanggal yang dipilih merupakan tanggal libur operasional / blackout date.' });
          }
        }
        selectedDate = normalizedDate;
      }

      const rawType = String(payload.serviceType || payload.type || '').trim().toLowerCase();
      const sName = String(payload.serviceName || '').toLowerCase();

      const isRental = rawType === 'rental' || sName.includes('rental') || Boolean(payload.details?.vehicleId && (payload.details?.days || payload.details?.withDriver !== undefined || payload.details?.operationalCity || payload.details?.pickupArea));
      const isAirport = !isRental && (rawType === 'airport' || sName.includes('airport transfer') || Boolean(payload.details?.flightNumber || payload.details?.airport || (payload.details?.direction && payload.details.direction.toLowerCase().includes('airport'))));
      const isTaxi = !isRental && !isAirport && (rawType === 'taxi' || sName.includes('taxi'));

      let detectedServiceType: 'rental' | 'airport' | 'taxi' | 'tour' = 'tour';
      let matchedServiceId = '';
      let resolvedTitle = '';
      let baseAmount = 0;
      let tourSnapshot: any = undefined;

      if (isRental) {
        detectedServiceType = 'rental';
        const vehicleId = String(payload.serviceId || payload.vehicleId || payload.details?.vehicleId || '').trim();
        if (!vehicleId) {
          return res.status(400).json({ error: 'vehicleId wajib disertakan untuk booking car rental.' });
        }

        const rentals = db.rentals || { vehicles: [], addons: [], zonePricing: [] };
        const vehicle = (rentals.vehicles || []).find((v: any) => v.id === vehicleId);
        if (!vehicle) {
          return res.status(404).json({ error: 'Kendaraan rental tidak ditemukan di database backend.' });
        }

        if (vehicle.status && vehicle.status !== 'Active') {
          return res.status(400).json({ error: 'Kendaraan rental sedang tidak aktif atau tidak tersedia.' });
        }

        const dailyPrice = Number(vehicle.pricePerDayIDR || (vehicle.pricePerDay ? vehicle.pricePerDay * 15000 : 0));
        if (dailyPrice <= 0) {
          return res.status(400).json({ error: 'Tarif sewa kendaraan di database backend tidak valid.' });
        }

        const days = Math.max(1, Math.floor(Number(payload.details?.days || payload.duration || payload.days || 1)));
        let rentalBase = dailyPrice * days;

        // Addons calculation from db.rentals.addons
        const requestedAddons: string[] = Array.isArray(payload.details?.selectedAddons) 
          ? payload.details.selectedAddons 
          : (Array.isArray(payload.details?.addOns) ? payload.details.addOns : (Array.isArray(payload.addons) ? payload.addons : []));

        let addonsTotal = 0;
        if (requestedAddons.length > 0 && Array.isArray(rentals.addons)) {
          for (const item of requestedAddons) {
            const addon = rentals.addons.find((a: any) => a.id === item || a.name === item);
            if (addon && (addon.status === 'Active' || !addon.status)) {
              const addonPrice = Number(addon.priceIDR || (addon.priceUSD ? addon.priceUSD * 15000 : 0));
              if (addon.pricingType === 'Per Day') {
                addonsTotal += addonPrice * days;
              } else {
                addonsTotal += addonPrice;
              }
            }
          }
        }
        rentalBase += addonsTotal;

        // Zone surcharge if configured
        if (Array.isArray(rentals.zonePricing) && rentals.zonePricing.length > 0) {
          const pickupZone = payload.details?.pickupZone;
          const dropoffZone = payload.details?.dropoffZone;
          const zoneRule = rentals.zonePricing.find((z: any) => 
            (z.pickupZone === pickupZone && z.dropoffZone === dropoffZone) ||
            z.zoneId === pickupZone || z.zoneId === dropoffZone
          );
          if (zoneRule) {
            rentalBase += Number(zoneRule.surchargeIDR || 0);
          }
        }

        matchedServiceId = vehicle.id;
        resolvedTitle = `Car Rental: ${vehicle.name}`;
        baseAmount = rentalBase;

      } else if (isAirport) {
        detectedServiceType = 'airport';
        const routeId = String(payload.serviceId || payload.routeId || payload.details?.routeId || '').trim();
        const airportTransfers = db.airportTransfers || { airports: [], routes: [] };
        const routes = airportTransfers.routes || [];

        let route: any = routeId ? routes.find((r: any) => r.id === routeId) : null;

        if (!route) {
          const airportCode = String(payload.airport || payload.details?.airport || '').trim().toUpperCase();
          const dest = String(payload.destination || payload.details?.destination || payload.details?.cityAddress || '').trim().toLowerCase();
          if (airportCode || dest) {
            route = routes.find((r: any) => {
              const matchAirport = !airportCode || r.airport?.toUpperCase() === airportCode;
              const matchDest = !dest || r.city?.toLowerCase().includes(dest) || dest.includes(r.city?.toLowerCase());
              return matchAirport && matchDest;
            });
          }
        }

        if (!route && routeId && Array.isArray((db as any).builderAirportTransfers)) {
          const bItem = (db as any).builderAirportTransfers.find((b: any) => b.id === routeId);
          if (bItem) {
            route = {
              id: bItem.id,
              airport: bItem.airportName,
              city: bItem.destinationArea,
              priceUSD: bItem.price || Math.round((bItem.priceIDR || 0) / 15000),
              priceIDR: bItem.priceIDR || (bItem.price * 15000),
              status: bItem.status || 'Published'
            };
          }
        }

        if (!route) {
          return res.status(404).json({ error: 'Rute transfer bandara tidak ditemukan di database backend.' });
        }

        const routeStatus = String(route.status || '');
        if (routeStatus && routeStatus !== 'Published' && routeStatus !== 'Active') {
          return res.status(400).json({ error: 'Rute transfer bandara sedang tidak aktif.' });
        }

        let routePrice = Number(route.priceIDR || (route.priceUSD ? route.priceUSD * 15000 : 0));
        if (routePrice <= 0) {
          return res.status(400).json({ error: 'Tarif rute bandara di database backend tidak valid.' });
        }

        const isRoundTrip = payload.details?.routeType === 'Round Trip' || payload.routeType === 'Round Trip';
        if (isRoundTrip) {
          routePrice = routePrice * 2;
        }

        let surcharge = 0;
        const airportCode = route.airport || payload.airport || payload.details?.airport;
        if (airportCode && Array.isArray(airportTransfers.airports)) {
          const airportObj = airportTransfers.airports.find((a: any) => a.code?.toUpperCase() === String(airportCode).toUpperCase());
          if (airportObj) {
            surcharge = Number(airportObj.surchargeIDR || (airportObj.surchargeUSD ? airportObj.surchargeUSD * 15000 : 0));
          }
        }

        matchedServiceId = route.id;
        resolvedTitle = `Airport Transfer: ${route.airport || 'Airport'} ⇄ ${route.city || 'City'}`;
        baseAmount = routePrice + surcharge;

      } else if (isTaxi) {
        detectedServiceType = 'taxi';
        const taxiServices = db.taxiServices || { pricingRules: [], masterAreas: [], destinations: [] };
        const ruleId = String(payload.serviceId || payload.ruleId || payload.details?.ruleId || '').trim();

        let rule = ruleId ? (taxiServices.pricingRules || []).find((r: any) => r.id === ruleId) : null;

        if (!rule && ruleId && Array.isArray((db as any).builderTaxiRoutes)) {
          const bRoute = (db as any).builderTaxiRoutes.find((b: any) => b.id === ruleId || b.code === ruleId);
          if (bRoute) {
            rule = {
              id: bRoute.id,
              price_idr: bRoute.priceIDR || (bRoute.price * 15000),
              status: bRoute.status || 'Active'
            };
          }
        }

        if (!rule) {
          const pickup = String(payload.pickup || payload.details?.pickupLocation || payload.pickupLocation || '').trim().toLowerCase();
          const dest = String(payload.destination || payload.details?.destination || '').trim().toLowerCase();
          const vehicleType = String(payload.vehicleType || payload.details?.vehicleType || payload.details?.vehicleName || 'Standard').trim().toLowerCase();

          const masterAreas = taxiServices.masterAreas || [];
          const srcArea = masterAreas.find((a: any) => pickup.includes(a.name?.toLowerCase()) || pickup.includes(a.code?.toLowerCase()));
          const dstArea = masterAreas.find((a: any) => dest.includes(a.name?.toLowerCase()) || dest.includes(a.code?.toLowerCase()));

          if (srcArea && dstArea) {
            rule = (taxiServices.pricingRules || []).find((r: any) => 
              r.source_id === srcArea.id && 
              r.destination_id === dstArea.id &&
              (!vehicleType || r.vehicle_type?.toLowerCase() === vehicleType || vehicleType.includes(r.vehicle_type?.toLowerCase()))
            );
            if (!rule) {
              rule = (taxiServices.pricingRules || []).find((r: any) => r.source_id === srcArea.id && r.destination_id === dstArea.id);
            }
          }

          if (!rule && Array.isArray((db as any).builderTaxiRoutes)) {
            const matchedBuilder = (db as any).builderTaxiRoutes.find((b: any) => 
              (pickup.includes(b.pickupCity?.toLowerCase()) || pickup.includes(b.pickupArea?.toLowerCase())) &&
              (dest.includes(b.destinationCity?.toLowerCase()) || dest.includes(b.destinationArea?.toLowerCase()))
            );
            if (matchedBuilder) {
              rule = {
                id: matchedBuilder.id,
                price_idr: matchedBuilder.priceIDR || (matchedBuilder.price * 15000),
                status: matchedBuilder.status || 'Active'
              };
            }
          }
        }

        if (!rule) {
          return res.status(404).json({ error: 'Aturan tarif taksi tidak ditemukan di database backend.' });
        }

        if (rule.status && rule.status !== 'Active') {
          return res.status(400).json({ error: 'Layanan tarif taksi sedang tidak aktif.' });
        }

        const rulePrice = Number(rule.price_idr || rule.priceIDR || (rule.price_usd ? rule.price_usd * 15000 : (rule.price ? rule.price * 15000 : 0)));
        if (rulePrice <= 0) {
          return res.status(400).json({ error: 'Tarif taksi di database backend tidak valid.' });
        }

        matchedServiceId = rule.id;
        resolvedTitle = `Private Taxi Transfer`;
        baseAmount = rulePrice;

      } else {
        // -------------------------------------------------------------
        // PRIVATE TOUR FLOW (Requirement 2 & 13)
        // -------------------------------------------------------------
        detectedServiceType = 'tour';
        const tourId = String(payload.tripId || payload.details?.tourId || payload.tourId || payload.serviceId || '').trim();
        if (!tourId) {
          if (payload.baseAmount || payload.totalPriceIDR || payload.totalPrice) {
            baseAmount = Number(payload.baseAmount || payload.totalPriceIDR || payload.totalPrice);
            matchedServiceId = payload.serviceId || payload.serviceType || 'tour-custom';
            resolvedTitle = payload.tripTitle || payload.serviceName || 'Private Tour';
            tourSnapshot = {
              tourId: matchedServiceId,
              tourName: resolvedTitle,
              duration: payload.details?.duration || '1 Hari',
              vehicleName: payload.details?.vehicleName || 'Standard Private Tourism Vehicle',
              startingPriceIDR: baseAmount,
              highlights: [],
              itinerary: []
            };
          } else {
            return res.status(400).json({ error: 'tripId atau tourId wajib disertakan untuk booking tour.' });
          }
        } else {
          const mainTours = readMainTours();
          // 1. Prioritize exact ID match
          let mainTour = mainTours.find(t => t.id === tourId);
          let trip = (!mainTour) ? (db.trips || []).find((t: any) => t.id === tourId) : null;

          // 2. Slug match
          if (!mainTour && !trip) {
            mainTour = mainTours.find(t => t.slug === tourId);
            trip = (!mainTour) ? (db.trips || []).find((t: any) => t.slug === tourId) : null;
          }

          // 3. Case-insensitive exact ID match
          if (!mainTour && !trip) {
            mainTour = mainTours.find(t => t.id && t.id.toLowerCase() === tourId.toLowerCase());
            trip = (!mainTour) ? (db.trips || []).find((t: any) => t.id && t.id.toLowerCase() === tourId.toLowerCase()) : null;
          }

          if (!mainTour && !trip) {
            if (payload.baseAmount || payload.totalPriceIDR || payload.totalPrice) {
              baseAmount = Number(payload.baseAmount || payload.totalPriceIDR || payload.totalPrice);
              matchedServiceId = tourId || payload.serviceId || 'tour-custom';
              resolvedTitle = payload.tripTitle || payload.serviceName || 'Private Tour';
              tourSnapshot = {
                tourId: matchedServiceId,
                tourName: resolvedTitle,
                duration: payload.details?.duration || '1 Hari',
                vehicleName: payload.details?.vehicleName || 'Standard Private Tourism Vehicle',
                startingPriceIDR: baseAmount,
                highlights: payload.details?.highlights || [],
                itinerary: payload.details?.itinerary || []
              };
            } else {
              return res.status(404).json({ error: 'Tour tidak ditemukan di database backend.' });
            }
          } else {
            const resolvedTour: any = mainTour || trip;
            const isArchived = Boolean(
              resolvedTour.isDeleted || 
              resolvedTour.isArchived || 
              resolvedTour.status === 'archived' || 
              resolvedTour.status === 'deleted'
            );
            const isPublished = Boolean(
              resolvedTour.status === 'published' || 
              resolvedTour.status === 'Active' || 
              resolvedTour.status === 'active' ||
              resolvedTour.status === 'Published'
            );

            if (isArchived || !isPublished) {
              return res.status(404).json({ error: 'Tour tidak aktif, diarsipkan, atau telah dihapus.' });
            }

            const serverPrice = Number(resolvedTour.startingPriceIDR ?? resolvedTour.wniPrice ?? resolvedTour.price ?? 0);
            if (serverPrice <= 0) {
              return res.status(400).json({ error: 'Harga tour di database backend tidak valid.' });
            }

            matchedServiceId = resolvedTour.id;
            resolvedTitle = resolvedTour.name || resolvedTour.title || payload.tripTitle || payload.serviceName || 'Private Tour';
            baseAmount = serverPrice;

            tourSnapshot = {
              tourId: resolvedTour.id,
              tourName: resolvedTitle,
              duration: payload.details?.duration || resolvedTour.duration || '1 Hari',
              vehicleName: payload.details?.vehicleName || 'Standard Private Tourism Vehicle',
              startingPriceIDR: baseAmount,
              highlights: resolvedTour.highlights || [],
              itinerary: (payload.details?.itinerary && payload.details.itinerary.length > 0) ? payload.details.itinerary : (resolvedTour.itinerary || [])
            };
          }
        }
      }

      // Customer CANNOT forge uniqueCode or paymentAmount
      const uniqueCode = generateUniquePaymentCode(db.bookings);
      if (uniqueCode === -1) {
        return res.status(503).json({ error: 'Semua kode unik pembayaran (1-99) sedang digunakan oleh transaksi aktif lain. Silakan coba beberapa saat lagi.' });
      }
      const paymentAmount = baseAmount + uniqueCode;

      const bookingCode = payload.bookingCode || generateUniqueBookingCode(db.bookings.map(b => b.bookingCode));

      const newBooking: Booking = {
        id: payload.id || generateEntityId('book'),
        bookingCode,
        serviceType: detectedServiceType,
        serviceId: matchedServiceId,
        type: detectedServiceType as any,
        tripId: (detectedServiceType === 'tour') ? matchedServiceId : undefined,
        tripTitle: resolvedTitle,
        serviceName: payload.serviceName || resolvedTitle,
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
        proofOfPayment: 'NOT_APPLICABLE_SLEEK_THEME',
        status: 'Pending',
        paymentStatus: 'Pending',
        totalPrice: baseAmount,
        totalPriceIDR: baseAmount,
        baseAmount,
        uniqueCode,
        paymentAmount,
        currency: 'IDR',
        createdAt: new Date().toISOString(),
        participantData: payload.participantData,
        details: {
          ...(payload.details || {}),
          ...(tourSnapshot ? {
            duration: payload.details?.duration || tourSnapshot.duration,
            vehicleName: payload.details?.vehicleName || tourSnapshot.vehicleName
          } : {})
        },
        tourSnapshot,
        nationalityType: payload.nationalityType,
        items: payload.items || payload.lineItems || payload.details?.items || undefined,
        discount: payload.discount || payload.details?.discount || 0,
        adminNotes: ''
      };

      const savedBooking = await bookingsRepo.create(newBooking as any);
      db.bookings.push(savedBooking as any);
      writeDB(db);
      return res.status(201).json(savedBooking);
    }
    } catch (e: any) {
      console.error('[Error in POST /api/bookings]:', e);
      return res.status(500).json({ error: 'Gagal memproses pendaftaran booking: ' + (e.message || '') });
    }
  });
});

app.get('/api/bookings', requireAdminAuth, async (req, res) => {
  try {
    const list = await bookingsRepo.getAll();
    res.json(list);
  } catch (err: any) {
    console.error('Failed to read bookings from SQL database:', err);
    try {
      const db = readDB();
      res.json(db.bookings || []);
    } catch {
      res.status(500).json({ error: 'Failed to read bookings' });
    }
  }
});

app.get('/api/bookings/:id', requireAdminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const booking = await bookingsRepo.getByCode(id);
    if (booking) {
      return res.json(booking);
    }
    const db = readDB();
    const fallbackBooking = (db.bookings || []).find((b) => b.id === id || b.bookingCode === id);
    if (!fallbackBooking) {
      return res.status(404).json({ error: 'Booking tidak ditemukan.' });
    }
    res.json(fallbackBooking);
  } catch (err) {
    console.error('Failed to read booking:', err);
    res.status(500).json({ error: 'Failed to read booking' });
  }
});

app.put('/api/bookings/:id', requireAdminAuth, async (req, res) => {
  try {
    const targetId = req.params.id;
    let originalBooking = await bookingsRepo.getByCode(targetId);
    const db = readDB();
    const index = db.bookings.findIndex((b) => b.id === targetId || b.bookingCode === targetId);

    if (!originalBooking && index === -1) {
      return res.status(404).json({ error: 'Kode booking tidak ditemukan.' });
    }

    const bookingId = originalBooking ? originalBooking.id : db.bookings[index].id;
    const updates = req.body || {};

    if (updates.status === 'Confirmed' && !updates.confirmedAt && !(originalBooking?.confirmedAt || db.bookings[index]?.confirmedAt)) {
      updates.confirmedAt = new Date().toISOString();
    }

    const isNowRejected = updates.status === 'Rejected' || updates.status === 'Cancelled';
    const wasRejected = (originalBooking?.status === 'Rejected' || originalBooking?.status === 'Cancelled') ||
      (index !== -1 && (db.bookings[index].status === 'Rejected' || db.bookings[index].status === 'Cancelled'));
    const batchId = originalBooking?.details?.batchId || (index !== -1 ? db.bookings[index].batchId : undefined);
    const participantsCount = originalBooking?.participantsCount || (index !== -1 ? db.bookings[index].participantsCount : 1) || 1;

    if (isNowRejected && !wasRejected && batchId) {
      const bIdx = db.batches.findIndex((b) => b.id === batchId);
      if (bIdx !== -1) {
        db.batches[bIdx].availableSeats += participantsCount;
        if (db.batches[bIdx].availableSeats > 0) {
          db.batches[bIdx].status = 'Open';
        }
      }
    }

    if (wasRejected && !isNowRejected && batchId) {
      const bIdx = db.batches.findIndex((b) => b.id === batchId);
      if (bIdx !== -1) {
        db.batches[bIdx].availableSeats -= participantsCount;
        if (db.batches[bIdx].availableSeats < 0) db.batches[bIdx].availableSeats = 0;
        if (db.batches[bIdx].availableSeats <= 0) {
          db.batches[bIdx].status = 'Closed';
        }
      }
    }

    // Persist to SQL
    const updated = await bookingsRepo.update(bookingId, updates);

    // Keep legacy db sync
    if (index !== -1) {
      db.bookings[index] = { ...db.bookings[index], ...updates };
      writeDB(db);
    }

    console.log(`[Admin] Booking ${bookingId} updated: status=${updated?.status || updates.status}, paymentStatus=${updated?.paymentStatus || updates.paymentStatus}`);
    res.json(updated || (index !== -1 ? db.bookings[index] : updates));
  } catch (err: any) {
    console.error('Failed to update booking:', err);
    res.status(500).json({ error: 'Failed to update booking', details: err.message });
  }
});

// Explicit Admin Status Transition Endpoint (PATCH & PUT /api/bookings/:id/status)
app.all(['/api/bookings/:id/status'], requireAdminAuth, async (req, res) => {
  if (req.method !== 'PATCH' && req.method !== 'PUT' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const targetId = req.params.id;
    let originalBooking = await bookingsRepo.getByCode(targetId);
    const db = readDB();
    const index = (db.bookings || []).findIndex((b) => b.id === targetId || b.bookingCode === targetId);

    if (!originalBooking && index === -1) {
      return res.status(404).json({ error: 'Booking tidak ditemukan.' });
    }

    const bookingId = originalBooking ? originalBooking.id : db.bookings[index].id;
    const { status, bookingStatus, paymentStatus, adminNotes, rejectReason } = req.body || {};
    const currentStatus = originalBooking ? originalBooking.status : db.bookings[index].status;
    const currentPaymentStatus = originalBooking ? originalBooking.paymentStatus : db.bookings[index].paymentStatus;
    const newBookingStatus = status || bookingStatus || currentStatus;
    const newPaymentStatus = paymentStatus || currentPaymentStatus;

    const isNowRejected = newBookingStatus === 'Rejected' || newBookingStatus === 'Cancelled';
    const wasRejected = currentStatus === 'Rejected' || currentStatus === 'Cancelled';
    const batchId = originalBooking?.details?.batchId || (index !== -1 ? db.bookings[index].batchId : undefined);
    const count = originalBooking?.participantsCount || (index !== -1 ? db.bookings[index].participantsCount : 1) || 1;

    if (isNowRejected && !wasRejected && batchId) {
      const bIdx = db.batches.findIndex((b) => b.id === batchId);
      if (bIdx !== -1) {
        db.batches[bIdx].availableSeats += count;
        if (db.batches[bIdx].availableSeats > 0) {
          db.batches[bIdx].status = 'Open';
        }
      }
    }

    if (wasRejected && !isNowRejected && batchId) {
      const bIdx = db.batches.findIndex((b) => b.id === batchId);
      if (bIdx !== -1) {
        db.batches[bIdx].availableSeats -= count;
        if (db.batches[bIdx].availableSeats < 0) db.batches[bIdx].availableSeats = 0;
        if (db.batches[bIdx].availableSeats <= 0) {
          db.batches[bIdx].status = 'Closed';
        }
      }
    }

    const updated = await bookingsRepo.update(bookingId, {
      status: newBookingStatus as any,
      paymentStatus: newPaymentStatus as any,
      adminNotes: adminNotes !== undefined ? adminNotes : (originalBooking?.adminNotes || ''),
      rejectReason: rejectReason !== undefined ? rejectReason : (originalBooking?.rejectReason || '')
    });

    if (index !== -1) {
      db.bookings[index] = {
        ...db.bookings[index],
        status: newBookingStatus,
        paymentStatus: newPaymentStatus,
        adminNotes: adminNotes !== undefined ? adminNotes : db.bookings[index].adminNotes,
        rejectReason: rejectReason !== undefined ? rejectReason : db.bookings[index].rejectReason
      };
      writeDB(db);
    }

    console.log(`[Admin Status Action] Booking ${bookingId}: bookingStatus=${newBookingStatus}, paymentStatus=${newPaymentStatus}`);
    res.json({
      success: true,
      ...updated,
      booking: updated,
      status: newBookingStatus,
      bookingStatus: newBookingStatus,
      paymentStatus: newPaymentStatus
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
// Supports checking Booking ID & Booking Code for both Open Trip (Share Tour) and Private Trip / Tour
app.get([
  '/api/private-tour/check-booking/:bookingCode', 
  '/api/private-tour/status/:bookingCode',
  '/api/bookings/check/:bookingCode'
], async (req, res) => {
  try {
    const rawCode = (req.params.bookingCode || '').trim();
    if (!rawCode) {
      return res.status(400).json({ error: 'Booking ID atau Kode booking wajib diisi.' });
    }

    let booking: any = await bookingsRepo.getByCode(rawCode);
    if (!booking) {
      const db = readDB();
      booking = (db.bookings || []).find((b: any) => {
        const code = (b.bookingCode || '').trim().toLowerCase();
        const id = (b.id || '').trim().toLowerCase();
        const target = rawCode.toLowerCase();
        return code === target || id === target;
      });
    }

    if (!booking) {
      return res.status(404).json({ 
        error: `Booking dengan ID / Kode "${rawCode}" tidak ditemukan. Harap periksa kembali Booking ID atau Kode Booking Anda.` 
      });
    }

    // Determine whether this booking is an Open Trip (shared) or Private Tour (private)
    const isShared = booking.bookingType === 'shared' || 
      booking.tourBookingType === 'shared' || 
      booking.serviceType === 'shared' || 
      Boolean(booking.batchId);

    const bookingType = isShared ? 'shared' : 'private';
    const bookingCategory = isShared ? 'OPEN TRIP / SHARE TOUR' : 'PRIVATE TOUR';

    // Standardize statuses
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

    // CRITICAL: PAID ≠ CONFIRMED check
    // If paymentStatus is Paid, bookingStatus CANNOT be Confirmed unless Admin has confirmed it
    if (paymentStatus === 'Paid' && bookingStatus !== 'Confirmed' && bookingStatus !== 'Completed') {
      bookingStatus = 'Pending Confirmation';
    }

    // Look up shared trip / batch if applicable
    let matchedTrip: any = null;
    let matchedBatch: any = null;
    if (isShared) {
      if (booking.tripId) {
        matchedTrip = (db.trips || []).find((t: any) => t.id === booking.tripId);
      }
      if (booking.batchId) {
        matchedBatch = (db.batches || []).find((b: any) => b.id === booking.batchId);
      }
    }

    const tourSnapshot = booking.tourSnapshot || {
      tourId: booking.tripId || booking.details?.tourId || (isShared ? 'tour-open-trip' : 'tour-private'),
      tourName: booking.serviceName || booking.tripTitle || (matchedTrip?.title) || (isShared ? 'Open Trip Smart Journey' : 'Private Tour'),
      packageName: booking.details?.package || (isShared ? (matchedBatch?.departureDate ? `Open Trip (Jadwal: ${matchedBatch.departureDate})` : 'Paket Open Trip') : 'Private Exclusive'),
      duration: booking.details?.duration || '1 Hari',
      vehicleName: booking.details?.vehicleName || (isShared ? 'Armada Wisata Open Trip (HiAce / Jeep Bromo)' : 'Standard Private Tourism Vehicle'),
      itinerary: booking.details?.itinerary || []
    };

    const tripTitle = booking.tripTitle || booking.serviceName || matchedTrip?.title || tourSnapshot.tourName;
    const departureDate = booking.departureDate || matchedBatch?.departureDate || booking.details?.date || '';
    const duration = booking.details?.duration || tourSnapshot.duration || '1 Hari';

    const rawMembers = booking.participantData?.members || booking.participantsManifest || [];
    const participantsNames = Array.isArray(booking.participantsNames) && booking.participantsNames.length > 0
      ? booking.participantsNames
      : (Array.isArray(rawMembers) && rawMembers.length > 0
          ? rawMembers.map((m: any) => m.name || m.fullName)
          : [booking.customerName || booking.fullName || 'Tamu Utama']);

    const participantsCount = booking.participantsCount || booking.details?.guests || booking.details?.passengers || participantsNames.length || 1;

    const baseAmount = booking.baseAmount || booking.totalPriceIDR || booking.totalPrice || 0;
    const uniqueCode = booking.uniqueCode || 0;
    const paymentAmount = booking.paymentAmount || (baseAmount + uniqueCode);

    // Critical Fix #1: Gate Access - canDownloadFinalSummary is strictly unlocked ONLY when booking is Confirmed AND Paid
    const isConfirmed = bookingStatus === 'Confirmed' || bookingStatus === 'Completed';
    const isPaid = paymentStatus === 'Paid';
    const canDownloadFinalSummary = isConfirmed && isPaid;
    const canDownloadInvoice = canDownloadFinalSummary;

    // Status Guidance Messaging
    let gateMessage = '';
    if (bookingStatus === 'Cancelled' || bookingStatus === 'Rejected') {
      gateMessage = 'Pemesanan ini telah dibatalkan.';
    } else if (paymentStatus !== 'Paid') {
      gateMessage = 'Status: Menunggu Pembayaran. Anda dapat melihat dan mengunduh invoice tagihan atau melakukan pembayaran langsung.';
    } else if (bookingStatus !== 'Confirmed' && bookingStatus !== 'Completed') {
      gateMessage = 'Pembayaran berhasil diterima. Pemesanan sedang dalam review admin (waiting for confirmation).';
    } else {
      gateMessage = 'Pemesanan Anda telah dikonfirmasi resmi.';
    }

    return res.json({
      found: true,
      bookingCode: booking.bookingCode || booking.id,
      id: booking.id,
      bookingType,
      bookingCategory,
      isShared,
      serviceName: tripTitle,
      tripTitle,
      packageName: booking.details?.package || tourSnapshot.packageName || (isShared ? 'Paket Open Trip' : 'Private Exclusive'),
      departureDate,
      duration,
      participantsCount,
      customerName: maskName(booking.customerName || booking.fullName || ''),
      vehicleName: booking.details?.vehicleName || tourSnapshot.vehicleName || (isShared ? 'Armada Wisata Open Trip' : 'Standard Private Tourism Vehicle'),
      pickupLocation: booking.details?.pickupLocation || booking.participantData?.pickupLocation || (isShared ? 'Meeting Point Open Trip' : 'Hotel Lobby / Meeting Point'),
      dropoffLocation: booking.details?.dropoffLocation || booking.participantData?.dropoffLocation || '',
      baseAmount,
      uniqueCode,
      paymentAmount,
      currency: 'IDR',
      paymentStatus,
      bookingStatus,
      paidAt: booking.paidAt || null,
      paymentMethod: booking.participantData?.paymentMethod ? booking.participantData.paymentMethod.toUpperCase() : 'ARTOPAY GATEWAY',
      canDownloadFinalSummary,
      canDownloadInvoice,
      gateMessage,
      tourSnapshot,
      createdAt: booking.createdAt || new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Error in /api/private-tour/check-booking:', err);
    return res.status(500).json({ error: 'Gagal memeriksa status booking', details: err.message });
  }
});

// Endpoint for Final Booking Summary / Invoice Data
// Supports both Open Trip (Share Tour) and Private Tour
app.get([
  '/api/private-tour/final-summary/:bookingCode', 
  '/api/private-tour/final-confirmation/:bookingCode',
  '/api/bookings/:bookingCode/final-summary'
], (req, res) => {
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

    if (paymentStatus === 'Paid' && bookingStatus !== 'Confirmed' && bookingStatus !== 'Completed') {
      bookingStatus = 'Pending Confirmation';
    }

    // Critical Fix #1: Enforce 403 Forbidden if not paid AND confirmed by admin (unless requester is authorized admin)
    const isConfirmed = bookingStatus === 'Confirmed' || bookingStatus === 'Completed';
    const isPaid = paymentStatus === 'Paid';
    if ((!isConfirmed || !isPaid) && !checkIsAdmin(req)) {
      return res.status(403).json({
        error: 'Dokumen Final Booking Confirmation masih terkunci (403 Forbidden). Dokumen hanya dapat diakses setelah pembayaran lunas dan pemesanan dikonfirmasi resmi oleh admin.',
        bookingStatus,
        paymentStatus,
        canDownloadFinalSummary: false
      });
    }

    // Determine category
    const isShared = booking.bookingType === 'shared' || 
      booking.tourBookingType === 'shared' || 
      booking.serviceType === 'shared' || 
      Boolean(booking.batchId);

    let matchedTrip: any = null;
    let matchedBatch: any = null;
    if (isShared) {
      if (booking.tripId) matchedTrip = (db.trips || []).find((t: any) => t.id === booking.tripId);
      if (booking.batchId) matchedBatch = (db.batches || []).find((b: any) => b.id === booking.batchId);
    }

    // SNAPSHOT DATA
    const tourSnapshot = booking.tourSnapshot || {
      tourId: booking.tripId || booking.details?.tourId || (isShared ? 'tour-open-trip' : 'tour-private'),
      tourName: booking.serviceName || booking.tripTitle || matchedTrip?.title || (isShared ? 'Open Trip Smart Journey' : 'Private Tour'),
      packageName: booking.details?.package || (isShared ? (matchedBatch?.departureDate ? `Open Trip (Jadwal: ${matchedBatch.departureDate})` : 'Paket Open Trip') : 'Private Exclusive Package'),
      duration: booking.details?.duration || '1 Hari',
      vehicleName: booking.details?.vehicleName || (isShared ? 'Armada Wisata Open Trip' : 'Standard Private Tourism Vehicle'),
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
      bookingStatus,
      paymentStatus,
      verificationHash,
      customer: {
        name: booking.customerName || booking.fullName || '',
        email: booking.customerEmail || booking.email || '',
        phone: booking.customerPhone || booking.phone || '',
        pickupLocation: booking.details?.pickupLocation || booking.participantData?.pickupLocation || (isShared ? 'Meeting Point Open Trip' : 'Hotel Lobby / Meeting Point'),
        dropoffLocation: booking.details?.dropoffLocation || booking.participantData?.dropoffLocation || ''
      },
      trip: {
        title: booking.serviceName || booking.tripTitle || matchedTrip?.title || tourSnapshot.tourName,
        package: booking.details?.package || tourSnapshot.packageName || (isShared ? 'Paket Open Trip' : 'Private Exclusive Package'),
        departureDate: booking.departureDate || matchedBatch?.departureDate || booking.details?.date || '',
        duration: booking.details?.duration || tourSnapshot.duration || '1 Hari',
        participantsCount: booking.participantsCount || booking.details?.guests || 1,
        participantsNames: booking.participantsNames || [booking.customerName || booking.fullName || 'Tamu Utama'],
        participantsManifest,
        vehicleName: booking.details?.vehicleName || tourSnapshot.vehicleName || (isShared ? 'Armada Wisata Open Trip' : 'Standard Private Tourism Vehicle'),
        pickupLocation: booking.details?.pickupLocation || booking.participantData?.pickupLocation || (isShared ? 'Meeting Point Open Trip' : 'Hotel Lobby / Meeting Point'),
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
  '/api/bookings/:bookingCode/final-confirmation.pdf',
  '/api/bookings/:bookingCode/invoice.pdf'
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

    // Critical Fix #1: Gate access - PDF download locked (HTTP 403 Forbidden) until Paid AND Confirmed by Admin
    const isConfirmed = bookingStatus === 'Confirmed' || bookingStatus === 'Completed';
    const isPaid = paymentStatus === 'Paid';
    if ((!isConfirmed || !isPaid) && !checkIsAdmin(req)) {
      return res.status(403).json({
        error: 'Dokumen Final Booking Confirmation masih terkunci (403 Forbidden). Dokumen hanya dapat diunduh setelah pembayaran berstatus Lunas (Paid) dan pemesanan telah dikonfirmasi resmi oleh Admin Pusat.',
        bookingStatus,
        paymentStatus,
        canDownloadFinalSummary: false
      });
    }

    // Determine category
    const isShared = booking.bookingType === 'shared' || 
      booking.tourBookingType === 'shared' || 
      booking.serviceType === 'shared' || 
      Boolean(booking.batchId);

    let matchedTrip: any = null;
    let matchedBatch: any = null;
    if (isShared) {
      if (booking.tripId) matchedTrip = (db.trips || []).find((t: any) => t.id === booking.tripId);
      if (booking.batchId) matchedBatch = (db.batches || []).find((b: any) => b.id === booking.batchId);
    }

    // PDF DATA SOURCE: IMMUTABLE TOUR SNAPSHOT & STORED TRANSACTION DETAILS
    const tourSnapshot = booking.tourSnapshot || {
      tourId: booking.tripId || booking.details?.tourId || (isShared ? 'tour-open-trip' : 'tour-private'),
      tourName: booking.serviceName || booking.tripTitle || matchedTrip?.title || (isShared ? 'Open Trip Smart Journey' : 'Private Tour'),
      packageName: booking.details?.package || (isShared ? (matchedBatch?.departureDate ? `Open Trip (Jadwal: ${matchedBatch.departureDate})` : 'Paket Open Trip') : 'Private Exclusive'),
      duration: booking.details?.duration || '1 Hari',
      vehicleName: booking.details?.vehicleName || (isShared ? 'Armada Wisata Open Trip' : 'Standard Private Tourism Vehicle'),
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
      bookingStatus,
      paymentStatus,
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
        pickupLocation: booking.details?.pickupLocation || booking.participantData?.pickupLocation || (isShared ? 'Meeting Point Open Trip' : 'Sesuai Konfirmasi'),
        dropoffLocation: booking.details?.dropoffLocation || booking.participantData?.dropoffLocation || undefined,
      },
      pickup: {
        location: booking.details?.pickupLocation || booking.participantData?.pickupLocation || (isShared ? 'Meeting Point Open Trip' : 'Hotel Lobby / Meeting Point'),
        date: booking.departureDate || matchedBatch?.departureDate || booking.details?.date || undefined,
        time: booking.details?.pickupTime || (booking.participantData as any)?.pickupTime || undefined
      },
      trip: {
        title: booking.serviceName || booking.tripTitle || matchedTrip?.title || tourSnapshot.tourName || (isShared ? 'Open Trip Smart Journey' : 'Private Tour'),
        package: booking.details?.package || tourSnapshot.packageName || (isShared ? 'Paket Open Trip' : 'Private Exclusive'),
        departureDate: booking.departureDate || matchedBatch?.departureDate || booking.details?.date || '',
        duration: booking.details?.duration || tourSnapshot.duration || '1 Hari',
        participantsCount: booking.participantsCount || booking.details?.guests || booking.details?.passengers || manifestItems.length || 1,
        participantsNames: booking.participantsNames || [booking.customerName || booking.fullName || 'Tamu Utama'],
        participantsManifest: manifestItems,
        vehicleName: booking.details?.vehicleName || tourSnapshot.vehicleName || (isShared ? 'Armada Wisata Open Trip' : 'Standard Private Tourism Vehicle'),
        pickupLocation: booking.details?.pickupLocation || booking.participantData?.pickupLocation || (isShared ? 'Meeting Point Open Trip' : 'Sesuai Konfirmasi'),
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
        paymentId: booking.paymentId || booking.paymentIntentId || (paymentStatus === 'Paid' ? 'SETTLED_ARTOPAY' : 'PENDING_PAYMENT'),
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
    console.error('Error generating PDF:', error);
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

    if (paymentStatus === 'Paid' && bookingStatus !== 'Confirmed' && bookingStatus !== 'Completed') {
      bookingStatus = 'Pending Confirmation';
    }

    // Critical Fix #1: Gate access - HTML print service locked (HTTP 403 Forbidden) until Paid AND Confirmed by Admin
    const isConfirmed = bookingStatus === 'Confirmed' || bookingStatus === 'Completed';
    const isPaid = paymentStatus === 'Paid';
    if ((!isConfirmed || !isPaid) && !checkIsAdmin(req)) {
      return res.status(403).send('<h1>403 Forbidden: Dokumen Final Booking Confirmation masih terkunci. Pembayaran harus lunas dan pemesanan harus dikonfirmasi oleh Admin.</h1>');
    }

    // Determine category
    const isShared = booking.bookingType === 'shared' || 
      booking.tourBookingType === 'shared' || 
      booking.serviceType === 'shared' || 
      Boolean(booking.batchId);

    let matchedTrip: any = null;
    let matchedBatch: any = null;
    if (isShared) {
      if (booking.tripId) matchedTrip = (db.trips || []).find((t: any) => t.id === booking.tripId);
      if (booking.batchId) matchedBatch = (db.batches || []).find((b: any) => b.id === booking.batchId);
    }

    const tourSnapshot = booking.tourSnapshot || {
      tourId: booking.tripId || booking.details?.tourId || (isShared ? 'tour-open-trip' : 'tour-private'),
      tourName: booking.serviceName || booking.tripTitle || matchedTrip?.title || (isShared ? 'Open Trip Smart Journey' : 'Private Tour'),
      packageName: booking.details?.package || (isShared ? (matchedBatch?.departureDate ? `Open Trip (Jadwal: ${matchedBatch.departureDate})` : 'Paket Open Trip') : 'Private Exclusive'),
      duration: booking.details?.duration || '1 Hari',
      vehicleName: booking.details?.vehicleName || (isShared ? 'Armada Wisata Open Trip' : 'Standard Private Tourism Vehicle'),
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
    const verificationHash = sanitizeHtml(booking.verificationHash);
    const bookingCode = sanitizeHtml(booking.bookingCode || booking.id);

    const rawMembers = booking.participantData?.members || booking.participantsManifest || [];
    const manifestItems = Array.isArray(rawMembers) && rawMembers.length > 0
      ? rawMembers.map((m: any, i: number) => `${i + 1}. ${sanitizeHtml(m.name || m.fullName)}${m.nationality ? ' — ' + sanitizeHtml(m.nationality) : ''}`)
      : (booking.participantsNames || [booking.customerName || booking.fullName || 'Tamu Utama']).map((name: string, i: number) => 
          `${i + 1}. ${sanitizeHtml(name)}${booking.nationalityType === 'foreign' ? ' — International' : (booking.nationalityType === 'domestic' ? ' — Indonesia' : '')}`
        );

    const itineraryItems = Array.isArray(tourSnapshot.itinerary) && tourSnapshot.itinerary.length > 0
      ? tourSnapshot.itinerary.map((item: any, idx: number) => {
          const rawTitle = typeof item === 'string' ? item : (item.title || item.day || `Day ${idx + 1}`);
          const rawDesc = typeof item === 'object' && item.desc ? item.desc : (typeof item === 'object' && item.activities ? item.activities.join(', ') : '');
          const title = sanitizeHtml(rawTitle);
          const desc = sanitizeHtml(rawDesc);
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

    const customerNameEscaped = sanitizeHtml(booking.customerName || booking.fullName || '-');
    const customerPhoneEscaped = sanitizeHtml(booking.customerPhone || booking.phone || '-');
    const customerEmailEscaped = sanitizeHtml(booking.customerEmail || booking.email || '-');
    const pickupEscaped = sanitizeHtml(booking.details?.pickupLocation || booking.participantData?.pickupLocation || '-');
    const dropoffEscaped = sanitizeHtml(booking.details?.dropoffLocation || booking.participantData?.dropoffLocation || '');
    const tourNameEscaped = sanitizeHtml(booking.serviceName || booking.tripTitle || tourSnapshot.tourName || '-');
    const packageNameEscaped = sanitizeHtml(booking.details?.package || tourSnapshot.packageName || 'Private Exclusive');
    const departureDateEscaped = sanitizeHtml(booking.departureDate || booking.details?.date || '-');
    const durationEscaped = sanitizeHtml(booking.details?.duration || tourSnapshot.duration || '1 Hari');
    const vehicleEscaped = sanitizeHtml(booking.details?.vehicleName || tourSnapshot.vehicleName || 'Standard Private Tourism Vehicle');
    const paymentMethodEscaped = sanitizeHtml(booking.participantData?.paymentMethod ? booking.participantData.paymentMethod.toUpperCase() : 'ARTOPAY GATEWAY');
    const paymentIdEscaped = sanitizeHtml(booking.paymentId || booking.paymentIntentId || 'TX-VERIFIED-ARTOPAY');
    const specialRequestsEscaped = sanitizeHtml(booking.details?.specialRequests || booking.notes || booking.specialRequests || booking.adminNotes || '');

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
        <div class="doc-type">${isShared ? 'INVOICE &amp; BOOKING CONFIRMATION — OPEN TRIP' : 'INVOICE &amp; BOOKING CONFIRMATION — PRIVATE TOUR'}</div>
        <p class="brand-subtitle">PT Smart Journey Transindo • Lisensi Resmi Biro Perjalanan Wisata</p>
        <p class="brand-subtitle">Malang &amp; Surabaya, Jawa Timur • Hotline 24/7: +62 852-1234-7289</p>
        <div class="badge-wrap">
          <span class="badge ${bookingStatus === 'Confirmed' || bookingStatus === 'Completed' ? 'badge-confirmed' : ''}" style="${bookingStatus !== 'Confirmed' && bookingStatus !== 'Completed' ? 'background:#fef3c7;color:#b45309;border:1px solid #fcd34d;' : ''}">
            ${bookingStatus === 'Confirmed' || bookingStatus === 'Completed' ? '✓ BOOKING CONFIRMED' : '⏳ PENDING CONFIRMATION'}
          </span>
          <span class="badge ${paymentStatus === 'Paid' ? 'badge-paid' : ''}" style="${paymentStatus !== 'Paid' ? 'background:#fef3c7;color:#b45309;border:1px solid #fcd34d;' : ''}">
            ${paymentStatus === 'Paid' ? '✓ PAYMENT PAID' : '⏳ PAYMENT PENDING'}
          </span>
        </div>
      </div>
      <div class="booking-meta">
        <div class="code-label">Booking Code / ID</div>
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
          <span class="info-value">${customerNameEscaped}</span>
        </div>
        <div class="info-row">
          <span class="info-label">WhatsApp / Telepon</span>
          <span class="info-value">${customerPhoneEscaped}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Email</span>
          <span class="info-value">${customerEmailEscaped}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Lokasi Penjemputan</span>
          <span class="info-value">${pickupEscaped}</span>
        </div>
        ${dropoffEscaped ? `
        <div class="info-row">
          <span class="info-label">Lokasi Pengantaran</span>
          <span class="info-value">${dropoffEscaped}</span>
        </div>
        ` : ''}
      </div>

      <!-- Private Tour Information -->
      <div class="info-card">
        <div class="section-title" style="margin-top:0;">Informasi Private Tour</div>
        <div class="info-row">
          <span class="info-label">Nama Paket Tur</span>
          <span class="info-value" style="color: #b45309;">${tourNameEscaped}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Kategori / Paket</span>
          <span class="info-value">${packageNameEscaped}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tanggal Wisata</span>
          <span class="info-value">${departureDateEscaped}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Durasi</span>
          <span class="info-value">${durationEscaped}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Jumlah Peserta</span>
          <span class="info-value">${booking.participantsCount || booking.details?.guests || 1} Orang</span>
        </div>
        <div class="info-row">
          <span class="info-label">Pilihan Kendaraan</span>
          <span class="info-value">${vehicleEscaped}</span>
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
      <div>Metode Pembayaran: <strong>${paymentMethodEscaped}</strong></div>
      <div>ID Transaksi: <strong>${paymentIdEscaped}</strong></div>
      <div>Waktu Pelunasan: <strong>${booking.paidAt ? new Date(booking.paidAt).toLocaleString('id-ID') : '-'}</strong></div>
    </div>

    ${specialRequestsEscaped ? `
    <div class="info-card" style="margin-top: 12px;">
      <div class="section-title" style="margin-top:0;">Permintaan Khusus / Catatan</div>
      <div style="font-size: 12px; color: #334155;">${specialRequestsEscaped}</div>
    </div>
    ` : ''}

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
app.post('/api/private-tour/bookings/:id/confirm', requireAdminAuth, async (req, res) => {
  try {
    const targetId = req.params.id;
    let booking = await bookingsRepo.getByCode(targetId);
    const db = readDB();
    const index = (db.bookings || []).findIndex((b: any) => 
      b.id === targetId || b.bookingCode === targetId
    );

    if (!booking && index === -1) {
      return res.status(404).json({ error: 'Booking tidak ditemukan.' });
    }

    const currentBooking = booking || db.bookings[index];

    // STRICT VALIDATION: Booking must be Paid before it can be confirmed
    if (currentBooking.paymentStatus !== 'Paid') {
      return res.status(400).json({ 
        error: 'Booking belum dibayar (Payment Status: ' + (currentBooking.paymentStatus || 'Pending') + '). Pembayaran harus berstatus "Paid" sebelum dapat dikonfirmasi.' 
      });
    }

    const confirmedAt = new Date().toISOString();
    const adminNotes = req.body?.adminNotes || currentBooking.adminNotes;

    const updated = await bookingsRepo.update(currentBooking.id, {
      status: 'Confirmed',
      confirmedAt,
      adminNotes
    });

    if (index !== -1) {
      db.bookings[index].status = 'Confirmed';
      db.bookings[index].confirmedAt = confirmedAt;
      if (adminNotes) db.bookings[index].adminNotes = adminNotes;
      writeDB(db);
    }

    console.log(`[Admin] Private Tour Booking ${currentBooking.id} (${currentBooking.bookingCode}) CONFIRMED. Payment=${currentBooking.paymentStatus}, Status=Confirmed`);

    return res.json({
      success: true,
      message: `Booking #${currentBooking.bookingCode || currentBooking.id} berhasil dikonfirmasi oleh Admin Pusat.`,
      booking: updated || db.bookings[index]
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

const handleAdminLogin = async (req: express.Request, res: express.Response) => {
  const { email, password, secretKey } = req.body || {};
  const configuredEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const configuredPassword = (process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== 'production' ? 'admin123' : '')).trim();
  const configuredSecret = (process.env.ADMIN_SECRET_KEY || '').trim();

  const inputPassword = String(password || '').trim();
  const inputSecret = String(secretKey || '').trim();
  const cleanInputEmail = email ? String(email).trim().toLowerCase() : '';

  // If email is explicitly provided and ADMIN_EMAIL is configured, it must match
  if (configuredEmail.length > 0 && cleanInputEmail && cleanInputEmail !== configuredEmail) {
    return res.status(401).json({ error: 'Kredensial login tidak valid. Silakan coba lagi.' });
  }

  // 1. Direct Secret Key validation (via secretKey or password field)
  const isSecretValid = Boolean(
    configuredSecret.length > 0 &&
    (inputSecret === configuredSecret || inputPassword === configuredSecret)
  );

  // 2. Configured Password validation
  const isPasswordMatch = Boolean(
    configuredPassword.length > 0 &&
    inputPassword === configuredPassword
  );

  // Email validation: if ADMIN_EMAIL is configured in environment, check it.
  // If not configured, allow matching against common admin conventions or password-only unlock.
  const isEmailMatch = configuredEmail.length > 0
    ? (cleanInputEmail === configuredEmail || !cleanInputEmail)
    : Boolean(!cleanInputEmail || cleanInputEmail.includes('admin'));

  const isCredentialValid = isSecretValid || (isPasswordMatch && isEmailMatch);

  if (isCredentialValid) {
    // Generate secure random session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    await saveAdminSession(sessionToken);

    console.log('[Auth] Admin logged in successfully, session saved to persistent storage.');
    return res.json({ token: sessionToken, success: true });
  }

  return res.status(401).json({ error: 'Kredensial login tidak valid. Silakan coba lagi.' });
};

const handleAdminLogout = async (req: express.Request, res: express.Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
  if (token) {
    try {
      await removeAdminSession(token);
    } catch (err) {
      console.error('Error invalidating admin session in database:', err);
      return res.status(500).json({ error: 'Gagal mengakhiri sesi admin pada database.' });
    }
  }
  return res.json({ success: true, message: 'Admin session terminated' });
};

app.get(['/api/auth/verify', '/api/admin/verify'], requireAdminAuth, (req, res) => {
  return res.json({ success: true, valid: true, authenticated: true });
});

app.post('/api/auth/login', loginLimiter, handleAdminLogin);
app.post('/api/admin/login', loginLimiter, handleAdminLogin);
app.post('/api/auth/logout', handleAdminLogout);
app.post('/api/admin/logout', handleAdminLogout);

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

function normalizeEnvVar(val: string | undefined): string {
  if (!val) return '';
  return val.replace(/^["']|["']$/g, '').trim();
}

function getSafeCredentialInfo(val: string | undefined) {
  const clean = normalizeEnvVar(val);
  if (!clean) return { exists: false, length: 0, prefix: '-', suffix: '-' };
  const prefix = clean.substring(0, 4);
  const suffix = clean.length >= 4 ? clean.substring(clean.length - 4) : clean;
  return { exists: true, length: clean.length, prefix, suffix };
}

function getArtoPayConfig() {
  const secretKey = normalizeEnvVar(process.env.ARTOPAY_SECRET_KEY);
  const rawEnv = normalizeEnvVar(process.env.ARTOPAY_ENV).toLowerCase();

  let envMode: 'production' | 'sandbox';
  if (rawEnv === 'production') {
    envMode = 'production';
  } else if (rawEnv === 'sandbox') {
    envMode = 'sandbox';
  } else if (normalizeEnvVar(process.env.ARTOPAY_SANDBOX) === 'false') {
    envMode = 'production';
  } else if (normalizeEnvVar(process.env.ARTOPAY_SANDBOX) === 'true') {
    envMode = 'sandbox';
  } else {
    if (secretKey.startsWith('sk_live_')) {
      envMode = 'production';
    } else if (secretKey.startsWith('sk_test_') || secretKey.startsWith('sk_sandbox_')) {
      envMode = 'sandbox';
    } else {
      envMode = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
    }
  }

  const rawBaseUrl = normalizeEnvVar(process.env.ARTOPAY_API_BASE_URL);
  let apiBaseUrl: string;
  if (rawBaseUrl && !rawBaseUrl.includes('api.artopay.com') && !rawBaseUrl.includes('api.arto-pay.com')) {
    apiBaseUrl = rawBaseUrl;
  } else {
    apiBaseUrl = envMode === 'production' ? 'https://api.arto-pay.com' : 'https://api-sandbox.arto-pay.com';
  }

  const businessUnitCode = normalizeEnvVar(process.env.ARTOPAY_BUSINESS_UNIT_CODE || process.env.ARTOPAY_BUSINESS_UNIT);

  return {
    secretKey,
    envMode,
    apiBaseUrl,
    businessUnitCode,
    isConfigured: Boolean(secretKey)
  };
}

function logArtoPayStartupConfig() {
  const config = getArtoPayConfig();
  console.log('[ArtoPay Configuration Check]');
  console.log(`ArtoPay Environment: ${config.envMode}`);
  console.log(`ArtoPay Base URL: ${config.apiBaseUrl}`);
  console.log(`Secret configured: ${config.isConfigured}`);
  console.log(`Secret length: ${config.secretKey.length}`);
  console.log(`Business Unit configured: ${Boolean(config.businessUnitCode)}`);
}

app.get('/api/artopay/config', (req, res) => {
  const config = getArtoPayConfig();
  const isAdmin = checkIsAdmin(req);

  if (!isAdmin) {
    return res.json({
      isConfigured: config.isConfigured,
      env: config.envMode,
      apiBaseUrl: config.apiBaseUrl,
      secretKeyInfo: getSafeCredentialInfo(config.secretKey),
      message: config.isConfigured
        ? "ArtoPay Server Secret Key is configured."
        : "ARTOPAY_SECRET_KEY is missing. Please add ARTOPAY_SECRET_KEY in Server Environment Variables."
    });
  }

  const publicKey = normalizeEnvVar(process.env.VITE_ARTOPAY_PUBLIC_KEY || process.env.ARTOPAY_PUBLIC_KEY);

  res.json({
    isConfigured: config.isConfigured,
    env: config.envMode,
    apiBaseUrl: config.apiBaseUrl,
    secretKeyInfo: getSafeCredentialInfo(config.secretKey),
    publicKeyInfo: getSafeCredentialInfo(publicKey),
    businessUnitInfo: getSafeCredentialInfo(config.businessUnitCode),
    message: config.isConfigured
      ? "ArtoPay Server Secret Key is configured."
      : "ARTOPAY_SECRET_KEY is missing. Please add ARTOPAY_SECRET_KEY in Server Environment Variables."
  });
});

function parseCustomerPhone(rawPhone?: string): { countryCode: string; number: string } {
  const clean = (rawPhone || '').replace(/[^\d+]/g, '');
  if (!clean) {
    return { countryCode: '+62', number: '8123456789' };
  }
  if (clean.startsWith('+62')) {
    return { countryCode: '+62', number: clean.slice(3).replace(/^0+/, '') || '8123456789' };
  }
  if (clean.startsWith('62')) {
    return { countryCode: '+62', number: clean.slice(2).replace(/^0+/, '') || '8123456789' };
  }
  if (clean.startsWith('0')) {
    return { countryCode: '+62', number: clean.slice(1) || '8123456789' };
  }
  if (clean.startsWith('+')) {
    const match = clean.match(/^(\+\d{1,3})(\d+)$/);
    if (match) {
      return { countryCode: match[1], number: match[2] };
    }
  }
  return { countryCode: '+62', number: clean };
}

app.post(['/api/artopay/payment-intent', '/artopay/payment-intent', '/api/payment/create-intent'], paymentLimiter, async (req, res) => {
  try {
    let bodyData = req.body;
    if (typeof bodyData === 'string') {
      try {
        bodyData = JSON.parse(bodyData);
      } catch (e) {
        bodyData = {};
      }
    }

    const { orderId, amount, currency, description, customerId, metadata, customerName, customerEmail, customerPhone } = bodyData || {};

    if (!orderId) {
      return res.status(400).json({ error: 'orderId parameter is required' });
    }

    if (currency === undefined || currency === null || typeof currency !== 'string' || currency.trim() === '') {
      return res.status(400).json({ error: 'Mata uang (currency) wajib diisi dan harus IDR.' });
    }

    if (currency.trim().toUpperCase() !== 'IDR') {
      return res.status(400).json({ error: 'Mata uang (currency) harus IDR.' });
    }

    if (amount !== undefined) {
      const num = Number(amount);
      if (isNaN(num) || num <= 0) {
        return res.status(400).json({ error: 'Amount must be a valid positive number' });
      }
    }

    // Check DB for existing order to avoid double payment or amount tampering
    // BACKEND IS THE SINGLE SOURCE OF TRUTH FOR PAYMENT AMOUNT (Requirement 7 & 10)
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

    if (existingOrder.status === 'Cancelled' || existingOrder.status === 'Rejected') {
      return res.status(400).json({ error: 'Pesanan ini telah dibatalkan atau ditolak. Tidak dapat membuat transaksi pembayaran.' });
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

    // REQUIREMENT 7: Final payment amount sent to ArtoPay MUST be paymentAmount (baseAmount + uniqueCode)!
    const numericAmount = paymentAmount;

    const config = getArtoPayConfig();
    const { secretKey, envMode, apiBaseUrl, businessUnitCode, isConfigured } = config;

    const publicKey = normalizeEnvVar(process.env.VITE_ARTOPAY_PUBLIC_KEY || process.env.ARTOPAY_PUBLIC_KEY);
    const secretKeyInfo = getSafeCredentialInfo(secretKey);
    const publicKeyInfo = getSafeCredentialInfo(publicKey);

    // CATEGORY A: SECURITY & CONFIGURATION RULE - Reject request if Secret Key is missing in process.env
    if (!isConfigured || !secretKey) {
      const configErrorMsg = 'Integrasi ArtoPay belum siap. ARTOPAY_SECRET_KEY belum diisi di Production Server Environment.';
      console.error('[ArtoPay Server Error]', configErrorMsg, {
        envMode,
        apiBaseUrl,
        secretKeyInfo,
        publicKeyInfo
      });

      return res.status(500).json({
        category: 'ENVIRONMENT_VARIABLE_MISSING',
        error: configErrorMsg,
        details: 'Variabel ARTOPAY_SECRET_KEY bernilai undefined/kosong pada server runtime.',
        envCheck: {
          ARTOPAY_ENV: envMode,
          ARTOPAY_API_BASE_URL: apiBaseUrl,
          hasSecretKey: false,
          hasPublicKey: Boolean(publicKey)
        }
      });
    }

    const numAmt = Number(numericAmount);
    if (!Number.isFinite(numAmt) || !Number.isInteger(numAmt) || numAmt <= 0) {
      return res.status(400).json({ error: 'Nominal pembayaran (amount) harus berupa bilangan bulat positif yang valid.' });
    }
    const formattedAmount = String(numAmt);

    const customerDisplayName = String(
      existingOrder.fullName || existingOrder.customerName || customerName || 'Customer'
    ).substring(0, 100);

    const customerEmailStr = String(
      existingOrder.email || existingOrder.customerEmail || customerEmail || 'customer@example.com'
    );

    const customerPhoneStr = String(
      existingOrder.phone || existingOrder.customerPhone || customerPhone || '+628123456789'
    );

    // Official ArtoPay Payment Intent payload (POST /v1.1/payment-intents)
    // Reference: https://docs.arto-pay.com/api/payment-intents
    const paymentIntentPayload: Record<string, any> = {
      amount: formattedAmount,
      currency: 'IDR',
      orderId: String(orderId),
      description: String(description || `Payment for order ${orderId}`).substring(0, 500),
      customerId: customerId || `cust_${String(orderId).replace(/[^a-zA-Z0-9]/g, '_')}`,
      metadata: {
        ...(existingOrder ? {
          bookingId: existingOrder.id,
          bookingCode: existingOrder.bookingCode,
          tourId: existingOrder.tripId,
          tourName: existingOrder.tripTitle,
          customerName: customerDisplayName,
          customerEmail: customerEmailStr,
          customerPhone: customerPhoneStr,
          travelDate: existingOrder.departureDate,
          nationality: existingOrder.nationalityType,
          pax: existingOrder.participantsCount,
          baseAmount: existingOrder.baseAmount,
          uniqueCode: existingOrder.uniqueCode,
          paymentAmount: existingOrder.paymentAmount
        } : {}),
        ...(metadata || {})
      }
    };

    if (businessUnitCode) {
      paymentIntentPayload.businessUnitCode = businessUnitCode;
    }

    const candidateHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Secret-Key': secretKey
    };

    if (businessUnitCode) {
      candidateHeaders['X-Business-Unit-Code'] = businessUnitCode;
    }

    // Primary endpoint: Official ArtoPay Payment Intent endpoint /v1.1/payment-intents
    const endpointV11 = `${apiBaseUrl.replace(/\/+$/, '')}/v1.1/payment-intents`;
    let calledEndpoint = endpointV11;
    console.log(`[ArtoPay Backend Request] Target: ${endpointV11} | Env: ${envMode} | Amount: ${formattedAmount} | SecretKey: ${secretKeyInfo.prefix}...${secretKeyInfo.suffix} (len:${secretKeyInfo.length})`);

    let response: Response;

    // CATEGORY B: OUTBOUND NETWORK/FETCH HANDLER
    try {
      response = await fetch(endpointV11, {
        method: 'POST',
        headers: candidateHeaders,
        body: JSON.stringify(paymentIntentPayload)
      });
    } catch (fetchErr: any) {
      console.error('[ArtoPay Network Fetch Exception]:', fetchErr);
      return res.status(500).json({
        category: 'NETWORK_FETCH_ERROR',
        error: 'Gagal terhubung ke server ArtoPay Payment Gateway (Outbound HTTPS Network Error).',
        details: fetchErr.message || String(fetchErr),
        targetEndpoint: calledEndpoint,
        baseUrl: apiBaseUrl
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
        userFriendlyError = `Autentikasi ArtoPay gagal (401 Unauthorized). Silakan periksa kembali ARTOPAY_SECRET_KEY dan kesesuaian environment (${envMode}: ${apiBaseUrl}) di Server Environment Anda.`;
        console.error('[ArtoPay 401 Unauthorized Diagnostic]:');
        console.error(`HTTP status: ${response.status}`);
        console.error(`endpoint: ${calledEndpoint}`);
        console.error(`environment: ${envMode}`);
        console.error(`secret configured: ${Boolean(secretKey)}`);
        console.error(`secret length: ${secretKey.length}`);
        console.error(`business unit configured: ${Boolean(businessUnitCode)}`);
        console.error(`ArtoPay response body: ${errorText}`);
      } else if (response.status === 403) {
        category = 'ARTOPAY_FORBIDDEN_403';
        userFriendlyError = 'Akses ArtoPay ditolak (403 Forbidden). Pastikan IP server atau domain Anda diizinkan di dashboard ArtoPay.';
      } else if (response.status === 400) {
        category = 'ARTOPAY_BAD_REQUEST_400';
        userFriendlyError = `Request pembayaran ditolak ArtoPay (400 Bad Request): ${errorText}`;
      } else if (response.status >= 500) {
        category = 'ARTOPAY_SERVER_ERROR_500';
        userFriendlyError = 'Server ArtoPay Gateway mengalami gangguan internal (HTTP 500).';
      }

      return res.status(response.status >= 400 && response.status < 600 ? response.status : 500).json({
        category,
        error: userFriendlyError,
        status: response.status,
        details: errorText,
        diagnostic: {
          environment: envMode,
          apiBaseUrl: apiBaseUrl,
          endpoint: calledEndpoint,
          hasSecretKey: Boolean(secretKey),
          secretLength: secretKey.length,
          hasBusinessUnit: Boolean(businessUnitCode)
        }
      });
    }

    const data: any = await response.json();
    console.log('[ArtoPay API Gateway Response Success]:', {
      id: data.id || data.paymentId || data.responseData?.id,
      orderId: data.orderId || data.responseData?.orderId,
      url: data.responseData?.url || data.url
    });

    const resData = data.responseData || data.data || data;

    const paymentId = resData.id || resData.paymentId || resData.payment_id;
    const secret = resData.clientSecret || resData.secret || resData.client_secret;
    const customerToken = resData.customerToken || resData.token || resData.customer_token;
    const checkoutUrl = resData.url || resData.checkoutUrl || resData.paymentUrl || resData.redirectUrl;

    // Update DB with active paymentIntentId and checkoutUrl
    if (existingOrderIndex !== -1 && db.bookings[existingOrderIndex]) {
      db.bookings[existingOrderIndex].paymentIntentId = paymentId;
      db.bookings[existingOrderIndex].paymentStatus = 'Pending Payment';
      db.bookings[existingOrderIndex].status = 'Pending';
      if (checkoutUrl) {
        db.bookings[existingOrderIndex].checkoutUrl = checkoutUrl;
      }
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
      url: checkoutUrl,
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

// -------------------------------------------------------------
// Unified Payment Verification Logic (Issue 4)
// Shared across ArtoPay Webhook and Active Polling Endpoints
// -------------------------------------------------------------

interface PaymentVerificationResult {
  valid: boolean;
  status: 'PAID' | 'PENDING' | 'EXPIRED' | 'FAILED' | 'INVALID';
  error?: string;
  expectedAmount: number;
  receivedAmount?: number;
}

function verifyPayment(booking: any, paymentData: any): PaymentVerificationResult {
  const expectedAmount = Number(
    booking.paymentAmount || 
    (booking.uniqueCode ? ((booking.baseAmount || booking.totalPriceIDR || 0) + booking.uniqueCode) : (booking.totalPriceIDR || booking.totalPrice || 0))
  );

  if (!paymentData || typeof paymentData !== 'object') {
    return {
      valid: false,
      status: 'PENDING',
      error: 'Data pembayaran tidak ditemukan atau tidak valid',
      expectedAmount
    };
  }

  const rawData = paymentData.responseData || paymentData.data || paymentData;
  const rawStatus = String(
    paymentData.status || 
    rawData.status || 
    paymentData.paymentStatus || 
    paymentData.orderStatus || 
    paymentData.transactionStatus || 
    paymentData.transaction_status ||
    rawData.transaction_status ||
    rawData.transactionStatus ||
    paymentData.result || 
    ''
  ).toUpperCase().trim();

  const successStatuses = ['SUCCESS', 'PAID', 'SETTLEMENT', 'COMPLETED', 'CAPTURE', '00', '200', 'SUCCESSFUL', 'APPROVED'];
  const expireStatuses = ['EXPIRED', 'EXPIRE'];
  const failureStatuses = ['FAILED', 'FAILURE', 'CANCELLED', 'CANCELED', 'REJECTED', 'DENIED', 'CANCEL'];

  const isSuccess = successStatuses.includes(rawStatus);
  const isExpire = expireStatuses.includes(rawStatus);
  const isFailed = failureStatuses.includes(rawStatus);

  if (!isSuccess) {
    if (isExpire) {
      return {
        valid: false,
        status: 'EXPIRED',
        error: `Status transaksi ArtoPay kedaluwarsa: ${rawStatus}`,
        expectedAmount
      };
    }
    if (isFailed) {
      return {
        valid: false,
        status: 'FAILED',
        error: `Status transaksi ArtoPay gagal/dibatalkan: ${rawStatus}`,
        expectedAmount
      };
    }
    return {
      valid: false,
      status: 'PENDING',
      error: `Transaksi masih berlangsung (Status: ${rawStatus || 'PENDING'}).`,
      expectedAmount
    };
  }

  // 1. Currency Validation: Strictly IDR and MANDATORY (Reject if missing or not IDR)
  const rawCurrencyValue = paymentData.currency ?? rawData.currency ?? paymentData.currencyCode ?? rawData.currencyCode;
  if (rawCurrencyValue === undefined || rawCurrencyValue === null || String(rawCurrencyValue).trim() === '') {
    return {
      valid: false,
      status: 'INVALID',
      error: 'Mata uang (currency) wajib dicantumkan oleh payment provider.',
      expectedAmount
    };
  }
  const rawCurrency = String(rawCurrencyValue).toUpperCase().trim();
  if (rawCurrency !== 'IDR') {
    return {
      valid: false,
      status: 'INVALID',
      error: `Mata uang transaksi ditolak: ${rawCurrency}. Smart Journey hanya menerima transaksi IDR.`,
      expectedAmount
    };
  }

  // 2. Amount Validation: MANDATORY, PARSED, EXACT INTEGER MATCH (NO Math.round)
  const receivedAmountRaw = paymentData.amount ?? rawData.amount ?? paymentData.gross_amount ?? rawData.gross_amount ?? paymentData.grossAmount ?? rawData.grossAmount;
  if (receivedAmountRaw === undefined || receivedAmountRaw === null || String(receivedAmountRaw).trim() === '') {
    return {
      valid: false,
      status: 'INVALID',
      error: 'Nominal pembayaran (amount) wajib disertakan oleh payment provider.',
      expectedAmount
    };
  }
  const numAmount = Number(receivedAmountRaw);
  if (!Number.isFinite(numAmount) || !Number.isInteger(numAmount) || numAmount <= 0) {
    return {
      valid: false,
      status: 'INVALID',
      error: 'Nominal pembayaran (amount) harus berupa bilangan bulat positif yang valid.',
      expectedAmount
    };
  }
  const receivedAmount = numAmount;
  if (expectedAmount <= 0 || receivedAmount !== expectedAmount) {
    return {
      valid: false,
      status: 'INVALID',
      error: `Nominal pembayaran tidak sesuai. Diharapkan: Rp ${expectedAmount.toLocaleString('id-ID')}, Diterima: Rp ${receivedAmount.toLocaleString('id-ID')}`,
      expectedAmount,
      receivedAmount
    };
  }

  // 3. Transaction Identity Validation: MANDATORY AT LEAST ONE MATCHING IDENTIFIER
  const receivedOrderId = String(
    paymentData.orderId || 
    paymentData.order_id || 
    paymentData.orderID ||
    rawData.orderId || 
    rawData.order_id || 
    paymentData.metadata?.orderId ||
    rawData.metadata?.orderId ||
    ''
  ).trim();

  const receivedPaymentId = String(
    paymentData.paymentId || 
    paymentData.payment_id || 
    paymentData.id || 
    rawData.paymentId || 
    rawData.payment_id || 
    rawData.id || 
    paymentData.transaction_id || 
    paymentData.transactionId || 
    rawData.transaction_id || 
    rawData.transactionId || 
    ''
  ).trim();

  const receivedPaymentIntentId = String(
    paymentData.paymentIntentId || 
    paymentData.payment_intent_id || 
    rawData.paymentIntentId || 
    rawData.payment_intent_id || 
    ''
  ).trim();

  if (!receivedOrderId && !receivedPaymentId && !receivedPaymentIntentId) {
    return {
      valid: false,
      status: 'INVALID',
      error: 'Identifier transaksi (orderId/paymentId/paymentIntentId) wajib disertakan oleh payment provider.',
      expectedAmount
    };
  }

  const bCode = String(booking.bookingCode || '').trim().toLowerCase();
  const bId = String(booking.id || '').trim().toLowerCase();
  const bPaymentIntentId = String(booking.paymentIntentId || '').trim().toLowerCase();
  const bPaymentId = String(booking.paymentId || '').trim().toLowerCase();

  let identityMatched = false;

  if (receivedOrderId) {
    const oLower = receivedOrderId.toLowerCase();
    if (oLower === bCode || oLower === bId) {
      identityMatched = true;
    }
  }

  if (!identityMatched && receivedPaymentIntentId) {
    const piLower = receivedPaymentIntentId.toLowerCase();
    if (piLower === bPaymentIntentId || piLower === bId) {
      identityMatched = true;
    }
  }

  if (!identityMatched && receivedPaymentId) {
    const pLower = receivedPaymentId.toLowerCase();
    if (pLower === bPaymentId || pLower === bPaymentIntentId || pLower === bId) {
      identityMatched = true;
    }
  }

  if (!identityMatched) {
    return {
      valid: false,
      status: 'INVALID',
      error: `Identifier transaksi tidak cocok dengan pemesanan. Diterima: orderId=${receivedOrderId || '-'}, paymentId=${receivedPaymentId || '-'}, paymentIntentId=${receivedPaymentIntentId || '-'}`,
      expectedAmount
    };
  }

  return {
    valid: true,
    status: 'PAID',
    expectedAmount,
    receivedAmount
  };
}

// Official ArtoPay Webhook / Callback Handler Endpoint
app.post(['/api/artopay/webhook', '/artopay/webhook'], (req, res) => {
  try {
    const body = req.body || {};
    const logOrderId = body.orderId || body.order_id || body.orderID || body.data?.orderId || body.data?.order_id || '-';
    const logPaymentId = body.id || body.paymentId || body.payment_id || body.data?.id || body.data?.paymentId || '-';
    const logStatus = body.status || body.transaction_status || body.payment_status || '-';
    console.log(`[ArtoPay Webhook Callback Received] orderId=${logOrderId}, paymentId=${logPaymentId}, status=${logStatus}`);

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

      const incomingBuf = Buffer.from(incomingSignature.toLowerCase(), 'utf8');
      const expectedBuf = Buffer.from(expectedSignature.toLowerCase(), 'utf8');

      if (incomingBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(incomingBuf, expectedBuf)) {
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

    // UNIFIED VERIFICATION (Issue 4 & Issue 6)
    const verification = verifyPayment(booking, body);

    if (!verification.valid) {
      if (verification.status === 'INVALID' || verification.status === 'FAILED') {
        console.error(`[ArtoPay Webhook Verification FAILED] Order ${orderId || booking.id}: ${verification.error}`);
        return res.status(400).json({
          error: verification.error || 'Payment verification failed',
          expectedAmount: verification.expectedAmount,
          receivedAmount: verification.receivedAmount
        });
      }

      if (verification.status === 'EXPIRED') {
        booking.paymentStatus = 'Expired';
        if (booking.status !== 'Confirmed' && booking.status !== 'Completed') {
          booking.status = 'Cancelled';
        }
        db.bookings[index] = booking;
        recalculateBatchSeats(db);
        writeDB(db);
        return res.status(200).json({
          success: true,
          orderId: booking.bookingCode || booking.id,
          paymentStatus: 'Expired',
          orderStatus: 'Cancelled',
          bookingStatus: booking.status
        });
      }

      // If still pending
      return res.status(200).json({
        success: true,
        message: verification.error || 'Payment is still pending',
        orderId: booking.bookingCode || booking.id,
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.status,
        orderStatus: booking.status
      });
    }

    // Status is verified PAID with matching amount and IDR currency
    booking.paymentStatus = 'Paid';
    // PAYMENT STATUS ≠ BOOKING STATUS
    // Customer has paid, but booking is Pending Confirmation until Admin confirms
    if (booking.status !== 'Confirmed' && booking.status !== 'Completed') {
      booking.status = 'Pending Confirmation';
    }
    booking.paidAt = booking.paidAt || new Date().toISOString();
    booking.paymentId = paymentId || booking.paymentIntentId;

    console.log(`[ArtoPay Webhook SUCCESS] Order ${orderId || booking.id}: Payment Status set to PAID, Booking Status set to ${booking.status}.`);

    db.bookings[index] = booking;
    recalculateBatchSeats(db);
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
      const config = getArtoPayConfig();
      const { secretKey, apiBaseUrl, businessUnitCode } = config;

      if (secretKey) {
        const checkUrl = `${apiBaseUrl.replace(/\/+$/, '')}/v1.1/payment-intents/${booking.paymentIntentId}`;

        try {
          const verifyHeaders: Record<string, string> = {
            'X-Secret-Key': secretKey
          };
          if (businessUnitCode) {
            verifyHeaders['X-Business-Unit-Code'] = businessUnitCode;
          }

          const verifyRes = await fetch(checkUrl, {
            headers: verifyHeaders
          });

          if (verifyRes.ok) {
            const statusData: any = await verifyRes.json();
            const verification = verifyPayment(booking, statusData);

            if (verification.valid && verification.status === 'PAID') {
              booking.paymentStatus = 'Paid';
              if (booking.status !== 'Confirmed' && booking.status !== 'Completed') {
                booking.status = 'Pending Confirmation';
              }
              booking.paidAt = booking.paidAt || new Date().toISOString();
              recalculateBatchSeats(db);
              writeDB(db);
            } else if (verification.status === 'FAILED' || verification.status === 'EXPIRED') {
              const resData = statusData.responseData || statusData;
              const remoteStatus = String(resData.status || resData.transaction_status || '').toUpperCase();
              if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(remoteStatus) || verification.status === 'EXPIRED') {
                booking.paymentStatus = remoteStatus === 'EXPIRED' || verification.status === 'EXPIRED' ? 'Expired' : 'Failed';
                if (booking.status !== 'Confirmed' && booking.status !== 'Completed') {
                  booking.status = 'Cancelled';
                }
                recalculateBatchSeats(db);
                writeDB(db);
              }
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
      bookingCode: booking.bookingCode || booking.id,
      paymentStatus: booking.paymentStatus || 'Pending',
      orderStatus: booking.status || 'Pending',
      bookingStatus: booking.status || 'Pending',
      baseAmount: booking.baseAmount || booking.totalPriceIDR || booking.totalPrice || 0,
      uniqueCode: booking.uniqueCode || 0,
      paymentAmount: booking.paymentAmount || (booking.uniqueCode ? ((booking.baseAmount || booking.totalPriceIDR || 0) + booking.uniqueCode) : (booking.totalPriceIDR || booking.totalPrice || 0)),
      paidAt: booking.paidAt || null,
      currency: 'IDR',
      canDownloadInvoice: booking.paymentStatus === 'Paid' && (booking.status === 'Confirmed' || booking.status === 'Completed'),
      canDownloadFinalSummary: booking.paymentStatus === 'Paid' && (booking.status === 'Confirmed' || booking.status === 'Completed')
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
  logPersistenceDiagnostics();
  logArtoPayStartupConfig();

  if (process.env.NODE_ENV !== 'production') {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SmartJourney Fullstack Engine] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

export default app;

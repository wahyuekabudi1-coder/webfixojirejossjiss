// ==============================================================================
// SMART JOURNEY IDEMPOTENT MIGRATION SCRIPT
// Migrates data from data/db.json into SQL tables once, establishing SQL as Single Source of Truth
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { getDB } from './pool';
import { toursRepo } from './repositories/tours.repository';
import { shareToursRepo } from './repositories/shareTours.repository';
import { bookingsRepo } from './repositories/bookings.repository';
import { draftsRepo } from './repositories/drafts.repository';
import { transportRepo } from './repositories/transport.repository';
import { serviceLimitsRepo } from './repositories/serviceLimits.repository';
import { schedulesRepo } from './repositories/schedules.repository';
import { reviewsRepo } from './repositories/reviews.repository';
import { paymentsRepo } from './repositories/payments.repository';
import { invoicesRepo } from './repositories/invoices.repository';

export async function runMigrationIfNeeded(): Promise<void> {
  const client = await getDB();

  // 1. Check if migration has already been executed
  const metaRows = await client.query<{ meta_value: string }>(
    "SELECT meta_value FROM system_meta WHERE meta_key = 'db_json_migrated' LIMIT 1"
  );

  if (metaRows && metaRows.length > 0 && metaRows[0].meta_value === '1') {
    console.log('[Migration] Database already migrated. SQL is Authoritative Single Source of Truth.');
    return;
  }

  const dbJsonPath = path.resolve(process.cwd(), 'data', 'db.json');
  if (!fs.existsSync(dbJsonPath)) {
    console.log('[Migration] No legacy data/db.json found. Initializing empty database.');
    await client.execute(
      "INSERT INTO system_meta (meta_key, meta_value, updated_at) VALUES ('db_json_migrated', '1', ?)",
      [new Date().toISOString()]
    );
    return;
  }

  console.log(`[Migration] Starting idempotent migration from ${dbJsonPath}...`);
  try {
    const raw = fs.readFileSync(dbJsonPath, 'utf8');
    const legacyDB = JSON.parse(raw);

    // A. Migrate Main Tours (Private Tours)
    if (Array.isArray(legacyDB.mainTours)) {
      console.log(`[Migration] Migrating ${legacyDB.mainTours.length} main tours...`);
      for (const t of legacyDB.mainTours) {
        if (!t.id) continue;
        const exists = await toursRepo.getById(t.id);
        if (!exists) {
          await toursRepo.create({
            id: t.id,
            name: t.name,
            description: t.description,
            category: t.category,
            days: t.days,
            nights: t.nights,
            duration: t.duration,
            startingPrice: t.startingPrice || t.wnaPrice,
            startingPriceIDR: t.startingPriceIDR || t.wniPrice,
            wniPrice: t.wniPrice || t.startingPriceIDR,
            wnaPrice: t.wnaPrice || t.startingPrice,
            rating: t.rating,
            reviewCount: t.reviewCount,
            image: t.image,
            highlights: t.highlights,
            itinerary: t.itinerary,
            includes: t.includes,
            excludes: t.excludes,
            whatToBring: t.whatToBring,
            status: t.status || 'published',
            createdAt: t.createdAt || new Date().toISOString()
          });
        }
      }
    }

    // B. Migrate Share Tours (Open Trips)
    if (Array.isArray(legacyDB.trips)) {
      console.log(`[Migration] Migrating ${legacyDB.trips.length} share tours...`);
      for (const trip of legacyDB.trips) {
        if (!trip.id) continue;
        const exists = await shareToursRepo.getTripById(trip.id);
        if (!exists) {
          await shareToursRepo.createTrip(trip);
        }
      }
    }

    // C. Migrate Batches
    if (Array.isArray(legacyDB.batches)) {
      console.log(`[Migration] Migrating ${legacyDB.batches.length} batches...`);
      for (const batch of legacyDB.batches) {
        if (!batch.id) continue;
        const exists = await shareToursRepo.getBatchById(batch.id);
        if (!exists) {
          await shareToursRepo.createBatch(batch);
        }
      }
    }

    // D. Migrate Bookings
    if (Array.isArray(legacyDB.bookings)) {
      console.log(`[Migration] Migrating ${legacyDB.bookings.length} bookings...`);
      for (const b of legacyDB.bookings) {
        if (!b.id) continue;
        const exists = await bookingsRepo.getById(b.id);
        if (!exists) {
          await bookingsRepo.create(b);
        }
      }
    }

    // E. Migrate Admin Drafts
    if (legacyDB.adminDrafts && typeof legacyDB.adminDrafts === 'object') {
      console.log('[Migration] Migrating admin drafts...');
      for (const [k, v] of Object.entries(legacyDB.adminDrafts)) {
        await draftsRepo.save(k, v);
      }
    }

    // F. Migrate Transport Data
    if (legacyDB.rentals) {
      await transportRepo.saveCategoryData('rentals', legacyDB.rentals);
    }
    if (legacyDB.airportTransfers) {
      await transportRepo.saveCategoryData('airportTransfers', legacyDB.airportTransfers);
    }
    if (legacyDB.taxiServices) {
      await transportRepo.saveCategoryData('taxiServices', legacyDB.taxiServices);
    }

    // G. Migrate Service Limits
    if (legacyDB.serviceLimits) {
      for (const [svc, lim] of Object.entries(legacyDB.serviceLimits)) {
        await serviceLimitsRepo.setLimit(svc, Number(lim));
      }
    }

    // H. Migrate Schedules
    if (Array.isArray(legacyDB.schedules)) {
      console.log(`[Migration] Migrating ${legacyDB.schedules.length} schedules...`);
      for (const sch of legacyDB.schedules) {
        if (!sch.id) continue;
        await schedulesRepo.save(sch);
      }
    }

    // I. Migrate Reviews
    if (Array.isArray(legacyDB.reviews)) {
      console.log(`[Migration] Migrating ${legacyDB.reviews.length} reviews...`);
      for (const rev of legacyDB.reviews) {
        if (!rev.id) continue;
        await reviewsRepo.create(rev);
      }
    }

    // J. Migrate Payments
    if (Array.isArray(legacyDB.payments)) {
      console.log(`[Migration] Migrating ${legacyDB.payments.length} payments...`);
      for (const p of legacyDB.payments) {
        if (!p.id && !p.orderId) continue;
        await paymentsRepo.createPaymentRecord(p);
      }
    }

    // K. Migrate Invoices
    if (Array.isArray(legacyDB.invoices)) {
      console.log(`[Migration] Migrating ${legacyDB.invoices.length} invoices...`);
      for (const inv of legacyDB.invoices) {
        if (!inv.id && !inv.invoiceNumber) continue;
        await invoicesRepo.createInvoice(inv);
      }
    }

    // Record migration success in system_meta
    await client.execute(
      "INSERT INTO system_meta (meta_key, meta_value, updated_at) VALUES ('db_json_migrated', '1', ?)",
      [new Date().toISOString()]
    );

    console.log('[Migration] ✅ Migration completed successfully! Database is now the single source of truth.');
  } catch (err: any) {
    console.error('[Migration Error] Failed during data/db.json migration:', err);
    throw err;
  }
}

// ==============================================================================
// SMART JOURNEY OPERATIONAL ASSIGNMENTS REPOSITORY
// Pure Relational SQL implementation (MySQL / SQLite)
// ==============================================================================
import { DatabaseClient } from '../types';
import { getDB } from '../pool';
import { transportRepo } from './transport.repository';

export interface OperationalAssignment {
  bookingId: string;
  bookingCode: string;
  vehicleName: string;
  plateNumber: string;
  driverName: string;
  driverPhone: string;
  guideName?: string;
  guidePhone?: string;
  status: 'Assigned' | 'Ready' | 'On Trip' | 'Completed';
  note?: string;
  assignedAt: string;
  updatedAt?: string;
}

export interface FleetItem {
  id: string;
  name: string;
  plateNumber: string;
  capacity: number;
}

export interface DriverItem {
  id: string;
  name: string;
  phone: string;
  license?: string;
  rating?: number;
}

export interface GuideItem {
  id: string;
  name: string;
  phone: string;
  languages?: string;
}

// Company licensed master resources (authoritative defaults seeded to SQL)
export const DEFAULT_FLEET: FleetItem[] = [
  { id: 'f-hiace-premio', name: 'Toyota HiAce Premio', plateNumber: 'N 7088 SJ', capacity: 11 },
  { id: 'f-hiace-commuter', name: 'Toyota HiAce Commuter', plateNumber: 'N 7192 SJ', capacity: 15 },
  { id: 'f-innova-reborn', name: 'Toyota Innova Reborn', plateNumber: 'N 1450 SJ', capacity: 7 },
  { id: 'f-avanza', name: 'Toyota Avanza', plateNumber: 'N 1823 SJ', capacity: 5 }
];

export const DEFAULT_DRIVERS: DriverItem[] = [
  { id: 'd-1', name: 'Bpk. Hendra Saputra', phone: '+62 812-3456-7890', license: 'B1 Umum', rating: 5.0 },
  { id: 'd-2', name: 'Bpk. Agus Santoso', phone: '+62 813-9876-5432', license: 'A Umum', rating: 4.9 },
  { id: 'd-3', name: 'Bpk. Tomi Wijaya', phone: '+62 852-1122-3344', license: 'B1 Umum', rating: 5.0 },
  { id: 'd-4', name: 'Bpk. Made Artawa', phone: '+62 821-4455-6677', license: 'A Umum', rating: 4.8 }
];

export const DEFAULT_GUIDES: GuideItem[] = [
  { id: 'g-1', name: 'Mas Dimas (HPI Certified)', phone: '+62 812-8899-0011', languages: 'ID, EN' },
  { id: 'g-2', name: 'Bli Wayan Budiana', phone: '+62 819-2233-4455', languages: 'ID, EN, ZH' },
  { id: 'g-3', name: 'Mbak Rina Oktaviani', phone: '+62 856-7788-9900', languages: 'ID, EN' }
];

export class AssignmentsRepository {
  private async db(): Promise<DatabaseClient> {
    return await getDB();
  }

  async getAll(): Promise<Record<string, OperationalAssignment>> {
    const client = await this.db();
    const rows = await client.query<{
      id: string;
      booking_id: string;
      booking_code: string;
      vehicle_name: string;
      plate_number: string;
      driver_name: string;
      driver_phone: string;
      guide_name: string;
      guide_phone: string;
      status: string;
      note: string;
      assigned_at: string;
      updated_at: string;
    }>('SELECT * FROM operational_assignments ORDER BY updated_at DESC');

    const result: Record<string, OperationalAssignment> = {};
    for (const r of rows) {
      const assignment: OperationalAssignment = {
        bookingId: r.booking_id,
        bookingCode: r.booking_code,
        vehicleName: r.vehicle_name,
        plateNumber: r.plate_number,
        driverName: r.driver_name,
        driverPhone: r.driver_phone,
        guideName: r.guide_name || undefined,
        guidePhone: r.guide_phone || undefined,
        status: (r.status as any) || 'Ready',
        note: r.note || '',
        assignedAt: r.assigned_at,
        updatedAt: r.updated_at
      };

      if (r.booking_code) {
        result[r.booking_code] = assignment;
      }
      if (r.booking_id) {
        result[r.booking_id] = assignment;
      }
    }
    return result;
  }

  async getByKey(key: string): Promise<OperationalAssignment | null> {
    const client = await this.db();
    const rows = await client.query<{
      id: string;
      booking_id: string;
      booking_code: string;
      vehicle_name: string;
      plate_number: string;
      driver_name: string;
      driver_phone: string;
      guide_name: string;
      guide_phone: string;
      status: string;
      note: string;
      assigned_at: string;
      updated_at: string;
    }>(
      'SELECT * FROM operational_assignments WHERE booking_code = ? OR booking_id = ? OR id = ? LIMIT 1',
      [key, key, key]
    );

    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      bookingId: r.booking_id,
      bookingCode: r.booking_code,
      vehicleName: r.vehicle_name,
      plateNumber: r.plate_number,
      driverName: r.driver_name,
      driverPhone: r.driver_phone,
      guideName: r.guide_name || undefined,
      guidePhone: r.guide_phone || undefined,
      status: (r.status as any) || 'Ready',
      note: r.note || '',
      assignedAt: r.assigned_at,
      updatedAt: r.updated_at
    };
  }

  async save(assignment: Partial<OperationalAssignment> & { bookingCode: string }): Promise<OperationalAssignment> {
    const client = await this.db();
    const code = (assignment.bookingCode || '').trim();
    const bookingId = (assignment.bookingId || code).trim();
    const now = new Date().toISOString();

    const existing = await client.query<{ id: string }>(
      'SELECT id FROM operational_assignments WHERE booking_code = ? OR booking_id = ? LIMIT 1',
      [code, bookingId]
    );

    const recordId = existing && existing.length > 0
      ? existing[0].id
      : `asg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const assignedAt = assignment.assignedAt || now;

    if (existing && existing.length > 0) {
      await client.execute(
        `UPDATE operational_assignments SET
          booking_id = ?,
          booking_code = ?,
          vehicle_name = ?,
          plate_number = ?,
          driver_name = ?,
          driver_phone = ?,
          guide_name = ?,
          guide_phone = ?,
          status = ?,
          note = ?,
          assigned_at = ?,
          updated_at = ?
         WHERE id = ?`,
        [
          bookingId,
          code,
          assignment.vehicleName || '',
          assignment.plateNumber || '',
          assignment.driverName || '',
          assignment.driverPhone || '',
          assignment.guideName || '',
          assignment.guidePhone || '',
          assignment.status || 'Ready',
          assignment.note || '',
          assignedAt,
          now,
          recordId
        ]
      );
    } else {
      await client.execute(
        `INSERT INTO operational_assignments (
          id, booking_id, booking_code, vehicle_name, plate_number,
          driver_name, driver_phone, guide_name, guide_phone,
          status, note, assigned_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId,
          bookingId,
          code,
          assignment.vehicleName || '',
          assignment.plateNumber || '',
          assignment.driverName || '',
          assignment.driverPhone || '',
          assignment.guideName || '',
          assignment.guidePhone || '',
          assignment.status || 'Ready',
          assignment.note || '',
          assignedAt,
          now
        ]
      );
    }

    return {
      bookingId,
      bookingCode: code,
      vehicleName: assignment.vehicleName || '',
      plateNumber: assignment.plateNumber || '',
      driverName: assignment.driverName || '',
      driverPhone: assignment.driverPhone || '',
      guideName: assignment.guideName,
      guidePhone: assignment.guidePhone,
      status: (assignment.status as any) || 'Ready',
      note: assignment.note || '',
      assignedAt,
      updatedAt: now
    };
  }

  async delete(key: string): Promise<boolean> {
    const client = await this.db();
    const cleanKey = (key || '').trim();
    const res = await client.execute(
      'DELETE FROM operational_assignments WHERE booking_code = ? OR booking_id = ? OR id = ?',
      [cleanKey, cleanKey, cleanKey]
    );
    return res.affectedRows > 0;
  }

  async getResources(): Promise<{ fleet: FleetItem[]; drivers: DriverItem[]; guides: GuideItem[] }> {
    const fleetData = await transportRepo.getCategoryData<FleetItem[]>('fleet' as any);
    const driversData = await transportRepo.getCategoryData<DriverItem[]>('drivers' as any);
    const guidesData = await transportRepo.getCategoryData<GuideItem[]>('guides' as any);

    const fleet = Array.isArray(fleetData) && fleetData.length > 0 ? fleetData : DEFAULT_FLEET;
    const drivers = Array.isArray(driversData) && driversData.length > 0 ? driversData : DEFAULT_DRIVERS;
    const guides = Array.isArray(guidesData) && guidesData.length > 0 ? guidesData : DEFAULT_GUIDES;

    // Seed to SQL transport_data if not yet present
    if (!fleetData) {
      await transportRepo.saveCategoryData('fleet' as any, DEFAULT_FLEET);
    }
    if (!driversData) {
      await transportRepo.saveCategoryData('drivers' as any, DEFAULT_DRIVERS);
    }
    if (!guidesData) {
      await transportRepo.saveCategoryData('guides' as any, DEFAULT_GUIDES);
    }

    return { fleet, drivers, guides };
  }

  async saveResources(resources: { fleet?: FleetItem[]; drivers?: DriverItem[]; guides?: GuideItem[] }): Promise<void> {
    if (resources.fleet && Array.isArray(resources.fleet)) {
      await transportRepo.saveCategoryData('fleet' as any, resources.fleet);
    }
    if (resources.drivers && Array.isArray(resources.drivers)) {
      await transportRepo.saveCategoryData('drivers' as any, resources.drivers);
    }
    if (resources.guides && Array.isArray(resources.guides)) {
      await transportRepo.saveCategoryData('guides' as any, resources.guides);
    }
  }
}

export const assignmentsRepo = new AssignmentsRepository();

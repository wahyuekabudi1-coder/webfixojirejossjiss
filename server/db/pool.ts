// ==============================================================================
// SMART JOURNEY UNIFIED DATABASE CONNECTION POOL & ACCESS LAYER
// Single Source of Truth for Production (Niagahoster MySQL 8.0) & Dev (sql.js)
// ==============================================================================

import '../env';
import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { DatabaseClient } from './types';
import { getDatabaseEnv } from '../env';

// Path for SQLite file fallback when running in dev/sandbox
const DATA_DIR = path.resolve(process.cwd(), 'data');
const SQLITE_FILE = path.join(DATA_DIR, 'smartjourney.sqlite');

function getDbConfig() {
  return getDatabaseEnv();
}

class MySqlDatabaseClient implements DatabaseClient {
  private pool: mysql.Pool;

  constructor(pool: mysql.Pool) {
    this.pool = pool;
  }

  isMySQL(): boolean {
    return true;
  }

  engineName(): string {
    return 'MySQL 8.0 (Niagahoster Production)';
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const [rows] = await this.pool.execute(sql, params);
    return rows as T[];
  }

  async execute(sql: string, params: any[] = []): Promise<{ affectedRows: number; insertId?: number | string }> {
    const [result] = await this.pool.execute(sql, params);
    const header = result as mysql.ResultSetHeader;
    return {
      affectedRows: header.affectedRows,
      insertId: header.insertId
    };
  }

  async transaction<T>(fn: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    try {
      const clientWrapper: DatabaseClient = {
        isMySQL: () => true,
        engineName: () => 'MySQL Transaction Connection',
        query: async <R = any>(sql: string, params: any[] = []): Promise<R[]> => {
          const [rows] = await connection.execute(sql, params);
          return rows as R[];
        },
        execute: async (sql: string, params: any[] = []): Promise<{ affectedRows: number; insertId?: number | string }> => {
          const [result] = await connection.execute(sql, params);
          const header = result as mysql.ResultSetHeader;
          return { affectedRows: header.affectedRows, insertId: header.insertId };
        },
        transaction: async <SubT>(subFn: (c: DatabaseClient) => Promise<SubT>): Promise<SubT> => {
          return await subFn(clientWrapper);
        },
        close: async () => {},
      };
      const result = await fn(clientWrapper);
      await connection.commit();
      return result;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

class SqlJsDatabaseClient implements DatabaseClient {
  private db: SqlJsDatabase;
  private filePath: string;
  private inTransaction = false;

  constructor(db: SqlJsDatabase, filePath: string) {
    this.db = db;
    this.filePath = filePath;
  }

  isMySQL(): boolean {
    return false;
  }

  engineName(): string {
    return 'SQLite 3 (Development Sandbox Engine)';
  }

  private persist() {
    if (this.inTransaction) return;
    try {
      if (!fs.existsSync(path.dirname(this.filePath))) {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      }
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.filePath, buffer);
    } catch (err) {
      console.error('[DB Error] Failed to persist SQLite data to disk:', err);
    }
  }

  async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    try {
      const stmt = this.db.prepare(sql);
      if (params && params.length > 0) {
        stmt.bind(params);
      }
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return rows;
    } catch (err: any) {
      console.error(`[DB Query Error] SQL: ${sql} | Params: ${JSON.stringify(params)} | Error:`, err);
      throw err;
    }
  }

  async execute(sql: string, params: any[] = []): Promise<{ affectedRows: number; insertId?: number | string }> {
    try {
      if (!params || params.length === 0) {
        this.db.run(sql);
      } else {
        const stmt = this.db.prepare(sql);
        stmt.run(params);
        stmt.free();
      }
      const affectedRows = this.db.getRowsModified();
      this.persist();
      return { affectedRows };
    } catch (err: any) {
      console.error(`[DB Execute Error] SQL: ${sql} | Params: ${JSON.stringify(params)} | Error:`, err);
      throw err;
    }
  }

  async transaction<T>(fn: (client: DatabaseClient) => Promise<T>): Promise<T> {
    this.inTransaction = true;
    this.db.run('BEGIN TRANSACTION;');
    try {
      const res = await fn(this);
      this.db.run('COMMIT;');
      this.inTransaction = false;
      this.persist();
      return res;
    } catch (err) {
      this.db.run('ROLLBACK;');
      this.inTransaction = false;
      throw err;
    }
  }

  async close(): Promise<void> {
    this.persist();
    this.db.close();
  }
}

let dbInstance: DatabaseClient | null = null;
let initPromise: Promise<DatabaseClient> | null = null;

export async function getDB(): Promise<DatabaseClient> {
  if (dbInstance) {
    return dbInstance;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const config = getDbConfig();

    // 1. In Production, MySQL is MANDATORY. Fail-closed on failure without fallback.
    if (config.isProduction) {
      if (!config.host || !config.database || !config.user) {
        const errorMsg = '[DB Fatal Production] Missing mandatory MySQL credentials (DB_HOST, DB_NAME, DB_USER). In production (NODE_ENV=production), MySQL is required as Single Source of Truth.';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      try {
        console.log(`[DB Production] Connecting to MySQL at ${config.host}:${config.port} (DB: ${config.database})...`);
        const pool = mysql.createPool({
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          database: config.database,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000,
          multipleStatements: false,
          dateStrings: true
        });

        const conn = await pool.getConnection();
        await conn.ping();
        conn.release();

        console.log('[DB Production] ✅ Successfully connected to MySQL Pool (Niagahoster Production Single Source of Truth).');
        dbInstance = new MySqlDatabaseClient(pool);
        await initSchema(dbInstance);
        return dbInstance;
      } catch (err: any) {
        console.error('[DB Fatal Production] ❌ Failed to connect to Production MySQL database:', err.message);
        throw new Error(`Production MySQL connection failure: ${err.message}. SQLite fallback is forbidden in production.`);
      }
    }

    // 2. Development Mode: Connect to MySQL if credentials provided, else use SQLite sandbox
    if (config.host && config.user && config.database) {
      try {
        console.log(`[DB Development] Connecting to MySQL at ${config.host}:${config.port} (DB: ${config.database})...`);
        const pool = mysql.createPool({
          host: config.host,
          port: config.port,
          user: config.user,
          password: config.password,
          database: config.database,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000,
          multipleStatements: false,
          dateStrings: true
        });

        const conn = await pool.getConnection();
        await conn.ping();
        conn.release();

        console.log('[DB Development] ✅ Successfully connected to MySQL Pool.');
        dbInstance = new MySqlDatabaseClient(pool);
        await initSchema(dbInstance);
        return dbInstance;
      } catch (err: any) {
        console.error('[DB Development] ⚠️ Could not connect to configured MySQL host:', err.message);
        console.log('[DB Development] Switching to SQLite development engine...');
      }
    } else {
      console.log('[DB Development] Notice: DB_HOST not specified in environment. Using SQLite Development Engine.');
    }

    // 3. Initialize SQL.js Engine for local development
    try {
      const SQL = await initSqlJs();
      let db: SqlJsDatabase;

      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(SQLITE_FILE)) {
        const filebuffer = fs.readFileSync(SQLITE_FILE);
        db = new SQL.Database(filebuffer);
        console.log(`[DB] ✅ Loaded existing database from ${SQLITE_FILE}`);
      } else {
        db = new SQL.Database();
        console.log(`[DB] ✅ Initialized new SQLite database in memory, will persist to ${SQLITE_FILE}`);
      }

      dbInstance = new SqlJsDatabaseClient(db, SQLITE_FILE);
      await initSchema(dbInstance);
      return dbInstance;
    } catch (err: any) {
      console.error('[DB Fatal] Failed to initialize Database Access Layer:', err);
      throw err;
    }
  })();

  return initPromise;
}

export interface IndexDefinition {
  name: string;
  table: string;
  columns: string[];
}

export const REQUIRED_INDEXES: IndexDefinition[] = [
  { name: 'idx_tours_status', table: 'tours', columns: ['status'] },
  { name: 'idx_tours_deleted', table: 'tours', columns: ['is_deleted'] },
  { name: 'idx_share_tours_slug', table: 'share_tours', columns: ['slug'] },
  { name: 'idx_share_tours_status', table: 'share_tours', columns: ['status'] },
  { name: 'idx_batches_trip', table: 'batches', columns: ['trip_id'] },
  { name: 'idx_batches_date', table: 'batches', columns: ['departure_date'] },
  { name: 'idx_bookings_code', table: 'bookings', columns: ['booking_code'] },
  { name: 'idx_bookings_intent', table: 'bookings', columns: ['payment_intent_id'] },
  { name: 'idx_bookings_status', table: 'bookings', columns: ['status'] },
  { name: 'idx_bookings_payment_status', table: 'bookings', columns: ['payment_status'] },
  { name: 'idx_bookings_email', table: 'bookings', columns: ['email'] },
  { name: 'idx_payments_order', table: 'payments', columns: ['order_id'] },
  { name: 'idx_payments_booking', table: 'payments', columns: ['booking_id'] },
  { name: 'idx_invoices_number', table: 'invoices', columns: ['invoice_number'] },
  { name: 'idx_reviews_status', table: 'reviews', columns: ['status'] }
];

export const REQUIRED_TABLES = [
  'tours',
  'share_tours',
  'batches',
  'bookings',
  'payments',
  'invoices',
  'admin_sessions',
  'admin_drafts',
  'schedules',
  'reviews',
  'service_limits',
  'transport_data',
  'system_meta'
];

export async function initSchema(client: DatabaseClient): Promise<void> {
  const schemaPath = path.resolve(process.cwd(), 'server', 'db', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`[DB Schema Fatal] Schema file not found at ${schemaPath}`);
  }
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  // Clean comments and split by semicolon
  const cleanSql = schemaSql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    try {
      await client.execute(stmt);
    } catch (err: any) {
      if (!err.message?.includes('already exists') && !err.message?.includes('duplicate')) {
        console.error(`[DB Schema Error] DDL statement failed: ${stmt.slice(0, 80)}... Error: ${err.message}`);
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Database table creation failed in production: ${err.message}`);
        }
      }
    }
  }

  const isMySQL = client.isMySQL();

  // Automatic column migration for existing tables that may lack recently added columns
  const columnMigrations = [
    { table: 'bookings', column: 'verification_hash', type: 'TEXT' },
    { table: 'bookings', column: 'confirmed_at', type: 'VARCHAR(64)' },
    { table: 'bookings', column: 'reject_reason', type: 'TEXT' },
    { table: 'bookings', column: 'paid_at', type: 'VARCHAR(64)' },
    { table: 'bookings', column: 'payment_id', type: 'VARCHAR(128)' },
    { table: 'bookings', column: 'payment_intent_id', type: 'VARCHAR(128)' },
    { table: 'bookings', column: 'checkout_url', type: 'TEXT' },
    { table: 'bookings', column: 'payment_status', type: "VARCHAR(64) DEFAULT 'Pending'" },
    { table: 'bookings', column: 'status', type: "VARCHAR(64) DEFAULT 'Pending Payment'" },
    { table: 'payments', column: 'payment_status', type: "VARCHAR(32) DEFAULT 'Pending'" },
    { table: 'payments', column: 'order_id', type: 'VARCHAR(64)' }
  ];

  for (const col of columnMigrations) {
    try {
      let colExists = false;
      if (isMySQL) {
        const rows = await client.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
          [col.table, col.column]
        );
        colExists = rows.length > 0;
      } else {
        const rows = await client.query(`PRAGMA table_info(\`${col.table}\`)`);
        colExists = rows.some((r: any) => r.name === col.column);
      }

      if (!colExists) {
        await client.execute(`ALTER TABLE \`${col.table}\` ADD COLUMN \`${col.column}\` ${col.type}`);
        console.log(`[DB Migration] Added missing column ${col.table}.${col.column}`);
      }
    } catch (migErr: any) {
      console.warn(`[DB Migration Warning] Column migration notice for ${col.table}.${col.column}:`, migErr.message);
    }
  }

  // Ensure and verify all required indexes
  for (const idx of REQUIRED_INDEXES) {
    try {
      if (isMySQL) {
        // Query INFORMATION_SCHEMA.STATISTICS to prevent duplicate index error
        const existing = await client.query<{ INDEX_NAME: string }>(
          `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
          [idx.table, idx.name]
        );
        if (!existing || existing.length === 0) {
          const cols = idx.columns.map(c => `\`${c}\``).join(', ');
          await client.execute(`CREATE INDEX \`${idx.name}\` ON \`${idx.table}\` (${cols})`);
          console.log(`[DB Schema MySQL] Created index ${idx.name} on ${idx.table}(${idx.columns.join(', ')})`);
        }
      } else {
        // SQLite supports CREATE INDEX IF NOT EXISTS
        const cols = idx.columns.join(', ');
        await client.execute(`CREATE INDEX IF NOT EXISTS \`${idx.name}\` ON \`${idx.table}\` (${cols})`);
      }
    } catch (err: any) {
      console.error(`[DB Index Error] Failed to create index ${idx.name} on ${idx.table}:`, err.message);
      throw new Error(`Critical index creation failed on ${idx.table} (${idx.name}): ${err.message}`);
    }
  }

  console.log(`[DB Schema] ✅ Database schema and indexes verified on ${client.engineName()}`);
}

export async function validateSchema(client: DatabaseClient): Promise<void> {
  const isMySQL = client.isMySQL();

  // 1. Verify all 13 required tables
  let existingTables: string[] = [];
  if (isMySQL) {
    const rows = await client.query<{ TABLE_NAME: string }>(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()`
    );
    existingTables = rows.map(r => r.TABLE_NAME.toLowerCase());
  } else {
    const rows = await client.query<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table'`
    );
    existingTables = rows.map(r => r.name.toLowerCase());
  }

  const missingTables = REQUIRED_TABLES.filter(t => !existingTables.includes(t.toLowerCase()));
  if (missingTables.length > 0) {
    const err = `[DB Validation Fatal] Missing required database tables: ${missingTables.join(', ')}`;
    console.error(err);
    throw new Error(err);
  }

  // 2. Verify key columns
  const checkColumn = async (table: string, column: string): Promise<boolean> => {
    if (isMySQL) {
      const rows = await client.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
        [table, column]
      );
      return rows.length > 0;
    } else {
      const rows = await client.query(`PRAGMA table_info(\`${table}\`)`);
      return rows.some((r: any) => r.name === column);
    }
  };

  const requiredColumns = [
    { table: 'bookings', column: 'verification_hash' },
    { table: 'bookings', column: 'confirmed_at' },
    { table: 'bookings', column: 'payment_status' },
    { table: 'bookings', column: 'status' },
    { table: 'payments', column: 'payment_status' },
    { table: 'payments', column: 'order_id' }
  ];

  for (const rc of requiredColumns) {
    const exists = await checkColumn(rc.table, rc.column);
    if (!exists) {
      const err = `[DB Validation Fatal] Missing required column: ${rc.table}.${rc.column}`;
      console.error(err);
      throw new Error(err);
    }
  }

  // 3. Verify indexes on key tables
  for (const idx of REQUIRED_INDEXES) {
    let indexExists = false;
    if (isMySQL) {
      const rows = await client.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
        [idx.table, idx.name]
      );
      indexExists = rows.length > 0;
    } else {
      const rows = await client.query(
        `SELECT 1 FROM sqlite_master WHERE type='index' AND name = ? LIMIT 1`,
        [idx.name]
      );
      indexExists = rows.length > 0;
    }

    if (!indexExists) {
      const msg = `[DB Validation Fatal] Required index missing: ${idx.name} on ${idx.table}`;
      console.error(msg);
      throw new Error(msg);
    }
  }

  console.log(`[DB Validation] ✅ All 13 tables, required columns, and indexes verified successfully.`);
}

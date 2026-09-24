// ==============================================================================
// SMART JOURNEY UNIFIED DATABASE CONNECTION POOL & ACCESS LAYER
// Single Source of Truth for Production (Niagahoster MySQL 8.0) & Dev (sql.js)
// ==============================================================================

import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { DatabaseClient } from './types';

const DB_HOST = process.env.DB_HOST || '';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_NAME = process.env.DB_NAME || '';
const DB_USER = process.env.DB_USER || '';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

// Path for SQLite file fallback when running in dev/sandbox
const DATA_DIR = path.resolve(process.cwd(), 'data');
const SQLITE_FILE = path.join(DATA_DIR, 'smartjourney.sqlite');

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
    // 1. Try MySQL if DB_HOST is provided
    if (DB_HOST && DB_USER && DB_NAME) {
      try {
        console.log(`[DB] Connecting to MySQL at ${DB_HOST}:${DB_PORT} (DB: ${DB_NAME})...`);
        const pool = mysql.createPool({
          host: DB_HOST,
          port: DB_PORT,
          user: DB_USER,
          password: DB_PASSWORD,
          database: DB_NAME,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000,
          multipleStatements: false,
          dateStrings: true
        });

        // Test connection
        const conn = await pool.getConnection();
        await conn.ping();
        conn.release();

        console.log('[DB] ✅ Successfully connected to MySQL Pool (Niagahoster Production).');
        dbInstance = new MySqlDatabaseClient(pool);
        await initSchema(dbInstance);
        return dbInstance;
      } catch (err: any) {
        console.error('[DB] ⚠️ Could not connect to configured MySQL host:', err.message);
        console.log('[DB] Switching to SQLite development engine...');
      }
    } else {
      console.log('[DB] Notice: DB_HOST not specified in environment. Using SQLite Development Engine.');
    }

    // 2. Initialize SQL.js Engine
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

export async function initSchema(client: DatabaseClient): Promise<void> {
  const schemaPath = path.resolve(process.cwd(), 'server', 'db', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.warn(`[DB Schema] Schema file not found at ${schemaPath}, skipping DDL run.`);
    return;
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
        console.warn(`[DB Schema Warning] DDL statement failed: ${stmt.slice(0, 50)}... Error: ${err.message}`);
      }
    }
  }
  console.log(`[DB Schema] ✅ Database schema verified and initialized on ${client.engineName()}`);
}

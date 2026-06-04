/**
 * sql.js wrapper for read-only access to Dayflow's chunks.sqlite.
 *
 * The Database object stays in memory for the duration of a sync run.
 *
 * IMPORTANT: sql.js tries to `fetch()` its WASM by default, which fails in
 * Electron renderer context with "both async and sync fetching of the wasm
 * failed." We work around this by importing the WASM at build time via
 * esbuild's `binary` loader — it bakes the ~644 KB blob directly into
 * main.js as a Uint8Array. We pass that via `wasmBinary` so sql.js never
 * tries to fetch.
 *
 * Bundling the WASM into main.js (instead of shipping it as a separate
 * release asset) is also required for Obsidian's community plugin store —
 * the installer only downloads main.js, manifest.json, and styles.css.
 */
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import wasmBytes from '../node_modules/sql.js/dist/sql-wasm.wasm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let sqlPromise: Promise<SqlJsStatic> | null = null;

export async function initSql(): Promise<SqlJsStatic> {
  if (sqlPromise) return sqlPromise;
  // wasmBytes is a Uint8Array view into the bundle. Copy into a fresh
  // ArrayBuffer to satisfy sql.js's wasmBinary type (which doesn't accept
  // SharedArrayBuffer-typed buffers).
  const wasmBinary = new ArrayBuffer(wasmBytes.byteLength);
  new Uint8Array(wasmBinary).set(wasmBytes);
  sqlPromise = initSqlJs({ wasmBinary });
  return sqlPromise;
}

export function defaultDbPath(): string {
  return path.join(
    os.homedir(),
    'Library/Application Support/Dayflow/chunks.sqlite'
  );
}

/**
 * Open the Dayflow DB read-only. Returns the in-memory sql.js Database and
 * the set of tables available so callers can degrade gracefully against
 * older Dayflow schemas.
 */
export async function openReadOnly(
  dbPath: string
): Promise<{ db: Database; tables: Set<string> }> {
  if (!fs.existsSync(dbPath)) {
    const err = new Error(`Dayflow database not found at ${dbPath}`);
    (err as Error & { code?: string }).code = 'DB_NOT_FOUND';
    throw err;
  }
  const SQL = await initSql();
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(new Uint8Array(buf));
  // Smoke test.
  db.exec('SELECT COUNT(*) FROM timeline_cards');
  const res = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
  const tables = new Set<string>();
  if (res.length > 0) {
    for (const row of res[0].values) tables.add(String(row[0]));
  }
  return { db, tables };
}

/**
 * Run a parameterized query and return rows as objects keyed by column name.
 *
 * sql.js exposes raw [cols, values[][]] — this helper packs each row into a
 * record so the rest of the code looks like the JS CLI version.
 */
export function queryAll<T>(
  db: Database,
  sql: string,
  params: (string | number | null)[] = []
): T[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as T);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

export function queryOne<T>(
  db: Database,
  sql: string,
  params: (string | number | null)[] = []
): T | null {
  const rows = queryAll<T>(db, sql, params);
  return rows.length > 0 ? rows[0] : null;
}

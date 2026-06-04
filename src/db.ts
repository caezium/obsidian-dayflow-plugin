/**
 * sql.js wrapper for read-only access to Dayflow's chunks.sqlite.
 *
 * We open the DB by reading the file from disk via Node's fs (Obsidian
 * plugins on desktop have full Node access). The Database object stays in
 * memory for the duration of a sync run.
 *
 * IMPORTANT: sql.js tries to `fetch()` its WASM by default, which fails in
 * Electron renderer context with "both async and sync fetching of the wasm
 * failed." We work around this by reading the WASM bytes ourselves from
 * the plugin folder and passing them via `wasmBinary` so sql.js never
 * tries to fetch.
 */
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let sqlPromise: Promise<SqlJsStatic> | null = null;

export async function initSql(pluginDir: string): Promise<SqlJsStatic> {
  if (sqlPromise) return sqlPromise;
  const wasmFile = path.join(pluginDir, 'sql-wasm.wasm');
  if (!fs.existsSync(wasmFile)) {
    throw new Error(
      `sql-wasm.wasm not found at ${wasmFile}. Reinstall the plugin or rebuild with \`npm run build\`.`
    );
  }
  const wasmBuffer = fs.readFileSync(wasmFile);
  // sql.js types expect ArrayBuffer; Node Buffer is a view over one. Slice out
  // the exact bytes so the type checker is happy and we pass a pure ArrayBuffer.
  const wasmBinary = wasmBuffer.buffer.slice(
    wasmBuffer.byteOffset,
    wasmBuffer.byteOffset + wasmBuffer.byteLength
  );
  // Pass wasmBinary directly — sql.js skips its internal fetch when this is set.
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
  pluginDir: string,
  dbPath: string
): Promise<{ db: Database; tables: Set<string> }> {
  if (!fs.existsSync(dbPath)) {
    const err = new Error(`Dayflow database not found at ${dbPath}`);
    (err as Error & { code?: string }).code = 'DB_NOT_FOUND';
    throw err;
  }
  const SQL = await initSql(pluginDir);
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

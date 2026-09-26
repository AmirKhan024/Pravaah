// One-off: applies supabase/schema.sql to the Supabase Postgres instance in DIRECT_URL.
// Usage: DIRECT_URL=... node scripts/apply-schema.mjs
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const url = process.env.DIRECT_URL;
if (!url) {
  console.error('DIRECT_URL is not set.');
  process.exit(1);
}
const sql = fs.readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8');

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log('schema applied OK');
  const tables = await client.query(`select table_name from information_schema.tables where table_schema='public' and table_name in ('rooms','participants','votes','ledger_entries') order by table_name`);
  console.log('tables present:', tables.rows.map((r) => r.table_name).join(', '));
} catch (e) {
  console.error('SCHEMA APPLY FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}

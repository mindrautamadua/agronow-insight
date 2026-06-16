/**
 * Migrasi MySQL (legacy `lppexternal_dbagronow`) → Supabase Postgres (agronow).
 *
 *   node scripts/mysql-to-supabase.mjs "postgresql://postgres:[PWD]@HOST:5432/postgres"
 *   # atau set SUPABASE_DB_URL di environment.
 *
 * - Sumber MySQL dibaca dari .env.local (read-only).
 * - Semua tabel disalin KECUALI log raksasa (lihat EXCLUDE).
 * - Kolom sensitif (password/token) ikut disalin apa adanya (sesuai permintaan).
 * - Tipe MySQL 5.7 dipetakan ke Postgres 17. Tanggal '0000-00-00' → NULL.
 * - Tidak membuat foreign key (DB legacy tidak punya FK eksplisit).
 */
import mysql from "mysql2/promise";
import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local") });

const EXCLUDE = new Set(["_content_hits", "_member_poin", "_member_device_token", "_user_activity"]);

const PG_URL = process.env.SUPABASE_DB_URL || process.argv[2];
if (!PG_URL) {
  console.error("✗ Berikan connection string Supabase: arg pertama atau env SUPABASE_DB_URL");
  process.exit(1);
}

// ── MySQL type → Postgres type ───────────────────────────────────────────────
function pgType(colType) {
  const t = colType.toLowerCase();
  const base = t.split("(")[0].trim();
  switch (base) {
    case "tinyint": case "smallint": return "smallint";
    case "mediumint": case "int": case "integer": return "integer";
    case "bigint": return "bigint";
    case "decimal": case "numeric": {
      const m = t.match(/\((\d+),(\d+)\)/);
      return m ? `numeric(${m[1]},${m[2]})` : "numeric";
    }
    case "float": return "real";
    case "double": case "double precision": return "double precision";
    case "date": return "date";
    case "datetime": case "timestamp": return "timestamp";
    case "year": return "integer";
    case "json": return "jsonb";
    case "bit": return "smallint";
    case "binary": case "varbinary": case "blob": case "tinyblob": case "mediumblob": case "longblob": return "bytea";
    default: return "text"; // char/varchar/text/enum/set/time/dll
  }
}

const isDate = ct => /^(date|datetime|timestamp)/i.test(ct);
const isJson = ct => /^json/i.test(ct);
const isBin = ct => /(binary|blob)/i.test(ct);

function convert(val, ct) {
  if (val === null || val === undefined) return null;
  if (isDate(ct)) {
    const s = String(val);
    return s.startsWith("0000") || s === "" ? null : s;
  }
  if (isJson(ct)) return typeof val === "string" ? val : JSON.stringify(val);
  if (isBin(ct)) return Buffer.isBuffer(val) ? val : Buffer.from(String(val));
  if (Buffer.isBuffer(val)) return val.toString("utf8");
  return val;
}

const qi = id => `"${id.replace(/"/g, '""')}"`; // quote identifier

async function main() {
  const my = await mysql.createConnection({
    host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE, dateStrings: true,
  });
  const db = (await my.query("SELECT DATABASE() d"))[0][0].d;
  const client = new pg.Client({ connectionString: PG_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`→ Sumber: ${db}  |  Target: Supabase Postgres`);

  const [tables] = await my.query(
    "SELECT TABLE_NAME n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME",
  );
  const todo = tables.map(r => r.n).filter(n => !EXCLUDE.has(n));
  console.log(`→ ${todo.length} tabel akan disalin (${EXCLUDE.size} log dikecualikan)\n`);

  let done = 0;
  for (const t of todo) {
    const [cols] = await my.query(
      "SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION", [t]);
    const [pks] = await my.query(
      "SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION", [t]);

    const colNames = cols.map(c => c.COLUMN_NAME);
    const colTypes = Object.fromEntries(cols.map(c => [c.COLUMN_NAME, c.COLUMN_TYPE]));
    const defs = cols.map(c => `${qi(c.COLUMN_NAME)} ${pgType(c.COLUMN_TYPE)}`);
    if (pks.length) defs.push(`PRIMARY KEY (${pks.map(p => qi(p.COLUMN_NAME)).join(", ")})`);

    await client.query(`DROP TABLE IF EXISTS ${qi(t)} CASCADE`);
    await client.query(`CREATE TABLE ${qi(t)} (${defs.join(", ")})`);

    const batchRows = Math.max(1, Math.floor(60000 / Math.max(1, colNames.length)));
    const colList = colNames.map(qi).join(", ");
    const insertSql = vals =>
      `INSERT INTO ${qi(t)} (${colList}) VALUES ${vals}`;

    let buf = [];
    let count = 0;
    async function flush() {
      if (!buf.length) return;
      const params = [];
      const tuples = buf.map(row => {
        const ph = colNames.map(cn => `$${params.push(convert(row[cn], colTypes[cn]))}`);
        return `(${ph.join(",")})`;
      });
      await client.query(insertSql(tuples.join(",")), params);
      count += buf.length;
      buf = [];
    }

    await new Promise((resolve, reject) => {
      const stream = my.connection.query(`SELECT * FROM \`${t}\``).stream();
      stream.on("error", reject);
      stream.on("data", row => {
        buf.push(row);
        if (buf.length >= batchRows) {
          stream.pause();
          flush().then(() => stream.resume()).catch(reject);
        }
      });
      stream.on("end", () => { flush().then(resolve).catch(reject); });
    });

    done++;
    console.log(`✓ [${done}/${todo.length}] ${t} — ${count.toLocaleString("id-ID")} baris`);
  }

  await my.end();
  await client.end();
  console.log(`\n✅ Selesai. ${done} tabel disalin ke Supabase agronow.`);
}

main().catch(err => { console.error("\n✗ Migrasi gagal:", err.message); process.exit(1); });

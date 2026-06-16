import { requireUser } from "@/lib/apiAuth";
import { query, queryOne } from "@/lib/db";
import { TABLE_DESCRIPTIONS } from "@/lib/tableDescriptions";
import { USED_TABLES } from "@/lib/usedTables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TableRow { TABLE_NAME: string; TABLE_COMMENT: string | null; TABLE_ROWS: number | null }
interface ColRow {
  TABLE_NAME: string; COLUMN_NAME: string; COLUMN_TYPE: string; IS_NULLABLE: string;
  COLUMN_KEY: string; EXTRA: string; COLUMN_COMMENT: string | null;
}
interface FkRow {
  CONSTRAINT_NAME: string; TABLE_NAME: string; COLUMN_NAME: string;
  REFERENCED_TABLE_NAME: string; REFERENCED_COLUMN_NAME: string; DELETE_RULE: string; UPDATE_RULE: string;
}

export async function GET() {
  const g = await requireUser();
  if ("response" in g) return g.response;

  try {
    const dbRow = await queryOne<{ db: string }>("SELECT current_database() AS db");
    const database = dbRow?.db ?? "";

    const tables = await query<TableRow>(
      `SELECT t.table_name AS "TABLE_NAME",
              NULL AS "TABLE_COMMENT",
              GREATEST(COALESCE(c.reltuples, 0), 0)::bigint AS "TABLE_ROWS"
         FROM information_schema.tables t
         LEFT JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = 'public'::regnamespace
        WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name`,
    );
    const columns = await query<ColRow>(
      `SELECT table_name AS "TABLE_NAME", column_name AS "COLUMN_NAME",
              data_type AS "COLUMN_TYPE", is_nullable AS "IS_NULLABLE",
              '' AS "COLUMN_KEY", '' AS "EXTRA", NULL AS "COLUMN_COMMENT"
         FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position`,
    );
    // Constraint PK/UNIQUE → tandai COLUMN_KEY.
    const cons = await query<{ TABLE_NAME: string; COLUMN_NAME: string; TYPE: string }>(
      `SELECT tc.table_name AS "TABLE_NAME", kcu.column_name AS "COLUMN_NAME", tc.constraint_type AS "TYPE"
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
        WHERE tc.table_schema = 'public' AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')`,
    );
    const pkSet = new Set<string>(), uqSet = new Set<string>();
    for (const c of cons) {
      const key = `${c.TABLE_NAME}.${c.COLUMN_NAME}`;
      if (c.TYPE === "PRIMARY KEY") pkSet.add(key); else uqSet.add(key);
    }
    for (const c of columns) {
      const key = `${c.TABLE_NAME}.${c.COLUMN_NAME}`;
      c.COLUMN_KEY = pkSet.has(key) ? "PRI" : uqSet.has(key) ? "UNI" : "";
    }
    // Foreign key nyata (Postgres).
    const fks = await query<FkRow>(
      `SELECT tc.constraint_name AS "CONSTRAINT_NAME", tc.table_name AS "TABLE_NAME",
              kcu.column_name AS "COLUMN_NAME", ccu.table_name AS "REFERENCED_TABLE_NAME",
              ccu.column_name AS "REFERENCED_COLUMN_NAME", rc.delete_rule AS "DELETE_RULE", rc.update_rule AS "UPDATE_RULE"
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
         JOIN information_schema.constraint_column_usage ccu
           ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
         JOIN information_schema.referential_constraints rc
           ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
        WHERE tc.table_schema = 'public' AND tc.constraint_type = 'FOREIGN KEY'`,
    );

    const tableNames = new Set(tables.map(t => t.TABLE_NAME));
    // Primary key per tabel (kolom PRI pertama).
    const pkByTable = new Map<string, string>();
    for (const c of columns) {
      if (c.COLUMN_KEY === "PRI" && !pkByTable.has(c.TABLE_NAME)) pkByTable.set(c.TABLE_NAME, c.COLUMN_NAME);
    }

    // Cocokkan nama "mentah" hasil strip id_/_id ke nama tabel nyata (DB ini ber-prefix "_").
    function resolveTarget(raw: string): string | null {
      const cands = [`_${raw}`, raw, `_${raw}s`, `${raw}s`, `_${raw}es`];
      for (const c of cands) if (tableNames.has(c)) return c;
      return null;
    }

    // Relasi nyata (FK eksplisit) — biasanya 0 di DB legacy ini.
    const realRels = fks.map(f => ({
      table: f.TABLE_NAME, column: f.COLUMN_NAME, refTable: f.REFERENCED_TABLE_NAME,
      refColumn: f.REFERENCED_COLUMN_NAME, onDelete: f.DELETE_RULE, inferred: false as const,
    }));
    const realSet = new Set(realRels.map(r => `${r.table}.${r.column}`));

    // Relasi DISIMPULKAN dari pola nama kolom: id_X / X_id → tabel _X.
    const inferredRels: { table: string; column: string; refTable: string; refColumn: string; onDelete: null; inferred: true }[] = [];
    const inferredSrc = new Map<string, { refTable: string; refColumn: string }>();
    for (const c of columns) {
      if (realSet.has(`${c.TABLE_NAME}.${c.COLUMN_NAME}`)) continue;
      if (c.COLUMN_KEY === "PRI") continue;
      const n = c.COLUMN_NAME.toLowerCase();
      let raw: string | null = null;
      if (n.startsWith("id_")) raw = n.slice(3);
      else if (n.endsWith("_id")) raw = n.slice(0, -3);
      if (!raw) continue;
      raw = raw.replace(/^_+|_+$/g, "");
      if (!raw || raw.length < 2) continue;
      const target = resolveTarget(raw);
      if (!target || target === c.TABLE_NAME) continue;
      const refColumn = pkByTable.get(target) ?? "id";
      inferredRels.push({ table: c.TABLE_NAME, column: c.COLUMN_NAME, refTable: target, refColumn, onDelete: null, inferred: true });
      inferredSrc.set(`${c.TABLE_NAME}.${c.COLUMN_NAME}`, { refTable: target, refColumn });
    }

    // Estimasi reltuples bisa 0 padahal ada isinya (tabel belum di-ANALYZE setelah
    // migrasi). Untuk flag "tabel kosong" yang akurat, hitung COUNT(*) persis pada
    // tabel berestimasi <= 0.
    const zeroNames = tables.filter(t => Number(t.TABLE_ROWS ?? 0) <= 0).map(t => t.TABLE_NAME);
    const exactPairs = await Promise.all(zeroNames.map(async name => {
      const r = await queryOne<{ n: number }>(`SELECT COUNT(*)::int AS n FROM "${name.replace(/"/g, '""')}"`);
      return [name, r?.n ?? 0] as const;
    }));
    const exact = new Map<string, number>(exactPairs);

    const tableData = tables.map(t => ({
      name: t.TABLE_NAME,
      comment: t.TABLE_COMMENT || null,
      description: TABLE_DESCRIPTIONS[t.TABLE_NAME] ?? (t.TABLE_COMMENT || null),
      used: USED_TABLES.has(t.TABLE_NAME),
      rows: exact.has(t.TABLE_NAME) ? exact.get(t.TABLE_NAME)! : Number(t.TABLE_ROWS ?? 0),
      columns: columns
        .filter(c => c.TABLE_NAME === t.TABLE_NAME)
        .map(c => {
          const key = `${c.TABLE_NAME}.${c.COLUMN_NAME}`;
          const real = fks.find(f => f.TABLE_NAME === c.TABLE_NAME && f.COLUMN_NAME === c.COLUMN_NAME);
          const inf = inferredSrc.get(key);
          return {
            name: c.COLUMN_NAME,
            type: c.COLUMN_TYPE,
            nullable: c.IS_NULLABLE === "YES",
            isPk: c.COLUMN_KEY === "PRI",
            isUnique: c.COLUMN_KEY === "UNI",
            isFk: !!real,
            inferredFk: !!inf && !real,
            refTable: real?.REFERENCED_TABLE_NAME ?? inf?.refTable ?? null,
            refColumn: real?.REFERENCED_COLUMN_NAME ?? inf?.refColumn ?? null,
            comment: c.COLUMN_COMMENT || null,
          };
        }),
    }));

    return Response.json({
      database,
      hasRealForeignKeys: realRels.length > 0,
      tables: tableData,
      relationships: [...realRels, ...inferredRels],
    });
  } catch (err) {
    console.error("schema introspect error", err);
    return Response.json({ error: "Gagal membaca skema database." }, { status: 500 });
  }
}

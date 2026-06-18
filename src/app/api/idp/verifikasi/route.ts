import { requireAdmin } from "@/lib/apiAuth";
import { scopeWhere } from "@/lib/scope";
import { query, queryOne, execute } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verifikasi IDP (khusus Administrator/verifikator) — daftar IDP yang diajukan
 * peserta + tindakan setujui/tolak. Memperbarui `_idp`: status_idp →
 * 'approved'/'rejected', status_verifikasi, catatan_verifikasi, keterangan_reject,
 * id_verifikator (member id verifikator bila tertaut NIP), tgl_verifikasi.
 *
 * "Perlu diverifikasi" = status_idp IN ('submitted','pending').
 */
const PENDING = ["submitted", "pending"];

interface VerifRow extends RowDataPacket {
  id: number; member_id: string | null; tahun: number | null;
  area_pengembangan: string | null; aspirasi_pengembangan: string | null;
  rencana: string | null; deskripsi_pengembangan: string | null;
  lokasi: string | null; tgl_pelaksanaan: string | null; jam_mulai: string | null; jam_selesai: string | null;
  url_dokumentasi: string | null; summary: string | null;
  status_idp: string | null; keterangan_reject: string | null;
  status_verifikasi: string | null; catatan_verifikasi: string | null;
  id_verifikator: number | null; tgl_verifikasi: string | null;
  created_at: string | null; updated_at: string | null;
  nama: string | null; nip: string | null; jabatan: string | null; unit: string | null;
  entitas: string | null; level: string | null;
}

const nn = (v: string | null) => (v && v.trim() && v.trim().toLowerCase() !== "null" ? v.trim() : null);
const d10 = (v: string | null): string | null => (v ? String(v).slice(0, 10) : null);

function toEntry(r: VerifRow) {
  return {
    id: Number(r.id),
    member: {
      id: r.member_id != null ? Number(r.member_id) : null,
      nip: nn(r.nip), nama: nn(r.nama) ?? `Member #${r.member_id ?? "?"}`,
      jabatan: nn(r.jabatan), unit: nn(r.unit), entitas: nn(r.entitas), level: nn(r.level),
    },
    tahun: r.tahun != null ? Number(r.tahun) : null,
    areaPengembangan: nn(r.area_pengembangan),
    aspirasiPengembangan: nn(r.aspirasi_pengembangan),
    rencana: nn(r.rencana),
    deskripsiPengembangan: nn(r.deskripsi_pengembangan),
    lokasi: nn(r.lokasi),
    tglPelaksanaan: d10(r.tgl_pelaksanaan),
    jamMulai: r.jam_mulai ? String(r.jam_mulai).slice(0, 5) : null,
    jamSelesai: r.jam_selesai ? String(r.jam_selesai).slice(0, 5) : null,
    urlDokumentasi: nn(r.url_dokumentasi),
    summary: nn(r.summary),
    statusIdp: nn(r.status_idp) ?? "draft",
    keteranganReject: nn(r.keterangan_reject),
    statusVerifikasi: nn(r.status_verifikasi),
    catatanVerifikasi: nn(r.catatan_verifikasi),
    idVerifikator: r.id_verifikator != null ? Number(r.id_verifikator) : null,
    tglVerifikasi: r.tgl_verifikasi ?? null,
    createdAt: r.created_at ?? null,
    updatedAt: r.updated_at ?? null,
  };
}

// GET ?status=pending|all — daftar IDP untuk diverifikasi.
export async function GET(request: Request) {
  const g = await requireAdmin();
  if ("response" in g) return g.response;

  const status = (new URL(request.url).searchParams.get("status") ?? "pending").toLowerCase();
  const onlyPending = status !== "all";

  try {
    const sc = scopeWhere(g.user, "g.group_name");
    const conds: string[] = [];
    if (onlyPending) conds.push("LOWER(COALESCE(i.status_idp, '')) IN ('submitted','pending')");
    if (sc.sql) conds.push(sc.sql);
    const whereSql = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const rows = await query<VerifRow>(
      `SELECT i.*,
              m.member_name AS nama, m.member_nip AS nip, m.member_jabatan AS jabatan,
              m.member_unit_kerja AS unit, g.group_name AS entitas, lk.nama AS level
         FROM _idp i
         LEFT JOIN _member m ON m.member_id::text = i.member_id
         LEFT JOIN _group g ON g.group_id = m.group_id
         LEFT JOIN _member_level_karyawan lk ON lk.id = m.id_level_karyawan
        ${whereSql}
        ORDER BY (LOWER(COALESCE(i.status_idp, '')) IN ('submitted','pending')) DESC,
                 i.updated_at DESC NULLS LAST, i.id DESC`,
      sc.params,
    );
    const pendingCount = rows.filter(r => PENDING.includes((r.status_idp ?? "").toLowerCase())).length;
    return Response.json({ entries: rows.map(toEntry), pendingCount });
  } catch (err) {
    console.error("idp verifikasi GET error", err);
    return Response.json({ error: "Gagal memuat verifikasi IDP." }, { status: 500 });
  }
}

// id_verifikator = member id verifikator (bila username tertaut NIP), else app user id.
async function verifikatorId(username: string, userId: string): Promise<number> {
  const m = await queryOne<RowDataPacket & { member_id: number }>(
    `SELECT member_id FROM _member WHERE member_nip = ? ORDER BY (member_status = 'active') DESC LIMIT 1`,
    [username],
  );
  return m ? Number(m.member_id) : Number(userId) || 0;
}

// POST — setujui/tolak IDP. Body: { id, action: 'approve'|'reject', catatan? }
export async function POST(request: Request) {
  const g = await requireAdmin();
  if ("response" in g) return g.response;

  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return Response.json({ error: "Body tidak valid." }, { status: 400 }); }

  const id = Number(b.id);
  const action = String(b.action ?? "").toLowerCase();
  const catatan = String(b.catatan ?? "").trim().slice(0, 2000) || null;
  if (!Number.isFinite(id)) return Response.json({ error: "ID tidak valid." }, { status: 400 });
  if (action !== "approve" && action !== "reject") return Response.json({ error: "Aksi tidak dikenal." }, { status: 400 });
  if (action === "reject" && !catatan) return Response.json({ error: "Catatan penolakan wajib diisi." }, { status: 400 });

  try {
    const row = await queryOne<RowDataPacket & { status_idp: string | null }>(
      `SELECT status_idp FROM _idp WHERE id = ?`, [id],
    );
    if (!row) return Response.json({ error: "IDP tidak ditemukan." }, { status: 404 });
    if (!PENDING.includes((row.status_idp ?? "").toLowerCase())) {
      return Response.json({ error: "IDP ini tidak dalam status diajukan." }, { status: 409 });
    }

    const verifId = await verifikatorId(g.user.username, g.user.id);
    if (action === "approve") {
      await execute(
        `UPDATE _idp SET status_idp = 'approved', status_verifikasi = 'disetujui',
           catatan_verifikasi = ?, keterangan_reject = NULL,
           id_verifikator = ?, tgl_verifikasi = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [catatan, verifId, id],
      );
    } else {
      await execute(
        `UPDATE _idp SET status_idp = 'rejected', status_verifikasi = 'ditolak',
           catatan_verifikasi = ?, keterangan_reject = ?,
           id_verifikator = ?, tgl_verifikasi = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [catatan, catatan, verifId, id],
      );
    }
    return Response.json({ ok: true, id, statusIdp: action === "approve" ? "approved" : "rejected" });
  } catch (err) {
    console.error("idp verifikasi POST error", err);
    return Response.json({ error: "Gagal memproses verifikasi." }, { status: 500 });
  }
}

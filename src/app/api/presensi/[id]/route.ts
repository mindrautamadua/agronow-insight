import { requireUser } from "@/lib/apiAuth";
import { scopeGroupIds } from "@/lib/scope";
import { query } from "@/lib/db";
import type { RowDataPacket } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Detail kehadiran satu kelas — peserta TERDAFTAR (`_classroom_member`) beserta
 * flag hadir/tidak (ada/tidaknya check-in `_classroom_attendance` stat='in').
 * `id` = cr_id kelas. Difilter cakupan (scope) seperti endpoint presensi utama.
 */
interface DetailRow extends RowDataPacket {
  id: number;
  nama: string | null;
  nip: string | null;
  jabatan: string | null;
  entitas: string | null;
  photo: string | null;
  hadir: boolean;
  channel: string | null;
  waktu: string | null;
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}
const clean = (v: string | null): string | null => {
  const t = decodeEntities(v ?? "").replace(/\s+/g, " ").trim();
  return t && t.toLowerCase() !== "null" ? t : null;
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const { id } = await params;
  const crId = Number(id);
  if (!Number.isInteger(crId) || crId <= 0) {
    return Response.json({ error: "ID kelas tidak valid." }, { status: 400 });
  }

  try {
    const allowedIds = await scopeGroupIds(g.user);
    // Filter cakupan pada peserta terdaftar (member.group_id ∈ scope).
    const scope = allowedIds ? " AND m.group_id = ANY(?)" : "";
    const A = allowedIds ? [crId, crId, allowedIds] : [crId, crId];

    const rows = await query<DetailRow>(
      `SELECT cm.member_id AS id,
              m.member_name AS nama, m.member_nip AS nip,
              COALESCE(NULLIF(TRIM(m.member_jabatan), ''), NULLIF(TRIM(m.member_kel_jabatan), '')) AS jabatan,
              gr.group_name AS entitas,
              ep.photo_url AS photo,
              (att.member_id IS NOT NULL) AS hadir,
              att.channel, att.waktu
         FROM _classroom_member cm
         LEFT JOIN _member m ON m.member_id = cm.member_id
         LEFT JOIN _group gr ON gr.group_id = m.group_id
         LEFT JOIN employee_photos ep ON ep.nip = m.member_nip
         LEFT JOIN (
           SELECT member_id, MIN(cra_channel) AS channel, MIN(cra_create_date) AS waktu
             FROM _classroom_attendance
            WHERE cr_id = ? AND stat = 'in'
            GROUP BY member_id
         ) att ON att.member_id = cm.member_id
        WHERE cm.cr_id = ?${scope}
        ORDER BY hadir DESC, m.member_name ASC`,
      A,
    );

    const peserta = rows.map(r => ({
      id: Number(r.id),
      nama: clean(r.nama) ?? `Member #${r.id}`,
      nip: clean(r.nip),
      jabatan: clean(r.jabatan),
      entitas: clean(r.entitas),
      photo: r.photo ?? null,
      hadir: !!r.hadir,
      channel: r.hadir ? clean(r.channel) : null,
      waktu: r.hadir ? r.waktu : null,
    }));

    const hadir = peserta.filter(p => p.hadir).length;
    return Response.json({ crId, total: peserta.length, hadir, peserta });
  } catch (err) {
    console.error("presensi detail GET error", err);
    return Response.json({ error: "Gagal memuat detail kehadiran." }, { status: 500 });
  }
}

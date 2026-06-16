/**
 * Daftar tabel yang DIPAKAI oleh fitur/menu aplikasi (di luar menu Skema Database).
 *
 * Diturunkan dari referensi SQL nyata pada route handler & data-access
 * (`src/app/api/**`, `src/lib/**` — klausa FROM/JOIN/UPDATE/INTO). Dipakai oleh
 * `/api/schema` untuk menandai tiap tabel dengan flag "dipakai" (centang hijau).
 *
 * Regenerasi bila menambah fitur baru:
 *   grep -rhoE '(FROM|JOIN|UPDATE|INTO) +["`]?[A-Za-z_]+' src/app/api src/lib \
 *     | sed -E 's/^(FROM|JOIN|UPDATE|INTO) +["`]?//' | grep -E '^(_|app_|employee_)' | sort -u
 *   (kecualikan information_schema/pg_* dan tabel TEMP seperti _keep)
 */
export const USED_TABLES: ReadonlySet<string> = new Set([
  // L&D realisasi & rekap
  "_rekap_classroom_excel",
  "_classroom",
  "_classroom_member",
  "_classroom_attendance",
  "_classroom_evaluasi_lv3_rekap",
  "_category",
  // Katalog & kategori
  "_learning_katalog",
  "_learning_kategori",
  // Peserta / master
  "_member",
  "_member_level_karyawan",
  "_group",
  "employee_photos",
  // Learning wallet (pengajuan eksternal)
  "_learning_wallet_pengajuan",
  "_learning_wallet_classroom",
  "_learning_wallet_penyelenggara",
  // Demand & Wishlist (menu /wishlist — direferensikan dinamis via config SOURCES)
  "_learning_wishlist_v2",
  "_learning_wallet_wishlist",
  // Serapan Anggaran (menu /serapan)
  "_learning_wallet_serapan",
  // Pengayaan menu yang sudah ada:
  "_classroom2_presensi",              // Kehadiran — mode online/offline (v2)
  "_classroom_evaluasi_lv3_pairing",   // Efektivitas — penilaian L3 oleh atasan
  "_project_assignment_detail",        // Project Assignment — deliverable & outcome
  "_member_bagian_divisi",             // Dashboard — dimensi JPL per divisi
  "_bagian_divisi",
  // Sync data (menu /sync — bookkeeping sinkronisasi)
  "sync_log",
  "sync_state",
  // Project assignment & evaluasi (NPS)
  "_project_assignment",
  "_nps_jawab",
  "_nps_set_soal",
  // Knowledge Management (konten pembelajaran & engagement)
  "_content",
  "_content_comment",
  "_content_download",
  "_content_tags",
  "_member_bookmark",
  "_media_download",
  // Auth aplikasi
  "app_users",
  "app_sessions",
]);

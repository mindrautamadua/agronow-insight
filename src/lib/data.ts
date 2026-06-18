/**
 * Client-side data layer — fetch ke Route Handlers (yang query MySQL).
 * Dipakai dari Client Components (mirip pola lama, tapi sumbernya REST internal,
 * bukan Supabase langsung).
 */

// ── Types ────────────────────────────────────────────────────────────────────
// Karyawan/peserta (sumber: `_member`). `departemen`=unit kerja, `lokasi`=kota.
export interface Employee {
  id: number; nip: string; nama: string; email: string | null;
  jabatan: string | null; departemen: string | null; lokasi: string | null;
  tanggal_masuk: string | null; status: "aktif" | "nonaktif";
  entitas?: string | null; level?: string | null; phone?: string | null; photo?: string | null;
}

export interface EmployeePage { employees: Employee[]; total: number; page: number; pages: number }
export interface EntitasNode {
  nama: string; total: number;
  subs: { nama: string; group: string; total: number }[];
}
export interface EmployeeSummary { total: number; aktif: number; nonaktif: number }

// Katalog Training — definisi program (sumber: tabel legacy `_learning_katalog`).
export interface Course {
  id: number; kode: string; judul: string; kategori: string | null; deskripsi: string | null;
  mode: string | null;                 // metode penyelenggaraan (offline/online/hybrid/blended)
  durasi_jam: number | null;           // jpl_total
  durasi_hari: number | null;          // durasi_hari
  biaya: number; status: "aktif" | "arsip";
}

export interface TrainingSession {
  id: number; course_id: number; judul: string | null;
  tanggal_mulai: string; tanggal_selesai: string | null; waktu: string | null;
  lokasi: string | null; instruktur: string | null; kuota: number | null;
  status: "terjadwal" | "berlangsung" | "selesai" | "batal";
  course_judul?: string; course_kode?: string; kategori?: string | null; terdaftar?: number;
}

export interface Enrollment {
  id: number; employee_id: number; course_id: number; session_id: number | null;
  status: "terdaftar" | "berlangsung" | "selesai" | "batal";
  progress: number; nilai: number | null; enrolled_at: string; completed_at: string | null; catatan: string | null;
  employee_nama?: string; employee_nip?: string; course_judul?: string; course_kode?: string;
  session_mulai?: string | null;
}

// Enrollment Class — kelas/batch pelaksanaan training (sumber: `_classroom`).
export interface EnrollmentClass {
  id: number; kode: string; judul: string; kategori: string | null;
  mode: string | null; tanggal_mulai: string | null; tanggal_selesai: string | null;
  peserta: number; status: "terjadwal" | "berlangsung" | "selesai";
}

// Peserta sebuah kelas (sumber: `_classroom_member` join `_member`).
export interface ClassMember {
  id: number; nama: string; nip: string | null; jabatan: string | null;
  unit_kerja: string | null; entitas: string | null; level: string | null;
  email: string | null; phone: string | null; verified: boolean; nilai: number | null; photo?: string | null;
}

// Sertifikat peserta (sumber: `_classroom_member.berkas_sertifikat` + `_classroom`/`_member`).
export interface Certification {
  id: number; nama: string; nip: string | null; sertifikat: string;
  kategori: string | null; entitas: string | null; tanggal: string | null;
  berkas: string | null; verified: boolean;
}

export interface CertificationPage { certifications: Certification[]; total: number; page: number; pages: number }

// Dashboard L&D — realisasi pelatihan & JPL (sumber: `_rekap_classroom_excel`).
export interface DashKpi {
  sesi: number; jpl: number; biaya: number; peserta: number;
}
export interface DashMonth { bln: number; jpl: number; sesi: number; biaya: number; peserta: number }
export interface DashBar { label: string; jpl: number }
// Subkelompok metode belajar (kerangka 70-20-10). `key`=metode_belajar70/20/10,
// `ideal`=porsi ideal (70/20/10), `jpl`/`sesi`=realisasi.
export interface DashSubkelompok { key: string; ideal: number; jpl: number; sesi: number }
export interface DashboardData {
  entitas: { id: number; nama: string } | null;
  entitasList: { id: number; nama: string }[];
  years: number[];
  year: number;
  kpi: DashKpi;
  monthly: DashMonth[];
  perLevel: DashBar[];
  perKategori: DashBar[];
  perSubkelompok: DashSubkelompok[];
  perDivisi: DashBar[];
}

// Capaian JPL per karyawan (sumber: `_rekap_classroom_excel`).
export interface JplEmployee {
  id: number; nama: string; nip: string | null;
  jabatan: string | null; unit: string | null; level: string | null;
  jpl: number; sesi: number; photo?: string | null;
}
export interface CapaianData { target: number; employees: JplEmployee[] }

// Pencarian JPL per karyawan by NIK/nama (sumber: `_rekap_classroom_excel`).
export interface JplSearchTraining {
  pelatihan: string; tglMulai: string | null; tglSelesai: string | null;
  year: number | null; penyelenggara: string; kategori: string | null; jpl: number;
}
export interface JplSearchEmployee {
  id: number; nama: string; nip: string | null;
  jabatan: string | null; unit: string | null; level: string | null; entitas: string | null;
  photo?: string | null; jpl: number; sesi: number;
  perYear: { year: number; jpl: number; sesi: number }[];
  trainings: JplSearchTraining[];
}
export interface JplSearchData { query: string; employees: JplSearchEmployee[] }

// Rincian biaya (sumber: `_rekap_classroom_excel`).
export interface BiayaBar { label: string; biaya: number }
export interface BiayaData {
  kpi: { totalBiaya: number; biayaPerJpl: number; biayaPerPeserta: number; sesiBerbiaya: number; sesiTanpaBiaya: number };
  perUnit: BiayaBar[];
  perPenyelenggara: BiayaBar[];
  perLevel: BiayaBar[];
  perKategori: BiayaBar[];
}

// Daftar Pelatihan (sumber: `_rekap_classroom_excel`).
export interface DaftarTraining {
  id: string; pelatihan: string; tglMulai: string | null; tglSelesai: string | null;
  penyelenggara: string; kategori: string | null; sub: string | null;
  jpl: number; peserta: number; biaya: number; flags: string[];
}
export interface DaftarPeserta {
  id: string; memberId: number; nama: string; nip: string | null; unit: string | null; level: string | null;
  pelatihan: string; tglMulai: string | null; tglSelesai: string | null;
  penyelenggara: string; kategori: string | null; sub: string | null; jpl: number; biaya: number;
  sesi?: number; photo?: string | null;
}
export interface DaftarData {
  trainings: DaftarTraining[]; peserta: DaftarPeserta[]; categories: string[];
}

// Learning Wallet — pengajuan & anggaran (sumber: `_learning_wallet_pengajuan`).
export interface WalletBar { label: string; n: number; nilai: number }
export interface WalletRow {
  id: number; nama: string; nip: string | null; entitas: string | null;
  pelatihan: string; penyelenggara: string | null; level: string | null;
  harga: number; status: string; tgl: string | null;
}
export interface WalletData {
  entitas: number; year: number;
  entitasList: { id: number; nama: string }[];
  years: number[];
  kpi: { total: number; nilai: number; disetujui: number; nilaiDisetujui: number; proses: number; ditolak: number };
  pipeline: WalletBar[];
  perEntitas: WalletBar[];
  perPenyelenggara: WalletBar[];
  perLevel: WalletBar[];
  list: WalletRow[];
}

// Evaluasi & Kepuasan (NPS) — sumber: `_nps_jawab` (skor 0–100).
export interface EvalBar { label: string; n: number; avg: number }
export interface EvaluasiData {
  jenis: string; tipe: string; year: number; years: number[];
  kpi: { avg: number; responden: number; pelatihan: number; narasumber: number };
  perDimensi: EvalBar[];
  internalEksternal: EvalBar[];
  pengajar: EvalBar[];
  pelatihan: EvalBar[];
}

// Project Assignment — penugasan proyek (learning 70%). Sumber: `_project_assignment`.
export interface PaBar { label: string; n: number }
export interface PaRow {
  id: number; nama: string; nip: string | null; jabatan: string | null; atasan: string | null;
  pelatihan: string; problem: string | null; target: string | null; uom: string | null;
  progress: number; status: string; tgl: string | null;
}
export interface PaData {
  status: string;
  kpi: { total: number; peserta: number; pelatihan: number; avgProgress: number; berjalan: number; selesai: number };
  byStatus: PaBar[];
  byProgress: PaBar[];
  perPelatihan: PaBar[];
  list: PaRow[];
  deliverable: {
    total: number; tuntas: number; pctTuntas: number; avgProgress: number; paCount: number;
    list: { program: string | null; deliverable: string | null; outcome: string | null; progress: number }[];
  };
}

// Efektivitas Pelatihan — Kirkpatrick L3 (sumber: `_classroom_evaluasi_lv3_rekap`).
export interface EfekPelatihan { label: string; n: number; pre: number; post: number; gain: number }
export interface EfektivitasData {
  entitas: number;
  entitasList: { id: number; nama: string }[];
  kpi: { pelatihan: number; peserta: number; pre: number; post: number; gain: number; pctNaik: number };
  perEntitas: { label: string; n: number; gain: number }[];
  perPelatihan: EfekPelatihan[];
  l3Atasan: { penilaian: number; kelas: number; dinilai: number; tuntas: number; pctTuntas: number; avgProgress: number };
}

// Demand / Wishlist Pelatihan (sumber: `_learning_wishlist_v2` / `_learning_wallet_wishlist`).
export interface WishlistData {
  source: string; year: number; years: number[];
  kpi: { total: number; pelatihan: number; peminat: number; prioritasTinggi: number };
  topPelatihan: { label: string; peminat: number; prioritas: number }[];
  perEntitas: { label: string; n: number }[];
  byPriority: { label: string; n: number }[];
}

// Knowledge Management — insight konten pembelajaran (sumber: `_content` + engagement).
export interface KmBar { label: string; n: number }
export interface KmTrend { label: string; konten: number; views: number }
export interface KmContent { id: number; judul: string; author: string | null; views: number; tgl: string | null }
export interface KmData {
  year: number; years: number[];
  kpi: { konten: number; views: number; komentar: number; bookmark: number; unduhan: number; kontributor: number };
  trend: KmTrend[];
  topTags: KmBar[];
  topContent: KmContent[];
  topAuthor: { label: string; konten: number; views: number }[];
}
export interface KmComment { id: number; nama: string | null; teks: string; rate: number | null; tgl: string | null }
export interface KmContentDetail {
  id: number; judul: string; author: string | null; source: string | null; tags: string[];
  views: number; tgl: string | null; bidang: string | null; deskripsi: string | null;
  engagement: { komentar: number; bookmark: number; unduhan: number };
  comments: KmComment[];
  spamHidden: number;
}

// Serapan Anggaran Learning Wallet (sumber: `_learning_wallet_serapan`).
export interface SerapanBar { label: string; target: number; realisasi: number; pct: number | null }
export interface SerapanMember {
  id: number; nama: string; photo: string | null; grp: string | null; level: string | null;
  target: number; realisasi: number; pct: number | null;
}
export interface SerapanData {
  year: number; years: number[];
  kpi: { target: number; realisasi: number; pctRp: number; peserta: number; jplTarget: number; jplRealisasi: number; pctJpl: number };
  perEntitas: SerapanBar[];
  perLevel: SerapanBar[];
  members: SerapanMember[];
}

// Kehadiran / Presensi (sumber: `_classroom_attendance`).
export interface PresensiKelas { label: string; enrolled: number; hadir: number; rate: number | null }
export interface PresensiData {
  kpi: { kelas: number; hadir: number; checkin: number; avgRate: number };
  perChannel: { label: string; n: number }[];
  rateBuckets: { label: string; n: number }[];
  perKelas: PresensiKelas[];
  presensiV2: { rekam: number; peserta: number; sesi: number; modus: { label: string; n: number }[] };
}

// Individual Development Plan (IDP) — verifikasi pengajuan (sumber: `_idp`).
// Input IDP dilakukan di aplikasi Agronow utama; di Insight hanya verifikasi.
export interface IdpEntry {
  id: number; tahun: number | null;
  areaPengembangan: string | null; aspirasiPengembangan: string | null;
  rencana: string | null; deskripsiPengembangan: string | null;
  lokasi: string | null; tglPelaksanaan: string | null; jamMulai: string | null; jamSelesai: string | null;
  urlDokumentasi: string | null; summary: string | null;
  statusIdp: string; keteranganReject: string | null;
  statusVerifikasi: string | null; catatanVerifikasi: string | null;
  createdAt: string | null; updatedAt: string | null;
}
// Sisi verifikator — IDP yang diajukan + identitas pengaju.
export interface IdpVerifEntry extends IdpEntry {
  member: { id: number | null; nip: string | null; nama: string; jabatan: string | null; unit: string | null; entitas: string | null; level: string | null };
  idVerifikator: number | null; tglVerifikasi: string | null;
}
export interface IdpVerifData { entries: IdpVerifEntry[]; pendingCount: number }

// ── Fetchers ─────────────────────────────────────────────────────────────────
async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}
async function sendJSON<T>(url: string, method: "POST" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `${url} → ${res.status}`);
  return data as T;
}

export const fetchDashboard = (entitas?: number, year?: number) =>
  getJSON<DashboardData>(`/api/dashboard?entitas=${entitas ?? ""}&year=${year ?? ""}`);
export const fetchCapaian = (entitas?: number, year?: number) =>
  getJSON<CapaianData>(`/api/dashboard/capaian?entitas=${entitas ?? ""}&year=${year ?? ""}`);
export const fetchJplSearch = (q: string) =>
  getJSON<JplSearchData>(`/api/jpl-search?q=${encodeURIComponent(q)}`);
export const fetchIdpVerif = (status: "pending" | "all" = "pending") =>
  getJSON<IdpVerifData>(`/api/idp/verifikasi?status=${status}`);
export const verifyIdp = (id: number, action: "approve" | "reject", catatan?: string) =>
  sendJSON<{ ok: true; id: number; statusIdp: string }>("/api/idp/verifikasi", "POST", { id, action, catatan });
export const fetchBiaya = (entitas?: number, year?: number) =>
  getJSON<BiayaData>(`/api/dashboard/biaya?entitas=${entitas ?? ""}&year=${year ?? ""}`);
export const fetchDaftar = (entitas?: number, year?: number) =>
  getJSON<DaftarData>(`/api/dashboard/daftar?entitas=${entitas ?? ""}&year=${year ?? ""}`);
export const fetchWallet = (entitas?: number, year?: number) =>
  getJSON<WalletData>(`/api/wallet?entitas=${entitas ?? ""}&year=${year ?? ""}`);
export const fetchEvaluasi = (jenis: string, tipe: string, year: number) =>
  getJSON<EvaluasiData>(`/api/evaluasi?jenis=${jenis}&tipe=${tipe}&year=${year}`);
export const fetchProjectAssignment = (status: string) =>
  getJSON<PaData>(`/api/project-assignment?status=${status}`);
export const fetchEfektivitas = (entitas: number) =>
  getJSON<EfektivitasData>(`/api/efektivitas?entitas=${entitas}`);
export const fetchWishlist = (source: string, year: number) =>
  getJSON<WishlistData>(`/api/wishlist?source=${source}&year=${year}`);
export const fetchKm = (year: number) =>
  getJSON<KmData>(`/api/km?year=${year}`);
export const fetchKmContent = (id: number) =>
  getJSON<KmContentDetail>(`/api/km/${id}`);
export const fetchSerapan = (year: number) =>
  getJSON<SerapanData>(`/api/serapan?year=${year}`);
export const fetchPresensi = () => getJSON<PresensiData>("/api/presensi");

// Penggunaan Eksternal — pemakaian Agronow oleh pihak di luar PTPN Group.
export interface EksSummaryRow { metric: string; PTPN: number; Eksternal: number; Umum: number }
export interface EksEntitas { id: number; nama: string; members: number; peserta: number; sertifikat: number; pelatihan: number }
export interface EksTraining { crId: number; entitas: string; pelatihan: string; peserta: number; tgl: string | null }
export interface EksParticipant { crId: number; entitas: string; nama: string; nip: string | null; jabatan: string | null; photo: string | null }
export interface EksternalData {
  summary: EksSummaryRow[];
  kpi: { terdaftar: number; aktif: number; dorman: number; peserta: number };
  entitas: EksEntitas[];
  trainings: EksTraining[];
  participants: EksParticipant[];
}
export const fetchEksternal = () => getJSON<EksternalData>("/api/eksternal");

// Master Data korporat (read-only dari IHCMIS-DEV).
export interface MasterEntitas {
  id: string; kode: string | null; nama: string | null; singkatan: string | null;
  type: string | null; aktif: boolean; urutan: number | null; logo_url: string | null;
  regional_count: number; workunit_count: number;
}
export interface MasterRegional {
  id: string; kode: string | null; nama: string | null; aktif: boolean;
  urutan: number | null; entitas: string | null; entitas_id: string | null; workunit_count: number;
}
export interface MasterWorkunit {
  id: string; kode: string | null; nama: string | null; plant: string | null;
  profit_center: string | null; regional_text: string | null; sub_unit: string | null;
  komoditas: string | null; aktif: boolean; entitas: string | null; regional_master: string | null;
  entitas_id: string | null; regional_id: string | null;
}
export interface MasterDataResponse {
  configured: boolean;
  summary: {
    entitas: { total: number; aktif: number };
    regional: { total: number; aktif: number };
    workunit: { total: number; aktif: number };
  };
  entitas: MasterEntitas[];
  regional: MasterRegional[];
  workunit: MasterWorkunit[];
}
export const fetchMasterData = () => getJSON<MasterDataResponse>("/api/master-data");

export interface PhotoStatus { total: number; matched: number; lastSync: string | null; configured: boolean }
export const fetchPhotoStatus = () => getJSON<PhotoStatus>("/api/photos");
export const syncPhotos = () => postJSON<{ ok: boolean; synced: number }>("/api/photos", {});

// Sync data MySQL → Supabase (tabel inti).
export interface SyncState { table_name: string; last_watermark: string | null; last_run: string | null }
export interface SyncRun {
  id: number; started_at: string; finished_at: string | null; ok: boolean;
  total_upsert: number; total_delete: number; duration_ms: number | null;
  detail: { table: string; upserted: number; deleted: number; error?: string }[] | null; error: string | null;
}
export const fetchSyncStatus = () => getJSON<{ state: SyncState[]; runs: SyncRun[] }>("/api/sync");
export const runDataSync = () => postJSON<{ ok: boolean; totalUpsert: number; totalDelete: number; durationMs: number }>("/api/sync", {});
export const fetchCourses = () => getJSON<{ courses: Course[] }>("/api/courses").then(d => d.courses);
export const fetchEmployees = () => getJSON<{ employees: Employee[] }>("/api/employees").then(d => d.employees);
export const fetchEmployeesPaged = (q: string, page: number, status: string, entitas: string, sub: string) =>
  getJSON<EmployeePage>(`/api/employees?q=${encodeURIComponent(q)}&page=${page}&status=${status}&entitas=${encodeURIComponent(entitas)}&sub=${encodeURIComponent(sub)}`);
export const fetchEmployeeEntitas = () =>
  getJSON<{ entitas: EntitasNode[] }>("/api/employees/entitas").then(d => d.entitas);
export const fetchEmployeeSummary = (q: string, status: string, entitas: string, sub: string) =>
  getJSON<EmployeeSummary>(`/api/employees/summary?q=${encodeURIComponent(q)}&status=${status}&entitas=${encodeURIComponent(entitas)}&sub=${encodeURIComponent(sub)}`);
export const fetchEnrollmentClasses = () => getJSON<{ classes: EnrollmentClass[] }>("/api/enrollments").then(d => d.classes);
export const fetchClassMembers = (id: number) => getJSON<{ members: ClassMember[] }>(`/api/enrollments/${id}`).then(d => d.members);
export const fetchCalendar = () => getJSON<{ sessions: TrainingSession[] }>("/api/calendar").then(d => d.sessions);
export interface CertEntitas {
  nama: string; total: number;
  subs: { nama: string; group: string; total: number }[];
}
export const fetchCertificationsPaged = (q: string, page: number, verified: string, entitas: string, sub: string) =>
  getJSON<CertificationPage>(`/api/certifications?q=${encodeURIComponent(q)}&page=${page}&verified=${verified}&entitas=${encodeURIComponent(entitas)}&sub=${encodeURIComponent(sub)}`);
export const fetchCertEntitas = () =>
  getJSON<{ entitas: CertEntitas[] }>("/api/certifications/entitas").then(d => d.entitas);
export interface CertSummary { total: number; verified: number; unverified: number }
export const fetchCertSummary = (q: string, verified: string, entitas: string, sub: string) =>
  getJSON<CertSummary>(`/api/certifications/summary?q=${encodeURIComponent(q)}&verified=${verified}&entitas=${encodeURIComponent(entitas)}&sub=${encodeURIComponent(sub)}`);

// ── Mutations (admin) ────────────────────────────────────────────────────────
async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Gagal (${res.status})`);
  return data as T;
}

export const createSession = (b: Partial<TrainingSession>) => postJSON<{ ok: boolean; id: number }>("/api/calendar", b);

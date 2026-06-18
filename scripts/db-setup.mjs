/**
 * Agronow L&D — DB setup & seed.
 *
 *   npm run db:setup
 *
 * 1) Membuat database (jika belum ada) sesuai MYSQL_DATABASE
 * 2) Menjalankan db/schema.sql (drop + create tabel)
 * 3) Seed: user default (admin/admin123 = super_admin) + satu akun per jenis role + data contoh L&D
 *
 * Kredensial dibaca dari .env.local (lihat .env.example).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
dotenv.config({ path: join(root, ".env.local") });

const cfg = {
  host: process.env.MYSQL_HOST ?? "127.0.0.1",
  port: Number(process.env.MYSQL_PORT ?? 3306),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "",
};
const dbName = process.env.MYSQL_DATABASE ?? "agronow_ld";

async function main() {
  // 1) Pastikan database ada (lewati bila user tak punya hak CREATE — mis. shared hosting)
  try {
    const admin = await mysql.createConnection({ ...cfg, multipleStatements: true });
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    );
    await admin.end();
    console.log(`✓ Database \`${dbName}\` siap`);
  } catch (e) {
    console.log(`• Lewati CREATE DATABASE (${e.code || e.message}); memakai database \`${dbName}\` yang ada`);
  }

  // 2) Jalankan schema
  const conn = await mysql.createConnection({ ...cfg, database: dbName, multipleStatements: true });
  const schema = readFileSync(join(root, "db", "schema.sql"), "utf8");
  await conn.query(schema);
  console.log("✓ Schema dibuat (tabel)");

  // 3) Seed — users: super_admin default (admin/admin123) + satu akun per jenis role.
  //    Password setiap akun = "<username>123" (mis. admin_holding / admin_holding123).
  const seedUsers = [
    ["admin", "Administrator L&D", "super_admin"],
    ["admin_holding", "Admin Holding", "admin_holding"],
    ["admin_anper", "Admin Anak Perusahaan", "admin_anper"],
    ["admin_regional", "Admin Regional", "admin_regional"],
    ["viewer_holding", "Viewer Holding", "viewer_holding"],
    ["viewer_anper", "Viewer Anak Perusahaan", "viewer_anper"],
    ["viewer_regional", "Viewer Regional", "viewer_regional"],
  ];
  const userRows = await Promise.all(
    seedUsers.map(async ([username, nama, role]) => [
      username,
      nama,
      role,
      await bcrypt.hash(`${username}123`, 10),
    ]),
  );
  await conn.query(
    "INSERT INTO app_users (username, nama, role, password_hash) VALUES ?",
    [userRows],
  );
  console.log(`✓ Seed ${userRows.length} users (default: admin/admin123 = super_admin)`);

  // Employees
  const employees = [
    ["AGN-001", "Budi Santoso", "budi.santoso@agronow.id", "Agronomist Senior", "Agronomi", "Medan", "2019-03-04"],
    ["AGN-002", "Siti Rahmawati", "siti.r@agronow.id", "Field Officer", "Operasional Lahan", "Sei Mangkei", "2020-07-15"],
    ["AGN-003", "Andi Wijaya", "andi.w@agronow.id", "Data Analyst", "Riset & Data", "Jakarta", "2021-01-11"],
    ["AGN-004", "Dewi Lestari", "dewi.l@agronow.id", "HR Officer", "SDM", "Jakarta", "2018-09-02"],
    ["AGN-005", "Rudi Hartono", "rudi.h@agronow.id", "Supervisor Produksi", "Produksi", "Sei Mangkei", "2017-05-20"],
    ["AGN-006", "Maya Putri", "maya.p@agronow.id", "QA Officer", "Quality Assurance", "Medan", "2022-02-28"],
    ["AGN-007", "Fajar Nugroho", "fajar.n@agronow.id", "IT Support", "Teknologi Informasi", "Jakarta", "2023-04-10"],
    ["AGN-008", "Rina Kusuma", "rina.k@agronow.id", "Finance Staff", "Keuangan", "Jakarta", "2021-11-08"],
  ];
  await conn.query(
    "INSERT INTO employees (nip, nama, email, jabatan, departemen, lokasi, tanggal_masuk) VALUES ?",
    [employees],
  );
  console.log(`✓ Seed ${employees.length} karyawan`);

  // Courses
  const courses = [
    ["TRN-AGR-01", "Good Agricultural Practices (GAP)", "Teknis Pertanian", "Praktik budidaya yang baik & berkelanjutan sesuai standar GAP.", "dasar", "offline", 24, "Internal L&D", 0],
    ["TRN-DAT-01", "Data Analytics untuk Agribisnis", "Data & Teknologi", "Analisis data produksi & rantai pasok menggunakan spreadsheet & BI.", "menengah", "hybrid", 16, "Coursera Business", 1500000],
    ["TRN-LDR-01", "Leadership Essentials", "Kepemimpinan", "Dasar kepemimpinan tim untuk supervisor & manajer lini pertama.", "menengah", "offline", 16, "Prasmul Executive", 3500000],
    ["TRN-K3-01", "K3 & Keselamatan Kerja Lapangan", "K3 / HSE", "Prosedur keselamatan kerja di area perkebunan & pabrik.", "dasar", "offline", 8, "Internal HSE", 0],
    ["TRN-QA-01", "Quality Management System ISO 9001", "Quality", "Pemahaman & implementasi QMS ISO 9001:2015.", "lanjutan", "offline", 24, "TUV Rheinland", 5000000],
    ["TRN-DIG-01", "Transformasi Digital & Spreadsheet Lanjutan", "Data & Teknologi", "Otomasi laporan & dashboard dengan spreadsheet lanjutan.", "dasar", "online", 12, "Internal L&D", 0],
  ];
  await conn.query(
    "INSERT INTO courses (kode, judul, kategori, deskripsi, level, mode, durasi_jam, penyelenggara, biaya) VALUES ?",
    [courses],
  );
  console.log(`✓ Seed ${courses.length} course`);

  // Training sessions (kalender) — course_id 1..6
  const sessions = [
    [1, "GAP Batch I 2026", "2026-06-18", "2026-06-20", "09:00–16:00 WIB", "Aula Sei Mangkei", "Ir. Bambang S.", 30, "terjadwal"],
    [4, "K3 Lapangan Juni", "2026-06-25", "2026-06-25", "08:00–16:00 WIB", "Lapangan Blok C", "Tim HSE", 40, "terjadwal"],
    [2, "Data Analytics Kohort 2", "2026-07-07", "2026-07-09", "13:00–17:00 WIB", "Online (Zoom)", "Andi Wijaya", 25, "terjadwal"],
    [3, "Leadership Essentials Q3", "2026-07-21", "2026-07-22", "09:00–17:00 WIB", "Hotel Santika Medan", "Dr. Hendra P.", 20, "terjadwal"],
    [5, "ISO 9001 Awareness", "2026-05-12", "2026-05-14", "09:00–16:00 WIB", "Kantor Pusat Jakarta", "Auditor TUV", 15, "selesai"],
    [6, "Spreadsheet Lanjutan", "2026-06-02", "2026-06-03", "10:00–15:00 WIB", "Online (Teams)", "Fajar Nugroho", 50, "selesai"],
  ];
  await conn.query(
    "INSERT INTO training_sessions (course_id, judul, tanggal_mulai, tanggal_selesai, waktu, lokasi, instruktur, kuota, status) VALUES ?",
    [sessions],
  );
  console.log(`✓ Seed ${sessions.length} jadwal training`);

  // Enrollments — employee_id, course_id, session_id, status, progress, nilai, enrolled_at, completed_at
  const enrollments = [
    [1, 1, 1, "terdaftar", 0, null, "2026-06-10", null],
    [2, 1, 1, "terdaftar", 0, null, "2026-06-10", null],
    [5, 4, 2, "terdaftar", 0, null, "2026-06-11", null],
    [3, 2, 3, "terdaftar", 10, null, "2026-06-09", null],
    [4, 3, 4, "terdaftar", 0, null, "2026-06-11", null],
    [6, 5, 5, "selesai", 100, 88.50, "2026-05-05", "2026-05-14"],
    [3, 5, 5, "selesai", 100, 92.00, "2026-05-05", "2026-05-14"],
    [7, 6, 6, "selesai", 100, 79.00, "2026-05-28", "2026-06-03"],
    [8, 6, 6, "berlangsung", 60, null, "2026-05-28", null],
    [1, 6, 6, "selesai", 100, 95.00, "2026-05-28", "2026-06-03"],
  ];
  await conn.query(
    "INSERT INTO enrollments (employee_id, course_id, session_id, status, progress, nilai, enrolled_at, completed_at) VALUES ?",
    [enrollments],
  );
  console.log(`✓ Seed ${enrollments.length} enrollment`);

  // Certifications
  const certs = [
    [6, 5, "ISO 9001:2015 Awareness", "TUV Rheinland", "TUV-9001-2026-014", "2026-05-15", "2029-05-15", "berlaku"],
    [3, 5, "ISO 9001:2015 Awareness", "TUV Rheinland", "TUV-9001-2026-015", "2026-05-15", "2029-05-15", "berlaku"],
    [1, 6, "Sertifikat Spreadsheet Lanjutan", "Agronow L&D", "AGN-CERT-2026-088", "2026-06-04", null, "berlaku"],
    [5, null, "Ahli K3 Umum (AK3U)", "Kemnaker RI", "AK3U-2024-2210", "2024-08-01", "2027-08-01", "berlaku"],
    [7, null, "Certified Data Associate", "Google", "GCDA-2025-7781", "2025-03-20", "2026-03-20", "kadaluarsa"],
  ];
  await conn.query(
    "INSERT INTO certifications (employee_id, course_id, nama_sertifikat, penerbit, nomor, tanggal_terbit, tanggal_kadaluarsa, status) VALUES ?",
    [certs],
  );
  console.log(`✓ Seed ${certs.length} sertifikasi`);

  await conn.end();
  console.log("\n✅ Selesai. Login: admin / admin123  (dev: http://localhost:3030)");
}

main().catch((err) => {
  console.error("\n✗ DB setup gagal:", err.message);
  console.error("  Pastikan MySQL berjalan & kredensial di .env.local benar.");
  process.exit(1);
});

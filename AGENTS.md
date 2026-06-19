# This is NOT the Next.js you know

This version (Next.js 16) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices. Notable: middleware is replaced by `src/proxy.ts`; dynamic-route `params` are async (Promises).

# App: Agronow Learning & Development

Internal **Learning & Development (L&D)** platform — kelola program training, peserta/learner, sertifikasi, dan jadwal pelatihan.

- **Stack & styling** diport dari `../kinra-business-performance`: Next 16, React 19, Tailwind v4, framer-motion, lucide-react. Tema dark/light dengan literal-remap di `globals.css`.
- **Database**: **Supabase Postgres** (project `agronow`). Koneksi via pool `pg` di `src/lib/db.ts`, dari `SUPABASE_DB_URL` di `.env.local`. Gunakan **transaction pooler (port 6543)**, bukan session pooler (5432) — session pooler dibatasi 15 klien untuk seluruh project & cepat habis (error `EMAXCONNSESSION` → query 500). Route handler memakai placeholder gaya `?` (warisan MySQL) yang otomatis diubah jadi `$1, $2, …` oleh `query()`/`execute()`. Catatan: dulu MySQL (`mysql2/promise`), kini seluruh data dibaca dari Supabase.
- **Auth**: berbasis tabel sendiri — `app_users` + `app_sessions`, password di-hash `bcryptjs`, sesi via cookie httpOnly (`agronow_session`). Cek optimistik di `src/proxy.ts`, validasi sebenarnya di `/api/auth/me`. Role: `admin` (full) / `viewer` (read-only).
- **Setup DB**: data live ada di Supabase (tabel sync `_member`, `_rekap_classroom_excel`, `_group`, … + auth `app_users`/`app_sessions`); disegarkan via `npm run sync` (`scripts/sync.mjs`). ⚠️ `npm run db:setup` + `db/schema.sql` **usang/MySQL** (driver `mysql2`, env `MYSQL_*` yang sudah tak ada, DDL `AUTO_INCREMENT`/`ENGINE=InnoDB`, seed tabel demo lama) — tak jalan di Postgres, jangan dipakai. Default login: `admin` / `admin123`.

## Modul
- **Katalog Training** (`/courses`) + **Enrollment** (`/enrollments`)
- **Karyawan/Learner** (`/employees`)
- **Sertifikasi** (`/certifications`)
- **Kalender Training** (`/calendar`)
- **Manajemen User** (`/users`) + **Settings** (`/settings`) — admin only

Dev port: **3030**.

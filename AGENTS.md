# This is NOT the Next.js you know

This version (Next.js 16) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices. Notable: middleware is replaced by `src/proxy.ts`; dynamic-route `params` are async (Promises).

# App: Agronow Learning & Development

Internal **Learning & Development (L&D)** platform — kelola program training, peserta/learner, sertifikasi, dan jadwal pelatihan.

- **Stack & styling** diport dari `../kinra-business-performance`: Next 16, React 19, Tailwind v4, framer-motion, lucide-react. Tema dark/light dengan literal-remap di `globals.css`.
- **Database**: **MySQL** (bukan Supabase). Koneksi via pool `mysql2/promise` di `src/lib/db.ts`. Kredensial di `.env.local` (lihat `.env.example`).
- **Auth**: berbasis tabel sendiri — `app_users` + `app_sessions`, password di-hash `bcryptjs`, sesi via cookie httpOnly (`agronow_session`). Cek optimistik di `src/proxy.ts`, validasi sebenarnya di `/api/auth/me`. Role: `admin` (full) / `viewer` (read-only).
- **Setup DB**: `npm run db:setup` menjalankan `db/schema.sql` + seed (`scripts/db-setup.mjs`). Default login: `admin` / `admin123`.

## Modul
- **Katalog Training** (`/courses`) + **Enrollment** (`/enrollments`)
- **Karyawan/Learner** (`/employees`)
- **Sertifikasi** (`/certifications`)
- **Kalender Training** (`/calendar`)
- **Manajemen User** (`/users`) + **Settings** (`/settings`) — admin only

Dev port: **3030**.

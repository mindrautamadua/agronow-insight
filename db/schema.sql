-- ─────────────────────────────────────────────────────────────────────────────
-- Agronow Learning & Development — MySQL schema
-- Jalankan via: npm run db:setup  (membuat tabel + seed data)
-- Aman dijalankan ulang: DROP IF EXISTS lalu CREATE.
-- ─────────────────────────────────────────────────────────────────────────────

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS certifications;
DROP TABLE IF EXISTS enrollments;
DROP TABLE IF EXISTS training_sessions;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS app_sessions;
DROP TABLE IF EXISTS app_users;
SET FOREIGN_KEY_CHECKS = 1;

-- ── Auth ─────────────────────────────────────────────────────────────────────
CREATE TABLE app_users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(64)  NOT NULL,
  nama          VARCHAR(128) NULL,
  role          ENUM('admin','viewer') NOT NULL DEFAULT 'viewer',
  password_hash VARCHAR(255) NOT NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE app_sessions (
  token      CHAR(64)     NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  expires_at DATETIME     NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token),
  KEY idx_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Karyawan / Learner ───────────────────────────────────────────────────────
CREATE TABLE employees (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nip            VARCHAR(32)  NOT NULL,
  nama           VARCHAR(160) NOT NULL,
  email          VARCHAR(160) NULL,
  jabatan        VARCHAR(160) NULL,
  departemen     VARCHAR(120) NULL,
  lokasi         VARCHAR(120) NULL,
  tanggal_masuk  DATE NULL,
  status         ENUM('aktif','nonaktif') NOT NULL DEFAULT 'aktif',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_emp_nip (nip),
  KEY idx_emp_departemen (departemen)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Katalog Training ─────────────────────────────────────────────────────────
CREATE TABLE courses (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  kode         VARCHAR(32)  NOT NULL,
  judul        VARCHAR(200) NOT NULL,
  kategori     VARCHAR(80)  NULL,
  deskripsi    TEXT NULL,
  level        ENUM('dasar','menengah','lanjutan') NOT NULL DEFAULT 'dasar',
  mode         ENUM('online','offline','hybrid') NOT NULL DEFAULT 'offline',
  durasi_jam   INT UNSIGNED NULL,
  penyelenggara VARCHAR(160) NULL,
  biaya        DECIMAL(14,2) NOT NULL DEFAULT 0,
  status       ENUM('aktif','arsip') NOT NULL DEFAULT 'aktif',
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_course_kode (kode),
  KEY idx_course_kategori (kategori)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Jadwal / Kalender Training (satu batch pelaksanaan sebuah course) ─────────
CREATE TABLE training_sessions (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id      INT UNSIGNED NOT NULL,
  judul          VARCHAR(200) NULL,           -- override judul batch (opsional)
  tanggal_mulai  DATE NOT NULL,
  tanggal_selesai DATE NULL,
  waktu          VARCHAR(64) NULL,            -- mis. "09:00–16:00 WIB"
  lokasi         VARCHAR(200) NULL,
  instruktur     VARCHAR(160) NULL,
  kuota          INT UNSIGNED NULL,
  status         ENUM('terjadwal','berlangsung','selesai','batal') NOT NULL DEFAULT 'terjadwal',
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ts_course (course_id),
  KEY idx_ts_mulai (tanggal_mulai),
  CONSTRAINT fk_ts_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Enrollment (peserta mendaftar ke sebuah sesi/course) ─────────────────────
CREATE TABLE enrollments (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id INT UNSIGNED NOT NULL,
  course_id   INT UNSIGNED NOT NULL,
  session_id  INT UNSIGNED NULL,
  status      ENUM('terdaftar','berlangsung','selesai','batal') NOT NULL DEFAULT 'terdaftar',
  progress    TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- 0..100
  nilai       DECIMAL(5,2) NULL,
  enrolled_at DATE NOT NULL,
  completed_at DATE NULL,
  catatan     VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enroll (employee_id, course_id, session_id),
  KEY idx_enroll_emp (employee_id),
  KEY idx_enroll_course (course_id),
  CONSTRAINT fk_enroll_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_enroll_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  CONSTRAINT fk_enroll_session FOREIGN KEY (session_id) REFERENCES training_sessions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Sertifikasi ──────────────────────────────────────────────────────────────
CREATE TABLE certifications (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id      INT UNSIGNED NOT NULL,
  course_id        INT UNSIGNED NULL,
  nama_sertifikat  VARCHAR(200) NOT NULL,
  penerbit         VARCHAR(160) NULL,
  nomor            VARCHAR(120) NULL,
  tanggal_terbit   DATE NULL,
  tanggal_kadaluarsa DATE NULL,
  status           ENUM('berlaku','kadaluarsa','dicabut') NOT NULL DEFAULT 'berlaku',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cert_emp (employee_id),
  CONSTRAINT fk_cert_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_cert_course FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format angka dengan pemisah ribuan id-ID. */
export function fmtNum(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("id-ID") : "—";
}

/** Format rupiah ringkas (Rp 1,5 Jt / Rp 12 Jt). Untuk biaya training. */
export function fmtRupiah(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "Gratis";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}Rp ${(abs / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1e6) return `${sign}Rp ${(abs / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} Jt`;
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}

/** Format tanggal id-ID (12 Jun 2026). Terima string ISO / Date / null. */
export function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/** Format tanggal pendek (12 Jun). */
export function fmtDateShort(v: unknown): string {
  if (!v) return "—";
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

/** Sisa hari sampai tanggal (negatif = sudah lewat). */
export function daysUntil(v: unknown): number | null {
  if (!v) return null;
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

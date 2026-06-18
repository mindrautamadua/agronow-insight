"use client";

import { useEffect, useState } from "react";
import { UserCog, Plus, X, Loader2, ShieldCheck, Eye } from "lucide-react";
import { fmtDate } from "@/lib/utils";
import { ListSkeleton, EmptyState } from "@/components/ui";
import { ROLES, isAdminRole, roleLabel, type Role } from "@/lib/roles";

interface AppUserRow { id: string; username: string; nama: string | null; role: Role; created_at: string }

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AppUserRow[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    fetch("/api/auth/users").then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setRows(d.users ?? []))
      .catch(() => setErr("Gagal memuat daftar user."))
      .finally(() => setLoading(false));
  }
  useEffect(reload, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-end">
        <button onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:brightness-105 transition-all">
          <Plus className="w-4 h-4" /> Tambah User
        </button>
      </div>

      {loading ? <ListSkeleton rows={6} /> : err ? (
        <p className="text-xs text-red-400">{err}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={UserCog} title="Belum ada user" />
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                {["User", "Role", "Dibuat"].map(h => <th key={h} className="px-4 py-3 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(u => (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card2)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-white text-xs font-semibold uppercase">{(u.nama || u.username).charAt(0)}</div>
                      <div>
                        <p className="font-medium text-[var(--foreground)]">{u.nama || u.username}</p>
                        <p className="text-[11px] text-[var(--muted)]">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md border font-medium ${isAdminRole(u.role) ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-slate-500/10 text-slate-400 border-slate-500/20"}`}>
                      {isAdminRole(u.role) ? <ShieldCheck className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{fmtDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <UserModal onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload(); }} />}
    </div>
  );
}

function UserModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ username: "", nama: "", password: "", role: "viewer_regional" as Role });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/auth/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Gagal."); setSaving(false); return; }
      onSaved();
    } catch { setError("Gagal terhubung."); setSaving(false); }
  }

  const inputCls = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card2)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-bold text-[var(--foreground)]">Tambah User</h3>
          <button onClick={onClose} className="p-1 text-[var(--muted)] hover:text-[var(--foreground)]"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <label className="block"><span className="text-[11px] font-medium text-[var(--muted)] mb-1 block">Username *</span><input required value={form.username} onChange={e => set("username", e.target.value)} className={inputCls} autoComplete="off" /></label>
          <label className="block"><span className="text-[11px] font-medium text-[var(--muted)] mb-1 block">Nama</span><input value={form.nama} onChange={e => set("nama", e.target.value)} className={inputCls} /></label>
          <label className="block"><span className="text-[11px] font-medium text-[var(--muted)] mb-1 block">Password *</span><input required type="password" value={form.password} onChange={e => set("password", e.target.value)} className={inputCls} autoComplete="new-password" /></label>
          <label className="block"><span className="text-[11px] font-medium text-[var(--muted)] mb-1 block">Role</span>
            <select value={form.role} onChange={e => set("role", e.target.value)} className={inputCls}>
              <optgroup label="Admin (akses tulis)">
                {ROLES.filter(isAdminRole).map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </optgroup>
              <optgroup label="Viewer (read-only)">
                {ROLES.filter(r => !isAdminRole(r)).map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </optgroup>
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[var(--muted)] hover:bg-[var(--bg-card2)]">Batal</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-blue-600 text-sm font-semibold text-white disabled:opacity-50">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { UserCog, Plus, X, Loader2, ShieldCheck, Eye, Search, Pencil, Ban, RotateCcw } from "lucide-react";
import { fmtDate } from "@/lib/utils";
import { ListSkeleton, EmptyState } from "@/components/ui";
import { ROLES, isAdminRole, roleLabel, needsScope, canAssignRole, type Role } from "@/lib/roles";
import { useAuth } from "@/components/AuthContext";

interface AppUserRow { id: string; username: string; nama: string | null; role: Role; scope: string | null; created_at: string; is_active: boolean }

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AppUserRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppUserRow | null>(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleActive(u: AppUserRow) {
    const next = !u.is_active;
    if (!next && !confirm(`Nonaktifkan user "${u.nama || u.username}"? User tidak akan bisa login.`)) return;
    setBusyId(u.id); setErr(null);
    try {
      const res = await fetch(`/api/auth/users/${u.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error ?? "Gagal mengubah status."); return; }
      setRows(rs => rs.map(r => r.id === u.id ? { ...r, is_active: next } : r));
    } catch { setErr("Gagal terhubung."); }
    finally { setBusyId(null); }
  }

  function reload() {
    setLoading(true);
    fetch("/api/auth/users").then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setRows(d.users ?? []))
      .catch(() => setErr("Gagal memuat daftar user."))
      .finally(() => setLoading(false));
  }
  useEffect(reload, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(u =>
      [u.username, u.nama, roleLabel(u.role), u.scope].some(v => v?.toLowerCase().includes(term)),
    );
  }, [rows, q]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama, username, role, cakupan…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50" />
        </div>
        <button onClick={() => { setEditing(null); setOpen(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:brightness-105 transition-all ml-auto">
          <Plus className="w-4 h-4" /> Tambah User
        </button>
      </div>

      {loading ? <ListSkeleton rows={6} /> : err ? (
        <p className="text-xs text-red-400">{err}</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={UserCog} title="Belum ada user" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Tidak ada user yang cocok" desc={`Tidak ada hasil untuk "${q}".`} />
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left">
                {["User", "Role", "Cakupan", "Dibuat", ""].map((h, i) => <th key={h || i} className="px-4 py-3 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className={`border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card2)] transition-colors ${!u.is_active ? "opacity-55" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold uppercase ${u.is_active ? "bg-gradient-to-br from-emerald-500 to-blue-600" : "bg-slate-500"}`}>{(u.nama || u.username).charAt(0)}</div>
                      <div>
                        <p className="font-medium text-[var(--foreground)] flex items-center gap-2">
                          {u.nama || u.username}
                          {!u.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded border border-red-500/20 bg-red-500/10 text-red-400 font-medium">Nonaktif</span>}
                        </p>
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
                  <td className="px-4 py-3 text-[var(--muted)]">{u.scope || <span className="text-[var(--muted)]/60">— semua</span>}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== "0" && (
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => { setEditing(u); setOpen(true); }}
                          title="Edit user"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card2)] transition-colors">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => toggleActive(u)} disabled={busyId === u.id}
                          title={u.is_active ? "Nonaktifkan user" : "Aktifkan user"}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${u.is_active ? "border-red-500/20 text-red-400 hover:bg-red-500/10" : "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"}`}>
                          {busyId === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : u.is_active ? <Ban className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          {u.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <UserModal editing={editing} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); reload(); }} />}
    </div>
  );
}

function UserModal({ editing, onClose, onSaved }: { editing: AppUserRow | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!editing;
  const [form, setForm] = useState({
    username: editing?.username ?? "",
    nama: editing?.nama ?? "",
    password: "",
    role: editing?.role ?? ("viewer_regional" as Role),
    scope: editing?.scope ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entitas, setEntitas] = useState<{ nama: string; subs: { group: string }[] }[]>([]);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Saran cakupan dari hierarki entitas peserta (anper = parent, regional = sub).
  useEffect(() => {
    fetch("/api/employees/entitas").then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.entitas) setEntitas(d.entitas); }).catch(() => {});
  }, []);

  const { user: me } = useAuth();
  // Hanya peran yang boleh diberikan oleh admin yang sedang login.
  const assignableRoles = ROLES.filter(r => !me || canAssignRole(me.role, r));

  const showScope = needsScope(form.role);
  const scopeIsRegional = form.role.endsWith("_regional");
  const scopeOptions = scopeIsRegional
    ? entitas.flatMap(e => e.subs.map(s => s.group))
    : entitas.map(e => e.nama);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const url = isEdit ? `/api/auth/users/${editing!.id}` : "/api/auth/users";
      const method = isEdit ? "PATCH" : "POST";
      // Saat edit, password kosong = jangan ubah; jangan kirim username.
      const payload = isEdit
        ? { nama: form.nama, role: form.role, scope: form.scope, password: form.password }
        : form;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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
          <h3 className="text-sm font-bold text-[var(--foreground)]">{isEdit ? "Edit User" : "Tambah User"}</h3>
          <button onClick={onClose} className="p-1 text-[var(--muted)] hover:text-[var(--foreground)]"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
          <label className="block"><span className="text-[11px] font-medium text-[var(--muted)] mb-1 block">Username *</span><input required disabled={isEdit} value={form.username} onChange={e => set("username", e.target.value)} className={`${inputCls} disabled:opacity-60 disabled:cursor-not-allowed`} autoComplete="off" /></label>
          <label className="block"><span className="text-[11px] font-medium text-[var(--muted)] mb-1 block">Nama</span><input value={form.nama} onChange={e => set("nama", e.target.value)} className={inputCls} /></label>
          <label className="block"><span className="text-[11px] font-medium text-[var(--muted)] mb-1 block">{isEdit ? "Password (kosongkan jika tidak diubah)" : "Password *"}</span><input required={!isEdit} type="password" value={form.password} onChange={e => set("password", e.target.value)} className={inputCls} autoComplete="new-password" placeholder={isEdit ? "••••••••" : undefined} /></label>
          <label className="block"><span className="text-[11px] font-medium text-[var(--muted)] mb-1 block">Role</span>
            <select value={form.role} onChange={e => set("role", e.target.value)} className={inputCls}>
              <optgroup label="Admin (akses tulis)">
                {assignableRoles.filter(isAdminRole).map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </optgroup>
              <optgroup label="Viewer (read-only)">
                {assignableRoles.filter(r => !isAdminRole(r)).map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </optgroup>
            </select>
          </label>
          {showScope && (
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--muted)] mb-1 block">
                Cakupan ({scopeIsRegional ? "Regional" : "Anak Perusahaan"}) *
              </span>
              <input required list="scope-options" value={form.scope} onChange={e => set("scope", e.target.value)}
                className={inputCls} autoComplete="off"
                placeholder={scopeIsRegional ? "mis. PTPN IV - Regional 2" : "mis. PTPN IV"} />
              <datalist id="scope-options">
                {scopeOptions.map(o => <option key={o} value={o} />)}
              </datalist>
            </label>
          )}
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

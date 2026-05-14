"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  User, LogOut, Plus, Trash2, Pencil, Check, X,
  ShieldCheck, Users, Loader2, AlertCircle, HardHat
} from "lucide-react";
import { getAdminInfo, clearToken, authFetch } from "@/lib/auth";
import type { AdminInfo } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface WorkerItem {
  worker_id: string;
  name: string;
  status: string;
  last_seen: string;
}

export default function AccountPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminInfo | null>(null);

  // Workers
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);

  // Register form
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Rename inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setAdmin(getAdminInfo());
  }, []);

  const fetchWorkers = useCallback(async () => {
    setLoadingWorkers(true);
    try {
      const res = await fetch(`${API_URL}/workers`);
      if (res.ok) setWorkers(await res.json());
    } finally {
      setLoadingWorkers(false);
    }
  }, []);

  useEffect(() => { fetchWorkers(); }, [fetchWorkers]);

  const handleLogout = () => {
    clearToken();
    router.replace("/login");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegistering(true);
    try {
      const res = await authFetch(`${API_URL}/admin/workers`, {
        method: "POST",
        body: JSON.stringify({ worker_id: newId.trim(), name: newName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail ?? "Failed to register worker");
      }
      setNewId("");
      setNewName("");
      fetchWorkers();
    } catch (err: unknown) {
      setRegError(err instanceof Error ? err.message : "Failed");
    } finally {
      setRegistering(false);
    }
  };

  const handleRename = async (workerId: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/admin/workers/${workerId}/name`, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchWorkers();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (workerId: string) => {
    try {
      await authFetch(`${API_URL}/admin/workers/${workerId}`, { method: "DELETE" });
      setDeletingId(null);
      fetchWorkers();
    } catch {}
  };

  const STATUS_COLORS: Record<string, string> = {
    SAFE: "text-safe bg-safe/10 border-safe/20",
    WARNING: "text-warning bg-warning/10 border-warning/20",
    CRITICAL: "text-critical bg-critical/10 border-critical/20",
    FALL: "text-fall bg-fall/10 border-fall/25",
    INACTIVE: "text-slate-400 bg-slate-400/10 border-slate-400/15",
  };

  return (
    <div className="space-y-5 animate-fade-in pb-4">
      {/* Admin Profile Card */}
      <div className="rounded-2xl border border-border/40 overflow-hidden"
        style={{ background: "linear-gradient(180deg, #0f1f35 0%, #0a1628 100%)" }}
      >
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #0369a1, #0ea5e9)", boxShadow: "0 4px 16px rgba(14,165,233,0.25)" }}
            >
              <ShieldCheck size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-100 text-base truncate">{admin?.username ?? "Admin"}</p>
              <p className="text-xs text-slate-500 mt-0.5">Administrator Account</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-critical/10 border border-critical/25 text-critical text-xs font-semibold hover:bg-critical/20 active:scale-95 transition-all"
            >
              <LogOut size={13} />
              Logout
            </button>
          </div>
        </div>
        {admin?.created_at && (
          <div className="px-4 pb-3 flex items-center gap-1.5">
            <User size={11} className="text-slate-600" />
            <span className="text-[11px] text-slate-600">
              Joined {new Date(admin.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
            </span>
          </div>
        )}
      </div>

      {/* Register New Worker */}
      <div className="rounded-2xl border border-border/40 overflow-hidden"
        style={{ background: "linear-gradient(180deg, #0f1f35 0%, #0a1628 100%)" }}
      >
        <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
          <Plus size={14} className="text-primary" />
          <h2 className="text-sm font-semibold text-slate-200">Register Worker</h2>
        </div>
        <div className="px-4 py-3">
          {regError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-critical/10 border border-critical/25 text-critical text-xs mb-3">
              <AlertCircle size={13} className="shrink-0" />
              {regError}
            </div>
          )}
          <form onSubmit={handleRegister} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Worker ID</label>
                <input
                  id="worker-id-input"
                  type="text"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  required
                  placeholder="W101"
                  className="w-full px-3 py-2 rounded-xl text-sm border border-border/35 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                  style={{ background: "rgba(10, 22, 40, 0.8)" }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-400">Full Name</label>
                <input
                  id="worker-name-input"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder="John Doe"
                  className="w-full px-3 py-2 rounded-xl text-sm border border-border/35 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
                  style={{ background: "rgba(10, 22, 40, 0.8)" }}
                />
              </div>
            </div>
            <button
              id="register-worker-btn"
              type="submit"
              disabled={registering || !newId.trim() || !newName.trim()}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #0369a1, #0ea5e9)" }}
            >
              {registering ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {registering ? "Registering…" : "Register Worker"}
            </button>
          </form>
        </div>
      </div>

      {/* Workers List */}
      <div className="rounded-2xl border border-border/40 overflow-hidden"
        style={{ background: "linear-gradient(180deg, #0f1f35 0%, #0a1628 100%)" }}
      >
        <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
          <Users size={14} className="text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-200">Registered Workers</h2>
          <span className="ml-auto text-[11px] text-slate-500">{workers.length} total</span>
        </div>

        {loadingWorkers ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-600">
            <HardHat size={32} className="opacity-30" />
            <p className="text-sm">No workers registered yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border/15">
            {workers.map((w) => (
              <div key={w.worker_id} className="px-4 py-3">
                {editingId === w.worker_id ? (
                  // Rename inline form
                  <div className="flex items-center gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg text-sm border border-primary/40 text-slate-100 focus:outline-none"
                      style={{ background: "rgba(10, 22, 40, 0.8)" }}
                      autoFocus
                    />
                    <button
                      onClick={() => handleRename(w.worker_id)}
                      disabled={saving}
                      className="p-1.5 rounded-lg bg-safe/15 border border-safe/30 text-safe hover:bg-safe/25 transition-colors"
                    >
                      {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-lg bg-slate-700/50 border border-border/30 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : deletingId === w.worker_id ? (
                  // Delete confirmation
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-critical flex-1">Delete <strong>{w.name}</strong>?</span>
                    <button
                      onClick={() => handleDelete(w.worker_id)}
                      className="px-3 py-1.5 rounded-lg bg-critical/15 border border-critical/30 text-critical text-xs font-bold hover:bg-critical/25 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-3 py-1.5 rounded-lg bg-slate-700/50 border border-border/30 text-slate-400 text-xs hover:text-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  // Normal row
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-200 truncate">{w.name}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[w.status] ?? STATUS_COLORS.INACTIVE}`}>
                          {w.status}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-600 mt-0.5">{w.worker_id}</p>
                    </div>
                    <button
                      onClick={() => { setEditingId(w.worker_id); setEditName(w.name); }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDeletingId(w.worker_id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-critical hover:bg-critical/10 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

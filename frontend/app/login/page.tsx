"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setToken } from "@/lib/auth";
import { ShieldCheck, User, Lock, Loader2, AlertCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? "Login failed");
      }
      const data = await res.json();
      setToken(data.access_token, data.admin);
      router.replace("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "radial-gradient(ellipse at 50% 0%, #0f2a4a 0%, #080f1e 70%)" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, #0369a1, #0ea5e9)", boxShadow: "0 0 40px rgba(14, 165, 233, 0.3)" }}
          >
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Safety Monitor</h1>
          <p className="text-sm text-slate-400 mt-1">Admin Portal</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-border/40 p-6 space-y-5"
          style={{ background: "linear-gradient(180deg, #0f1f35 0%, #0a1628 100%)", backdropFilter: "blur(20px)" }}
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Welcome back</h2>
            <p className="text-xs text-slate-400 mt-0.5">Sign in to your admin account</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-critical/10 border border-critical/30 text-critical text-sm">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Username</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="admin"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-surface-2/80 border border-border/40 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                  style={{ background: "rgba(15, 31, 53, 0.8)" }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm bg-surface-2/80 border border-border/40 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all"
                  style={{ background: "rgba(15, 31, 53, 0.8)" }}
                />
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #0369a1, #0ea5e9)", boxShadow: "0 4px 20px rgba(14, 165, 233, 0.25)" }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs text-slate-500">
            No account?{" "}
            <Link href="/register" className="text-primary hover:underline font-medium">
              Register admin
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

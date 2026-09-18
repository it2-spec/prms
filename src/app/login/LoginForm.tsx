"use client";

import { useState } from "react";
import { loginAction } from "./actions";

export default function LoginForm({ msg }: { msg?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await loginAction(formData);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else if (result.success && result.redirectUrl) {
      window.location.href = result.redirectUrl;
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}
      {!error && msg === "logout" && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700" role="alert">
          Anda telah keluar secara aman.
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-700">Username</label>
        <input
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          type="text"
          name="username"
          required
          autoFocus
          placeholder="Masukkan username"
          disabled={loading}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-slate-700">Password</label>
        <input
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          type="password"
          name="password"
          required
          placeholder="••••••••"
          disabled={loading}
        />
      </div>

      <div>
        <button
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
          type="submit"
          disabled={loading}
        >
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </div>

    </form>
  );
}

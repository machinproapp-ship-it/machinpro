 "use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError("Introduce email y contraseña");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #0f2a35 0%, #09090b 60%)" }}
    >
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <img
            src="/logo.png"
            alt="MachinPro"
            className="h-20 w-auto mx-auto"
          />
          <p className="text-sm text-zinc-400 mt-1">
            Gestión de construcción profesional
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4 shadow-2xl">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="tu@empresa.com"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="••••••••"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500 min-h-[44px]"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="w-full rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-semibold py-3 text-sm transition-colors min-h-[44px]"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>

          <div className="mt-6 rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 space-y-2">
            <p className="text-xs font-medium text-zinc-400 mb-3">
              Cuentas de prueba
            </p>
            {[
              { role: "Admin", email: "admin@machinpro.com", pass: "Admin2026!" },
              { role: "Supervisor", email: "supervisor@machinpro.com", pass: "Super2026!" },
              { role: "Empleado", email: "trabajador@machinpro.com", pass: "Worker2026!" },
              { role: "Logística", email: "logistica@machinpro.com", pass: "Logis2026!" },
            ].map((c) => (
              <button
                key={c.role}
                type="button"
                onClick={() => { setEmail(c.email); setPassword(c.pass); }}
                className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs hover:bg-zinc-700 transition-colors"
              >
                <span className="font-medium text-amber-400">{c.role}</span>
                <span className="text-zinc-500">{c.email}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600">
          MachinPro © 2026
        </p>
      </div>
    </div>
  );
}


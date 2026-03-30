"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandLogoImage } from "@/components/BrandLogoImage";
import { BrandWordmark } from "@/components/BrandWordmark";
import { useParams, useSearchParams } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useVisitorPublicT } from "@/lib/visitorPublicLocale";
import { buildVisitorCheckInUrl } from "@/lib/visitorQrUrl";
import type { VisitorFormData } from "@/types/visitor";

const PHOTO_MAX_BYTES = 400_000;

async function fetchClientIp(): Promise<string | null> {
  try {
    const r = await fetch("https://api.ipify.org?format=json");
    const j = (await r.json()) as { ip?: string };
    return typeof j.ip === "string" ? j.ip : null;
  } catch {
    return null;
  }
}

export default function VisitorCheckInPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const companyId = typeof params.companyId === "string" ? params.companyId : "";
  const t = useVisitorPublicT();

  const [companyName, setCompanyName] = useState("");
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; visitor_name: string; check_in: string } | null>(
    null
  );

  const [form, setForm] = useState<VisitorFormData>({
    visitor_name: "",
    visitor_company: "",
    visitor_email: "",
    visitor_phone: "",
    visitor_id_number: "",
    purpose: "",
    host_name: "",
    vehicle_plate: "",
    project_id: "",
    project_name: "",
    safety_briefing_accepted: false,
    signature_data: "",
    photo_url: "",
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setDark(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/visitors/company/${companyId}`);
        const j = (await res.json()) as { name?: string; error?: string };
        if (!res.ok) {
          if (!cancelled) setCompanyError(j.error ?? t.visitors_error ?? "Error");
          return;
        }
        if (!cancelled) {
          setCompanyName(j.name ?? "");
          setCompanyError(null);
        }
      } catch {
        if (!cancelled) setCompanyError(t.visitors_error ?? "Error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, t.visitors_error]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/visitors/projects/${companyId}`);
        const j = (await res.json()) as { projects?: { id: string; name: string }[] };
        if (!cancelled) setProjects(Array.isArray(j.projects) ? j.projects : []);
      } catch {
        if (!cancelled) setProjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  useEffect(() => {
    const pid = searchParams.get("project");
    if (!pid || projects.length === 0) return;
    const p = projects.find((x) => x.id === pid);
    if (!p) return;
    setForm((prev) =>
      prev.project_id === pid ? prev : { ...prev, project_id: p.id, project_name: p.name }
    );
  }, [searchParams, projects]);

  const initCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    const w = c.offsetWidth;
    const h = c.offsetHeight;
    c.width = w * dpr;
    c.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = dark ? "#1f2937" : "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = dark ? "#e5e7eb" : "#111827";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [dark]);

  useEffect(() => {
    initCanvas();
  }, [initCanvas, dark]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasSignature(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const onPointerUp = () => {
    drawing.current = false;
  };

  const clearSignature = () => {
    initCanvas();
    setHasSignature(false);
    setForm((f) => ({ ...f, signature_data: "" }));
  };

  const onPhoto = async (file: File | null) => {
    if (!file) {
      setForm((f) => ({ ...f, photo_url: "" }));
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setSubmitError(t.visitors_photo_too_large ?? "Photo too large");
      return;
    }
    setSubmitError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === "string") setForm((f) => ({ ...f, photo_url: r }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!supabase) {
      setSubmitError(t.visitors_error ?? "Error");
      return;
    }
    const c = canvasRef.current;
    if (!c || !hasSignature) {
      setSubmitError(t.visitors_sign_required ?? (t.visitors_sign ?? "Sign") + "*");
      return;
    }
    const signature_data = c.toDataURL("image/png");
    if (!form.visitor_name.trim() || !form.host_name.trim() || !form.purpose.trim()) {
      setSubmitError(t.visitors_required_fields ?? "Required fields");
      return;
    }
    if (!form.safety_briefing_accepted) {
      setSubmitError(t.visitors_safety_required ?? t.visitors_safety_briefing ?? "");
      return;
    }

    setLoading(true);
    const project_id = form.project_id || null;
    const project_name =
      projects.find((p) => p.id === form.project_id)?.name ?? (form.project_name || null);

    const ip_address = await fetchClientIp();
    const user_agent = typeof navigator !== "undefined" ? navigator.userAgent : null;
    const consent_timestamp = new Date().toISOString();

    const { data, error } = await supabase
      .from("visitor_logs")
      .insert({
        company_id: companyId,
        project_id,
        project_name,
        visitor_name: form.visitor_name.trim(),
        visitor_company: form.visitor_company.trim() || null,
        visitor_email: form.visitor_email.trim() || null,
        visitor_phone: form.visitor_phone.trim() || null,
        visitor_id_number: form.visitor_id_number.trim() || null,
        purpose: form.purpose.trim(),
        host_name: form.host_name.trim(),
        vehicle_plate: form.vehicle_plate.trim() || null,
        safety_briefing_accepted: true,
        signature_data,
        photo_url: form.photo_url || null,
        status: "checked_in",
        ip_address,
        user_agent,
        terms_version: "v1.0",
        consent_timestamp,
      })
      .select("id, visitor_name, check_in")
      .single();

    setLoading(false);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    if (data) {
      setDone({
        id: data.id as string,
        visitor_name: data.visitor_name as string,
        check_in: data.check_in as string,
      });
    }
  };

  if (!companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <p className="text-gray-600 dark:text-gray-400">{t.visitors_error ?? "Error"}</p>
      </div>
    );
  }

  if (companyError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-900 px-4">
        <p className="text-gray-700 dark:text-gray-300 text-center">{companyError}</p>
      </div>
    );
  }

  if (done) {
    const checkoutUrl = `/visit/${companyId}/checkout/${done.id}`;
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-10 flex flex-col items-center">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-xl text-center space-y-4">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {t.visitors_confirmed ?? "Confirmed"}
          </h1>
          <p className="text-gray-700 dark:text-gray-300">
            <span className="font-semibold">{done.visitor_name}</span>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t.visitors_checkin ?? "Check-in"}: {new Date(done.check_in).toLocaleString()}
          </p>
          <Link
            href={checkoutUrl}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold px-6 py-3 text-sm w-full"
          >
            {t.visitors_checkout ?? "Check-out"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-900/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogoImage
              src="/logo.png"
              alt="MachinPro"
              boxClassName="h-10 w-10 shrink-0"
              sizes="40px"
            />
            <div className="min-w-0">
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                <BrandWordmark tone="inherit" className="inline text-xs" />
              </p>
              <p className="font-semibold truncate">{companyName || "—"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDark((d) => !d)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            aria-label={t.darkMode ?? "Theme"}
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6 pb-24">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t.visitors_checkin ?? "Check-in"}
        </h1>

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.visitors_name ?? "Name"} *
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-sm min-h-[44px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              value={form.visitor_name}
              onChange={(e) => setForm((f) => ({ ...f, visitor_name: e.target.value }))}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.visitors_company ?? "Company"}
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-sm min-h-[44px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              value={form.visitor_company}
              onChange={(e) => setForm((f) => ({ ...f, visitor_company: e.target.value }))}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.visitors_email ?? "Email"}
            </span>
            <input
              type="email"
              className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-sm min-h-[44px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              value={form.visitor_email}
              onChange={(e) => setForm((f) => ({ ...f, visitor_email: e.target.value }))}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.visitors_phone ?? "Phone"}
            </span>
            <input
              type="tel"
              className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-sm min-h-[44px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              value={form.visitor_phone}
              onChange={(e) => setForm((f) => ({ ...f, visitor_phone: e.target.value }))}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.visitors_id ?? "ID"}
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-sm min-h-[44px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              value={form.visitor_id_number}
              onChange={(e) => setForm((f) => ({ ...f, visitor_id_number: e.target.value }))}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.visitors_purpose ?? "Purpose"} *
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-sm min-h-[44px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              value={form.purpose}
              onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.visitors_host ?? "Host"} *
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-sm min-h-[44px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              value={form.host_name}
              onChange={(e) => setForm((f) => ({ ...f, host_name: e.target.value }))}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.visitors_vehicle ?? "Vehicle"}
            </span>
            <input
              className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-sm min-h-[44px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
              value={form.vehicle_plate}
              onChange={(e) => setForm((f) => ({ ...f, vehicle_plate: e.target.value }))}
            />
          </label>

          {projects.length > 0 && (
            <label className="block">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t.visitors_project ?? "Project"}
              </span>
              <select
                className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-sm min-h-[44px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
                value={form.project_id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    project_id: e.target.value,
                    project_name: projects.find((p) => p.id === e.target.value)?.name ?? "",
                  }))
                }
              >
                <option value="">{t.visitors_project_none ?? "—"}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-start gap-3 min-h-[44px] cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 rounded border border-gray-400 dark:border-gray-500 bg-white dark:bg-gray-800"
              checked={form.safety_briefing_accepted}
              onChange={(e) =>
                setForm((f) => ({ ...f, safety_briefing_accepted: e.target.checked }))
              }
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {t.visitors_safety_briefing ?? "Safety briefing"}
            </span>
          </label>

          <div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
              {t.visitors_sign ?? "Signature"} *
            </span>
            <canvas
              ref={canvasRef}
              className="w-full h-40 rounded-xl border border-gray-300 dark:border-gray-600 touch-none cursor-crosshair bg-white dark:bg-gray-700"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            />
            <button
              type="button"
              onClick={clearSignature}
              className="mt-2 text-sm text-amber-600 dark:text-amber-400 min-h-[44px] px-2"
            >
              {t.visitors_clear_sign ?? "Clear"}
            </button>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t.visitors_photo_optional ?? "Photo (optional)"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="mt-1 w-full text-sm min-h-[44px]"
              onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        {submitError && (
          <p className="text-sm text-red-500 text-center" role="alert">
            {submitError}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={loading}
          className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold py-3 text-sm"
        >
          {loading ? (t.visitors_loading ?? "…") : (t.visitors_submit ?? "Submit")}
        </button>

        <p className="text-xs text-center text-gray-500 dark:text-gray-400 break-all">
          {buildVisitorCheckInUrl(companyId)}
        </p>
      </main>
    </div>
  );
}

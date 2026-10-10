"use client";

import { useEffect, useState } from "react";

/**
 * true mientras haya una ventana, hoja inferior o diálogo abierto en pantalla.
 * Sirve para ocultar los botones flotantes (feedback, ayuda), que si no tapan
 * los botones de esas ventanas (p. ej. "Eliminar" en la hoja del día de Horario).
 *
 * Detecta diálogos accesibles y los fondos oscuros a pantalla completa (`fixed inset-0`)
 * que usan los modales de la app.
 */
const OVERLAY_SELECTOR = '[role="dialog"], [aria-modal="true"], .fixed.inset-0';

function anyOverlayVisible(): boolean {
  if (typeof document === "undefined") return false;
  const nodes = document.querySelectorAll<HTMLElement>(OVERLAY_SELECTOR);
  for (const el of nodes) {
    if (el.closest("[data-floating-fab]")) continue;
    if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return true;
  }
  return false;
}

export function useOverlayOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setOpen(anyOverlayVisible()));
    };
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "role", "aria-modal"] });
    check();
    return () => {
      cancelAnimationFrame(frame);
      obs.disconnect();
    };
  }, []);
  return open;
}

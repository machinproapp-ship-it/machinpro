import { supabase } from "@/lib/supabase";
import { nextMachinProInvoiceNumber, peekMachinProInvoiceNumber } from "@/lib/generateInvoicePdf";

/**
 * Numeración de facturas correlativa por empresa y año, llevada por Supabase
 * (`next_invoice_number` / `peek_invoice_number`). Así dos dispositivos nunca emiten
 * el mismo número y la cuenta no se pierde al borrar el navegador.
 */

export class InvoiceNumberUnavailableError extends Error {
  constructor(message = "invoice_number_needs_connection") {
    super(message);
    this.name = "InvoiceNumberUnavailableError";
  }
}

type RpcError = { code?: string; message?: string } | null;

/** La función aún no existe en la base de datos (migración sin aplicar). */
function isMissingFunction(err: RpcError): boolean {
  if (!err) return false;
  return err.code === "PGRST202" || err.code === "42883" || /could not find the function/i.test(err.message ?? "");
}

function localLastNumber(companyId: string, year: number): number {
  try {
    return parseInt(localStorage.getItem(`machinpro_invoice_seq_${companyId}_${year}`) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function rememberLocal(companyId: string, number: string) {
  const m = /^INV-(\d{4})-(\d+)$/.exec(number);
  if (!m) return;
  const year = Number(m[1]);
  const seq = Number(m[2]);
  if (seq > localLastNumber(companyId, year)) {
    try {
      localStorage.setItem(`machinpro_invoice_seq_${companyId}_${year}`, String(seq));
    } catch {
      /* ignore */
    }
  }
}

/** Próximo número sin reservarlo (solo para mostrarlo). `null` si no se puede saber. */
export async function peekInvoiceNumber(companyId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("peek_invoice_number", {});
  if (!error && typeof data === "string" && data) {
    // Si este dispositivo ya había usado números más altos antes del cambio, se respetan.
    const m = /^INV-(\d{4})-(\d+)$/.exec(data);
    if (m) {
      const local = localLastNumber(companyId, Number(m[1]));
      if (local + 1 > Number(m[2])) return `INV-${m[1]}-${String(local + 1).padStart(4, "0")}`;
    }
    return data;
  }
  if (isMissingFunction(error)) return peekMachinProInvoiceNumber(companyId);
  return null;
}

export type InvoiceIssueMeta = {
  source: "project_costs" | "production_payroll";
  projectId?: string | null;
  clientName?: string | null;
  total?: number | null;
  currency?: string | null;
};

/**
 * Reserva el siguiente número en la base de datos y lo deja anotado en el registro de facturas.
 * Sin conexión no se emite: un número inventado en el dispositivo podría repetirse.
 */
export async function reserveInvoiceNumber(companyId: string, meta: InvoiceIssueMeta): Promise<string> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new InvoiceNumberUnavailableError();
  }
  const year = new Date().getFullYear();
  const { data, error } = await supabase.rpc("next_invoice_number", {
    p_year: year,
    p_min_next: localLastNumber(companyId, year) + 1,
    p_source: meta.source,
    p_project_id: meta.projectId ?? null,
    p_client_name: meta.clientName ?? null,
    p_total: meta.total != null && Number.isFinite(meta.total) ? Math.round(meta.total * 100) / 100 : null,
    p_currency: meta.currency ?? null,
  });
  if (!error && typeof data === "string" && data) {
    rememberLocal(companyId, data);
    return data;
  }
  // Solo mientras la migración no esté aplicada: se mantiene el comportamiento anterior.
  if (isMissingFunction(error)) return nextMachinProInvoiceNumber(companyId);
  if (error && /forbidden/i.test(error.message ?? "")) throw new Error(error.message);
  throw new InvoiceNumberUnavailableError();
}

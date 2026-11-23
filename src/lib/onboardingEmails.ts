import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { REVISION_I18N } from "@/locales/revisionI18n";
import { helpGuideHref } from "@/lib/helpGuides";
import { insertNotificationRow } from "@/lib/notifications-server";
import {
  MACHINPRO_EMAIL_ORIGIN,
  ctaButton,
  emailCardFramed,
  emailOuterTable,
  fillHtml,
  fillPlain,
  standardFooterLine,
} from "@/lib/transactionalEmailHtml";
import { escapeHtml } from "@/lib/invitationEmailHtml";

/**
 * Correos de bienvenida con guías, a los 2 y a los 5 días del alta de la empresa.
 * Van al admin de la empresa, en el idioma de la empresa, y se envían una sola vez
 * (queda una notificación en la app como registro).
 */

type Lang = "es" | "en" | "fr" | "de" | "it" | "pt";
const LANGS: Lang[] = ["es", "en", "fr", "de", "it", "pt"];
const DEMO_COMPANY_ID = "a0000001-0000-4000-8000-000000000001";

type Kind = "day2" | "day5";
const STEPS: { kind: Kind; minDays: number; maxDays: number; guides: string[] }[] = [
  { kind: "day2", minDays: 2, maxDays: 4, guides: ["guide_roles", "guide_clock", "guide_shifts"] },
  { kind: "day5", minDays: 5, maxDays: 8, guides: ["guide_daily", "guide_requests", "guide_tools"] },
];

type Copy = { subject: string; title: string; lead: string; cta: string; closing: string };
const COPY: Record<Lang, Record<Kind, Copy> & { allGuides: string }> = {
  es: {
    day2: {
      subject: "Pon a tu equipo en marcha con MachinPro",
      title: "Hola {name}, ¿empezamos con tu equipo?",
      lead: "Estas tres guías cortas te ayudan a tener a tu gente fichando y organizada en {company}:",
      cta: "Entrar a MachinPro",
      closing: "¿Alguna duda? Responde a este correo y te ayudamos.",
    },
    day5: {
      subject: "Lleva la obra al día con MachinPro",
      title: "Hola {name}, ahora la obra",
      lead: "Con estas guías, {company} tendrá el parte diario, los pedidos y las herramientas bajo control:",
      cta: "Entrar a MachinPro",
      closing: "¿Alguna duda? Responde a este correo y te ayudamos.",
    },
    allGuides: "Ver todas las guías",
  },
  en: {
    day2: {
      subject: "Get your team started with MachinPro",
      title: "Hi {name}, shall we start with your team?",
      lead: "These three short guides help you get your people clocking in and organized at {company}:",
      cta: "Open MachinPro",
      closing: "Any questions? Just reply to this email and we'll help.",
    },
    day5: {
      subject: "Keep your sites up to date with MachinPro",
      title: "Hi {name}, now the job site",
      lead: "With these guides, {company} will have daily reports, site orders and tools under control:",
      cta: "Open MachinPro",
      closing: "Any questions? Just reply to this email and we'll help.",
    },
    allGuides: "See all guides",
  },
  fr: {
    day2: {
      subject: "Lancez votre équipe avec MachinPro",
      title: "Bonjour {name}, on commence par votre équipe ?",
      lead: "Ces trois guides courts vous aident à faire pointer et organiser vos équipes chez {company} :",
      cta: "Ouvrir MachinPro",
      closing: "Une question ? Répondez simplement à cet e-mail, nous vous aiderons.",
    },
    day5: {
      subject: "Gardez vos chantiers à jour avec MachinPro",
      title: "Bonjour {name}, place au chantier",
      lead: "Avec ces guides, {company} aura les rapports journaliers, les commandes et les outils sous contrôle :",
      cta: "Ouvrir MachinPro",
      closing: "Une question ? Répondez simplement à cet e-mail, nous vous aiderons.",
    },
    allGuides: "Voir tous les guides",
  },
  de: {
    day2: {
      subject: "Bringen Sie Ihr Team mit MachinPro an den Start",
      title: "Hallo {name}, starten wir mit Ihrem Team?",
      lead: "Diese drei kurzen Anleitungen helfen Ihnen, Ihre Leute bei {company} stempeln zu lassen und zu organisieren:",
      cta: "MachinPro öffnen",
      closing: "Fragen? Antworten Sie einfach auf diese E-Mail, wir helfen Ihnen.",
    },
    day5: {
      subject: "Halten Sie Ihre Baustellen mit MachinPro aktuell",
      title: "Hallo {name}, jetzt die Baustelle",
      lead: "Mit diesen Anleitungen hat {company} Tagesberichte, Bestellungen und Werkzeuge im Griff:",
      cta: "MachinPro öffnen",
      closing: "Fragen? Antworten Sie einfach auf diese E-Mail, wir helfen Ihnen.",
    },
    allGuides: "Alle Anleitungen ansehen",
  },
  it: {
    day2: {
      subject: "Fai partire il tuo team con MachinPro",
      title: "Ciao {name}, iniziamo dal tuo team?",
      lead: "Queste tre guide brevi ti aiutano a far timbrare e organizzare il personale di {company}:",
      cta: "Apri MachinPro",
      closing: "Dubbi? Rispondi a questa email e ti aiutiamo.",
    },
    day5: {
      subject: "Tieni i cantieri aggiornati con MachinPro",
      title: "Ciao {name}, ora il cantiere",
      lead: "Con queste guide, {company} avrà giornali di cantiere, richieste e attrezzi sotto controllo:",
      cta: "Apri MachinPro",
      closing: "Dubbi? Rispondi a questa email e ti aiutiamo.",
    },
    allGuides: "Vedi tutte le guide",
  },
  pt: {
    day2: {
      subject: "Ponha a sua equipa a funcionar com a MachinPro",
      title: "Olá {name}, começamos pela sua equipa?",
      lead: "Estes três guias curtos ajudam a pôr a sua equipa da {company} a registar o ponto e organizada:",
      cta: "Abrir a MachinPro",
      closing: "Alguma dúvida? Responda a este e-mail e ajudamos.",
    },
    day5: {
      subject: "Mantenha as obras em dia com a MachinPro",
      title: "Olá {name}, agora a obra",
      lead: "Com estes guias, a {company} terá relatórios diários, pedidos e ferramentas sob controlo:",
      cta: "Abrir a MachinPro",
      closing: "Alguma dúvida? Responda a este e-mail e ajudamos.",
    },
    allGuides: "Ver todos os guias",
  },
};

function asLang(code: string | null | undefined): Lang {
  const c = (code ?? "").toLowerCase().slice(0, 2);
  return (LANGS as string[]).includes(c) ? (c as Lang) : "en";
}

export function buildOnboardingEmail(opts: {
  kind: Kind;
  lang: Lang;
  userName: string;
  companyName: string;
}): { subject: string; html: string } {
  const step = STEPS.find((s) => s.kind === opts.kind)!;
  const c = COPY[opts.lang][opts.kind];
  const dict = REVISION_I18N[opts.lang] as Record<string, string>;
  const vars = { name: opts.userName.trim() || "👋", company: opts.companyName.trim() || "MachinPro" };
  const items = step.guides
    .map((g) => {
      const href = helpGuideHref(opts.lang, g, MACHINPRO_EMAIL_ORIGIN);
      const title = dict[`${g}_title`] ?? g;
      const intro = dict[`${g}_intro`] ?? "";
      return `<li style="margin-bottom:12px;"><a href="${escapeHtml(href)}" style="color:#ea580c;font-weight:600;text-decoration:underline;">${escapeHtml(title)}</a><br /><span style="color:#64748b;font-size:14px;">${escapeHtml(intro)}</span></li>`;
    })
    .join("");
  const inner = `
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.35;font-weight:700;color:#0f172a;text-align:center;">${fillHtml(c.title, vars)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${fillHtml(c.lead, vars)}</p>
<ol style="margin:0 0 8px;padding-left:22px;color:#334155;font-size:15px;line-height:1.55;">${items}</ol>
<p style="margin:0 0 4px;font-size:14px;"><a href="${escapeHtml(`${MACHINPRO_EMAIL_ORIGIN}/help?lang=${opts.lang}`)}" style="color:#64748b;text-decoration:underline;">${escapeHtml(COPY[opts.lang].allGuides)}</a></p>
${ctaButton(`${MACHINPRO_EMAIL_ORIGIN}/`, c.cta)}
<p style="margin:0;font-size:14px;line-height:1.5;color:#334155;text-align:center;">${escapeHtml(c.closing)}</p>
${standardFooterLine(vars.company)}
`.trim();
  return { subject: fillPlain(c.subject, vars), html: emailOuterTable(emailCardFramed(inner)) };
}

async function alreadySent(admin: SupabaseClient, companyId: string, userId: string, kind: Kind): Promise<boolean> {
  const { data, error } = await admin
    .from("notifications")
    .select("id")
    .eq("company_id", companyId)
    .eq("user_id", userId)
    .eq("type", "onboarding_guides")
    .filter("data->>dedupe", "eq", kind)
    .limit(1);
  if (error) return true; // ante la duda, no repetir
  return (data?.length ?? 0) > 0;
}

export async function runOnboardingEmailsForCompany(
  admin: SupabaseClient,
  companyId: string
): Promise<{ created: number; skipped: string[] }> {
  const skipped: string[] = [];
  if (companyId === DEMO_COMPANY_ID) return { created: 0, skipped: ["demo"] };
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { created: 0, skipped: ["no_resend"] };

  const { data: comp } = await admin
    .from("companies")
    .select("name, language, created_at")
    .eq("id", companyId)
    .maybeSingle();
  const row = comp as { name?: string | null; language?: string | null; created_at?: string | null } | null;
  if (!row?.created_at) return { created: 0, skipped: ["no_company"] };
  const ageDays = Math.floor((Date.now() - new Date(row.created_at).getTime()) / 86_400_000);
  const step = STEPS.find((s) => ageDays >= s.minDays && ageDays <= s.maxDays);
  if (!step) return { created: 0, skipped };

  const { data: admins } = await admin
    .from("user_profiles")
    .select("id, email, full_name, locale")
    .eq("company_id", companyId)
    .eq("role", "admin")
    .is("deleted_at", null);
  const resend = new Resend(resendKey);
  const from = process.env.RESEND_FROM_EMAIL ?? "MachinPro <noreply@machin.pro>";
  let created = 0;
  for (const a of (admins ?? []) as { id: string; email?: string | null; full_name?: string | null; locale?: string | null }[]) {
    const email = typeof a.email === "string" && a.email.includes("@") ? a.email.trim() : null;
    if (!email) continue;
    if (await alreadySent(admin, companyId, a.id, step.kind)) continue;
    const lang = asLang(a.locale || row.language);
    const { subject, html } = buildOnboardingEmail({
      kind: step.kind,
      lang,
      userName: (a.full_name ?? "").split(" ")[0] ?? "",
      companyName: row.name ?? "",
    });
    // Primero el registro (así nunca se envía dos veces aunque el correo tarde).
    const ins = await insertNotificationRow(admin, {
      company_id: companyId,
      user_id: a.id,
      type: "onboarding_guides",
      title: subject,
      body: COPY[lang][step.kind].lead.replace("{company}", row.name ?? ""),
      data: { dedupe: step.kind, url: `/help?lang=${lang}` },
    });
    if (!ins.ok) {
      skipped.push(`notif:${a.id}`);
      continue;
    }
    try {
      await resend.emails.send({ from, to: email, replyTo: "support@machin.pro", subject, html });
      created++;
    } catch (e) {
      console.error("[onboarding-emails]", e);
      skipped.push(`mail:${a.id}`);
    }
  }
  return { created, skipped };
}

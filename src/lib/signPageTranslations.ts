// Traducciones para la página pública de firma (/sign/[token]).
// Detectamos idioma por query ?lang=, localStorage machinpro_language o navigator.language.

export type SignPageLocale = "es" | "en" | "fr" | "de" | "it" | "pt";

export interface SignPageTranslations {
  loading: string;
  linkExpired: string;
  back: string;
  fullName: string;
  companyRequired: string;
  companyOptional: string;
  companyRequiredError: string;
  signingAs: string;
  supervisor: string;
  orientationLabel: string;
  yes: string;
  na: string;
  signature: string;
  clear: string;
  signButtonIdle: string;
  signButtonLoading: string;
  signButtonSuccess: string;
  signButtonError: string;
  signatureConfirmed: string;
  project: string;
  date: string;
  signAndAttendance: string;
}

const SIGN_PAGE_TRANSLATIONS: Record<SignPageLocale, SignPageTranslations> = {
  es: {
    loading: "Cargando...",
    linkExpired: "Enlace no encontrado o expirado.",
    back: "Volver",
    fullName: "Nombre completo",
    companyRequired: "Empresa (obligatorio)",
    companyOptional: "Empresa (opcional)",
    companyRequiredError: "El campo Empresa es obligatorio para visitantes externos",
    signingAs: "Firmando como",
    supervisor: "Supervisor",
    orientationLabel: "Orientación dada (externos)",
    yes: "Sí",
    na: "N/A",
    signature: "Firma",
    clear: "Limpiar",
    signButtonIdle: "Firmar y confirmar asistencia",
    signButtonLoading: "Enviando...",
    signButtonSuccess: "✓ Firma registrada",
    signButtonError: "Error — intentar de nuevo",
    signatureConfirmed: "✓ Firma registrada — Gracias",
    project: "Proyecto",
    date: "Fecha",
    signAndAttendance: "Firma y asistencia",
  },
  en: {
    loading: "Loading...",
    linkExpired: "Link not found or expired.",
    back: "Back",
    fullName: "Full name",
    companyRequired: "Company (required)",
    companyOptional: "Company (optional)",
    companyRequiredError: "Company field is required for external visitors",
    signingAs: "Signing as",
    supervisor: "Supervisor",
    orientationLabel: "Orientation given (external)",
    yes: "Yes",
    na: "N/A",
    signature: "Signature",
    clear: "Clear",
    signButtonIdle: "Sign and confirm attendance",
    signButtonLoading: "Sending...",
    signButtonSuccess: "✓ Signature recorded",
    signButtonError: "Error — try again",
    signatureConfirmed: "✓ Signature recorded — Thank you",
    project: "Project",
    date: "Date",
    signAndAttendance: "Signature and attendance",
  },
  fr: {
    loading: "Chargement...",
    linkExpired: "Lien introuvable ou expiré.",
    back: "Retour",
    fullName: "Nom complet",
    companyRequired: "Entreprise (obligatoire)",
    companyOptional: "Entreprise (optionnel)",
    companyRequiredError: "Le champ Entreprise est obligatoire pour les visiteurs externes",
    signingAs: "Signature en tant que",
    supervisor: "Superviseur",
    orientationLabel: "Orientation donnée (externes)",
    yes: "Oui",
    na: "N/A",
    signature: "Signature",
    clear: "Effacer",
    signButtonIdle: "Signer et confirmer la présence",
    signButtonLoading: "Envoi en cours...",
    signButtonSuccess: "✓ Signature enregistrée",
    signButtonError: "Erreur — réessayer",
    signatureConfirmed: "✓ Signature enregistrée — Merci",
    project: "Projet",
    date: "Date",
    signAndAttendance: "Signature et présence",
  },
  de: {
    loading: "Laden...",
    linkExpired: "Link nicht gefunden oder abgelaufen.",
    back: "Zurück",
    fullName: "Vollständiger Name",
    companyRequired: "Unternehmen (erforderlich)",
    companyOptional: "Unternehmen (optional)",
    companyRequiredError: "Das Feld Unternehmen ist für externe Besucher erforderlich",
    signingAs: "Unterzeichnen als",
    supervisor: "Vorgesetzter",
    orientationLabel: "Orientierung gegeben (externe)",
    yes: "Ja",
    na: "N/A",
    signature: "Unterschrift",
    clear: "Löschen",
    signButtonIdle: "Unterschreiben und Anwesenheit bestätigen",
    signButtonLoading: "Wird gesendet...",
    signButtonSuccess: "✓ Unterschrift erfasst",
    signButtonError: "Fehler — erneut versuchen",
    signatureConfirmed: "✓ Unterschrift erfasst — Danke",
    project: "Projekt",
    date: "Datum",
    signAndAttendance: "Unterschrift und Anwesenheit",
  },
  it: {
    loading: "Caricamento...",
    linkExpired: "Link non trovato o scaduto.",
    back: "Indietro",
    fullName: "Nome completo",
    companyRequired: "Azienda (obbligatorio)",
    companyOptional: "Azienda (opzionale)",
    companyRequiredError: "Il campo Azienda è obbligatorio per i visitatori esterni",
    signingAs: "Firma come",
    supervisor: "Supervisore",
    orientationLabel: "Orientamento fornito (esterni)",
    yes: "Sì",
    na: "N/A",
    signature: "Firma",
    clear: "Cancella",
    signButtonIdle: "Firmare e confermare presenza",
    signButtonLoading: "Invio in corso...",
    signButtonSuccess: "✓ Firma registrata",
    signButtonError: "Errore — riprova",
    signatureConfirmed: "✓ Firma registrata — Grazie",
    project: "Progetto",
    date: "Data",
    signAndAttendance: "Firma e presenza",
  },
  pt: {
    loading: "A carregar...",
    linkExpired: "Ligação não encontrada ou expirada.",
    back: "Voltar",
    fullName: "Nome completo",
    companyRequired: "Empresa (obrigatório)",
    companyOptional: "Empresa (opcional)",
    companyRequiredError: "O campo Empresa é obrigatório para visitantes externos",
    signingAs: "Assinando como",
    supervisor: "Supervisor",
    orientationLabel: "Orientação dada (externos)",
    yes: "Sim",
    na: "N/A",
    signature: "Assinatura",
    clear: "Limpar",
    signButtonIdle: "Assinar e confirmar presença",
    signButtonLoading: "A enviar...",
    signButtonSuccess: "✓ Assinatura registada",
    signButtonError: "Erro — tentar novamente",
    signatureConfirmed: "✓ Assinatura registada — Obrigado",
    project: "Projeto",
    date: "Data",
    signAndAttendance: "Assinatura e presença",
  },
};

const LOCALE_MAP: Record<string, SignPageLocale> = {
  es: "es",
  en: "en",
  fr: "fr",
  de: "de",
  it: "it",
  pt: "pt",
};

export function getSignPageLocale(): SignPageLocale {
  if (typeof window === "undefined") return "es";
  const params = new URLSearchParams(window.location.search);
  const langParam = params.get("lang")?.toLowerCase().slice(0, 2);
  if (langParam && LOCALE_MAP[langParam]) return LOCALE_MAP[langParam];
  try {
    const stored = localStorage.getItem("machinpro_language");
    if (stored && LOCALE_MAP[stored]) return LOCALE_MAP[stored];
  } catch {}
  const nav = navigator.language?.toLowerCase().slice(0, 2);
  return LOCALE_MAP[nav ?? ""] ?? "es";
}

export function getSignPageTranslations(locale: SignPageLocale): SignPageTranslations {
  return SIGN_PAGE_TRANSLATIONS[locale];
}

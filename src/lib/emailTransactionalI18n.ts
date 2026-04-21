/** Strings for transactional emails (welcome + employee invite). es/en/fr/de/it/pt. */

export type TransactionalEmailLang = "es" | "en" | "fr" | "de" | "it" | "pt";

export type TransactionalEmailCopy = {
  welcomeEmailSubject: string;
  welcomeTitle: string;
  welcomeSubtitle: string;
  welcomeWarm: string;
  welcomeStepsIntro: string;
  welcomeStep1: string;
  welcomeStep1Hint: string;
  welcomeStep2: string;
  welcomeStep2Hint: string;
  welcomeStep3: string;
  welcomeStep3Hint: string;
  welcomeCta: string;
  welcomeTrialReminder: string;
  welcomeHelp: string;
  welcomeAddressLine: string;
  welcomePrivacy: string;
  welcomeTerms: string;
  employeeInviteSubject: string;
  employeeInviteTitle: string;
  employeeInviteLead: string;
  employeeInviteCta: string;
  employeeInviteExpiry: string;
  employeeHelp: string;
  employeeFooterLine: string;
};

const COPY: Record<TransactionalEmailLang, TransactionalEmailCopy> = {
  es: {
    welcomeEmailSubject: "Bienvenido a MachinPro, {name}",
    welcomeTitle: "Bienvenido a MachinPro, {name}",
    welcomeSubtitle: "Tu cuenta está lista. Empieza a gestionar tu empresa.",
    welcomeWarm:
      "Gracias por unirte a MachinPro. Ya puedes organizar equipos, proyectos y seguridad desde un solo lugar. La cuenta de tu empresa ({company}) está activa.",
    welcomeStepsIntro: "Tus primeros pasos",
    welcomeStep1: "Configura tu empresa",
    welcomeStep1Hint: "En la app: Ajustes → Empresa",
    welcomeStep2: "Invita a tu equipo",
    welcomeStep2Hint: "En la app: Empleados",
    welcomeStep3: "Crea tu primer proyecto",
    welcomeStep3Hint: "En la app: Proyectos",
    welcomeCta: "Entrar a MachinPro",
    welcomeTrialReminder: "Tienes 14 días de prueba gratuita.",
    welcomeHelp: "¿Necesitas ayuda? Escríbenos a support@machin.pro",
    welcomeAddressLine: "MachinPro · Canariense Inc · Ottawa, Ontario, Canadá",
    welcomePrivacy: "Política de privacidad",
    welcomeTerms: "Términos de uso",
    employeeInviteSubject: "Te han invitado a unirte a {company} en MachinPro",
    employeeInviteTitle: "Te han invitado a unirte a {company} en MachinPro",
    employeeInviteLead: "{admin} te ha invitado a gestionar {company} en MachinPro.",
    employeeInviteCta: "Aceptar invitación",
    employeeInviteExpiry: "Este enlace expira en 7 días.",
    employeeHelp: "¿Necesitas ayuda? Escríbenos a support@machin.pro",
    employeeFooterLine: "MachinPro · {company}",
  },
  en: {
    welcomeEmailSubject: "Welcome to MachinPro — Let's get started",
    welcomeTitle: "Hi {name}, your company {company} is ready!",
    welcomeSubtitle: "Here are three steps we recommend to get your team productive.",
    welcomeWarm:
      "You're set up on MachinPro — manage people, sites, schedules, logistics, and safety from any device.",
    welcomeStepsIntro: "Recommended first steps",
    welcomeStep1: "Invite your first teammate",
    welcomeStep1Hint: "Central → Employees",
    welcomeStep2: "Create your first project",
    welcomeStep2Hint: "Operations → Projects",
    welcomeStep3: "Complete compliance setup",
    welcomeStep3Hint: "Settings → Compliance",
    welcomeCta: "Open dashboard",
    welcomeTrialReminder: "You have a 14-day free trial.",
    welcomeHelp: "Need help? Email us at support@machin.pro",
    welcomeAddressLine: "MachinPro · Canariense Inc · Ottawa, Ontario, Canada",
    welcomePrivacy: "Privacy policy",
    welcomeTerms: "Terms of use",
    employeeInviteSubject: "You've been invited to join {company} on MachinPro",
    employeeInviteTitle: "You've been invited to join {company} on MachinPro",
    employeeInviteLead: "{admin} has invited you to work with {company} on MachinPro.",
    employeeInviteCta: "Accept invitation",
    employeeInviteExpiry: "This link expires in 7 days.",
    employeeHelp: "Need help? Email us at support@machin.pro",
    employeeFooterLine: "MachinPro · Canariense Inc",
  },
  fr: {
    welcomeEmailSubject: "Bienvenue sur MachinPro, {name}",
    welcomeTitle: "Bienvenue sur MachinPro, {name}",
    welcomeSubtitle: "Votre compte est prêt. Commencez à gérer votre entreprise.",
    welcomeWarm:
      "Merci d'avoir choisi MachinPro. Vous pouvez gérer équipes, chantiers et sécurité au même endroit. L'espace de votre entreprise ({company}) est actif.",
    welcomeStepsIntro: "Vos premières étapes",
    welcomeStep1: "Configurez votre entreprise",
    welcomeStep1Hint: "Dans l'app : Réglages → Entreprise",
    welcomeStep2: "Invitez votre équipe",
    welcomeStep2Hint: "Dans l'app : Employés",
    welcomeStep3: "Créez votre premier projet",
    welcomeStep3Hint: "Dans l'app : Projets",
    welcomeCta: "Ouvrir MachinPro",
    welcomeTrialReminder: "Vous disposez de 14 jours d'essai gratuit.",
    welcomeHelp: "Besoin d'aide ? Écrivez-nous à support@machin.pro",
    welcomeAddressLine: "MachinPro · Canariense Inc · Ottawa, Ontario, Canada",
    welcomePrivacy: "Politique de confidentialité",
    welcomeTerms: "Conditions d'utilisation",
    employeeInviteSubject: "Invitation à rejoindre {company} sur MachinPro",
    employeeInviteTitle: "Vous êtes invité(e) à rejoindre {company} sur MachinPro",
    employeeInviteLead: "{admin} vous invite à rejoindre {company} sur MachinPro.",
    employeeInviteCta: "Accepter l'invitation",
    employeeInviteExpiry: "Ce lien expire dans 7 jours.",
    employeeHelp: "Besoin d'aide ? Écrivez-nous à support@machin.pro",
    employeeFooterLine: "MachinPro · {company}",
  },
  de: {
    welcomeEmailSubject: "Willkommen bei MachinPro, {name}",
    welcomeTitle: "Willkommen bei MachinPro, {name}",
    welcomeSubtitle: "Ihr Konto ist bereit. Starten Sie mit der Verwaltung Ihres Unternehmens.",
    welcomeWarm:
      "Danke, dass Sie MachinPro nutzen. Teams, Projekte und Sicherheit sind an einem Ort. Der Arbeitsbereich für {company} ist aktiv.",
    welcomeStepsIntro: "Ihre ersten Schritte",
    welcomeStep1: "Unternehmen einrichten",
    welcomeStep1Hint: "In der App: Einstellungen → Unternehmen",
    welcomeStep2: "Team einladen",
    welcomeStep2Hint: "In der App: Mitarbeitende",
    welcomeStep3: "Erstes Projekt anlegen",
    welcomeStep3Hint: "In der App: Projekte",
    welcomeCta: "Zu MachinPro anmelden",
    welcomeTrialReminder: "Sie haben 14 Tage kostenlose Testversion.",
    welcomeHelp: "Hilfe benötigt? Schreiben Sie an support@machin.pro",
    welcomeAddressLine: "MachinPro · Canariense Inc · Ottawa, Ontario, Kanada",
    welcomePrivacy: "Datenschutz",
    welcomeTerms: "Nutzungsbedingungen",
    employeeInviteSubject: "Einladung zu {company} bei MachinPro",
    employeeInviteTitle: "Sie sind eingeladen, {company} bei MachinPro beizutreten",
    employeeInviteLead: "{admin} hat Sie eingeladen, bei {company} in MachinPro mitzuarbeiten.",
    employeeInviteCta: "Einladung annehmen",
    employeeInviteExpiry: "Dieser Link läuft in 7 Tagen ab.",
    employeeHelp: "Hilfe benötigt? Schreiben Sie an support@machin.pro",
    employeeFooterLine: "MachinPro · {company}",
  },
  it: {
    welcomeEmailSubject: "Benvenuto su MachinPro, {name}",
    welcomeTitle: "Benvenuto su MachinPro, {name}",
    welcomeSubtitle: "Il tuo account è pronto. Inizia a gestire la tua azienda.",
    welcomeWarm:
      "Grazie per aver scelto MachinPro. Puoi gestire team, cantieri e sicurezza in un unico posto. Lo spazio per {company} è attivo.",
    welcomeStepsIntro: "I tuoi primi passi",
    welcomeStep1: "Configura la tua azienda",
    welcomeStep1Hint: "Nell'app: Impostazioni → Azienda",
    welcomeStep2: "Invita il team",
    welcomeStep2Hint: "Nell'app: Dipendenti",
    welcomeStep3: "Crea il primo progetto",
    welcomeStep3Hint: "Nell'app: Progetti",
    welcomeCta: "Accedi a MachinPro",
    welcomeTrialReminder: "Hai 14 giorni di prova gratuita.",
    welcomeHelp: "Serve aiuto? Scrivi a support@machin.pro",
    welcomeAddressLine: "MachinPro · Canariense Inc · Ottawa, Ontario, Canada",
    welcomePrivacy: "Privacy",
    welcomeTerms: "Termini di utilizzo",
    employeeInviteSubject: "Invito a unirti a {company} su MachinPro",
    employeeInviteTitle: "Sei stato invitato a unirti a {company} su MachinPro",
    employeeInviteLead: "{admin} ti ha invitato a lavorare con {company} su MachinPro.",
    employeeInviteCta: "Accetta l'invito",
    employeeInviteExpiry: "Questo link scade tra 7 giorni.",
    employeeHelp: "Serve aiuto? Scrivi a support@machin.pro",
    employeeFooterLine: "MachinPro · {company}",
  },
  pt: {
    welcomeEmailSubject: "Bem-vindo à MachinPro, {name}",
    welcomeTitle: "Bem-vindo à MachinPro, {name}",
    welcomeSubtitle: "A sua conta está pronta. Comece a gerir a sua empresa.",
    welcomeWarm:
      "Obrigado por aderir à MachinPro. Pode gerir equipas, projetos e segurança num só lugar. O espaço da empresa ({company}) está ativo.",
    welcomeStepsIntro: "Os seus primeiros passos",
    welcomeStep1: "Configure a sua empresa",
    welcomeStep1Hint: "Na app: Definições → Empresa",
    welcomeStep2: "Convide a sua equipa",
    welcomeStep2Hint: "Na app: Colaboradores",
    welcomeStep3: "Crie o primeiro projeto",
    welcomeStep3Hint: "Na app: Projetos",
    welcomeCta: "Entrar na MachinPro",
    welcomeTrialReminder: "Tem 14 dias de teste gratuito.",
    welcomeHelp: "Precisa de ajuda? Escreva para support@machin.pro",
    welcomeAddressLine: "MachinPro · Canariense Inc · Ottawa, Ontario, Canadá",
    welcomePrivacy: "Política de privacidade",
    welcomeTerms: "Termos de utilização",
    employeeInviteSubject: "Foi convidado a juntar-se a {company} na MachinPro",
    employeeInviteTitle: "Foi convidado a juntar-se a {company} na MachinPro",
    employeeInviteLead: "{admin} convidou-o a trabalhar com {company} na MachinPro.",
    employeeInviteCta: "Aceitar convite",
    employeeInviteExpiry: "Esta ligação expira em 7 dias.",
    employeeHelp: "Precisa de ajuda? Escreva para support@machin.pro",
    employeeFooterLine: "MachinPro · {company}",
  },
};

export function transactionalEmailLangFromCode(code: string | null | undefined): TransactionalEmailLang {
  const raw = (code ?? "en").toLowerCase().trim();
  const first = raw.split(",")[0]?.trim() ?? "en";
  const base = first.split("-")[0]?.slice(0, 2) ?? "en";
  const c = base.length >= 2 ? base : "";
  if (c === "es" || c === "en" || c === "fr" || c === "de" || c === "it" || c === "pt") return c;
  return "en";
}

export function getTransactionalCopy(lang: TransactionalEmailLang): TransactionalEmailCopy {
  return COPY[lang];
}

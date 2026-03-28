/** Strings for transactional emails (welcome + employee invite). Keep in sync with locale keys where noted. */

export type TransactionalEmailLang = "es" | "en" | "fr" | "de" | "it" | "pt";

export type TransactionalEmailCopy = {
  /** Same intent as locale `emailWelcomeSubject` */
  welcomeBrand: string;
  welcomeTagline: string;
  welcomeGreeting: string;
  welcomeAccountLine: string;
  welcomeSummaryIntro: string;
  welcomeBulletEmployees: string;
  welcomeBulletProjects: string;
  welcomeBulletSchedules: string;
  welcomeCta: string;
  /** Same intent as locale `emailTrialReminder` */
  welcomeTrialReminder: string;
  welcomeFooter: string;
  employeeInviteSubject: string;
  employeeInviteAdded: string;
  employeeInviteBlurb: string;
  employeeInviteCta: string;
  employeeFooter: string;
};

const COPY: Record<TransactionalEmailLang, TransactionalEmailCopy> = {
  es: {
    welcomeBrand: "Bienvenido a MachinPro",
    welcomeTagline: "Tu cuenta está lista",
    welcomeGreeting: "Hola, {name}",
    welcomeAccountLine: "Tu cuenta de {company} está lista.",
    welcomeSummaryIntro: "Ya puedes:",
    welcomeBulletEmployees: "Añadir empleados",
    welcomeBulletProjects: "Crear proyectos",
    welcomeBulletSchedules: "Gestionar horarios",
    welcomeCta: "Ir a MachinPro",
    welcomeTrialReminder: "Tienes 14 días de prueba gratuita.",
    welcomeFooter: "MachinPro · Canariense Inc",
    employeeInviteSubject: "Te han invitado a unirte a {company} en MachinPro",
    employeeInviteAdded: "{admin} te ha añadido al equipo de {company}.",
    employeeInviteBlurb:
      "MachinPro es la plataforma donde verás tu horario, parte diario y podrás fichar tu entrada.",
    employeeInviteCta: "Activar mi cuenta",
    employeeFooter: "MachinPro",
  },
  en: {
    welcomeBrand: "Welcome to MachinPro",
    welcomeTagline: "Your account is ready",
    welcomeGreeting: "Hello, {name}",
    welcomeAccountLine: "Your {company} account is ready.",
    welcomeSummaryIntro: "You can now:",
    welcomeBulletEmployees: "Add employees",
    welcomeBulletProjects: "Create projects",
    welcomeBulletSchedules: "Manage schedules",
    welcomeCta: "Go to MachinPro",
    welcomeTrialReminder: "You have a 14-day free trial.",
    welcomeFooter: "MachinPro · Canariense Inc",
    employeeInviteSubject: "You have been invited to join {company} on MachinPro",
    employeeInviteAdded: "{admin} has added you to the {company} team.",
    employeeInviteBlurb:
      "MachinPro is the platform where you will see your schedule, daily reports, and clock in.",
    employeeInviteCta: "Activate my account",
    employeeFooter: "MachinPro",
  },
  fr: {
    welcomeBrand: "Bienvenue sur MachinPro",
    welcomeTagline: "Votre compte est prêt",
    welcomeGreeting: "Bonjour, {name}",
    welcomeAccountLine: "Le compte de {company} est prêt.",
    welcomeSummaryIntro: "Vous pouvez désormais :",
    welcomeBulletEmployees: "Ajouter des employés",
    welcomeBulletProjects: "Créer des projets",
    welcomeBulletSchedules: "Gérer les horaires",
    welcomeCta: "Aller sur MachinPro",
    welcomeTrialReminder: "Vous avez 14 jours d'essai gratuit.",
    welcomeFooter: "MachinPro · Canariense Inc",
    employeeInviteSubject: "Vous êtes invité(e) à rejoindre {company} sur MachinPro",
    employeeInviteAdded: "{admin} vous a ajouté(e) à l'équipe de {company}.",
    employeeInviteBlurb:
      "MachinPro est la plate-forme où vous consultez vos horaires, vos rapports quotidiens et pouvez pointer.",
    employeeInviteCta: "Activer mon compte",
    employeeFooter: "MachinPro",
  },
  de: {
    welcomeBrand: "Willkommen bei MachinPro",
    welcomeTagline: "Ihr Konto ist bereit",
    welcomeGreeting: "Hallo, {name}",
    welcomeAccountLine: "Das Konto von {company} ist bereit.",
    welcomeSummaryIntro: "Sie können jetzt:",
    welcomeBulletEmployees: "Mitarbeitende hinzufügen",
    welcomeBulletProjects: "Projekte anlegen",
    welcomeBulletSchedules: "Schichtpläne verwalten",
    welcomeCta: "Zu MachinPro",
    welcomeTrialReminder: "Sie haben 14 Tage kostenlose Testversion.",
    welcomeFooter: "MachinPro · Canariense Inc",
    employeeInviteSubject: "Sie sind eingeladen, {company} bei MachinPro beizutreten",
    employeeInviteAdded: "{admin} hat Sie zum Team von {company} hinzugefügt.",
    employeeInviteBlurb:
      "MachinPro ist die Plattform für Ihre Schichtpläne, Tagesberichte und zum Einstempeln.",
    employeeInviteCta: "Konto aktivieren",
    employeeFooter: "MachinPro",
  },
  it: {
    welcomeBrand: "Benvenuto su MachinPro",
    welcomeTagline: "Il tuo account è pronto",
    welcomeGreeting: "Ciao, {name}",
    welcomeAccountLine: "L'account di {company} è pronto.",
    welcomeSummaryIntro: "Ora puoi:",
    welcomeBulletEmployees: "Aggiungere dipendenti",
    welcomeBulletProjects: "Creare progetti",
    welcomeBulletSchedules: "Gestire gli orari",
    welcomeCta: "Vai a MachinPro",
    welcomeTrialReminder: "Hai 14 giorni di prova gratuita.",
    welcomeFooter: "MachinPro · Canariense Inc",
    employeeInviteSubject: "Sei stato invitato a unirti a {company} su MachinPro",
    employeeInviteAdded: "{admin} ti ha aggiunto al team di {company}.",
    employeeInviteBlurb:
      "MachinPro è la piattaforma dove vedi gli orari, il parte giornaliero e timbri l'ingresso.",
    employeeInviteCta: "Attiva il mio account",
    employeeFooter: "MachinPro",
  },
  pt: {
    welcomeBrand: "Bem-vindo ao MachinPro",
    welcomeTagline: "A sua conta está pronta",
    welcomeGreeting: "Olá, {name}",
    welcomeAccountLine: "A conta de {company} está pronta.",
    welcomeSummaryIntro: "Já pode:",
    welcomeBulletEmployees: "Adicionar colaboradores",
    welcomeBulletProjects: "Criar projetos",
    welcomeBulletSchedules: "Gerir horários",
    welcomeCta: "Ir para o MachinPro",
    welcomeTrialReminder: "Tem 14 dias de teste gratuito.",
    welcomeFooter: "MachinPro · Canariense Inc",
    employeeInviteSubject: "Foi convidado a juntar-se a {company} na MachinPro",
    employeeInviteAdded: "{admin} adicionou-o à equipa de {company}.",
    employeeInviteBlurb:
      "MachinPro é a plataforma onde vê o horário, o relatório diário e regista a entrada.",
    employeeInviteCta: "Ativar a minha conta",
    employeeFooter: "MachinPro",
  },
};

export function transactionalEmailLangFromCode(code: string | null | undefined): TransactionalEmailLang {
  const c = (code ?? "en").toLowerCase().trim().slice(0, 2);
  if (c === "es" || c === "en" || c === "fr" || c === "de" || c === "it" || c === "pt") return c;
  return "en";
}

export function getTransactionalCopy(lang: TransactionalEmailLang): TransactionalEmailCopy {
  return COPY[lang];
}

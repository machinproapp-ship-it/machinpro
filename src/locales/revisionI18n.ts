/**
 * Textos que salían en inglés o mal etiquetados (revisión de módulos, octubre 2026).
 * Se fusionan en i18n (6 idiomas base); los 15 idiomas extendidos heredan el inglés.
 */
type Dict = Record<string, string>;

const ROWS: [string, string, string, string, string, string, string][] = [
  // clave, es, en, fr, de, it, pt
  ["vacation_absence_type", "Tipo de ausencia", "Absence type", "Type d'absence", "Art der Abwesenheit", "Tipo di assenza", "Tipo de ausência"],
  ["vacation_type_vacation", "Vacaciones", "Vacation", "Congés", "Urlaub", "Ferie", "Férias"],
  ["vacation_type_sick", "Baja por enfermedad", "Sick leave", "Arrêt maladie", "Krankheit", "Malattia", "Baixa por doença"],
  ["vacation_type_permission", "Permiso", "Leave", "Absence autorisée", "Freistellung", "Permesso", "Licença"],
  ["vacation_type_training", "Formación", "Training", "Formation", "Schulung", "Formazione", "Formação"],
  ["vacation_type_other", "Otro", "Other", "Autre", "Sonstiges", "Altro", "Outro"],
  ["vacation_team_calendar", "Calendario de ausencias del equipo", "Team absence calendar", "Calendrier des absences de l'équipe", "Abwesenheitskalender des Teams", "Calendario assenze del team", "Calendário de ausências da equipa"],
  ["vacation_business_days", "Días laborables", "Business days", "Jours ouvrés", "Arbeitstage", "Giorni lavorativi", "Dias úteis"],
  ["vacation_start_date", "Fecha de inicio", "Start date", "Date de début", "Startdatum", "Data di inizio", "Data de início"],
  ["vacation_end_date", "Fecha de fin", "End date", "Date de fin", "Enddatum", "Data di fine", "Data de fim"],
  ["safety_cat_ppe", "EPI", "PPE", "EPI", "PSA", "DPI", "EPI"],
  ["safety_cat_certification", "Certificación", "Certification", "Certification", "Zertifizierung", "Certificazione", "Certificação"],
  ["safety_cat_procedure", "Procedimiento", "Procedure", "Procédure", "Verfahren", "Procedura", "Procedimento"],
  ["projectType_institutional", "Institucional", "Institutional", "Institutionnel", "Öffentlicher Bau", "Istituzionale", "Institucional"],
  ["projectType_infrastructure", "Infraestructura", "Infrastructure", "Infrastructure", "Infrastruktur", "Infrastruttura", "Infraestrutura"],
  ["projectType_renovation", "Reforma", "Renovation", "Rénovation", "Renovierung", "Ristrutturazione", "Remodelação"],
  ["projectType_other", "Otro", "Other", "Autre", "Sonstiges", "Altro", "Outro"],
  ["project_costs_material_only", "Materiales", "Materials", "Matériaux", "Material", "Materiali", "Materiais"],
  ["project_costs_tool_only", "Herramientas", "Tools", "Outils", "Werkzeuge", "Utensili", "Ferramentas"],
  ["project_costs_notes", "Notas (opcional)", "Notes (optional)", "Notes (facultatif)", "Notizen (optional)", "Note (facoltative)", "Notas (opcional)"],
  ["vacations_allowance_hint", "Saldo anual orientativo según los días de cada empleado (se ajustan en su ficha).", "Indicative annual balance based on each employee's allowance (set it in their profile).", "Solde annuel indicatif selon les jours de chaque employé (à régler dans sa fiche).", "Richtwert für das Jahressaldo nach dem Anspruch jedes Mitarbeiters (im Profil einstellbar).", "Saldo annuale indicativo secondo i giorni di ogni dipendente (si impostano nella sua scheda).", "Saldo anual indicativo segundo os dias de cada funcionário (ajustam-se na sua ficha)."],
  ["billing_status_trial_expired", "Prueba caducada", "Trial expired", "Essai expiré", "Testphase abgelaufen", "Prova scaduta", "Teste expirado"],
  ["missing", "Falta", "Missing", "Manquant", "Fehlt", "Mancante", "Em falta"],
  ["onboarding_compliance_sub", "Central · Empleados · Cumplimiento", "Central · Employees · Compliance", "Central · Employés · Conformité", "Zentrale · Mitarbeiter · Compliance", "Centrale · Dipendenti · Conformità", "Central · Funcionários · Conformidade"],
  ["onboarding_step6_sub", "Central · Empleados · Cumplimiento", "Central · Employees · Compliance", "Central · Employés · Conformité", "Zentrale · Mitarbeiter · Compliance", "Centrale · Dipendenti · Conformità", "Central · Funcionários · Conformidade"],
  ["employee_full_name", "Nombre completo", "Full name", "Nom complet", "Vollständiger Name", "Nome completo", "Nome completo"],
];

const LANGS = ["es", "en", "fr", "de", "it", "pt"] as const;
export const REVISION_I18N: Record<(typeof LANGS)[number], Dict> = Object.fromEntries(
  LANGS.map((l, i) => [l, Object.fromEntries(ROWS.map((r) => [r[0], r[i + 1]]))])
) as Record<(typeof LANGS)[number], Dict>;

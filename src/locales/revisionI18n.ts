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
  ["invoice_number_needs_connection", "Conéctate a internet para emitir la factura: su número tiene que ser único.", "Connect to the internet to issue the invoice: its number must be unique.", "Connectez-vous à internet pour émettre la facture : son numéro doit être unique.", "Verbinde dich mit dem Internet, um die Rechnung auszustellen: Ihre Nummer muss eindeutig sein.", "Connettiti a internet per emettere la fattura: il suo numero deve essere unico.", "Liga-te à internet para emitir a fatura: o seu número tem de ser único."],
  ["vehicle_name", "Nombre del vehículo", "Vehicle name", "Nom du véhicule", "Fahrzeugname", "Nome del veicolo", "Nome do veículo"],
  ["vehicle_name_placeholder", "ej. Ford F-150 2022", "e.g. Ford F-150 2022", "ex. Ford F-150 2022", "z. B. Ford F-150 2022", "es. Ford F-150 2022", "ex. Ford F-150 2022"],
  ["vehicle_plate", "Matrícula", "Licence plate", "Immatriculation", "Kennzeichen", "Targa", "Matrícula"],
  ["project_save_failed", "No se pudo guardar la obra. Revisa la conexión e inténtalo de nuevo.", "The project could not be saved. Check your connection and try again.", "Le projet n'a pas pu être enregistré. Vérifiez la connexion et réessayez.", "Das Projekt konnte nicht gespeichert werden. Prüfe die Verbindung und versuche es erneut.", "Impossibile salvare il progetto. Controlla la connessione e riprova.", "Não foi possível guardar a obra. Verifica a ligação e tenta de novo."],
  ["project_delete_failed", "No se pudo borrar la obra.", "The project could not be deleted.", "Le projet n'a pas pu être supprimé.", "Das Projekt konnte nicht gelöscht werden.", "Impossibile eliminare il progetto.", "Não foi possível apagar a obra."],
  ["clock_out_save_failed", "No se pudo guardar tu salida. Revisa la conexión e inténtalo de nuevo.", "Your clock-out could not be saved. Check your connection and try again.", "Ta sortie n'a pas pu être enregistrée. Vérifie la connexion et réessaie.", "Dein Ausstempeln konnte nicht gespeichert werden. Prüfe die Verbindung und versuche es erneut.", "Impossibile salvare l'uscita. Controlla la connessione e riprova.", "Não foi possível guardar a tua saída. Verifica a ligação e tenta de novo."],
  ["reset_password_invite_title", "Crea tu contraseña", "Create your password", "Crée ton mot de passe", "Erstelle dein Passwort", "Crea la tua password", "Cria a tua palavra-passe"],
  ["reset_password_link_expired", "Este enlace ha caducado o ya se usó. Pide uno nuevo.", "This link has expired or was already used. Request a new one.", "Ce lien a expiré ou a déjà été utilisé. Demande-en un nouveau.", "Dieser Link ist abgelaufen oder wurde bereits verwendet. Fordere einen neuen an.", "Questo link è scaduto o è già stato usato. Richiedine uno nuovo.", "Esta ligação expirou ou já foi usada. Pede uma nova."],
  ["reset_password_request_new", "Pedir un enlace nuevo", "Request a new link", "Demander un nouveau lien", "Neuen Link anfordern", "Richiedi un nuovo link", "Pedir uma nova ligação"],
  ["reset_password_too_weak", "Elige una contraseña más segura (letras y números, mínimo 8 caracteres).", "Choose a stronger password (letters and numbers, at least 8 characters).", "Choisis un mot de passe plus sûr (lettres et chiffres, au moins 8 caractères).", "Wähle ein sichereres Passwort (Buchstaben und Zahlen, mindestens 8 Zeichen).", "Scegli una password più sicura (lettere e numeri, almeno 8 caratteri).", "Escolhe uma palavra-passe mais segura (letras e números, mínimo 8 caracteres)."],
  ["vacation_request_sent", "Solicitud enviada. Te avisaremos cuando la revisen.", "Request sent. You'll be notified when it is reviewed.", "Demande envoyée. Tu seras prévenu lors de sa révision.", "Antrag gesendet. Du wirst benachrichtigt, wenn er geprüft wurde.", "Richiesta inviata. Riceverai un avviso quando verrà esaminata.", "Pedido enviado. Vais ser avisado quando for revisto."],
  ["vacation_request_failed", "No se pudo enviar la solicitud. Inténtalo de nuevo.", "The request could not be sent. Try again.", "La demande n'a pas pu être envoyée. Réessaie.", "Der Antrag konnte nicht gesendet werden. Versuche es erneut.", "Impossibile inviare la richiesta. Riprova.", "Não foi possível enviar o pedido. Tenta de novo."],
  ["vacation_overlap_exists", "Ya tienes una solicitud para esas fechas.", "You already have a request for those dates.", "Tu as déjà une demande pour ces dates.", "Du hast bereits einen Antrag für diese Daten.", "Hai già una richiesta per queste date.", "Já tens um pedido para essas datas."],
  ["vacation_end_before_start", "La fecha de fin es anterior a la de inicio.", "The end date is before the start date.", "La date de fin est antérieure à la date de début.", "Das Enddatum liegt vor dem Startdatum.", "La data di fine è precedente a quella di inizio.", "A data de fim é anterior à de início."],
  ["employee_full_name", "Nombre completo", "Full name", "Nom complet", "Vollständiger Name", "Nome completo", "Nome completo"],
];

const LANGS = ["es", "en", "fr", "de", "it", "pt"] as const;
export const REVISION_I18N: Record<(typeof LANGS)[number], Dict> = Object.fromEntries(
  LANGS.map((l, i) => [l, Object.fromEntries(ROWS.map((r) => [r[0], r[i + 1]]))])
) as Record<(typeof LANGS)[number], Dict>;

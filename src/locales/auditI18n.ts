/**
 * Textos legibles del registro de auditoría (Seguridad / Central / Superadmin).
 * Claves: audit_action_<acción> y audit_entity_<tipo>. Se fusionan en i18n (6 idiomas base).
 */
type Dict = Record<string, string>;

const ROWS: [string, string, string, string, string, string, string][] = [
  // clave, es, en, fr, de, it, pt
  ["audit_action_auth_login", "Inicio de sesión", "Signed in", "Connexion", "Anmeldung", "Accesso", "Início de sessão"],
  ["audit_action_auth_logout", "Cierre de sesión", "Signed out", "Déconnexion", "Abmeldung", "Disconnessione", "Fim de sessão"],
  ["audit_action_auth_session_timeout", "Sesión cerrada por inactividad", "Session timed out", "Session expirée", "Sitzung abgelaufen", "Sessione scaduta", "Sessão expirada"],
  ["audit_action_clock_in", "Fichaje de entrada", "Clocked in", "Pointage d'entrée", "Eingestempelt", "Timbratura in entrata", "Registo de entrada"],
  ["audit_action_clock_out", "Fichaje de salida", "Clocked out", "Pointage de sortie", "Ausgestempelt", "Timbratura in uscita", "Registo de saída"],
  ["audit_action_manual_clock_in", "Entrada registrada manualmente", "Manual clock-in", "Entrée saisie manuellement", "Manuelle Einstempelung", "Entrata manuale", "Entrada manual"],
  ["audit_action_manual_clock_out", "Salida registrada manualmente", "Manual clock-out", "Sortie saisie manuellement", "Manuelle Ausstempelung", "Uscita manuale", "Saída manual"],
  ["audit_action_hazard_reported", "Riesgo notificado", "Hazard reported", "Risque signalé", "Gefahr gemeldet", "Rischio segnalato", "Risco reportado"],
  ["audit_action_hazard_created", "Riesgo creado", "Hazard created", "Risque créé", "Gefahr erstellt", "Rischio creato", "Risco criado"],
  ["audit_action_hazard_resolved", "Riesgo resuelto", "Hazard resolved", "Risque résolu", "Gefahr behoben", "Rischio risolto", "Risco resolvido"],
  ["audit_action_employee_hard_deleted", "Empleado eliminado definitivamente", "Employee permanently deleted", "Employé supprimé définitivement", "Mitarbeiter endgültig gelöscht", "Dipendente eliminato definitivamente", "Funcionário eliminado definitivamente"],
  ["audit_action_inventory_transfer", "Transferencia de inventario", "Inventory transfer", "Transfert d'inventaire", "Bestandsumbuchung", "Trasferimento di inventario", "Transferência de inventário"],
  ["audit_action_vacation_approved", "Vacaciones aprobadas", "Leave approved", "Congés approuvés", "Urlaub genehmigt", "Ferie approvate", "Férias aprovadas"],
  ["audit_action_form_submitted", "Formulario enviado", "Form submitted", "Formulaire envoyé", "Formular eingereicht", "Modulo inviato", "Formulário enviado"],
  ["audit_action_production_reported", "Producción registrada", "Production reported", "Production déclarée", "Produktion gemeldet", "Produzione registrata", "Produção registada"],
  ["audit_action_qr_blank_labels_generated", "Etiquetas QR en blanco generadas", "Blank QR labels generated", "Étiquettes QR vierges générées", "Leere QR-Etiketten erstellt", "Etichette QR vuote generate", "Etiquetas QR em branco geradas"],
  ["audit_action_qr_labels_generated", "Etiquetas QR generadas", "QR labels generated", "Étiquettes QR générées", "QR-Etiketten erstellt", "Etichette QR generate", "Etiquetas QR geradas"],
  ["audit_action_feedback_submitted", "Comentario enviado", "Feedback sent", "Avis envoyé", "Feedback gesendet", "Feedback inviato", "Comentário enviado"],
  ["audit_action_inventory_item_created_from_blank_label", "Artículo creado desde etiqueta QR", "Item created from QR label", "Article créé depuis une étiquette QR", "Artikel aus QR-Etikett erstellt", "Articolo creato da etichetta QR", "Artigo criado a partir de etiqueta QR"],
  ["audit_action_rfi_created", "RFI creada", "RFI created", "RFI créée", "RFI erstellt", "RFI creata", "RFI criada"],
  ["audit_action_project_updated", "Proyecto actualizado", "Project updated", "Projet mis à jour", "Projekt aktualisiert", "Progetto aggiornato", "Projeto atualizado"],
  ["audit_action_equipment_inspected", "Inspección de equipo registrada", "Equipment inspection recorded", "Inspection d'équipement enregistrée", "Geräteprüfung erfasst", "Ispezione attrezzatura registrata", "Inspeção de equipamento registada"],
  ["audit_entity_auth", "Sesión", "Session", "Session", "Sitzung", "Sessione", "Sessão"],
  ["audit_entity_clock_entry", "Fichaje", "Time clock", "Pointage", "Zeiterfassung", "Timbratura", "Registo de ponto"],
  ["audit_entity_employee", "Empleado", "Employee", "Employé", "Mitarbeiter", "Dipendente", "Funcionário"],
  ["audit_entity_tool", "Herramienta", "Tool", "Outil", "Werkzeug", "Utensile", "Ferramenta"],
  ["audit_entity_form", "Formulario", "Form", "Formulaire", "Formular", "Modulo", "Formulário"],
  ["audit_entity_project", "Proyecto", "Project", "Projet", "Projekt", "Progetto", "Projeto"],
  ["audit_entity_inventory", "Inventario", "Inventory", "Inventaire", "Inventar", "Inventario", "Inventário"],
  ["audit_entity_inventory_blank_labels", "Etiquetas QR", "QR labels", "Étiquettes QR", "QR-Etiketten", "Etichette QR", "Etiquetas QR"],
  ["audit_entity_document", "Documento", "Document", "Document", "Dokument", "Documento", "Documento"],
  ["audit_entity_feedback", "Comentario", "Feedback", "Avis", "Feedback", "Feedback", "Comentário"],
  ["audit_entity_rfi", "RFI", "RFI", "RFI", "RFI", "RFI", "RFI"],
  ["audit_entity_equipment_inspection", "Inspección", "Inspection", "Inspection", "Prüfung", "Ispezione", "Inspeção"],
];

const LANGS = ["es", "en", "fr", "de", "it", "pt"] as const;
export const AUDIT_I18N: Record<(typeof LANGS)[number], Dict> = Object.fromEntries(
  LANGS.map((l, i) => [l, Object.fromEntries(ROWS.map((r) => [r[0], r[i + 1]]))])
) as Record<(typeof LANGS)[number], Dict>;

export type ChecklistTemplate = {
  id: string;
  name: string;
  country: string[];
  items: { category: string; question: string }[];
};

export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    id: "general_site_inspection",
    name: "General Site Inspection",
    country: ["ALL"],
    items: [
      { category: "Personal Protective Equipment", question: "Are all workers wearing required PPE?" },
      { category: "Personal Protective Equipment", question: "Is PPE in good condition?" },
      { category: "Fall Protection", question: "Are guardrails installed at all open edges?" },
      { category: "Fall Protection", question: "Are safety harnesses worn when working at heights?" },
      { category: "Fall Protection", question: "Are ladders in good condition and properly secured?" },
      { category: "Housekeeping", question: "Are walkways clear of debris and obstructions?" },
      { category: "Housekeeping", question: "Is waste properly disposed of?" },
      { category: "Electrical Safety", question: "Are electrical panels properly guarded?" },
      { category: "Electrical Safety", question: "Are extension cords in good condition?" },
      { category: "Fire Safety", question: "Are fire extinguishers accessible and charged?" },
      { category: "Fire Safety", question: "Are emergency exits clearly marked?" },
      { category: "Equipment", question: "Is heavy equipment properly maintained?" },
      { category: "Equipment", question: "Are equipment operators certified?" },
      { category: "Hazardous Materials", question: "Are WHMIS/SDS sheets available?" },
      { category: "Hazardous Materials", question: "Are chemicals properly labeled and stored?" },
    ],
  },
  {
    id: "working_at_heights",
    name: "Working at Heights",
    country: ["CA", "US"],
    items: [
      { category: "Training", question: "Do all workers have valid Working at Heights certification?" },
      { category: "Training", question: "Has a pre-work safety talk been conducted?" },
      { category: "Fall Arrest", question: "Are anchor points rated for fall arrest?" },
      { category: "Fall Arrest", question: "Are lifelines properly installed?" },
      { category: "Fall Arrest", question: "Are harnesses inspected before use?" },
      { category: "Scaffolding", question: "Is scaffolding erected by a competent person?" },
      { category: "Scaffolding", question: "Are scaffold planks fully decked and secured?" },
      { category: "Scaffolding", question: "Are toeboards installed?" },
      { category: "Ladders", question: "Are ladders on stable, level surfaces?" },
      { category: "Ladders", question: "Do ladders extend 1m above landing?" },
    ],
  },
  {
    id: "osha_construction",
    name: "OSHA Construction Safety",
    country: ["US"],
    items: [
      { category: "29 CFR 1926 Compliance", question: "Is a competent person designated on site?" },
      { category: "29 CFR 1926 Compliance", question: "Are OSHA posters displayed?" },
      { category: "Excavation", question: "Are excavations properly sloped or shored?" },
      { category: "Excavation", question: "Is a competent person inspecting excavations daily?" },
      { category: "Electrical", question: "Are GFCIs used on all temporary power?" },
      { category: "Struck-By Hazards", question: "Are workers wearing high-visibility vests?" },
      { category: "Caught-In Hazards", question: "Are machine guards in place?" },
    ],
  },
];

export function getTemplatesForCountry(countryCode: string): ChecklistTemplate[] {
  return CHECKLIST_TEMPLATES.filter(
    (t) => t.country.includes("ALL") || t.country.includes(countryCode)
  );
}

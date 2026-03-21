import type { FormTemplate } from "@/types/forms";

export const INITIAL_FORM_TEMPLATES: FormTemplate[] = [
  {
    id: "tpl-tailgate-001",
    name: "Tailgate Meeting",
    description:
      "Daily safety meeting — required for all on-site staff, subcontractors and visitors",
    region: ["CA", "US", "UK"],
    category: "meeting",
    isBase: true,
    requiresAllSignatures: true,
    expiresInHours: 24,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: "machinpro",
    language: "en",
    sections: [
      {
        id: "s1",
        title: "General",
        fields: [
          { id: "f1", type: "text", label: "Project", required: true },
          { id: "f2", type: "date", label: "Date", required: true },
          {
            id: "f3",
            type: "select",
            label: "Supervisor / CTL",
            required: true,
            options: [],
          },
          { id: "f4", type: "time", label: "Start Time", required: true },
        ],
      },
      {
        id: "s2",
        title: "Work Plan",
        fields: [
          {
            id: "f5",
            type: "multiselect",
            label: "Topics to Discuss",
            required: true,
            options: [
              "General Safety",
              "Working at Heights",
              "Hazardous Materials",
              "Equipment",
              "Fire Safety",
              "First Aid",
              "Other",
            ],
          },
          {
            id: "f6",
            type: "textarea",
            label: "Today's Work Plan",
            required: true,
          },
          {
            id: "f7",
            type: "textarea",
            label: "Hazards Identified",
            required: false,
          },
          {
            id: "f8",
            type: "textarea",
            label: "Control Measures",
            required: false,
          },
        ],
      },
      {
        id: "s3",
        title: "Attendance & Signatures",
        fields: [
          { id: "f9", type: "attendance", label: "Attendees", required: true },
          {
            id: "f10",
            type: "photo",
            label: "Photos (optional)",
            required: false,
          },
        ],
      },
      {
        id: "s4",
        title: "Close",
        fields: [
          {
            id: "f11",
            type: "signature",
            label: "Supervisor Signature",
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "tpl-incident-001",
    name: "Accident / Incident Report",
    description:
      "Document any accident, incident or near miss on site",
    region: ["GLOBAL"],
    category: "report",
    isBase: true,
    requiresAllSignatures: false,
    expiresInHours: 24,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: "machinpro",
    language: "en",
    sections: [
      {
        id: "s1",
        title: "General",
        fields: [
          { id: "f1", type: "text", label: "Project", required: true },
          { id: "f2", type: "date", label: "Date", required: true },
          { id: "f3", type: "time", label: "Time", required: true },
          {
            id: "f4",
            type: "select",
            label: "Incident Type",
            required: true,
            options: [
              "Accident",
              "Near Miss",
              "Property Damage",
              "Environmental",
            ],
          },
        ],
      },
      {
        id: "s2",
        title: "Details",
        fields: [
          {
            id: "f5",
            type: "text",
            label: "Person(s) Involved",
            required: true,
          },
          { id: "f6", type: "textarea", label: "Description", required: true },
          {
            id: "f7",
            type: "textarea",
            label: "Immediate Actions",
            required: false,
          },
          { id: "f8", type: "photo", label: "Photos", required: false },
        ],
      },
      {
        id: "s3",
        title: "Sign Off",
        fields: [
          {
            id: "f9",
            type: "signature",
            label: "Supervisor Signature",
            required: true,
          },
        ],
      },
    ],
  },
  {
    id: "tpl-equipment-001",
    name: "Equipment Inspection",
    description: "Pre-use equipment inspection checklist",
    region: ["GLOBAL"],
    category: "inspection",
    isBase: true,
    requiresAllSignatures: false,
    expiresInHours: 24,
    createdAt: "2026-01-01T00:00:00Z",
    createdBy: "machinpro",
    language: "en",
    sections: [
      {
        id: "s1",
        title: "Equipment Details",
        fields: [
          {
            id: "f1",
            type: "text",
            label: "Equipment Name / ID",
            required: true,
          },
          { id: "f2", type: "text", label: "Project", required: true },
          { id: "f3", type: "date", label: "Date", required: true },
          {
            id: "f4",
            type: "select",
            label: "Inspector",
            required: true,
            options: [],
          },
        ],
      },
      {
        id: "s2",
        title: "Inspection Checklist",
        fields: [
          {
            id: "f5",
            type: "radio",
            label: "Visual Condition",
            required: true,
            options: ["Pass", "Fail", "N/A"],
          },
          {
            id: "f6",
            type: "radio",
            label: "Safety Guards in Place",
            required: true,
            options: ["Pass", "Fail", "N/A"],
          },
          {
            id: "f7",
            type: "radio",
            label: "Controls Functioning",
            required: true,
            options: ["Pass", "Fail", "N/A"],
          },
          {
            id: "f8",
            type: "textarea",
            label: "Notes / Deficiencies",
            required: false,
          },
          { id: "f9", type: "photo", label: "Photos", required: false },
        ],
      },
      {
        id: "s3",
        title: "Sign Off",
        fields: [
          {
            id: "f10",
            type: "signature",
            label: "Inspector Signature",
            required: true,
          },
        ],
      },
    ],
  },
];

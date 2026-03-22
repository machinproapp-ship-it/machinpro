/**
 * Shared types used by page.tsx and layout components to avoid incompatible duplicates.
 * Supabase `user_profiles` may expose optional `full_name` / `display_name` — see `AuthContext` `UserProfile`.
 */

import type { RolePermissions } from "@/types/roles";

export type MainSection =
  | "forms"
  | "office"
  | "warehouse"
  | "site"
  | "schedule"
  | "binders"
  | "billing"
  | "pricing"
  | "settings";

export type UserRole =
  | "admin"
  | "supervisor"
  | "worker"
  | "logistic"
  | "projectManager";

export type Language =
  | "es"
  | "en"
  | "fr"
  | "de"
  | "it"
  | "pt"
  | "nl"
  | "pl"
  | "sv"
  | "no"
  | "da"
  | "fi"
  | "cs"
  | "ro"
  | "hu"
  | "el"
  | "tr"
  | "uk"
  | "hr"
  | "sk"
  | "bg";

/** Used by Sidebar labels prop. */
export interface SidebarLabels {
  office: string;
  warehouse: string;
  site: string;
  schedule: string;
  forms: string;
  binders: string;
  billing?: string;
  settings: string;
  operations?: string;
  payroll?: string;
  centralCore?: string;
  settingsGlobal?: string;
}

/** Employee shape for CentralModule (compatible with page Employee). */
export interface CentralEmployee {
  id: string;
  name?: string;
  role?: string;
  hours?: number;
  phone?: string;
  email?: string;
  certificates?: { id: string; name: string; expiryDate?: string }[];
  payType?: "hourly" | "salary";
  hourlyRate?: number;
  monthlySalary?: number;
  customRoleId?: string;
  customPermissions?: Partial<RolePermissions>;
  useRolePermissions?: boolean;
}

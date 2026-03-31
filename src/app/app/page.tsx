import { redirect } from "next/navigation";

/** Alias de ruta para “dashboard” (SPA principal en `/`). */
export default function AppEntryRedirect() {
  redirect("/");
}

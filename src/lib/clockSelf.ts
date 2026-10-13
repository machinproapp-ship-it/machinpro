/**
 * Un fichaje puede venir guardado con el id del perfil (Supabase), con el del empleado
 * (ficha antigua) o con el del usuario de acceso. Para "mi fichaje" valen los tres.
 */
export function isSelfClockId(
  id: string | null | undefined,
  selfIds: Array<string | null | undefined>
): boolean {
  if (!id) return false;
  return selfIds.some((x) => !!x && x === id);
}

/** Fichaje abierto (sin salida) de hoy de esta persona, si lo hay. */
export function findOpenClockToday<T extends { employeeId: string; date: string; clockOut?: string | null }>(
  entries: T[],
  selfIds: Array<string | null | undefined>,
  todayYmd: string
): T | undefined {
  return entries.find((e) => e.date === todayYmd && !e.clockOut && isSelfClockId(e.employeeId, selfIds));
}

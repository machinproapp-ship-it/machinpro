/** Active = not archived, not paused/completed, and not past estimated end when inferred from dates. */

export type ProjectOperationalFields = {
  archived?: boolean;
  lifecycleStatus?: "active" | "paused" | "completed";
  estimatedEnd?: string;
};

export function resolveProjectLifecycleStatus(
  p: ProjectOperationalFields,
  todayYmd: string
): "active" | "paused" | "completed" {
  const explicit = p.lifecycleStatus;
  if (explicit === "paused" || explicit === "completed" || explicit === "active") return explicit;
  const end = p.estimatedEnd?.slice(0, 10);
  if (end && end < todayYmd) return "completed";
  return "active";
}

export function isProjectOperationallyActive(p: ProjectOperationalFields, todayYmd: string): boolean {
  if (p.archived) return false;
  return resolveProjectLifecycleStatus(p, todayYmd) === "active";
}

export function countOperationallyActiveProjects(
  projects: ProjectOperationalFields[],
  todayYmd: string
): number {
  let n = 0;
  for (const p of projects) {
    if (isProjectOperationallyActive(p, todayYmd)) n += 1;
  }
  return n;
}

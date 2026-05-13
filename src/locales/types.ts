/**
 * Namespaced copy for Security (AH-65 / AH-65.5). Deep-merged at runtime in `mergeWithEn` (`src/lib/i18n.ts`).
 */
export type SecurityMessages = {
  swpsMissingSignatures: string;
  recentHazards: string;
};

/**
 * `useAppLocale().t` is typed as `Record<string, string>`, but merged bundles may attach `security`
 * (see locale `export default` objects). Use this assertion when reading `security.*`.
 */
export type AppLocaleWithSecurity = Record<string, string> & { security?: SecurityMessages };

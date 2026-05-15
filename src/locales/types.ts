/**
 * Namespaced copy for Security (AH-65 / AH-65.5). Deep-merged at runtime in `mergeWithEn` (`src/lib/i18n.ts`).
 */
export type SecurityMessages = {
  swpsMissingSignatures: string;
  recentHazards: string;
};

/**
 * Inventario: escáner QR y fotos (AH-71). Claves planas `inventory_*` en locale files.
 */
export type InventoryQrPhotoMessages = {
  inventory_scanQrTitle: string;
  inventory_requestCameraPermission: string;
  inventory_cameraPermissionDenied: string;
  inventory_cameraNotReadable: string;
  inventory_scanUploadFallback: string;
  inventory_qrNotFound: string;
  inventory_qrCreateNew: string;
  inventory_photoTakeOrUpload: string;
  inventory_photoCompressing: string;
  inventory_photoUploading: string;
  inventory_photoUploadError: string;
  inventory_photoRemove: string;
  inventory_photoEmpty: string;
  inventory_photoColumn: string;
  inventory_qr_code_field: string;
};

/**
 * `useAppLocale().t` is typed as `Record<string, string>`, but merged bundles may attach `security`
 * (see locale `export default` objects). Use this assertion when reading `security.*`.
 */
export type AppLocaleWithSecurity = Record<string, string> & { security?: SecurityMessages };

/**
 * Namespaced copy for Security (AH-65 / AH-65.5). Deep-merged at runtime in `mergeWithEn` (`src/lib/i18n.ts`).
 */
export type SecurityMessages = {
  swpsMissingSignatures: string;
  recentHazards: string;
};

/**
 * Inventario: escáner QR, fotos (AH-71) y etiquetas Avery (AH-73). Claves planas `inventory_*`.
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
  inventory_generateQrLabels: string;
  inventory_qrLabelsModalTitle: string;
  inventory_qrLabelsDescription: string;
  inventory_qrLabelsSelectAll: string;
  inventory_qrLabelsDeselectAll: string;
  inventory_qrLabelsFormat: string;
  inventory_qrLabelsFormatA4_21: string;
  inventory_qrLabelsFormatA4_24: string;
  inventory_qrLabelsFormatLetter_30: string;
  inventory_qrLabelsFormatLetter_20: string;
  inventory_qrLabelsGenerateButton: string;
  inventory_qrLabelsGenerating: string;
  inventory_qrLabelsNoItemsSelected: string;
  inventory_qrLabelsCancel: string;
  inventory_qrLabelsHelp: string;
  inventory_qrLabelsUnprintedOnly: string;
  inventory_qrLabelsMode: string;
  inventory_qrLabelsModeA: string;
  inventory_qrLabelsModeAHelp: string;
  inventory_qrLabelsModeB: string;
  inventory_qrLabelsModeBHelp: string;
  inventory_qrLabelsBlankCount: string;
  inventory_qrLabelsBlankGenerate: string;
  inventory_qrLabelsBlankGenerated: string;
  inventory_qrBlankLabelConsumed: string;
  inventory_qrBlankLabelViewItem: string;
  inventory_qrBlankLabelRegisterTitle: string;
  inventory_qrBlankLabelRegisterHelp: string;
  inventory_itemCreatedFromBlankLabel: string;
  inventory_qrScannerStarting: string;
  inventory_qrScannerPermissionDeniedTitle: string;
  inventory_qrScannerPermissionDeniedHelp: string;
  inventory_qrScannerNoCameraTitle: string;
  inventory_qrScannerNoCameraHelp: string;
  inventory_qrScannerUnknownErrorTitle: string;
  inventory_qrScannerUnknownErrorHelp: string;
  inventory_qrItemNotFound: string;
  inventory_qrBlankNotFound: string;
  inventory_qrBackToInventory: string;
};

/**
 * `useAppLocale().t` is typed as `Record<string, string>`, but merged bundles may attach `security`
 * (see locale `export default` objects). Use this assertion when reading `security.*`.
 */
export type AppLocaleWithSecurity = Record<string, string> & { security?: SecurityMessages };

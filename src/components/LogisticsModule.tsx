"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback, Fragment } from "react";
import dynamic from "next/dynamic";
import {
  Warehouse,
  Package,
  Wrench,
  Truck,
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  X,
  ArrowUpCircle,
  ArrowDownCircle,
  Filter,
  FileCheck,
  FileX,
  ExternalLink,
  Camera,
  RotateCcw,
  AlertTriangle,
  Shield,
  ChevronDown,
  Search,
  Download,
  Loader2,
} from "lucide-react";
import type { ComplianceField, ComplianceRecord } from "@/types/homePage";
import type { InventoryLedgerRow, InventoryMovementKind } from "@/types/inventoryLedger";
import type { InventoryQrPostScanAction } from "@/types/inventoryQrAction";
import { InventoryQrPostScanModal } from "@/components/InventoryQrPostScanModal";
import { resolveInventoryItemIdFromQrScan } from "@/lib/inventoryQrResolve";
import { generateInventoryQrLabelPdf } from "@/lib/generateInventoryQrLabelPdf";
import Papa from "papaparse";
import { HorizontalScrollFade } from "@/components/HorizontalScrollFade";
import { EmptyIllustrationBox, ModuleEmptyState } from "@/components/ModuleEmptyState";
import { useToast } from "@/components/Toast";
import { userFacingErrorMessage } from "@/lib/userFacingError";
import { csvCell, downloadCsvUtf8, fileSlugCompany, filenameDateYmd } from "@/lib/csvExport";
import { ALL_TRANSLATIONS } from "@/lib/i18n";
import type { VehicleDocument } from "@/lib/vehicleDocumentUtils";
import { worstVehicleDocStatus } from "@/lib/vehicleDocumentUtils";
import { cloudinaryFull, cloudinaryThumb } from "@/lib/cloudinaryUrl";

const TeamGpsMapWidget = dynamic(
  () => import("@/components/TeamGpsMapWidget").then((m) => m.TeamGpsMapWidget),
  { ssr: false }
);

const InventoryQrScannerModal = dynamic(
  () => import("@/components/InventoryQrScannerModal").then((m) => m.InventoryQrScannerModal),
  { ssr: false }
);

export type WarehouseSubTabId = "inventory" | "fleet" | "rentals" | "suppliers" | "byProject" | "incidents" | "orders";

type LogisticsDeleteKind = "inventory" | "fleet" | "rental" | "supplier";
export type InventoryItemType = "consumable" | "tool" | "equipment" | "material";

export type ToolStatus = "available" | "in_use" | "maintenance" | "out_of_service" | "lost";
export type VehicleStatus = "available" | "in_use" | "maintenance" | "out_of_service";

export interface InventoryItem {
  id: string;
  name: string;
  type: InventoryItemType;
  quantity: number;
  unit: string;
  purchasePriceCAD: number;
  supplierId?: string;
  lowStockThreshold?: number;
  toolStatus?: ToolStatus;
  assignedToEmployeeId?: string;
  assignedToProjectId?: string;
  imageUrl?: string;
  serialNumber?: string;
  internalId?: string;
  qrCodeText?: string;
  qrCode?: string;
  incidentPhotoUrl?: string;
  incidentEntryId?: string;
  incidentReviewed?: boolean;
  deletedAt?: string;
  location?: string;
  maintenanceDate?: string;
  insuranceDate?: string;
  responsibleUserId?: string;
  lastMovementAt?: string;
  category?: string;
  model?: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  usualDriverId: string;
  currentProjectId: string | null;
  /** @deprecated Prefer `documents`; kept for datos locales antiguos. */
  insuranceExpiry?: string;
  /** @deprecated Prefer `documents`. */
  inspectionExpiry?: string;
  /** Documentación personalizable (vencimientos, URLs). */
  documents?: VehicleDocument[];
  imageUrl?: string;
  vehicleStatus?: VehicleStatus;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  mileage?: number;
  notes?: string;
  serialNumber?: string;
  internalId?: string;
  qrCode?: string;
  insuranceDocUrl?: string;
  inspectionDocUrl?: string;
  registrationDocUrl?: string;
}

export interface AssetUsageLog {
  id: string;
  assetId: string;
  assetType: "tool" | "vehicle";
  employeeId: string;
  projectId?: string;
  startDate: string;
  endDate?: string;
  notes?: string;
  createdAt: string;
  returnPhotoUrl?: string;
  returnCondition?: "good" | "damaged" | "maintenance";
}

export type RentalEquipmentType = "vehicle" | "forklift" | "scaffold" | "tool" | "other";

export interface Rental {
  id: string;
  name: string;
  supplier: string;
  returnDate: string;
  /** Monto numérico (independiente de la divisa mostrada). */
  cost: number;
  currency: string;
  /** Compatibilidad datos antiguos / demo. */
  costCAD?: number;
  contractLink?: string;
  projectId?: string;
  equipmentType?: RentalEquipmentType;
  equipmentId?: string;
}

export type SupplierContactRole = "sales" | "accounting" | "technical" | "other";

export interface SupplierContact {
  id: string;
  name: string;
  role: SupplierContactRole;
  phone?: string;
  email?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  webLink?: string;
  address: string;
  orderLink?: string;
  surplusScrapLink?: string;
  contacts?: SupplierContact[];
}

export interface Employee {
  id: string;
  name: string;
  role: string;
}

export type InventoryMovement = InventoryLedgerRow;
export type { InventoryMovementKind };

export type ResourceRequestStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "dispatched"
  | "received";

export type ResourceRequestItemStatus =
  | "pending"
  | "ready"
  | "substituted"
  | "unavailable";

export interface ResourceRequestItem {
  id: string;
  type: "tool" | "equipment" | "consumable" | "material" | "vehicle";
  inventoryItemId?: string;
  name: string;
  quantity: number;
  unit: string;
  notes?: string;
  status: ResourceRequestItemStatus;
  substituteId?: string;
  substituteName?: string;
}

export interface ResourceRequest {
  id: string;
  projectId: string;
  requestedBy: string;
  requestedByName: string;
  neededBy: string;
  status: ResourceRequestStatus;
  items: ResourceRequestItem[];
  notes?: string;
  preparedBy?: string;
  dispatchedAt?: string;
  receivedAt?: string;
  createdAt: string;
}

export interface LogisticsModuleProps {
  warehouseSubTab: WarehouseSubTabId;
  setWarehouseSubTab: (tab: WarehouseSubTabId) => void;
  warehouseSectionsEnabled: { inventory: boolean; fleet: boolean; rentals: boolean; suppliers: boolean };
  projects?: { id: string; name: string }[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  adjustModal: { itemId: string; type: "add" | "remove" } | null;
  adjustQuantity: string;
  adjustNote: string;
  setAdjustQuantity: (v: string) => void;
  setAdjustNote: (v: string) => void;
  onOpenAdjust: (itemId: string, type: "add" | "remove") => void;
  onApplyAdjustment: () => void;
  onCloseAdjustModal: () => void;
  vehicles: Vehicle[];
  rentals: Rental[];
  suppliers: Supplier[];
  employees: Employee[];
  labels: Record<string, string>;
  onAddInventory: () => void;
  onEditInventory: (item: InventoryItem) => void;
  onDeleteInventory: (id: string) => void;
  onAddFleet: () => void;
  onEditFleet: (v: Vehicle) => void;
  onDeleteFleet: (id: string) => void;
  onAddRental: () => void;
  onEditRental: (r: Rental) => void;
  onDeleteRental: (id: string) => void;
  onAddSupplier: () => void;
  onEditSupplier: (s: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
  canViewInventory?: boolean;
  canManageInventory?: boolean;
  canViewFleet?: boolean;
  canManageFleet?: boolean;
  canManageRentals?: boolean;
  canViewSuppliers?: boolean;
  canManageSuppliers?: boolean;
  canCreatePurchaseOrders?: boolean;
  onUpdateItemStatus?: (id: string, status: string) => void;
  onReturnTool?: (itemId: string, condition: "good" | "damaged" | "maintenance", notes: string, photoUrl?: string) => void;
  onMarkIncidentReviewed?: (itemId: string) => void;
  cloudinaryCloudName?: string;
  cloudinaryUploadPreset?: string;
  onUpdateVehicleStatus?: (id: string, status: string) => void;
  assetUsageLogs?: AssetUsageLog[];
  onAddUsageLog?: (log: Omit<AssetUsageLog, "id" | "createdAt">) => void;
  vehicleInspectionLabel?: string;
  complianceFields?: ComplianceField[];
  complianceRecords?: ComplianceRecord[];
  onComplianceRecordsChange?: (records: ComplianceRecord[]) => void;
  resourceRequests?: ResourceRequest[];
  onUpdateResourceRequestStatus?: (id: string, status: ResourceRequestStatus) => void;
  onMarkResourceItemReady?: (requestId: string, itemId: string) => void;
  companyName?: string;
  companyId?: string;
  /** Flota → pestaña Seguimiento (mapa GPS del día). */
  gpsMapTimeZone?: string;
  gpsMapLanguage?: string;
  gpsMapCountryCode?: string;
  gpsProjectNameById?: Record<string, string>;
  vehiclesForGpsMap?: Vehicle[];
  canViewForms?: boolean;
  activeFormsTodayByVehicleId?: Record<string, number>;
  activeFormsTodayByRentalId?: Record<string, number>;
  onOpenFormsFilteredByVehicle?: (vehicleId: string) => void;
  onOpenFormsFilteredByRental?: (rentalId: string) => void;
  canImportInventory?: boolean;
  canTransferInventory?: boolean;
  canPrintInventoryQR?: boolean;
  canScanInventoryQR?: boolean;
  canViewInventoryHistory?: boolean;
  canViewInventoryReports?: boolean;
  companyLogoUrl?: string;
  displayCurrency?: string;
  activeProfileId?: string;
  activeProfileName?: string;
  onAppendInventoryLedger?: (row: Omit<InventoryLedgerRow, "id"> & { id?: string }) => void;
  onInventoryTransfer?: (payload: {
    itemId: string;
    quantity: number;
    fromProjectId: string | null;
    toProjectId: string | null;
    fromLocation: string;
    toLocation: string;
    notes?: string | null;
  }) => void;
  onBulkInventoryImport?: (items: InventoryItem[]) => void | Promise<void>;
  openInventoryDetailId?: string | null;
  onOpenInventoryDetailConsumed?: () => void;
  /** Tras escanear QR: modal de acciones (entrada/salida/transferencia/estado). */
  onInventoryQrPostScan?: (itemId: string, action: InventoryQrPostScanAction) => void;
  /** QR escaneado sin coincidencia: prefilar alta de ítem (solo gestión). */
  onInventoryQrCreateFromScan?: (code: string) => void;
}

function daysUntilExpiry(expiryDate: string): number {
  const today = new Date();
  const expiry = new Date(expiryDate);
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
}

function vehicleComplianceFieldLabel(field: ComplianceField, tl: Record<string, string>): string {
  const m: Record<string, string> = {
    "cf-liability": "compliance_field_liability_insurance",
    "cf-compliance": "compliance_field_provincial_compliance",
    "cf-vehicle-inspection": "compliance_field_safety_inspection",
    "cf-vehicle-insurance": "compliance_field_vehicle_insurance",
  };
  const key = m[field.id];
  return key ? (tl[key] ?? field.name) : field.name;
}

function vehicleDocFleetBadge(docs: VehicleDocument[] | undefined, labels: Record<string, string>): React.ReactNode | null {
  if (!docs?.length) return null;
  const w = worstVehicleDocStatus(docs);
  if (w === "ok")
    return (
      <span className="inline-flex rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        {labels.valid ?? "Al día"}
      </span>
    );
  if (w === "soon")
    return (
      <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        {labels.expiring ?? "Vence pronto"}
      </span>
    );
  if (w === "expired")
    return (
      <span className="inline-flex rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
        {labels.expired ?? "Vencido"}
      </span>
    );
  return (
    <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
      {labels.missing ?? "Sin fecha"}
    </span>
  );
}

function getVehicleComplianceStatusBadge(record: ComplianceRecord | undefined, labels: Record<string, string>): React.ReactNode {
  const status = record?.status ?? "missing";
  if (status === "valid")
    return (
      <span className="inline-flex rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        {labels.valid ?? "Valid"}
      </span>
    );
  if (status === "expiring")
    return (
      <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
        {labels.expiring ?? "Expiring soon"}
      </span>
    );
  if (status === "expired")
    return (
      <span className="inline-flex rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">
        {labels.expired ?? "Expired"}
      </span>
    );
  return (
    <span className="inline-flex rounded-full bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
      {labels.missing ?? "Missing"}
    </span>
  );
}

function computeVehicleComplianceStatus(
  expiryDate: string | undefined,
  alertDaysBefore: number,
  fieldType: string
): "valid" | "expiring" | "expired" | "missing" {
  if (fieldType === "date" && expiryDate) {
    const days = daysUntilExpiry(expiryDate);
    if (days < 0) return "expired";
    if (days <= alertDaysBefore) return "expiring";
    return "valid";
  }
  return "missing";
}

const TOOL_STATUS_OPTIONS: { value: ToolStatus; labelKey: string }[] = [
  { value: "available", labelKey: "available" },
  { value: "in_use", labelKey: "inUse" },
  { value: "maintenance", labelKey: "maintenance" },
  { value: "out_of_service", labelKey: "outOfService" },
  { value: "lost", labelKey: "lost" },
];
const VEHICLE_STATUS_OPTIONS: { value: VehicleStatus; labelKey: string }[] = [
  { value: "available", labelKey: "available" },
  { value: "in_use", labelKey: "inUse" },
  { value: "maintenance", labelKey: "maintenance" },
  { value: "out_of_service", labelKey: "outOfService" },
];

function toolStatusBadgeClass(status: ToolStatus | undefined): string {
  const s = status ?? "available";
  if (s === "available") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (s === "in_use") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (s === "maintenance")
    return "border border-zinc-300 dark:border-zinc-600 bg-zinc-50 text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300";
  if (s === "out_of_service") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
}

const INVENTORY_PAGE_SIZE = 20;

function formatInventoryUnitOnly(item: InventoryItem, t: Record<string, string>): string {
  const plural = (t as Record<string, string>).wh_units_plural ?? "units";
  const singular = (t as Record<string, string>).wh_unit_singular ?? "unit";
  if (item.quantity !== 1) return item.unit;
  if (item.unit.trim().toLowerCase() === plural.trim().toLowerCase()) return singular;
  return item.unit;
}

function formatInventoryUnitLabel(item: InventoryItem, t: Record<string, string>): string {
  const plural = (t as Record<string, string>).wh_units_plural ?? "units";
  const singular = (t as Record<string, string>).wh_unit_singular ?? "unit";
  if (item.quantity !== 1) return `${item.quantity} ${item.unit}`;
  if (item.unit.trim().toLowerCase() === plural.trim().toLowerCase()) {
    return `${item.quantity} ${singular}`;
  }
  return `${item.quantity} ${item.unit}`;
}

function vehicleStatusBadgeClass(status: VehicleStatus | undefined): string {
  const s = status ?? "available";
  if (s === "available") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (s === "in_use") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (s === "maintenance")
    return "border border-zinc-300 dark:border-zinc-600 bg-zinc-50 text-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

function projectAssignmentChipClass(assigned: boolean): string {
  if (!assigned) return "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400";
  return "border border-zinc-300 dark:border-zinc-600 bg-zinc-50/90 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300";
}

export function LogisticsModule({
  warehouseSubTab,
  setWarehouseSubTab,
  warehouseSectionsEnabled,
  projects = [],
  inventoryItems = [],
  vehicles = [],
  rentals = [],
  suppliers = [],
  employees = [],
  labels: t,
  inventoryMovements = [],
  adjustModal,
  adjustQuantity,
  setAdjustQuantity,
  adjustNote,
  setAdjustNote,
  onOpenAdjust,
  onApplyAdjustment,
  onCloseAdjustModal,
  onAddInventory,
  onEditInventory,
  onDeleteInventory,
  onAddFleet,
  onEditFleet,
  onDeleteFleet,
  onAddRental,
  onEditRental,
  onDeleteRental,
  onAddSupplier,
  onEditSupplier,
  onDeleteSupplier,
  canViewInventory = false,
  canManageInventory = false,
  canViewFleet = false,
  canManageFleet = false,
  canManageRentals = false,
  canViewSuppliers = false,
  canManageSuppliers = false,
  canCreatePurchaseOrders = false,
  onUpdateItemStatus,
  onReturnTool,
  onMarkIncidentReviewed,
  onUpdateVehicleStatus,
  cloudinaryCloudName = "",
  cloudinaryUploadPreset = "",
  assetUsageLogs = [],
  onAddUsageLog,
  vehicleInspectionLabel: vehicleInspectionLabelProp,
  complianceFields = [],
  complianceRecords = [],
  onComplianceRecordsChange,
  resourceRequests = [],
  onUpdateResourceRequestStatus,
  onMarkResourceItemReady,
  companyName = "",
  companyId = "",
  gpsMapTimeZone = "",
  gpsMapLanguage = "es",
  gpsMapCountryCode = "CA",
  gpsProjectNameById = {},
  vehiclesForGpsMap = [],
  canViewForms = false,
  activeFormsTodayByVehicleId = {},
  activeFormsTodayByRentalId = {},
  onOpenFormsFilteredByVehicle,
  onOpenFormsFilteredByRental,
  canImportInventory = false,
  canTransferInventory = false,
  canPrintInventoryQR = false,
  canScanInventoryQR = false,
  canViewInventoryHistory = false,
  canViewInventoryReports = false,
  companyLogoUrl = "",
  displayCurrency = "CAD",
  activeProfileId,
  activeProfileName = "",
  onAppendInventoryLedger,
  onInventoryTransfer,
  onBulkInventoryImport,
  openInventoryDetailId,
  onOpenInventoryDetailConsumed,
  onInventoryQrPostScan,
  onInventoryQrCreateFromScan,
}: LogisticsModuleProps) {
  const { showToast } = useToast();
  const canFulfillOrders = canManageInventory || canCreatePurchaseOrders;
  const tlLabels = t as Record<string, string>;
  const vehicleInspectionLabel =
    vehicleInspectionLabelProp ??
    tlLabels.logistics_safety_inspection ??
    tlLabels.whInspectionExpiry ??
    "";
  const [editingVehicleCompliance, setEditingVehicleCompliance] = useState<{ field: ComplianceField; targetId: string } | null>(null);
  const [vehicleComplianceDraft, setVehicleComplianceDraft] = useState<{ value?: string; expiryDate?: string; documentUrl?: string }>({});
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [inventoryFilter, setInventoryFilter] = useState<"all" | "consumable" | "tool" | "equipment">("all");
  const [filterProjectId, setFilterProjectId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryListLimit, setInventoryListLimit] = useState(INVENTORY_PAGE_SIZE);
  const [inventorySectionOpen, setInventorySectionOpen] = useState({
    materials: true,
    tool: true,
    equipment: true,
  });
  const [selectedAsset, setSelectedAsset] = useState<{ type: "inventory" | "vehicle"; id: string } | null>(null);
  const [returnModalItem, setReturnModalItem] = useState<InventoryItem | null>(null);
  const [returnCondition, setReturnCondition] = useState<"good" | "damaged" | "maintenance">("good");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnPhotoUrl, setReturnPhotoUrl] = useState<string | null>(null);
  const returnFileInputRef = useRef<HTMLInputElement>(null);
  const [deletePrompt, setDeletePrompt] = useState<{ kind: LogisticsDeleteKind; id: string; label: string } | null>(
    null
  );
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnPhotoUploading, setReturnPhotoUploading] = useState(false);
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [inventoryQrPdfLoading, setInventoryQrPdfLoading] = useState(false);
  const [inventoryCsvExportBusy, setInventoryCsvExportBusy] = useState(false);
  const [complianceSaveSubmitting, setComplianceSaveSubmitting] = useState(false);
  const [orderActionKey, setOrderActionKey] = useState<string | null>(null);
  const [incidentMarkingId, setIncidentMarkingId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [assetDrawerTab, setAssetDrawerTab] = useState<"info" | "history" | "gallery">("info");
  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setLightboxUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl]);
  useEffect(() => { setAssetDrawerTab("info"); }, [selectedAsset]);

  useEffect(() => {
    if (!openInventoryDetailId) return;
    const it = (inventoryItems ?? []).find((i) => i.id === openInventoryDetailId && !i.deletedAt);
    if (it) setSelectedAsset({ type: "inventory", id: it.id });
    onOpenInventoryDetailConsumed?.();
  }, [openInventoryDetailId, inventoryItems, onOpenInventoryDetailConsumed]);

  const onInventoryQrDecoded = useCallback(
    (text: string) => {
      const tx = t as Record<string, string>;
      const trimmed = text.trim();
      if (!trimmed) {
        showToast("error", tx.inventory_qr_scan ?? "Scan error");
        return;
      }

      const matchId = resolveInventoryItemIdFromQrScan(trimmed, inventoryItems ?? [], companyId ?? null);
      if (!matchId) {
        if (canManageInventory && onInventoryQrCreateFromScan) {
          setInventoryQrUnknownCode(trimmed);
        } else {
          showToast("warning", tx.inventory_qrNotFound ?? tx.inventory_qr_scan ?? "QR not recognized");
        }
        return;
      }

      const it = (inventoryItems ?? []).find((i) => i.id === matchId);
      if (!it || it.deletedAt) {
        showToast("error", tx.wh_inventory_empty ?? "Not found");
        return;
      }

      setSelectedAsset({ type: "inventory", id: it.id });

      if (canManageInventory && onInventoryQrPostScan) {
        setQrPostScanItem(it);
      }

      showToast("success", it.name);
    },
    [
      companyId,
      inventoryItems,
      onInventoryQrPostScan,
      onInventoryQrCreateFromScan,
      showToast,
      t,
      canManageInventory,
    ]
  );
  const [logisticsInvFiltersOpen, setLogisticsInvFiltersOpen] = useState(false);
  const [inventoryScope, setInventoryScope] = useState<"all" | "warehouse" | "onsite">("all");
  const [transferItem, setTransferItem] = useState<InventoryItem | null>(null);
  const [transferQtyStr, setTransferQtyStr] = useState("1");
  const [transferDestProjectId, setTransferDestProjectId] = useState("");
  const [transferToWarehouse, setTransferToWarehouse] = useState(false);
  const [transferNoteStr, setTransferNoteStr] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importPreviewRows, setImportPreviewRows] = useState<InventoryItem[]>([]);
  const [invScanOpen, setInvScanOpen] = useState(false);
  const [qrPostScanItem, setQrPostScanItem] = useState<InventoryItem | null>(null);
  const [inventoryQrUnknownCode, setInventoryQrUnknownCode] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [logisticsFleetFiltersOpen, setLogisticsFleetFiltersOpen] = useState(false);
  const [fleetViewMode, setFleetViewMode] = useState<"list" | "tracking">("list");

  const vehiclePlateByUserIdForGps = useMemo(() => {
    const m: Record<string, string> = {};
    for (const v of vehiclesForGpsMap ?? []) {
      const uid = (v.usualDriverId ?? "").trim();
      const plate = (v.plate ?? "").trim();
      if (uid && plate) m[uid] = plate;
    }
    return m;
  }, [vehiclesForGpsMap]);

  const openReturnPhotoCapture = () => {
    returnFileInputRef.current?.click();
  };

  const handleReturnPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (!cloudinaryCloudName || !cloudinaryUploadPreset) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", cloudinaryUploadPreset);
    formData.append("folder", "machinpro/assets");
    setReturnPhotoUploading(true);
    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`,
        { method: "POST", body: formData }
      );
      const data = (await res.json()) as { secure_url?: string; error?: { message?: string } };
      if (data.secure_url) setReturnPhotoUrl(data.secure_url);
      else if (data.error?.message)
        showToast("error", userFacingErrorMessage(tlLabels, new Error(data.error.message)));
      else showToast("error", userFacingErrorMessage(tlLabels, undefined));
    } catch (err) {
      showToast("error", userFacingErrorMessage(tlLabels, err));
    } finally {
      setReturnPhotoUploading(false);
    }
  };

  const getProjectName = (id: string | null | undefined) => {
    if (!id) return tlLabels.noProject ?? "No project";
    return (projects ?? []).find((p) => p.id === id)?.name ?? tlLabels.noProject ?? "No project";
  };
  const getEmployeeName = (id: string | null | undefined) => {
    if (!id) return tlLabels.noEmployeeAssigned ?? "No employee";
    return (employees ?? []).find((e) => e.id === id)?.name ?? tlLabels.noEmployeeAssigned ?? "No employee";
  };

  const isTrackedAsset = (i: InventoryItem) => i.type === "tool" || i.type === "equipment";
  const filteredItems = useMemo(() => {
    const base = (inventoryItems ?? []).filter((i) => {
      if (i.deletedAt) return false;
      if (inventoryScope === "warehouse") {
        if (i.assignedToProjectId) return false;
        if ((i.location ?? "warehouse") !== "warehouse") return false;
      }
      if (inventoryScope === "onsite") {
        if (!i.assignedToProjectId && (i.location ?? "warehouse") === "warehouse") return false;
      }
      if (inventoryFilter === "consumable") return i.type === "consumable";
      if (inventoryFilter === "tool") {
        if (filterStatus !== "all") return i.type === "tool" && (i.toolStatus ?? "available") === filterStatus;
        return i.type === "tool";
      }
      if (inventoryFilter === "equipment") {
        if (filterStatus !== "all") return i.type === "equipment" && (i.toolStatus ?? "available") === filterStatus;
        return i.type === "equipment";
      }
      if (inventoryFilter === "all" && filterStatus !== "all") return isTrackedAsset(i) && (i.toolStatus ?? "available") === filterStatus;
      return true;
    });
    const q = inventorySearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter((i) => i.name.toLowerCase().includes(q));
  }, [inventoryItems, inventoryFilter, filterStatus, inventorySearch, inventoryScope]);

  const flatOrderedInventory = useMemo(() => {
    const materials = filteredItems.filter((i) => i.type === "consumable" || i.type === "material");
    const tools = filteredItems.filter((i) => i.type === "tool");
    const equipment = filteredItems.filter((i) => i.type === "equipment");
    return [...materials, ...tools, ...equipment];
  }, [filteredItems]);

  const visibleInventoryItems = useMemo(
    () => flatOrderedInventory.slice(0, inventoryListLimit),
    [flatOrderedInventory, inventoryListLimit]
  );

  useEffect(() => {
    setInventoryListLimit(INVENTORY_PAGE_SIZE);
  }, [inventoryFilter, filterStatus, inventorySearch]);

  const filteredVehicles = (vehicles ?? []).filter((v) => {
    if (filterStatus === "all" || filterStatus === "lost") return true;
    return (v.vehicleStatus ?? "available") === filterStatus;
  });

  const toolsForStatusCount = (inventoryItems ?? []).filter((i) => i.type === "tool" || i.type === "equipment");
  const statusCounts = {
    all: toolsForStatusCount.length,
    available: toolsForStatusCount.filter((i) => (i.toolStatus ?? "available") === "available").length,
    in_use: toolsForStatusCount.filter((i) => (i.toolStatus ?? "available") === "in_use").length,
    maintenance: toolsForStatusCount.filter((i) => (i.toolStatus ?? "available") === "maintenance").length,
    out_of_service: toolsForStatusCount.filter((i) => (i.toolStatus ?? "available") === "out_of_service").length,
    lost: toolsForStatusCount.filter((i) => (i.toolStatus ?? "available") === "lost").length,
  };
  const closeReturnModal = () => {
    setReturnModalItem(null);
    setReturnNotes("");
    setReturnCondition("good");
    setReturnPhotoUrl(null);
  };

  const confirmReturn = async () => {
    if (!returnModalItem || !onReturnTool || returnSubmitting) return;
    setReturnSubmitting(true);
    try {
      onReturnTool(returnModalItem.id, returnCondition, returnNotes, returnPhotoUrl ?? undefined);
      closeReturnModal();
      showToast("success", tlLabels.saved_successfully ?? "Guardado");
    } catch (err) {
      showToast("error", userFacingErrorMessage(tlLabels, err));
    } finally {
      setReturnSubmitting(false);
    }
  };

  const commitDelete = async () => {
    if (!deletePrompt || deleteSubmitting) return;
    const { kind, id } = deletePrompt;
    setDeleteSubmitting(true);
    try {
      if (kind === "inventory") onDeleteInventory(id);
      else if (kind === "fleet") onDeleteFleet(id);
      else if (kind === "rental") onDeleteRental(id);
      else onDeleteSupplier(id);
      setDeletePrompt(null);
      showToast("success", tlLabels.saved_successfully ?? "Guardado");
    } catch (err) {
      showToast("error", userFacingErrorMessage(tlLabels, err));
    } finally {
      setDeleteSubmitting(false);
    }
  };
  const vehicleStatusCounts = {
    all: (vehicles ?? []).length,
    available: (vehicles ?? []).filter((v) => (v.vehicleStatus ?? "available") === "available").length,
    in_use: (vehicles ?? []).filter((v) => (v.vehicleStatus ?? "available") === "in_use").length,
    maintenance: (vehicles ?? []).filter((v) => (v.vehicleStatus ?? "available") === "maintenance").length,
    out_of_service: (vehicles ?? []).filter((v) => (v.vehicleStatus ?? "available") === "out_of_service").length,
  };

  const getStatusLabel = (key: string) =>
    (t as Record<string, string>)[key] || (ALL_TRANSLATIONS.en as Record<string, string>)[key] || key;

  const ledgerMovementLabel = (mt: InventoryMovementKind, tx: Record<string, string>) => {
    const m: Record<InventoryMovementKind, string> = {
      in: tx.inventory_movement_in ?? "In",
      out: tx.inventory_movement_out ?? "Out",
      transfer: tx.inventory_movement_transfer ?? "Transfer",
      maintenance: tx.inventory_movement_maintenance ?? "Maintenance",
      status_change: tx.inventory_movement_status_change ?? "Status change",
      import: tx.inventory_movement_import ?? "Import",
    };
    return m[mt] ?? mt;
  };

  const exportInventoryCsv = () => {
    void (async () => {
      setInventoryCsvExportBusy(true);
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      try {
      const tx = t as Record<string, string>;
      const headers = [
        tlLabels.itemName ?? t.itemName ?? "Name",
        tlLabels.type ?? "Category",
        tlLabels.quantity ?? "Quantity",
        tx.inventory_location ?? "Location",
        tlLabels.status ?? "Status",
      ];
      const lines = [headers.map((h) => csvCell(h)).join(",")];
      const categoryLabel = (i: InventoryItem) =>
        i.type === "consumable" || i.type === "material"
          ? (tlLabels.material ?? tlLabels.consumable ?? i.type)
          : i.type === "tool"
            ? (tlLabels.tools ?? t.whTabTools ?? i.type)
            : (tlLabels.equipment ?? i.type);
      const statusLabel = (i: InventoryItem) => {
        if (!isTrackedAsset(i)) return "—";
        const ts = i.toolStatus ?? "available";
        const key =
          ts === "available"
            ? "available"
            : ts === "in_use"
              ? "inUse"
              : ts === "maintenance"
                ? "maintenance"
                : ts === "out_of_service"
                  ? "outOfService"
                  : "lost";
        return getStatusLabel(key);
      };
      const locationLabel = (i: InventoryItem) => {
        if ((i.location ?? "warehouse") === "warehouse") {
          return tx.inventory_warehouse_view ?? "Warehouse";
        }
        const pn = getProjectName(i.assignedToProjectId);
        return pn !== "—" ? pn : (tx.inventory_onsite ?? "On site");
      };
      for (const i of flatOrderedInventory) {
        const qty = `${i.quantity} ${i.unit}`;
        lines.push(
          [
            csvCell(i.name),
            csvCell(categoryLabel(i)),
            csvCell(qty),
            csvCell(locationLabel(i)),
            csvCell(statusLabel(i)),
          ].join(",")
        );
      }
      const slug = fileSlugCompany(companyName, companyId || "co");
      downloadCsvUtf8(`inventario_${slug}_${filenameDateYmd()}.csv`, lines);
      showToast("success", tlLabels.export_success ?? "Export completed");
      } catch {
        showToast("error", tlLabels.export_error ?? "Export error");
      } finally {
        setInventoryCsvExportBusy(false);
      }
    })();
  };

  const invSections: {
    key: keyof typeof inventorySectionOpen;
    match: (i: InventoryItem) => boolean;
    label: string;
  }[] = [
    {
      key: "materials",
      match: (i) => i.type === "consumable" || i.type === "material",
      label: tlLabels.material ?? t.whTabMaterial ?? "Material",
    },
    {
      key: "tool",
      match: (i) => i.type === "tool",
      label: tlLabels.tools ?? t.whTabTools ?? "Tools",
    },
    {
      key: "equipment",
      match: (i) => i.type === "equipment",
      label: tlLabels.equipment ?? "Equipment",
    },
  ];

  const invTableColSpan =
    inventoryFilter === "tool" || inventoryFilter === "equipment" || inventoryFilter === "all" ? 10 : 9;

  const logsForAsset = (assetId: string, assetType: "inventory" | "vehicle") =>
    (assetUsageLogs ?? []).filter((l) =>
      l.assetId === assetId &&
      (assetType === "inventory" ? l.assetType === "tool" : l.assetType === "vehicle")
    );

  type TabEntry = { id: WarehouseSubTabId; label: string; icon: React.ReactNode; badge?: number };
  const tabs: TabEntry[] = [];
  if (warehouseSectionsEnabled.inventory) tabs.push({ id: "inventory", label: t.whTabInventory ?? "Inventory", icon: <Package className="h-4 w-4" /> });
  if (warehouseSectionsEnabled.fleet) tabs.push({ id: "fleet", label: t.whTabFleet ?? "Fleet", icon: <Truck className="h-4 w-4" /> });
  if (warehouseSectionsEnabled.rentals) tabs.push({ id: "rentals", label: t.whTabRentals ?? "Rentals", icon: <ClipboardList className="h-4 w-4" /> });
  if (warehouseSectionsEnabled.inventory || warehouseSectionsEnabled.fleet || warehouseSectionsEnabled.rentals) {
    tabs.push({ id: "byProject", label: t.filterByProject ?? "Filter by project", icon: <Filter className="h-4 w-4" /> });
  }
  if (warehouseSectionsEnabled.suppliers) tabs.push({ id: "suppliers", label: t.whTabSuppliers ?? "Suppliers", icon: <Warehouse className="h-4 w-4" /> });
  const pendingOrders =
    (resourceRequests ?? []).filter(
      (r: ResourceRequest) => r.status === "pending" || r.status === "preparing"
    ).length;
  const unreviewedIncidents = (inventoryItems ?? []).filter((i) => i.incidentPhotoUrl && !i.incidentReviewed).length;
  if (warehouseSectionsEnabled.inventory)
    tabs.push({
      id: "orders",
      label: tlLabels.resourceRequests ?? "Orders",
      icon: <ClipboardList className="h-4 w-4" />,
      badge: pendingOrders,
    });
  if (warehouseSectionsEnabled.inventory) tabs.push({ id: "incidents", label: tlLabels.incidents ?? "Incidents", icon: <AlertTriangle className="h-4 w-4" />, badge: unreviewedIncidents });

  return (
    <section className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6 md:space-y-8 md:p-8 lg:p-10">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t.warehouse}</h2>

      <div className="border-b border-zinc-200 dark:border-zinc-700 pb-0 -mx-1 min-w-0 px-1 sm:mx-0 sm:px-0">
        <HorizontalScrollFade variant="card">
          <div
            className="flex max-w-full flex-nowrap gap-1.5 overflow-x-auto pe-1 scroll-smooth snap-x snap-mandatory scrollbar-hide [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
            role="tablist"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                onClick={() => setWarehouseSubTab(tab.id)}
                className={`shrink-0 snap-start min-h-[44px] min-w-[44px] whitespace-nowrap py-2.5 px-3 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${warehouseSubTab === tab.id ? "bg-white dark:bg-zinc-700 shadow-md text-orange-600 dark:text-orange-400 ring-2 ring-orange-400/80 dark:ring-orange-500/50" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"}`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span className="ml-1.5 rounded-full bg-red-500 text-white text-xs px-1.5 py-0.5 font-medium">{tab.badge}</span>
                )}
              </button>
            ))}
          </div>
        </HorizontalScrollFade>
      </div>

      {warehouseSubTab === "inventory" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <button
                type="button"
                className="md:hidden inline-flex min-h-[44px] w-full max-w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-800 dark:border-zinc-600 dark:bg-slate-800 dark:text-zinc-100"
                onClick={() => setLogisticsInvFiltersOpen((o) => !o)}
                aria-expanded={logisticsInvFiltersOpen}
              >
                <Filter className="h-4 w-4 shrink-0" aria-hidden />
                {tlLabels.logistics_filters_toggle ?? tlLabels.dashboard_activity_filter ?? "Filters"}
              </button>
              <div
                className={`flex flex-col gap-2 ${logisticsInvFiltersOpen ? "" : "max-md:hidden"} md:flex`}
              >
              <div className="flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden pb-1 -mx-1 px-1 md:mx-0 md:flex-wrap md:overflow-visible">
                <span className="shrink-0 text-xs text-zinc-400 mr-1 w-auto">
                  {(t as Record<string, string>).inventory_location ?? "Ubicación"}:
                </span>
                {(["all", "warehouse", "onsite"] as const).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => setInventoryScope(sc)}
                    className={`rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] ${
                      inventoryScope === sc
                        ? "bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {sc === "all"
                      ? (t.whFilterAll ?? "All")
                      : sc === "warehouse"
                        ? ((t as Record<string, string>).inventory_warehouse_view ?? "Warehouse")
                        : ((t as Record<string, string>).inventory_onsite_view ?? "On site")}
                  </button>
                ))}
              </div>
              <div className="flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden pb-1 -mx-1 px-1 md:mx-0 md:flex-wrap md:overflow-visible">
                <span className="shrink-0 text-xs text-zinc-400 mr-1">
                  {tlLabels.type ?? "Type"}:
                </span>
                {(["all", "consumable", "tool", "equipment"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setInventoryFilter(f)}
                    className={`rounded-lg px-3 py-2.5 text-sm font-medium min-h-[44px] ${inventoryFilter === f ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}
                  >
                    {f === "all"
                      ? (t.whFilterAll ?? "All")
                      : f === "consumable"
                      ? (tlLabels.material ?? tlLabels.consumable ?? "Material")
                      : f === "tool"
                      ? (tlLabels.tools ?? t.whTabTools ?? "Tools")
                      : (tlLabels.equipment ?? "Equipment")}
                  </button>
                ))}
              </div>
              {(inventoryFilter === "tool" || inventoryFilter === "equipment" || inventoryFilter === "all") && (
                <div className="flex flex-nowrap items-center gap-2 overflow-x-auto overflow-y-hidden pb-1 -mx-1 px-1 md:mx-0 md:flex-wrap md:overflow-visible">
                  <span className="shrink-0 text-xs text-zinc-400 mr-1">
                    {tlLabels.status ?? "Status"}:
                  </span>
                  {(["all", "available", "in_use", "maintenance", "out_of_service", "lost"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFilterStatus(s)}
                      className={`rounded-lg px-2.5 py-2 text-xs font-medium min-h-[44px] ${filterStatus === s ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}
                    >
                      {s === "all"
                        ? (t.whFilterAll ?? "All")
                        : getStatusLabel(
                            s === "available"
                              ? "available"
                              : s === "in_use"
                              ? "inUse"
                              : s === "maintenance"
                              ? "maintenance"
                              : s === "out_of_service"
                              ? "outOfService"
                              : "lost"
                          )}
                      {s !== "all" && ` (${statusCounts[s] ?? 0})`}
                    </button>
                  ))}
                </div>
              )}
              </div>
            </div>
            <div className="grid w-full max-w-full grid-cols-1 gap-2 min-[768px]:grid-cols-2 min-[768px]:flex min-[768px]:flex-wrap min-[768px]:items-center min-[768px]:justify-end">
              {flatOrderedInventory.length > 0 && canViewInventoryReports ? (
                <button
                  type="button"
                  disabled={inventoryCsvExportBusy}
                  onClick={() => exportInventoryCsv()}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-600 px-4 py-2.5 text-sm font-medium min-h-[44px] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {inventoryCsvExportBusy ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-4 w-4 shrink-0" aria-hidden />
                  )}
                  {(t as Record<string, string>).inventory_export_csv ?? tlLabels.export_csv ?? "Export CSV"}
                </button>
              ) : null}
              {canImportInventory && canManageInventory ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const tx = t as Record<string, string>;
                      const header =
                        "nombre,tipo,categoria,unidad,stock,stock_minimo,precio_unitario,proveedor,numero_serie,fecha_mantenimiento,fecha_seguro";
                      const blob = new Blob([header + "\n"], { type: "text/csv;charset=utf-8" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = "machinpro_inventory_template.csv";
                      a.click();
                      URL.revokeObjectURL(a.href);
                      showToast("success", tx.inventory_import_template ?? "Template");
                    }}
                    className="inline-flex min-h-[44px] items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
                  >
                    {(t as Record<string, string>).inventory_import_template ?? "Template"}
                  </button>
                  <button
                    type="button"
                    onClick={() => importFileRef.current?.click()}
                    className="inline-flex min-h-[44px] items-center rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
                  >
                    {(t as Record<string, string>).inventory_import_upload ?? "Upload CSV"}
                  </button>
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      Papa.parse<Record<string, string>>(f, {
                        header: true,
                        skipEmptyLines: true,
                        complete: (res) => {
                          const rows = res.data ?? [];
                          const next: InventoryItem[] = [];
                          rows.forEach((row, idx) => {
                            const name = (row.nombre ?? row.name ?? "").trim();
                            if (!name) return;
                            const tipo = (row.tipo ?? row.type ?? "material").toLowerCase();
                            const isTool = tipo === "tool" || tipo === "herramienta";
                            const id = `inv${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`;
                            next.push({
                              id,
                              name,
                              type: isTool ? "tool" : "material",
                              quantity: parseFloat(String(row.stock ?? row.quantity ?? "0").replace(",", ".")) || 0,
                              unit: (row.unidad ?? row.unit ?? "u").trim() || "u",
                              purchasePriceCAD:
                                parseFloat(String(row.precio_unitario ?? row.price ?? "0").replace(",", ".")) || 0,
                              lowStockThreshold:
                                parseFloat(String(row.stock_minimo ?? row.min ?? "0").replace(",", ".")) || undefined,
                              serialNumber: row.numero_serie?.trim() || undefined,
                              maintenanceDate: row.fecha_mantenimiento?.trim() || undefined,
                              insuranceDate: row.fecha_seguro?.trim() || undefined,
                              category: row.categoria?.trim() || undefined,
                              supplierId: row.proveedor?.trim() || undefined,
                              location: "warehouse",
                              toolStatus: isTool ? "available" : undefined,
                            });
                          });
                          setImportPreviewRows(next);
                          setImportOpen(true);
                        },
                      });
                    }}
                  />
                </>
              ) : null}
              {canScanInventoryQR && canManageInventory ? (
                <button
                  type="button"
                  onClick={() => setInvScanOpen(true)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600"
                >
                  <Camera className="h-4 w-4" aria-hidden />
                  {(t as Record<string, string>).inventory_qr_scan ?? "Scan QR"}
                </button>
              ) : null}
              {canManageInventory && (
                <button
                  type="button"
                  onClick={onAddInventory}
                  className="flex items-center gap-2 rounded-lg bg-orange-500 text-white px-4 py-2.5 text-sm font-medium min-h-[44px] hover:bg-orange-600"
                >
                  <Plus className="h-4 w-4" />
                  {t.addNewItem ?? t.addNew ?? "Add new"}
                </button>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            <div className="sticky top-0 z-20 border-b border-zinc-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-4 py-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder={
                    (t as Record<string, string>).wh_inventory_search ??
                    (t as Record<string, string>).rfi_search ??
                    "Search"
                  }
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 py-2.5 pl-10 pr-3 text-sm min-h-[44px] text-zinc-900 dark:text-zinc-100"
                />
              </label>
            </div>
            {/* Cards below md (mobile / narrow tablet) */}
            <div className="block md:hidden space-y-3 p-4">
              {invSections.map((section) => {
                const secItems = visibleInventoryItems.filter(section.match);
                if (secItems.length === 0) return null;
                return (
                  <div key={section.key} className="space-y-3">
                    <button
                      type="button"
                      onClick={() =>
                        setInventorySectionOpen((o) => ({
                          ...o,
                          [section.key]: !o[section.key],
                        }))
                      }
                      className="flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-800/50 px-3 py-2.5 text-left text-sm font-semibold text-zinc-800 dark:text-zinc-100 min-h-[44px]"
                    >
                      <span>{section.label}</span>
                      <span className="flex items-center gap-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                        ({secItems.length})
                        <ChevronDown
                          className={`h-5 w-5 shrink-0 transition-transform ${
                            inventorySectionOpen[section.key] ? "rotate-0" : "-rotate-90"
                          }`}
                        />
                      </span>
                    </button>
                    {inventorySectionOpen[section.key] && (
                      <div className="space-y-3">
                        {secItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      disabled={!item.imageUrl}
                      className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-slate-600 dark:bg-slate-800 disabled:pointer-events-none disabled:opacity-60"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (item.imageUrl) setLightboxUrl(item.imageUrl);
                      }}
                      aria-label={(t as Record<string, string>).inventory_photoColumn ?? "Photo"}
                    >
                      {item.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={cloudinaryThumb(item.imageUrl)}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Camera className="h-4 w-4 text-zinc-400 dark:text-zinc-500" aria-hidden />
                      )}
                    </button>
                    <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(item.type === "tool" || item.type === "equipment") ? <Wrench className="h-4 w-4 text-zinc-400 shrink-0" /> : <Package className="h-4 w-4 text-zinc-400 shrink-0" />}
                      {(item.type === "tool" || item.type === "equipment") ? (
                        <button
                          type="button"
                          onClick={() => setSelectedAsset({ type: "inventory", id: item.id })}
                          className="min-w-0 text-left text-sm font-medium text-zinc-900 break-words transition-colors hover:text-amber-600 hover:underline underline-offset-2 dark:text-white dark:hover:text-amber-400"
                        >
                          {item.name}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedAsset({ type: "inventory", id: item.id })}
                          className="min-w-0 text-left text-sm font-medium text-zinc-900 break-words transition-colors hover:text-amber-600 hover:underline underline-offset-2 dark:text-zinc-100 dark:hover:text-amber-400"
                        >
                          {item.name}
                        </button>
                      )}
                      {item.assignedToEmployeeId && (
                        <span className="hidden sm:inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                          {getEmployeeName(item.assignedToEmployeeId)}
                        </span>
                      )}
                      {item.lowStockThreshold != null && item.quantity <= item.lowStockThreshold && (
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">({t.whLowStock ?? "Low stock"})</span>
                      )}
                    </div>
                    {isTrackedAsset(item) && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${toolStatusBadgeClass(item.toolStatus)}`}>
                        {getStatusLabel(item.toolStatus === "available" ? "available" : item.toolStatus === "in_use" ? "inUse" : item.toolStatus === "maintenance" ? "maintenance" : item.toolStatus === "out_of_service" ? "outOfService" : "lost")}
                      </span>
                    )}
                    {isTrackedAsset(item) && item.incidentPhotoUrl && (
                      <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full px-2 py-0.5 shrink-0">
                        ⚠ {(tlLabels.incidentReported ?? "Incident")}
                      </span>
                    )}
                  </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs text-zinc-500 dark:text-zinc-400 sm:grid-cols-2">
                    <span className="break-words font-medium text-zinc-700 dark:text-zinc-200">
                      {formatInventoryUnitLabel(item, t)}
                    </span>
                    <span className="hidden break-words sm:block">${item.purchasePriceCAD.toFixed(2)}</span>
                    {isTrackedAsset(item) && (
                      <span className="col-span-full sm:col-span-2">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${projectAssignmentChipClass(!!item.assignedToProjectId)}`}>
                          {getProjectName(item.assignedToProjectId)}
                        </span>
                        {item.assignedToEmployeeId && (
                          <span className="ml-2 hidden sm:inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                            {getEmployeeName(item.assignedToEmployeeId)}
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-slate-700">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    {canManageInventory && (!isTrackedAsset(item) || (item.toolStatus ?? "available") === "available") && (
                      <>
                        <button type="button" onClick={() => onOpenAdjust(item.id, "add")} className="flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-3 py-2.5 min-h-[44px] text-xs font-medium border border-emerald-200 dark:border-emerald-800/40">
                          <ArrowUpCircle className="h-4 w-4" /> {t.addUnits ?? "Stock in"}
                        </button>
                        <button type="button" onClick={() => onOpenAdjust(item.id, "remove")} className="flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-3 py-2.5 min-h-[44px] text-xs font-medium border border-amber-200 dark:border-amber-800/40">
                          <ArrowDownCircle className="h-4 w-4" /> {t.removeUnits ?? "Stock out"}
                        </button>
                      </>
                    )}
                    {(item.toolStatus ?? "available") === "in_use" && canManageInventory && onReturnTool && (
                      <button type="button" onClick={() => { setReturnModalItem(item); setReturnCondition("good"); setReturnNotes(""); setReturnPhotoUrl(null); }} className="flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 min-h-[44px] transition-colors">
                        <RotateCcw className="h-3.5 w-3.5" />
                        {tlLabels.returnItem ?? "Return"}
                      </button>
                    )}
                    {(item.toolStatus ?? "available") === "maintenance" && canManageInventory && onUpdateItemStatus && (
                      <button type="button" onClick={() => onUpdateItemStatus(item.id, "available")} className="flex items-center gap-1 rounded-lg border border-emerald-300 dark:border-emerald-600 px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 min-h-[44px] transition-colors">
                        {tlLabels.markAvailable ?? "Mark available"}
                      </button>
                    )}
                    </div>
                    {canManageInventory && (
                      <div className="ml-auto flex shrink-0 items-center gap-0.5">
                        {canTransferInventory && onInventoryTransfer ? (
                          <button
                            type="button"
                            onClick={() => {
                              setTransferItem(item);
                              setTransferQtyStr(
                                isTrackedAsset(item) ? "1" : String(Math.max(1, Math.floor(item.quantity)) || 1)
                              );
                              setTransferDestProjectId("");
                              setTransferToWarehouse(false);
                              setTransferNoteStr("");
                            }}
                            className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-600 dark:border-zinc-600 dark:text-zinc-300 min-h-[44px]"
                          >
                            {(t as Record<string, string>).inventory_transfer ?? "Transfer"}
                          </button>
                        ) : null}
                        <button type="button" onClick={() => onEditInventory(item)} className="p-2.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 min-h-[44px] min-w-[44px] flex items-center justify-center" title={t.edit}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        {(!isTrackedAsset(item) || (item.toolStatus === "available") || (item.toolStatus === "out_of_service") || (item.toolStatus === "lost")) && (
                          <button type="button" onClick={() =>
                            setDeletePrompt({ kind: "inventory", id: item.id, label: item.name })
                          }
                          className="p-2.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title={t.delete}
                        >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Tabla desde md (768px+) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th className="w-12 px-2 py-3 font-medium md:w-14">
                    {(t as Record<string, string>).inventory_photoColumn ?? "Photo"}
                  </th>
                  <th className="px-4 py-3 font-medium">{t.category ?? "Category"}</th>
                  <th className="px-4 py-3 font-medium">{t.quantity ?? "Quantity"}</th>
                  <th className="px-4 py-3 font-medium">{t.unit ?? "Unit"}</th>
                  <th className="px-4 py-3 font-medium">{t.purchasePrice ?? "Price"}</th>
                  <th className="px-4 py-3 font-medium">{t.assignedProject ?? "Assigned project"}</th>
                  <th className="px-4 py-3 font-medium">{tlLabels.assignedEmployee ?? "Assigned employee"}</th>
                  {(inventoryFilter === "tool" || inventoryFilter === "equipment" || inventoryFilter === "all") && <th className="px-4 py-3 font-medium">{tlLabels.status ?? "Status"}</th>}
                  <th className="px-4 py-3 font-medium text-center">{t.addUnits ?? "Stock in"}/{t.removeUnits ?? "Stock out"}</th>
                  <th className="px-4 py-3 w-24 text-right">{t.edit ?? "Actions"}</th>
                </tr>
              </thead>
              {invSections.map((section) => {
                const secItems = visibleInventoryItems.filter(section.match);
                if (secItems.length === 0) return null;
                return (
                  <Fragment key={section.key}>
                    <tbody>
                      <tr className="bg-zinc-100/90 dark:bg-zinc-800/80">
                        <td
                          colSpan={invTableColSpan}
                          className="border-b border-zinc-200 px-4 py-2 dark:border-slate-700"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setInventorySectionOpen((o) => ({
                                ...o,
                                [section.key]: !o[section.key],
                              }))
                            }
                            className="flex w-full min-h-[44px] items-center justify-between gap-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-200"
                          >
                            <span>{section.label}</span>
                            <span className="flex items-center gap-2 font-normal normal-case text-zinc-500 dark:text-zinc-400">
                              ({secItems.length})
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 transition-transform ${
                                  inventorySectionOpen[section.key] ? "rotate-0" : "-rotate-90"
                                }`}
                              />
                            </span>
                          </button>
                        </td>
                      </tr>
                    </tbody>
                    {inventorySectionOpen[section.key] && (
                      <tbody className="divide-y divide-zinc-200 dark:divide-slate-700">
                        {secItems.map((item) => (
                  <tr key={item.id} className="bg-white dark:bg-slate-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="w-12 px-2 py-3 align-middle md:w-14">
                      <button
                        type="button"
                        disabled={!item.imageUrl}
                        className="relative mx-auto flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 dark:border-slate-600 dark:bg-slate-800 md:h-10 md:w-10 disabled:pointer-events-none disabled:opacity-60"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (item.imageUrl) setLightboxUrl(item.imageUrl);
                        }}
                        aria-label={(t as Record<string, string>).inventory_photoColumn ?? "Photo"}
                      >
                        {item.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={cloudinaryThumb(item.imageUrl)}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Camera className="h-4 w-4 text-zinc-400 dark:text-zinc-500" aria-hidden />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 max-w-[min(100vw,20rem)] min-[768px]:max-w-none">
                      <div className="flex min-w-0 items-center gap-2">
                        {(item.type === "tool" || item.type === "equipment") ? <Wrench className="h-4 w-4 text-zinc-400 shrink-0" /> : <Package className="h-4 w-4 text-zinc-400 shrink-0" />}
                        {(item.type === "tool" || item.type === "equipment") ? (
                          <button
                            type="button"
                            onClick={() => setSelectedAsset({ type: "inventory", id: item.id })}
                            className="min-w-0 text-left text-sm font-medium text-zinc-900 break-words transition-colors hover:text-amber-600 hover:underline underline-offset-2 dark:text-white dark:hover:text-amber-400"
                          >
                            {item.name}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedAsset({ type: "inventory", id: item.id })}
                            className="min-w-0 text-left text-sm font-medium text-zinc-900 break-words transition-colors hover:text-amber-600 hover:underline underline-offset-2 dark:text-zinc-100 dark:hover:text-amber-400"
                          >
                            {item.name}
                          </button>
                        )}
                        {item.lowStockThreshold != null && item.quantity <= item.lowStockThreshold && (
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">({t.whLowStock ?? "Low stock"})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{item.quantity}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{formatInventoryUnitOnly(item, t)}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">${item.purchasePriceCAD.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {isTrackedAsset(item) ? (
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${projectAssignmentChipClass(!!item.assignedToProjectId)}`}>
                          {getProjectName(item.assignedToProjectId)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {item.assignedToEmployeeId ? (
                        <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                          {getEmployeeName(item.assignedToEmployeeId)}
                        </span>
                      ) : "—"}
                    </td>
                    {(inventoryFilter === "tool" || inventoryFilter === "equipment" || inventoryFilter === "all") && (
                      <td className="px-4 py-3">
                        {isTrackedAsset(item) ? (
                          <>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toolStatusBadgeClass(item.toolStatus)}`}>
                              {getStatusLabel(item.toolStatus === "available" ? "available" : item.toolStatus === "in_use" ? "inUse" : item.toolStatus === "maintenance" ? "maintenance" : item.toolStatus === "out_of_service" ? "outOfService" : "lost")}
                            </span>
                            {item.incidentPhotoUrl && (
                              <span className="ml-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full px-2 py-0.5">
                                ⚠ {(tlLabels.incidentReported ?? "Incident")}
                              </span>
                            )}
                            {canManageInventory && onUpdateItemStatus && (
                              <select
                                value={item.toolStatus ?? "available"}
                                onChange={(e) => onUpdateItemStatus(item.id, e.target.value)}
                                className="ml-2 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1 bg-white dark:bg-slate-800 min-h-[44px]"
                              >
                                {TOOL_STATUS_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>{getStatusLabel(o.labelKey)}</option>
                                ))}
                              </select>
                            )}
                          </>
                        ) : "—"}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {canManageInventory && (!isTrackedAsset(item) || (item.toolStatus ?? "available") === "available") && (
                          <>
                            <button type="button" onClick={() => onOpenAdjust(item.id, "add")} className="p-2.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center" title={t.addUnits ?? "Add units"}>
                              <ArrowUpCircle className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => onOpenAdjust(item.id, "remove")} className="p-2.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center" title={t.removeUnits ?? "Remove units"}>
                              <ArrowDownCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {(item.toolStatus ?? "available") === "in_use" && canManageInventory && onReturnTool && (
                          <button type="button" onClick={() => { setReturnModalItem(item); setReturnCondition("good"); setReturnNotes(""); setReturnPhotoUrl(null); }} className="flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400 min-h-[44px] transition-colors">
                            <RotateCcw className="h-3.5 w-3.5" />
                            {tlLabels.returnItem ?? "Return"}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {(item.toolStatus ?? "available") === "maintenance" && canManageInventory && onUpdateItemStatus && (
                          <button type="button" onClick={() => onUpdateItemStatus(item.id, "available")} className="flex items-center gap-1 rounded-lg border border-emerald-300 dark:border-emerald-600 px-2 py-1 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 min-h-[44px] transition-colors">
                            {tlLabels.markAvailable ?? "Mark available"}
                          </button>
                        )}
                        {canManageInventory && (
                          <>
                            {canTransferInventory && onInventoryTransfer ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setTransferItem(item);
                                  setTransferQtyStr(
                                    isTrackedAsset(item) ? "1" : String(Math.max(1, Math.floor(item.quantity)) || 1)
                                  );
                                  setTransferDestProjectId("");
                                  setTransferToWarehouse(false);
                                  setTransferNoteStr("");
                                }}
                                className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-600 dark:border-zinc-600 dark:text-zinc-300 min-h-[44px]"
                              >
                                {(t as Record<string, string>).inventory_transfer ?? "Transfer"}
                              </button>
                            ) : null}
                            <button type="button" onClick={() => onEditInventory(item)} className="p-2.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 min-h-[44px] min-w-[44px] flex items-center justify-center" title={t.edit}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            {(!isTrackedAsset(item) || item.toolStatus === "available" || item.toolStatus === "out_of_service" || item.toolStatus === "lost") && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDeletePrompt({ kind: "inventory", id: item.id, label: item.name })
                                }
                                className="p-2.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                title={t.delete}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                        ))}
                      </tbody>
                    )}
                  </Fragment>
                );
              })}
            </table>
            </div>
            {flatOrderedInventory.length > visibleInventoryItems.length && (
              <div className="border-t border-zinc-200 dark:border-slate-700 px-4 py-4">
                <button
                  type="button"
                  onClick={() =>
                    setInventoryListLimit((n) => n + INVENTORY_PAGE_SIZE)
                  }
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-slate-800 py-3 text-sm font-medium text-zinc-800 dark:text-zinc-100 min-h-[44px] hover:bg-zinc-100 dark:hover:bg-slate-700"
                >
                  {(t as Record<string, string>).wh_load_more ?? "Load more"}
                </button>
              </div>
            )}
            {filteredItems.length === 0 && (
              <div className="px-4 py-6">
                <ModuleEmptyState
                  illustration={<EmptyIllustrationBox />}
                  message={
                    (t as Record<string, string>).module_empty_inventory ??
                    (t as Record<string, string>).wh_inventory_empty ??
                    "No items yet. Add your first item."
                  }
                  actionLabel={
                    canManageInventory ? (t as Record<string, string>).module_empty_inventory_cta ?? t.addNewItem ?? "" : undefined
                  }
                  onAction={canManageInventory ? onAddInventory : undefined}
                />
              </div>
            )}
          </div>
          {/* Movimientos recientes (empresa) */}
          {canViewInventoryHistory && (inventoryMovements ?? []).length > 0 ? (
            <div className="rounded-xl border border-zinc-200 dark:border-slate-700 overflow-hidden">
              <h3 className="px-4 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-slate-700">
                {(t as Record<string, string>).inventory_recent_movements ?? t.movementsLog ?? "Movements"}
              </h3>
              <ul className="divide-y divide-zinc-200 dark:divide-slate-700 max-h-56 overflow-y-auto">
                {(inventoryMovements ?? [])
                  .slice(-50)
                  .reverse()
                  .map((mov) => {
                    const tx = t as Record<string, string>;
                    return (
                      <li key={mov.id} className="px-4 py-2 text-xs sm:text-sm flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                        <span className="text-zinc-500 dark:text-zinc-400 shrink-0">
                          {mov.createdAt?.slice(0, 19).replace("T", " ")}
                        </span>
                        <span className="font-medium text-zinc-800 dark:text-zinc-100">
                          {ledgerMovementLabel(mov.movementType, tx)} · {mov.itemName ?? mov.itemId}
                          {mov.quantity != null && mov.quantity > 0 ? ` · ${mov.quantity}` : ""}
                        </span>
                        {mov.notes ? (
                          <span className="text-zinc-500 dark:text-zinc-400 break-words max-w-full">
                            {mov.notes}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ) : null}
          <InventoryQrScannerModal
            open={invScanOpen}
            labels={t}
            onClose={() => setInvScanOpen(false)}
            onDecoded={onInventoryQrDecoded}
          />
          {inventoryQrUnknownCode !== null && onInventoryQrCreateFromScan ? (
            <>
              <div
                className="fixed inset-0 z-[10078] bg-black/60"
                aria-hidden
                onClick={() => setInventoryQrUnknownCode(null)}
              />
              <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[10079] mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900 sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(100%,24rem)] sm:-translate-x-1/2 sm:-translate-y-1/2">
                <p className="text-sm leading-snug text-zinc-800 dark:text-zinc-100">
                  {(t as Record<string, string>).inventory_qrNotFound ?? "QR not recognized"}
                </p>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="min-h-[44px] rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200"
                    onClick={() => setInventoryQrUnknownCode(null)}
                  >
                    {(t as Record<string, string>).cancel ?? "Cancel"}
                  </button>
                  <button
                    type="button"
                    className="min-h-[44px] rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
                    onClick={() => {
                      onInventoryQrCreateFromScan(inventoryQrUnknownCode);
                      setInventoryQrUnknownCode(null);
                    }}
                  >
                    {(t as Record<string, string>).inventory_qrCreateNew ?? "Create"}
                  </button>
                </div>
              </div>
            </>
          ) : null}
          {qrPostScanItem && onInventoryQrPostScan ? (
            <InventoryQrPostScanModal
              item={qrPostScanItem}
              projects={projects ?? []}
              labels={t}
              onClose={() => setQrPostScanItem(null)}
              onOpenDetail={() => {
                setSelectedAsset({ type: "inventory", id: qrPostScanItem.id });
                setQrPostScanItem(null);
              }}
              onSubmit={(action) => {
                onInventoryQrPostScan(qrPostScanItem.id, action);
                setQrPostScanItem(null);
              }}
            />
          ) : null}
          {importOpen && (
            <>
              <div
                className="fixed inset-0 z-[10060] bg-black/50"
                aria-hidden
                onClick={() => {
                  if (!importSubmitting) setImportOpen(false);
                }}
              />
              <div className="fixed z-[10061] w-full border border-zinc-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[90vh] max-md:overflow-y-auto max-md:rounded-t-2xl max-md:rounded-b-none max-md:p-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] md:left-1/2 md:top-1/2 md:bottom-auto md:inset-x-auto md:w-full md:max-w-lg md:max-h-[90vh] md:overflow-y-auto md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:p-6">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {(t as Record<string, string>).inventory_import_preview ?? "Import preview"}
                  </h3>
                  <button
                    type="button"
                    disabled={importSubmitting}
                    onClick={() => setImportOpen(false)}
                    className="min-h-[44px] min-w-[44px] rounded-lg text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-800"
                  >
                    <X className="h-5 w-5 mx-auto" />
                  </button>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                  {importPreviewRows.length}{" "}
                  {(t as Record<string, string>).inventory_import_confirm ?? "rows"}
                </p>
                <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-zinc-700 dark:text-zinc-200 mb-4">
                  {importPreviewRows.slice(0, 30).map((r) => (
                    <li key={r.id}>
                      · {r.name} ({r.type}) — {r.quantity} {r.unit}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-end">
                  <button
                    type="button"
                    disabled={importSubmitting}
                    onClick={() => setImportOpen(false)}
                    className="order-1 min-h-[44px] w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200 min-[480px]:order-none min-[480px]:w-auto disabled:opacity-50"
                  >
                    {t.whClose ?? t.cancel ?? "Cancel"}
                  </button>
                  <button
                    type="button"
                    disabled={importSubmitting || !importPreviewRows.length}
                    onClick={() => {
                      if (!onBulkInventoryImport || !importPreviewRows.length) return;
                      void (async () => {
                        setImportSubmitting(true);
                        try {
                          await onBulkInventoryImport(importPreviewRows);
                          showToast(
                            "success",
                            `${importPreviewRows.length} ${(t as Record<string, string>).inventory_import_success ?? "imported"}`
                          );
                          setImportOpen(false);
                          setImportPreviewRows([]);
                        } catch (err) {
                          showToast("error", userFacingErrorMessage(tlLabels, err));
                        } finally {
                          setImportSubmitting(false);
                        }
                      })();
                    }}
                    className="order-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 min-[480px]:order-none min-[480px]:w-auto disabled:opacity-50"
                  >
                    {importSubmitting ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : null}
                    {(t as Record<string, string>).inventory_import_confirm ?? "Confirm"}
                  </button>
                </div>
              </div>
            </>
          )}
          {transferItem && onInventoryTransfer && (
            <>
              <div
                className="fixed inset-0 z-[10060] bg-black/50"
                aria-hidden
                onClick={() => {
                  if (!transferSubmitting) setTransferItem(null);
                }}
              />
              <div className="fixed z-[10061] w-full border border-zinc-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[90vh] max-md:overflow-y-auto max-md:rounded-t-2xl max-md:rounded-b-none max-md:p-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] md:left-1/2 md:top-1/2 md:bottom-auto md:inset-x-auto md:w-full md:max-w-md md:max-h-[90vh] md:overflow-y-auto md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:p-6">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mb-2">
                  {(t as Record<string, string>).inventory_transfer ?? "Transfer"}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 break-words">{transferItem.name}</p>
                {!isTrackedAsset(transferItem) ? (
                  <div className="mb-3">
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      {t.quantity ?? "Quantity"}
                    </label>
                    <input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={transferQtyStr}
                      onChange={(e) => setTransferQtyStr(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                    />
                  </div>
                ) : null}
                <div className="mb-3 flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm min-h-[44px]">
                    <input
                      type="radio"
                      checked={transferToWarehouse}
                      onChange={() => {
                        setTransferToWarehouse(true);
                        setTransferDestProjectId("");
                      }}
                    />
                    {(t as Record<string, string>).inventory_location_warehouse ?? "Warehouse"}
                  </label>
                  <label className="flex items-center gap-2 text-sm min-h-[44px]">
                    <input
                      type="radio"
                      checked={!transferToWarehouse}
                      onChange={() => setTransferToWarehouse(false)}
                    />
                    {(t as Record<string, string>).inventory_transfer_to ?? "To project"}
                  </label>
                  {!transferToWarehouse ? (
                    <select
                      value={transferDestProjectId}
                      onChange={(e) => setTransferDestProjectId(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                    >
                      <option value="">—</option>
                      {(projects ?? []).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    {t.movementNote ?? "Note"}
                  </label>
                  <input
                    type="text"
                    value={transferNoteStr}
                    onChange={(e) => setTransferNoteStr(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]"
                  />
                </div>
                <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-end">
                  <button
                    type="button"
                    disabled={transferSubmitting}
                    onClick={() => setTransferItem(null)}
                    className="order-1 min-h-[44px] w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-200 min-[480px]:order-none min-[480px]:w-auto disabled:opacity-50"
                  >
                    {t.whClose ?? t.cancel ?? "Cancel"}
                  </button>
                  <button
                    type="button"
                    disabled={transferSubmitting}
                    onClick={() => {
                      const qty = isTrackedAsset(transferItem)
                        ? 1
                        : Math.max(0.01, parseFloat(String(transferQtyStr).replace(",", ".")) || 0);
                      if (!transferToWarehouse && !transferDestProjectId) {
                        showToast("error", (t as Record<string, string>).filterByProject ?? "Select project");
                        return;
                      }
                      void (async () => {
                        setTransferSubmitting(true);
                        try {
                          await new Promise((r) => setTimeout(r, 0));
                          onInventoryTransfer({
                            itemId: transferItem.id,
                            quantity: qty,
                            fromProjectId: transferItem.assignedToProjectId ?? null,
                            toProjectId: transferToWarehouse ? null : transferDestProjectId || null,
                            fromLocation: transferItem.location ?? "warehouse",
                            toLocation: transferToWarehouse ? "warehouse" : "onsite",
                            notes: transferNoteStr.trim() || null,
                          });
                          setTransferItem(null);
                          showToast("success", tlLabels.saved_successfully ?? "Guardado");
                        } catch (err) {
                          showToast("error", userFacingErrorMessage(tlLabels, err));
                        } finally {
                          setTransferSubmitting(false);
                        }
                      })();
                    }}
                    className="order-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 min-[480px]:order-none min-[480px]:w-auto disabled:opacity-50"
                  >
                    {transferSubmitting ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : null}
                    {(t as Record<string, string>).inventory_transfer_confirm ?? "Confirm"}
                  </button>
                </div>
              </div>
            </>
          )}
          {/* Modal Ajustar unidades */}
          {adjustModal && (
            <>
              <div className="fixed inset-0 z-50 bg-black/50 touch-none" aria-hidden onClick={onCloseAdjustModal} />
              <div className="fixed z-50 w-full border border-zinc-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[90vh] max-md:overflow-y-auto max-md:overflow-x-hidden max-md:rounded-t-2xl max-md:rounded-b-none max-md:p-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] md:left-1/2 md:top-1/2 md:bottom-auto md:inset-x-auto md:w-[calc(100%-2rem)] md:max-w-sm md:max-h-[90vh] md:overflow-y-auto md:overflow-x-hidden md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    {adjustModal.type === "add" ? (t.addUnits ?? "Add units") : (t.removeUnits ?? "Remove units")}
                  </h3>
                  <button type="button" onClick={onCloseAdjustModal} className="p-2.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3 break-words">
                  {(inventoryItems ?? []).find((i) => i.id === adjustModal.itemId)?.name ?? "—"}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.quantity ?? "Quantity"}</label>
                    <input
                      type="number"
                      min="1"
                      value={adjustQuantity}
                      onChange={(e) => setAdjustQuantity(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{t.movementNote ?? "Note"}</label>
                    <input
                      type="text"
                      value={adjustNote}
                      onChange={(e) => setAdjustNote(e.target.value)}
                      placeholder={adjustModal.type === "add" ? t.newPurchase : t.loss}
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-end">
                  <button
                    type="button"
                    disabled={adjustSubmitting}
                    onClick={onCloseAdjustModal}
                    className="order-1 w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300 min-h-[44px] min-[480px]:order-none min-[480px]:w-auto disabled:opacity-50"
                  >
                    {t.whClose ?? t.cancel ?? "Cancel"}
                  </button>
                  <button
                    type="button"
                    disabled={adjustSubmitting}
                    onClick={() => {
                      void (async () => {
                        if (adjustSubmitting || !adjustModal) return;
                        const qty = Math.max(0, parseFloat(String(adjustQuantity).replace(",", ".")) || 0);
                        if (qty <= 0) {
                          onCloseAdjustModal();
                          return;
                        }
                        setAdjustSubmitting(true);
                        try {
                          await new Promise((r) => setTimeout(r, 0));
                          await Promise.resolve(onApplyAdjustment());
                          showToast("success", tlLabels.saved_successfully ?? "Guardado");
                        } catch (err) {
                          showToast("error", userFacingErrorMessage(tlLabels, err));
                        } finally {
                          setAdjustSubmitting(false);
                        }
                      })();
                    }}
                    className="order-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white min-h-[44px] hover:bg-orange-600 min-[480px]:order-none min-[480px]:w-auto disabled:opacity-50"
                  >
                    {adjustSubmitting ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : null}
                    {t.accept ?? "Apply"}
                  </button>
                </div>
              </div>
            </>
          )}
          {/* Modal Devolver al almacén */}
          {returnModalItem && (
            <>
              <input
                ref={returnFileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleReturnPhotoChange}
              />
              <div
                className="fixed inset-0 z-50 bg-black/50 touch-none"
                aria-hidden
                onClick={() => {
                  if (!returnSubmitting && !returnPhotoUploading) closeReturnModal();
                }}
              />
              <div className="fixed z-50 w-full border border-zinc-200 bg-white shadow-xl space-y-4 dark:border-slate-700 dark:bg-slate-900 max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[90vh] max-md:overflow-y-auto max-md:overflow-x-hidden max-md:rounded-t-2xl max-md:rounded-b-none max-md:p-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] md:left-1/2 md:top-1/2 md:bottom-auto md:inset-x-auto md:w-[calc(100%-2rem)] md:max-w-sm md:max-h-[90vh] md:overflow-y-auto md:overflow-x-hidden md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:p-6">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-white pr-2">
                    {tlLabels.returnToWarehouse ?? "Return to warehouse"}
                  </h3>
                  <button
                    type="button"
                    disabled={returnSubmitting || returnPhotoUploading}
                    onClick={closeReturnModal}
                    className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-zinc-300 dark:border-zinc-600 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                    aria-label={tlLabels.whClose ?? tlLabels.cancel ?? "Close"}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 break-words">{returnModalItem.name}</p>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    {tlLabels.conditionOnReturn ?? "Condition on return"}
                  </label>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {(["good", "damaged", "maintenance"] as const).map((cond) => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setReturnCondition(cond)}
                        className={`rounded-xl py-2 text-sm font-medium border transition-colors min-h-[44px] ${returnCondition === cond ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200" : "border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400"}`}
                      >
                        {cond === "good"
                          ? (tlLabels.conditionGood ?? "Good")
                          : cond === "damaged"
                            ? (tlLabels.conditionDamaged ?? "Damaged")
                            : (tlLabels.conditionMaintenance ?? "Needs maintenance")}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  placeholder={tlLabels.notes ?? "Optional notes"}
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 px-4 py-3 text-sm min-h-[80px] bg-white dark:bg-slate-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                />
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {returnCondition === "good"
                      ? (tlLabels.returnPhotoConfirm ?? "Confirmation photo (optional)")
                      : returnCondition === "damaged"
                        ? (tlLabels.returnPhotoDamage ?? "Damage photo (required)")
                        : (tlLabels.returnPhotoMaintenance ?? "Issue photo (optional)")}
                  </label>
                  {returnPhotoUrl ? (
                    <div className="relative">
                      <img
                        src={cloudinaryThumb(returnPhotoUrl)}
                        alt={tlLabels.wh_return_condition_photo_alt ?? "Return condition photo"}
                        className="w-full h-32 object-cover rounded-xl border border-zinc-200 dark:border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => setReturnPhotoUrl(null)}
                        className="absolute top-2 right-2 rounded-full bg-white dark:bg-slate-800 p-1 shadow text-red-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={returnPhotoUploading || returnSubmitting}
                      onClick={openReturnPhotoCapture}
                      className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 py-4 text-sm text-zinc-500 hover:border-orange-400 hover:text-orange-600 dark:border-zinc-600 dark:text-zinc-400 dark:hover:text-orange-400 disabled:opacity-50"
                    >
                      {returnPhotoUploading ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      ) : (
                        <Camera className="h-4 w-4" aria-hidden />
                      )}
                      {tlLabels.takePhoto ?? "Take photo"}
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-2 pt-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-end">
                  <button
                    type="button"
                    disabled={returnSubmitting || returnPhotoUploading}
                    onClick={closeReturnModal}
                    className="order-1 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 min-h-[44px] min-[480px]:order-none min-[480px]:w-auto disabled:opacity-50"
                  >
                    {tlLabels.whClose ?? tlLabels.cancel ?? "Cancel"}
                  </button>
                  <button
                    type="button"
                    disabled={returnSubmitting || returnPhotoUploading}
                    onClick={() => void confirmReturn()}
                    className="order-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-medium text-white min-h-[44px] hover:bg-orange-600 min-[480px]:order-none min-[480px]:w-auto disabled:opacity-50"
                  >
                    {returnSubmitting ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    ) : null}
                    {tlLabels.confirmReturn ?? "Confirm return"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {warehouseSubTab === "orders" && (
        <div className="space-y-3">
          {(resourceRequests ?? []).length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm text-zinc-600 dark:text-zinc-300 max-w-sm mx-auto">
                {tlLabels.noOrders ?? "No resource orders yet."}
              </p>
            </div>
          ) : (
            (resourceRequests ?? [])
              .slice()
              .sort(
                (a: ResourceRequest, b: ResourceRequest) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
              )
              .map((request: ResourceRequest) => {
                const statusColors: Record<ResourceRequestStatus, string> = {
                  pending: "bg-zinc-100 text-zinc-600 border border-zinc-200 dark:border-zinc-600",
                  preparing: "bg-zinc-50 text-zinc-700 border border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300",
                  ready: "bg-emerald-100 text-emerald-700",
                  dispatched: "bg-amber-100 text-amber-700",
                  received: "bg-zinc-100 text-zinc-400",
                };
                const statusLabels: Record<ResourceRequestStatus, string> = {
                  pending:
                    tlLabels.pending ?? "Pending",
                  preparing:
                    tlLabels.startPreparing ?? "Preparing",
                  ready:
                    tlLabels.markReady ?? "Ready",
                  dispatched:
                    tlLabels.dispatch ?? "Dispatched",
                  received:
                    tlLabels.confirmReception ?? "Received",
                };
                return (
                  <div
                    key={request.id}
                    className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-semibold break-words">
                          {(projects ?? []).find((p) => p.id === request.projectId)?.name ?? request.projectId}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {request.requestedByName} ·{" "}
                          {tlLabels.neededBy ?? "Needed by"}
                          : {request.neededBy}
                        </p>
                      </div>
                      <span
                        className={`text-xs rounded-full px-2 py-1 font-medium shrink-0 ${
                          statusColors[request.status as ResourceRequestStatus]
                        }`}
                      >
                        {statusLabels[request.status as ResourceRequestStatus]}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {request.items.map((item: ResourceRequestItem) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-2 text-sm min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between"
                        >
                          <span
                            className={
                              item.status === "ready"
                                ? "line-through text-zinc-400 break-words"
                                : "text-zinc-700 break-words dark:text-zinc-300"
                            }
                          >
                            {item.quantity}x {item.name}
                          </span>
                          {canFulfillOrders &&
                            request.status !== "dispatched" &&
                            request.status !== "received" && (
                              <button
                                type="button"
                                disabled={orderActionKey !== null}
                                onClick={() => {
                                  const k = `ord-line-${request.id}-${item.id}`;
                                  void (async () => {
                                    setOrderActionKey(k);
                                    try {
                                      await new Promise((r) => setTimeout(r, 0));
                                      onMarkResourceItemReady?.(request.id, item.id);
                                      showToast("success", tlLabels.saved_successfully ?? "Guardado");
                                    } catch (err) {
                                      showToast("error", userFacingErrorMessage(tlLabels, err));
                                    } finally {
                                      setOrderActionKey(null);
                                    }
                                  })();
                                }}
                                className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-3 py-2 text-xs transition-colors disabled:opacity-50 ${
                                  item.status === "ready"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-zinc-100 text-zinc-600 hover:bg-emerald-100 hover:text-emerald-700"
                                }`}
                              >
                                {orderActionKey === `ord-line-${request.id}-${item.id}` ? (
                                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                                ) : null}
                                {item.status === "ready"
                                  ? `✓ ${tlLabels.resource_order_line_ready ?? "Ready"}`
                                  : (tlLabels.resource_order_line_mark ?? "Mark ready")}
                              </button>
                            )}
                        </div>
                      ))}
                    </div>

                    {canFulfillOrders && (
                      <div className="flex flex-col gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800 min-[480px]:flex-row">
                        {request.status === "pending" && (
                          <button
                            type="button"
                            disabled={orderActionKey !== null}
                            onClick={() => {
                              const k = `ord-${request.id}-preparing`;
                              void (async () => {
                                setOrderActionKey(k);
                                try {
                                  await new Promise((r) => setTimeout(r, 0));
                                  onUpdateResourceRequestStatus?.(request.id, "preparing");
                                  showToast("success", tlLabels.saved_successfully ?? "Guardado");
                                } catch (err) {
                                  showToast("error", userFacingErrorMessage(tlLabels, err));
                                } finally {
                                  setOrderActionKey(null);
                                }
                              })();
                            }}
                            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            {orderActionKey === `ord-${request.id}-preparing` ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                            ) : null}
                            {tlLabels.startPreparing ?? "Start preparing"}
                          </button>
                        )}
                        {request.status === "preparing" && (
                          <button
                            type="button"
                            disabled={orderActionKey !== null}
                            onClick={() => {
                              const k = `ord-${request.id}-ready`;
                              void (async () => {
                                setOrderActionKey(k);
                                try {
                                  await new Promise((r) => setTimeout(r, 0));
                                  onUpdateResourceRequestStatus?.(request.id, "ready");
                                  showToast("success", tlLabels.saved_successfully ?? "Guardado");
                                } catch (err) {
                                  showToast("error", userFacingErrorMessage(tlLabels, err));
                                } finally {
                                  setOrderActionKey(null);
                                }
                              })();
                            }}
                            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-300 py-2.5 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                          >
                            {orderActionKey === `ord-${request.id}-ready` ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                            ) : null}
                            {tlLabels.markReady ?? "Mark as ready"}
                          </button>
                        )}
                        {request.status === "ready" && (
                          <button
                            type="button"
                            disabled={orderActionKey !== null}
                            onClick={() => {
                              const k = `ord-${request.id}-dispatched`;
                              void (async () => {
                                setOrderActionKey(k);
                                try {
                                  await new Promise((r) => setTimeout(r, 0));
                                  onUpdateResourceRequestStatus?.(request.id, "dispatched");
                                  showToast("success", tlLabels.saved_successfully ?? "Guardado");
                                } catch (err) {
                                  showToast("error", userFacingErrorMessage(tlLabels, err));
                                } finally {
                                  setOrderActionKey(null);
                                }
                              })();
                            }}
                            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
                          >
                            {orderActionKey === `ord-${request.id}-dispatched` ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                            ) : null}
                            🚚 {tlLabels.dispatch ?? "Dispatch"}
                          </button>
                        )}
                        {request.status === "dispatched" && (
                          <p className="text-sm text-zinc-500 italic py-2">
                            🚚{" "}
                            {tlLabels.inTransit ?? "In transit to site"}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>
      )}
      {warehouseSubTab === "fleet" && (
        <div className="space-y-4">
          {companyId && gpsMapTimeZone ? (
            <div className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-slate-700 pb-3">
              <button
                type="button"
                onClick={() => setFleetViewMode("list")}
                className={`rounded-lg px-4 py-2 text-sm font-medium min-h-[44px] transition-colors ${
                  fleetViewMode === "list"
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {tlLabels.whTabFleet ?? t.whTabFleet ?? "Fleet"}
              </button>
              <button
                type="button"
                onClick={() => setFleetViewMode("tracking")}
                className={`rounded-lg px-4 py-2 text-sm font-medium min-h-[44px] transition-colors ${
                  fleetViewMode === "tracking"
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {tlLabels.tab_tracking ?? "Tracking"}
              </button>
            </div>
          ) : null}

          {fleetViewMode === "tracking" && companyId && gpsMapTimeZone ? (
            <div className="min-w-0 max-w-full overflow-x-hidden">
              <TeamGpsMapWidget
                companyId={companyId}
                timeZone={gpsMapTimeZone}
                language={gpsMapLanguage}
                countryCode={gpsMapCountryCode}
                projectNameById={gpsProjectNameById}
                labels={t as Record<string, string>}
                vehiclePlateByUserId={vehiclePlateByUserIdForGps}
              />
            </div>
          ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 min-[768px]:flex-row min-[768px]:flex-wrap min-[768px]:items-center min-[768px]:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <button
                type="button"
                className="md:hidden inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-800 dark:border-zinc-600 dark:bg-slate-800 dark:text-zinc-100"
                onClick={() => setLogisticsFleetFiltersOpen((o) => !o)}
                aria-expanded={logisticsFleetFiltersOpen}
              >
                <Filter className="h-4 w-4 shrink-0" aria-hidden />
                {tlLabels.logistics_filters_toggle ?? tlLabels.dashboard_activity_filter ?? (t as Record<string, string>).dashboard_activity_filter ?? "Filters"}
              </button>
              <div className={`flex flex-wrap gap-2 ${logisticsFleetFiltersOpen ? "" : "max-md:hidden"} md:flex`}>
              {(["all", "available", "in_use", "maintenance", "out_of_service"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(s)}
                  className={`rounded-lg px-2.5 py-2 text-xs font-medium min-h-[44px] ${filterStatus === s ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"}`}
                >
                  {s === "all" ? (t.whFilterAll ?? "All") : getStatusLabel(s === "available" ? "available" : s === "in_use" ? "inUse" : s === "maintenance" ? "maintenance" : "outOfService")}
                  {s !== "all" && ` (${vehicleStatusCounts[s] ?? 0})`}
                </button>
              ))}
              </div>
            </div>
            {canManageFleet && (
              <button
                type="button"
                onClick={onAddFleet}
                className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 min-[768px]:w-auto"
              >
                <Plus className="h-4 w-4" />
                {t.addNew ?? "Add vehicle"}
              </button>
            )}
          </div>
          {/* Fleet cards below md */}
          <div className="block md:hidden space-y-3">
            {filteredVehicles.map((v) => {
              const driver = (employees ?? []).find((e) => e.id === v.usualDriverId);
              const today = new Date().toISOString().slice(0, 10);
              const nextMaint = v.nextMaintenanceDate;
              const daysUntil = nextMaint ? Math.ceil((new Date(nextMaint).getTime() - new Date(today).getTime()) / 86400000) : null;
              const maintenanceSoon = daysUntil != null && daysUntil <= 7;
              const maintenanceWarning = daysUntil != null && daysUntil <= 30 && daysUntil > 7;
              return (
                <div key={v.id} className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Truck className="h-5 w-5 shrink-0 text-zinc-400" />
                      <button
                        type="button"
                        onClick={() => setSelectedAsset({ type: "vehicle", id: v.id })}
                        className="min-w-0 text-left text-sm font-medium text-zinc-900 break-words transition-colors hover:text-amber-600 hover:underline underline-offset-2 dark:text-white dark:hover:text-amber-400"
                      >
                        {v.plate}
                      </button>
                      {canViewForms &&
                      (activeFormsTodayByVehicleId[v.id] ?? 0) > 0 &&
                      onOpenFormsFilteredByVehicle ? (
                        <button
                          type="button"
                          onClick={() => onOpenFormsFilteredByVehicle(v.id)}
                          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-blue-100 px-2.5 text-xs font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-200"
                          aria-label={tlLabels.forms_card_title ?? "Forms"}
                        >
                          {activeFormsTodayByVehicleId[v.id]}
                        </button>
                      ) : null}
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${vehicleStatusBadgeClass(v.vehicleStatus)}`}>
                      {getStatusLabel((v.vehicleStatus ?? "available") === "available" ? "available" : (v.vehicleStatus ?? "available") === "in_use" ? "inUse" : (v.vehicleStatus ?? "available") === "maintenance" ? "maintenance" : "outOfService")}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs text-zinc-500 dark:text-zinc-400 sm:grid-cols-2">
                    <span className="break-words">{t.whUsualDriver}: {driver?.name ?? "—"}</span>
                    {v.documents?.length ? (
                      <div className="col-span-full flex flex-wrap items-center gap-2 sm:col-span-2">
                        <span>{(tlLabels as Record<string, string>).vehicle_documents ?? "Vehicle documents"}:</span>
                        {vehicleDocFleetBadge(v.documents, tlLabels as Record<string, string>)}
                        <span className="text-zinc-400">({v.documents.length})</span>
                      </div>
                    ) : (
                      <>
                        <span>{t.whInsuranceExpiry}: {v.insuranceExpiry ?? "—"}</span>
                        {(v.insuranceExpiry && v.insuranceExpiry < today) && (
                          <span className="col-span-full inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 sm:col-span-2">
                            {tlLabels.insuranceExpiredBadge ?? "Insurance expired"}
                          </span>
                        )}
                        {(v.inspectionExpiry && v.inspectionExpiry < today) && (
                          <span className="col-span-full inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 sm:col-span-2">
                            {tlLabels.inspectionExpiredBadge ?? "Inspection expired"}
                          </span>
                        )}
                      </>
                    )}
                    <span className="col-span-full sm:col-span-2">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${projectAssignmentChipClass(!!v.currentProjectId)}`}>
                        {getProjectName(v.currentProjectId)}
                      </span>
                    </span>
                    {maintenanceSoon && (
                      <span className="col-span-full inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 sm:col-span-2">
                        {tlLabels.maintenanceSoon ?? "Maintenance due soon"}
                      </span>
                    )}
                    {maintenanceWarning && !maintenanceSoon && daysUntil != null && (
                      <span className="col-span-full inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 sm:col-span-2">
                        {(tlLabels.maintenanceInDays ?? "Maintenance in {n} days").replace("{n}", String(daysUntil))}
                      </span>
                    )}
                    {(complianceFields ?? []).filter((f) => f.target.includes("vehicle")).length > 0 ? (
                      <div className="col-span-full flex flex-wrap gap-2 pt-1 sm:col-span-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 w-full">
                          {(t as Record<string, string>).settingsCompliance ?? t.compliance ?? ""}
                        </span>
                        {(complianceFields ?? [])
                          .filter((f) => f.target.includes("vehicle"))
                          .map((field) => {
                            const record = (complianceRecords ?? []).find(
                              (r) => r.fieldId === field.id && r.targetType === "vehicle" && r.targetId === v.id
                            );
                            const tl = t as Record<string, string>;
                            return (
                              <div key={field.id} className="flex items-center gap-1.5 min-w-0 max-w-full">
                                <span className="text-xs text-zinc-600 dark:text-zinc-300 truncate max-w-[40%]">
                                  {vehicleComplianceFieldLabel(field, tl)}
                                </span>
                                {getVehicleComplianceStatusBadge(record, tl)}
                              </div>
                            );
                          })}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-slate-700 flex-wrap">
                    {canManageFleet && onUpdateVehicleStatus && (
                      <select value={v.vehicleStatus ?? "available"} onChange={(e) => onUpdateVehicleStatus(v.id, e.target.value)} className="text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1 bg-white dark:bg-slate-800 min-h-[44px]">
                        {VEHICLE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{getStatusLabel(o.labelKey)}</option>)}
                      </select>
                    )}
                    {canManageFleet && (
                      <>
                        <button type="button" onClick={() => onEditFleet(v)} className="p-2.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 min-h-[44px] min-w-[44px] flex items-center justify-center"><Pencil className="h-4 w-4" /></button>
                        <button
                        type="button"
                        onClick={() => setDeletePrompt({ kind: "fleet", id: v.id, label: v.plate })}
                        className="p-2.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredVehicles.length === 0 && (
              <p className="text-center text-zinc-500 dark:text-zinc-400 text-sm py-4">
                {tlLabels.wh_fleet_empty ?? "No vehicles registered yet."}
              </p>
            )}
          </div>
          {/* Tabla Flota desde md */}
          <div className="hidden md:block rounded-xl border border-zinc-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">{tlLabels.wh_vehicle_plate ?? "License plate"}</th>
                  <th className="px-4 py-3 font-medium">{t.whUsualDriver ?? "Usual driver"}</th>
                  <th className="px-4 py-3 font-medium">
                    {(tlLabels as Record<string, string>).vehicle_documents ?? t.whInsuranceExpiry ?? "Documents"}
                  </th>
                  <th className="px-4 py-3 font-medium">{t.assignedProject ?? "Project"}</th>
                  <th className="px-4 py-3 font-medium">{tlLabels.status ?? "Status"}</th>
                  <th className="px-4 py-3 font-medium">{tlLabels.wh_maintenance_column ?? "Maintenance"}</th>
                  <th className="px-4 py-3 text-right">{t.edit ?? "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-slate-700">
                {filteredVehicles.map((v) => {
                  const driver = (employees ?? []).find((e) => e.id === v.usualDriverId);
                  const today = new Date().toISOString().slice(0, 10);
                  const nextMaint = v.nextMaintenanceDate;
                  const daysUntil = nextMaint ? Math.ceil((new Date(nextMaint).getTime() - new Date(today).getTime()) / 86400000) : null;
                  const maintenanceSoon = daysUntil != null && daysUntil <= 7;
                  const maintenanceWarning = daysUntil != null && daysUntil <= 30 && daysUntil > 7;
                  return (
                    <tr key={v.id} className="bg-white dark:bg-slate-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="px-4 py-3 max-w-[min(100vw,14rem)] min-[768px]:max-w-none">
                        <button
                          type="button"
                          onClick={() => setSelectedAsset({ type: "vehicle", id: v.id })}
                          className="min-w-0 text-left text-sm font-medium text-zinc-900 break-words transition-colors hover:text-amber-600 hover:underline underline-offset-2 dark:text-white dark:hover:text-amber-400"
                        >
                          {v.plate}
                        </button>
                        {canViewForms &&
                        (activeFormsTodayByVehicleId[v.id] ?? 0) > 0 &&
                        onOpenFormsFilteredByVehicle ? (
                          <button
                            type="button"
                            onClick={() => onOpenFormsFilteredByVehicle(v.id)}
                            className="mt-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-blue-100 px-2.5 text-xs font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-200"
                            aria-label={tlLabels.forms_card_title ?? "Forms"}
                          >
                            {activeFormsTodayByVehicleId[v.id]}
                          </button>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{driver?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        {v.documents?.length ? (
                          <div className="flex flex-col gap-1 items-start">
                            {vehicleDocFleetBadge(v.documents, tlLabels as Record<string, string>)}
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">{v.documents.length}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-300">
                            <span>
                              {t.whInsuranceExpiry ?? "Ins"}: {v.insuranceExpiry ?? "—"}
                              {v.insuranceExpiry && v.insuranceExpiry < today ? (
                                <span className="ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                  {tlLabels.insuranceExpiredBadge ?? "!"}
                                </span>
                              ) : null}
                            </span>
                            <span>
                              {vehicleInspectionLabel}: {v.inspectionExpiry ?? "—"}
                              {v.inspectionExpiry && v.inspectionExpiry < today ? (
                                <span className="ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                  {tlLabels.inspectionExpiredBadge ?? "!"}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${projectAssignmentChipClass(!!v.currentProjectId)}`}>
                          {getProjectName(v.currentProjectId)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${vehicleStatusBadgeClass(v.vehicleStatus)}`}>
                          {getStatusLabel((v.vehicleStatus ?? "available") === "available" ? "available" : (v.vehicleStatus ?? "available") === "in_use" ? "inUse" : (v.vehicleStatus ?? "available") === "maintenance" ? "maintenance" : "outOfService")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                        {maintenanceSoon && <span className="text-red-600 dark:text-red-400 text-xs">{tlLabels.maintenanceSoon ?? "Due soon"}</span>}
                        {maintenanceWarning && !maintenanceSoon && daysUntil != null && (
                          <span className="text-amber-600 dark:text-amber-400 text-xs">
                            {(tlLabels.wh_maintenance_days_short ?? "{n} days").replace("{n}", String(daysUntil))}
                          </span>
                        )}
                        {!maintenanceSoon && !maintenanceWarning && "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canManageFleet && onUpdateVehicleStatus && (
                            <select value={v.vehicleStatus ?? "available"} onChange={(e) => onUpdateVehicleStatus(v.id, e.target.value)} className="text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 px-2 py-1 bg-white dark:bg-slate-800 min-h-[44px]">
                              {VEHICLE_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{getStatusLabel(o.labelKey)}</option>)}
                            </select>
                          )}
                          {canManageFleet && (
                            <>
                              <button type="button" onClick={() => onEditFleet(v)} className="p-2.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 min-h-[44px] min-w-[44px] flex items-center justify-center"><Pencil className="h-4 w-4" /></button>
                              <button
                        type="button"
                        onClick={() => setDeletePrompt({ kind: "fleet", id: v.id, label: v.plate })}
                        className="p-2.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredVehicles.length === 0 && (
              <p className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                {tlLabels.wh_fleet_empty ?? "No vehicles registered yet."}
              </p>
            )}
          </div>
        </div>
          )}
        </div>
      )}

      {warehouseSubTab === "rentals" && (
        <div className="space-y-4">
          {canManageRentals && (
          <div className="flex w-full justify-stretch min-[768px]:justify-end">
            <button
              type="button"
              onClick={onAddRental}
              className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 min-[768px]:w-auto"
            >
              <Plus className="h-4 w-4" />
              {t.addNew ?? "Add rental"}
            </button>
          </div>
          )}
          <div className="rounded-xl border border-zinc-200 dark:border-slate-700 divide-y divide-zinc-200 dark:divide-slate-700">
            {(rentals ?? []).map((r) => {
              const rentalAmount = r.cost ?? r.costCAD ?? 0;
              const rentalCur = (r.currency ?? "CAD").trim() || "CAD";
              return (
              <div key={r.id} className="flex flex-col gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100 break-words">{r.name}</p>
                    {canViewForms &&
                    (activeFormsTodayByRentalId[r.id] ?? 0) > 0 &&
                    onOpenFormsFilteredByRental ? (
                      <button
                        type="button"
                        onClick={() => onOpenFormsFilteredByRental(r.id)}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-blue-100 px-2.5 text-xs font-bold text-blue-800 dark:bg-blue-950/60 dark:text-blue-200"
                        aria-label={tlLabels.forms_card_title ?? "Forms"}
                      >
                        {activeFormsTodayByRentalId[r.id]}
                      </button>
                    ) : null}
                  </div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 break-words">
                    {t.whSupplier}: {r.supplier}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 break-words">
                    {t.whReturnDate}: {r.returnDate} · {t.whRentalCost}: {rentalCur} {rentalAmount.toFixed(2)}
                  </p>
                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium mt-1 ${projectAssignmentChipClass(!!r.projectId)}`}>
                    {getProjectName(r.projectId)}
                  </span>
                </div>
                {canManageRentals && (
                <div className="flex shrink-0 gap-1 self-end min-[640px]:self-auto">
                  <button type="button" onClick={() => onEditRental(r)} className="p-2.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 min-h-[44px] min-w-[44px] flex items-center justify-center"><Pencil className="h-4 w-4" /></button>
                  <button
                  type="button"
                  onClick={() => setDeletePrompt({ kind: "rental", id: r.id, label: r.name })}
                  className="p-2.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                </div>
                )}
              </div>
            );
            })}
            {(rentals ?? []).length === 0 && (
              <p className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                {tlLabels.wh_rentals_empty ?? "No rentals recorded yet."}
              </p>
            )}
          </div>
        </div>
      )}

      {warehouseSubTab === "byProject" && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">{t.filterByProject ?? "Filtrar por proyecto"}</label>
            <select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              className="w-full max-w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 min-[768px]:max-w-xs"
            >
              <option value="">{t.allProjects ?? "Todos los proyectos"}</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {filterProjectId ? (() => {
            const proj = (projects ?? []).find((p) => p.id === filterProjectId);
            const projName = proj?.name ?? filterProjectId;
            const inv = (inventoryItems ?? []).filter((i) => i.assignedToProjectId === filterProjectId);
            const veh = (vehicles ?? []).filter((v) => v.currentProjectId === filterProjectId);
            const rent = (rentals ?? []).filter((r) => r.projectId === filterProjectId);
            const toolsCount = inv.filter((i) => i.type === "tool").length;
            const materialsCount = inv.filter((i) => i.type === "material").length;
            return (
              <div className="space-y-4">
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {projName} — {inv.length} {t.whTabInventory ?? "items"} ({toolsCount} {t.whTabTools ?? "tools"} · {materialsCount} {t.whTabMaterial ?? "materials"}) · {veh.length}{" "}
                  {t.whTabFleet ?? "vehicles"} · {rent.length} {t.whTabRentals ?? "rentals"}
                </p>
                <div className="rounded-xl border border-zinc-200 dark:border-slate-700 divide-y divide-zinc-200 dark:divide-slate-700 overflow-hidden">
                  {inv.length > 0 && (
                    <details className="group bg-zinc-50 dark:bg-zinc-800/50" open>
                      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        <span>{t.whTabInventory ?? "Inventory"}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                      <ul className="space-y-1 px-4 pb-4 text-sm text-zinc-700 dark:text-zinc-300">
                        {inv.map((i) => (
                          <li key={i.id} className="flex items-center gap-2">
                            {i.type === "tool" ? <Wrench className="h-4 w-4 text-zinc-400" /> : <Package className="h-4 w-4 text-zinc-400" />}
                            {i.name} · {formatInventoryUnitLabel(i, t)}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {veh.length > 0 && (
                    <details className="group bg-zinc-50 dark:bg-zinc-800/50" open>
                      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        <span>{t.whTabFleet ?? "Fleet"}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                      <ul className="space-y-1 px-4 pb-4 text-sm text-zinc-700 dark:text-zinc-300">
                        {veh.map((v) => (
                          <li key={v.id} className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-zinc-400" />
                            {v.plate}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {rent.length > 0 && (
                    <details className="group bg-zinc-50 dark:bg-zinc-800/50" open>
                      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        <span>{t.whTabRentals ?? "Rentals"}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                      </summary>
                      <ul className="space-y-1 px-4 pb-4 text-sm text-zinc-700 dark:text-zinc-300">
                        {rent.map((r) => (
                          <li key={r.id}>{r.name} · {r.supplier}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {inv.length === 0 && veh.length === 0 && rent.length === 0 && (
                    <p className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                      {tlLabels.noResourcesForProject ?? "No resources assigned to this project."}
                    </p>
                  )}
                </div>
              </div>
            );
          })() : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {tlLabels.logistics_filter_project_hint ?? "Select a project to view its resources."}
            </p>
          )}
        </div>
      )}

      {warehouseSubTab === "suppliers" && (
        <div className="space-y-4">
          {canManageSuppliers && (
          <div className="flex w-full justify-stretch min-[768px]:justify-end">
            <button
              type="button"
              onClick={onAddSupplier}
              className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 min-[768px]:w-auto"
            >
              <Plus className="h-4 w-4" />
              {t.addNew ?? "Add supplier"}
            </button>
          </div>
          )}
          <div className="rounded-xl border border-zinc-200 dark:border-slate-700 divide-y divide-zinc-200 dark:divide-slate-700">
            {(suppliers ?? []).map((s) => (
              <div
                key={s.id}
                className="flex flex-col gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 min-[640px]:flex-row min-[640px]:items-center min-[640px]:justify-between"
              >
                <button type="button" onClick={() => setSelectedSupplierId(s.id)} className="min-w-0 flex-1 text-left">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100 break-words">{s.name}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 break-words">{s.phone} · {s.email}</p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 break-words">{s.address}</p>
                </button>
                {canManageSuppliers && (
                <div className="flex shrink-0 gap-1 self-end min-[640px]:self-auto">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onEditSupplier(s); }} className="p-2.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 min-h-[44px] min-w-[44px] flex items-center justify-center"><Pencil className="h-4 w-4" /></button>
                  <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletePrompt({ kind: "supplier", id: s.id, label: s.name });
                  }}
                  className="p-2.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                </div>
                )}
              </div>
            ))}
            {(suppliers ?? []).length === 0 && (
              <p className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400 text-sm">
                {tlLabels.wh_suppliers_empty ?? "No suppliers registered yet."}
              </p>
            )}
          </div>
        </div>
      )}

      {warehouseSubTab === "incidents" && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            {tlLabels.controlCenter ?? "Control center"}
            <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
              ({(inventoryItems ?? []).filter((i) => i.incidentPhotoUrl).length} {tlLabels.incidents ?? "incidents"})
            </span>
          </h3>
          {(() => {
            const incidentItems = (inventoryItems ?? []).filter((i) => (i.type === "tool" || i.type === "equipment") && i.incidentPhotoUrl);
            if (incidentItems.length === 0) {
              return (
                <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                  <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">{tlLabels.noIncidents ?? "No active incidents"}</p>
                </div>
              );
            }
            return (
              <div className="space-y-4">
                {incidentItems.map((item) => {
                  const projectName = getProjectName(item.assignedToProjectId);
                  const incidentDateStr = "—";
                  return (
                    <div key={item.id} className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">{projectName} · {incidentDateStr}</p>
                          </div>
                        </div>
                        <span className="text-xs rounded-full px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium">
                          {tlLabels.maintenanceRequired ?? "Maintenance required"}
                        </span>
                      </div>
                      {item.incidentPhotoUrl && (
                        <img
                          src={cloudinaryThumb(item.incidentPhotoUrl)}
                          alt={tlLabels.logistics_incident_photo_alt ?? "Incident photo"}
                          className="w-full h-48 object-cover rounded-xl cursor-pointer border border-zinc-200 dark:border-slate-700"
                          onClick={() => setLightboxUrl(item.incidentPhotoUrl!)}
                        />
                      )}
                      <div className="flex gap-2">
                        {canManageInventory && onMarkIncidentReviewed && (
                          <button
                            type="button"
                            onClick={() => {
                              void (async () => {
                                setIncidentMarkingId(item.id);
                                try {
                                  await new Promise((r) => setTimeout(r, 0));
                                  onMarkIncidentReviewed(item.id);
                                  showToast("success", tlLabels.saved_successfully ?? "Guardado");
                                } catch (err) {
                                  showToast("error", userFacingErrorMessage(tlLabels, err));
                                } finally {
                                  setIncidentMarkingId(null);
                                }
                              })();
                            }}
                            disabled={incidentMarkingId !== null}
                            className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-300 py-2 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-600 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                          >
                            {incidentMarkingId === item.id ? (
                              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                            ) : null}
                            ✓ {tlLabels.markReviewed ?? "Mark reviewed"}
                          </button>
                        )}
                        {canManageInventory && onReturnTool && (
                          <button
                            type="button"
                            onClick={() => { setReturnModalItem(item); setReturnCondition("good"); setReturnNotes(""); setReturnPhotoUrl(null); }}
                            className="flex-1 rounded-xl bg-amber-600 text-white py-2 text-sm font-medium hover:bg-amber-500 min-h-[44px] transition-colors"
                          >
                            {tlLabels.returnItem ?? "Return"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {selectedSupplierId && warehouseSubTab === "suppliers" && (() => {
        const s = (suppliers ?? []).find((x) => x.id === selectedSupplierId);
        if (!s) return null;
        const tl = t as Record<string, string>;
        const roleLabel = (role: string) => role === "sales" ? (tl.roleSales ?? "Ventas") : role === "accounting" ? (tl.roleAccounting ?? "Contabilidad") : role === "technical" ? (tl.roleTechnical ?? "Técnico") : (tl.other ?? "Otro");
        const supplierItems = (inventoryItems ?? []).filter((i) => i.supplierId === s.id);
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" aria-hidden onClick={() => setSelectedSupplierId(null)} />
            <div className="fixed z-50 w-full border-zinc-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[90vh] max-md:overflow-y-auto max-md:rounded-t-2xl max-md:rounded-b-none max-md:border max-md:pb-[max(1rem,env(safe-area-inset-bottom))] sm:right-0 sm:top-0 sm:bottom-0 sm:max-w-md sm:overflow-y-auto sm:border-l md:max-w-lg lg:max-w-xl">
              <div className="p-4 border-b border-zinc-200 dark:border-slate-700 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{s.name}</h3>
                <button type="button" onClick={() => setSelectedSupplierId(null)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px] flex items-center justify-center">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.phone}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.email}</p>
                  {s.address && <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.address}</p>}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{tl.supplierContacts ?? "Contactos"}</h4>
                  {(s.contacts ?? []).length === 0 ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{tl.addContact ?? "Add contact"}</p>
                  ) : (
                    <ul className="space-y-2">
                      {(s.contacts ?? []).map((c) => (
                        <li key={c.id} className="text-sm text-zinc-700 dark:text-zinc-300">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-zinc-500 dark:text-zinc-400"> · {roleLabel(c.role)}</span>
                          {c.phone && <span className="block text-xs text-zinc-500">{c.phone}</span>}
                          {c.email && <span className="block text-xs text-zinc-500">{c.email}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {canManageSuppliers && (
                    <button type="button" onClick={() => { setSelectedSupplierId(null); onEditSupplier(s); }} className="mt-2 text-sm text-amber-600 hover:text-amber-500">
                      + {tl.addContact ?? "Add contact"}
                    </button>
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">{tl.whTabInventory ?? "Inventario"}</h4>
                  {supplierItems.length === 0 ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{tlLabels.noItemsFromSupplier ?? "No items from this supplier"}</p>
                  ) : (
                    <ul className="space-y-2">
                      {supplierItems.map((i) => (
                        <li key={i.id} className="flex justify-between text-sm">
                          <span className="text-zinc-900 dark:text-zinc-100">{i.name}</span>
                          <span className="text-zinc-500 dark:text-zinc-400">{formatInventoryUnitLabel(i, t)} · {i.purchasePriceCAD ?? 0} CAD</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {canManageSuppliers && (
                  <button type="button" onClick={() => { setSelectedSupplierId(null); onEditSupplier(s); }} className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px]">
                    <Pencil className="h-4 w-4 inline mr-2" />
                    {tl.edit ?? "Editar"}
                  </button>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* Drawer detalle activo + historial de uso */}
      {selectedAsset && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" aria-hidden onClick={() => setSelectedAsset(null)} />
            <div className="fixed z-50 w-full border-zinc-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[90vh] max-md:overflow-y-auto max-md:rounded-t-2xl max-md:rounded-b-none max-md:border max-md:pb-[max(1rem,env(safe-area-inset-bottom))] sm:right-0 sm:top-0 sm:bottom-0 sm:max-w-md sm:overflow-y-auto sm:border-l md:max-w-lg lg:max-w-xl">
            <div className="p-4 border-b border-zinc-200 dark:border-slate-700 flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold text-zinc-900 break-words dark:text-white">
                  {selectedAsset.type === "inventory"
                    ? (inventoryItems ?? []).find((i) => i.id === selectedAsset.id)?.name ?? selectedAsset.id
                    : (vehicles ?? []).find((v) => v.id === selectedAsset.id)?.plate ?? selectedAsset.id}
                </h3>
                {selectedAsset.type === "inventory" && (() => {
                  const it = (inventoryItems ?? []).find((i) => i.id === selectedAsset.id);
                  if (!it) return null;
                  const tx = t as Record<string, string>;
                  const typeLbl =
                    it.type === "consumable" || it.type === "material"
                      ? (tx.inventory_type_material ?? "Material")
                      : it.type === "equipment"
                        ? (tlLabels.equipment ?? "Equipment")
                        : (tx.inventory_type_tool ?? t.whTabTools ?? "Tool");
                  return (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">{typeLbl}</span>
                      {isTrackedAsset(it) ? (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toolStatusBadgeClass(it.toolStatus)}`}>
                          {getStatusLabel(it.toolStatus === "available" ? "available" : it.toolStatus === "in_use" ? "inUse" : it.toolStatus === "maintenance" ? "maintenance" : it.toolStatus === "out_of_service" ? "outOfService" : "lost")}
                        </span>
                      ) : null}
                      {it.incidentPhotoUrl && (
                        <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full px-2 py-0.5">⚠ {tlLabels.incidentReported ?? "Incident"}</span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <button type="button" onClick={() => setSelectedAsset(null)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0">
                <X className="h-5 w-5" />
              </button>
            </div>
            {selectedAsset.type === "inventory" && (() => {
              const item = (inventoryItems ?? []).find((i) => i.id === selectedAsset.id);
              const qrUrl = item?.qrCode ?? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(selectedAsset.id)}`;
              const tl = t as Record<string, string>;
              const toolLogs = logsForAsset(selectedAsset.id, "inventory");
              const galleryPhotos: { url: string; type: "incident" | "return"; condition?: "good" | "damaged" | "maintenance"; label: string; date: string }[] = [];
              if (item?.incidentPhotoUrl) galleryPhotos.push({ url: item.incidentPhotoUrl, type: "incident", label: tl.incidentReported ?? "Incident", date: "—" });
              toolLogs.forEach((log) => {
                if (log.returnPhotoUrl) galleryPhotos.push({ url: log.returnPhotoUrl, type: "return", condition: log.returnCondition, label: log.returnCondition === "good" ? (tl.conditionGood ?? "Sana") : log.returnCondition === "damaged" ? (tl.conditionDamaged ?? "Dañada") : (tl.conditionMaintenance ?? "Mantenimiento"), date: log.endDate ?? log.startDate ?? "—" });
              });
              return (
                <>
                  <div className="flex border-b border-zinc-200 dark:border-slate-700 p-2 gap-1">
                    {(["info", "history", "gallery"] as const).map((tabId) => (
                      <button key={tabId} type="button" onClick={() => setAssetDrawerTab(tabId)} className={`min-h-[44px] flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${assetDrawerTab === tabId ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
                        {tabId === "info"
                          ? ((t as Record<string, string>).settings_general_title ?? "Info")
                          : tabId === "history"
                            ? (t.usageHistory ?? "Historial")
                            : (tl.assetGallery ?? "Galería")}
                      </button>
                    ))}
                  </div>
                  {assetDrawerTab === "info" && (
                    <div className="p-4 border-b border-zinc-200 dark:border-slate-700 space-y-3">
                      <img
                        src={qrUrl}
                        alt={(t as Record<string, string>).inventory_qr_print ?? (t as Record<string, string>).inventory_qr_scan ?? "QR"}
                        className="h-24 w-24 rounded-lg object-contain bg-white"
                      />
                      {canPrintInventoryQR ? (
                        <button
                          type="button"
                          disabled={inventoryQrPdfLoading}
                          onClick={() => {
                            void (async () => {
                              setInventoryQrPdfLoading(true);
                              try {
                                const statusLbl =
                                  item?.toolStatus === "in_use"
                                    ? ((t as Record<string, string>).inventory_status_onsite ?? "On site")
                                    : item?.toolStatus === "maintenance"
                                      ? ((t as Record<string, string>).inventory_status_maintenance ?? "Maintenance")
                                      : ((t as Record<string, string>).inventory_status_available ?? "Available");
                                const { blob, filename } = await generateInventoryQrLabelPdf({
                                  labels: t as Record<string, string>,
                                  companyName: companyName || "MachinPro",
                                  companyLogoUrl: companyLogoUrl?.trim() || undefined,
                                  itemName: item?.name ?? "",
                                  itemCode: item?.serialNumber ?? item?.internalId ?? item?.id ?? "",
                                  statusLabel:
                                    item && isTrackedAsset(item)
                                      ? statusLbl
                                      : `${(t as Record<string, string>).inventory_current_stock ?? "Stock"}: ${item?.quantity ?? 0}`,
                                  qrDataUrl: qrUrl,
                                });
                                const href = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = href;
                                a.download = filename;
                                a.click();
                                URL.revokeObjectURL(href);
                                showToast("success", tlLabels.saved_successfully ?? "Guardado");
                              } catch (e) {
                                showToast("error", userFacingErrorMessage(tlLabels, e));
                              } finally {
                                setInventoryQrPdfLoading(false);
                              }
                            })();
                          }}
                          className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          {inventoryQrPdfLoading ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                          ) : null}
                          {(t as Record<string, string>).inventory_qr_print ?? tl.printLabel ?? "Print QR"}
                        </button>
                      ) : (
                        <button type="button" onClick={() => window.open(qrUrl, "_blank")} className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px] hover:bg-zinc-50 dark:hover:bg-zinc-800">
                          {tl.printLabel ?? "Imprimir etiqueta"}
                        </button>
                      )}
                      {item && (
                        <div className="space-y-1.5 text-sm">
                          {item.assignedToProjectId && (
                            <p className="text-zinc-600 dark:text-zinc-400"><span className="font-medium text-zinc-700 dark:text-zinc-300">{tl.assignedProject ?? "Proyecto"}:</span> {getProjectName(item.assignedToProjectId)}</p>
                          )}
                          {item.assignedToEmployeeId && (
                            <p className="text-zinc-600 dark:text-zinc-400"><span className="font-medium text-zinc-700 dark:text-zinc-300">{tl.assignedEmployee ?? "Empleado"}:</span> {getEmployeeName(item.assignedToEmployeeId)}</p>
                          )}
                          {(item.serialNumber || item.internalId) && (
                            <p className="text-zinc-600 dark:text-zinc-400">
                              <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.serialNumber ? (tl.serialNumber ?? "Nº serie") : (tl.internalId ?? "ID interno")}:</span> {item.serialNumber ?? item.internalId ?? item.id}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {assetDrawerTab === "gallery" && (
                    <div className="p-4 border-b border-zinc-200 dark:border-slate-700">
                      <h4 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">{tl.assetGallery ?? "Galería"}</h4>
                      {galleryPhotos.length === 0 ? (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{tlLabels.noAssetPhotos ?? "No photos for this asset yet"}</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {galleryPhotos.map((photo, idx) => (
                            <div key={idx} className="relative">
                              <img src={cloudinaryThumb(photo.url)} alt="" className="w-full h-28 object-cover rounded-xl cursor-pointer border border-zinc-200 dark:border-slate-700" onClick={() => setLightboxUrl(photo.url)} />
                              <span className={`absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-xs font-medium ${photo.type === "incident" ? "bg-red-500 text-white" : photo.condition === "good" ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"}`}>
                                {photo.label}
                              </span>
                              <span className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1 rounded">{photo.date}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
            {selectedAsset.type === "vehicle" && (() => {
              const v = (vehicles ?? []).find((x) => x.id === selectedAsset.id);
              const qrUrl = v?.qrCode ?? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(selectedAsset.id)}`;
              const tl = t as Record<string, string>;
              return (
                <>
                  <div className="p-4 border-b border-zinc-200 dark:border-slate-700 space-y-2">
                    <img
                      src={qrUrl}
                      alt={(t as Record<string, string>).inventory_qr_print ?? (t as Record<string, string>).inventory_qr_scan ?? "QR"}
                      className="h-24 w-24 rounded-lg object-contain bg-white"
                    />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{v?.internalId ?? v?.serialNumber ?? v?.id}</p>
                    <button type="button" onClick={() => window.open(qrUrl, "_blank")} className="w-full rounded-xl border border-zinc-300 dark:border-zinc-600 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 min-h-[44px] hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      {tl.printLabel ?? "Imprimir etiqueta"}
                    </button>
                  </div>
                  {v && (
                    <div className="p-4 border-b border-zinc-200 dark:border-slate-700 space-y-3">
                      <h4 className="text-sm font-medium text-zinc-900 dark:text-white">{tl.docsSectionTitle ?? "Documentación"}</h4>
                      {(complianceFields ?? []).filter((f) => f.target.includes("vehicle")).length > 0 ? (
                        <div className="space-y-0">
                          {(complianceFields ?? [])
                            .filter((f) => f.target.includes("vehicle"))
                            .map((field) => {
                              const record = (complianceRecords ?? []).find(
                                (r) => r.fieldId === field.id && r.targetType === "vehicle" && r.targetId === v.id
                              );
                              return (
                                <div key={field.id} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 gap-2 flex-wrap">
                                  <div>
                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{field.name}</p>
                                    {record?.expiryDate && (
                                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{(tl.expiresOn ?? "Vence")}: {record.expiryDate}</p>
                                    )}
                                    {record?.documentUrl && (
                                      <a href={record.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-600 dark:text-orange-400 inline-flex items-center gap-1 hover:underline">
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {getVehicleComplianceStatusBadge(record, tl)}
                                    {canManageFleet && onComplianceRecordsChange && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingVehicleCompliance({ field, targetId: v.id });
                                          setVehicleComplianceDraft({ value: record?.value, expiryDate: record?.expiryDate, documentUrl: record?.documentUrl });
                                        }}
                                        className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-zinc-600 dark:text-zinc-400">{tl.docInsurance ?? "Insurance"}: {v.insuranceExpiry || "—"}</span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              {v.insuranceDocUrl ? <FileCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <FileX className="h-4 w-4 text-red-500 dark:text-red-400" />}
                              {v.insuranceDocUrl && (
                                <a href={v.insuranceDocUrl} target="_blank" rel="noopener noreferrer" className="text-orange-600 dark:text-orange-400 inline-flex items-center gap-1 hover:underline">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-zinc-600 dark:text-zinc-400">{vehicleInspectionLabel}: {v.inspectionExpiry || "—"}</span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              {v.inspectionDocUrl ? <FileCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : <FileX className="h-4 w-4 text-red-500 dark:text-red-400" />}
                              {v.inspectionDocUrl && (
                                <a href={v.inspectionDocUrl} target="_blank" rel="noopener noreferrer" className="text-orange-600 dark:text-orange-400 inline-flex items-center gap-1 hover:underline">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-zinc-600 dark:text-zinc-400">{tl.docRegistration ?? "Matriculación"}</span>
                            {v.registrationDocUrl ? (
                              <a href={v.registrationDocUrl} target="_blank" rel="noopener noreferrer" className="text-orange-600 dark:text-orange-400 inline-flex items-center gap-1 hover:underline text-sm" aria-label={tl.docRegistration ?? "Registration"}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : (
                              <span className="text-zinc-400 dark:text-zinc-500 text-xs">—</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
            <div className="p-4 space-y-4">
              {selectedAsset.type === "inventory" && assetDrawerTab === "history" && canViewInventoryHistory ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-zinc-900 dark:text-white">
                    {(t as Record<string, string>).inventory_history ?? "Movement history"}
                  </h4>
                  <ul className="max-h-48 space-y-2 overflow-y-auto">
                    {(inventoryMovements ?? [])
                      .filter((m) => m.itemId === selectedAsset.id)
                      .slice(-40)
                      .reverse()
                      .map((mov) => {
                        const tx = t as Record<string, string>;
                        return (
                          <li key={mov.id} className="border-l-2 border-orange-300 pl-2 text-xs dark:border-orange-700">
                            <span className="text-zinc-500 dark:text-zinc-400">
                              {mov.createdAt?.slice(0, 16).replace("T", " ")}
                            </span>
                            <span className="ml-2 font-medium text-zinc-800 dark:text-zinc-100">
                              {ledgerMovementLabel(mov.movementType, tx)}
                              {mov.quantity != null && mov.quantity > 0 ? ` · ${mov.quantity}` : ""}
                            </span>
                            {mov.performedByName ? (
                              <span className="ml-1 text-zinc-500">· {mov.performedByName}</span>
                            ) : null}
                            {mov.notes ? <p className="text-zinc-500 dark:text-zinc-400">{mov.notes}</p> : null}
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ) : null}
              {(selectedAsset.type !== "inventory" || assetDrawerTab === "history") && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-zinc-900 dark:text-white">
                    {t.usageHistory ?? "Historial de uso"}
                  </h4>
                  {logsForAsset(
                    selectedAsset.id,
                    selectedAsset.type === "vehicle" ? "vehicle" : "inventory"
                  ).length === 0 ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t.noUsageHistory ?? "No usage history"}
                    </p>
                  ) : (
                    logsForAsset(
                      selectedAsset.id,
                      selectedAsset.type === "vehicle" ? "vehicle" : "inventory"
                    ).map((log) => {
                      const employeeName =
                        (employees ?? []).find((e) => e.id === log.employeeId)?.name ?? log.employeeId;
                      const projectName = getProjectName(log.projectId);
                      return (
                        <div
                          key={log.id}
                          className="flex items-start gap-2 text-xs border-l-2 border-amber-300 dark:border-amber-600 pl-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">
                              {employeeName} — {projectName}
                            </p>
                            <p className="text-zinc-500 dark:text-zinc-400">
                              {log.startDate} → {log.endDate ?? (t.inUse ?? "En uso")}
                            </p>
                            {log.returnPhotoUrl && (
                              <img
                                src={cloudinaryThumb(log.returnPhotoUrl)}
                                alt={tlLabels.wh_return_condition_photo_alt ?? "Return photo"}
                                className="mt-1 h-16 w-16 rounded-lg border border-zinc-200 object-cover dark:border-slate-700"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {editingVehicleCompliance && onComplianceRecordsChange && (() => {
        const { field, targetId } = editingVehicleCompliance;
        const tl = t as Record<string, string>;
        const existing = (complianceRecords ?? []).find(
          (r) => r.fieldId === field.id && r.targetType === "vehicle" && r.targetId === targetId
        );
        const saveRecord = () => {
          void (async () => {
            if (complianceSaveSubmitting) return;
            setComplianceSaveSubmitting(true);
            try {
              const expiryDate =
                field.fieldType === "date" ? (vehicleComplianceDraft.expiryDate || undefined) : undefined;
              const documentUrl =
                field.fieldType === "document" ? (vehicleComplianceDraft.documentUrl || undefined) : undefined;
              const value =
                field.fieldType === "text"
                  ? (vehicleComplianceDraft.value || undefined)
                  : field.fieldType === "checkbox"
                    ? vehicleComplianceDraft.value === "true"
                      ? "true"
                      : "false"
                    : undefined;
              let status: ComplianceRecord["status"] = "missing";
              if (field.fieldType === "date" && expiryDate) {
                status = computeVehicleComplianceStatus(expiryDate, field.alertDaysBefore, field.fieldType);
              } else if (field.fieldType === "checkbox") {
                status = value === "true" ? "valid" : "missing";
              } else if ((field.fieldType === "document" && documentUrl) || (field.fieldType === "text" && value)) {
                status = "valid";
              }
              const updated: ComplianceRecord = {
                id: existing?.id ?? "cr-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9),
                fieldId: field.id,
                targetType: "vehicle",
                targetId,
                value,
                expiryDate,
                documentUrl,
                status,
                updatedAt: new Date().toISOString(),
              };
              const rest = (complianceRecords ?? []).filter(
                (r) => !(r.fieldId === field.id && r.targetType === "vehicle" && r.targetId === targetId)
              );
              await Promise.resolve(onComplianceRecordsChange([...rest, updated]));
              setEditingVehicleCompliance(null);
              setVehicleComplianceDraft({});
              showToast("success", tlLabels.saved_successfully ?? "Guardado");
            } catch (err) {
              showToast("error", userFacingErrorMessage(tl, err));
            } finally {
              setComplianceSaveSubmitting(false);
            }
          })();
        };
        return (
          <>
            <div
              className="fixed inset-0 z-50 bg-black/50"
              aria-hidden
              onClick={() => {
                if (!complianceSaveSubmitting) {
                  setEditingVehicleCompliance(null);
                  setVehicleComplianceDraft({});
                }
              }}
            />
            <div
              role="dialog"
              aria-modal
              className="fixed z-50 max-h-[90vh] w-full overflow-y-auto border border-zinc-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900 max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[90vh] max-md:rounded-t-2xl max-md:rounded-b-none max-md:pb-[max(1rem,env(safe-area-inset-bottom))] sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6 md:max-w-lg lg:max-w-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-4 text-lg font-semibold text-zinc-900 break-words dark:text-white">{field.name}</h3>
              <div className="space-y-4">
                {field.fieldType === "date" && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{tl.fieldTypeDate ?? "Fecha vencimiento"}</label>
                    <input type="date" value={vehicleComplianceDraft.expiryDate ?? ""} onChange={(e) => setVehicleComplianceDraft((d) => ({ ...d, expiryDate: e.target.value || undefined }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]" />
                  </div>
                )}
                {field.fieldType === "document" && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      {tl.training_document_url ?? "URL"}
                    </label>
                    <input type="url" value={vehicleComplianceDraft.documentUrl ?? ""} onChange={(e) => setVehicleComplianceDraft((d) => ({ ...d, documentUrl: e.target.value || undefined }))} placeholder="https://" className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]" />
                  </div>
                )}
                {field.fieldType === "text" && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">{tl.value ?? "Valor"}</label>
                    <input type="text" value={vehicleComplianceDraft.value ?? ""} onChange={(e) => setVehicleComplianceDraft((d) => ({ ...d, value: e.target.value || undefined }))} className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm min-h-[44px]" />
                  </div>
                )}
                {field.fieldType === "checkbox" && (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={vehicleComplianceDraft.value === "true"} onChange={(e) => setVehicleComplianceDraft((d) => ({ ...d, value: e.target.checked ? "true" : "false" }))} className="rounded border-zinc-300 dark:border-zinc-600" />
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{tl.yes ?? "Sí"}</span>
                  </div>
                )}
              </div>
              <div className="mt-6 flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-end">
                <button
                  type="button"
                  disabled={complianceSaveSubmitting}
                  onClick={() => {
                    setEditingVehicleCompliance(null);
                    setVehicleComplianceDraft({});
                  }}
                  className="order-1 w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 min-h-[44px] min-[480px]:order-none min-[480px]:w-auto disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300"
                >
                  {tl.cancel ?? "Cancelar"}
                </button>
                <button
                  type="button"
                  disabled={complianceSaveSubmitting}
                  onClick={saveRecord}
                  className="order-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white min-h-[44px] hover:bg-amber-500 min-[480px]:order-none min-[480px]:w-auto disabled:opacity-50"
                >
                  {complianceSaveSubmitting ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  ) : null}
                  {tl.save ?? "Guardar"}
                </button>
              </div>
            </div>
          </>
        );
      })()}

      {deletePrompt && (
        <>
          <div
            className="fixed inset-0 z-[10070] bg-black/50"
            aria-hidden
            onClick={() => {
              if (!deleteSubmitting) setDeletePrompt(null);
            }}
          />
          <div
            role="dialog"
            aria-modal
            className="fixed z-[10071] max-h-[90vh] w-full overflow-y-auto border border-zinc-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900 max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[90vh] max-md:rounded-t-2xl max-md:rounded-b-none max-md:pb-[max(1rem,env(safe-area-inset-bottom))] sm:left-1/2 sm:top-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {tlLabels.common_delete ?? tlLabels.delete ?? "Delete"}
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {tlLabels.common_confirm_delete ?? "Delete this item?"}
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-800 break-words dark:text-zinc-200">
              {deletePrompt.label}
            </p>
            <div className="mt-6 flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={() => setDeletePrompt(null)}
                className="order-1 w-full rounded-lg border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 min-h-[44px] min-[480px]:order-none min-[480px]:w-auto disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200"
              >
                {tlLabels.cancel ?? tlLabels.whClose ?? "Cancel"}
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={() => void commitDelete()}
                className="order-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white min-h-[44px] hover:bg-red-700 min-[480px]:order-none min-[480px]:w-auto disabled:opacity-50"
              >
                {deleteSubmitting ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                ) : null}
                {tlLabels.common_delete ?? tlLabels.delete ?? "Delete"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Lightbox foto */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <button type="button" className="absolute top-4 right-4 text-white/70 hover:text-white p-2.5 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center" onClick={() => setLightboxUrl(null)}>
            <X className="h-6 w-6" />
          </button>
          <img src={cloudinaryFull(lightboxUrl)} alt="" className="max-w-full max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </section>
  );
}

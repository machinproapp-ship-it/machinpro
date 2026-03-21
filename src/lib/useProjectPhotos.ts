import { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import { logAuditEvent } from "./useAuditLog";

export type ProjectPhoto = {
  id: string;
  company_id: string;
  project_id: string;
  photo_url: string;
  photo_category: "progress" | "incident" | "health_safety";
  photo_type: "obra" | "inventario";
  status: "pending" | "approved" | "rejected";
  notes?: string;
  submitted_by_employee_id?: string;
  submitted_by_name?: string;
  project_name?: string;
  location?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_reason?: string;
  created_at: string;
  gps_lat?: number;
  gps_lng?: number;
  gps_accuracy?: number;
  device_info?: string;
  signature_url?: string;
  signature_by?: string;
  signature_at?: string;
  pdf_url?: string;
  pdf_generated_at?: string;
  sequence_number?: number;
  weather_conditions?: string;
  tags?: string[];
};

export function useProjectPhotos(companyId: string | null) {
  const [photos, setPhotos] = useState<ProjectPhoto[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPhotos = useCallback(async () => {
    if (!companyId || !supabase) {
      setPhotos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("project_photos")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setPhotos((data as ProjectPhoto[]) ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    if (companyId) void fetchPhotos();
  }, [companyId, fetchPhotos]);

  useEffect(() => {
    if (!companyId || !supabase) return;
    const channel = supabase
      .channel("project_photos_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_photos",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          void fetchPhotos();
        }
      )
      .subscribe();
    return () => {
      if (supabase) void supabase.removeChannel(channel);
    };
  }, [companyId, fetchPhotos]);

  const uploadPhoto = useCallback(
    async (params: {
      projectId: string;
      projectName: string;
      photoUrl: string;
      photoCategory: "progress" | "incident" | "health_safety";
      photoType: "obra" | "inventario";
      submittedByEmployeeId?: string;
      submittedByName?: string;
      notes?: string;
      companyId: string;
    }) => {
      if (!supabase) return null;
      let gpsLat: number | undefined;
      let gpsLng: number | undefined;
      let gpsAccuracy: number | undefined;
      try {
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 5000,
              maximumAge: 60000,
              enableHighAccuracy: true,
            });
          });
          gpsLat = position.coords.latitude;
          gpsLng = position.coords.longitude;
          gpsAccuracy = position.coords.accuracy;
        }
      } catch {
        /* GPS no disponible, continuar sin él */
      }
      const deviceInfo =
        typeof navigator !== "undefined" && typeof navigator.userAgent === "string"
          ? navigator.userAgent.slice(0, 500)
          : undefined;
      const { data, error } = await supabase
        .from("project_photos")
        .insert({
          company_id: params.companyId,
          project_id: params.projectId,
          project_name: params.projectName,
          photo_url: params.photoUrl,
          photo_category: params.photoCategory,
          photo_type: params.photoType,
          submitted_by_employee_id: params.submittedByEmployeeId,
          submitted_by_name: params.submittedByName,
          notes: params.notes,
          status: "pending",
          gps_lat: gpsLat,
          gps_lng: gpsLng,
          gps_accuracy: gpsAccuracy,
          ...(deviceInfo ? { device_info: deviceInfo } : {}),
        })
        .select("id")
        .single();
      if (error) return null;
      await fetchPhotos();
      const newId = data?.id as string | undefined;
      if (newId) {
        const { data: authData } = await supabase.auth.getUser();
        void logAuditEvent({
          company_id: params.companyId,
          user_id: authData?.user?.id ?? "",
          user_name: params.submittedByName,
          action: "photo_uploaded",
          entity_type: "photo",
          entity_id: newId,
          entity_name: params.projectName,
          new_value: { category: params.photoCategory, type: params.photoType },
        });
      }
      return newId ?? null;
    },
    [fetchPhotos]
  );

  const approvePhoto = useCallback(
    async (photoId: string, approvedBy: string) => {
      if (!supabase) return;
      await supabase
        .from("project_photos")
        .update({
          status: "approved",
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
        })
        .eq("id", photoId);
      await fetchPhotos();
    },
    [fetchPhotos]
  );

  const rejectPhoto = useCallback(
    async (photoId: string, reason?: string) => {
      if (!supabase) return;
      await supabase
        .from("project_photos")
        .update({
          status: "rejected",
          rejected_reason: reason ?? "",
        })
        .eq("id", photoId);
      await fetchPhotos();
    },
    [fetchPhotos]
  );

  return { photos, loading, uploadPhoto, approvePhoto, rejectPhoto, fetchPhotos };
}

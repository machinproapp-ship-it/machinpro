"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo } from "react";
import { EVENTS, STATUS, type Step } from "react-joyride";

const Joyride = dynamic(() => import("react-joyride").then((m) => m.Joyride), { ssr: false });

export type ProductTourProps = {
  run: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
  t: Record<string, string>;
  companyName?: string;
};

const L = (dict: Record<string, string>, key: string, fb: string) => dict[key] ?? fb;

export function ProductTour({ run, onComplete, onSkip, t, companyName: _companyName }: ProductTourProps) {
  void _companyName;

  const steps: Step[] = useMemo(
    () => [
      {
        target: "#dashboard-management-cards",
        title: L(t, "tour_step1_title", "El pulso de tu empresa"),
        content: L(
          t,
          "tour_step1_content",
          "Aquí tienes en tiempo real: empleados activos, proyectos en marcha y alertas de seguridad. Menos Excel, más control."
        ),
        placement: "bottom",
      },
      {
        target: "#settings-nav-item",
        title: L(t, "tour_step2_title", "Tu Catálogo Maestro"),
        content: L(
          t,
          "tour_step2_content",
          "Configura tus precios una sola vez. MachinPro los aplica automáticamente a todas tus obras."
        ),
        placement: "right",
      },
      {
        target: "#operations-nav-item",
        title: L(t, "tour_step3_title", "Cada obra, bajo control"),
        content: L(
          t,
          "tour_step3_content",
          "Crea tu proyecto y asigna tareas del catálogo. Puedes ajustar precios por obra — total flexibilidad."
        ),
        placement: "right",
      },
      {
        target: "#schedule-nav-item",
        title: L(t, "tour_step4_title", "Producción en tiempo real"),
        content: L(
          t,
          "tour_step4_content",
          "Tus empleados reportan desde el móvil. El sistema calcula el coste automáticamente."
        ),
        placement: "right",
      },
      {
        target: "#operations-nav-item",
        title: L(t, "tour_step5_title", "Tu recepción digital"),
        content: L(
          t,
          "tour_step5_content",
          "Genera un QR para cada obra. Cada visita se registra sola — digital, legal y automático."
        ),
        placement: "right",
      },
    ],
    [t]
  );

  const handleEvent = useCallback(
    (data: { type: string; status?: string }) => {
      if (data.type !== EVENTS.TOUR_END) return;
      try {
        localStorage.setItem("machinpro_tour_completed", "true");
      } catch {
        /* ignore */
      }
      if (data.status === STATUS.SKIPPED) {
        onSkip?.();
      } else {
        onComplete?.();
      }
    },
    [onComplete, onSkip]
  );

  const locale = useMemo(
    () => ({
      back: L(t, "tour_back", "← Atrás"),
      next: L(t, "tour_next", "Siguiente →"),
      skip: L(t, "tour_skip", "Saltar tour"),
      last: L(t, "tour_finish", "¡Empezar!"),
      close: L(t, "common_close", "Close"),
    }),
    [t]
  );

  return (
    <Joyride
      run={run}
      steps={steps}
      continuous
      scrollToFirstStep
      locale={locale}
      onEvent={handleEvent}
      options={{
        primaryColor: "#f59e0b",
        overlayColor: "rgba(0,0,0,0.5)",
        spotlightRadius: 12,
        zIndex: 10050,
        buttons: ["back", "skip", "primary"],
      }}
      styles={{
        tooltip: { borderRadius: 12 },
        tooltipContainer: { borderRadius: 12, textAlign: "left" },
        buttonPrimary: { borderRadius: 8 },
        buttonBack: { borderRadius: 8 },
        buttonSkip: { borderRadius: 8 },
        buttonClose: { borderRadius: 8 },
      }}
    />
  );
}

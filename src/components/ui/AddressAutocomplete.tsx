"use client";

import { useEffect, useRef, useCallback } from "react";

const SCRIPT_ID = "machinpro-google-maps-places";

function getMapsKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || undefined;
}

function loadPlacesScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const g = window as Window & { google?: { maps?: { places?: unknown } } };
  if (g.google?.maps?.places) return Promise.resolve();

  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing?.dataset.loaded === "1") return Promise.resolve();
  if (existing) {
    return new Promise((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => {
        if ((window as Window & { google?: { maps?: { places?: unknown } } }).google?.maps?.places) {
          resolve();
          return;
        }
        if (Date.now() - t0 > 15000) {
          reject(new Error("timeout"));
          return;
        }
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => reject(new Error("maps_script"));
    document.head.appendChild(s);
  });
}

export type AddressAutocompleteProps = {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  autoComplete?: string;
  /** When user picks a suggestion, optional lat/lng from Places geometry. */
  onPlaceResolved?: (detail: { formattedAddress: string; lat?: number; lng?: number }) => void;
};

/**
 * Google Places Autocomplete when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set; otherwise a plain text input.
 */
export function AddressAutocomplete({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  className,
  autoComplete = "street-address",
  onPlaceResolved,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef = useRef<unknown>(null);
  const onChangeRef = useRef(onChange);
  const onPlaceRef = useRef(onPlaceResolved);
  onChangeRef.current = onChange;
  onPlaceRef.current = onPlaceResolved;

  const attach = useCallback(() => {
    const el = inputRef.current;
    const key = getMapsKey();
    if (!el || !key) return;

    void loadPlacesScript(key)
      .then(() => {
        const g = window as Window & {
          google?: { maps?: { places?: { Autocomplete: new (el: HTMLInputElement, opts?: object) => unknown } } };
        };
        const AC = g.google?.maps?.places?.Autocomplete;
        if (!AC || acRef.current) return;
        const ac = new AC(el, {
          fields: ["formatted_address", "geometry", "name"],
          types: ["address"],
        }) as {
          addListener: (ev: string, fn: () => void) => void;
          getPlace: () => {
            formatted_address?: string;
            name?: string;
            geometry?: { location?: { lat: () => number; lng: () => number } };
          };
        };
        acRef.current = ac;
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          const formatted =
            (typeof place.formatted_address === "string" && place.formatted_address.trim()) ||
            (typeof place.name === "string" && place.name.trim()) ||
            el.value;
          onChangeRef.current(formatted);
          const loc = place.geometry?.location;
          const lat = loc && typeof loc.lat === "function" ? loc.lat() : undefined;
          const lng = loc && typeof loc.lng === "function" ? loc.lng() : undefined;
          onPlaceRef.current?.({
            formattedAddress: formatted,
            lat: typeof lat === "number" && Number.isFinite(lat) ? lat : undefined,
            lng: typeof lng === "number" && Number.isFinite(lng) ? lng : undefined,
          });
        });
      })
      .catch(() => {
        /* fallback: plain input */
      });
  }, []);

  useEffect(() => {
    if (!getMapsKey()) return;
    attach();
    return () => {
      const inst = acRef.current;
      if (inst) {
        try {
          const ev = (
            window as Window & {
              google?: { maps?: { event?: { clearInstanceListeners: (x: unknown) => void } } };
            }
          ).google?.maps?.event;
          ev?.clearInstanceListeners?.(inst);
        } catch {
          /* ignore */
        }
        acRef.current = null;
      }
    };
  }, [attach]);

  const key = getMapsKey();

  return (
    <div className={key ? "relative z-[60] w-full min-w-0" : "w-full min-w-0"}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        autoComplete={key ? "off" : autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
    </div>
  );
}

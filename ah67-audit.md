# AH-67 · Fase 1 — Auditoría de rendimiento (solo lectura)

Fecha: auditoría de código en repo `machinpro`.  
Restricciones respetadas: sin cambios funcionales en esta fase; no se tocó `postcss`, `tailwind.config`, `globals.css`, `next.config`.

---

## 1. Fetches por tabla (grep en `src/`)

### `companies`
- **`src/app/page.tsx`**: dos usos en cliente con **fines distintos**:
  - ~L1578–1604: `.select("onboarding_complete")` al montar (sesión + companyId).
  - ~L3109–3114: FASE 0 del hidratar dashboard — `.select("name, logo_url, address, …")` (bloque grande office).
- **`src/components/CentralDashboardLive.tsx`**: ~L954 — `.select("dashboard_config")` junto con `user_profiles` en `Promise.all` dentro de `loadDashboardConfig`.
- Resto: rutas API servidor, cron, superadmin, onboarding, etc. (no cuentan como “mismo fetch de app” pero suman tráfico si se invocan).

**Conclusión**: posible **solapamiento conceptual** (varias lecturas a `companies` en la misma sesión). Consolidar requiere cuidado: columnas distintas (`onboarding_complete` vs perfil completo vs `dashboard_config`).

### `subscriptions`
- **`src/lib/useSubscription.ts`**: `useEffect` + `refresh` hace `.from("subscriptions").select("*")`; además **intervalo 10 min** con `refresh({ silent: true })`.
- **`src/app/page.tsx`**: usa `useSubscription(companyId)` (~L1390). No hay otro `.from("subscriptions")` en `page.tsx`.

**Conclusión**: duplicados observados en Network pueden deberse a **React Strict Mode (doble efecto en dev)**, remontaje al cambiar `companyId`, o a **intervalo**; no hay segundo hook obvio en página.

### `form_templates` / `form_instances`
- En **`.tsx`**: no aparece `.from("form_templates")` ni `.from("form_instances")` directo en componentes (solo `src/app/api/...` y **`src/lib/formInstancesDb.ts`**).
- **`page.tsx`**: formularios locales + `saveFormInstanceToSupabase` / loaders en `formInstancesDb` — los duplicados si existen serían por **múltiples efectos** que llamen a las mismas funciones de lib, no por grep literal de tabla en tsx.

### `rentals`
- **`src/app/page.tsx`**:
  - ~L4529–4556: `useEffect` carga listado `.from("rentals").select("*")`.
  - ~L7463–7467: **update** puntual al borrar (no es duplicado de lectura).

**Conclusión**: una lectura principal listado; si Network muestra 2 GET, revisar ** Strict Mode** o segunda ruta de código (p. ej. hidratar desde caché vs refetch).

### `audit_logs`
- **`src/app/page.tsx`**: dentro del `Promise.all` FASE 1 (~L3164–3171) — lista acotada (limit 20).
- **`src/components/CentralDashboardLive.tsx`**: pipeline `auditPipeline` (~L1356–1363) — limit 36, columnas distintas (`new_value` incluido), caché 60s en memoria.

**Conclusión**: **dos lecturas independientes** de la misma tabla en app autenticada (office hydration vs widget Central). Candidato claro a **deduplicar o alimentar el widget desde datos ya cargados** en Fase 3.

### `user_profiles`
- **`src/app/page.tsx`**:
  - ~L3150–3156: select masivo empleados/profiles (FASE 1).
  - ~L4737–4745: **update** del perfil del usuario (no lectura listado).
- **`src/components/CentralDashboardLive.tsx`**:
  - ~L954–955: `dashboard_config` del usuario actual.
  - **`fetchCentralUserProfilesMerged`** (~L609–613): `.in("id", missing)` para snippets de auditoría (caché module-level `centralUserProfileRowsByKey`).

**Conclusión**: varias lecturas con **proyecciones distintas**; el mapa en Central mitiga repetición para IDs de audit, pero **sigue habiendo** al menos full list (page) + dashboard_config (Central) + fetches incrementales audit.

---

## 2. `CentralDashboardLive.tsx` — TODO / FIXME (AH-63)

- Búsqueda `TODO` / `FIXME` / `AH-63` / `dedup` en el archivo: **sin coincidencias**.
- Comentario relevante en **`src/app/page.tsx`** ~L3109: *"FASE 0: companies solamente (perfiles en FASE 1 — evita 2.ª query duplicada a `user_profiles`)"* — indica que **ya hubo** trabajo parcial de ordenar fetches en office.
- **Recomendación Fase 3**: localizar en `CentralDashboardLive` los pipelines (`loadDashboardConfig`, `auditPipeline`, `fetchCentralUserProfilesMerged`) y alinear con datos que `page.tsx` ya posee (sin cambiar UI).

---

## 3. Estado global / data fetching libraries

- **`package.json`**: no hay `zustand`, `@tanstack/react-query`, `swr`.
- **Patrón actual**: `useState` / `useEffect` en `page.tsx`, hooks (`useSubscription`), caché en `localStorage` y **Map** en módulo en `CentralDashboardLive`.

---

## 4. Estructura landing

- **`src/app/landing/page.tsx`**: página principal (cliente), ya usa `dynamic` para `LandingPwaInstallBar`.
- **`src/app/landing/layout.tsx`**, **`src/app/landing/LandingJsonLd.tsx`**: metadata / JSON-LD.
- **`src/components/landing/`**: **no existe** (ruta vacía o inexistente).
- Componentes de landing importados desde raíz: `PricingPlansPublic`, `PppLandingFooter`, `BrandLogoImage`, `LandingLanguageSelect`, etc.

---

## 5. `robots.txt`

- No hay `public/robots.txt` listado; existe **`src/app/robots.ts`** (Next Metadata Route).
- Genera `allow: "/"`, `disallow` para `/dashboard`, `/api`, `/admin`, y `sitemap` con base `NEXT_PUBLIC_SITE_URL` o `https://machin.pro`.
- Si PageSpeed marcó “robots no válido”, revisar: **validación del crawler**, conflicto con **proxy/CDN**, o expectativa de fichero estático en `/robots.txt` (la ruta App Router debería servirlo).

---

## 6. Dependencias pesadas (`package.json`)

| Paquete            | Notas breves                                      |
|--------------------|---------------------------------------------------|
| `pdfjs-dist`       | Muy pesado si se importa en bundle cliente      |
| `jspdf` / `html2canvas` | PDF / capturas en cliente                    |
| `leaflet` / `react-leaflet` | Mapas                         |
| `xlsx`             | Excel                                             |
| `canvas` (node)    | Uso típico servidor/build                       |
| `html5-qrcode`     | QR (Logística)                                    |
| `next-pwa`         | Service worker                                    |
| `react-joyride`    | Tours                                             |
| `@stripe/stripe-js`| Checkout                                          |

No hay **Recharts** en dependencias actuales (si existía en histórico, ya no está en `package.json`).

---

## 7. Browserslist / polyfills

- No hay campo **`browserslist`** en `package.json` (visible en lectura). Next/Babel usan defaults; para “JS antiguo” PageSpeed, Fase 2 puede proponer browserslist **solo si** no rompe targets necesarios.

---

## 8. Resumen de candidatos (Fases 2–4)

| Área        | Candidato                                                 |
|------------|------------------------------------------------------------|
| Landing    | LCP: hero + fuentes + imágenes; dynamic import secciones  |
| Landing    | `next/image`, `loading`/`decoding`, preconnect            |
| App        | `audit_logs`: page vs `CentralDashboardLive`              |
| App        | `companies`: onboarding + FASE0 + `dashboard_config`      |
| App        | `user_profiles`: lista page vs config + audit snippets    |
| Code split | Módulos sidebar ya parcialmente `dynamic` en `page.tsx` — revisar cobertura Fase 4 |

---

*Fin Fase 1 — listo para `tsc` + `build` + commit.*

# Google Analytics 4 (GA4) via Google Tag Manager

MachinPro loads **GTM** in production when `NEXT_PUBLIC_GTM_ID` is set (`layout.tsx`), initializes `window.dataLayer`, and pushes SPA **page_view** events in production when `NEXT_PUBLIC_GA4_MEASUREMENT_ID` is set (`src/components/Ga4RouteAnalytics.tsx`).

## Pasos exactos de configuración

1. Ir a [analytics.google.com](https://analytics.google.com).
2. Crear una propiedad **MachinPro** (GA4).
3. Configurar un **flujo de datos** tipo Web con URL `https://machin.pro`.
4. Copiar el **Measurement ID** (`G-XXXXXXXXXX`).
5. En **Vercel**, añadir la variable `NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX`.
6. En **Google Tag Manager** ([tagmanager.google.com](https://tagmanager.google.com)):
   - **Nueva etiqueta** → **GA4 Configuration**.
   - **Measurement ID**: puede ser la variable de entorno expuesta en GTM o pegar el mismo ID que en Vercel.
   - **Activador**: **All Pages** (o equivalente para todas las páginas).
   - **Publicar** el contenedor.
7. Verificar en GA4 → **Informes** → **Tiempo real** que aparecen visitas al navegar `machin.pro`.

## Detalle técnico en el código

- `NEXT_PUBLIC_GTM_ID`: snippet GTM en `layout.tsx` (solo producción).
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID`: usado por `Ga4RouteAnalytics` para empujar `page_view` al `dataLayer` en navegaciones cliente.

## Verificación

- DevTools → red: peticiones a `googletagmanager.com` / `google-analytics.com`.
- GA4 **Tiempo real** mientras abres varias rutas de la app.

# Google Analytics 4 (GA4) via Google Tag Manager

MachinPro exposes `NEXT_PUBLIC_GA4_MEASUREMENT_ID` for use in GTM and sends SPA `page_view` events on the data layer in production when this variable is set (see `src/components/Ga4RouteAnalytics.tsx` and root `layout.tsx`).

## Steps

1. **Create a GA4 property** at [analytics.google.com](https://analytics.google.com): Admin → Create property → GA4.
2. **Copy the Measurement ID** — format `G-XXXXXXXXXX` (Admin → Data streams → your web stream).
3. **In Google Tag Manager** ([tagmanager.google.com](https://tagmanager.google.com)), open the MachinPro container.
4. **Add a GA4 Configuration tag**: Tags → New → Google Analytics: GA4 Configuration → paste the Measurement ID.
5. **Trigger**: **All Pages** (or equivalent so the config fires on every page load).
6. **Variables in MachinPro**: set `NEXT_PUBLIC_GA4_MEASUREMENT_ID=G-XXXXXXXXXX` on Vercel so the app can push virtual pageviews on client-side navigations if needed.
7. **Publish** the GTM container.

Optional: create a Custom Event trigger for `page_view` if you configure GTM to listen for the same event name MachinPro pushes (`page_view` with `page_path` / `page_location`).

## Verification

- Browser DevTools → Network: requests to `google-analytics.com` / `googletagmanager.com`.
- GA4 **Realtime** report while browsing machin.pro.

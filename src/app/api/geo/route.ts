import { NextRequest, NextResponse } from "next/server";
import {
  discountPercentForPppTier,
  getPppTierFromCountryCode,
  type GeoTier,
} from "@/lib/geoTier";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  const v = (req.headers.get("x-vercel-ip-country") ?? "").trim().toUpperCase();
  const cf = (req.headers.get("cf-ipcountry") ?? "").trim().toUpperCase();
  const country = v || cf || "US";
  const tier = getPppTierFromCountryCode(country) as GeoTier;
  const discount = discountPercentForPppTier(tier);
  return NextResponse.json({
    country,
    tier,
    discount,
  });
}

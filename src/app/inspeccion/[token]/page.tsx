import type { Metadata } from "next";
import { InspectionView } from "./InspectionView";

export const metadata: Metadata = {
  title: "Registro de jornada",
  robots: { index: false, follow: false },
};

export default async function InspectionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = /^[0-9a-f-]{36}$/i.test(token) ? token : "00000000-0000-0000-0000-000000000000";
  return <InspectionView token={clean} />;
}

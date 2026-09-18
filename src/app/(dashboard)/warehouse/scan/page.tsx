import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ScanPageClient from "./ScanPageClient";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const { user } = await getSessionUser();
  if (!user || user.role !== "WAREHOUSE") redirect("/login");

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <ScanPageClient />
    </div>
  );
}

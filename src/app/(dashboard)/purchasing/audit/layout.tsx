import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function AuditLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") redirect("/login");
  if (user.approvalLevel === 1 || user.approvalLevel === 2) {
    redirect("/purchasing/purchase-orders");
  }
  return <>{children}</>;
}

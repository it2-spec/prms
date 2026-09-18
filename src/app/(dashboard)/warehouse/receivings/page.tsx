import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function WarehouseReceivingsPage() {
  redirect("/warehouse/history?tab=receiving");
}

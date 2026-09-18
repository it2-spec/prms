import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") redirect("/login");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: true },
  });

  return (
    <div className="space-y-4">
      <PageTitle
        title="Audit Log"
        subtitle="Seluruh perubahan transaksi dicatat (BR-010)"
        breadcrumb={["Audit Log"]}
      />
      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Waktu</th>
              <th className="px-5 py-3 font-medium">User</th>
              <th className="px-5 py-3 font-medium">Aksi</th>
              <th className="px-5 py-3 font-medium">Entity</th>
              <th className="px-5 py-3 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id} className="align-top">
                <td className="whitespace-nowrap px-5 py-3 text-slate-500">{formatDate(l.createdAt)}</td>
                <td className="px-5 py-3">{l.user?.name ?? "-"}</td>
                <td className="px-5 py-3">
                  <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-xs text-blue-700">
                    {l.action}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-600">{l.entityType}</td>
                <td className="px-5 py-3 text-slate-500">{l.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <EmptyState message="Belum ada audit log." />}
      </Card>
    </div>
  );
}

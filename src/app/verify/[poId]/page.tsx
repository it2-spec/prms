import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { ShieldCheck, ShieldAlert, ShieldX, FileText, User, CalendarCheck, Building2, Package } from "lucide-react";

export const dynamic = "force-dynamic";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDateID(date: Date | string | null | undefined): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(date));
}

function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

function formatDeliverySchedule(date: Date | string | null | undefined, type?: string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  if (type === "MONTH") {
    return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(d);
  }
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(d);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function VerifyPoPage({
  params,
}: {
  params: Promise<{ poId: string }>;
}) {
  const { poId } = await params;

  const po = await prisma.purchaseOrder.findUnique({
    where: { id: poId },
    include: {
      supplier: true,
      warehouse: true,
      createdBy: true,
      approvedBy: true,
      approvedL2By: true,
      details: {
        include: { item: true },
        orderBy: { item: { name: "asc" } },
      },
    },
  });

  if (!po) notFound();

  const totalValue = po.details.reduce((s, d) => s + d.qty * Number(d.unitPrice), 0);

  // Verifikasi integritas hash — dibuat saat L2 (Presdir) approve
  let hashStatus: "verified" | "tampered" | "not_approved" = "not_approved";
  if (po.approvedL2ById && po.verificationHash) {
    const expectedPayload = [
      po.id, po.poNumber, po.supplierId, po.createdById,
      po.poDate.toISOString(), totalValue.toString(),
    ].join("|");
    const expectedHash = crypto.createHash("sha256").update(expectedPayload).digest("hex");
    hashStatus = expectedHash === po.verificationHash ? "verified" : "tampered";
  } else if (po.approvedById && !po.approvedL2ById) {
    // L1 sudah, L2 belum
    hashStatus = "not_approved";
  }

  const isVerified = hashStatus === "verified";
  const isTampered = hashStatus === "tampered";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 py-8 px-4">
      {/* Verification Status Banner */}
      <div className="max-w-4xl mx-auto mb-6">
        {isVerified && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 shadow-sm">
            <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold text-emerald-800 text-base">✅ STATUS: DOKUMEN RESMI &amp; TERVERIFIKASI SISTEM</p>
              <p className="text-emerald-700 text-sm mt-0.5">
                Dokumen ini telah diverifikasi penuh oleh PRMS — disetujui Manager &amp; Presdir. Hash SHA-256 cocok.
              </p>
            </div>
          </div>
        )}
        {isTampered && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-4 shadow-sm">
            <ShieldX className="w-8 h-8 text-red-600 shrink-0" />
            <div>
              <p className="font-bold text-red-800 text-base">⚠️ PERINGATAN: INTEGRITAS DOKUMEN TIDAK VALID</p>
              <p className="text-red-700 text-sm mt-0.5">Data dokumen tidak cocok dengan hash yang tersimpan. Dokumen mungkin telah dimodifikasi.</p>
            </div>
          </div>
        )}
        {hashStatus === "not_approved" && !po.approvedById && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 shadow-sm">
            <ShieldAlert className="w-8 h-8 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-amber-800 text-base">⏳ DOKUMEN BELUM DISETUJUI</p>
              <p className="text-amber-700 text-sm mt-0.5">PO ini belum mendapatkan persetujuan apapun.</p>
            </div>
          </div>
        )}
        {po.approvedById && !po.approvedL2ById && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 shadow-sm">
            <ShieldAlert className="w-8 h-8 text-blue-600 shrink-0" />
            <div>
              <p className="font-bold text-blue-800 text-base">🔵 MENUNGGU PERSETUJUAN PRESDIR (L2)</p>
              <p className="text-blue-700 text-sm mt-0.5">Sudah disetujui Manager Purchasing. Menunggu persetujuan akhir dari Presdir.</p>
            </div>
          </div>
        )}
      </div>

      {/* Document Card */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header Dokumen */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-slate-300" />
            <div>
              <h1 className="text-lg font-bold tracking-wide">PURCHASE ORDER</h1>
              <p className="text-slate-400 text-sm font-mono">{po.poNumber}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-slate-400 text-xs">PT. SAKAE RIKEN INDONESIA</p>
            <p className="text-slate-300 text-xs mt-0.5">PRMS Verification Portal</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* Kolom Kiri */}
          <div className="p-6 space-y-4">
            {/* Pembuat PO */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <User className="w-4.5 h-4.5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Dibuat Oleh</p>
                <p className="text-slate-900 font-semibold">{po.createdBy.name}</p>
                <p className="text-xs text-slate-500">Purchasing · {formatDateID(po.poDate)}</p>
              </div>
            </div>

            {/* Approver L1: Manager */}
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${po.approvedById ? "bg-amber-50" : "bg-slate-50"}`}>
                <ShieldCheck className={`w-4.5 h-4.5 ${po.approvedById ? "text-amber-600" : "text-slate-400"}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">L1 — Manager Purchasing</p>
                {po.approvedBy && po.approvedAt ? (
                  <>
                    <p className="text-slate-900 font-semibold">{po.approvedBy.name}</p>
                    <p className="text-xs text-slate-500">{formatDateID(po.approvedAt)}</p>
                  </>
                ) : <p className="text-slate-400 text-sm italic">Belum disetujui</p>}
              </div>
            </div>

            {/* Approver L2: Presdir */}
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isVerified ? "bg-emerald-50" : "bg-slate-50"}`}>
                <ShieldCheck className={`w-4.5 h-4.5 ${isVerified ? "text-emerald-600" : "text-slate-400"}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">L2 — Presdir</p>
                {po.approvedL2By && po.approvedL2At ? (
                  <>
                    <p className="text-slate-900 font-semibold">{po.approvedL2By.name}</p>
                    <p className="text-xs text-slate-500">{formatDateID(po.approvedL2At)}</p>
                  </>
                ) : <p className="text-slate-400 text-sm italic">Menunggu persetujuan</p>}
              </div>
            </div>

            {/* Tujuan / Purpose */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                <Building2 className="w-4.5 h-4.5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Tujuan Penggunaan</p>
                <p className="text-slate-900 font-semibold">{po.purposeProject || "-"}</p>
                <p className="text-xs text-slate-500">Dept: {po.department || po.warehouse?.name || "-"}</p>
              </div>
            </div>

            {/* Jadwal Pengiriman */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                <CalendarCheck className="w-4.5 h-4.5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Jadwal Pengiriman</p>
                <p className="text-slate-900 font-semibold">
                  {formatDeliverySchedule(po.expectedDelivery, po.deliveryDateType)}
                </p>
                <p className="text-xs text-slate-500">ke {po.warehouse?.name ?? "SRI Warehouse"}</p>
              </div>
            </div>
          </div>

          {/* Kolom Kanan */}
          <div className="p-6 space-y-4">
            {/* Supplier */}
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Supplier</p>
              <p className="text-slate-900 font-bold text-base">{po.supplier.name}</p>
              {po.supplier.address && <p className="text-xs text-slate-500 mt-0.5">{po.supplier.address}</p>}
              {po.supplier.contactPerson && (
                <p className="text-xs text-slate-500">Attn: {po.supplier.contactPerson}</p>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Tanggal PO</span>
                <span className="font-medium text-slate-800">{formatDateShort(po.poDate)}</span>
              </div>
              {po.notes && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Quotation</span>
                  <span className="font-medium text-slate-800 text-right max-w-[200px] text-xs">{po.notes}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Nilai</span>
                <span className="font-bold text-slate-900">{formatMoney(totalValue)}</span>
              </div>
            </div>

            {/* Hash Verification */}
            {po.verificationHash && (
              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Hash Verifikasi (SHA-256)</p>
                <p className={`text-xs font-mono break-all leading-relaxed ${isVerified ? "text-emerald-600" : "text-red-500"}`}>
                  {po.verificationHash}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tabel Item */}
        <div className="border-t border-slate-100">
          <div className="px-6 py-3 bg-slate-50 flex items-center gap-2 border-b border-slate-100">
            <Package className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">Daftar Item ({po.details.length} baris)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-3 text-left font-medium">Item</th>
                  <th className="px-4 py-3 text-right font-medium">Qty</th>
                  <th className="px-4 py-3 text-right font-medium">Kemasan</th>
                  <th className="px-4 py-3 text-right font-medium">Harga/Unit</th>
                  <th className="px-6 py-3 text-right font-medium">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {po.details.map((d, idx) => {
                  const price = Number(d.unitPrice);
                  const lineTotal = d.qty * price;
                  const pkgSize = Number(d.item.packageSize ?? 1);
                  const pkgCount = d.packageQty ?? (pkgSize > 0 ? Math.ceil(d.qty / pkgSize) : d.qty);
                  const pkgUnit = d.packageUnit || d.item.packageUnit || "pail";
                  const baseUnit = d.unit || d.item.unit || "kg";

                  return (
                    <tr key={d.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3">
                        <p className="font-medium text-slate-800">{d.item.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{d.item.code}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {d.qty.toLocaleString("id-ID")} {baseUnit}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 text-xs">
                        {pkgCount} {pkgUnit}
                        {pkgSize > 1 && <span className="block text-slate-400">1 {pkgUnit} = {pkgSize} {baseUnit}</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {new Intl.NumberFormat("id-ID").format(price)}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-slate-800">
                        {new Intl.NumberFormat("id-ID").format(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td colSpan={4} className="px-6 py-3 text-right font-bold text-slate-700 text-sm uppercase tracking-wide">
                    Total Nilai PO
                  </td>
                  <td className="px-6 py-3 text-right font-bold text-slate-900 text-base">
                    {formatMoney(totalValue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer Verifikasi */}
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 flex items-center justify-between text-xs text-slate-400">
          <span>PRMS · Procurement &amp; Receiving Management System · PT. Sakae Riken Indonesia</span>
          {isVerified && (
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Terverifikasi
            </span>
          )}
        </div>
      </div>

      {/* Signature Section */}
      {(po.approvedById || po.approvedL2ById) && (
        <div className="max-w-4xl mx-auto mt-6 bg-white rounded-2xl shadow border border-slate-200 overflow-hidden">
          <div className={`px-6 py-4 border-b ${isVerified ? "bg-emerald-50 border-emerald-100" : "bg-slate-50 border-slate-200"}`}>
            <h2 className={`text-sm font-bold flex items-center gap-2 ${isVerified ? "text-emerald-800" : "text-slate-800"}`}>
              <ShieldCheck className="w-4 h-4" />
              Jejak Digital Tanda Tangan &amp; Persetujuan (2 Tingkat)
            </h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Prepared by */}
              <div className="text-center border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Prepared by</p>
                <div className="h-14 flex items-center justify-center">
                  {po.createdBy.signatureImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={po.createdBy.signatureImage}
                      alt="TTD Prepared"
                      className="max-h-12 max-w-[85%] object-contain mx-auto"
                    />
                  ) : (
                    <div className="w-16 h-px bg-slate-300" />
                  )}
                </div>
                <p className="font-bold text-slate-800 mt-2">{po.createdBy.name}</p>
                <p className="text-xs text-slate-500">Purchasing</p>
                <p className="text-xs text-slate-400 mt-1">{formatDateShort(po.poDate)}</p>
              </div>
              {/* L1: Manager */}
              <div className="text-center border-2 border-amber-200 bg-amber-50 rounded-xl p-4">
                <p className="text-xs text-amber-700 uppercase tracking-wider mb-2 font-semibold">L1 — Manager</p>
                <div className="h-14 flex flex-col items-center justify-center">
                  {po.approvedById && po.approvedBy?.signatureImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={po.approvedBy.signatureImage}
                      alt="TTD Manager"
                      className="max-h-12 max-w-[85%] object-contain mx-auto"
                    />
                  ) : (
                    <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full border border-amber-200">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verified
                    </div>
                  )}
                </div>
                <p className="font-bold text-amber-900 mt-2">{po.approvedBy?.name ?? "-"}</p>
                <p className="text-xs text-amber-700">Manager Purchasing</p>
                <p className="text-xs text-amber-600 mt-1">{formatDateID(po.approvedAt)}</p>
              </div>
              {/* L2: Presdir */}
              <div className={`text-center border-2 rounded-xl p-4 ${po.approvedL2ById ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                <p className={`text-xs uppercase tracking-wider mb-2 font-semibold ${po.approvedL2ById ? "text-emerald-700" : "text-slate-500"}`}>L2 — Presdir</p>
                <div className="h-14 flex flex-col items-center justify-center">
                  {po.approvedL2ById && po.approvedL2By?.signatureImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={po.approvedL2By.signatureImage}
                      alt="TTD Presdir"
                      className="max-h-12 max-w-[85%] object-contain mx-auto"
                    />
                  ) : po.approvedL2ById ? (
                    <div className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-200">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Digitally Verified
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Menunggu Persetujuan</span>
                  )}
                </div>
                <p className={`font-bold mt-2 ${po.approvedL2ById ? "text-emerald-900" : "text-slate-400"}`}>{po.approvedL2By?.name || "( ........................ )"}</p>
                <p className="text-xs text-slate-500">Presdir</p>
                <p className="text-xs text-slate-400 mt-1">{po.approvedL2At ? formatDateID(po.approvedL2At) : "-"}</p>
              </div>
              {/* Supplier */}
              <div className="text-center border border-slate-100 rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Supplier</p>
                <div className="h-12 flex items-center justify-center"><div className="w-16 h-px bg-slate-300" /></div>
                <p className="font-bold text-slate-800 mt-2">{po.supplier.contactPerson || po.supplier.name}</p>
                <p className="text-xs text-slate-500">{po.supplier.name}</p>
                <p className="text-xs text-slate-400 mt-1">( ........................... )</p>
              </div>
            </div>
            {/* Trace Info */}
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 space-y-1">
              <p><span className="font-medium text-slate-500">Keperluan:</span> {po.purposeProject || po.department || "-"}</p>
              <p><span className="font-medium text-slate-500">Dibuat:</span> {formatDateID(po.poDate)} oleh {po.createdBy.name}</p>
              <p><span className="font-medium text-slate-500">L1 — Manager:</span> {po.approvedAt ? formatDateID(po.approvedAt) : "-"} oleh {po.approvedBy?.name ?? "-"}</p>
              <p><span className="font-medium text-slate-500">L2 — Presdir:</span> {po.approvedL2At ? formatDateID(po.approvedL2At) : "-"} oleh {po.approvedL2By?.name ?? "-"}</p>
              {po.verificationHash && (
                <p className="break-all"><span className="font-medium text-slate-500">Hash Verifikasi:</span> {po.verificationHash}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

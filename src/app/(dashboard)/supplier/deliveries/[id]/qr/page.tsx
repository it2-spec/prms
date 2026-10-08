import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { formatDateOnly, formatMoney } from "@/lib/utils";
import { PageTitle } from "@/components/ui";
import { PrintButton } from "./PrintButton";
import { Building2, Calendar, FileText, QrCode, ShieldCheck, Truck, Warehouse } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DeliveryQRPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ autoprint?: string }>;
}) {
  const { id } = await params;
  const sParams = await searchParams;
  const autoPrint = sParams?.autoprint === "1";

  const { user, dbUser } = await getSessionUser();
  if (!user) redirect("/login");

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      purchaseOrder: { include: { supplier: true, warehouse: true } },
      supplier: true,
      details: { include: { item: true } },
      createdBy: true,
    },
  });

  if (!delivery) notFound();

  // BR-001 + RBAC: supplier hanya bisa melihat delivery miliknya
  if (user.role === "SUPPLIER" && delivery.supplierId !== dbUser?.supplierId) notFound();
  if (!["PURCHASING", "WAREHOUSE", "SUPPLIER"].includes(user.role)) redirect("/login");

  // QR payload berisi format JSON standar PRMS untuk dibaca scanner Warehouse (FR-04)
  const qrPayload = JSON.stringify({ delivery_id: delivery.deliveryNumber });
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 200,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  const totalQtyKg = delivery.details.reduce((s, d) => s + d.qty, 0);
  const totalValue = delivery.details.reduce(
    (s, d) => s + d.qty * Number(d.unitPrice),
    0
  );

  // Kepadatan baris tabel otomatis menyesuaikan jumlah item agar tetap muat 1 halaman
  const itemCount = delivery.details.length;
  const isCompact = itemCount > 6;
  const isUltraCompact = itemCount > 12;

  return (
    <div className="mx-auto max-w-4xl space-y-4 print:space-y-0 print:max-w-none print:m-0 print:p-0">
      {/* Tombol Aksi di Layar Komputer (Hidden saat Print) */}
      <div className="print:hidden">
        <PageTitle
          title="Surat Jalan Digital & QR Code"
          subtitle="Dokumen pengiriman resmi yang terintegrasi langsung dengan sistem PRMS"
          breadcrumb={["Deliveries", "Surat Jalan Digital"]}
          action={<PrintButton autoPrint={autoPrint} />}
        />
      </div>

      {delivery.status === "CANCELLED" && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-center text-xs font-bold text-red-700 print:border-red-600">
          PERHATIAN: SURAT JALAN INI TELAH DIBATALKAN OLEH SUPPLIER
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEMBAR SURAT JALAN DIGITAL (DIPAKSA 1 HALAMAN STRICT PRINT)              */}
      {/* ========================================================================= */}
      <div className="print-page-container flex flex-col justify-between min-h-[720px] sm:min-h-[820px] bg-white border border-slate-200 shadow-sm rounded-2xl p-6 sm:p-8 print:p-0 print:border-0 print:shadow-none print:rounded-none text-black">
        {/* ── 1. HEADER RESMI PRMS & PT. SAKAE RIKEN INDONESIA ── */}
        <div className="border-b-2 border-black pb-2 flex items-start justify-between gap-3">
          {/* Logo Kiri: Sakae Riken */}
          <div className="shrink-0 w-20 sm:w-24 flex items-center justify-start pt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/sri-logo.png"
              alt="Logo SRI"
              className="w-16 sm:w-20 h-auto object-contain print:w-16"
            />
          </div>

          {/* Kop Tengah: Identitas Perusahaan & Sistem PRMS */}
          <div className="text-center flex-1 space-y-0.5 px-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-[9px] font-extrabold tracking-widest text-slate-800 uppercase print:border-black print:bg-transparent">
              <span>PRMS · PURCHASING &amp; RECEIVING MANAGEMENT SYSTEM</span>
            </div>
            <h1 className="text-base sm:text-lg font-black tracking-wider text-black uppercase leading-tight pt-0.5">
              PT. SAKAE RIKEN INDONESIA
            </h1>
            <p className="text-[10px] print:text-[8.5px] text-gray-700 leading-tight">
              Kawasan Industri Suryacipta, Jl. Surya Kencana Kav. I-17 GH &amp; I-M2EF, Kutamekar, Ciampel, Karawang 41361
            </p>
            <p className="text-[9px] print:text-[8px] text-gray-600 leading-tight">
              Phone: +62-267-8610349 · Fax: +62-267-8610350
            </p>
            <h2 className="text-xs sm:text-sm font-black tracking-widest text-black uppercase pt-1 underline decoration-1 underline-offset-2">
              SURAT JALAN PENGIRIMAN DIGITAL (DIGITAL DELIVERY NOTE)
            </h2>
          </div>

          {/* Kanan: Badge Sertifikasi Dokumen Resmi PRMS */}
          <div className="shrink-0 w-28 text-right space-y-1 pt-1">
            <div className="border-2 border-black p-1.5 bg-slate-50 text-[9px] font-mono text-center rounded print:rounded-none">
              <span className="font-extrabold block text-black text-[9.5px]">DOKUMEN SAH</span>
              <span className="text-slate-600 block text-[8px]">KODE FORM: FR-04</span>
              <span className="text-[7.5px] text-blue-700 font-bold block pt-0.5">TERVERIFIKASI PRMS</span>
            </div>
          </div>
        </div>

        {/* ── 2. BLOK INFORMASI SURAT JALAN & QR CODE ── */}
        <div className="grid grid-cols-12 gap-3 py-2.5 border-b border-slate-300 text-[11px] print:text-[9.5px] leading-snug">
          {/* Kolom Kiri: Pengirim & Tujuan (Col 1-5) */}
          <div className="col-span-5 space-y-1 pr-2 border-r border-slate-200 print:border-slate-300">
            <div>
              <span className="text-gray-500 font-medium block text-[9px] uppercase tracking-wider">
                Pengirim / Supplier:
              </span>
              <p className="font-bold text-black text-xs print:text-[10.5px]">
                {delivery.supplier.name}
              </p>
              {delivery.supplier.code && (
                <p className="font-mono text-[10px] text-slate-600">Kode: {delivery.supplier.code}</p>
              )}
              {delivery.supplier.contactPerson && (
                <p className="text-[10px] text-slate-600">Up: {delivery.supplier.contactPerson}</p>
              )}
            </div>

            <div className="pt-1.5 border-t border-slate-100 print:border-slate-200">
              <span className="text-gray-500 font-medium block text-[9px] uppercase tracking-wider">
                Tujuan Pengiriman:
              </span>
              <p className="font-bold text-black">PT. SAKAE RIKEN INDONESIA</p>
              <p className="text-slate-700">
                Gudang:{" "}
                <span className="font-semibold text-blue-800">
                  {delivery.purchaseOrder.warehouse?.name ?? "Gudang Pusat"}
                </span>
              </p>
            </div>
          </div>

          {/* Kolom Tengah: Nomor Dokumen & Referensi PO (Col 6-9) */}
          <div className="col-span-4 space-y-1 px-1 border-r border-slate-200 print:border-slate-300">
            <div className="space-y-0.5">
              <span className="text-gray-500 font-medium block text-[9px] uppercase tracking-wider">
                No. Surat Jalan Supplier:
              </span>
              <p className="font-mono font-black text-xs print:text-[11px] text-black">
                {delivery.suratJalan}
              </p>
            </div>

            <div className="space-y-0.5 pt-0.5">
              <span className="text-gray-500 font-medium block text-[9px] uppercase tracking-wider">
                No. Delivery PRMS:
              </span>
              <p className="font-mono font-bold text-slate-800">
                {delivery.deliveryNumber}
              </p>
            </div>

            <div className="space-y-0.5 pt-0.5">
              <span className="text-gray-500 font-medium block text-[9px] uppercase tracking-wider">
                No. Purchase Order (PO):
              </span>
              <p className="font-mono font-bold text-blue-700">
                {delivery.purchaseOrder.poNumber}
              </p>
            </div>

            <div className="space-y-0.5 pt-0.5">
              <span className="text-gray-500 font-medium block text-[9px] uppercase tracking-wider">
                Tanggal Pengiriman:
              </span>
              <p className="font-semibold text-slate-900">
                {formatDateOnly(delivery.shipDate)}
              </p>
            </div>
          </div>

          {/* Kolom Kanan: QR Code Scanning Gudang (Col 10-12) */}
          <div className="col-span-3 flex flex-col items-center justify-center text-center pl-1">
            <div className="border border-slate-300 p-1 rounded bg-white print:border-black print:p-0.5 shadow-2xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt={`QR ${delivery.deliveryNumber}`}
                className="w-20 h-20 sm:w-24 sm:h-24 print:w-20 print:h-20 object-contain"
              />
            </div>
            <p className="font-mono text-[8.5px] font-bold text-slate-800 pt-0.5">
              {delivery.deliveryNumber}
            </p>
            <span className="text-[7.5px] text-gray-500 leading-tight">
              Scan di PRMS Warehouse
            </span>
          </div>
        </div>

        {/* ── 3. TABEL RINCIAN ITEM PENGIRIMAN ── */}
        <div className="py-2 flex-1">
          <table className="w-full text-left border-collapse border border-black text-[11px] print:text-[9.5px]">
            <thead className="bg-slate-100 print:bg-slate-200 text-black font-bold uppercase border-b border-black">
              <tr>
                <th className="border border-black px-2 py-1.5 print:py-1 text-center w-8">No</th>
                <th className="border border-black px-2 py-1.5 print:py-1 text-center w-28">Kode Barang</th>
                <th className="border border-black px-2 py-1.5 print:py-1">Nama &amp; Deskripsi Item</th>
                <th className="border border-black px-2 py-1.5 print:py-1 text-center w-24">Spesifikasi</th>
                <th className="border border-black px-2 py-1.5 print:py-1 text-right w-24">Qty (Kg)</th>
                <th className="border border-black px-2 py-1.5 print:py-1 text-right w-24">Kemasan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black">
              {delivery.details.map((d, index) => {
                const pkgSize = Number(d.item?.packageSize ?? 1);
                const pkgUnit = d.item?.packageUnit || "Pail";
                const pkgQty = pkgSize > 0 ? Math.floor(d.qty / pkgSize) : d.qty;

                return (
                  <tr
                    key={d.id || index}
                    className={`${index % 2 === 1 ? "bg-slate-50/50 print:bg-transparent" : ""}`}
                  >
                    <td className={`border border-black px-2 text-center font-mono ${isUltraCompact ? "py-0.5" : isCompact ? "py-1" : "py-1.5 print:py-0.5"}`}>
                      {index + 1}
                    </td>
                    <td className={`border border-black px-2 text-center font-mono font-semibold ${isUltraCompact ? "py-0.5" : isCompact ? "py-1" : "py-1.5 print:py-0.5"}`}>
                      {d.item?.code || "-"}
                    </td>
                    <td className={`border border-black px-2 font-semibold ${isUltraCompact ? "py-0.5" : isCompact ? "py-1" : "py-1.5 print:py-0.5"}`}>
                      <div>{d.item?.name || "Item"}</div>
                      {d.item?.unit && d.item.unit !== "kg" && (
                        <span className="text-[9px] text-gray-500 font-normal">Satuan: {d.item.unit}</span>
                      )}
                    </td>
                    <td className={`border border-black px-2 text-center text-gray-700 font-mono text-[9px] ${isUltraCompact ? "py-0.5" : isCompact ? "py-1" : "py-1.5 print:py-0.5"}`}>
                      {pkgSize > 1 ? `1 ${pkgUnit} = ${pkgSize} kg` : "Standard"}
                    </td>
                    <td className={`border border-black px-2 text-right font-mono font-bold ${isUltraCompact ? "py-0.5" : isCompact ? "py-1" : "py-1.5 print:py-0.5"}`}>
                      {d.qty.toLocaleString("id-ID")} {d.item?.unit || "kg"}
                    </td>
                    <td className={`border border-black px-2 text-right font-mono ${isUltraCompact ? "py-0.5" : isCompact ? "py-1" : "py-1.5 print:py-0.5"}`}>
                      <span className="font-semibold text-slate-900">{pkgQty}</span>{" "}
                      <span className="text-gray-600 text-[9px]">{pkgUnit}</span>
                    </td>
                  </tr>
                );
              })}

              {/* Baris Total Ringkasan */}
              <tr className="bg-slate-100 print:bg-slate-200 font-bold border-t-2 border-black">
                <td colSpan={4} className="border border-black px-2 py-1.5 print:py-1 text-center uppercase tracking-wider">
                  TOTAL KUANTITAS PENGIRIMAN
                </td>
                <td className="border border-black px-2 py-1.5 print:py-1 text-right font-mono font-black text-xs print:text-[10px]">
                  {totalQtyKg.toLocaleString("id-ID")} kg
                </td>
                <td className="border border-black px-2 py-1.5 print:py-1 text-right text-gray-700 text-[9px]">
                  {delivery.details.length} Item
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── 4. KOLOM TANDA TANGAN & PENGESAHAN (DILETAKKAN DI PALING BAWAH KERTAS A4) ── */}
        <div className="print-footer-section mt-auto pt-3 border-t-2 border-slate-300 print:border-black">
          <div className="grid grid-cols-3 gap-3 text-center text-[10px] print:text-[8.5px]">
            {/* Kolom 1: Pengirim / Ekspedisi */}
            <div className="border border-black p-1.5 rounded print:rounded-none flex flex-col justify-between h-24 print:h-22 bg-white">
              <span className="font-bold text-gray-800 uppercase text-[9.5px] print:text-[8.5px]">
                Diserahkan Oleh (Pengemudi / Supplier)
              </span>
              <div className="border-b border-dotted border-black mx-4"></div>
              <div className="text-slate-600 text-[8px] flex justify-between px-1">
                <span>Nama: ......................</span>
                <span>Tgl: ......................</span>
              </div>
            </div>

            {/* Kolom 2: Penerima Gudang SRI */}
            <div className="border border-black p-1.5 rounded print:rounded-none flex flex-col justify-between h-24 print:h-22 bg-white">
              <span className="font-bold text-gray-800 uppercase text-[9.5px] print:text-[8.5px]">
                Diterima Oleh (Security / Warehouse SRI)
              </span>
              <div className="border-b border-dotted border-black mx-4"></div>
              <div className="text-slate-600 text-[8px] flex justify-between px-1">
                <span>Nama: ......................</span>
                <span>Tgl: ......................</span>
              </div>
            </div>

            {/* Kolom 3: Verifikasi Sistem PRMS */}
            <div className="border border-black p-1.5 rounded print:rounded-none flex flex-col justify-between h-24 print:h-22 bg-slate-50 print:bg-transparent">
              <span className="font-bold text-blue-900 uppercase text-[9.5px] print:text-[8.5px]">
                Diverifikasi Sistem (PRMS Digital)
              </span>
              <div className="flex flex-col items-center justify-center space-y-0.5">
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[8px] font-bold border border-emerald-300 print:border-black">
                  ✓ TEREGISTRASI DI PRMS
                </span>
                <span className="font-mono text-[7.5px] text-gray-500">
                  ID: {delivery.id.slice(0, 12)}...
                </span>
              </div>
              <div className="text-slate-600 text-[8px] text-center">
                User: {delivery.createdBy?.name || "Portal Supplier"}
              </div>
            </div>
          </div>

          {/* ── 5. CATATAN KAKI RESMI PRMS ── */}
          <div className="pt-2 mt-2 border-t border-slate-200 print:border-black flex items-center justify-between text-[8.5px] print:text-[7.5px] text-gray-500">
            <span>
              * Dokumen ini adalah <strong>Surat Jalan Pengiriman Digital</strong> resmi yang diterbitkan melalui sistem <strong>PRMS PT. Sakae Riken Indonesia</strong>.
            </span>
            <span className="font-mono">
              Dicetak: {new Date().toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      </div>

      {/* CSS KHUSUS PRINT: MEMAKSA TEPAT 1 HALAMAN A4 & TTD DI DASAR KERTAS */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @page {
          size: A4 portrait;
          margin: 6mm 8mm 6mm 8mm;
        }
        @media print {
          html, body {
            height: 100% !important;
            max-height: 100vh !important;
            overflow: hidden !important;
            background: #ffffff !important;
            color: #000000 !important;
            padding: 0 !important;
            margin: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-page-container {
            /* Ketinggian penuh 1 halaman A4 portrait (297mm) dikurangi margin print (12mm) */
            height: 284mm !important;
            min-height: 284mm !important;
            max-height: 284mm !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-footer-section {
            margin-top: auto !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          table {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}} />
    </div>
  );
}

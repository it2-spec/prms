import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import QRCode from "qrcode";
import { PrintPoButton } from "./PrintPoButton";

export const dynamic = "force-dynamic";

function angkaTerbilang(nilai: number): string {
  const bilangan = [
    "", "Satu", "Dua", "Tiga", "Empat", "Lima",
    "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"
  ];
  const n = Math.floor(Math.abs(nilai));
  if (n < 12) return bilangan[n];
  if (n < 20) return angkaTerbilang(n - 10) + " Belas";
  if (n < 100) return angkaTerbilang(Math.floor(n / 10)) + " Puluh " + angkaTerbilang(n % 10);
  if (n < 200) return "Seratus " + angkaTerbilang(n - 100);
  if (n < 1000) return angkaTerbilang(Math.floor(n / 100)) + " Ratus " + angkaTerbilang(n % 100);
  if (n < 2000) return "Seribu " + angkaTerbilang(n - 1000);
  if (n < 1000000) return angkaTerbilang(Math.floor(n / 1000)) + " Ribu " + angkaTerbilang(n % 1000);
  if (n < 1000000000) return angkaTerbilang(Math.floor(n / 1000000)) + " Juta " + angkaTerbilang(n % 1000000);
  if (n < 1000000000000) return angkaTerbilang(Math.floor(n / 1000000000)) + " Miliar " + angkaTerbilang(n % 1000000000);
  return angkaTerbilang(Math.floor(n / 1000000000000)) + " Triliun " + angkaTerbilang(n % 1000000000000);
}

function formatTerbilang(nilai: number): string {
  if (nilai <= 0) return "Nol Rupiah";
  const hasil = angkaTerbilang(nilai).replace(/\s+/g, " ").trim();
  return `${hasil} Rupiah`;
}

function formatDateEnglish(date: Date | string | null | undefined): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function formatDeliveryScheduleEnglish(
  date: Date | string | null | undefined,
  type?: string | null
): string {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  if (type === "MONTH") {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
    }).format(d);
  }
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatQuotationRemark(notes: string): string {
  const trimmed = notes.trim();
  if (/^Price As per Your Quotations?/i.test(trimmed)) {
    return trimmed;
  }
  if (/^No\s*:/i.test(trimmed)) {
    return `Price As per Your Quotations ${trimmed}`;
  }
  if (trimmed.startsWith(":")) {
    return `Price As per Your Quotations ${trimmed}`;
  }
  return `Price As per Your Quotations : ${trimmed}`;
}

function formatCurrencyNumber(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default async function PrintPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await getSessionUser();
  if (!user || user.role !== "PURCHASING") redirect("/login");

  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
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

  // QR Code verifikasi di header — untuk verifikasi keabsahan dokumen via sistem PRMS
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const verifyUrl = `${baseUrl}/verify/${po.id}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 100,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const subtotal = po.details.reduce((sum, d) => sum + d.qty * Number(d.unitPrice), 0);
  const vatRate = 0.11; // VAT 11% sesuai template SRI
  const vatAmount = Math.round(subtotal * vatRate);
  const grandTotal = subtotal + vatAmount;
  const terbilangText = formatTerbilang(grandTotal);

  return (
    <div className="print-outer-container min-h-screen bg-slate-200/80 py-8 print:py-0 print:m-0 print:bg-white text-black font-['Palatino_Linotype',_'Book_Antiqua',_Palatino,_Georgia,_serif]">
      {/* Print Specific CSS to Strictly Enforce Single Page A4 Layout */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm 8mm 5mm 8mm;
          }
          *, *::before, *::after {
            box-sizing: border-box !important;
          }
          html, body {
            height: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, aside, footer, nav, [role="navigation"], .print\\:hidden, .no-print {
            display: none !important;
            height: 0 !important;
            visibility: hidden !important;
          }
          main, .print-outer-container {
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            width: 100% !important;
            height: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
            background: transparent !important;
          }
          .print-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            height: 284mm !important;
            min-height: 284mm !important;
            max-height: 284mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}} />

      {/* Action Bar (Hidden on Print) */}
      <PrintPoButton poId={po.id} />

      {/* Printable Sheet Container (A4 Portrait Layout - Strictly 1 Page, Signatures Pinned at Bottom) */}
      <div className="print-sheet mx-auto max-w-[210mm] min-h-[297mm] print:min-h-[284mm] print:h-[284mm] print:max-h-[284mm] bg-white shadow-2xl border border-slate-300 p-8 sm:p-10 print:p-0 mt-10 print:mt-0 flex flex-col justify-between text-[11px] print:text-[10px] leading-snug">
        <div>
          {/* Header / Kop Surat Resmi PT. SAKAE RIKEN INDONESIA (Sesuai templatea.xlsx) */}
          <div className="flex items-center justify-between border-b-2 border-black pb-2 print:pb-1">
            {/* Logo Kiri: SR (Sakae Riken) */}
            <div className="shrink-0 w-24 sm:w-28 flex items-center justify-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sri-logo.png"
                alt="Logo Sakae Riken"
                className="w-20 sm:w-24 h-auto object-contain"
              />
            </div>

            {/* Identitas Perusahaan Tengah (Kop Resmi templatea.xlsx) */}
            <div className="text-center space-y-0.5 px-2 flex-1">
              <h1 className="text-base sm:text-lg font-bold tracking-wider text-black uppercase">
                PT. SAKAE RIKEN INDONESIA
              </h1>
              <p className="text-[10px] print:text-[8.5px] text-gray-800 leading-tight">
                Kawasan Industri Suryacipta
              </p>
              <p className="text-[10px] print:text-[8.5px] text-gray-800 leading-tight">
                Jl. Surya Kencana Kav. I-17 GH &amp; I-M2EF
              </p>
              <p className="text-[10px] print:text-[8.5px] text-gray-800 leading-tight">
                Kutamekar, Ciampel, Karawang, Jawa Barat , Indonesia 41361
              </p>
              <p className="text-[10px] print:text-[8.5px] text-gray-800 leading-tight">
                Phone: +62-267-8610349, Fax: +62-267-8610350
              </p>
            </div>

            {/* Logo Kanan: Sertifikasi URS ISO/TS 16949 */}
            <div className="shrink-0 w-24 sm:w-28 flex items-center justify-end">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/sri-iso.jpg"
                alt="Certified ISO/TS 16949"
                className="w-20 sm:w-24 h-auto object-contain"
              />
            </div>
          </div>

          {/* Judul Dokumen PURCHASE ORDER */}
          <div className="text-center pt-2 pb-1 print:pt-1 print:pb-0.5">
            <h2 className="text-sm sm:text-base font-bold tracking-widest text-black uppercase underline decoration-1 underline-offset-2">
              PURCHASE ORDER
            </h2>

          </div>

          {/* Vendor Information & PO Info (Rows 10-16 in SRI Template) */}
          <div className="grid grid-cols-12 gap-3 pt-3 pb-2 text-[11px]">
            {/* Vendor Info (Col 1-8) */}
            <div className="col-span-8 space-y-1">
              <div className="flex">
                <span className="w-12 font-bold shrink-0">To</span>
                <span className="w-3 shrink-0">:</span>
                <span className="font-bold text-black">{po.supplier.name}</span>
              </div>
              {po.supplier.address && (
                <div className="flex">
                  <span className="w-12 shrink-0"></span>
                  <span className="w-3 shrink-0"></span>
                  <span className="text-gray-800 whitespace-pre-line leading-tight">
                    {po.supplier.address}
                  </span>
                </div>
              )}
              {po.supplier.phone && (
                <div className="flex">
                  <span className="w-12 shrink-0"></span>
                  <span className="w-3 shrink-0"></span>
                  <span className="text-gray-800">
                    Phone : {po.supplier.phone}
                    {po.supplier.email ? ` | Email : ${po.supplier.email}` : ""}
                  </span>
                </div>
              )}
              <div className="flex pt-1">
                <span className="w-12 font-bold shrink-0">Attn</span>
                <span className="w-3 shrink-0">:</span>
                <span className="font-medium text-black">
                  {po.supplier.contactPerson || "-"}
                </span>
              </div>
              <div className="flex">
                <span className="w-12 font-bold shrink-0">Date</span>
                <span className="w-3 shrink-0">:</span>
                <span className="font-medium text-black">
                  {formatDateEnglish(po.poDate)}
                </span>
              </div>
            </div>

            {/* PO Info & QR Code (Col 9-12) */}
            <div className="col-span-4 flex flex-col justify-between items-end">
              {/* 2 Kotak PO NO: dan Nomor PO (Center Aligned, Ramping ke Samping) */}
              <div className="border border-black text-center w-[145px] print:w-[135px]">
                <div className="border-b border-black py-0.5 px-1.5 font-bold uppercase tracking-wider text-[11px] print:text-[10px] bg-gray-50/60">
                  PO NO :
                </div>
                <div className="py-0.5 px-1.5 font-bold text-black text-[11px] print:text-[10px] tracking-wide whitespace-nowrap">
                  {po.poNumber}
                  {po.revisionCount > 0 && (
                    <span className="ml-1 text-[9px] print:text-[8.5px] font-bold text-black">
                      REV {String(po.revisionCount).padStart(2, "0")}
                    </span>
                  )}
                </div>
              </div>

              {/* Discreet PRMS Verification QR Code */}
              <div className="flex items-center gap-2 pt-2">
                <div className="text-[9px] text-right text-gray-500 leading-tight">
                  <p className="font-semibold text-black">PRMS VERIFIED</p>
                  <p>Scan Verifikasi</p>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt="QR Code Verifikasi PO"
                  width={60}
                  height={60}
                  className="border border-black p-0.5"
                />
              </div>

            </div>
          </div>

          {/* Table Items (Row 18-40 in SRI Excel Template) */}
          <div className="mt-2 print:mt-1">
            <table className="w-full border-collapse border border-black text-[11px] print:text-[9px]">
              <thead>
                <tr className="border-b border-black text-center font-bold bg-gray-50/70">
                  <th className="border-r border-black p-1.5 print:py-0.5 print:px-1 w-8">NO</th>
                  <th className="border-r border-black p-1.5 print:py-0.5 print:px-1 text-left">DESCRIPTIONS</th>
                  <th className="border-r border-black p-1.5 print:py-0.5 print:px-1 w-28">PACKAGE</th>
                  <th className="border-r border-black p-1.5 print:py-0.5 print:px-1 w-12 text-right">QTY</th>
                  <th className="border-r border-black p-1.5 print:py-0.5 print:px-1 w-12 text-center">UNIT</th>
                  <th className="border-r border-black p-1.5 print:py-0.5 print:px-1 w-12 text-right">QTY</th>
                  <th className="border-r border-black p-1.5 print:py-0.5 print:px-1 w-12 text-center">UNIT</th>
                  <th className="border-r border-black p-1.5 print:py-0.5 print:px-1 w-24 text-right">UNIT PRICE</th>
                  <th className="p-1.5 print:py-0.5 print:px-1 w-28 text-right">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {po.details.map((d, index) => {
                  const price = Number(d.unitPrice);
                  const lineTotal = d.qty * price;
                  const pkgSize = Number(d.item.packageSize ?? 1);
                  const pkgCount = pkgSize > 0 ? Math.ceil(d.qty / pkgSize) : (d.packageQty ?? d.qty);
                  const pkgUnit = d.packageUnit || d.item.packageUnit || "pail";
                  const baseUnit = d.unit || d.item.unit || "kg";

                  // Format PACKAGE column e.g. "1 pail = 16 kg"
                  const packageText = pkgSize > 0 && pkgUnit.toLowerCase() !== baseUnit.toLowerCase()
                    ? `1 ${pkgUnit.toLowerCase()} = ${pkgSize} ${baseUnit.toLowerCase()}`
                    : `-`;

                  return (
                    <tr key={d.id} className="border-b border-black/80 hover:bg-slate-50/30">
                      <td className="border-r border-black p-1.5 print:py-0.5 print:px-1 text-center align-top">
                        {index + 1}
                      </td>
                      <td className="border-r border-black p-1.5 print:py-0.5 print:px-1 align-top">
                        <span className="font-semibold text-black">{d.item.name}</span>
                        {d.item.code && d.item.code !== d.item.name && (
                          <span className="text-[10px] print:text-[8px] text-gray-600 block">
                            Code: {d.item.code}
                          </span>
                        )}
                      </td>
                      <td className="border-r border-black p-1.5 print:py-0.5 print:px-1 text-center align-top whitespace-nowrap">
                        {packageText}
                      </td>
                      <td className="border-r border-black p-1.5 print:py-0.5 print:px-1 text-right align-top font-medium">
                        {pkgCount.toLocaleString("id-ID")}
                      </td>
                      <td className="border-r border-black p-1.5 print:py-0.5 print:px-1 text-center align-top text-gray-700">
                        {pkgUnit}
                      </td>
                      <td className="border-r border-black p-1.5 print:py-0.5 print:px-1 text-right align-top font-medium">
                        {d.qty.toLocaleString("id-ID")}
                      </td>
                      <td className="border-r border-black p-1.5 print:py-0.5 print:px-1 text-center align-top text-gray-700">
                        {baseUnit}
                      </td>
                      <td className="border-r border-black p-1.5 print:py-0.5 print:px-1 text-right align-top whitespace-nowrap">
                        {formatCurrencyNumber(price)}
                      </td>
                      <td className="p-1.5 print:py-0.5 print:px-1 text-right align-top font-semibold whitespace-nowrap">
                        {formatCurrencyNumber(lineTotal)}
                      </td>
                    </tr>
                  );
                })}

                {/* Optional empty row only on screen when 1 item, hidden on print */}
                {po.details.length === 1 && (
                  <tr className="border-b border-black/40 h-6 text-transparent print:hidden">
                    <td className="border-r border-black">&nbsp;</td>
                    <td className="border-r border-black">&nbsp;</td>
                    <td className="border-r border-black">&nbsp;</td>
                    <td className="border-r border-black">&nbsp;</td>
                    <td className="border-r border-black">&nbsp;</td>
                    <td className="border-r border-black">&nbsp;</td>
                    <td className="border-r border-black">&nbsp;</td>
                    <td className="border-r border-black">&nbsp;</td>
                    <td>&nbsp;</td>
                  </tr>
                )}
              </tbody>

              {/* Table Subtotals (Rows 41-43 in SRI Template) */}
              <tfoot>
                <tr className="border-t-2 border-black">
                  <td colSpan={5} rowSpan={3} className="border-r border-black p-1.5 print:p-1 align-top text-[10px] print:text-[8.5px]">
                    <div className="space-y-0.5 text-gray-800">
                      <div className="flex items-start">
                        <span className="font-bold w-12 shrink-0">Notes :</span>
                        <div className="space-y-0.5 flex-1">
                          <div className="flex">
                            <span className="w-24 shrink-0 font-medium">Use by Dept.</span>
                            <span className="font-semibold text-black">
                              : {po.department || po.warehouse?.name || "Painting Plant 2"}
                            </span>
                          </div>
                          <div className="flex">
                            <span className="w-24 shrink-0 font-medium">Usage for</span>
                            <span className="font-medium text-black">
                              : {po.purposeProject || "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td colSpan={2} className="border-r border-black p-1.5 print:py-0.5 print:px-1 text-right font-bold uppercase tracking-wider text-[10px] print:text-[8.5px] bg-gray-50/50">
                    SUB TOTAL
                  </td>
                  <td colSpan={2} className="p-1.5 print:py-0.5 print:px-1 text-right font-bold whitespace-nowrap">
                    Rp {formatCurrencyNumber(subtotal)}
                  </td>
                </tr>
                <tr className="border-t border-black">
                  <td colSpan={2} className="border-r border-black p-1.5 print:py-0.5 print:px-1 text-right font-bold uppercase tracking-wider text-[10px] print:text-[8.5px] bg-gray-50/50">
                    VAT (11%)
                  </td>
                  <td colSpan={2} className="p-1.5 print:py-0.5 print:px-1 text-right font-semibold whitespace-nowrap">
                    Rp {formatCurrencyNumber(vatAmount)}
                  </td>
                </tr>
                <tr className="border-t-2 border-black bg-gray-50/80">
                  <td colSpan={2} className="border-r border-black p-1.5 print:py-0.5 print:px-1 text-right font-bold uppercase tracking-wider text-[11px] print:text-[9px]">
                    TOTAL
                  </td>
                  <td colSpan={2} className="p-1.5 print:py-0.5 print:px-1 text-right font-bold text-[12px] print:text-[10px] whitespace-nowrap">
                    Rp {formatCurrencyNumber(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Terbilang Section */}
          <div className="mt-1.5 print:mt-1 py-0.5 px-2 border border-black/60 bg-gray-50/40 text-[10px] print:text-[8.5px] flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-gray-700 shrink-0">Terbilang :</span>
            <span className="font-semibold italic text-black capitalize">
              # {terbilangText} #
            </span>
          </div>

          {/* REMARKS Section (Rows 45-60 in SRI Template) */}
          <div className="mt-2.5 print:mt-1 text-[10px] print:text-[8.5px] text-gray-900 leading-tight space-y-0.5">
            <p className="font-bold uppercase tracking-wide text-black text-[10.5px] print:text-[9px] mb-0.5">
              REMARKS:
            </p>
            <div className="space-y-0.5">
              {(() => {
                const remarks: React.ReactNode[] = [];

                // 1. Price As per Your Quotations (Hanya tampil jika ada isi)
                if (po.notes && po.notes.trim()) {
                  remarks.push(<span>{formatQuotationRemark(po.notes)}</span>);
                }

                remarks.push(
                  <span>Please notify us immediately if you are unable to ship as specified.</span>
                );

                remarks.push(
                  <span>After receipt this Purchase Order, please give sign &amp; stamp as the confirmation, after finish please return back by email or fax.</span>
                );

                remarks.push(
                  <span>After Three days of receipt Purchase Order and without your confirmation, we will assume that all data contained in the PO has been agreed and accepted by your company. We will not tolerate any delays and shortage part of delivery.</span>
                );

                remarks.push(
                  <div className="space-y-0.5">
                    <p>
                      Delivery/Finish (Optional){" "}
                      <strong className="text-black">
                        {formatDeliveryScheduleEnglish(
                          po.expectedDelivery || po.poDate,
                          po.deliveryDateType
                        )}
                      </strong>{" "}
                      to : <strong className="text-black">PT. SAKAE RIKEN INDONESIA ({po.warehouse?.name ?? "Painting Plant Area"})</strong>
                    </p>
                    <p className="text-gray-700">
                      Kawasan Industri Suryacipta, Jl. Surya Kencana Kav. I-17 GH &amp; I-M2EF, Kutamekar, Ciampel, Karawang, Jawa Barat 41361
                    </p>
                  </div>
                );

                remarks.push(
                  <span>Maximum receiving of goods or delivery to SRI Warehouse is 15.00 pm everyday (unless urgent orders).</span>
                );

                remarks.push(
                  <div className="space-y-0.5">
                    <p className="font-bold">Term of Payment :</p>
                    <p className="pl-2">
                      1. Invoice received between date 1st - 15th, will be paid on 15th next month
                    </p>
                    <p className="pl-2">
                      2. Invoice received between date 16th - 30th will be paid on 30th next month
                    </p>
                  </div>
                );

                remarks.push(
                  <span>
                    Please attach Copy of PO after sign confirmation, Original DO, Original Faktur Pajak, Copy of Surat Pemberian No. Seri Faktur Pajak when Supplier/Subcont will submit the Invoice.
                  </span>
                );

                return remarks.map((content, idx) => (
                  <div key={idx} className="flex items-start gap-1">
                    <span className="font-bold shrink-0 w-3.5">{idx + 1}.</span>
                    <div className="flex-1">{content}</div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Bottom Section: Signatures & Document Code (Rows 63-69 in SRI Template) */}
        <div className="mt-3 print:mt-1 pt-1 print:pt-0 break-inside-avoid">
          {/* 4-Box Signatures Table - Presisi Kotak Proporsional dengan Header Supplier Ter-merge */}
          <div className="flex justify-end">
            <div className="w-[380px] print:w-[340px]">
              <table className="w-full border-collapse border border-black text-center text-[10px] print:text-[8.5px]">
                <thead>
                  <tr className="border-b border-black font-bold">
                    <th colSpan={3} className="border-r border-black py-1 print:py-0.5 tracking-wider uppercase bg-gray-50/60">
                      PT. SAKAE RIKEN INDONESIA
                    </th>
                    <th rowSpan={2} className="py-1 print:py-0.5 tracking-wider uppercase bg-gray-50/60 font-bold align-middle w-1/4">
                      Supplier
                    </th>
                  </tr>
                  <tr className="border-b border-black font-semibold">
                    <th className="border-r border-black py-1 print:py-0.5 w-1/4">Prepared</th>
                    <th className="border-r border-black py-1 print:py-0.5 w-1/4">Checked</th>
                    <th className="border-r border-black py-1 print:py-0.5 w-1/4">Approved</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Signature Area: Prepared = Creator TTD, Checked = L1 Manager TTD, Approved = L2 Presdir TTD */}
                  <tr className="h-18 sm:h-20 print:h-16 border-b border-black">
                    {/* Prepared: Staff Purchasing */}
                    <td className="border-r border-black align-middle p-1">
                      {po.createdBy?.signatureImage ? (
                        <div className="flex flex-col items-center justify-center py-0.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={po.createdBy.signatureImage}
                            alt={`TTD ${po.createdBy.name}`}
                            className="max-h-12 sm:max-h-14 print:max-h-10 max-w-[90%] object-contain mx-auto"
                          />
                        </div>
                      ) : <>&nbsp;</>}
                    </td>
                    {/* Checked: L1 Manager Purchasing */}
                    <td className="border-r border-black align-middle p-1">
                      {po.approvedById && po.approvedBy?.signatureImage ? (
                        <div className="flex flex-col items-center justify-center py-0.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={po.approvedBy.signatureImage}
                            alt={`TTD ${po.approvedBy.name}`}
                            className="max-h-12 sm:max-h-14 print:max-h-10 max-w-[90%] object-contain mx-auto"
                          />
                          {po.approvedAt && (
                            <span className="text-[7px] print:text-[6px] text-gray-500 leading-none mt-0.5 block">
                              {new Intl.DateTimeFormat("id-ID", { dateStyle: "short" }).format(new Date(po.approvedAt))}
                            </span>
                          )}
                        </div>
                      ) : <>&nbsp;</>}
                    </td>
                    {/* Approved: L2 Presdir */}
                    <td className="border-r border-black align-middle p-1">
                      {po.approvedL2ById && po.approvedL2By?.signatureImage ? (
                        <div className="flex flex-col items-center justify-center py-0.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={po.approvedL2By.signatureImage}
                            alt={`TTD ${po.approvedL2By.name}`}
                            className="max-h-12 sm:max-h-14 print:max-h-10 max-w-[90%] object-contain mx-auto"
                          />
                          {po.approvedL2At && (
                            <span className="text-[7px] print:text-[6px] text-gray-500 leading-none mt-0.5 block">
                              {new Intl.DateTimeFormat("id-ID", { dateStyle: "short" }).format(new Date(po.approvedL2At))}
                            </span>
                          )}
                        </div>
                      ) : <>&nbsp;</>}
                    </td>
                    {/* Supplier */}
                    <td className="align-middle p-1">
                      {po.supplierAcceptedSignature ? (
                        <div className="flex flex-col items-center justify-center py-0.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={po.supplierAcceptedSignature}
                            alt="TTD Supplier"
                            className="max-h-12 sm:max-h-14 print:max-h-10 max-w-[90%] object-contain mx-auto"
                          />
                          {po.supplierAcceptedAt && (
                            <span className="text-[7px] print:text-[6px] text-gray-500 leading-none mt-0.5 block">
                              {new Intl.DateTimeFormat("id-ID", { dateStyle: "short" }).format(new Date(po.supplierAcceptedAt))}
                            </span>
                          )}
                        </div>
                      ) : <>&nbsp;</>}
                    </td>
                  </tr>
                  {/* Names Footer */}
                  <tr className="font-bold">
                    <td className="border-r border-black py-1 print:py-0.5 px-1 truncate">
                      {po.createdBy?.name || "Rizaldy. F"}
                    </td>
                    <td className="border-r border-black py-1 print:py-0.5 px-1 truncate">
                      {po.approvedById && po.approvedBy?.name ? po.approvedBy.name : "( ........................ )"}
                    </td>
                    <td className="border-r border-black py-1 print:py-0.5 px-1 truncate">
                      {po.approvedL2ById && po.approvedL2By?.name ? po.approvedL2By.name : "( ........................ )"}
                    </td>
                    <td className="py-1 print:py-0.5 px-1 truncate">
                      {po.supplierAcceptedByName || po.supplier.contactPerson || "( ........................ )"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Official Document Form Reference (FO/SPD/028, REV.00) */}
          <div className="flex items-center justify-between text-[9px] print:text-[8px] text-gray-500 pt-1.5 print:pt-0.5 font-mono">
            <span>PRMS - Procurement &amp; Receiving Management System</span>
            <span className="font-bold text-black">FO/SPD/028, REV.00</span>
          </div>
        </div>
      </div>
    </div>
  );
}



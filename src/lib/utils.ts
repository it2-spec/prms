import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));
}

export function formatDateOnly(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(d));
}

export function formatMoney(n: number | { toString(): string } | null | undefined): string {
  if (n == null) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(n));
}

export { formatCompactRupiah } from "@/lib/format";

export function toRomanMonth(month: number): string {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romans[Math.max(0, Math.min(11, month - 1))] || "I";
}

export async function nextPoNumber(
  targetDate: Date | string = new Date(),
  client: any = prisma
): Promise<string> {
  const d = new Date(targetDate);
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  const year = validDate.getFullYear();
  const month = validDate.getMonth() + 1;
  const romanMonth = toRomanMonth(month);

  // Ambil semua PO untuk menghitung no urut tertinggi pada tahun yang sama
  const pos = await client.purchaseOrder.findMany({
    select: { poNumber: true },
  });

  let maxNum = 0;
  for (const item of pos) {
    if (!item.poNumber) continue;
    const parts = item.poNumber.trim().split("/");
    const lastPart = parts[parts.length - 1]?.trim();
    // Jika tahun pada PO sama dengan target year
    if (lastPart === String(year) || item.poNumber.endsWith(`/${year}`)) {
      const parsed = parseInt(parts[0], 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }

  // Jika tahun baru (misal 2027), maxNum bernilai 0 sehingga nextSeq menjadi 1
  const nextSeq = maxNum + 1;
  const seqPadded = String(nextSeq).padStart(4, "0");
  return `${seqPadded}/SRI/PUD/${romanMonth}/${year}`;
}

export async function nextNumber(
  model: "purchaseOrder" | "delivery" | "receiving" | "stockOutgoing",
  dateParam?: Date | string | null,
  client: any = prisma
): Promise<string> {
  if (model === "purchaseOrder") {
    return nextPoNumber(dateParam || new Date(), client);
  }

  const prefixMap = {
    delivery: "DLV",
    receiving: "RCV",
    stockOutgoing: "OUT",
  } as const;

  const prefix = prefixMap[model];
  const sliceLen = prefix.length;
  let maxNum = 0;

  if (model === "delivery") {
    const items = await prisma.delivery.findMany({
      select: { deliveryNumber: true },
    });
    for (const item of items) {
      if (item.deliveryNumber?.startsWith(prefix)) {
        const parsed = parseInt(item.deliveryNumber.slice(sliceLen), 10);
        if (!isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }
  } else if (model === "stockOutgoing") {
    const items = await prisma.stockOutgoing.findMany({
      select: { outgoingNumber: true },
    });
    for (const item of items) {
      if (item.outgoingNumber?.startsWith(prefix)) {
        const parsed = parseInt(item.outgoingNumber.slice(sliceLen), 10);
        if (!isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }
  } else {
    const items = await prisma.receiving.findMany({
      select: { receivingNumber: true },
    });
    for (const item of items) {
      if (item.receivingNumber?.startsWith(prefix)) {
        const parsed = parseInt(item.receivingNumber.slice(sliceLen), 10);
        if (!isNaN(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }
  }

  const next = maxNum + 1;
  return `${prefix}${String(next).padStart(6, "0")}`;
}

export async function writeAuditLog(
  sessionUser: SessionUser,
  action: string,
  entityType: string,
  entityId?: string,
  detail?: string,
) {
  await prisma.auditLog.create({
    data: {
      userId: sessionUser.id,
      action,
      entityType,
      entityId,
      detail,
    },
  });
}

export const PO_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  WAITING_DELIVERY: "Waiting Delivery",
  PARTIALLY_DELIVERED: "Partially Delivered",
  WAITING_RECEIVING: "Waiting Receiving",
  PARTIALLY_RECEIVED: "Partially Received",
  RECEIVED: "Received",
  CLOSED: "Closed",
  REVISED: "Revised",
  CANCELLED: "Dibatalkan (Cancelled)",
};

export const DELIVERY_STATUS_LABEL: Record<string, string> = {
  CREATED: "Created",
  SENT: "Sent",
  ARRIVED: "Arrived",
  CANCELLED: "Dibatalkan",
};

export const RECEIVING_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  RECEIVED: "Received",
  CLOSED: "Closed",
};

export const PR_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Menunggu Approval",
  APPROVED: "Disetujui (Siap PO)",
  REJECTED: "Ditolak",
  PARTIAL_PO: "Sebagian Masuk PO",
  ORDERED: "Sudah PO (Menunggu Barang)",
  PARTIAL_RECEIVED: "Diterima Sebagian",
  COMPLETED: "Selesai (Barang Diterima)",
  CONVERTED: "Sudah Jadi PO",
  CANCELLED: "Dibatalkan",
};

export const DEPT_CODE_MAP: Record<string, string> = {
  "Molding": "MLD",
  "Painting 1": "PA",
  "Painting 2": "PB",
  "Plating": "PL",
  "PP": "PP",
  "QC": "QC",
  "QA": "QA",
  "Assembly": "ASSY",
  "PPIC": "PPIC",
  "Maintenance": "MTC",
  "GA / HR": "GA",
};

export function getDeptCode(deptName?: string | null): string {
  if (!deptName) return "GEN";
  const trimmed = deptName.trim();
  if (DEPT_CODE_MAP[trimmed]) return DEPT_CODE_MAP[trimmed];
  const upper = trimmed.toUpperCase();
  if (["MLD", "PA", "PB", "PL", "PP", "QC", "QA", "ASSY", "PPIC", "MTC", "GA"].includes(upper)) {
    return upper;
  }
  return upper.replace(/[^A-Z0-9]/g, "").slice(0, 4) || "GEN";
}

export async function nextPrNumber(
  department?: string | null,
  targetDate: Date | string = new Date()
): Promise<string> {
  const d = new Date(targetDate);
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  const year = validDate.getFullYear();
  const deptCode = getDeptCode(department);

  const suffix = `/${deptCode}/${year}`;

  const prs = await prisma.purchaseRequest.findMany({
    where: {
      prNumber: {
        endsWith: suffix,
      },
    },
    select: { prNumber: true },
  });

  let maxNum = 0;
  for (const p of prs) {
    if (!p.prNumber) continue;
    // Format: PR/001/MLD/2026 -> parts: ["PR", "001", "MLD", "2026"]
    const parts = p.prNumber.trim().split("/");
    if (parts.length >= 4 && parts[0] === "PR" && parts[2] === deptCode && parts[3] === String(year)) {
      const parsed = parseInt(parts[1], 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }

  const nextSeq = maxNum + 1;
  const seqPadded = String(nextSeq).padStart(3, "0");
  return `PR/${seqPadded}/${deptCode}/${year}`;
}


/**
 * Normalize item/supplier name for matching:
 * - collapse multiple spaces/tabs to single space
 * - trim
 * - lowercase
 * This prevents duplicate items caused by whitespace differences
 * (e.g. "ORIGIN THINNER #210  (JTA)" vs "ORIGIN THINNER #210 (JTA)")
 */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export { calculateProgressPercent } from "./progress";
export { normalizeDepartment } from "./format";


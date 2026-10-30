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

export function formatCompactRupiah(value: number | null | undefined): string {
  if (value == null || isNaN(Number(value))) return "Rp 0";
  const num = Number(value);
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) {
    return `Rp ${(num / 1_000_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} M`;
  }
  if (abs >= 1_000_000) {
    return `Rp ${(num / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} Jt`;
  }
  if (abs >= 1_000) {
    return `Rp ${(num / 1_000).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Rb`;
  }
  return `Rp ${num.toLocaleString("id-ID")}`;
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

/**
 * Normalisasi nama departemen untuk memastikan konsistensi:
 * - Painting Plan 1: Painting, Painting 1, Painting Plan 1, Painting Plant 1, Painting Dept, PAINTING DEPT
 * - Painting Plan 2: Painting 2, Painting Plan 2, Painting Plant 2
 */
export function normalizeDepartment(dept?: string | null): string {
  if (!dept) return "-";
  const cleaned = String(dept).replace(/^[:\s]+/, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === ":") return "-";

  const upper = cleaned.toUpperCase().replace(/\s+/g, " ");

  // 1. Cek Painting Plan 2 terlebih dahulu
  if (
    upper.includes("PAINTING 2") ||
    upper.includes("PAINTING PLAN 2") ||
    upper.includes("PAINTING PLANT 2") ||
    upper.includes("PLAN 2") ||
    upper.includes("PLANT 2") ||
    upper === "PNT-2"
  ) {
    return "Painting Plan 2";
  }

  // 2. Cek Painting Plan 1
  if (
    upper.includes("PAINTING") ||
    upper.includes("PAINTING 1") ||
    upper.includes("PAINTING PLAN 1") ||
    upper.includes("PAINTING PLANT 1") ||
    upper.includes("PAINTING DEPT") ||
    upper.includes("PAINTING DEPARTMENT") ||
    upper.includes("PLAN 1") ||
    upper.includes("PLANT 1") ||
    upper === "PNT-1"
  ) {
    return "Painting Plan 1";
  }

  return cleaned;
}


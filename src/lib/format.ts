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

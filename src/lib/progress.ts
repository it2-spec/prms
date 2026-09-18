/**
 * Pure progress percentage calculator (Client & Server safe)
 *
 * HANYA menghasilkan 100% jika seluruh qty benar-benar telah diterima (received >= total).
 * Jika masih ada sisa yang belum diterima (misal 6.805 dari 6.833 = 99.59%),
 * fungsi ini TIDAK AKAN membulatkan ke 100%, melainkan dibulatkan ke bawah (99%)
 * agar tidak menimbulkan kesalahpahaman bahwa PO sudah tuntas.
 */
export function calculateProgressPercent(received: number, total: number): number {
  if (total <= 0) return 0;
  if (received >= total) return 100;
  return Math.min(99, Math.floor((received / total) * 100));
}

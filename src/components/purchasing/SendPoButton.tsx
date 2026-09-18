"use client";

import React, { useState } from "react";
import { Send, Mail, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";

interface SendPoButtonProps {
  poId: string;
  poNumber: string;
  poDate: string;
  supplier: {
    name: string;
    email?: string | null;
    contactPerson?: string | null;
  };
  details: {
    itemName: string;
    qty: number;
    unit: string;
  }[];
  purposeProject?: string | null;
  expectedDelivery?: string | null;
  onSendPoAction: (poId: string) => Promise<{ success?: boolean; error?: string } | void>;
}

export default function SendPoButton({
  poId,
  poNumber,
  poDate,
  supplier,
  details,
  purposeProject,
  expectedDelivery,
  onSendPoAction,
}: SendPoButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    try {
      setLoading(true);

      // 1. Eksekusi server action untuk ubah status ke WAITING_DELIVERY dan kirim notifikasi internal & supplier
      await onSendPoAction(poId);

      // 2. Siapkan format email untuk Gmail
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const subject = `[PRMS] Purchase Order Resmi: ${poNumber} - SRI`;

      const itemList = details
        .slice(0, 15)
        .map((d, i) => `${i + 1}. ${d.itemName} - ${d.qty} ${d.unit}`)
        .join("\n");
      const moreItems = details.length > 15 ? `\n...dan ${details.length - 15} item lainnya.` : "";

      const contactText = supplier.contactPerson ? `Up: ${supplier.contactPerson}\n` : "";
      const purposeText = purposeProject ? `Keperluan / Proyek: ${purposeProject}\n` : "";
      const deliveryText = expectedDelivery ? `Perkiraan Pengiriman: ${expectedDelivery}\n` : "";

      const body = `Kepada Yth.\n${supplier.name}\n${contactText}\nDengan hormat,\n\nBersama ini kami kirimkan Purchase Order (PO) resmi sebagai berikut:\n\nNomor PO: ${poNumber}\nTanggal PO: ${poDate}\n${purposeText}${deliveryText}\nRincian Item:\n${itemList}${moreItems}\n\nSilakan tinjau pesanan ini, lakukan konfirmasi dan tanda tangan digital, serta jadwalkan pengiriman melalui link Portal Supplier PRMS berikut:\n${baseUrl}/supplier/purchase-orders/${poId}\n\nTerima kasih atas kerja samanya.\n\nHormat kami,\nTim Purchasing PRMS`;

      const toEmail = supplier.email || "";
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      // 3. Buka Gmail di tab baru
      const win = window.open(gmailUrl, "_blank");
      if (!win) {
        // Jika pop-up diblokir browser, arahkan via window.location
        window.location.href = gmailUrl;
      }
    } catch (err) {
      console.error("Error sending PO:", err);
      alert("Gagal memproses pengiriman PO. Silakan coba kembali.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="primary"
      disabled={loading}
      onClick={handleSend}
      className="gap-1.5 font-bold shadow-xs cursor-pointer"
      title="Kirim PO ke Supplier, kirim notifikasi, dan buka draf email Gmail resmi"
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Mengirim...</span>
        </>
      ) : (
        <>
          <Send className="w-4 h-4" />
          <span>Kirim ke Supplier</span>
          <Mail className="w-3.5 h-3.5 text-blue-200" />
        </>
      )}
    </Button>
  );
}

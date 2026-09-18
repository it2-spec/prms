"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QrScanner from "./QrScanner";
import { Card, PageTitle } from "@/components/ui";

export default function ScanPageClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResult(deliveryNumber: string) {
    setLoading(true);
    setError(null);
    router.push(`/warehouse/scan/result?delivery=${encodeURIComponent(deliveryNumber)}`);
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title="Scan QR Code"
        subtitle="Scan QR pada barang / surat jalan untuk mulai receiving (FR-05)"
        breadcrumb={["Scan QR"]}
      />

      {loading && (
        <div className="alert alert-primary py-2 text-sm" role="alert">
          Memuat data delivery...
        </div>
      )}
      {error && (
        <div className="alert alert-danger py-2 text-sm" role="alert">
          {error}
        </div>
      )}

      <Card>
        <QrScanner onResult={handleResult} />
      </Card>
    </div>
  );
}

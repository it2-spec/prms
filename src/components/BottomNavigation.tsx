"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  QrCode,
  Truck,
  Boxes,
  Settings,
  ClipboardList,
  History,
  FileText,
  User,
  Activity,
  Layers,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const iconMap: Record<string, React.ComponentType<any>> = {
  "stroke-home": Home,
  "stroke-search": QrCode,
  "stroke-progress-delivery": Truck,
  "stroke-package": Boxes,
  "stroke-widget": Settings,
  "stroke-form": ClipboardList,
  "stroke-delivered": History,
  "stroke-file": FileText,
  "stroke-user": User,
  "stroke-activity": Activity,
  "stroke-table": Layers,
};

function formatShortLabel(label: string): string {
  if (label === "Scan Incoming") return "Incoming";
  if (label === "Scan Outgoing") return "Outgoing";
  if (label === "Stok Material") return "Stok";
  if (label === "Dashboard") return "Dashboard";
  if (label === "Setting") return "Setting";
  return label
    .replace(" Receiving", "")
    .replace(" Dashboard", "")
    .replace(" Input", "")
    .replace(" Material", "");
}

export default function BottomNavigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Bottom Navigation"
      className="print:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
      style={{
        paddingBottom: "max(0.4rem, env(safe-area-inset-bottom, 0.4rem))",
      }}
    >
      <div className="max-w-md mx-auto flex items-center justify-around px-1 h-14 sm:h-16">
        {items.map((item) => {
          const IconComponent = iconMap[item.icon] || Home;

          // Cek active state secara cerdas
          let isActive = false;
          if (item.href === "/warehouse") {
            isActive = pathname === "/warehouse";
          } else if (item.href === "/warehouse/settings") {
            // Setting aktif juga saat membuka manual receiving atau histori transaksi
            isActive =
              pathname.startsWith("/warehouse/settings") ||
              pathname.startsWith("/warehouse/manual") ||
              pathname.startsWith("/warehouse/history");
          } else {
            isActive =
              pathname === item.href ||
              (item.href !== "/warehouse" && pathname.startsWith(item.href));
          }

          const shortLabel = formatShortLabel(item.label);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 min-w-0 transition-all duration-150 select-none group cursor-pointer ${
                isActive
                  ? "text-blue-600 font-bold"
                  : "text-slate-400 hover:text-slate-600 active:scale-95"
              }`}
            >
              <div
                className={`relative flex items-center justify-center p-1 rounded-full transition-colors ${
                  isActive ? "bg-blue-50 text-blue-600" : "group-hover:bg-slate-100/70"
                }`}
              >
                <IconComponent
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? "scale-105 stroke-[2.3]" : "stroke-[1.8]"
                  }`}
                />
              </div>
              <span
                className={`text-[10px] leading-none tracking-tight truncate max-w-full mt-0.5 ${
                  isActive ? "font-bold text-blue-600" : "font-medium text-slate-500"
                }`}
              >
                {shortLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}


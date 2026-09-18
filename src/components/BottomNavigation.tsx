"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, QrCode, ClipboardList, History } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const iconMap: Record<string, React.ComponentType<any>> = {
  "stroke-home": Home,
  "stroke-search": QrCode,
  "stroke-form": ClipboardList,
  "stroke-delivered": History,
};

export default function BottomNavigation({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="print:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 h-16 flex items-center justify-around z-40 shadow-lg">
      {items.map((item) => {
        const IconComponent = iconMap[item.icon] || Home;
        const isActive =
          pathname === item.href ||
          (item.href !== "/warehouse" && pathname.startsWith(item.href));

        const shortLabel = item.label
          .replace(" Receiving", "")
          .replace(" Dashboard", "")
          .replace(" Input", "");

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors cursor-pointer ${
              isActive ? "text-blue-600 font-semibold" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            <IconComponent className="w-5 h-5" />
            <span className="text-[10px] tracking-wide font-medium">{shortLabel}</span>
          </Link>
        );
      })}
    </div>
  );
}

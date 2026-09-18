"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  Truck,
  Package,
  Database,
  Users,
  BarChart3,
  Activity,
  QrCode,
  ClipboardList,
  History,
  Menu,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User as UserIcon,
  Laptop,
} from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import PushNotificationManager from "@/components/PushNotificationManager";

type NavItem = {
  href: string;
  label: string;
  icon: string;
};

interface DashboardShellProps {
  user: { name: string; username: string; role: string; approvalLevel?: number };
  roleLabel: string;
  items: NavItem[];
  children: React.ReactNode;
  logoutAction: () => Promise<void>;
}

const iconMap: Record<string, React.ComponentType<any>> = {
  "stroke-home": Home,
  "stroke-file": FileText,
  "stroke-progress-delivery": Truck,
  "stroke-package": Package,
  "stroke-table": Database,
  "stroke-user": Users,
  "stroke-reports": BarChart3,
  "stroke-activity": Activity,
  "stroke-search": QrCode,
  "stroke-form": ClipboardList,
  "stroke-delivered": History,
  "stroke-device": Laptop,
};

export default function DashboardShell({
  user,
  roleLabel,
  items,
  children,
  logoutAction,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const isWarehouse = user.role === "WAREHOUSE";

  // Hydrate collapsed preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("prms_sidebar_collapsed");
      if (saved === "true") {
        setIsCollapsed(true);
      }
    } catch {
      // ignore in restricted environments
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("prms_sidebar_collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800">
      {/* Top Header */}
      <header className="print:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2">
          {/* Mobile hamburger toggle */}
          {!isWarehouse && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer md:hidden"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Desktop sidebar collapse toggle */}
          {!isWarehouse && (
            <button
              onClick={toggleCollapse}
              className="hidden md:inline-flex p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer items-center justify-center"
              title={isCollapsed ? "Perluas Sidebar (Expand)" : "Ciutkan Sidebar (Collapse)"}
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <Link href={`/${user.role.toLowerCase()}`} className="flex items-center gap-2.5 ml-1">
            <img className="h-8 w-auto object-contain" src="/prms.png" alt="PRMS" />
            <span className="font-bold text-lg text-slate-900 tracking-tight hidden sm:inline-block">PRMS</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            {roleLabel} Portal
          </div>

          {/* Notification Bell */}
          <NotificationBell isApprover={user.approvalLevel === 1 || user.approvalLevel === 2} />

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-xs font-semibold text-slate-800 leading-none">{user.name}</p>
                <p className="text-[10px] text-slate-500 leading-none mt-0.5">{roleLabel}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-500 hidden md:block" />
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{user.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">@{user.username}</p>
                  </div>
                  <div className="py-1">
                    <form action={logoutAction} className="m-0">
                      <button
                        type="submit"
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer font-medium"
                      >
                        <LogOut className="w-4 h-4" />
                        Log out
                      </button>
                    </form>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex flex-1 relative">
        {/* Sidebar Overlay (Mobile) */}
        {sidebarOpen && !isWarehouse && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar Navigation */}
        {!isWarehouse && (
          <aside
            className={`print:hidden fixed md:static inset-y-0 left-0 bg-white border-r border-slate-200 transform md:transform-none transition-all duration-300 ease-in-out z-50 md:z-0 flex flex-col pt-16 md:pt-0 ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            } ${isCollapsed ? "w-64 md:w-[72px]" : "w-64"}`}
          >
            {/* Mobile close button */}
            <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-slate-100 absolute top-0 left-0 right-0">
              <span className="font-bold text-slate-800 text-sm">Navigation</span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav links */}
            <nav className={`flex-1 overflow-y-auto ${isCollapsed ? "p-2 space-y-1.5" : "p-3 space-y-1"}`}>
              {items.map((item) => {
                const IconComponent = iconMap[item.icon] || Home;
                const isActive =
                  pathname === item.href ||
                  (item.href !== `/${user.role.toLowerCase()}` && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    title={isCollapsed ? item.label : undefined}
                    className={`relative group flex items-center rounded-xl text-sm font-medium transition-all ${
                      isCollapsed
                        ? "justify-center p-2.5"
                        : "gap-3 px-3.5 py-2.5"
                    } ${
                      isActive
                        ? "bg-blue-50 text-blue-700 font-semibold shadow-xs"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <IconComponent
                      className={`shrink-0 transition-transform group-hover:scale-105 ${
                        isCollapsed ? "w-5 h-5" : "w-4 h-4"
                      } ${isActive ? "text-blue-700" : "text-slate-400 group-hover:text-slate-700"}`}
                    />

                    {!isCollapsed && <span className="truncate">{item.label}</span>}

                    {/* Modern floating tooltip when collapsed on desktop */}
                    {isCollapsed && (
                      <div className="hidden md:flex absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 items-center gap-1">
                        <span>{item.label}</span>
                        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                      </div>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop Bottom Collapse / Expand Button */}
            <div className="hidden md:block p-2 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={toggleCollapse}
                title={isCollapsed ? "Perluas Sidebar" : "Ciutkan Sidebar"}
                className={`w-full flex items-center rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-white hover:shadow-xs border border-transparent hover:border-slate-200 transition-all cursor-pointer ${
                  isCollapsed ? "justify-center p-2" : "justify-between px-3 py-2"
                }`}
              >
                {!isCollapsed && <span>Ciutkan Sidebar</span>}
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
          </aside>
        )}

        {/* Main Content Area */}
        <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 print:p-0 print:m-0 print:block ${isWarehouse ? "pb-20" : ""}`}>
          <div className="p-4 sm:p-6 md:p-8 flex-grow print:p-0 print:m-0">{children}</div>

          <footer className="print:hidden bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-400 font-medium">
            Copyright © {new Date().getFullYear()} PRMS — Procurement Receiving Management System
          </footer>
        </main>
      </div>

      {/* Web Push Prompt & Registration Manager */}
      <PushNotificationManager />
    </div>
  );
}

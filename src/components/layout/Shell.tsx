"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  LayoutDashboard,
  Store,
  Receipt,
  ChefHat,
  UtensilsCrossed,
  Users,
  Grid2X2,
  BarChart3,
  Wallet,
  ReceiptText,
  Settings,
  LogOut,
  Keyboard,
  Clock,
  CircleDot,
  Server,
  Database,
  Menu,
  X,
  PlusCircle,
  CheckCircle2,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: string;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState("");
  const [dbConnected, setDbConnected] = React.useState(true);
  const [serverConnected, setServerConnected] = React.useState(true);
  const [showShortcuts, setShowShortcuts] = React.useState(false);

  // Fetch current user session
  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          if (pathname !== "/login") router.push("/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {});
  }, [pathname, router]);

  // Clock ticker
  React.useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-PK", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll system status & active register shift
  React.useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/status");
        if (res.ok) {
          const data = await res.json();
          setServerConnected(data.server);
          setDbConnected(data.database);
        } else {
          setServerConnected(false);
        }
      } catch {
        setServerConnected(false);
      }
    };

    checkStatus();
    const timer = setInterval(() => {
      checkStatus();
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Global Keyboard Shortcuts (F1 - F8)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement)?.tagName
        ) &&
        e.key !== "Escape" &&
        e.key !== "F1" &&
        e.key !== "F2"
      ) {
        return;
      }

      switch (e.key) {
        case "F1":
          e.preventDefault();
          router.push("/pos");
          break;
        case "F2":
          e.preventDefault();
          const searchInput = document.getElementById("pos-search-input");
          if (searchInput) searchInput.focus();
          break;
        case "F3":
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("pos-new-order"));
          break;
        case "F4":
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("pos-hold-order"));
          break;
        case "F5":
          e.preventDefault();
          window.dispatchEvent(new CustomEvent("pos-open-payment"));
          break;
        case "F6":
          e.preventDefault();
          router.push("/orders");
          break;
        case "F7":
          e.preventDefault();
          router.push("/tables");
          break;
        case "F8":
          e.preventDefault();
          router.push("/reports");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  // Nav Items with role-based visibility
  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN", "MANAGER"] },
    { label: "POS Terminal", href: "/pos", icon: Store, roles: ["ADMIN", "MANAGER", "CASHIER"] },
    { label: "Orders", href: "/orders", icon: Receipt, roles: ["ADMIN", "MANAGER", "CASHIER"] },
    { label: "Menu", href: "/menu", icon: UtensilsCrossed, roles: ["ADMIN", "MANAGER"] },
    { label: "Tables", href: "/tables", icon: Grid2X2, roles: ["ADMIN", "MANAGER", "CASHIER"] },
    { label: "Reports", href: "/reports", icon: BarChart3, roles: ["ADMIN", "MANAGER"] },
    { label: "Settings", href: "/settings", icon: Settings, roles: ["ADMIN", "MANAGER"] },
  ];

  const visibleNavItems = navItems.filter((item) => {
    if (!user) return true;
    return item.roles.includes(user.role);
  });

  // If on login page, render plain children
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0c0d10] text-zinc-100 select-none">
      {/* SIDEBAR */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 76 : 240 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="flex flex-col border-r border-zinc-800/80 bg-[#121318] z-30 shrink-0"
      >
        {/* Brand Banner */}
        <div className="flex h-16 items-center px-4 border-b border-zinc-800/80 justify-between">
          <Link href="/pos" className="flex items-center gap-3 overflow-hidden group">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-zinc-900 border border-orange-500/30 shadow-md shadow-orange-500/10 p-0.5">
              <Image
                src="/logo.PNG"
                alt="Fork & Fire logo"
                width={44}
                height={44}
                priority
                className="h-full w-full object-contain rounded-lg group-hover:scale-105 transition-transform"
              />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col truncate">
                <span className="text-base font-black tracking-wider text-white">
                  FORK <span className="text-orange-500">&</span> FIRE
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-orange-400">
                  Fast Food POS
                </span>
              </div>
            )}
          </Link>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {visibleNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/pos" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all group relative",
                  isActive
                    ? "bg-gradient-to-r from-orange-600/20 to-orange-500/10 text-orange-400 border border-orange-500/30 font-semibold"
                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200 border border-transparent"
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-transform group-hover:scale-110",
                    isActive ? "text-orange-400" : "text-zinc-400 group-hover:text-zinc-200"
                  )}
                />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                {isActive && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute right-2 h-1.5 w-1.5 rounded-full bg-orange-500"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </motion.aside>

      {/* MAIN VIEWPORT */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* TOP BAR */}
        <header className="flex h-16 items-center justify-between border-b border-zinc-800/80 bg-[#14151a] px-5 z-20 shrink-0">
          {/* Left: Restaurant title & Breadcrumb */}
          <div className="flex items-center gap-4">
            <span className="text-lg font-black tracking-wide text-white flex items-center gap-2">
              <span className="text-orange-500">FORK & FIRE</span>
              <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                LOCAL SERVER
              </span>
            </span>
          </div>

          {/* Center: System Status Indicators */}
          <div className="hidden md:flex items-center gap-4 text-xs font-medium">
            {/* Local Server Indicator */}
            <div
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
                serverConnected
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                  : "bg-red-950/40 border-red-500/30 text-red-400"
              )}
            >
              <Server className="h-3.5 w-3.5" />
              <span>{serverConnected ? "Local Server Connected" : "Server Disconnected"}</span>
            </div>

            {/* Database Indicator */}
            <div
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
                dbConnected
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                  : "bg-amber-950/40 border-amber-500/30 text-amber-400"
              )}
            >
              <Database className="h-3.5 w-3.5" />
              <span>{dbConnected ? "Database Connected" : "Database Connecting..."}</span>
            </div>

            {/* Live Clock */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono">
              <Clock className="h-3.5 w-3.5 text-orange-400" />
              <span>{currentTime}</span>
            </div>
          </div>

          {/* Right: Shortcuts button, User profile, Logout */}
          <div className="flex items-center gap-3">
            {/* Keyboard Shortcuts Trigger */}
            <button
              onClick={() => setShowShortcuts(true)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
              title="View Keyboard Shortcuts"
            >
              <Keyboard className="h-3.5 w-3.5 text-orange-400" />
              <span className="hidden sm:inline">Shortcuts</span>
            </button>

            {/* User Profile */}
            {user && (
              <div className="flex items-center gap-2 pl-2 border-l border-zinc-800">
                <div className="flex flex-col items-end">
                  <span className="text-xs font-semibold text-zinc-200">
                    {user.name}
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-orange-400">
                    {user.role}
                  </span>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600/20 border border-orange-500/40 text-orange-400 text-xs font-bold">
                  {user.name.charAt(0)}
                </div>
              </div>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-zinc-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* CONTENT AREA */}
        <main className="flex-1 overflow-hidden relative bg-[#0c0d10]">
          {children}
        </main>
      </div>

      {/* KEYBOARD SHORTCUTS MODAL */}
      <Modal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        title="POS Keyboard Shortcuts"
        description="Fast one-key actions designed for rapid cashier throughput"
        maxWidth="md"
      >
        <div className="grid grid-cols-2 gap-2 text-xs py-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300">POS Terminal</span>
            <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-600 font-mono text-orange-400 font-bold">
              F1
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300">Search / Barcode Focus</span>
            <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-600 font-mono text-orange-400 font-bold">
              F2
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300">New / Clear Order</span>
            <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-600 font-mono text-orange-400 font-bold">
              F3
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300">Hold Order</span>
            <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-600 font-mono text-orange-400 font-bold">
              F4
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300">Open Checkout / Pay</span>
            <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-600 font-mono text-orange-400 font-bold">
              F5
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300">Orders List</span>
            <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-600 font-mono text-orange-400 font-bold">
              F6
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300">Table Floor Plan</span>
            <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-600 font-mono text-orange-400 font-bold">
              F7
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300">Reports</span>
            <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-600 font-mono text-orange-400 font-bold">
              F8
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300">Close Dialog / Cancel</span>
            <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-600 font-mono text-zinc-300 font-bold">
              ESC
            </kbd>
          </div>
          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/60 border border-zinc-700">
            <span className="text-zinc-300">Confirm Action</span>
            <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-600 font-mono text-zinc-300 font-bold">
              ENTER
            </kbd>
          </div>
        </div>
      </Modal>

      {/* KEYBOARD SHORTCUTS MODAL */}
    </div>
  );
}

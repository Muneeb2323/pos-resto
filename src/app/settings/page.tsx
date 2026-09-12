"use client";

import * as React from "react";
import {
  Settings,
  Database,
  Save,
  Download,
  Upload,
  ShieldCheck,
  Printer,
  Building,
  CheckCircle2,
  AlertTriangle,
  History,
  FileJson,
  Users,
  UserPlus,
  Trash2,
  Phone,
  UserCheck,
  UserX,
  X,
  Bike,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAsyncLoad } from "@/lib/hooks/useAsyncLoad";
import { invalidateRestaurantSettings } from "@/lib/hooks/useRestaurantSettings";

export default function SettingsPage() {
  const [settings, setSettings] = React.useState<any>(null);
  const [auditLogs, setAuditLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"general" | "waiters" | "printer" | "backup" | "audit">("general");

  // Waiter & Rider Management State
  const [staffSubTab, setStaffSubTab] = React.useState<"waiters" | "riders">("waiters");
  const [waiters, setWaiters] = React.useState<any[]>([]);
  const [loadingWaiters, setLoadingWaiters] = React.useState(false);
  const [showAddWaiterModal, setShowAddWaiterModal] = React.useState(false);
  const [newWaiterName, setNewWaiterName] = React.useState("");
  const [newWaiterPhone, setNewWaiterPhone] = React.useState("");
  const [addingWaiter, setAddingWaiter] = React.useState(false);

  // Rider Management State
  const [riders, setRiders] = React.useState<any[]>([]);
  const [loadingRiders, setLoadingRiders] = React.useState(false);
  const [showAddRiderModal, setShowAddRiderModal] = React.useState(false);
  const [newRiderName, setNewRiderName] = React.useState("");
  const [newRiderPhone, setNewRiderPhone] = React.useState("");
  const [newRiderVehicle, setNewRiderVehicle] = React.useState("");
  const [addingRider, setAddingRider] = React.useState(false);

  // Restore file ref
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchSettings = React.useCallback(async () => {
    try {
      setLoading(true);
      const [setRes, auditRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/audit?limit=50"),
      ]);

      if (setRes.ok) setSettings(await setRes.json());
      if (auditRes.ok) setAuditLogs(await auditRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useAsyncLoad(fetchSettings);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        // Receipt modals read settings through a per-page cache; drop it so the next
        // bill printed shows what was just saved.
        invalidateRestaurantSettings();
        alert("Restaurant settings updated successfully!");
        fetchSettings();
      }
    } catch (err) {
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = () => {
    // A hidden anchor triggers the download without navigating the terminal away from
    // the Settings screen, which `window.location.href` would do on a slow response.
    const link = document.createElement("a");
    link.href = "/api/backup";
    link.download = "";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("Are you sure you want to restore from this backup file? Existing data will be updated.")) {
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = JSON.parse(event.target?.result as string);
          const res = await fetch("/api/backup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(content),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Restore failed");

          alert("Database successfully restored from backup!");
          window.location.reload();
        } catch (err: unknown) {
          alert(err instanceof Error ? err.message : "Invalid backup file");
        }
      };
      reader.readAsText(file);
    } catch (err) {
      alert("Error reading file");
    }
  };

  const [clearingData, setClearingData] = React.useState(false);

  const handleClearTransactions = async () => {
    const confirmation = prompt(
      'Are you sure you want to clear all test orders, payments, and dashboard history?\n\nType "CLEAR" to confirm. (Menu, Deals, Waiters, and Settings will remain safe):'
    );
    if (confirmation !== "CLEAR") {
      if (confirmation !== null) alert('Operation cancelled. You must type "CLEAR" in capital letters.');
      return;
    }

    setClearingData(true);
    try {
      const res = await fetch("/api/admin/clear-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Echoing the phrase back is what distinguishes a deliberate purge from a
        // stray request; the endpoint refuses anything else.
        body: JSON.stringify({ confirm: "CLEAR" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clear data");
      alert("Order history, payments, and dashboard data successfully cleared! Your menu and deals are safe.");
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "Failed to clear data");
    } finally {
      setClearingData(false);
    }
  };

  // Waiters CRUD
  const fetchWaiters = React.useCallback(async () => {
    try {
      setLoadingWaiters(true);
      const res = await fetch("/api/staff?all=true");
      if (res.ok) {
        const data = await res.json();
        setWaiters(data);
      }
    } catch (err) {
      console.error("Failed to load waiters", err);
    } finally {
      setLoadingWaiters(false);
    }
  }, []);

  useAsyncLoad(fetchWaiters);

  const handleAddWaiter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWaiterName.trim()) {
      alert("Please enter waiter name");
      return;
    }
    setAddingWaiter(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newWaiterName.trim(),
          phone: newWaiterPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add waiter");
      setNewWaiterName("");
      setNewWaiterPhone("");
      setShowAddWaiterModal(false);
      fetchWaiters();
    } catch (err: any) {
      alert(err.message || "Failed to add waiter");
    } finally {
      setAddingWaiter(false);
    }
  };

  const handleToggleWaiter = async (w: any) => {
    try {
      const res = await fetch("/api/staff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: w.id, isActive: !w.isActive }),
      });
      if (res.ok) fetchWaiters();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteWaiter = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove waiter "${name}"?`)) return;
    try {
      const res = await fetch(`/api/staff?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) fetchWaiters();
    } catch (err) {
      console.error(err);
    }
  };

  // Riders CRUD
  const fetchRiders = React.useCallback(async () => {
    try {
      setLoadingRiders(true);
      const res = await fetch("/api/riders?all=true");
      if (res.ok) {
        const data = await res.json();
        setRiders(data);
      }
    } catch (err) {
      console.error("Failed to load riders", err);
    } finally {
      setLoadingRiders(false);
    }
  }, []);

  useAsyncLoad(fetchRiders);

  const handleAddRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRiderName.trim()) {
      alert("Please enter rider name");
      return;
    }
    setAddingRider(true);
    try {
      const res = await fetch("/api/riders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRiderName.trim(),
          phone: newRiderPhone.trim(),
          vehicleNo: newRiderVehicle.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add rider");
      setNewRiderName("");
      setNewRiderPhone("");
      setNewRiderVehicle("");
      setShowAddRiderModal(false);
      fetchRiders();
    } catch (err: any) {
      alert(err.message || "Failed to add rider");
    } finally {
      setAddingRider(false);
    }
  };

  const handleToggleRider = async (r: any) => {
    try {
      const res = await fetch("/api/riders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, isActive: !r.isActive }),
      });
      if (res.ok) fetchRiders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRider = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove rider "${name}"?`)) return;
    try {
      const res = await fetch(`/api/riders?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) fetchRiders();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-500 text-xs">
        <span className="h-5 w-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mr-2" />
        Loading settings...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0c0d10] text-zinc-100 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30">
            <Settings className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wider text-white">
              SYSTEM & RESTAURANT SETTINGS
            </h1>
            <p className="text-xs text-zinc-400">
              Terminal configuration, tax rates, thermal printing, and local backups
            </p>
          </div>
        </div>

        {(activeTab === "general" || activeTab === "printer") && (
          <Button
            variant="fire"
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="text-xs flex items-center gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 text-xs font-semibold">
        {[
          { id: "general", label: "Restaurant & Tax", icon: Building },
          { id: "waiters", label: "Waiters & Riders", icon: Users },
          { id: "printer", label: "Printer & Receipts", icon: Printer },
          { id: "backup", label: "Local Backup & Restore", icon: Database },
          { id: "audit", label: "Audit Logs", icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSel = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                isSel
                  ? "bg-orange-600 text-white shadow-sm"
                  : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: GENERAL & RESTAURANT */}
      {activeTab === "general" && (
        <form onSubmit={handleSave} className="space-y-4 max-w-2xl text-xs">
          <div className="p-5 rounded-2xl border border-zinc-800 bg-[#13141b] space-y-4">
            <h3 className="font-bold text-sm text-white border-b border-zinc-800 pb-2">
              Restaurant Brand Information
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">Restaurant Name</label>
                <Input
                  type="text"
                  value={settings.restaurantName}
                  onChange={(e) =>
                    setSettings({ ...settings, restaurantName: e.target.value })
                  }
                  className="bg-zinc-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">Tagline</label>
                <Input
                  type="text"
                  value={settings.tagline}
                  onChange={(e) =>
                    setSettings({ ...settings, tagline: e.target.value })
                  }
                  className="bg-zinc-900"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-zinc-300">Physical Address</label>
              <Input
                type="text"
                value={settings.address}
                onChange={(e) =>
                  setSettings({ ...settings, address: e.target.value })
                }
                className="bg-zinc-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">Phone Number / UAN</label>
                <Input
                  type="text"
                  value={settings.phone}
                  onChange={(e) =>
                    setSettings({ ...settings, phone: e.target.value })
                  }
                  className="bg-zinc-900 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">Currency Symbol</label>
                <Input
                  type="text"
                  value={settings.currencySymbol}
                  onChange={(e) =>
                    setSettings({ ...settings, currencySymbol: e.target.value })
                  }
                  className="bg-zinc-900 font-bold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-zinc-300">GST / Sales Tax Rate (%)</label>
              <Input
                type="number"
                value={settings.taxRate}
                onChange={(e) =>
                  setSettings({ ...settings, taxRate: e.target.value })
                }
                className="bg-zinc-900 font-bold max-w-xs"
              />
              <span className="text-[11px] text-zinc-500">
                Applied automatically to orders at POS checkout
              </span>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: WAITERS & RIDERS */}
      {activeTab === "waiters" && (
        <div className="space-y-4 max-w-4xl text-xs">
          {/* Sub-tabs: Waiters vs Delivery Riders */}
          <div className="flex items-center gap-2 p-1.5 bg-[#13141b] rounded-2xl border border-zinc-800 w-fit">
            <button
              type="button"
              onClick={() => setStaffSubTab("waiters")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                staffSubTab === "waiters"
                  ? "bg-orange-600 text-white shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Dine-In Waiters</span>
              <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full font-mono">
                {waiters.filter((w) => w.isActive).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStaffSubTab("riders")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                staffSubTab === "riders"
                  ? "bg-orange-600 text-white shadow-md"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Bike className="h-4 w-4" />
              <span>Delivery Riders</span>
              <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded-full font-mono">
                {riders.filter((r) => r.isActive).length}
              </span>
            </button>
          </div>

          {/* SUB-PANEL 1: WAITERS */}
          {staffSubTab === "waiters" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#13141b] border border-zinc-800 p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      Dine-In Table Waiters
                      <span className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/30 font-mono">
                        {waiters.filter((w) => w.isActive).length} Active in POS
                      </span>
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Manage table service staff. These waiters appear in the POS waiter selector for dine-in tables.
                    </p>
                  </div>
                </div>
                <Button
                  variant="fire"
                  size="sm"
                  onClick={() => setShowAddWaiterModal(true)}
                  className="text-xs flex items-center gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Waiter
                </Button>
              </div>

              {/* Waiters Table */}
              <div className="rounded-2xl border border-zinc-800 bg-[#13141b] overflow-hidden">
                {loadingWaiters ? (
                  <div className="p-8 text-center text-zinc-500">
                    <span className="h-4 w-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin inline-block mr-2" />
                    Loading waiters...
                  </div>
                ) : waiters.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 space-y-2">
                    <Users className="h-8 w-8 mx-auto text-zinc-600" />
                    <p className="font-semibold text-zinc-400">No waiters added yet</p>
                    <p className="text-[11px] text-zinc-600">
                      Click &ldquo;Add Waiter&rdquo; above to add your floor staff.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-[#181922] text-zinc-400 font-bold border-b border-zinc-800 uppercase text-[10px]">
                      <tr>
                        <th className="p-3.5">Waiter Name</th>
                        <th className="p-3.5">Contact / Phone</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Added Date</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {waiters.map((w) => (
                        <tr key={w.id} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="p-3.5 font-bold text-white flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[11px] font-black text-orange-400">
                              {w.name?.charAt(0).toUpperCase() || "W"}
                            </div>
                            <span className="text-sm">{w.name}</span>
                          </td>
                          <td className="p-3.5 font-mono text-zinc-400">
                            {w.phone ? (
                              <span className="flex items-center gap-1 text-zinc-300">
                                <Phone className="h-3 w-3 text-zinc-500" />
                                {w.phone}
                              </span>
                            ) : (
                              <span className="text-zinc-600 italic">No phone</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            {w.isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                <UserCheck className="h-3 w-3" />
                                Active in POS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px]">
                                <UserX className="h-3 w-3" />
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-zinc-500 text-[11px]">
                            {w.createdAt ? formatDateTime(w.createdAt) : "—"}
                          </td>
                          <td className="p-3.5 text-right space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleWaiter(w)}
                              className={`h-7 px-2.5 text-[11px] font-bold ${
                                w.isActive
                                  ? "text-zinc-400 hover:text-amber-400 hover:bg-zinc-800"
                                  : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                              }`}
                            >
                              {w.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteWaiter(w.id, w.name)}
                              className="h-7 px-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* SUB-PANEL 2: RIDERS */}
          {staffSubTab === "riders" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#13141b] border border-zinc-800 p-4 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                    <Bike className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      Delivery Riders & Bikers
                      <span className="text-[10px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/30 font-mono">
                        {riders.filter((r) => r.isActive).length} Active in POS
                      </span>
                    </h3>
                    <p className="text-[11px] text-zinc-400">
                      Manage delivery personnel. These riders appear in the POS rider selector for delivery orders.
                    </p>
                  </div>
                </div>
                <Button
                  variant="fire"
                  size="sm"
                  onClick={() => setShowAddRiderModal(true)}
                  className="text-xs flex items-center gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Rider
                </Button>
              </div>

              {/* Riders Table */}
              <div className="rounded-2xl border border-zinc-800 bg-[#13141b] overflow-hidden">
                {loadingRiders ? (
                  <div className="p-8 text-center text-zinc-500">
                    <span className="h-4 w-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin inline-block mr-2" />
                    Loading delivery riders...
                  </div>
                ) : riders.length === 0 ? (
                  <div className="p-8 text-center text-zinc-500 space-y-2">
                    <Bike className="h-8 w-8 mx-auto text-zinc-600" />
                    <p className="font-semibold text-zinc-400">No delivery riders added yet</p>
                    <p className="text-[11px] text-zinc-600">
                      Click &ldquo;Add Rider&rdquo; above to add your delivery staff.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-[#181922] text-zinc-400 font-bold border-b border-zinc-800 uppercase text-[10px]">
                      <tr>
                        <th className="p-3.5">Rider Name</th>
                        <th className="p-3.5">Contact / Phone</th>
                        <th className="p-3.5">Vehicle / Bike #</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Added Date</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {riders.map((r) => (
                        <tr key={r.id} className="hover:bg-zinc-800/40 transition-colors">
                          <td className="p-3.5 font-bold text-white flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[11px] font-black text-orange-400">
                              <Bike className="h-3.5 w-3.5 text-orange-400" />
                            </div>
                            <span className="text-sm">{r.name}</span>
                          </td>
                          <td className="p-3.5 font-mono text-zinc-400">
                            {r.phone ? (
                              <span className="flex items-center gap-1 text-zinc-300">
                                <Phone className="h-3 w-3 text-zinc-500" />
                                {r.phone}
                              </span>
                            ) : (
                              <span className="text-zinc-600 italic">No phone</span>
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-zinc-300">
                            {r.vehicleNo ? (
                              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-[11px] text-amber-300">
                                {r.vehicleNo}
                              </span>
                            ) : (
                              <span className="text-zinc-600 italic">—</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            {r.isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                                <UserCheck className="h-3 w-3" />
                                Active in POS
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px]">
                                <UserX className="h-3 w-3" />
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 font-mono text-zinc-500 text-[11px]">
                            {r.createdAt ? formatDateTime(r.createdAt) : "—"}
                          </td>
                          <td className="p-3.5 text-right space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleRider(r)}
                              className={`h-7 px-2.5 text-[11px] font-bold ${
                                r.isActive
                                  ? "text-zinc-400 hover:text-amber-400 hover:bg-zinc-800"
                                  : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                              }`}
                            >
                              {r.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRider(r.id, r.name)}
                              className="h-7 px-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      )}



      {/* TAB 3: PRINTER & RECEIPTS */}
      {activeTab === "printer" && (
        <form onSubmit={handleSave} className="space-y-4 max-w-2xl text-xs">
          <div className="p-5 rounded-2xl border border-zinc-800 bg-[#13141b] space-y-4">
            <h3 className="font-bold text-sm text-white border-b border-zinc-800 pb-2">
              Thermal Receipt Formatting
            </h3>

            <div className="space-y-1">
              <label className="font-semibold text-zinc-300">Printer Name</label>
              <Input
                value={settings.printerName || ""}
                onChange={(e) => setSettings({ ...settings, printerName: e.target.value })}
                placeholder="Black Copper BC-85AC"
              />
              <p className="text-[11px] text-zinc-500">
                Must match the printer&apos;s name in Windows exactly (Settings &gt; Printers &amp;
                scanners). Receipts are sent straight to this queue.
              </p>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-zinc-300">Paper Width</label>
              <select
                value={settings.paperWidth}
                onChange={(e) =>
                  setSettings({ ...settings, paperWidth: parseInt(e.target.value, 10) })
                }
                className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value={80}>80mm Standard Thermal (Black Copper BC-85AC Turbo)</option>
                <option value={58}>58mm Compact Thermal Receipt</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-zinc-300">
                Online Payment Details
                <span className="ml-1.5 font-normal text-zinc-500">(customer bill only)</span>
              </label>
              <textarea
                value={settings.onlinePaymentInfo || ""}
                onChange={(e) =>
                  setSettings({ ...settings, onlinePaymentInfo: e.target.value })
                }
                rows={4}
                placeholder={"Jazzcash: 03216303563\nName: M.Abubakar zia"}
                className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono text-[11px] leading-relaxed"
              />
              <p className="text-[11px] text-zinc-500">
                Printed under an &quot;Online Payment&quot; heading on the customer bill, so a
                diner can transfer instead of paying at the counter. One detail per line.
                Leave empty to hide the section. It is never printed on a paid receipt.
              </p>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-zinc-300">Receipt Header Text</label>
              <textarea
                rows={2}
                value={settings.receiptHeader}
                onChange={(e) =>
                  setSettings({ ...settings, receiptHeader: e.target.value })
                }
                className="w-full p-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-zinc-300">Receipt Footer Text</label>
              <textarea
                rows={2}
                value={settings.receiptFooter}
                onChange={(e) =>
                  setSettings({ ...settings, receiptFooter: e.target.value })
                }
                className="w-full p-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>
        </form>
      )}

      {/* TAB 4: LOCAL BACKUP & RESTORE */}
      {activeTab === "backup" && (
        <div className="space-y-6 max-w-2xl text-xs">
          <div className="p-5 rounded-2xl border border-zinc-800 bg-[#13141b] space-y-4">
            <div>
              <h3 className="font-bold text-sm text-white">Create Local Database Backup</h3>
              <p className="text-zinc-400 text-[11px] mt-0.5">
                Generate an immediate complete backup archive containing menu products, prices, orders, customers, and shift records. Save to USB drive or local hard drive.
              </p>
            </div>

            <Button
              variant="fire"
              size="lg"
              onClick={handleDownloadBackup}
              className="text-xs font-bold"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Full Backup Archive (.json)
            </Button>
          </div>

          <div className="p-5 rounded-2xl border border-red-500/30 bg-red-950/10 space-y-4">
            <div>
              <h3 className="font-bold text-sm text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Restore Database from Backup
              </h3>
              <p className="text-zinc-400 text-[11px] mt-0.5">
                Upload a verified Fork & Fire backup file (.json) to restore system state.
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleRestoreFile}
              accept=".json"
              className="hidden"
            />

            <Button
              variant="outline"
              size="lg"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-red-300 border-red-500/40 hover:bg-red-950/30 font-bold"
            >
              <Upload className="h-4 w-4 mr-2" />
              Select Backup File to Restore
            </Button>
          </div>

          {/* PURGE TRANSACTIONS / RESET DASHBOARD */}
          <div className="p-5 rounded-2xl border border-red-500/40 bg-red-950/20 space-y-4">
            <div>
              <h3 className="font-bold text-sm text-red-400 flex items-center gap-1.5">
                <Trash2 className="h-4 w-4" />
                Clear Order History & Reset Dashboard
              </h3>
              <p className="text-zinc-400 text-[11px] mt-0.5">
                Wipes all past orders, customer order logs, payments, and dashboard statistics.
                <br />
                <span className="text-emerald-400 font-semibold">
                  ✓ Menu items, Special Deals, Pricing, Categories, Waiters, and Settings are 100% preserved.
                </span>
              </p>
            </div>

            <Button
              variant="destructive"
              size="lg"
              disabled={clearingData}
              onClick={handleClearTransactions}
              className="text-xs font-bold bg-red-600 hover:bg-red-700 text-white flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {clearingData ? "Clearing Data..." : "Clear Orders & Reset Dashboard"}
            </Button>
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT LOGS */}
      {activeTab === "audit" && (
        <div className="space-y-4 text-xs">
          <h3 className="font-bold text-sm text-white">Security & Action Audit Trail</h3>
          <div className="rounded-2xl border border-zinc-800 bg-[#13141b] overflow-hidden">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-[#181922] text-zinc-400 font-bold border-b border-zinc-800 uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">User</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Entity</th>
                  <th className="p-3.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-800/40">
                    <td className="p-3.5 font-mono text-zinc-400">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="p-3.5 font-semibold text-white">
                      {log.user?.name || "System"}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 font-mono text-orange-400 font-bold text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-zinc-400">
                      {log.entity}
                    </td>
                    <td className="p-3.5 font-mono text-zinc-400 truncate max-w-xs">
                      {log.details || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Waiter Modal */}
      {showAddWaiterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#13141b] border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/30 flex items-center justify-center">
                  <UserPlus className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm text-white">Add New Waiter</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddWaiterModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddWaiter} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">
                  Waiter Name <span className="text-orange-400">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Hamza, Ali, Rashid"
                  value={newWaiterName}
                  onChange={(e) => setNewWaiterName(e.target.value)}
                  autoFocus
                  required
                  className="bg-zinc-900 border-zinc-700"
                />
                <span className="text-[10px] text-zinc-500">
                  This name will appear on KOT slips and receipts when taking table orders.
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">
                  Phone / Staff ID <span className="text-zinc-500">(Optional)</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. 0300-1234567 or #101"
                  value={newWaiterPhone}
                  onChange={(e) => setNewWaiterPhone(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 font-mono"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddWaiterModal(false)}
                  className="text-zinc-400"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="fire"
                  size="sm"
                  disabled={addingWaiter || !newWaiterName.trim()}
                  className="text-xs flex items-center gap-1.5"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  {addingWaiter ? "Saving..." : "Save Waiter"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Rider Modal */}
      {showAddRiderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#13141b] border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                  <Bike className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm text-white">Add Delivery Rider</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddRiderModal(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddRider} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">
                  Rider Name <span className="text-blue-400">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Usman, Kamran, Bilal"
                  value={newRiderName}
                  onChange={(e) => setNewRiderName(e.target.value)}
                  autoFocus
                  required
                  className="bg-zinc-900 border-zinc-700"
                />
                <span className="text-[10px] text-zinc-500">
                  This rider can be selected for Delivery orders in POS and will appear on receipts.
                </span>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">
                  Phone Number <span className="text-zinc-500">(Optional)</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. 0312-9876543"
                  value={newRiderPhone}
                  onChange={(e) => setNewRiderPhone(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-zinc-300">
                  Vehicle / Bike Plate # <span className="text-zinc-500">(Optional)</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. LE-2023 or Bike #4"
                  value={newRiderVehicle}
                  onChange={(e) => setNewRiderVehicle(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 font-mono"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddRiderModal(false)}
                  className="text-zinc-400"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={addingRider || !newRiderName.trim()}
                  className="text-xs flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Bike className="h-3.5 w-3.5" />
                  {addingRider ? "Saving..." : "Save Rider"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

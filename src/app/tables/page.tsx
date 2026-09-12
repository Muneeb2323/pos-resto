"use client";

import * as React from "react";
import { Grid2X2, Plus, Users, UtensilsCrossed, CheckCircle2, AlertCircle } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useAsyncLoad } from "@/lib/hooks/useAsyncLoad";

export default function TablesPage() {
  const [tables, setTables] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [tableName, setTableName] = React.useState("");
  const [capacity, setCapacity] = React.useState("4");

  const fetchTables = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tables");
      if (res.ok) {
        setTables(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useAsyncLoad(fetchTables);

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) return;

    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tableName.trim(), capacity: parseInt(capacity, 10) || 4 }),
      });
      if (res.ok) {
        setTableName("");
        setShowAddModal(false);
        fetchTables();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateTableStatus = async (id: string, status: string) => {
    try {
      await fetch("/api/tables", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      fetchTables();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0c0d10] text-zinc-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-[#121319] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30">
            <Grid2X2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-wider text-white">
              FLOOR & TABLE MANAGEMENT
            </h1>
            <p className="text-[11px] text-zinc-400">
              Dine-in floor plan, active occupancy, and table reservation
            </p>
          </div>
        </div>

        <Button
          variant="fire"
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Table
        </Button>
      </div>

      {/* Tables Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex h-full items-center justify-center text-zinc-500 text-xs">
            <span className="h-5 w-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mr-2" />
            Loading tables...
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {tables.map((table) => {
              const isAvailable = table.status === "AVAILABLE";
              const isOccupied = table.status === "OCCUPIED";
              const isReserved = table.status === "RESERVED";

              return (
                <div
                  key={table.id}
                  className={cn(
                    "rounded-2xl border p-4 flex flex-col justify-between transition-all",
                    isAvailable
                      ? "bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-500/70"
                      : isOccupied
                      ? "bg-orange-950/20 border-orange-500/50 ring-1 ring-orange-500/30"
                      : "bg-blue-950/20 border-blue-500/40"
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-base text-white">{table.name}</h3>
                      <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                        <Users className="h-3.5 w-3.5" />
                        <span>{table.capacity}p</span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                          isAvailable
                            ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-400"
                            : isOccupied
                            ? "bg-orange-950/40 border-orange-500/40 text-orange-400"
                            : "bg-blue-950/40 border-blue-500/40 text-blue-400"
                        )}
                      >
                        {table.status}
                      </span>
                    </div>

                    {/* Active Order Info if Occupied */}
                    {isOccupied && table.orders?.[0] && (
                      <div className="mt-3 p-2 rounded-lg bg-zinc-900/80 border border-zinc-800 text-[11px]">
                        <div className="font-bold text-white">
                          Order {table.orders[0].orderNumber}
                        </div>
                        <div className="text-orange-400 font-semibold">
                          {formatCurrency(table.orders[0].grandTotal)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status Toggle Buttons */}
                  <div className="grid grid-cols-3 gap-1 pt-4 mt-3 border-t border-zinc-800 text-[10px]">
                    <button
                      onClick={() => updateTableStatus(table.id, "AVAILABLE")}
                      className={cn(
                        "py-1 rounded font-bold transition-colors",
                        isAvailable
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-white"
                      )}
                    >
                      Free
                    </button>
                    <button
                      onClick={() => updateTableStatus(table.id, "OCCUPIED")}
                      className={cn(
                        "py-1 rounded font-bold transition-colors",
                        isOccupied
                          ? "bg-orange-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-white"
                      )}
                    >
                      Busy
                    </button>
                    <button
                      onClick={() => updateTableStatus(table.id, "RESERVED")}
                      className={cn(
                        "py-1 rounded font-bold transition-colors",
                        isReserved
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-white"
                      )}
                    >
                      Reserve
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ADD TABLE MODAL */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Restaurant Table"
        description="Add a new dining table to the floor plan"
        maxWidth="sm"
      >
        <form onSubmit={handleAddTable} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-zinc-300">Table Name *</label>
            <Input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              placeholder="e.g. Table 11"
              required
              className="bg-zinc-900"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-zinc-300">Seating Capacity</label>
            <Input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="4"
              required
              className="bg-zinc-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="fire">
              Add Table
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

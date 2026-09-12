"use client";

import * as React from "react";
import {
  UtensilsCrossed,
  Plus,
  Edit2,
  Check,
  X,
  Layers,
  Search,
  DollarSign,
  Barcode,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  ListPlus,
  GripVertical,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { useAsyncLoad } from "@/lib/hooks/useAsyncLoad";

/**
 * A modifier group as the editor holds it.
 *
 * `id` is present for groups already in the database and absent for ones the user has
 * just added; the server uses that to update in place rather than recreate, so options
 * that past orders point at keep their identity.
 */
interface EditableOption {
  id?: string;
  name: string;
  price: string;
  isAvailable: boolean;
}

interface EditableGroup {
  id?: string;
  key: string;
  name: string;
  isRequired: boolean;
  minSelection: number;
  maxSelection: number;
  modifiers: EditableOption[];
}

let groupKeySeed = 0;
const nextGroupKey = () => `grp-${(groupKeySeed += 1)}`;

function blankOption(): EditableOption {
  return { name: "", price: "0", isAvailable: true };
}

function blankGroup(): EditableGroup {
  return {
    key: nextGroupKey(),
    name: "",
    isRequired: true,
    minSelection: 1,
    maxSelection: 1,
    modifiers: [blankOption(), blankOption()],
  };
}

export default function MenuPage() {
  const [categories, setCategories] = React.useState<any[]>([]);
  const [products, setProducts] = React.useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  // Modals
  const [showProductModal, setShowProductModal] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<any | null>(null);

  const [showCategoryModal, setShowCategoryModal] = React.useState(false);
  const [categoryName, setCategoryName] = React.useState("");

  // Product form state
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [barcode, setBarcode] = React.useState("");
  const [isAvailable, setIsAvailable] = React.useState(true);
  const [isActive, setIsActive] = React.useState(true);
  const [groups, setGroups] = React.useState<EditableGroup[]>([]);
  const [saving, setSaving] = React.useState(false);

  const fetchMenu = React.useCallback(async () => {
    try {
      setLoading(true);
      const [catRes, prodRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/products?all=true"),
      ]);
      if (catRes.ok) setCategories(await catRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useAsyncLoad(fetchMenu);

  const openAddProduct = () => {
    setEditingProduct(null);
    setName("");
    setDescription("");
    setPrice("");
    setCategoryId(categories[0]?.id || "");
    setSku(`BRG-${Math.floor(100 + Math.random() * 900)}`);
    setBarcode(`8964000${Math.floor(1000 + Math.random() * 9000)}`);
    setIsAvailable(true);
    setIsActive(true);
    setGroups([]);
    setShowProductModal(true);
  };

  const openEditProduct = (prod: any) => {
    setEditingProduct(prod);
    setName(prod.name);
    setDescription(prod.description || "");
    setPrice(prod.price.toString());
    setCategoryId(prod.categoryId);
    setSku(prod.sku || "");
    setBarcode(prod.barcode || "");
    setIsAvailable(prod.isAvailable);
    setIsActive(prod.isActive);
    setGroups(
      (prod.modifierGroups || []).map((g: any) => ({
        id: g.id,
        key: nextGroupKey(),
        name: g.name,
        isRequired: !!g.isRequired,
        minSelection: g.minSelection ?? 0,
        maxSelection: g.maxSelection ?? 1,
        modifiers: (g.modifiers || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          price: String(Number(m.price ?? 0)),
          isAvailable: m.isAvailable !== false,
        })),
      }))
    );
    setShowProductModal(true);
  };

  // ---- Option group editing -------------------------------------------------

  const updateGroup = (key: string, patch: Partial<EditableGroup>) =>
    setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, ...patch } : g)));

  const updateOption = (key: string, index: number, patch: Partial<EditableOption>) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.key === key
          ? {
              ...g,
              modifiers: g.modifiers.map((m, i) => (i === index ? { ...m, ...patch } : m)),
            }
          : g
      )
    );

  const addOption = (key: string) =>
    setGroups((prev) =>
      prev.map((g) => (g.key === key ? { ...g, modifiers: [...g.modifiers, blankOption()] } : g))
    );

  const removeOption = (key: string, index: number) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.key === key ? { ...g, modifiers: g.modifiers.filter((_, i) => i !== index) } : g
      )
    );

  const removeGroup = (key: string) => setGroups((prev) => prev.filter((g) => g.key !== key));

  const handleDeleteProduct = async (prod: any) => {
    if (
      !confirm(
        `Remove "${prod.name}" from the menu?\n\nIf it has been sold before it is withdrawn rather than deleted, so past orders keep their record of it.`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/products?id=${encodeURIComponent(prod.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove product");
      if (data.message) alert(data.message);
      fetchMenu();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error removing product");
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price || !categoryId) {
      alert("Please fill all required fields");
      return;
    }

    // Catch the obvious mistakes here so the cashier gets an answer without a
    // round trip; the server validates the same rules again before writing.
    for (const group of groups) {
      if (!group.name.trim()) {
        alert("Every option group needs a name, such as \"Select Pizza Flavour\".");
        return;
      }
      const filled = group.modifiers.filter((m) => m.name.trim());
      if (filled.length === 0) {
        alert(`"${group.name}" needs at least one option.`);
        return;
      }
      if (group.maxSelection < group.minSelection) {
        alert(`"${group.name}" cannot allow fewer choices than it requires.`);
        return;
      }
      if (group.minSelection > filled.length) {
        alert(`"${group.name}" requires more choices than it offers.`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        price: parseFloat(price),
        categoryId,
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        isAvailable,
        isActive,
        modifierGroups: groups.map((g) => ({
          id: g.id,
          name: g.name.trim(),
          isRequired: g.isRequired,
          minSelection: g.minSelection,
          maxSelection: g.maxSelection,
          modifiers: g.modifiers
            .filter((m) => m.name.trim())
            .map((m) => ({
              id: m.id,
              name: m.name.trim(),
              price: parseFloat(m.price) || 0,
              isAvailable: m.isAvailable,
            })),
        })),
      };

      const url = "/api/products";
      const method = editingProduct ? "PUT" : "POST";
      const body = editingProduct ? { ...payload, id: editingProduct.id } : payload;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save product");
      }

      setShowProductModal(false);
      fetchMenu();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error saving product");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName.trim() }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to create category");
      }

      setCategoryName("");
      setShowCategoryModal(false);
      fetchMenu();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error creating category");
    }
  };

  const toggleProductAvailability = async (prod: any) => {
    try {
      await fetch("/api/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prod.id, isAvailable: !prod.isAvailable }),
      });
      fetchMenu();
    } catch {}
  };

  const filtered = products.filter((p) => {
    const matchesCat = selectedCategory === "all" || p.categoryId === selectedCategory;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full w-full bg-[#0c0d10] text-zinc-100 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-zinc-800 bg-[#121319] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-wider text-white">
              MENU MANAGEMENT
            </h1>
            <p className="text-[11px] text-zinc-400">
              Manage categories, products, prices, and availability
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <Input
              type="text"
              placeholder="Search product, SKU, barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-zinc-900 border-zinc-700"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCategoryModal(true)}
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Category
          </Button>

          <Button
            variant="fire"
            size="sm"
            onClick={openAddProduct}
            className="text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800/80 bg-[#15161f] overflow-x-auto text-xs shrink-0">
        <button
          onClick={() => setSelectedCategory("all")}
          className={cn(
            "px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0",
            selectedCategory === "all"
              ? "bg-orange-600 text-white"
              : "bg-zinc-800 text-zinc-400 hover:text-white"
          )}
        >
          All Items ({products.length})
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedCategory(c.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0",
              selectedCategory === c.id
                ? "bg-orange-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Products Catalog Table */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-zinc-500 text-xs">
            <span className="h-5 w-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mr-2" />
            Loading menu...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col h-full items-center justify-center text-zinc-500 text-xs">
            <UtensilsCrossed className="h-10 w-10 text-zinc-700 mb-2" />
            <span>No items found</span>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-[#13141b] overflow-hidden">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-[#181922] text-zinc-400 font-bold border-b border-zinc-800 uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Product Name</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Price</th>
                  <th className="p-3.5">SKU / Barcode</th>
                  <th className="p-3.5">Modifiers</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((prod) => (
                  <tr key={prod.id} className="hover:bg-zinc-800/40">
                    <td className="p-3.5">
                      <div className="font-bold text-white text-sm">
                        {prod.name}
                      </div>
                      {prod.description && (
                        <div className="text-[11px] text-zinc-400 truncate max-w-sm">
                          {prod.description}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium">
                        {prod.category?.name || "Uncategorized"}
                      </span>
                    </td>
                    <td className="p-3.5 font-black text-sm text-orange-400">
                      {formatCurrency(prod.price)}
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-zinc-400">
                      <div>SKU: {prod.sku || "—"}</div>
                      <div>Bar: {prod.barcode || "—"}</div>
                    </td>
                    <td className="p-3.5">
                      {prod.modifierGroups?.length > 0 ? (
                        <div className="space-y-0.5">
                          {prod.modifierGroups.slice(0, 3).map((g: any) => (
                            <div
                              key={g.id}
                              className="text-[10px] text-zinc-400 whitespace-nowrap"
                              title={(g.modifiers || []).map((m: any) => m.name).join(", ")}
                            >
                              <span
                                className={cn(
                                  "font-semibold",
                                  g.isRequired ? "text-orange-400" : "text-zinc-300"
                                )}
                              >
                                {g.name}
                              </span>{" "}
                              <span className="text-zinc-600">
                                ({g.modifiers?.length || 0}
                                {g.isRequired ? ", required" : ""})
                              </span>
                            </div>
                          ))}
                          {prod.modifierGroups.length > 3 && (
                            <div className="text-[10px] text-zinc-600">
                              +{prod.modifierGroups.length - 3} more
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <button
                        onClick={() => toggleProductAvailability(prod)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors",
                          prod.isAvailable
                            ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-400 hover:bg-emerald-950/50"
                            : "bg-red-950/30 border-red-500/30 text-red-400 hover:bg-red-950/50"
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {prod.isAvailable ? "Available" : "Sold Out"}
                      </button>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditProduct(prod)}
                          className="text-xs"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteProduct(prod)}
                          className="text-xs text-red-400 border-red-500/30 hover:bg-red-950/40"
                          title="Remove from menu"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PRODUCT MODAL (ADD / EDIT) */}
      <Modal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        title={editingProduct ? "Edit Product" : "Add Menu Product"}
        description="Configure product details, price, SKU, and availability"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-zinc-300">Product Name *</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Fire Burger"
                required
                className="bg-zinc-900"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-zinc-300">Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-zinc-300">Description</label>
            <Input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of ingredients/flavor"
              className="bg-zinc-900"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-zinc-300">Price (Rs.) *</label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="e.g. 550"
                required
                className="bg-zinc-900 font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-zinc-300">SKU</label>
              <Input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="BRG-001"
                className="bg-zinc-900 font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-zinc-300">Barcode</label>
              <Input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Barcode number"
                className="bg-zinc-900 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-2 border-t border-zinc-800">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="rounded bg-zinc-900 border-zinc-700 text-orange-500 focus:ring-orange-500 h-4 w-4"
              />
              <span className="font-semibold text-zinc-200">Available for Ordering</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded bg-zinc-900 border-zinc-700 text-orange-500 focus:ring-orange-500 h-4 w-4"
              />
              <span className="font-semibold text-zinc-200">Active in Menu</span>
            </label>
          </div>

          {/* OPTION GROUPS - this is what turns a product into a deal */}
          <div className="space-y-3 pt-3 border-t border-zinc-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="font-bold text-zinc-100 text-[13px] flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-orange-400" />
                  Options &amp; Choices
                </h4>
                <p className="text-[11px] text-zinc-500 mt-0.5 max-w-md">
                  Add a group for each choice the cashier makes when ringing this up - for a
                  deal, that is &quot;pick a pizza flavour&quot;, &quot;pick a drink&quot;. Leave
                  empty for a plain item or a fixed bundle.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setGroups((prev) => [...prev, blankGroup()])}
                className="shrink-0 text-xs"
              >
                <ListPlus className="h-3.5 w-3.5 mr-1" />
                Add Group
              </Button>
            </div>

            {groups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 px-4 py-5 text-center text-[11px] text-zinc-500">
                No choices - this item is added to the cart in one tap.
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map((group, groupIndex) => (
                  <div
                    key={group.key}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-3"
                  >
                    {/* Group header */}
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-3.5 w-3.5 text-zinc-700 shrink-0" />
                      <Input
                        type="text"
                        value={group.name}
                        onChange={(e) => updateGroup(group.key, { name: e.target.value })}
                        placeholder={`Group ${groupIndex + 1} name, e.g. Select Pizza Flavour`}
                        className="bg-zinc-950 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeGroup(group.key)}
                        className="shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                        title="Remove this group"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Group rules */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] pl-5">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={group.isRequired}
                          onChange={(e) =>
                            updateGroup(group.key, {
                              isRequired: e.target.checked,
                              minSelection: e.target.checked
                                ? Math.max(1, group.minSelection)
                                : group.minSelection,
                            })
                          }
                          className="rounded bg-zinc-950 border-zinc-700 text-orange-500 focus:ring-orange-500 h-3.5 w-3.5"
                        />
                        <span className="font-semibold text-zinc-300">Must choose</span>
                      </label>

                      <label className="flex items-center gap-1.5">
                        <span className="text-zinc-400">Min</span>
                        <input
                          type="number"
                          min={group.isRequired ? 1 : 0}
                          max={50}
                          value={group.minSelection}
                          onChange={(e) =>
                            updateGroup(group.key, {
                              minSelection: Math.max(0, parseInt(e.target.value, 10) || 0),
                            })
                          }
                          className="w-14 h-7 px-2 rounded-md bg-zinc-950 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </label>

                      <label className="flex items-center gap-1.5">
                        <span className="text-zinc-400">Max</span>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={group.maxSelection}
                          onChange={(e) =>
                            updateGroup(group.key, {
                              maxSelection: Math.max(1, parseInt(e.target.value, 10) || 1),
                            })
                          }
                          className="w-14 h-7 px-2 rounded-md bg-zinc-950 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </label>

                      <span className="text-zinc-600">
                        {group.isRequired
                          ? group.maxSelection === 1
                            ? "Cashier picks exactly one"
                            : `Cashier picks ${group.minSelection}-${group.maxSelection}`
                          : `Optional, up to ${group.maxSelection}`}
                      </span>
                    </div>

                    {/* Options */}
                    <div className="space-y-1.5 pl-5">
                      <div className="grid grid-cols-[1fr_110px_auto_auto] gap-2 text-[10px] uppercase font-bold text-zinc-500 px-1">
                        <span>Option</span>
                        <span>Extra charge</span>
                        <span className="text-center">In stock</span>
                        <span />
                      </div>

                      {group.modifiers.map((option, optionIndex) => (
                        <div
                          key={option.id || `${group.key}-${optionIndex}`}
                          className="grid grid-cols-[1fr_110px_auto_auto] gap-2 items-center"
                        >
                          <Input
                            type="text"
                            value={option.name}
                            onChange={(e) =>
                              updateOption(group.key, optionIndex, { name: e.target.value })
                            }
                            placeholder="e.g. Chicken Tikka"
                            className="bg-zinc-950 h-8"
                          />
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={option.price}
                            onChange={(e) =>
                              updateOption(group.key, optionIndex, { price: e.target.value })
                            }
                            className="bg-zinc-950 h-8"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateOption(group.key, optionIndex, {
                                isAvailable: !option.isAvailable,
                              })
                            }
                            className="justify-self-center p-1"
                            title={option.isAvailable ? "In stock" : "Sold out"}
                          >
                            {option.isAvailable ? (
                              <ToggleRight className="h-5 w-5 text-emerald-400" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-zinc-600" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeOption(group.key, optionIndex)}
                            disabled={group.modifiers.length <= 1}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-950/40 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500 transition-colors"
                            title="Remove this option"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => addOption(group.key)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-orange-400 hover:text-orange-300 pt-1"
                      >
                        <Plus className="h-3 w-3" />
                        Add option
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-zinc-500 leading-relaxed">
              <Sparkles className="h-3 w-3 inline-block text-orange-400 mr-1 -mt-0.5" />
              To build a deal: put it in the <strong className="text-zinc-300">Special
              Deals</strong> category, set the deal price above, then add one required group per
              choice. Extra charges here are added on top of the deal price.
            </p>
          </div>

          {/* Pinned to the bottom of the scroll area: a deal with several option
              groups is taller than the screen, and Save must stay reachable. */}
          <div className="sticky bottom-0 -mx-6 -mb-5 flex justify-end gap-2 border-t border-zinc-800 bg-zinc-900 px-6 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowProductModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="fire" disabled={saving}>
              {saving ? "Saving..." : "Save Product"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CATEGORY MODAL */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="Add Menu Category"
        description="Create a new food or beverage category"
        maxWidth="sm"
      >
        <form onSubmit={handleSaveCategory} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-semibold text-zinc-300">Category Name</label>
            <Input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g. Beverages, Sauces"
              required
              autoFocus
              className="bg-zinc-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCategoryModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="fire">
              Create Category
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

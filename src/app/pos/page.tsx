"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Tag,
  CreditCard,
  Banknote,
  Building2,
  Layers,
  UtensilsCrossed,
  Flame,
  Send,
  User,
  MapPin,
  Phone,
  Percent,
  CheckCircle2,
  X,
  Printer,
  Sparkles,
  ChevronRight,
  Receipt,
  RotateCcw,
  ChefHat,
  Bike,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ReceiptModal } from "@/components/receipt/ReceiptModal";
import { KitchenTicketModal } from "@/components/receipt/KitchenTicketModal";
import { useAsyncLoad } from "@/lib/hooks/useAsyncLoad";

interface Modifier {
  id: string;
  name: string;
  price: number | string;
}

interface ModifierGroup {
  id: string;
  name: string;
  minSelection: number;
  maxSelection: number;
  isRequired: boolean;
  modifiers: Modifier[];
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  categoryId: string;
  sku: string | null;
  barcode: string | null;
  isAvailable: boolean;
  category?: { id: string; name: string; slug: string };
  modifierGroups?: ModifierGroup[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  _count?: { products: number };
}

interface CartItemModifier {
  id?: string;
  name: string;
  price: number;
}

interface CartItem {
  cartId: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: CartItemModifier[];
  notes: string;
  itemTotal: number;
}

export default function PosPage() {
  // Master state
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [tables, setTables] = React.useState<any[]>([]);
  const [staffList, setStaffList] = React.useState<any[]>([]);
  const [riderList, setRiderList] = React.useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  // Cart state
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [orderType, setOrderType] = React.useState<"DINE_IN" | "TAKEAWAY" | "PICKUP" | "DELIVERY">("DINE_IN");
  const [selectedTableId, setSelectedTableId] = React.useState<string>("");
  const [selectedWaiterId, setSelectedWaiterId] = React.useState<string>("");
  const [selectedRiderId, setSelectedRiderId] = React.useState<string>("");
  const [waiterError, setWaiterError] = React.useState(false);
  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [deliveryAddress, setDeliveryAddress] = React.useState("");
  const [deliveryCharge, setDeliveryCharge] = React.useState<number>(0);
  const [discountAmount, setDiscountAmount] = React.useState<number>(0);
  const [discountReason, setDiscountReason] = React.useState("");
  const [orderNotes, setOrderNotes] = React.useState("");
  const [taxRate, setTaxRate] = React.useState<number>(5); // 5% GST

  // Modifier dialog state
  const [activeProductForModifier, setActiveProductForModifier] = React.useState<Product | null>(null);
  const [selectedModifiers, setSelectedModifiers] = React.useState<Record<string, Modifier[]>>({});
  const [modifierNote, setModifierNote] = React.useState("");

  // Payment dialog state
  const [showPaymentModal, setShowPaymentModal] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<"CASH" | "CARD" | "BANK_TRANSFER" | "OTHER">("CASH");
  const [cashTendered, setCashTendered] = React.useState<string>("");
  const [paymentSubmitting, setPaymentSubmitting] = React.useState(false);

  // KOT & Receipt dialog state
  const [lastCompletedOrder, setLastCompletedOrder] = React.useState<any | null>(null);
  const [showKitchenTicketModal, setShowKitchenTicketModal] = React.useState(false);
  const [showReceiptModal, setShowReceiptModal] = React.useState(false);
  const [submittingOrder, setSubmittingOrder] = React.useState(false);

  // Load initial data
  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [catRes, prodRes, tableRes, setRes, staffRes, riderRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/products"),
        fetch("/api/tables"),
        fetch("/api/settings"),
        fetch("/api/staff"),
        fetch("/api/riders"),
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
      if (tableRes.ok) {
        const tList = await tableRes.json();
        setTables(tList);
        if (tList.length > 0 && !selectedTableId) {
          const firstAvailable = tList.find((t: any) => t.status === "AVAILABLE") || tList[0];
          setSelectedTableId(firstAvailable.id);
        }
      }
      if (setRes.ok) {
        const settings = await setRes.json();
        if (settings?.taxRate !== undefined) setTaxRate(Number(settings.taxRate));
      }
      if (staffRes.ok) {
        const sList = await staffRes.json();
        setStaffList(sList);
      }
      if (riderRes.ok) {
        const rList = await riderRes.json();
        setRiderList(rList);
      }
    } catch (err) {
      console.error("Failed to load POS data", err);
    } finally {
      setLoading(false);
    }
  }, [selectedTableId]);

  useAsyncLoad(fetchData);

  // Barcode / SKU quick-scan search handler
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // Check exact SKU or barcode match
    const match = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase() === searchQuery.toLowerCase())
    );

    if (match) {
      handleProductClick(match);
      setSearchQuery("");
    }
  };

  // Filtered products.
  //
  // Left unmemoized on purpose: the React Compiler (enabled in next.config.mjs) caches
  // this for us, and a hand-written useMemo here defeats it rather than helping.
  const filteredProducts = products.filter((p) => {
    if (!p.isAvailable) return false;

    const matchesCategory =
      selectedCategory === "all" ||
      p.categoryId === selectedCategory ||
      p.category?.slug === selectedCategory;

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      Boolean(p.sku && p.sku.toLowerCase().includes(q)) ||
      Boolean(p.barcode && p.barcode.toLowerCase().includes(q));

    return matchesCategory && matchesSearch;
  });

  // Add Product to Cart
  const handleProductClick = (product: Product) => {
    // If product has modifiers, open modifier modal
    if (product.modifierGroups && product.modifierGroups.length > 0) {
      setActiveProductForModifier(product);
      setSelectedModifiers({});
      setModifierNote("");
      return;
    }

    // Direct 1-click addition to cart
    addItemToCart(product, [], "");
  };

  const addItemToCart = (
    product: Product,
    modifiers: CartItemModifier[],
    notes: string
  ) => {
    const basePrice = Number(product.price);
    const modTotal = modifiers.reduce((s, m) => s + m.price, 0);
    const singleItemPrice = basePrice + modTotal;

    const modifierKey = modifiers
      .map((m) => m.name)
      .sort()
      .join("|");
    const cartId = `${product.id}-${modifierKey}-${notes}`;

    setCart((prev) => {
      const existing = prev.find((item) => item.cartId === cartId);
      if (existing) {
        return prev.map((item) =>
          item.cartId === cartId
            ? {
                ...item,
                quantity: item.quantity + 1,
                itemTotal: (item.quantity + 1) * singleItemPrice,
              }
            : item
        );
      } else {
        return [
          ...prev,
          {
            cartId,
            productId: product.id,
            name: product.name,
            price: singleItemPrice,
            quantity: 1,
            modifiers,
            notes,
            itemTotal: singleItemPrice,
          },
        ];
      }
    });
  };

  // Confirm Modifiers
  /**
   * Which option groups are not yet satisfied.
   *
   * The server refuses an order that skips a required group, so the cashier is told
   * here - at the moment of choosing - rather than at the payment screen.
   */
  const modifierIssues = React.useMemo(() => {
    if (!activeProductForModifier?.modifierGroups) return [] as string[];

    const issues: string[] = [];
    for (const group of activeProductForModifier.modifierGroups) {
      const chosen = (selectedModifiers[group.id] || []).length;
      const required = group.isRequired ? Math.max(1, group.minSelection) : group.minSelection;

      if (chosen < required) {
        issues.push(
          required === 1
            ? `Choose an option from "${group.name}"`
            : `Choose at least ${required} from "${group.name}"`
        );
      } else if (group.maxSelection > 0 && chosen > group.maxSelection) {
        issues.push(`"${group.name}" allows at most ${group.maxSelection}`);
      }
    }
    return issues;
  }, [activeProductForModifier, selectedModifiers]);

  const handleConfirmModifiers = () => {
    if (!activeProductForModifier) return;
    if (modifierIssues.length > 0) return;

    const allSelected: CartItemModifier[] = [];
    Object.values(selectedModifiers).forEach((mods) => {
      mods.forEach((m) => {
        allSelected.push({
          id: m.id,
          name: m.name,
          price: Number(m.price),
        });
      });
    });

    addItemToCart(activeProductForModifier, allSelected, modifierNote);
    setActiveProductForModifier(null);
  };

  // Cart Adjustments
  const updateQuantity = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartId === cartId) {
            const newQty = item.quantity + delta;
            return newQty > 0
              ? { ...item, quantity: newQty, itemTotal: newQty * item.price }
              : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeItem = (cartId: string) => {
    setCart((prev) => prev.filter((item) => item.cartId !== cartId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setDiscountReason("");
    setOrderNotes("");
    setSelectedWaiterId("");
    setSelectedRiderId("");
    setDeliveryCharge(0);
    setWaiterError(false);
  };

  // Calculations
  const subtotal = React.useMemo(() => {
    return cart.reduce((sum, item) => sum + item.itemTotal, 0);
  }, [cart]);

  const taxAmount = React.useMemo(() => {
    if (taxRate <= 0) return 0;
    return Math.round((subtotal * taxRate) / 100);
  }, [subtotal, taxRate]);

  const deliveryFee = orderType === "DELIVERY" ? deliveryCharge : 0;

  const grandTotal = React.useMemo(() => {
    const total = subtotal - discountAmount + taxAmount + deliveryFee;
    return Math.max(0, total);
  }, [subtotal, discountAmount, taxAmount, deliveryFee]);

  // Quick cash options
  const cashAmountNum = parseFloat(cashTendered) || 0;
  const changeReturned = Math.max(0, cashAmountNum - grandTotal);

  // Checkout API Submission: Send to Kitchen and print KOT
  const handleSendToKitchen = async () => {
    if (cart.length === 0) return;

    // Validate waiter for Dine In orders
    if (orderType === "DINE_IN" && !selectedWaiterId) {
      setWaiterError(true);
      alert("Please select the Waiter serving this table before sending order to kitchen!");
      return;
    }

    setSubmittingOrder(true);
    try {
      const orderPayload = {
        orderType,
        tableId: orderType === "DINE_IN" ? selectedTableId : null,
        // Identifiers only: the server looks up the staff member and snapshots the
        // name onto the order, so a renamed or removed waiter cannot rewrite history.
        waiterId: orderType === "DINE_IN" ? selectedWaiterId || null : null,
        riderId: orderType === "DELIVERY" ? selectedRiderId || null : null,
        customer:
          customerPhone || customerName
            ? {
                name: customerName,
                phone: customerPhone,
                address: deliveryAddress,
              }
            : null,
        items: cart.map((item) => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          itemTotal: item.itemTotal,
          modifiers: item.modifiers,
          notes: item.notes,
        })),
        // The server recomputes every figure from the catalogue and the configured
        // tax rate. These are sent so it can flag a disagreement, not to be trusted.
        subtotal,
        discountAmount,
        discountReason,
        taxAmount,
        deliveryCharge: deliveryFee,
        grandTotal,
        orderNotes,
        payment: null, // Unpaid - customer pays later from Orders!
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process order");
      }

      // The order comes back with waiterName/riderName already set by the server.
      setLastCompletedOrder(data.order);
      setShowKitchenTicketModal(true);
      clearCart();
      fetchData(); // Refresh tables and state
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error sending order to kitchen");
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Immediate counter payment handler (optional)
  const handleCompleteOrder = async () => {
    if (cart.length === 0) return;

    // Validate waiter for Dine In orders
    if (orderType === "DINE_IN" && !selectedWaiterId) {
      setWaiterError(true);
      alert("Please select the Waiter serving this table before completing order!");
      return;
    }

    setPaymentSubmitting(true);
    try {
      const orderPayload = {
        orderType,
        tableId: orderType === "DINE_IN" ? selectedTableId : null,
        // Identifiers only: the server looks up the staff member and snapshots the
        // name onto the order, so a renamed or removed waiter cannot rewrite history.
        waiterId: orderType === "DINE_IN" ? selectedWaiterId || null : null,
        riderId: orderType === "DELIVERY" ? selectedRiderId || null : null,
        customer:
          customerPhone || customerName
            ? {
                name: customerName,
                phone: customerPhone,
                address: deliveryAddress,
              }
            : null,
        items: cart.map((item) => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          itemTotal: item.itemTotal,
          modifiers: item.modifiers,
          notes: item.notes,
        })),
        // The server recomputes every figure from the catalogue and the configured
        // tax rate. These are sent so it can flag a disagreement, not to be trusted.
        subtotal,
        discountAmount,
        discountReason,
        taxAmount,
        deliveryCharge: deliveryFee,
        grandTotal,
        orderNotes,
        payment: {
          method: paymentMethod,
          amountReceived:
            paymentMethod === "CASH" ? cashAmountNum || grandTotal : grandTotal,
          changeGiven: paymentMethod === "CASH" ? changeReturned : 0,
        },
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process order");
      }

      // The order comes back with waiterName/riderName already set by the server.
      setLastCompletedOrder(data.order);
      setShowPaymentModal(false);
      setShowReceiptModal(true);
      clearCart();
      fetchData(); // Refresh tables and state
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error completing order");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  /*
   * Global shortcut events (F3 = new order, F5 = send to kitchen), dispatched by the
   * app shell.
   *
   * The handlers are read through a ref that is refreshed after every commit, so the
   * window listeners are attached once yet always see the current cart - rather than
   * being torn down and re-attached on each keystroke, which a `[cart]` dependency
   * would do.
   */
  const shortcutHandlers = React.useRef({ clearCart, handleSendToKitchen, cartSize: 0 });

  React.useEffect(() => {
    shortcutHandlers.current = { clearCart, handleSendToKitchen, cartSize: cart.length };
  });

  React.useEffect(() => {
    const handleNewOrder = () => shortcutHandlers.current.clearCart();
    const handleOpenPayment = () => {
      if (shortcutHandlers.current.cartSize > 0) {
        void shortcutHandlers.current.handleSendToKitchen();
      }
    };

    window.addEventListener("pos-new-order", handleNewOrder);
    window.addEventListener("pos-open-payment", handleOpenPayment);
    return () => {
      window.removeEventListener("pos-new-order", handleNewOrder);
      window.removeEventListener("pos-open-payment", handleOpenPayment);
    };
  }, []);


  return (
    <div className="flex h-full w-full overflow-hidden bg-[#0c0d10]">
      {/* 1. LEFT COLUMN: CATEGORIES (200px) */}
      <div className="w-52 shrink-0 border-r border-zinc-800/80 bg-[#111217] flex flex-col overflow-hidden">
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Categories
          </span>
          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
            {categories.length}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {/* ALL CATEGORY */}
          <button
            onClick={() => setSelectedCategory("all")}
            className={cn(
              "w-full flex items-center justify-between p-3 rounded-xl text-left font-semibold text-xs transition-all border",
              selectedCategory === "all"
                ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white border-orange-500 shadow-md shadow-orange-600/20"
                : "bg-zinc-900/60 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-white"
            )}
          >
            <div className="flex items-center gap-2.5">
              <Layers className="h-4 w-4" />
              <span>All Products</span>
            </div>
            <span className="text-[10px] opacity-80 font-mono">
              {products.length}
            </span>
          </button>

          {/* INDIVIDUAL CATEGORIES */}
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.slug || selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.slug)}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-xl text-left font-semibold text-xs transition-all border",
                  isSelected
                    ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white border-orange-500 shadow-md shadow-orange-600/20"
                    : "bg-zinc-900/60 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-white"
                )}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Flame className="h-4 w-4 shrink-0 text-orange-400" />
                  <span className="truncate">{cat.name}</span>
                </div>
                {cat._count?.products !== undefined && (
                  <span className="text-[10px] opacity-75 font-mono">
                    {cat._count.products}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. CENTER COLUMN: SEARCH & PRODUCTS GRID (FLEX-1) */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0e0f14] border-r border-zinc-800/80">
        {/* Top Search Bar with Barcode Scanner input */}
        <div className="p-3 border-b border-zinc-800/80 bg-[#13141a] flex items-center gap-3">
          <form onSubmit={handleBarcodeSubmit} className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              id="pos-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search food item, SKU, or scan barcode (F2)..."
              className="pl-10 h-10 bg-zinc-900 border-zinc-700 text-sm focus-visible:ring-orange-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          <span className="text-xs text-zinc-400 font-medium px-2 py-1 bg-zinc-900 rounded-lg border border-zinc-800">
            {filteredProducts.length} items
          </span>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center text-zinc-500 text-sm">
              <span className="h-5 w-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mr-2" />
              Loading Fork & Fire catalog...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col h-full items-center justify-center text-zinc-500 text-sm">
              <UtensilsCrossed className="h-10 w-10 text-zinc-700 mb-2" />
              <span>No products found matching your search.</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map((product) => {
                const hasMods =
                  product.modifierGroups && product.modifierGroups.length > 0;
                return (
                  <motion.button
                    key={product.id}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleProductClick(product)}
                    className="relative flex flex-col justify-between p-3.5 rounded-2xl border border-zinc-800/90 bg-[#16171e] hover:border-orange-500/50 hover:bg-[#1a1c24] text-left transition-all group shadow-sm"
                  >
                    {/* Top row: Name & optional badge */}
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-sm text-zinc-100 group-hover:text-orange-400 transition-colors line-clamp-1">
                          {product.name}
                        </h4>
                        {hasMods && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-950/60 text-orange-400 border border-orange-500/30 shrink-0">
                            Custom
                          </span>
                        )}
                      </div>

                      {product.description && (
                        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-tight">
                          {product.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom row: Price & Fast Add indicator */}
                    <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between">
                      <span className="text-sm font-black text-orange-400">
                        {formatCurrency(product.price)}
                      </span>
                      <div className="h-7 w-7 rounded-lg bg-zinc-800 group-hover:bg-orange-600 text-zinc-300 group-hover:text-white flex items-center justify-center transition-colors">
                        <Plus className="h-4 w-4" />
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. RIGHT COLUMN: ORDER CART & CHECKOUT (380px) */}
      <div className="w-96 shrink-0 flex flex-col bg-[#121319] border-l border-zinc-800/80 h-full overflow-hidden">
        {/* Cart Header with Order Type Selector */}
        <div className="p-3 border-b border-zinc-800/80 bg-[#15161d] space-y-2">
          {/* Order Type Toggle (Dine In, Takeaway, Delivery) */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-900 rounded-xl border border-zinc-800 text-xs font-semibold">
            {(["DINE_IN", "TAKEAWAY", "DELIVERY"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setOrderType(type)}
                className={cn(
                  "py-1.5 px-1 rounded-lg text-center transition-colors truncate",
                  orderType === type
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                {type === "DINE_IN"
                  ? "Dine In"
                  : type === "TAKEAWAY"
                  ? "Takeaway"
                  : "Delivery"}
              </button>
            ))}
          </div>

          {/* Conditional Controls for Dine-In (Table Picker) or Delivery (Customer details) */}
          {orderType === "DINE_IN" ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1">
                  <UtensilsCrossed className="h-3.5 w-3.5 text-orange-400" />
                  Select Table:
                </span>
                <select
                  value={selectedTableId}
                  onChange={(e) => setSelectedTableId(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.status})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400 flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-orange-400" />
                  Waiter: <span className="text-red-400 font-bold">*</span>
                </span>
                <select
                  value={selectedWaiterId}
                  onChange={(e) => {
                    setSelectedWaiterId(e.target.value);
                    if (e.target.value) setWaiterError(false);
                  }}
                  className={cn(
                    "bg-zinc-900 border text-zinc-200 rounded-lg px-2.5 py-1 text-xs font-bold focus:outline-none transition-all",
                    waiterError
                      ? "border-red-500 ring-2 ring-red-500/50 text-red-300"
                      : "border-zinc-700 focus:ring-1 focus:ring-orange-500"
                  )}
                >
                  <option value="">-- Select Waiter --</option>
                  {staffList
                    .filter((s: any) => s.name?.toLowerCase() !== "admin" && s.username?.toLowerCase() !== "admin")
                    .map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          ) : orderType === "DELIVERY" ? (
            <div className="space-y-1.5 pt-1 text-xs">
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  type="text"
                  placeholder="Customer Phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="h-8 text-xs bg-zinc-900"
                />
                <Input
                  type="text"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-8 text-xs bg-zinc-900"
                />
              </div>
              <Input
                type="text"
                placeholder="Delivery Address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                className="h-8 text-xs bg-zinc-900"
              />
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-400 shrink-0">
                  <Bike className="h-3.5 w-3.5" />
                  <span>Rider:</span>
                </div>
                <select
                  value={selectedRiderId}
                  onChange={(e) => setSelectedRiderId(e.target.value)}
                  className="w-full h-8 px-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="">-- Assign Rider (Optional) --</option>
                  {riderList
                    .filter((r) => r.isActive !== false)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} {r.vehicleNo ? `(${r.vehicleNo})` : ""}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-1">
              <Input
                type="text"
                placeholder="Customer Name/Phone (optional)"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="h-8 text-xs bg-zinc-900 flex-1"
              />
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col h-full items-center justify-center text-zinc-500 text-xs">
              <ShoppingCart className="h-10 w-10 text-zinc-700 mb-2" />
              <span>Cart is empty</span>
              <span className="text-[11px] text-zinc-600 mt-0.5">
                Click any product to add
              </span>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.cartId}
                className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/90 space-y-1.5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-2">
                    <span className="font-bold text-xs text-white">
                      {item.name}
                    </span>
                    <div className="text-[11px] font-semibold text-orange-400">
                      {formatCurrency(item.price)}
                    </div>
                  </div>
                  <span className="font-black text-xs text-white">
                    {formatCurrency(item.itemTotal)}
                  </span>
                </div>

                {/* Modifiers Badges */}
                {item.modifiers.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.modifiers.map((m, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-orange-300 font-mono"
                      >
                        +{m.name} {m.price > 0 && `(Rs. ${m.price})`}
                      </span>
                    ))}
                  </div>
                )}

                {item.notes && (
                  <div className="text-[10px] text-zinc-400 italic">
                    Note: {item.notes}
                  </div>
                )}

                {/* Quantity Controls & Delete */}
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80">
                  <button
                    onClick={() => removeItem(item.cartId)}
                    className="text-zinc-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.cartId, -1)}
                      className="h-6 w-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-xs font-bold text-white px-1">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.cartId, 1)}
                      className="h-6 w-6 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-white"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Order Summary & Financials */}
        <div className="p-3 border-t border-zinc-800/80 bg-[#15161d] space-y-2">
          {/* Discount & Order Note Triggers */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => {
                const amt = prompt("Enter Discount Amount (Rs.):", discountAmount.toString());
                if (amt !== null) {
                  setDiscountAmount(parseFloat(amt) || 0);
                  const reason = prompt("Discount Reason:", "Special Offer");
                  setDiscountReason(reason || "");
                }
              }}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-orange-400 py-1 px-2 rounded bg-zinc-900 border border-zinc-800"
            >
              <Percent className="h-3 w-3" />
              {discountAmount > 0 ? `Discount: Rs. ${discountAmount}` : "Add Discount"}
            </button>
            <button
              onClick={() => {
                const note = prompt("Order Note:", orderNotes);
                if (note !== null) setOrderNotes(note);
              }}
              className="text-[11px] text-zinc-400 hover:text-orange-400 py-1 px-2 rounded bg-zinc-900 border border-zinc-800"
            >
              {orderNotes ? "Edit Note" : "Add Order Note"}
            </button>
          </div>

          <div className="space-y-1 text-xs text-zinc-400">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold text-zinc-200">
                {formatCurrency(subtotal)}
              </span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-orange-400">
                <span>Discount ({discountReason || "Custom"}):</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}

            {taxRate > 0 && (
              <div className="flex justify-between">
                <span>GST / Tax ({taxRate}%):</span>
                <span className="font-semibold text-zinc-200">
                  {formatCurrency(taxAmount)}
                </span>
              </div>
            )}

            {orderType === "DELIVERY" && (
              <div className="flex justify-between items-center text-xs">
                <span>Delivery:</span>
                {deliveryFee > 0 ? (
                  <span className="font-semibold text-zinc-200">
                    {formatCurrency(deliveryFee)}
                  </span>
                ) : (
                  <span className="font-bold text-emerald-400 text-[11px] uppercase tracking-wide">
                    FREE
                  </span>
                )}
              </div>
            )}

            <div className="flex justify-between items-baseline pt-1.5 border-t border-zinc-800">
              <span className="font-bold text-sm text-zinc-100">Grand Total:</span>
              <span className="font-black text-xl text-orange-400">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>

          {/* Bottom Primary Actions */}
          <div className="space-y-1.5 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="fire"
                size="lg"
                disabled={cart.length === 0 || submittingOrder || paymentSubmitting}
                onClick={handleSendToKitchen}
                className="text-xs md:text-sm font-black shadow-lg shadow-orange-600/30 flex items-center justify-center gap-1.5"
                title="Send Unpaid Order to Kitchen & Print KOT Ticket (F5)"
              >
                {submittingOrder ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Kitchen...
                  </span>
                ) : (
                  <>
                    <ChefHat className="h-4 w-4 shrink-0" />
                    <span>KITCHEN KOT (F5)</span>
                  </>
                )}
              </Button>

              <Button
                variant="fire"
                size="lg"
                disabled={cart.length === 0 || submittingOrder || paymentSubmitting}
                onClick={() => {
                  setCashTendered(grandTotal.toString());
                  setShowPaymentModal(true);
                }}
                className="text-xs md:text-sm font-black bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5"
                title="Collect Payment & Print Customer Receipt"
              >
                <Banknote className="h-4 w-4 shrink-0" />
                <span>PAY & RECEIPT</span>
              </Button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={clearCart}
              disabled={cart.length === 0 || submittingOrder || paymentSubmitting}
              className="w-full text-xs text-zinc-400 hover:text-white"
              title="Clear Order (F3)"
            >
              Clear Cart (F3)
            </Button>
          </div>
        </div>
      </div>

      {/* 4. MODIFIERS SELECTION MODAL */}
      <Modal
        isOpen={!!activeProductForModifier}
        onClose={() => setActiveProductForModifier(null)}
        title={activeProductForModifier?.name}
        description="Select extras, add-ons, or custom cooking options"
        maxWidth="md"
      >
        <div className="space-y-4">
          {activeProductForModifier?.modifierGroups?.map((group) => (
            <div key={group.id} className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                <span>{group.name}</span>
                <span
                  className={cn(
                    "text-[10px]",
                    group.isRequired &&
                      (selectedModifiers[group.id] || []).length <
                        Math.max(1, group.minSelection)
                      ? "text-orange-400 font-bold"
                      : "text-zinc-500"
                  )}
                >
                  {group.isRequired ? "Required" : "Optional"} • Max {group.maxSelection}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {group.modifiers.map((mod) => {
                  const currentSelected = selectedModifiers[group.id] || [];
                  const isChecked = currentSelected.some((m) => m.id === mod.id);

                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => {
                        setSelectedModifiers((prev) => {
                          const existing = prev[group.id] || [];
                          if (isChecked) {
                            return {
                              ...prev,
                              [group.id]: existing.filter((m) => m.id !== mod.id),
                            };
                          } else {
                            if (existing.length >= group.maxSelection) {
                              return {
                                ...prev,
                                [group.id]: [...existing.slice(1), mod],
                              };
                            }
                            return {
                              ...prev,
                              [group.id]: [...existing, mod],
                            };
                          }
                        });
                      }}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border text-left text-xs font-medium transition-all",
                        isChecked
                          ? "bg-orange-950/40 border-orange-500 text-orange-300"
                          : "bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                      )}
                    >
                      <span className="truncate">{mod.name}</span>
                      {Number(mod.price) > 0 && (
                        <span className="font-bold text-orange-400 shrink-0 ml-1">
                          +{formatCurrency(mod.price)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">
              Kitchen Note for Item:
            </label>
            <Input
              type="text"
              placeholder="e.g. Extra well-done, sauce on side"
              value={modifierNote}
              onChange={(e) => setModifierNote(e.target.value)}
              className="text-xs bg-zinc-900"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="text-[11px] text-orange-400 font-semibold">
              {modifierIssues[0] || ""}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                onClick={() => setActiveProductForModifier(null)}
              >
                Cancel
              </Button>
              <Button
                variant="fire"
                onClick={handleConfirmModifiers}
                disabled={modifierIssues.length > 0}
              >
                Add to Order
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* 5. PAYMENT & CASH CHANGE MODAL */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Checkout & Payment"
        description="Select payment tender and compute cash change"
        maxWidth="lg"
      >
        <div className="space-y-5">
          {/* Order Grand Total Banner */}
          <div className="rounded-2xl border border-zinc-700/80 bg-zinc-800/40 p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-400">Total Payable:</span>
              <div className="text-3xl font-black text-orange-400">
                {formatCurrency(grandTotal)}
              </div>
            </div>
            <div className="text-right text-xs text-zinc-400">
              <div>Order Type: <span className="text-white font-semibold uppercase">{orderType.replace("_", " ")}</span></div>
              <div>Items Count: <span className="text-white font-semibold">{cart.length}</span></div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: "CASH", label: "Cash", icon: Banknote },
              { id: "CARD", label: "Card", icon: CreditCard },
              { id: "BANK_TRANSFER", label: "Bank Transfer", icon: Building2 },
              { id: "OTHER", label: "Other", icon: Layers },
            ].map((m) => {
              const Icon = m.icon;
              const isSel = paymentMethod === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as any)}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all",
                    isSel
                      ? "bg-orange-600 text-white border-orange-500 shadow-md shadow-orange-600/30"
                      : "bg-zinc-800/70 text-zinc-400 border-zinc-700 hover:bg-zinc-800 hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5 mb-1" />
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* Cash Payment Details & Change Calculation */}
          {paymentMethod === "CASH" && (
            <div className="space-y-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/80">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Amount Received from Customer (Rs.):
                </label>
                <Input
                  type="number"
                  placeholder="e.g. 2000"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  className="text-xl font-bold h-12 text-white bg-zinc-950"
                  autoFocus
                />
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCashTendered(grandTotal.toString())}
                  className="text-xs"
                >
                  Exact (Rs. {grandTotal})
                </Button>
                {[500, 1000, 2000, 5000].map((preset) => (
                  <Button
                    key={preset}
                    variant="outline"
                    size="sm"
                    onClick={() => setCashTendered(preset.toString())}
                    className="text-xs font-mono"
                  >
                    +Rs. {preset}
                  </Button>
                ))}
              </div>

              {/* Change Calculation Box */}
              <div className="mt-3 p-3.5 rounded-xl border border-zinc-700 bg-zinc-800/80 flex items-center justify-between">
                <span className="font-bold text-sm text-zinc-200">
                  Change to Return:
                </span>
                <span className="text-2xl font-black text-emerald-400">
                  {formatCurrency(changeReturned)}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowPaymentModal(false)}
              disabled={paymentSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="fire"
              size="lg"
              onClick={handleCompleteOrder}
              disabled={paymentSubmitting}
              className="text-sm font-bold px-8"
            >
              {paymentSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Processing...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Confirm & Print Receipt
                </span>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 6. KITCHEN ORDER TICKET (KOT) MODAL */}
      <KitchenTicketModal
        isOpen={showKitchenTicketModal}
        onClose={() => setShowKitchenTicketModal(false)}
        order={lastCompletedOrder}
      />

      {/* 7. RECEIPT MODAL */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        order={lastCompletedOrder}
      />
    </div>
  );
}

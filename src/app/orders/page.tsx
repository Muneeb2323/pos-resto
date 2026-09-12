"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Receipt,
  Search,
  Filter,
  Calendar,
  Eye,
  Printer,
  Ban,
  RotateCcw,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  User,
  Phone,
  DollarSign,
  AlertCircle,
  Banknote,
  CreditCard,
  ChefHat,
  Check,
  Bike,
} from "lucide-react";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ReceiptModal } from "@/components/receipt/ReceiptModal";
import { CustomerBillModal } from "@/components/receipt/CustomerBillModal";
import { KitchenTicketModal } from "@/components/receipt/KitchenTicketModal";
import { useAsyncLoad } from "@/lib/hooks/useAsyncLoad";

export default function OrdersPage() {
  const [orders, setOrders] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [typeFilter, setTypeFilter] = React.useState("ALL");
  const [page, setPage] = React.useState(1);
  const [pagination, setPagination] = React.useState({ total: 0, totalPages: 1 });

  // Detail Modal
  const [selectedOrder, setSelectedOrder] = React.useState<any | null>(null);

  // Printing Modals
  const [billOrder, setBillOrder] = React.useState<any | null>(null);
  const [receiptOrder, setReceiptOrder] = React.useState<any | null>(null);
  const [kotOrder, setKotOrder] = React.useState<any | null>(null);

  // Mark as Paid State
  const [payingOrder, setPayingOrder] = React.useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState<"CASH" | "CARD" | "BANK_TRANSFER">("CASH");
  const [tenderedAmount, setTenderedAmount] = React.useState("");
  const [paySubmitting, setPaySubmitting] = React.useState(false);

  // Post-payment prompt ("when we mark it as paid its on us we need that print or no")
  const [postPaymentPrompt, setPostPaymentPrompt] = React.useState<{ order: any } | null>(null);

  const fetchOrders = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (typeFilter !== "ALL") params.set("orderType", typeFilter);
      params.set("page", page.toString());
      params.set("limit", "20");

      const res = await fetch(`/api/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter, page]);

  useAsyncLoad(fetchOrders);

  const handleCancel = async (orderId: string) => {
    const reason = prompt("Enter cancellation reason:", "Customer request");
    if (!reason) return;

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL", reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel");

      alert("Order cancelled successfully");
      setSelectedOrder(null);
      fetchOrders();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error cancelling order");
    }
  };

  const handleRefund = async (orderId: string) => {
    const reason = prompt("Enter refund reason:", "Quality issue / wrong order");
    if (!reason) return;

    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REFUND", reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to process refund");

      alert("Refund completed and cash drawer adjusted");
      setSelectedOrder(null);
      fetchOrders();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error refunding order");
    }
  };

  // Mark as Paid API Handler
  const handleConfirmPayment = async () => {
    if (!payingOrder) return;
    setPaySubmitting(true);
    try {
      const grandTotal = Number(payingOrder.grandTotal);
      const tendered = parseFloat(tenderedAmount) || grandTotal;
      const change = Math.max(0, tendered - grandTotal);

      const res = await fetch(`/api/orders/${payingOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "MARK_PAID",
          paymentMethod,
          amountReceived: paymentMethod === "CASH" ? tendered : grandTotal,
          changeGiven: paymentMethod === "CASH" ? change : 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");

      const updated = data.order || payingOrder;
      setPayingOrder(null);
      setTenderedAmount("");
      fetchOrders();

      if (selectedOrder?.id === payingOrder.id) {
        setSelectedOrder(null);
      }

      // Prompt: Print receipt or no
      setPostPaymentPrompt({ order: updated });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error processing payment");
    } finally {
      setPaySubmitting(false);
    }
  };

  const payingTotal = payingOrder ? Number(payingOrder.grandTotal) : 0;
  const payingTenderedNum = parseFloat(tenderedAmount) || 0;
  const payingChange = Math.max(0, payingTenderedNum - payingTotal);

  return (
    <div className="flex flex-col h-full w-full bg-[#0c0d10] overflow-hidden text-zinc-100">
      {/* Top Header & Controls */}
      <div className="p-4 border-b border-zinc-800 bg-[#121319] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-black tracking-wider text-white">
              ORDER MANAGEMENT
            </h1>
            <p className="text-[11px] text-zinc-400">
              Customer Bills, Kitchen Tickets, & Payment Processing
            </p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Search */}
          <div className="relative w-60">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <Input
              type="text"
              placeholder="Search # order, customer, phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 h-9 text-xs bg-zinc-900 border-zinc-700"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="PREPARING">Preparing</option>
            <option value="READY">Ready</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Type Filter (Strictly Dine-In, Takeaway, Delivery) */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="ALL">All Channels</option>
            <option value="DINE_IN">Dine In</option>
            <option value="TAKEAWAY">Takeaway</option>
            <option value="DELIVERY">Delivery</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            className="h-9 text-xs"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center text-zinc-500 text-sm">
            <span className="h-5 w-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mr-2" />
            Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col h-full items-center justify-center text-zinc-500 text-xs">
            <Receipt className="h-10 w-10 text-zinc-700 mb-2" />
            <span>No orders matching your criteria</span>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-[#13141b] overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-[#181922] text-zinc-400 font-bold border-b border-zinc-800 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Order #</th>
                  <th className="p-3.5">Date / Time</th>
                  <th className="p-3.5">Channel & Table</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Total</th>
                  <th className="p-3.5">Payment</th>
                  <th className="p-3.5">Kitchen</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80">
                {orders.map((order) => {
                  const isCancelled = order.status === "CANCELLED";
                  const isPaid = order.paymentStatus === "PAID";
                  const isCompleted = order.status === "COMPLETED";

                  return (
                    <tr
                      key={order.id}
                      className={cn(
                        "hover:bg-zinc-800/40 transition-colors",
                        isCancelled && "opacity-60 bg-red-950/10",
                        !isPaid && !isCancelled && "bg-amber-500/[0.02]"
                      )}
                    >
                      <td className="p-3.5 font-bold text-white">
                        <span className="font-mono text-sm">{order.orderNumber}</span>
                      </td>
                      <td className="p-3.5 text-zinc-400 font-mono text-[11px]">
                        {formatDateTime(order.createdAt)}
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold uppercase text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-200">
                              {order.orderType?.replace("_", " ")}
                            </span>
                            {order.table && (
                              <span className="text-orange-400 font-bold text-xs">
                                {order.table.name}
                              </span>
                            )}
                          </div>
                          {order.waiterName && (
                            <div className="text-[11px] text-amber-400/90 font-medium">
                              <span className="text-zinc-500 text-[10px]">Waiter:</span> {order.waiterName}
                            </div>
                          )}
                          {order.riderName && (
                            <div className="flex items-center gap-1 text-[11px] text-blue-400/90 font-medium">
                              <Bike className="h-3 w-3 shrink-0" /> {order.riderName}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        {order.customer ? (
                          <div>
                            <div className="font-semibold text-zinc-200">
                              {order.customer.name}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              {order.customer.phone}
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-600">Walk-in</span>
                        )}
                      </td>
                      <td className="p-3.5 font-black text-sm text-orange-400">
                        {formatCurrency(order.grandTotal)}
                      </td>

                      {/* Payment Status Badge */}
                      <td className="p-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase",
                            isPaid
                              ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-400"
                              : "bg-amber-950/40 border-amber-500/50 text-amber-400 animate-pulse"
                          )}
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              PAID
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3" />
                              UNPAID
                            </>
                          )}
                        </span>
                      </td>

                      {/* Kitchen Status Badge */}
                      <td className="p-3.5">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                            isCancelled
                              ? "bg-red-950/40 text-red-400"
                              : isCompleted
                              ? "bg-zinc-800 text-zinc-400"
                              : order.status === "READY"
                              ? "bg-emerald-600/30 text-emerald-300"
                              : "bg-orange-600/30 text-orange-300"
                          )}
                        >
                          {order.status}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* UNPAID Order: Customer Bill & Mark as Paid */}
                          {!isPaid && !isCancelled && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setBillOrder(order)}
                                className="h-7 text-[11px] px-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 gap-1 font-semibold"
                                title="Print Pre-payment Customer Bill"
                              >
                                <Printer className="h-3 w-3" />
                                Bill
                              </Button>

                              <Button
                                variant="fire"
                                size="sm"
                                onClick={() => {
                                  setPayingOrder(order);
                                  setTenderedAmount(Number(order.grandTotal).toString());
                                }}
                                className="h-7 text-[11px] px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white gap-1 font-bold shadow-md shadow-emerald-600/20"
                                title="Mark Order as Paid"
                              >
                                <Banknote className="h-3.5 w-3.5" />
                                Mark Paid
                              </Button>
                            </>
                          )}

                          {/* PAID Order: Reprint Receipt */}
                          {isPaid && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setReceiptOrder(order)}
                              className="h-7 text-[11px] px-2 border-zinc-700 text-zinc-300 hover:text-white gap-1"
                              title="Print Final Receipt"
                            >
                              <Printer className="h-3 w-3" />
                              Receipt
                            </Button>
                          )}

                          {/* Reprint Kitchen Ticket */}
                          <button
                            onClick={() => setKotOrder(order)}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-orange-400 transition-colors"
                            title="Reprint Kitchen Order Ticket (KOT)"
                          >
                            <ChefHat className="h-4 w-4" />
                          </button>

                          {/* View Order Details */}
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                            title="View Full Order Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div className="p-3 border-t border-zinc-800 bg-[#121319] flex items-center justify-between text-xs text-zinc-400 shrink-0">
          <span>
            Showing page {page} of {pagination.totalPages} ({pagination.total} total orders)
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage(page + 1)}
              className="text-xs"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* 1. ORDER DETAILS MODAL */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={`Order Details: ${selectedOrder?.orderNumber}`}
        description={`Created on ${selectedOrder ? formatDateTime(selectedOrder.createdAt) : ""}`}
        maxWidth="lg"
      >
        {selectedOrder && (
          <div className="space-y-4 text-xs">
            {/* Metadata Bar */}
            <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-zinc-800/60 border border-zinc-700">
              <div>
                <span className="text-zinc-500">Channel:</span>
                <div className="font-bold text-white uppercase">
                  {selectedOrder.orderType?.replace("_", " ")}
                </div>
              </div>
              <div>
                <span className="text-zinc-500">Table:</span>
                <div className="font-bold text-orange-400">
                  {selectedOrder.table?.name || "N/A"}
                </div>
              </div>
              <div>
                <span className="text-zinc-500">Payment:</span>
                <div className={cn("font-bold uppercase", selectedOrder.paymentStatus === "PAID" ? "text-emerald-400" : "text-amber-400")}>
                  {selectedOrder.paymentStatus}
                </div>
              </div>
              <div>
                <span className="text-zinc-500">Cashier:</span>
                <div className="font-bold text-white">
                  {selectedOrder.cashier?.name || "Admin"}
                </div>
              </div>
              {selectedOrder.waiterName && (
                <div>
                  <span className="text-zinc-500">Waiter:</span>
                  <div className="font-bold text-amber-400">
                    {selectedOrder.waiterName}
                  </div>
                </div>
              )}
              {selectedOrder.riderName && (
                <div>
                  <span className="text-zinc-500">Delivery Rider:</span>
                  <div className="font-bold text-blue-400 flex items-center gap-1">
                    <Bike className="h-3.5 w-3.5" />
                    {selectedOrder.riderName}
                  </div>
                </div>
              )}
            </div>

            {/* Customer Details if present */}
            {selectedOrder.customer && (
              <div className="p-3 rounded-xl bg-zinc-800/40 border border-zinc-700/80 space-y-1">
                <span className="font-bold text-zinc-300">Customer Info:</span>
                <div className="flex justify-between">
                  <span>Name: {selectedOrder.customer.name}</span>
                  <span className="font-mono">Phone: {selectedOrder.customer.phone}</span>
                </div>
                {selectedOrder.deliveryAddress && (
                  <div className="text-zinc-400">
                    Address: {selectedOrder.deliveryAddress}
                  </div>
                )}
              </div>
            )}

            {/* Items Breakdown */}
            <div className="space-y-2">
              <span className="font-bold text-zinc-300">Ordered Items:</span>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden divide-y divide-zinc-800">
                {selectedOrder.items?.map((item: any) => (
                  <div key={item.id} className="p-2.5 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-white">
                        {item.quantity}x {item.productName}
                      </div>
                      {item.modifiers?.map((m: any) => (
                        <div key={m.id} className="text-[10px] text-orange-300 italic pl-3">
                          + {m.modifierName} {Number(m.unitPrice) > 0 && `(Rs. ${m.unitPrice})`}
                        </div>
                      ))}
                      {item.notes && (
                        <div className="text-[10px] text-zinc-400 italic pl-3">
                          Note: {item.notes}
                        </div>
                      )}
                    </div>
                    <span className="font-black text-zinc-200">
                      {formatCurrency(item.itemTotal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Subtotal:</span>
                <span>{formatCurrency(selectedOrder.subtotal)}</span>
              </div>
              {Number(selectedOrder.discountAmount) > 0 && (
                <div className="flex justify-between text-orange-400">
                  <span>Discount:</span>
                  <span>-{formatCurrency(selectedOrder.discountAmount)}</span>
                </div>
              )}
              {Number(selectedOrder.taxAmount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Tax / GST:</span>
                  <span>{formatCurrency(selectedOrder.taxAmount)}</span>
                </div>
              )}
              {Number(selectedOrder.deliveryCharge) > 0 && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Delivery Fee:</span>
                  <span>{formatCurrency(selectedOrder.deliveryCharge)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm pt-1 border-t border-zinc-700">
                <span className="text-white">Grand Total:</span>
                <span className="text-orange-400">
                  {formatCurrency(selectedOrder.grandTotal)}
                </span>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex justify-between items-center pt-2 border-t border-zinc-700">
              <div className="flex gap-2">
                {selectedOrder.status !== "CANCELLED" && (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleCancel(selectedOrder.id)}
                      className="text-xs"
                    >
                      <Ban className="h-3.5 w-3.5 mr-1" />
                      Cancel Order
                    </Button>
                    {selectedOrder.paymentStatus === "PAID" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefund(selectedOrder.id)}
                        className="text-xs text-amber-400 border-amber-500/40 hover:bg-amber-950/30"
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Refund
                      </Button>
                    )}
                  </>
                )}
              </div>

              <div className="flex gap-2">
                {selectedOrder.paymentStatus === "UNPAID" && selectedOrder.status !== "CANCELLED" ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBillOrder(selectedOrder);
                        setSelectedOrder(null);
                      }}
                      className="border-amber-500/50 text-amber-400"
                    >
                      <Printer className="h-3.5 w-3.5 mr-1" />
                      Print Bill
                    </Button>
                    <Button
                      variant="fire"
                      size="sm"
                      onClick={() => {
                        const o = selectedOrder;
                        setSelectedOrder(null);
                        setPayingOrder(o);
                        setTenderedAmount(Number(o.grandTotal).toString());
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500"
                    >
                      <Banknote className="h-3.5 w-3.5 mr-1" />
                      Mark as Paid
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="fire"
                    size="sm"
                    onClick={() => {
                      setReceiptOrder(selectedOrder);
                      setSelectedOrder(null);
                    }}
                  >
                    <Printer className="h-3.5 w-3.5 mr-1" />
                    Print Receipt
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 2. MARK AS PAID MODAL */}
      <Modal
        isOpen={!!payingOrder}
        onClose={() => setPayingOrder(null)}
        title={`Collect Payment: ${payingOrder?.orderNumber}`}
        description={`Total Amount Due: ${formatCurrency(payingTotal)}`}
        maxWidth="md"
      >
        {payingOrder && (
          <div className="space-y-4">
            {/* Amount Banner */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 text-center">
              <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">Total Payable</span>
              <div className="text-3xl font-black text-orange-400 mt-0.5">
                {formatCurrency(payingTotal)}
              </div>
              <div className="text-[11px] text-zinc-400 mt-1">
                Channel: <span className="font-bold text-white uppercase">{payingOrder.orderType?.replace("_", " ")}</span>
                {payingOrder.table && ` • ${payingOrder.table.name}`}
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Select Tender Method</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "CASH", label: "Cash", icon: Banknote },
                  { id: "CARD", label: "Debit / Card", icon: CreditCard },
                  { id: "BANK_TRANSFER", label: "Online / Transfer", icon: DollarSign },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all gap-1.5",
                        paymentMethod === m.id
                          ? "bg-orange-600 text-white border-orange-500 shadow-md shadow-orange-600/30"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-white"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cash Tendered Input (if CASH) */}
            {paymentMethod === "CASH" && (
              <div className="space-y-3 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <div>
                  <label className="text-xs font-semibold text-zinc-300">Cash Received (Rs.)</label>
                  <Input
                    type="number"
                    value={tenderedAmount}
                    onChange={(e) => setTenderedAmount(e.target.value)}
                    placeholder="Enter amount given by customer"
                    className="h-11 text-lg font-mono font-bold bg-zinc-950 border-zinc-700 text-white mt-1"
                    autoFocus
                  />
                </div>

                {/* Quick denomination buttons */}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {[payingTotal, 500, 1000, 1500, 2000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTenderedAmount(amt.toString())}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-[11px] border border-zinc-700"
                    >
                      Rs. {amt}
                    </button>
                  ))}
                </div>

                {/* Change Calculation */}
                <div className="flex justify-between items-center pt-2 border-t border-zinc-800 text-sm">
                  <span className="text-zinc-400">Change Due:</span>
                  <span className={cn("font-mono font-black text-lg", payingChange > 0 ? "text-emerald-400" : "text-zinc-400")}>
                    {formatCurrency(payingChange)}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setPayingOrder(null)}
                disabled={paySubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="fire"
                size="lg"
                onClick={handleConfirmPayment}
                disabled={paySubmitting}
                className="bg-emerald-600 hover:bg-emerald-500 font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2"
              >
                {paySubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Recording...
                  </span>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    Confirm & Mark Paid
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 3. POST-PAYMENT PROMPT ("its on us we need that print or no") */}
      <Modal
        isOpen={!!postPaymentPrompt}
        onClose={() => setPostPaymentPrompt(null)}
        title="Payment Completed!"
        description={`Order ${postPaymentPrompt?.order?.orderNumber} is marked as PAID.`}
        maxWidth="sm"
      >
        <div className="space-y-4 text-center py-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto border border-emerald-500/40 shadow-xl shadow-emerald-500/10">
            <CheckCircle2 className="h-9 w-9" />
          </div>

          <div>
            <div className="text-2xl font-black text-white">
              {formatCurrency(postPaymentPrompt?.order?.grandTotal || 0)}
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Payment was recorded successfully. Do you want to print the final receipt?
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setPostPaymentPrompt(null)}
              className="text-xs"
            >
              Done / No Print
            </Button>
            <Button
              variant="fire"
              size="lg"
              onClick={() => {
                const orderToPrint = postPaymentPrompt?.order;
                setPostPaymentPrompt(null);
                setReceiptOrder(orderToPrint);
              }}
              className="text-xs flex items-center justify-center gap-1.5 font-bold"
            >
              <Printer className="h-4 w-4" />
              Print Final Receipt
            </Button>
          </div>
        </div>
      </Modal>

      {/* 4. CUSTOMER BILL PRINT MODAL */}
      <CustomerBillModal
        isOpen={!!billOrder}
        onClose={() => setBillOrder(null)}
        order={billOrder}
      />

      {/* 5. KITCHEN ORDER TICKET (KOT) MODAL */}
      <KitchenTicketModal
        isOpen={!!kotOrder}
        onClose={() => setKotOrder(null)}
        order={kotOrder}
      />

      {/* 6. FINAL PAID RECEIPT MODAL */}
      <ReceiptModal
        isOpen={!!receiptOrder}
        onClose={() => setReceiptOrder(null)}
        order={receiptOrder}
      />
    </div>
  );
}

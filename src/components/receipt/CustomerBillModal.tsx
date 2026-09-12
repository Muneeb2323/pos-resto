"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Printer, Receipt, AlertCircle } from "lucide-react";
import { printThermalReceipt } from "@/lib/print";
import { useRestaurantSettings } from "@/lib/hooks/useRestaurantSettings";

interface CustomerBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}

export function CustomerBillModal({ isOpen, onClose, order }: CustomerBillModalProps) {
  const settings = useRestaurantSettings();

  // Transfer accounts, one per line, as configured in Settings > Printer & Receipts.
  const paymentLines = (settings?.onlinePaymentInfo || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!order) return null;

  // Resolve Waiter & Rider Names
  // The server stores the serving staff on the order itself, as a foreign key plus a
  // name snapshot, so nothing has to be parsed back out of the free-text notes.
  const waiterName = order?.waiterName || order?.waiter?.name || null;
  const riderName = order?.riderName || order?.rider?.name || null;

  const handlePrint = () => {
    printThermalReceipt("printable-customer-bill", { ...order, waiterName, riderName });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customer Bill"
      description={`Pre-payment invoice for Order ${order.orderNumber}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* ACTION BAR */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-800">
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold">
              <Receipt className="h-4 w-4" />
              <span>Customer Bill • Black Copper BC-85AC (80mm)</span>
            </div>
            <span className="text-[10px] text-zinc-400">
              Print setting: Margin = None • Headers/Footers = Off
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Close
            </Button>
            <Button
              variant="fire"
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" />
              Print Bill
            </Button>
          </div>
        </div>

        {/* THERMAL BILL CONTAINER */}
        <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 overflow-y-auto max-h-[70vh]">
          <div
            id="printable-customer-bill"
            className="printable-thermal-document mx-auto w-[70mm] max-w-[70mm] bg-white text-black p-2.5 text-xs select-text shadow-md rounded-sm"
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
              color: "#000000",
              backgroundColor: "#ffffff",
              width: "70mm",
              maxWidth: "70mm",
              paddingRight: "5mm",
              boxSizing: "border-box",
              height: "auto",
              minHeight: "fit-content",
            }}
          >
            {/* BRAND HEADER */}
            <div className="text-center pb-2 border-b border-dashed border-black">
              <div className="text-[11px] font-black uppercase mb-1 px-2 py-0.5 border border-black inline-block">
                *** CUSTOMER BILL ***
              </div>
              <h1 className="text-base font-black tracking-widest uppercase leading-tight">
                FORK & FIRE
              </h1>
              <p className="text-[11px] font-bold uppercase">Special Fast Food & Pizza</p>
              <p className="text-[9px] text-gray-700 mt-0.5">
                Main Karkhana Bazar, Chak 267 RB, Jallandhar Arain
              </p>
            </div>

            {/* ONLINE PAYMENT ACCOUNTS - customer bill only, since this is unpaid */}
            {paymentLines.length > 0 && (
              <div className="py-2 border-b border-dashed border-black text-center">
                <div className="text-[10px] font-black uppercase tracking-wide mb-1">
                  *** Online Payment ***
                </div>
                <div className="text-[10px] font-bold leading-snug space-y-0.5">
                  {paymentLines.map((line, index) => (
                    <div key={index}>{line}</div>
                  ))}
                </div>
              </div>
            )}

            {/* ORDER METADATA */}
            <div className="py-2 text-[11px] space-y-0.5 border-b border-dashed border-black">
              <div className="flex justify-between font-bold text-sm">
                <span>ORDER: {order.orderNumber?.startsWith("#") ? order.orderNumber : `#${order.orderNumber}`}</span>
                <span className="uppercase">{order.orderType?.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-700">
                <span>Date: {formatDateTime(order.createdAt || new Date())}</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-700">
                <span>Cashier: {order.cashier?.name || "Admin"}</span>
                {order.table && (
                  <span className="font-bold text-black">Table: {order.table.name}</span>
                )}
              </div>
              {waiterName && (
                <div className="flex justify-between text-[10px] text-gray-700">
                  <span>Waiter: <strong className="text-black">{waiterName}</strong></span>
                </div>
              )}
              {riderName && (
                <div className="flex justify-between text-[10px] text-gray-700">
                  <span>Rider: <strong className="text-black">{riderName}</strong></span>
                </div>
              )}
              {order.customer && (
                <div className="text-[10px] text-gray-700 pt-0.5 border-t border-dotted border-gray-300">
                  <span>Customer: {order.customer.name} ({order.customer.phone})</span>
                  {order.deliveryAddress && (
                    <div className="text-[9px] leading-tight">Addr: {order.deliveryAddress}</div>
                  )}
                </div>
              )}
            </div>

            {/* ITEMS LIST */}
            <div className="py-2 border-b border-dashed border-black space-y-1.5">
              <div className="flex justify-between font-bold text-[10px] border-b border-black pb-1">
                <span>ITEM</span>
                <span>TOTAL</span>
              </div>

              {order.items?.map((item: any, idx: number) => (
                <div key={idx} className="text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-semibold">{item.productName || item.name}</span>
                    <span className="font-bold">{formatCurrency(item.itemTotal)}</span>
                  </div>
                  <div className="text-[9px] text-gray-600 pl-1">
                    {item.quantity} x {formatCurrency(item.unitPrice || item.price)}
                  </div>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="pl-2 text-[9px] text-gray-700 italic">
                      {item.modifiers.map((mod: any, mIdx: number) => (
                        <div key={mIdx}>
                          + {mod.modifierName || mod.name}
                          {Number(mod.unitPrice || mod.price || 0) > 0 &&
                            ` (${formatCurrency(mod.unitPrice || mod.price)})`}
                        </div>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <div className="pl-2 text-[9px] italic text-gray-600">
                      Note: {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* TOTALS */}
            <div className="py-2 space-y-1 text-[11px] border-b border-dashed border-black">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>

              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>Discount ({order.discountReason || "Special"}):</span>
                  <span>-{formatCurrency(order.discountAmount)}</span>
                </div>
              )}

              {Number(order.taxAmount) > 0 && (
                <div className="flex justify-between">
                  <span>GST / Tax:</span>
                  <span>{formatCurrency(order.taxAmount)}</span>
                </div>
              )}

              {Number(order.deliveryCharge) > 0 && (
                <div className="flex justify-between">
                  <span>Delivery Charge:</span>
                  <span>{formatCurrency(order.deliveryCharge)}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-1.5 border-t-2 border-black font-black text-sm">
                <span>TOTAL PAYABLE:</span>
                <span>{formatCurrency(order.grandTotal)}</span>
              </div>
            </div>

            {/* PAYMENT STATUS NOTICE */}
            <div className="py-2 text-center border-b border-dashed border-black">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 border border-black inline-block">
                {order.paymentStatus === "PAID" ? "STATUS: PAID" : "STATUS: UNPAID / DUE"}
              </span>
            </div>

            {/* FOOTER */}
            <div className="text-center pt-2 text-[10px] space-y-0.5 font-semibold">
              <p className="font-bold">*** PLEASE PAY AT COUNTER ***</p>
              <p className="text-[9px] text-gray-600">GOOD FOOD • GOOD LIFE</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

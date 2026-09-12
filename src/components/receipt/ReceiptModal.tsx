"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Printer, Check, Copy } from "lucide-react";
import { printThermalReceipt } from "@/lib/print";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}

export function ReceiptModal({ isOpen, onClose, order }: ReceiptModalProps) {
  const [copied, setCopied] = React.useState(false);

  if (!order) return null;

  // Resolve Waiter & Rider Names
  // The server stores the serving staff on the order itself, as a foreign key plus a
  // name snapshot, so nothing has to be parsed back out of the free-text notes.
  const waiterName = order?.waiterName || order?.waiter?.name || null;
  const riderName = order?.riderName || order?.rider?.name || null;

  const handlePrint = () => {
    printThermalReceipt("printable-receipt", { ...order, waiterName, riderName });
  };

  const payment = order.payments?.[0];
  const cashReceived = payment?.amountReceived || order.grandTotal;
  const changeGiven = payment?.changeGiven || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Order Receipt"
      description={`Receipt generated for ${order.orderNumber}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* ACTION BAR */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-700">
          <div className="flex flex-col">
            <span className="text-xs text-white font-semibold">
              Black Copper BC-85AC (80mm)
            </span>
            <span className="text-[10px] text-zinc-400">
              Print setting: Margin = None • Headers/Footers = Off
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="fire"
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" />
              Print Receipt
            </Button>
          </div>
        </div>

        {/* PRINTABLE THERMAL RECEIPT CONTAINER */}
        <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 overflow-y-auto max-h-[70vh]">
          <div
            id="printable-receipt"
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
              <h1 className="text-base font-black tracking-widest uppercase leading-tight">
                FORK & FIRE
              </h1>
              <p className="text-[11px] font-bold uppercase">Special Fast Food & Pizza</p>
              <p className="text-[9px] text-gray-700 mt-0.5">
                Main Karkhana Bazar, Chak 267 RB, Jallandhar Arain
              </p>
              <p className="text-[9px] text-gray-700 font-bold">
                Delivery: 0301-9622267 / 0305-7729767
              </p>
            </div>

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
                <span>Cashier: {order.cashier?.name || "Terminal 1"}</span>
                {order.table && <span className="font-bold text-black">Table: {order.table.name}</span>}
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
                    <div className="text-[9px] truncate">
                      Addr: {order.deliveryAddress}
                    </div>
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

                  {/* Modifiers */}
                  {item.modifiers?.map((m: any, mIdx: number) => (
                    <div
                      key={mIdx}
                      className="text-[9px] text-gray-700 pl-2 italic"
                    >
                      + {m.modifierName || m.name}
                      {Number(m.unitPrice || m.price || 0) > 0 && ` (${formatCurrency(m.unitPrice || m.price)})`}
                    </div>
                  ))}

                  {item.notes && (
                    <div className="text-[9px] text-gray-600 pl-2 italic">
                      Note: {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* FINANCIAL TOTALS */}
            <div className="py-2 text-[11px] space-y-1 border-b border-dashed border-black">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>

              {Number(order.discountAmount) > 0 && (
                <div className="flex justify-between text-gray-800">
                  <span>Discount {order.discountReason ? `(${order.discountReason})` : ""}:</span>
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

              <div className="flex justify-between font-black text-sm pt-1 border-t-2 border-black">
                <span>GRAND TOTAL:</span>
                <span>{formatCurrency(order.grandTotal)}</span>
              </div>
            </div>

            {/* PAYMENT INFORMATION */}
            <div className="py-2 text-[11px] space-y-0.5 border-b border-dashed border-black">
              <div className="flex justify-between">
                <span>Payment Method:</span>
                <span className="font-bold uppercase">
                  {payment?.paymentMethod || "CASH"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Amount Tendered:</span>
                <span>{formatCurrency(cashReceived)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Change Returned:</span>
                <span>{formatCurrency(changeGiven)}</span>
              </div>
            </div>

            {/* STATUS BANNER */}
            <div className="py-1.5 text-center border-b border-dashed border-black">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 border border-black inline-block">
                PAID IN FULL • THANK YOU!
              </span>
            </div>

            {/* FOOTER */}
            <div className="text-center pt-2 text-[10px] space-y-0.5">
              <p className="font-bold">GOOD FOOD • GOOD LIFE</p>
              <p className="text-[9px] text-gray-600">Fresh & Hot Delivery to Your Doorstep! • Taste The Heat</p>
              <p className="text-[8px] text-gray-500 pt-0.5">
                Software: Fork & Fire Commercial POS
              </p>
            </div>
          </div>
        </div>

        {/* CLOSE BUTTON */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button variant="fire" onClick={handlePrint}>
            Print Again
          </Button>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { Printer, ChefHat, Check } from "lucide-react";
import { printThermalReceipt } from "@/lib/print";

interface KitchenTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}

export function KitchenTicketModal({ isOpen, onClose, order }: KitchenTicketModalProps) {
  if (!order) return null;

  // Resolve Waiter & Rider Names
  // The server stores the serving staff on the order itself, as a foreign key plus a
  // name snapshot, so nothing has to be parsed back out of the free-text notes.
  const waiterName = order?.waiterName || order?.waiter?.name || null;
  const riderName = order?.riderName || order?.rider?.name || null;

  const handlePrint = () => {
    printThermalReceipt("printable-kitchen-ticket", { ...order, waiterName, riderName });
  };

  const totalQuantity = order.items?.reduce(
    (acc: number, item: any) => acc + (item.quantity || 1),
    0
  ) || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Kitchen Order Ticket (KOT)"
      description="Chef copy for kitchen preparation"
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* ACTION BAR */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-800">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-xs text-orange-400 font-semibold">
              <ChefHat className="h-4 w-4" />
              <span>Kitchen Ticket (KOT) • Black Copper BC-85AC (80mm)</span>
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
              Done / Close
            </Button>
            <Button
              variant="fire"
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-1.5"
            >
              <Printer className="h-4 w-4" />
              Print KOT
            </Button>
          </div>
        </div>

        {/* PRINTABLE THERMAL TICKET CONTAINER */}
        <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 overflow-y-auto max-h-[70vh]">
          <div
            id="printable-kitchen-ticket"
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
            {/* KOT HEADER */}
            <div className="text-center pb-2 border-b-2 border-dashed border-black">
              <div className="text-xs font-black tracking-widest uppercase border border-black py-0.5 px-2 inline-block">
                *** KITCHEN ORDER TICKET ***
              </div>
              <h1 className="text-base font-black tracking-widest uppercase mt-1">
                FORK & FIRE
              </h1>
              <p className="text-[10px] font-bold text-gray-700">CHEF / KITCHEN COPY</p>
            </div>

            {/* ORDER METADATA */}
            <div className="py-2 text-[11px] space-y-0.5 border-b border-dashed border-black">
              <div className="flex justify-between font-bold text-sm">
                <span>ORDER: {order.orderNumber?.startsWith("#") ? order.orderNumber : `#${order.orderNumber}`}</span>
                <span className="uppercase">{order.orderType?.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-700">
                <span>Time: {formatDateTime(order.createdAt || new Date())}</span>
                <span>Total Items: {totalQuantity}</span>
              </div>

              {order.table && (
                <div className="flex justify-between text-[10px] font-bold text-black">
                  <span>Table: {order.table.name}</span>
                </div>
              )}

              {/* Waiter / Staff serving this table */}
              {waiterName && (
                <div className="flex justify-between text-[10px] text-gray-700">
                  <span>Waiter: <strong className="text-black">{waiterName}</strong></span>
                </div>
              )}

              {/* Delivery Rider */}
              {riderName && (
                <div className="flex justify-between text-[10px] text-gray-700">
                  <span>Rider: <strong className="text-black">{riderName}</strong></span>
                </div>
              )}

              {order.customer && (
                <div className="text-[10px] text-gray-700 border-t border-dotted border-gray-300 pt-0.5">
                  <span>Customer: {order.customer.name} {order.customer.phone ? `(${order.customer.phone})` : ""}</span>
                  {order.deliveryAddress && (
                    <div className="text-[9px] leading-tight">
                      Addr: {order.deliveryAddress}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* KITCHEN ITEMS */}
            <div className="py-2 border-b border-dashed border-black space-y-1.5">
              <div className="flex justify-between font-bold text-[10px] border-b border-black pb-1">
                <span>ITEM</span>
                <span>QTY</span>
              </div>

              {order.items?.map((item: any, idx: number) => (
                <div key={idx} className="text-[11px]">
                  <div className="flex justify-between">
                    <span className="font-semibold">{item.productName || item.name}</span>
                    <span className="font-bold">{item.quantity}x</span>
                  </div>

                  {/* MODIFIERS */}
                  {item.modifiers?.map((m: any, mIdx: number) => (
                    <div key={mIdx} className="text-[9px] text-gray-700 pl-2 italic">
                      + {m.modifierName || m.name}
                    </div>
                  ))}

                  {/* COOKING NOTES */}
                  {item.notes && (
                    <div className="text-[9px] text-gray-800 font-semibold pl-2 italic">
                      Note: {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* GENERAL ORDER NOTES */}
            {order.orderNotes && (
              <div className="py-2 border-b border-dashed border-black text-[10px]">
                <span className="font-bold">SPECIAL INSTRUCTIONS:</span>
                <p className="font-semibold italic text-gray-800 mt-0.5 bg-gray-100 p-1">
                  {order.orderNotes}
                </p>
              </div>
            )}

            {/* FOOTER */}
            <div className="text-center pt-2 text-[10px] font-bold uppercase space-y-0.5">
              <p>*** PREPARE FRESH & SERVE HOT ***</p>
              <p className="text-[9px] text-gray-500">KOT #{order.orderNumber}</p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

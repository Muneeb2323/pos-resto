"use client";

import * as React from "react";
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  DollarSign,
  TrendingUp,
  UserCheck,
  CreditCard,
  FileSpreadsheet,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAsyncLoad } from "@/lib/hooks/useAsyncLoad";

export default function ReportsPage() {
  const [range, setRange] = React.useState("today");
  const [report, setReport] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchReports = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reports?range=${range}`);
      if (res.ok) {
        setReport(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useAsyncLoad(fetchReports);

  const handleExportCSV = () => {
    if (!report || !report.ordersList || report.ordersList.length === 0) {
      alert("No sales records to export for this range.");
      return;
    }

    const headers = [
      "Order Number",
      "Date",
      "Type",
      "Subtotal",
      "Discount",
      "Tax",
      "Delivery Fee",
      "Grand Total",
      "Status",
      "Payment Status",
      "Cashier",
    ];

    const rows = report.ordersList.map((o: any) => [
      o.orderNumber,
      new Date(o.createdAt).toISOString(),
      o.orderType,
      o.subtotal,
      o.discountAmount,
      o.taxAmount,
      o.deliveryCharge,
      o.grandTotal,
      o.status,
      o.paymentStatus,
      o.cashier?.name || "System",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e: any[]) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `fork_and_fire_sales_report_${range}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const kpis = report?.kpis || {};

  return (
    <div className="flex flex-col h-full w-full bg-[#0c0d10] overflow-y-auto text-zinc-100 p-6 space-y-6">
      {/* Report Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wider text-white">
              FINANCIAL & SALES REPORTS
            </h1>
            <p className="text-xs text-zinc-400">
              Audited PostgreSQL sales, cashier, and tax reports
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Range Selector */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold">
            {[
              { id: "today", label: "Today" },
              { id: "7days", label: "7 Days" },
              { id: "30days", label: "30 Days" },
              { id: "all", label: "All Time" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setRange(item.id)}
                className={`py-1.5 px-3 rounded-lg transition-colors ${
                  range === item.id
                    ? "bg-orange-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-xs flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5 text-orange-400" />
            CSV Export
          </Button>

          <Button
            variant="fire"
            size="sm"
            onClick={handlePrint}
            className="text-xs flex items-center gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-zinc-800 bg-[#13141b]">
          <span className="text-xs text-zinc-400 font-bold">Total Sales</span>
          <div className="text-2xl font-black text-white mt-1">
            {formatCurrency(kpis.totalSales || 0)}
          </div>
          <span className="text-[11px] text-zinc-500">
            {kpis.totalOrders || 0} orders
          </span>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-800 bg-[#13141b]">
          <span className="text-xs text-zinc-400 font-bold">Avg Order Value</span>
          <div className="text-2xl font-black text-blue-400 mt-1">
            {formatCurrency(kpis.avgOrderValue || 0)}
          </div>
          <span className="text-[11px] text-zinc-500">Average ticket size</span>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-800 bg-[#13141b]">
          <span className="text-xs text-zinc-400 font-bold">GST Tax Collected</span>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {formatCurrency(kpis.totalTax || 0)}
          </div>
          <span className="text-[11px] text-zinc-500">Government sales tax</span>
        </div>

        <div className="p-4 rounded-2xl border border-zinc-800 bg-[#13141b]">
          <span className="text-xs text-zinc-400 font-bold">Cancelled / Void</span>
          <div className="text-2xl font-black text-zinc-400 mt-1">
            {kpis.cancelledOrders || 0}
          </div>
          <span className="text-[11px] text-zinc-500">Voided orders count</span>
        </div>
      </div>

      {/* DETAILED TABLES: PAYMENT METHODS & CASHIERS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Payment Methods Breakdown */}
        <div className="rounded-2xl border border-zinc-800 bg-[#13141b] p-5">
          <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-orange-400" />
            Tender / Payment Method Breakdown
          </h3>
          <div className="divide-y divide-zinc-800 text-xs">
            {(report?.paymentMethods || []).map((p: any, idx: number) => (
              <div key={idx} className="py-2.5 flex justify-between items-center">
                <span className="font-semibold text-zinc-300">{p.name}</span>
                <span className="font-mono font-bold text-white">
                  {formatCurrency(p.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Cashier Performance Breakdown */}
        <div className="rounded-2xl border border-zinc-800 bg-[#13141b] p-5">
          <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-orange-400" />
            Cashier Performance Summary
          </h3>
          <div className="divide-y divide-zinc-800 text-xs">
            {(!report?.cashierSales || report.cashierSales.length === 0) ? (
              <div className="text-zinc-500 py-4 text-center">No transactions recorded</div>
            ) : (
              report.cashierSales.map((c: any, idx: number) => (
                <div key={idx} className="py-2.5 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-zinc-200">{c.name}</span>
                    <span className="text-[10px] text-zinc-500 ml-2">
                      ({c.orders} orders)
                    </span>
                  </div>
                  <span className="font-mono font-bold text-orange-400">
                    {formatCurrency(c.sales)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* TOP PRODUCTS BREAKDOWN */}
      <div className="rounded-2xl border border-zinc-800 bg-[#13141b] p-5">
        <h3 className="font-bold text-sm text-white mb-3">
          Top Selling Menu Items & Revenue Contribution
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-[#181922] text-zinc-400 font-bold border-b border-zinc-800 uppercase text-[10px]">
              <tr>
                <th className="p-3">Rank</th>
                <th className="p-3">Product Name</th>
                <th className="p-3">Units Sold</th>
                <th className="p-3 text-right">Revenue Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {(report?.topProducts || []).map((prod: any, idx: number) => (
                <tr key={idx} className="hover:bg-zinc-800/40">
                  <td className="p-3 font-mono font-bold text-zinc-500">#{idx + 1}</td>
                  <td className="p-3 font-semibold text-white">{prod.name}</td>
                  <td className="p-3 font-mono text-zinc-300">{prod.quantity}</td>
                  <td className="p-3 font-mono font-bold text-orange-400 text-right">
                    {formatCurrency(prod.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

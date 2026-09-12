"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  CheckCircle2,
  Clock,
  Ban,
  Wallet,
  ArrowUpRight,
  Flame,
  Calendar,
  Layers,
  Award,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAsyncLoad } from "@/lib/hooks/useAsyncLoad";

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#a855f7", "#f59e0b"];

export default function DashboardPage() {
  const [range, setRange] = React.useState("today");
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchDashboard = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reports?range=${range}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useAsyncLoad(fetchDashboard);

  const kpis = data?.kpis || {
    totalSales: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    completedOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    totalTax: 0,
    netIncome: 0,
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0c0d10] overflow-y-auto text-zinc-100 p-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600/20 text-orange-400 border border-orange-500/30">
            <Flame className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wider text-white">
              FORK & FIRE DASHBOARD
            </h1>
            <p className="text-xs text-zinc-400">
              Live restaurant performance & financial metrics
            </p>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold">
          {[
            { id: "today", label: "Today" },
            { id: "7days", label: "Last 7 Days" },
            { id: "30days", label: "Last 30 Days" },
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
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Sales */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="rounded-2xl border border-zinc-800 bg-[#14151c] p-4 flex flex-col justify-between shadow-sm relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400">Gross Sales</span>
            <div className="h-8 w-8 rounded-lg bg-orange-600/20 text-orange-400 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              {formatCurrency(kpis.totalSales)}
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
              <ArrowUpRight className="h-3 w-3" />
              <span>Real-time PostgreSQL</span>
            </div>
          </div>
        </motion.div>

        {/* Total Orders */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="rounded-2xl border border-zinc-800 bg-[#14151c] p-4 flex flex-col justify-between shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400">Total Orders</span>
            <div className="h-8 w-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">{kpis.totalOrders}</div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Completed: {kpis.completedOrders} • Pending: {kpis.pendingOrders}
            </div>
          </div>
        </motion.div>

        {/* Average Order Value (AOV) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="rounded-2xl border border-zinc-800 bg-[#14151c] p-4 flex flex-col justify-between shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400">Avg Order Value</span>
            <div className="h-8 w-8 rounded-lg bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              {formatCurrency(kpis.avgOrderValue)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">Per transaction</div>
          </div>
        </motion.div>

        {/* Tax Collected */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="rounded-2xl border border-zinc-800 bg-[#14151c] p-4 flex flex-col justify-between shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400">Tax Collected (GST)</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-400">
              {formatCurrency(kpis.totalTax)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Calculated at POS checkout
            </div>
          </div>
        </motion.div>
      </div>

      {/* CHARTS GRID 1: HOURLY & DAILY SALES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hourly Sales Curve */}
        <div className="rounded-2xl border border-zinc-800 bg-[#13141b] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-white">Hourly Sales Curve</h3>
              <p className="text-[11px] text-zinc-400">
                Peak fast-food lunch & dinner hours
              </p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.hourlySales || []}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="hour" stroke="#52525b" fontSize={10} tickLine={false} />
                <YAxis
                  stroke="#52525b"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(v) => `Rs.${v >= 1000 ? `${v / 1000}k` : v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderColor: "#3f3f46",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "#ffffff",
                  }}
                  formatter={(val: any) => [`Rs. ${Number(val).toLocaleString()}`, "Sales"]}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#f97316"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorSales)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Sales Trend */}
        <div className="rounded-2xl border border-zinc-800 bg-[#13141b] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-white">Daily Revenue Trend</h3>
              <p className="text-[11px] text-zinc-400">Recent 7 days revenue</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.dailySales || []}>
                <XAxis dataKey="date" stroke="#52525b" fontSize={10} tickLine={false} />
                <YAxis
                  stroke="#52525b"
                  fontSize={10}
                  tickLine={false}
                  tickFormatter={(v) => `Rs.${v >= 1000 ? `${v / 1000}k` : v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderColor: "#3f3f46",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "#ffffff",
                  }}
                  formatter={(val: any) => [`Rs. ${Number(val).toLocaleString()}`, "Revenue"]}
                />
                <Bar dataKey="sales" fill="#ea580c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* CHARTS GRID 2: TOP PRODUCTS & ORDER TYPES */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Selling Products */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-[#13141b] p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Award className="h-4 w-4 text-orange-400" />
                Best-Selling Menu Items
              </h3>
              <p className="text-[11px] text-zinc-400">
                Top items ranked by units sold
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {(!data?.topProducts || data.topProducts.length === 0) ? (
              <div className="text-zinc-500 text-xs py-10 text-center">
                Create orders from POS to populate top products
              </div>
            ) : (
              data.topProducts.map((p: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-800 font-bold text-zinc-400 font-mono text-[11px]">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-zinc-200">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-zinc-400 font-mono">{p.quantity} sold</span>
                    <span className="font-bold text-orange-400 min-w-[80px] text-right">
                      {formatCurrency(p.revenue)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Order Types Breakdown */}
        <div className="rounded-2xl border border-zinc-800 bg-[#13141b] p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-white">Order Channels</h3>
            <p className="text-[11px] text-zinc-400">Dine-in vs Delivery mix</p>
          </div>

          <div className="h-52 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.orderTypes || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                >
                  {(data?.orderTypes || []).map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    borderColor: "#3f3f46",
                    borderRadius: 12,
                    fontSize: 12,
                    color: "#ffffff",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-zinc-800">
            {(data?.orderTypes || []).map((t: any, idx: number) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                />
                <span className="text-zinc-400 capitalize">{t.name}:</span>
                <span className="font-bold text-white">{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

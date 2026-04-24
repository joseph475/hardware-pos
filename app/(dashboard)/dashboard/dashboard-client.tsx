"use client";

import * as React from "react";
import {
  DollarSign,
  ShoppingBag,
  Package,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrency } from "@/lib/context/currency";
import type { DashboardData } from "@/lib/actions/reports";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcTrend(today: number, yesterday: number): number {
  if (yesterday === 0) return today > 0 ? 100 : 0;
  return Math.round(((today - yesterday) / yesterday) * 1000) / 10;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TrendBadge({ trend }: { trend: number }) {
  const positive = trend >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        positive
          ? "bg-emerald-500/10 text-emerald-400"
          : "bg-red-500/10 text-red-400"
      }`}
    >
      {positive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {positive ? "+" : ""}
      {trend}%
    </span>
  );
}

function PaymentBadge({ method }: { method: string }) {
  const styles: Record<string, string> = {
    cash: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    card: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    split: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    gcash: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    maya: "bg-green-500/10 text-green-400 border-green-500/20",
  };
  const label = method.charAt(0).toUpperCase() + method.slice(1);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${styles[method] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}
    >
      {label}
    </span>
  );
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function makeTooltip(formatCurrency: (v: number) => string) {
  return function CustomTooltip({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: { value: number }[];
    label?: string;
  }) {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 shadow-xl">
          <p className="text-xs font-medium text-zinc-400">{label}</p>
          <p className="text-sm font-semibold text-zinc-100">
            {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };
}

const PAYMENT_COLORS: Record<string, string> = {
  cash:  "oklch(0.6 0 0)",
  card:  "oklch(0.6 0.2 230)",
  split: "oklch(0.6 0.2 290)",
  gcash: "oklch(0.6 0.2 210)",
  maya:  "oklch(0.6 0.2 145)",
};

function paymentLabel(method: string): string {
  const map: Record<string, string> = {
    cash: "Cash", card: "Card", split: "Split", gcash: "GCash", maya: "Maya",
  };
  return map[method] ?? method;
}

// ─── Main client component ────────────────────────────────────────────────────

export function DashboardClient({ data }: { data: DashboardData }) {
  const { formatCurrency, currencySymbol } = useCurrency();
  const CustomTooltip = React.useMemo(() => makeTooltip(formatCurrency), [formatCurrency]);

  const revenueTrend = calcTrend(data.todayRevenue, data.yesterdayRevenue);
  const txTrend = calcTrend(data.transactionCount, data.yesterdayTransactionCount);
  const itemsTrend = calcTrend(data.itemsSold, data.yesterdayItemsSold);

  const STATS = [
    {
      label: "Today's Sales",
      value: formatCurrency(data.todayRevenue),
      trend: revenueTrend,
      icon: DollarSign,
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-400",
    },
    {
      label: "Total Transactions",
      value: data.transactionCount.toLocaleString(),
      trend: txTrend,
      icon: ShoppingBag,
      iconBg: "bg-violet-500/10",
      iconColor: "text-violet-400",
    },
    {
      label: "Items Sold",
      value: data.itemsSold.toLocaleString(),
      trend: itemsTrend,
      icon: Package,
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-400",
    },
    {
      label: "Active Products",
      value: data.activeProducts.toLocaleString(),
      trend: null,
      icon: Activity,
      iconBg: "bg-amber-500/10",
      iconColor: "text-amber-400",
    },
  ];

  const totalPaymentRevenue = data.paymentMethods.reduce((s, p) => s + p.total, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page heading */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground" suppressHydrationWarning>
          Overview for today —{" "}
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {stat.label}
                    </span>
                    <span className="text-2xl font-bold tracking-tight text-foreground">
                      {stat.value}
                    </span>
                    {stat.trend !== null ? (
                      <TrendBadge trend={stat.trend} />
                    ) : (
                      <span className="text-xs text-muted-foreground/60">
                        all time
                      </span>
                    )}
                  </div>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.iconBg}`}
                  >
                    <Icon className={`h-5 w-5 ${stat.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Middle row: transactions + low stock */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Recent transactions */}
        <Card className="xl:col-span-2">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>
              {data.recentTransactions.length > 0
                ? `Last ${data.recentTransactions.length} transactions today`
                : "No transactions today yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentTransactions.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No completed transactions today
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b-0 hover:bg-transparent">
                    <TableHead className="pl-4 text-xs">Time</TableHead>
                    <TableHead className="text-xs">Cashier</TableHead>
                    <TableHead className="text-xs text-right">Items</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    <TableHead className="pr-4 text-xs">Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentTransactions.map((tx) => (
                    <TableRow key={tx.id} className="border-border/50">
                      <TableCell className="pl-4">
                        <span className="font-mono text-xs text-muted-foreground">
                          {tx.time}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium text-foreground">
                            {tx.cashier}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground/60">
                            {tx.id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {tx.items}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium text-foreground">
                        {formatCurrency(tx.total)}
                      </TableCell>
                      <TableCell className="pr-4">
                        <PaymentBadge method={tx.method} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Low stock alerts */}
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <CardTitle>Low Stock Alerts</CardTitle>
            </div>
            <CardDescription>
              {data.lowStockItems.length > 0
                ? `${data.lowStockItems.length} product${data.lowStockItems.length === 1 ? "" : "s"} below threshold`
                : "All products are well-stocked"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.lowStockItems.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                No low stock items
              </p>
            ) : (
              <div className="divide-y divide-border/50">
                {data.lowStockItems.map((item) => {
                  const pct = Math.round((item.stock / item.threshold) * 100);
                  const urgent = pct <= 25;
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-1.5 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium leading-tight text-foreground">
                            {item.name}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground/60">
                            {item.sku}
                          </span>
                        </div>
                        <span
                          className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
                            urgent ? "text-red-400" : "text-amber-400"
                          }`}
                        >
                          {item.stock}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-full rounded-full transition-all ${
                            urgent ? "bg-red-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className="h-4 border-zinc-700 px-1.5 text-[10px] text-muted-foreground"
                        >
                          {item.category}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground/60">
                          threshold: {item.threshold}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row: weekly revenue + payment mix */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* 7-day revenue trend */}
        <Card className="xl:col-span-2">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle>Weekly Revenue</CardTitle>
            <CardDescription>Last 7 days of completed sales</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {data.weeklyRevenue.every((d) => d.revenue === 0) ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No sales data for the past 7 days
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={data.weeklyRevenue}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="3 3"
                    stroke="oklch(1 0 0 / 6%)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "oklch(0.708 0 0)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                  />
                  <YAxis
                    tickFormatter={(v: number) =>
                      v === 0 ? "0" : `${currencySymbol}${(v / 1000).toFixed(0)}k`
                    }
                    tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    dx={-8}
                    width={44}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ stroke: "oklch(1 0 0 / 10%)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="oklch(0.488 0.243 264.376)"
                    strokeWidth={2}
                    dot={{ fill: "oklch(0.488 0.243 264.376)", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Today's payment method mix */}
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle>Payment Mix</CardTitle>
            <CardDescription>Today&apos;s revenue by method</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {data.paymentMethods.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No payments today
              </p>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={data.paymentMethods}
                      dataKey="total"
                      nameKey="method"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {data.paymentMethods.map((entry) => (
                        <Cell
                          key={entry.method}
                          fill={PAYMENT_COLORS[entry.method] ?? "oklch(0.6 0 0)"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const p = payload[0].payload as { method: string; total: number; count: number }
                          return (
                            <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 shadow-xl">
                              <p className="text-xs font-medium text-zinc-400">{paymentLabel(p.method)}</p>
                              <p className="text-sm font-semibold text-zinc-100">{formatCurrency(p.total)}</p>
                              <p className="text-xs text-zinc-400">{p.count} txn{p.count !== 1 ? "s" : ""}</p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend */}
                <div className="w-full space-y-1.5">
                  {data.paymentMethods.map((pm) => {
                    const pct = totalPaymentRevenue > 0
                      ? Math.round((pm.total / totalPaymentRevenue) * 100)
                      : 0
                    return (
                      <div key={pm.method} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ background: PAYMENT_COLORS[pm.method] ?? "oklch(0.6 0 0)" }}
                          />
                          <span className="text-muted-foreground">{paymentLabel(pm.method)}</span>
                        </div>
                        <div className="flex items-center gap-2 tabular-nums">
                          <span className="text-foreground font-medium">{formatCurrency(pm.total)}</span>
                          <span className="text-muted-foreground/60 w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sales by branch chart */}
      {data.branchSales.length > 0 && (
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle>Sales by Branch</CardTitle>
            <CardDescription>Today&apos;s revenue across all branches</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.branchSales}
                margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                barSize={40}
              >
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="oklch(1 0 0 / 6%)"
                />
                <XAxis
                  dataKey="branch"
                  tick={{ fill: "oklch(0.708 0 0)", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  dy={8}
                />
                <YAxis
                  tickFormatter={(v: number) =>
                    `${currencySymbol}${(v / 1000).toFixed(0)}k`
                  }
                  tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  dx={-8}
                  width={44}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "oklch(1 0 0 / 4%)" }}
                />
                <Bar
                  dataKey="revenue"
                  fill="oklch(0.488 0.243 264.376)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

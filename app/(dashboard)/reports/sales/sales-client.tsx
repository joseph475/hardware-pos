"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, ShoppingCart, CreditCard, Package, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrency } from "@/lib/context/currency";
import { getSalesReport, type SalesReportData } from "@/lib/actions/reports";

const DATE_RANGES = ["Today", "This Week", "This Month"] as const;
type DateRange = (typeof DATE_RANGES)[number];

const RANGE_MAP: Record<DateRange, string> = {
  Today: "today",
  "This Week": "week",
  "This Month": "month",
};

const METHOD_CONFIG: Record<string, string> = {
  card: "bg-blue-500/15 text-blue-500 border-transparent",
  cash: "bg-emerald-500/15 text-emerald-500 border-transparent",
  split: "bg-violet-500/15 text-violet-500 border-transparent",
};

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => JSON.stringify(v ?? "");
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Custom tooltip — created via factory so formatCurrency is in scope
// ---------------------------------------------------------------------------
function makeTooltip(formatCurrency: (v: number) => string) {
  return function ChartTooltip({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: { value: number; name: string }[];
    label?: string;
  }) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md text-xs">
        <p className="font-medium text-popover-foreground mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} className="text-muted-foreground">
            {p.name === "revenue" ? formatCurrency(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  initialData: SalesReportData;
  initialRange: DateRange;
}

export default function SalesClient({ initialData, initialRange }: Props) {
  const { formatCurrency, currencyCode, locale } = useCurrency();
  const [data, setData] = React.useState<SalesReportData>(initialData);
  const [range, setRange] = React.useState<DateRange>(initialRange);
  const [loading, setLoading] = React.useState(false);

  // Compact axis formatter: e.g. $1.5K, $20K
  const formatAxis = React.useCallback(
    (v: number) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currencyCode,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(v),
    [currencyCode, locale]
  );

  async function handleRangeChange(newRange: DateRange) {
    if (newRange === range) return;
    setRange(newRange);
    setLoading(true);
    try {
      const result = await getSalesReport(RANGE_MAP[newRange]);
      setData(result);
    } finally {
      setLoading(false);
    }
  }

  const TooltipContent = React.useMemo(() => makeTooltip(formatCurrency), [formatCurrency]);

  const STAT_CARDS = [
    {
      label: "Revenue",
      value: formatCurrency(data.revenue),
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Transactions",
      value: data.transactionCount.toLocaleString(),
      icon: ShoppingCart,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Avg. Order Value",
      value: formatCurrency(data.avgOrderValue),
      icon: CreditCard,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      label: "Items Sold",
      value: data.itemsSold.toLocaleString(),
      icon: Package,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
  ];

  const tooltip = <Tooltip content={<TooltipContent />} />;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Sales Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Performance overview across all branches
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {DATE_RANGES.map((r) => (
            <Button
              key={r}
              variant={range === r ? "default" : "ghost"}
              size="sm"
              className="h-6 text-xs"
              onClick={() => handleRangeChange(r)}
              disabled={loading}
            >
              {r}
            </Button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          : STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
              <Card key={label}>
                <CardContent className="flex items-center gap-3 py-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bg}`}
                  >
                    <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-foreground truncate">
                      {value}
                    </p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Line chart — Daily Revenue */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-medium">
              Daily Revenue ({range})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-56 w-full rounded-md" />
            ) : data.dailyRevenue.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                No transactions in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={data.dailyRevenue}
                  margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    strokeOpacity={0.4}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatAxis}
                    width={60}
                  />
                  {tooltip}
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bar chart — Top 5 Products */}
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-medium">Top 5 Products</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <Skeleton className="h-56 w-full rounded-md" />
            ) : data.topProducts.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                No sales in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data.topProducts}
                  layout="vertical"
                  margin={{ top: 0, right: 8, bottom: 0, left: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    strokeOpacity={0.4}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatAxis}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  {tooltip}
                  <Bar
                    dataKey="revenue"
                    fill="var(--primary)"
                    radius={[0, 4, 4, 0]}
                    opacity={0.85}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transactions + branch comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Transactions table */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Recent Transactions
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={loading || data.recentTransactions.length === 0}
              onClick={() => {
                downloadCSV(
                  data.recentTransactions.map((t) => ({
                    receipt_id: t.id,
                    branch: t.branch,
                    cashier: t.cashier,
                    items: t.items,
                    total: t.total,
                    payment_method: t.method,
                    time: t.time,
                  })),
                  `sales-report.csv`
                );
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export CSV
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-md" />
                ))}
              </div>
            ) : data.recentTransactions.length === 0 ? (
              <div className="py-12 flex items-center justify-center text-sm text-muted-foreground">
                No transactions in this period
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="pl-4">ID</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="pr-4">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentTransactions.map((txn) => (
                    <TableRow
                      key={txn.id}
                      className="border-b border-border/50"
                    >
                      <TableCell className="pl-4 font-mono text-xs text-foreground">
                        {txn.id}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {txn.branch}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {txn.cashier}
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                        {txn.items}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {formatCurrency(txn.total)}
                      </TableCell>
                      <TableCell>
                        <Badge className={METHOD_CONFIG[txn.method] ?? ""}>
                          {txn.method.charAt(0).toUpperCase() +
                            txn.method.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-4 font-mono text-xs text-muted-foreground">
                        {txn.time}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Branch comparison */}
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-medium">
              Branch Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-md" />
              ))
            ) : data.branchComparison.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No data for this period
              </p>
            ) : (
              (() => {
                const maxRevenue = Math.max(
                  ...data.branchComparison.map((x) => x.revenue)
                );
                const BAR_COLORS = [
                  "bg-primary",
                  "bg-blue-500",
                  "bg-violet-500",
                  "bg-amber-500",
                  "bg-rose-500",
                ];
                return data.branchComparison.map((b, i) => {
                  const pct =
                    maxRevenue > 0
                      ? Math.round((b.revenue / maxRevenue) * 100)
                      : 0;
                  return (
                    <div key={b.branch} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-foreground">
                          {b.branch}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {formatCurrency(b.revenue)}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {b.transactions} transactions
                      </p>
                    </div>
                  );
                });
              })()
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

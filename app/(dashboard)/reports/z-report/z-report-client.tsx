"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { Printer, TrendingUp, ShoppingCart, Clock, CalendarRange, CreditCard, Package, Download } from "lucide-react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { getSalesReading, getSalesReport, type SalesReadingData, type SalesReportData } from "@/lib/actions/reports"
import { useCurrency } from "@/lib/context/currency"
import { formatNumber } from "@/lib/format"

type Mode = "z-reading" | "x-reading" | "all-time"

function paymentLabel(method: string): string {
  const map: Record<string, string> = {
    cash: "Cash", card: "Card", split: "Split", gcash: "GCash", maya: "Maya",
  }
  return map[method] ?? method
}

function formatHour(hour: number): string {
  if (hour === 0) return "12am"
  if (hour < 12) return `${hour}am`
  if (hour === 12) return "12pm"
  return `${hour - 12}pm`
}

function formatDateShort(dateStr: string): string {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const [, m, d] = dateStr.split("-").map(Number)
  return `${months[m - 1]} ${d}`
}

// ─── Print content ────────────────────────────────────────────────────────────

function PrintContent({
  mode,
  data,
  date,
  dateFrom,
  dateTo,
  formatCurrency,
}: {
  mode: Mode
  data: SalesReadingData
  date: string
  dateFrom: string
  dateTo: string
  formatCurrency: (v: number) => string
}) {
  const header = mode === "z-reading" ? "Z-READING" : mode === "x-reading" ? "X-READING" : "ALL-TIME READING"
  const subHeader =
    mode === "z-reading"
      ? `End-of-Day Summary — ${date}`
      : mode === "x-reading"
      ? `Date Range Summary — ${dateFrom} to ${dateTo}`
      : "All Sales — Full History"

  return (
    <div id="z-report-print">
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontWeight: "bold", fontSize: 18, letterSpacing: 2 }}>{header}</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>{subHeader}</div>
      </div>

      <hr style={{ borderTop: "1px solid #000", margin: "12px 0" }} />

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
        <tbody>
          <tr><td>Total Sales</td><td style={{ textAlign: "right" }}>{data.salesCount}</td></tr>
          <tr><td>Total Revenue</td><td style={{ textAlign: "right" }}>{formatCurrency(data.totalRevenue)}</td></tr>
          {data.avgTransactionValue > 0 && (
            <tr><td>Avg Transaction</td><td style={{ textAlign: "right" }}>{formatCurrency(data.avgTransactionValue)}</td></tr>
          )}
          <tr><td>Total Discounts</td><td style={{ textAlign: "right" }}>{formatCurrency(data.totalDiscounts)}</td></tr>
          <tr><td>Voided Transactions</td><td style={{ textAlign: "right" }}>{data.voidCount}</td></tr>
          {data.voidedTotal > 0 && (
            <tr><td>Voided Amount</td><td style={{ textAlign: "right" }}>{formatCurrency(data.voidedTotal)}</td></tr>
          )}
        </tbody>
      </table>

      <hr style={{ borderTop: "1px solid #000", margin: "12px 0" }} />

      <div style={{ fontWeight: "bold", marginBottom: 6 }}>PAYMENT METHOD BREAKDOWN</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #999" }}>
            <th style={{ textAlign: "left", paddingBottom: 4 }}>Method</th>
            <th style={{ textAlign: "center", paddingBottom: 4 }}>Txns</th>
            <th style={{ textAlign: "right", paddingBottom: 4 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {data.byPaymentMethod.map((row) => (
            <tr key={row.method}>
              <td style={{ padding: "3px 0" }}>{paymentLabel(row.method)}</td>
              <td style={{ textAlign: "center" }}>{row.count}</td>
              <td style={{ textAlign: "right" }}>{formatCurrency(row.total)}</td>
            </tr>
          ))}
          <tr style={{ borderTop: "1px solid #000", fontWeight: "bold" }}>
            <td style={{ paddingTop: 4 }}>GRAND TOTAL</td>
            <td style={{ textAlign: "center", paddingTop: 4 }}>{data.salesCount}</td>
            <td style={{ textAlign: "right", paddingTop: 4 }}>{formatCurrency(data.totalRevenue)}</td>
          </tr>
        </tbody>
      </table>

      {mode === "z-reading" && data.hourlyBreakdown.length > 0 && (
        <>
          <hr style={{ borderTop: "1px solid #000", margin: "12px 0" }} />
          <div style={{ fontWeight: "bold", marginBottom: 6 }}>HOURLY BREAKDOWN</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #999" }}>
                <th style={{ textAlign: "left", paddingBottom: 4 }}>Hour</th>
                <th style={{ textAlign: "center", paddingBottom: 4 }}>Sales</th>
                <th style={{ textAlign: "right", paddingBottom: 4 }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.hourlyBreakdown.map((row) => (
                <tr key={row.hour}>
                  <td style={{ padding: "3px 0" }}>{formatHour(row.hour)}</td>
                  <td style={{ textAlign: "center" }}>{row.count}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {mode === "x-reading" && data.dailyBreakdown.length > 0 && (
        <>
          <hr style={{ borderTop: "1px solid #000", margin: "12px 0" }} />
          <div style={{ fontWeight: "bold", marginBottom: 6 }}>DAILY BREAKDOWN</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #999" }}>
                <th style={{ textAlign: "left", paddingBottom: 4 }}>Date</th>
                <th style={{ textAlign: "center", paddingBottom: 4 }}>Sales</th>
                <th style={{ textAlign: "right", paddingBottom: 4 }}>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.dailyBreakdown.map((row) => (
                <tr key={row.date}>
                  <td style={{ padding: "3px 0" }}>{row.date}</td>
                  <td style={{ textAlign: "center" }}>{row.count}</td>
                  <td style={{ textAlign: "right" }}>{formatCurrency(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <hr style={{ borderTop: "1px solid #000", margin: "12px 0" }} />
      <div style={{ textAlign: "center", fontSize: 10, color: "#666" }}>
        Printed {new Date().toLocaleString()}
      </div>
    </div>
  )
}

const METHOD_CONFIG: Record<string, string> = {
  card: "bg-blue-500/15 text-blue-500 border-transparent",
  cash: "bg-emerald-500/15 text-emerald-500 border-transparent",
  split: "bg-violet-500/15 text-violet-500 border-transparent",
}

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => JSON.stringify(v ?? "")
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main client component ────────────────────────────────────────────────────

const EMPTY_ANALYTICS: SalesReportData = {
  revenue: 0,
  transactionCount: 0,
  avgOrderValue: 0,
  itemsSold: 0,
  dailyRevenue: [],
  topProducts: [],
  recentTransactions: [],
  branchComparison: [],
}

export function ZReportClient({
  initialData,
  initialDate,
  userBranchId,
}: {
  initialData: SalesReadingData
  initialDate: string
  userBranchId?: string | null
}) {
  const { formatCurrency, currencySymbol, currencyCode, locale } = useCurrency()
  const [mode, setMode] = React.useState<Mode>("z-reading")
  const [data, setData] = React.useState(initialData)
  const [date, setDate] = React.useState(initialDate)
  const [dateFrom, setDateFrom] = React.useState(initialDate)
  const [dateTo, setDateTo] = React.useState(initialDate)
  const [isPending, startTransition] = React.useTransition()
  const [mounted, setMounted] = React.useState(false)

  const [analyticsData, setAnalyticsData] = React.useState<SalesReportData>(EMPTY_ANALYTICS)
  const [analyticsLoading, setAnalyticsLoading] = React.useState(true)

  const formatAxis = React.useCallback(
    (v: number) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currencyCode,
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(v),
    [currencyCode, locale]
  )

  React.useEffect(() => {
    setMounted(true)
    // Initial analytics fetch on the client after hydration
    const from = `${initialDate}T00:00:00.000Z`
    const to = `${initialDate}T23:59:59.999Z`
    getSalesReport("day", userBranchId, from, to)
      .then(setAnalyticsData)
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function fetchData(m: Mode, d: string, from: string, to: string) {
    const analyticsFrom = m === "all-time" ? null : m === "z-reading" ? `${d}T00:00:00.000Z` : `${from}T00:00:00.000Z`
    const analyticsTo = m === "all-time" ? null : m === "z-reading" ? `${d}T23:59:59.999Z` : `${to}T23:59:59.999Z`
    startTransition(async () => {
      try {
        const [readingResult, analyticsResult] = await Promise.all([
          getSalesReading({
            mode: m,
            date: m === "z-reading" ? d : undefined,
            date_from: m === "x-reading" ? from : undefined,
            date_to: m === "x-reading" ? to : undefined,
            branch_id: userBranchId,
          } as Parameters<typeof getSalesReading>[0]),
          getSalesReport(m === "all-time" ? "all-time" : "custom", userBranchId, analyticsFrom, analyticsTo),
        ])
        setData(readingResult)
        setAnalyticsData(analyticsResult)
      } catch (err) {
        toast.error("Failed to load report", {
          description: err instanceof Error ? err.message : "Something went wrong",
        })
      }
    })
  }

  function switchMode(m: Mode) {
    setMode(m)
    fetchData(m, date, dateFrom, dateTo)
  }

  const hasData = data.salesCount > 0

  const hourlyChartData = Array.from({ length: 24 }, (_, h) => {
    const found = data.hourlyBreakdown.find((e) => e.hour === h)
    return { label: formatHour(h), revenue: found?.revenue ?? 0, count: found?.count ?? 0 }
  })

  const dailyChartData = data.dailyBreakdown.map((d) => ({
    label: formatDateShort(d.date),
    revenue: d.revenue,
    count: d.count,
  }))

  const chartData = mode === "z-reading" ? hourlyChartData : dailyChartData
  const isDaily = mode !== "z-reading"
  const hasChart = chartData.some((d) => d.revenue > 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sales Reading</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {mode === "z-reading"
              ? "End-of-day summary for a single date"
              : mode === "x-reading"
              ? "Aggregate summary over a date range"
              : "All sales from the beginning to today"}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden self-start">
          {(["z-reading", "x-reading", "all-time"] as const).map((m, i) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${i > 0 ? "border-l border-border" : ""} ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "z-reading" ? "Z-Reading" : m === "x-reading" ? "X-Reading" : "All Time"}
            </button>
          ))}
        </div>
      </div>

      {/* Date controls */}
      <div className="flex flex-wrap items-end gap-3">
        {mode === "all-time" ? null : mode === "z-reading" ? (
          <div className="space-y-1">
            <Label htmlFor="report-date" className="text-xs">Date</Label>
            <Input
              id="report-date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                fetchData("z-reading", e.target.value, dateFrom, dateTo)
              }}
              className="h-9 w-40 [color-scheme:dark]"
            />
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <Label htmlFor="date-from" className="text-xs">From</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 w-40 [color-scheme:dark]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="date-to" className="text-xs">To</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 w-40 [color-scheme:dark]"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => fetchData("x-reading", date, dateFrom, dateTo)}
            >
              Apply
            </Button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => {
            document.body.setAttribute("data-printing", mode)
            window.print()
            document.body.removeAttribute("data-printing")
          }}
        >
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        {isPending && <span className="text-xs text-muted-foreground self-end pb-2">Loading…</span>}
      </div>

      {/* ── Sales Analytics ── */}
      <div className="space-y-5">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(isPending || analyticsLoading)
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            : [
                { label: "Revenue", value: formatCurrency(analyticsData.revenue), icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                { label: "Transactions", value: formatNumber(analyticsData.transactionCount), icon: ShoppingCart, color: "text-blue-500", bg: "bg-blue-500/10" },
                { label: "Avg. Order Value", value: formatCurrency(analyticsData.avgOrderValue), icon: CreditCard, color: "text-violet-500", bg: "bg-violet-500/10" },
                { label: "Items Sold", value: formatNumber(analyticsData.itemsSold), icon: Package, color: "text-amber-500", bg: "bg-amber-500/10" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <Card key={label}>
                  <CardContent className="flex items-center gap-3 py-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                      <Icon className={`h-5 w-5 ${color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg font-semibold text-foreground truncate">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-medium">Daily Revenue</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {(isPending || analyticsLoading) ? (
                <Skeleton className="h-56 w-full rounded-md" />
              ) : analyticsData.dailyRevenue.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">No transactions in this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={analyticsData.dailyRevenue} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={formatAxis} width={60} />
                    <Tooltip content={({ active, payload, label: lbl }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md text-xs">
                          <p className="font-medium text-popover-foreground mb-1">{lbl}</p>
                          <p className="text-muted-foreground">{formatCurrency(payload[0].value as number)}</p>
                        </div>
                      )
                    }} />
                    <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-medium">Top 5 Products</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {(isPending || analyticsLoading) ? (
                <Skeleton className="h-56 w-full rounded-md" />
              ) : analyticsData.topProducts.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">No sales in this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analyticsData.topProducts} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} tickFormatter={formatAxis} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={110} />
                    <Tooltip content={({ active, payload, label: lbl }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-md text-xs">
                          <p className="font-medium text-popover-foreground mb-1">{lbl}</p>
                          <p className="text-muted-foreground">{formatCurrency(payload[0].value as number)}</p>
                        </div>
                      )
                    }} />
                    <Bar dataKey="revenue" fill="var(--primary)" radius={[0, 4, 4, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent transactions + branch comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHeader className="border-b border-border pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={isPending || analyticsLoading || analyticsData.recentTransactions.length === 0}
                onClick={() => downloadCSV(
                  analyticsData.recentTransactions.map((t) => ({
                    receipt_id: t.id, branch: t.branch, cashier: t.cashier, items: t.items, total: t.total, payment_method: t.method, time: t.time,
                  })),
                  "sales-report.csv"
                )}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {isPending ? (
                <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-md" />)}</div>
              ) : analyticsData.recentTransactions.length === 0 ? (
                <div className="py-12 flex items-center justify-center text-sm text-muted-foreground">No transactions in this period</div>
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
                    {analyticsData.recentTransactions.map((txn) => (
                      <TableRow key={txn.id} className="border-b border-border/50">
                        <TableCell className="pl-4 font-mono text-xs text-foreground">{txn.id}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{txn.branch}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{txn.cashier}</TableCell>
                        <TableCell className="text-center text-sm tabular-nums text-muted-foreground">{txn.items}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">{formatCurrency(txn.total)}</TableCell>
                        <TableCell>
                          <Badge className={METHOD_CONFIG[txn.method] ?? ""}>{txn.method.charAt(0).toUpperCase() + txn.method.slice(1)}</Badge>
                        </TableCell>
                        <TableCell className="pr-4 font-mono text-xs text-muted-foreground">{txn.time}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-sm font-medium">Branch Comparison</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {isPending ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-md" />)
              ) : analyticsData.branchComparison.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No data for this period</p>
              ) : (
                (() => {
                  const maxRevenue = Math.max(...analyticsData.branchComparison.map((x) => x.revenue))
                  const BAR_COLORS = ["bg-primary", "bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-rose-500"]
                  return analyticsData.branchComparison.map((b, i) => {
                    const pct = maxRevenue > 0 ? Math.round((b.revenue / maxRevenue) * 100) : 0
                    return (
                      <div key={b.branch} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-foreground">{b.branch}</span>
                          <span className="font-mono text-muted-foreground">{formatCurrency(b.revenue)}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground">{b.transactions} transactions</p>
                      </div>
                    )
                  })
                })()
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment method breakdown */}
        {hasData && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Payment Method Breakdown</h2>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-center">Transactions</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byPaymentMethod.map((row) => (
                    <TableRow key={row.method}>
                      <TableCell className="font-medium">{paymentLabel(row.method)}</TableCell>
                      <TableCell className="text-center">{row.count}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatCurrency(row.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell>Grand Total</TableCell>
                    <TableCell className="text-center">{data.salesCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(data.totalRevenue)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Hourly / Daily breakdown chart */}
        {hasData && hasChart && (
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <div className="flex items-center gap-2">
                {isDaily ? (
                  <CalendarRange className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                )}
                <CardTitle className="text-sm font-semibold">
                  {isDaily ? "Daily Breakdown" : "Hourly Breakdown"}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={chartData}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  barSize={isDaily ? undefined : 14}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "oklch(0.708 0 0)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    dy={6}
                    interval={isDaily ? 0 : 1}
                    angle={isDaily && chartData.length > 10 ? -45 : 0}
                    textAnchor={isDaily && chartData.length > 10 ? "end" : "middle"}
                  />
                  <YAxis
                    tickFormatter={(v: number) =>
                      v === 0 ? "0" : `${currencySymbol}${(v / 1000).toFixed(0)}k`
                    }
                    tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    dx={-4}
                    width={40}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const entry = chartData.find((d) => d.label === label)
                        return (
                          <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 shadow-xl">
                            <p className="text-xs font-medium text-zinc-400">{label}</p>
                            <p className="text-sm font-semibold text-zinc-100">
                              {formatCurrency(payload[0].value as number)}
                            </p>
                            {entry && (
                              <p className="text-xs text-zinc-400">
                                {entry.count} sale{entry.count !== 1 ? "s" : ""}
                              </p>
                            )}
                          </div>
                        )
                      }
                      return null
                    }}
                    cursor={{ fill: "oklch(1 0 0 / 4%)" }}
                  />
                  <Bar dataKey="revenue" fill="oklch(0.488 0.243 264.376)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {mounted &&
        createPortal(
          <PrintContent
            mode={mode}
            data={data}
            date={date}
            dateFrom={dateFrom}
            dateTo={dateTo}
            formatCurrency={formatCurrency}
          />,
          document.body
        )}
    </div>
  )
}

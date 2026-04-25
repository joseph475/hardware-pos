"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { Printer, TrendingUp, ShoppingCart, Tag, Ban, Clock, CalendarRange } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { getSalesReading, type SalesReadingData } from "@/lib/actions/reports"
import { useCurrency } from "@/lib/context/currency"

type Mode = "z-reading" | "x-reading"

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  accent?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <p className={`text-2xl font-bold tabular-nums ${accent ? "text-primary" : "text-foreground"}`}>
          {value}
        </p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

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
  const header = mode === "z-reading" ? "Z-READING" : "X-READING"
  const subHeader =
    mode === "z-reading"
      ? `End-of-Day Summary — ${date}`
      : `Date Range Summary — ${dateFrom} to ${dateTo}`

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

// ─── Main client component ────────────────────────────────────────────────────

export function ZReportClient({
  initialData,
  initialDate,
  userBranchId,
}: {
  initialData: SalesReadingData
  initialDate: string
  userBranchId?: string | null
}) {
  const { formatCurrency, currencySymbol } = useCurrency()
  const [mode, setMode] = React.useState<Mode>("z-reading")
  const [data, setData] = React.useState(initialData)
  const [date, setDate] = React.useState(initialDate)
  const [dateFrom, setDateFrom] = React.useState(initialDate)
  const [dateTo, setDateTo] = React.useState(initialDate)
  const [isPending, startTransition] = React.useTransition()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  function fetchData(m: Mode, d: string, from: string, to: string) {
    startTransition(async () => {
      try {
        const result = await getSalesReading({
          mode: m,
          date: m === "z-reading" ? d : undefined,
          date_from: m === "x-reading" ? from : undefined,
          date_to: m === "x-reading" ? to : undefined,
          branch_id: userBranchId,
        })
        setData(result)
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
  const hasChart = chartData.some((d) => d.revenue > 0)

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sales Reading</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {mode === "z-reading" ? "End-of-day summary for a single date" : "Aggregate summary over a date range"}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden self-start">
          <button
            onClick={() => switchMode("z-reading")}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              mode === "z-reading"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Z-Reading
          </button>
          <button
            onClick={() => switchMode("x-reading")}
            className={`px-4 py-1.5 text-sm font-medium transition-colors border-l border-border ${
              mode === "x-reading"
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            X-Reading
          </button>
        </div>
      </div>

      {/* Date controls */}
      <div className="flex flex-wrap items-end gap-3">
        {mode === "z-reading" ? (
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

      {/* Empty state */}
      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <div className="rounded-full bg-muted p-4">
            <ShoppingCart className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No transactions recorded</p>
          <p className="text-xs text-muted-foreground">
            {mode === "z-reading"
              ? `No completed sales were found for ${date}.`
              : "No completed sales were found for the selected date range."}
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Total Sales"
              value={String(data.salesCount)}
              sub={data.avgTransactionValue > 0 ? `avg ${formatCurrency(data.avgTransactionValue)}` : undefined}
              icon={ShoppingCart}
              accent
            />
            <StatCard
              label="Total Revenue"
              value={formatCurrency(data.totalRevenue)}
              icon={TrendingUp}
              accent
            />
            <StatCard
              label="Total Discounts"
              value={formatCurrency(data.totalDiscounts)}
              icon={Tag}
            />
            <StatCard
              label="Voided"
              value={String(data.voidCount)}
              sub={data.voidCount > 0 ? formatCurrency(data.voidedTotal) : undefined}
              icon={Ban}
            />
          </div>

          <Separator />

          {/* Payment method breakdown */}
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

          {/* Chart */}
          {hasChart && (
            <Card>
              <CardHeader className="border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  {mode === "z-reading" ? (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <CalendarRange className="h-4 w-4 text-muted-foreground" />
                  )}
                  <CardTitle className="text-sm font-semibold">
                    {mode === "z-reading" ? "Hourly Breakdown" : "Daily Breakdown"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                    barSize={mode === "z-reading" ? 14 : undefined}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "oklch(0.708 0 0)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      dy={6}
                      interval={mode === "z-reading" ? 1 : 0}
                      angle={mode === "x-reading" && chartData.length > 10 ? -45 : 0}
                      textAnchor={mode === "x-reading" && chartData.length > 10 ? "end" : "middle"}
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
        </>
      )}

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

"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"
import { Printer, TrendingUp, ShoppingCart, CreditCard, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { getSalesReading, getSalesReport, type SalesReadingData, type SalesReportData } from "@/lib/actions/reports"
import { useCurrency } from "@/lib/context/currency"
import { formatDate, formatNumber, formatTime } from "@/lib/format"

type Mode = "z-reading" | "x-reading"

function paymentLabel(method: string): string {
  const map: Record<string, string> = {
    cash: "Cash", card: "Card", split: "Split", gcash: "GCash", maya: "Maya",
  }
  return map[method] ?? method
}

// ─── Print content ────────────────────────────────────────────────────────────

function PrintContent({
  mode,
  data,
  dateFrom,
  dateTo,
  formatCurrency,
}: {
  mode: Mode
  data: SalesReadingData
  dateFrom: string
  dateTo: string
  formatCurrency: (v: number) => string
}) {
  const header = mode === "z-reading" ? "Z-READING" : "X-READING"
  const subHeader =
    mode === "z-reading"
      ? "Cumulative Summary — All Sales to Date"
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

      {data.dailyBreakdown.length > 0 && (
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

      {data.transactions.length > 0 && (
        <>
          <hr style={{ borderTop: "1px solid #000", margin: "12px 0" }} />
          <div style={{ fontWeight: "bold", marginBottom: 6 }}>TRANSACTION LIST</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #999" }}>
                <th style={{ textAlign: "left", paddingBottom: 4 }}>Ref</th>
                <th style={{ textAlign: "left", paddingBottom: 4 }}>Date</th>
                <th style={{ textAlign: "left", paddingBottom: 4 }}>Time</th>
                <th style={{ textAlign: "left", paddingBottom: 4 }}>Customer</th>
                <th style={{ textAlign: "center", paddingBottom: 4 }}>Method</th>
                <th style={{ textAlign: "center", paddingBottom: 4 }}>Items</th>
                <th style={{ textAlign: "right", paddingBottom: 4 }}>Disc</th>
                <th style={{ textAlign: "right", paddingBottom: 4 }}>Total</th>
                <th style={{ textAlign: "center", paddingBottom: 4 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t) => (
                <tr key={t.ref + t.datetime} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "2px 0", fontFamily: "monospace" }}>{t.ref}</td>
                  <td style={{ padding: "2px 4px 2px 0" }}>{formatDate(t.datetime)}</td>
                  <td style={{ padding: "2px 4px 2px 0" }}>{formatTime(t.datetime)}</td>
                  <td style={{ padding: "2px 4px 2px 0" }}>{t.customer}</td>
                  <td style={{ textAlign: "center", padding: "2px 0" }}>{paymentLabel(t.method)}</td>
                  <td style={{ textAlign: "center", padding: "2px 0" }}>{t.items}</td>
                  <td style={{ textAlign: "right", padding: "2px 0" }}>{formatCurrency(t.discount)}</td>
                  <td style={{ textAlign: "right", padding: "2px 0" }}>{formatCurrency(t.total)}</td>
                  <td style={{ textAlign: "center", padding: "2px 0", color: t.status === "voided" ? "#c00" : "inherit" }}>
                    {t.status === "voided" ? "VOID" : "OK"}
                  </td>
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
  const { formatCurrency } = useCurrency()
  const [mode, setMode] = React.useState<Mode>("z-reading")
  const [data, setData] = React.useState(initialData)
  const [dateFrom, setDateFrom] = React.useState(initialDate)
  const [dateTo, setDateTo] = React.useState(initialDate)
  const [isPending, startTransition] = React.useTransition()
  const [mounted, setMounted] = React.useState(false)

  const [analyticsData, setAnalyticsData] = React.useState<SalesReportData>(EMPTY_ANALYTICS)
  const [analyticsLoading, setAnalyticsLoading] = React.useState(true)

  React.useEffect(() => {
    setMounted(true)
    getSalesReport("all-time", userBranchId)
      .then(setAnalyticsData)
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function fetchData(m: Mode, from: string, to: string) {
    startTransition(async () => {
      try {
        const [readingResult, analyticsResult] = await Promise.all([
          getSalesReading({
            mode: m === "z-reading" ? "all-time" : "x-reading",
            date_from: m === "x-reading" ? from : undefined,
            date_to: m === "x-reading" ? to : undefined,
            branch_id: userBranchId,
          }),
          getSalesReport(
            m === "z-reading" ? "all-time" : "custom",
            userBranchId,
            m === "x-reading" ? `${from}T00:00:00.000Z` : null,
            m === "x-reading" ? `${to}T23:59:59.999Z` : null,
          ),
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
    fetchData(m, dateFrom, dateTo)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Sales Reading</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {mode === "z-reading"
              ? "Cumulative sales from the beginning until now"
              : "Sales summary for a selected date range"}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden self-start">
          {(["z-reading", "x-reading"] as const).map((m, i) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${i > 0 ? "border-l border-border" : ""} ${
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "z-reading" ? "Z-Reading" : "X-Reading"}
            </button>
          ))}
        </div>
      </div>

      {/* Date controls */}
      <div className="flex flex-wrap items-end gap-3">
        {mode === "x-reading" && (
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
              onClick={() => fetchData("x-reading", dateFrom, dateTo)}
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
            document.body.setAttribute("data-printing", "z-report")
            window.print()
            document.body.removeAttribute("data-printing")
          }}
        >
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        {isPending && <span className="text-xs text-muted-foreground self-end pb-2">Loading…</span>}
      </div>

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

      {/* Summary table */}
      {(isPending || analyticsLoading) ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-medium">Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">Total Sales</TableCell>
                  <TableCell className="text-right tabular-nums">{data.salesCount}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Total Revenue</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(data.totalRevenue)}</TableCell>
                </TableRow>
                {data.avgTransactionValue > 0 && (
                  <TableRow>
                    <TableCell className="font-medium">Avg Transaction</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(data.avgTransactionValue)}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell className="font-medium">Total Discounts</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(data.totalDiscounts)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Voided Transactions</TableCell>
                  <TableCell className="text-right tabular-nums">{data.voidCount}</TableCell>
                </TableRow>
                {data.voidedTotal > 0 && (
                  <TableRow>
                    <TableCell className="font-medium">Voided Amount</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(data.voidedTotal)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Daily breakdown */}
      {data.dailyBreakdown.length > 0 && (
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-medium">Daily Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-center">Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dailyBreakdown.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="font-medium">{row.date}</TableCell>
                    <TableCell className="text-center tabular-nums">{row.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Transaction list */}
      {data.transactions.length > 0 && (
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-medium">
              Transactions
              <span className="ml-2 text-xs font-normal text-muted-foreground">({data.transactions.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Ref</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-center">Method</TableHead>
                    <TableHead className="text-center">Items</TableHead>
                    <TableHead className="text-right">Discount</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.transactions.map((t) => (
                    <TableRow key={t.ref + t.datetime}>
                      <TableCell className="font-mono text-xs">{t.ref}</TableCell>
                      <TableCell className="text-sm">{formatDate(t.datetime)}</TableCell>
                      <TableCell className="text-sm tabular-nums">{formatTime(t.datetime)}</TableCell>
                      <TableCell className="text-sm">{t.customer}</TableCell>
                      <TableCell className="text-center text-sm">{paymentLabel(t.method)}</TableCell>
                      <TableCell className="text-center tabular-nums text-sm">{t.items}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm">{formatCurrency(t.discount)}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">{formatCurrency(t.total)}</TableCell>
                      <TableCell className="text-center">
                        <span className={`text-xs font-medium ${t.status === "voided" ? "text-destructive" : "text-emerald-500"}`}>
                          {t.status === "voided" ? "Voided" : "Completed"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {mounted &&
        createPortal(
          <PrintContent
            mode={mode}
            data={data}
            dateFrom={dateFrom}
            dateTo={dateTo}
            formatCurrency={formatCurrency}
          />,
          document.body
        )}
    </div>
  )
}

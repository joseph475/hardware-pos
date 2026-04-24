"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getProductReport, type ProductReportData } from "@/lib/actions/reports"
import { useCurrency } from "@/lib/context/currency"
import { formatNumber } from "@/lib/format"

type Range = "today" | "week" | "month"

const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
]

export function ProductReportClient({
  initialData,
  userBranchId,
}: {
  initialData: ProductReportData
  userBranchId?: string | null
}) {
  const { formatCurrency, currencySymbol } = useCurrency()
  const [data, setData] = React.useState(initialData)
  const [range, setRange] = React.useState<Range>("month")
  const [isPending, startTransition] = React.useTransition()

  function handleRangeChange(val: Range) {
    setRange(val)
    startTransition(async () => {
      try {
        const result = await getProductReport(val, userBranchId)
        setData(result)
      } catch (err) {
        toast.error("Failed to load report", {
          description: err instanceof Error ? err.message : "Something went wrong",
        })
      }
    })
  }

  const hasData = data.topByRevenue.length > 0

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Product Performance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Top-selling products and category breakdown
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={range} onValueChange={(v) => handleRangeChange(v as Range)}>
            <TabsList>
              {RANGES.map((r) => (
                <TabsTrigger key={r.value} value={r.value}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {isPending && (
            <span className="text-xs text-muted-foreground">Loading…</span>
          )}
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <p className="text-sm font-medium text-foreground">No sales data</p>
          <p className="text-xs text-muted-foreground">
            No completed transactions found for the selected period.
          </p>
        </div>
      ) : (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Top by revenue */}
            <Card>
              <CardHeader className="border-b border-border pb-3">
                <CardTitle>Top Products by Revenue</CardTitle>
                <CardDescription>Top 10 products ranked by sales value</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={data.topByRevenue}
                    layout="vertical"
                    margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                    barSize={14}
                  >
                    <CartesianGrid
                      horizontal={false}
                      strokeDasharray="3 3"
                      stroke="oklch(1 0 0 / 6%)"
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) =>
                        v === 0 ? "0" : `${currencySymbol}${(v / 1000).toFixed(0)}k`
                      }
                      tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 16) + "…" : v}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const entry = data.topByRevenue.find((p) => p.name === label)
                          return (
                            <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 shadow-xl">
                              <p className="text-xs font-medium text-zinc-400 max-w-[160px] truncate">{label}</p>
                              <p className="text-sm font-semibold text-zinc-100">
                                {formatCurrency(payload[0].value as number)}
                              </p>
                              {entry && (
                                <p className="text-xs text-zinc-400">{entry.units} units sold</p>
                              )}
                            </div>
                          )
                        }
                        return null
                      }}
                      cursor={{ fill: "oklch(1 0 0 / 4%)" }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="oklch(0.488 0.243 264.376)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue by category */}
            <Card>
              <CardHeader className="border-b border-border pb-3">
                <CardTitle>Revenue by Category</CardTitle>
                <CardDescription>All categories ranked by sales value</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={data.byCategory}
                    layout="vertical"
                    margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                    barSize={14}
                  >
                    <CartesianGrid
                      horizontal={false}
                      strokeDasharray="3 3"
                      stroke="oklch(1 0 0 / 6%)"
                    />
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) =>
                        v === 0 ? "0" : `${currencySymbol}${(v / 1000).toFixed(0)}k`
                      }
                      tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={110}
                      tick={{ fill: "oklch(0.708 0 0)", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => v.length > 16 ? v.slice(0, 16) + "…" : v}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const entry = data.byCategory.find((c) => c.category === label)
                          return (
                            <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 shadow-xl">
                              <p className="text-xs font-medium text-zinc-400">{label}</p>
                              <p className="text-sm font-semibold text-zinc-100">
                                {formatCurrency(payload[0].value as number)}
                              </p>
                              {entry && (
                                <p className="text-xs text-zinc-400">{entry.units} units sold</p>
                              )}
                            </div>
                          )
                        }
                        return null
                      }}
                      cursor={{ fill: "oklch(1 0 0 / 4%)" }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="oklch(0.55 0.2 145)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Top products table */}
          <Card>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle>Top Products Detail</CardTitle>
              <CardDescription>Top 10 by revenue with unit breakdown</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="pl-4">#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Units Sold</TableHead>
                    <TableHead className="text-right pr-4">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topByRevenue.map((product, i) => (
                    <TableRow key={product.name} className="border-border/50">
                      <TableCell className="pl-4 text-muted-foreground font-mono text-xs">
                        {i + 1}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{product.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {product.sku || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {formatNumber(product.units)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-sm pr-4">
                        {formatCurrency(product.revenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

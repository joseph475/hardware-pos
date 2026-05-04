"use client"

import * as React from "react"
import { toast } from "sonner"
import { handleError } from "@/lib/utils/error-handler"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { getSupplierReport, type SupplierReportData } from "@/lib/actions/reports"
import { useCurrency } from "@/lib/context/currency"
import { formatNumber } from "@/lib/format"

type Range = "today" | "week" | "month"

const RANGES: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
]

export function SupplierReportClient({
  initialData,
  userBranchId,
}: {
  initialData: SupplierReportData
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
        const result = await getSupplierReport(val, userBranchId)
        setData(result)
      } catch (err) {
        handleError(err, 'load supplier report')
      }
    })
  }

  const hasData = data.suppliers.length > 0

  const chartData = data.suppliers.slice(0, 8).map((s) => ({
    name: s.supplier_name.length > 14 ? s.supplier_name.slice(0, 14) + "…" : s.supplier_name,
    value: s.total_value,
  }))

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Supplier Performance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Purchase volume and value by supplier
          </p>
        </div>
        <Tabs value={range} onValueChange={(v) => handleRangeChange(v as Range)}>
          <TabsList>
            {RANGES.map((r) => (
              <TabsTrigger key={r.value} value={r.value} disabled={isPending}>
                {r.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Purchase Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatCurrency(data.totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Units Received</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatNumber(data.totalUnits)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Purchase Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{formatNumber(data.totalPOs)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      {hasData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Purchase Value by Supplier</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${currencySymbol}${formatNumber(v)}`}
                  width={72}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), "Purchase Value"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} className="fill-primary" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Supplier Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Top Suppliers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {hasData ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">POs</TableHead>
                  <TableHead className="text-right">Units Received</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead>Top Products</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.suppliers.map((s) => (
                  <TableRow key={s.supplier_id}>
                    <TableCell className="font-medium">{s.supplier_name}</TableCell>
                    <TableCell className="text-right">{s.po_count}</TableCell>
                    <TableCell className="text-right">{formatNumber(s.units_received)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.total_value)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {s.top_products.map((p) => (
                          <Badge key={p.name} variant="secondary" className="text-xs">
                            {p.name} ({formatNumber(p.units)})
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No purchase data for this period
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

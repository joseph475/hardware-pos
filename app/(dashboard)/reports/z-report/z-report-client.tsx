"use client"

import * as React from "react"
import { toast } from "sonner"
import { Printer, TrendingUp, ShoppingCart, Tag, Ban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { getZReport, type ZReportData } from "@/lib/actions/reports"
import { useCurrency } from "@/lib/context/currency"

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
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
      </CardContent>
    </Card>
  )
}

function paymentLabel(method: string): string {
  const map: Record<string, string> = {
    cash: "Cash",
    card: "Card",
    split: "Split",
    gcash: "GCash",
    maya: "Maya",
  }
  return map[method] ?? method
}

export function ZReportClient({
  initialData,
  initialDate,
}: {
  initialData: ZReportData
  initialDate: string
}) {
  const { formatCurrency } = useCurrency()
  const [data, setData] = React.useState(initialData)
  const [date, setDate] = React.useState(initialDate)
  const [isPending, startTransition] = React.useTransition()

  function handleDateChange(val: string) {
    setDate(val)
    startTransition(async () => {
      try {
        const result = await getZReport(val)
        setData(result)
      } catch (err) {
        toast.error("Failed to load report", {
          description: err instanceof Error ? err.message : "Something went wrong",
        })
      }
    })
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Z-Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            End-of-day sales summary
          </p>
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="report-date" className="text-xs">Date</Label>
            <Input
              id="report-date"
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="h-9 w-40 [color-scheme:dark]"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="h-9">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          {isPending && <span className="text-xs text-muted-foreground pb-2">Loading…</span>}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total Sales"
          value={String(data.salesCount)}
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
          value={`${data.voidCount} (${formatCurrency(data.voidedTotal)})`}
          icon={Ban}
        />
      </div>

      {/* Average transaction */}
      {data.salesCount > 0 && (
        <p className="text-sm text-muted-foreground">
          Average transaction: <span className="font-medium text-foreground">{formatCurrency(data.avgTransactionValue)}</span>
        </p>
      )}

      <Separator />

      {/* Payment method breakdown */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Payment Method Breakdown</h2>
        {data.byPaymentMethod.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No transactions for this date.</p>
        ) : (
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
                    <TableCell className="text-right font-medium">{formatCurrency(row.total)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">{data.salesCount}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.totalRevenue)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body > *:not(main) { display: none !important; }
          header, nav, aside { display: none !important; }
        }
      `}</style>
    </div>
  )
}

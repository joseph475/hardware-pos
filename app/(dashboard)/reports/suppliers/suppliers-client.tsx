"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useCurrency } from "@/lib/context/currency"
import { formatNumber } from "@/lib/format"
import { Truck, Search } from "lucide-react"
import type { SupplierProductRow } from "@/lib/actions/reports"

interface Props {
  rows: SupplierProductRow[]
  suppliers: Array<{ id: string; name: string }>
  companyName?: string | null
  address1?: string | null
  address2?: string | null
  logoUrl?: string | null
}

export function SuppliersReportClient({ rows, suppliers, companyName, address1, address2, logoUrl }: Props) {
  const { formatCurrency } = useCurrency()
  const [supplierFilter, setSupplierFilter] = React.useState("all")
  const [search, setSearch] = React.useState("")

  const filtered = rows.filter((r) => {
    const matchSupplier = supplierFilter === "all" || r.supplier_id === supplierFilter
    const matchSearch =
      !search ||
      r.product_name.toLowerCase().includes(search.toLowerCase()) ||
      r.sku.toLowerCase().includes(search.toLowerCase()) ||
      r.supplier_name.toLowerCase().includes(search.toLowerCase())
    return matchSupplier && matchSearch
  })

  const totalUnits = filtered.reduce((s, r) => s + r.units_sold, 0)
  const totalCogs = filtered.reduce((s, r) => s + r.total_cogs, 0)

  // Group by supplier for display
  const grouped = React.useMemo(() => {
    const map = new Map<string, { name: string; rows: SupplierProductRow[] }>()
    for (const r of filtered) {
      if (!map.has(r.supplier_id)) {
        map.set(r.supplier_id, { name: r.supplier_name, rows: [] })
      }
      map.get(r.supplier_id)!.rows.push(r)
    }
    return Array.from(map.values())
  }, [filtered])

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        {companyName && (
          <div className="flex items-center gap-2 mb-2">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="logo" className="h-8 w-auto object-contain" />
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">{companyName}</p>
              {address1 && <p className="text-xs text-muted-foreground">{address1}</p>}
              {address2 && <p className="text-xs text-muted-foreground">{address2}</p>}
            </div>
          </div>
        )}
        <h1 className="text-xl font-semibold text-foreground">Supplier Report</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Fast-moving items by supplier — units sold and cost of goods
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search product or supplier…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={supplierFilter} onValueChange={(v) => { if (v) setSupplierFilter(v) }}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="All Suppliers">
              {supplierFilter === "all"
                ? "All Suppliers"
                : suppliers.find((s) => s.id === supplierFilter)?.name ?? "All Suppliers"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Total Units Sold</p>
          <p className="text-2xl font-semibold tabular-nums">{formatNumber(totalUnits)}</p>
        </div>
        <div className="rounded-xl border border-border p-4 space-y-1">
          <p className="text-xs text-muted-foreground">Total COGS</p>
          <p className="text-2xl font-semibold tabular-nums">{formatCurrency(totalCogs)}</p>
        </div>
      </div>

      {/* Table grouped by supplier */}
      {grouped.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Truck className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">No supplier data yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Supplier tracking starts once products are sold via POS with supplier stock assigned.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <Card key={group.name}>
              <CardContent className="p-0">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold text-foreground">{group.name}</span>
                  <Badge variant="outline" className="ml-auto text-xs">
                    {group.rows.length} product{group.rows.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-border hover:bg-transparent">
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Units Sold</TableHead>
                      <TableHead className="text-right">Total COGS</TableHead>
                      <TableHead className="text-right">Avg Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.rows.map((row) => (
                      <TableRow key={`${row.supplier_id}-${row.product_id}`} className="border-b border-border/50">
                        <TableCell className="font-medium">{row.product_name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{row.sku}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(row.units_sold)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatCurrency(row.total_cogs)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatCurrency(row.units_sold > 0 ? row.total_cogs / row.units_sold : 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Group totals */}
                    <TableRow className="border-t border-border bg-muted/20 font-semibold">
                      <TableCell colSpan={2} className="text-muted-foreground text-xs">
                        Subtotal
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(group.rows.reduce((s, r) => s + r.units_sold, 0))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(group.rows.reduce((s, r) => s + r.total_cogs, 0))}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

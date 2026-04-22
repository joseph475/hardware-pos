"use client"

import * as React from "react"
import { MoreHorizontal, Eye, Pencil, Trash2, PackageCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useCurrency } from "@/lib/context/currency"
import { NewPOSheet } from "./new-po-sheet"
import { ReceivePODialog } from "./receive-po-dialog"
import { ViewPODialog } from "./view-po-dialog"
import type { POWithRelations } from "@/lib/actions/purchasing"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type POStatus = "draft" | "ordered" | "partial" | "received" | "cancelled"

interface PORow {
  id: string
  supplier: string
  branch: string
  status: POStatus
  items: number
  total: number
  created_by: string
  created_at: string
}

interface Props {
  initialOrders: PORow[]
  fullOrders: POWithRelations[]
  suppliers: Array<{ id: string; name: string }>
  branches: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string; sku: string; cost_price: number }>
  userBranchId: string | null
  userRole: "owner" | "manager" | "cashier"
  supplierNames: string[]
}

const STATUS_CONFIG: Record<POStatus, { label: string; className: string }> = {
  draft:     { label: "Draft",      className: "bg-muted text-muted-foreground border-transparent" },
  ordered:   { label: "Ordered",    className: "bg-blue-500/15 text-blue-500 border-transparent" },
  partial:   { label: "Partial",    className: "bg-amber-500/15 text-amber-500 border-transparent" },
  received:  { label: "Received",   className: "bg-emerald-500/15 text-emerald-500 border-transparent" },
  cancelled: { label: "Cancelled",  className: "bg-red-500/15 text-red-500 border-transparent" },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function OrdersClient({
  initialOrders,
  fullOrders,
  suppliers,
  branches,
  products,
  userBranchId,
  userRole,
  supplierNames,
}: Props) {
  const { formatCurrency } = useCurrency()
  const [orders, setOrders] = React.useState<PORow[]>(initialOrders)
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [supplierFilter, setSupplierFilter] = React.useState("All Suppliers")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [receivingPO, setReceivingPO] = React.useState<POWithRelations | null>(null)
  const [viewingPO, setViewingPO] = React.useState<POWithRelations | null>(null)

  // Sync when server re-renders with fresh data via router refresh
  React.useEffect(() => {
    setOrders(initialOrders)
  }, [initialOrders])

  const allSupplierOptions = ["All Suppliers", ...supplierNames]

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter
    const matchSupplier = supplierFilter === "All Suppliers" || o.supplier === supplierFilter
    const rowDate = o.created_at.slice(0, 10)
    const matchFrom = !dateFrom || rowDate >= dateFrom
    const matchTo = !dateTo || rowDate <= dateTo
    return matchStatus && matchSupplier && matchFrom && matchTo
  })

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track orders from your suppliers
          </p>
        </div>
        <NewPOSheet
          suppliers={suppliers}
          branches={branches}
          products={products}
          userBranchId={userBranchId}
          userRole={userRole}
          onSuccess={() => {
            // Page will revalidate via server action; re-render will update initialOrders
          }}
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-start sm:items-end">
            <Select
              value={statusFilter}
              onValueChange={(v) => { if (v !== null) setStatusFilter(v) }}
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="ordered">Ordered</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={supplierFilter}
              onValueChange={(v) => { if (v !== null) setSupplierFilter(v) }}
            >
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent>
                {allSupplierOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-wrap items-end gap-1.5">
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-36 h-8 [color-scheme:dark]"
                />
              </div>
              <span className="text-muted-foreground text-sm mb-1.5">–</span>
              <div className="space-y-0.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-36 h-8 [color-scheme:dark]"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-sm">No purchase orders found.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="pl-4">PO ID</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-10 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((order) => {
                  const { label, className } = STATUS_CONFIG[order.status]
                  return (
                    <TableRow key={order.id} className="border-b border-border/50">
                      <TableCell className="pl-4">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {order.id.slice(0, 8).toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">{order.supplier}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{order.branch}</TableCell>
                      <TableCell>
                        <Badge className={className}>{label}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
                        {order.items}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium text-foreground">
                        {formatCurrency(order.total)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{order.created_by}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {order.created_at.slice(0, 10)}
                      </TableCell>
                      <TableCell className="pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                const full = fullOrders.find((o) => o.id === order.id) ?? null
                                setViewingPO(full)
                              }}
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            {order.status === "draft" && (
                              <DropdownMenuItem>
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {(order.status === "ordered" || order.status === "partial") && (
                              <DropdownMenuItem
                                onClick={() => {
                                  const full = fullOrders.find((o) => o.id === order.id) ?? null
                                  setReceivingPO(full)
                                }}
                              >
                                <PackageCheck className="h-4 w-4" />
                                Receive Items
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive">
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-right">
        Showing {filtered.length} of {orders.length} orders
      </p>

      <ViewPODialog
        po={viewingPO}
        userRole={userRole}
        onClose={() => setViewingPO(null)}
        onReceive={(po) => setReceivingPO(po)}
      />

      <ReceivePODialog
        po={receivingPO}
        onClose={() => setReceivingPO(null)}
      />
    </div>
  )
}

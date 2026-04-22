"use client"

import * as React from "react"
import { toast } from "sonner"
import { ChevronDown, ChevronRight, Ban, Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { getTransactions, voidTransaction, type TransactionSummary } from "@/lib/actions/transactions"
import { useCurrency } from "@/lib/context/currency"
import { cn } from "@/lib/utils"
import { ReceiptDialog, type ReceiptData } from "@/components/pos/receipt-dialog"

const PAYMENT_METHODS = [
  { value: "", label: "All methods" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "split", label: "Split" },
  { value: "gcash", label: "GCash" },
  { value: "maya", label: "Maya" },
]

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "voided", label: "Voided" },
]

function StatusBadge({ status }: { status: string }) {
  if (status === "voided") {
    return <Badge variant="destructive" className="text-xs">Voided</Badge>
  }
  if (status === "completed") {
    return (
      <Badge className="text-xs border-transparent bg-green-500/15 text-green-700 dark:text-green-400">
        Completed
      </Badge>
    )
  }
  return <Badge variant="outline" className="text-xs">{status}</Badge>
}

interface VoidDialogProps {
  transaction: TransactionSummary | null
  onClose: () => void
  onVoided: (id: string) => void
}

function VoidDialog({ transaction, onClose, onVoided }: VoidDialogProps) {
  const [reason, setReason] = React.useState("")
  const [isPending, setIsPending] = React.useState(false)
  const { formatCurrency } = useCurrency()

  React.useEffect(() => {
    if (!transaction) setReason("")
  }, [transaction])

  async function handleVoid() {
    if (!transaction || !reason.trim()) return
    setIsPending(true)
    try {
      await voidTransaction(transaction.id, reason.trim())
      toast.success("Transaction voided", { description: `#${transaction.id.slice(0, 8).toUpperCase()}` })
      onVoided(transaction.id)
      onClose()
    } catch (err) {
      toast.error("Failed to void transaction", {
        description: err instanceof Error ? err.message : "Something went wrong",
      })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={!!transaction} onOpenChange={(v) => { if (!v && !isPending) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Ban className="h-5 w-5 text-destructive" />
            Void Transaction
          </DialogTitle>
        </DialogHeader>
        {transaction && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction</span>
                <span className="font-mono font-medium">#{transaction.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">{formatCurrency(transaction.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cashier</span>
                <span>{transaction.cashier_name}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              This will restore inventory for all items in this transaction. This action cannot be undone.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="void-reason">Reason for void <span className="text-destructive">*</span></Label>
              <Input
                id="void-reason"
                placeholder="e.g. Customer requested refund"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleVoid}
            disabled={!reason.trim() || isPending}
          >
            {isPending ? "Voiding…" : "Void Transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type OrgSettingsForReceipt = {
  tax_rate: number
  receipt_header: string | null
  receipt_footer: string | null
  currency_code: string
  currency_locale: string
}

interface TransactionsClientProps {
  initialData: TransactionSummary[]
  initialDateFrom: string
  initialDateTo: string
  userRole: string
  orgSettings: OrgSettingsForReceipt
}

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => JSON.stringify(v ?? "")
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function TransactionsClient({
  initialData,
  initialDateFrom,
  initialDateTo,
  userRole,
  orgSettings,
}: TransactionsClientProps) {
  const { formatCurrency } = useCurrency()

  const [data, setData] = React.useState(initialData)
  const [dateFrom, setDateFrom] = React.useState(initialDateFrom)
  const [dateTo, setDateTo] = React.useState(initialDateTo)
  const [paymentFilter, setPaymentFilter] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("")
  const [isPending, startTransition] = React.useTransition()
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const [voidTarget, setVoidTarget] = React.useState<TransactionSummary | null>(null)
  const [reprintTarget, setReprintTarget] = React.useState<TransactionSummary | null>(null)
  const [reprintOpen, setReprintOpen] = React.useState(false)

  const canVoid = userRole === "manager" || userRole === "owner"

  function buildReceiptData(tx: TransactionSummary): ReceiptData {
    return {
      transactionId: tx.id,
      timestamp: new Date(tx.created_at),
      branchName: tx.branch_name,
      branchAddress: tx.branch_address,
      branchPhone: tx.branch_phone,
      cashierName: tx.cashier_name,
      items: tx.items.map((item) => ({
        name: item.product_name,
        qty: item.quantity,
        unitPrice: item.unit_price,
        discountAmount: item.discount_amount,
        lineTotal: item.total,
      })),
      subtotal: tx.total - (tx.total * orgSettings.tax_rate / (1 + orgSettings.tax_rate)),
      discountAmount: tx.discount_amount,
      taxAmount: tx.total * orgSettings.tax_rate / (1 + orgSettings.tax_rate),
      taxRate: orgSettings.tax_rate,
      total: tx.total,
      paymentMethod: tx.payment_method as ReceiptData["paymentMethod"],
      receiptHeader: orgSettings.receipt_header ?? undefined,
      receiptFooter: orgSettings.receipt_footer ?? undefined,
      formatCurrency,
    }
  }

  function handleReprint(tx: TransactionSummary) {
    setReprintTarget(tx)
    setReprintOpen(true)
  }

  function handleExportCSV() {
    const rows = data.map((tx) => ({
      date: new Date(tx.created_at).toLocaleDateString(),
      time: new Date(tx.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      receipt_id: tx.id.slice(0, 8).toUpperCase(),
      cashier: tx.cashier_name,
      branch: tx.branch_name,
      payment_method: tx.payment_method,
      items: tx.item_count,
      total: tx.total,
      status: tx.status,
      void_reason: tx.void_reason ?? "",
    }))
    downloadCSV(rows, `transactions-${dateFrom}-to-${dateTo}.csv`)
  }

  function applyFilters(from: string, to: string, payment: string, status: string) {
    startTransition(async () => {
      try {
        const result = await getTransactions({
          dateFrom: from,
          dateTo: to,
          paymentMethod: payment || undefined,
          status: status || undefined,
        })
        setData(result)
      } catch (err) {
        toast.error("Failed to load transactions", {
          description: err instanceof Error ? err.message : "Something went wrong",
        })
      }
    })
  }

  function handleDateFromChange(val: string) {
    setDateFrom(val)
    applyFilters(val, dateTo, paymentFilter, statusFilter)
  }

  function handleDateToChange(val: string) {
    setDateTo(val)
    applyFilters(dateFrom, val, paymentFilter, statusFilter)
  }

  function handlePaymentChange(val: string) {
    setPaymentFilter(val)
    applyFilters(dateFrom, dateTo, val, statusFilter)
  }

  function handleStatusChange(val: string) {
    setStatusFilter(val)
    applyFilters(dateFrom, dateTo, paymentFilter, val)
  }

  function handleVoided(id: string) {
    setData((prev) =>
      prev.map((tx) => tx.id === id ? { ...tx, status: "voided" as const } : tx)
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Transaction History</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          View, filter, and void completed transactions.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label htmlFor="date-from" className="text-xs">From</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => handleDateFromChange(e.target.value)}
            className="h-9 w-40 [color-scheme:dark]"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="date-to" className="text-xs">To</Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => handleDateToChange(e.target.value)}
            className="h-9 w-40 [color-scheme:dark]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Payment</Label>
          <Select value={paymentFilter} onValueChange={(val) => handlePaymentChange(val ?? "")}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="All methods">
                {PAYMENT_METHODS.find((m) => m.value === paymentFilter)?.label ?? "All methods"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value || "all"} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={(val) => handleStatusChange(val ?? "")}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="All statuses">
                {STATUSES.find((s) => s.value === statusFilter)?.label ?? "All statuses"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value || "all"} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isPending && (
          <span className="text-xs text-muted-foreground pb-2">Loading…</span>
        )}
        <div className="ml-auto pb-0.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={data.length === 0}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Date / Time</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  No transactions found for the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              data.map((tx) => {
                const isExpanded = expandedId === tx.id
                const dt = new Date(tx.created_at)
                return (
                  <React.Fragment key={tx.id}>
                    <TableRow
                      className={cn("cursor-pointer hover:bg-muted/30", isExpanded && "bg-muted/20")}
                      onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                    >
                      <TableCell className="pl-4">
                        {isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                      </TableCell>
                      <TableCell className="text-sm" suppressHydrationWarning>
                        <div className="font-medium">{dt.toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground">{dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                      </TableCell>
                      <TableCell className="text-sm">{tx.cashier_name}</TableCell>
                      <TableCell className="text-center text-sm">{tx.item_count}</TableCell>
                      <TableCell className="text-sm capitalize">{tx.payment_method === "gcash" ? "GCash" : tx.payment_method === "maya" ? "Maya" : tx.payment_method}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(tx.total)}</TableCell>
                      <TableCell><StatusBadge status={tx.status} /></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleReprint(tx)}
                            title="Print receipt"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          {canVoid && tx.status === "completed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground hover:text-destructive"
                              onClick={() => setVoidTarget(tx)}
                            >
                              Void
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>

                    {/* Expanded item details */}
                    {isExpanded && (
                      <TableRow className="bg-muted/10 hover:bg-muted/10">
                        <TableCell colSpan={8} className="px-8 py-3">
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Items</p>
                            <div className="space-y-1">
                              {tx.items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between text-sm">
                                  <span className="text-foreground">{item.quantity}× {item.product_name}</span>
                                  <div className="flex items-center gap-3 text-muted-foreground">
                                    {item.discount_amount > 0 && (
                                      <span className="text-xs text-destructive">−{formatCurrency(item.discount_amount)}</span>
                                    )}
                                    <span className="font-medium text-foreground">{formatCurrency(item.total)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            {tx.void_reason && (
                              <>
                                <Separator />
                                <p className="text-xs text-destructive">Void reason: {tx.void_reason}</p>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {data.length} transaction{data.length !== 1 ? "s" : ""} shown
      </p>

      <VoidDialog
        transaction={voidTarget}
        onClose={() => setVoidTarget(null)}
        onVoided={handleVoided}
      />

      {reprintTarget && (
        <ReceiptDialog
          open={reprintOpen}
          onOpenChange={(o) => {
            setReprintOpen(o)
            if (!o) setReprintTarget(null)
          }}
          data={buildReceiptData(reprintTarget)}
        />
      )}
    </div>
  )
}

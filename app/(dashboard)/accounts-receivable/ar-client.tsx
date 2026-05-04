"use client"

import * as React from "react"
import { toast } from "sonner"
import { formatDate } from "@/lib/format"
import { useCurrency } from "@/lib/context/currency"
import type { AREntry } from "@/lib/actions/ar"
import { recordARPayment } from "@/lib/actions/ar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface ARClientProps {
  initialEntries: AREntry[]
  userRole: string
}

function RecordPaymentDialog({
  entry,
  onClose,
  onPaid,
}: {
  entry: AREntry | null
  onClose: () => void
  onPaid: (id: string, amount: number) => void
}) {
  const { formatCurrency, currencySymbol } = useCurrency()
  const [amountStr, setAmountStr] = React.useState("")
  const [isPending, setIsPending] = React.useState(false)

  React.useEffect(() => {
    if (entry) setAmountStr(entry.balance.toFixed(2))
    else setAmountStr("")
  }, [entry])

  async function handleConfirm() {
    if (!entry) return
    const amount = parseFloat(amountStr)
    if (!amount || amount <= 0) return
    setIsPending(true)
    try {
      await recordARPayment(entry.id, amount)
      toast.success("Payment recorded", {
        description: `${formatCurrency(amount)} recorded for ${entry.customer_name}`,
      })
      onPaid(entry.id, amount)
      onClose()
    } catch (err) {
      toast.error("Failed to record payment", {
        description: err instanceof Error ? err.message : "Something went wrong",
      })
    } finally {
      setIsPending(false)
    }
  }

  const amount = parseFloat(amountStr) || 0
  const isValid = entry != null && amount > 0 && amount <= entry.balance + 0.005

  return (
    <Dialog open={!!entry} onOpenChange={(v) => { if (!v && !isPending) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Record Payment</DialogTitle>
        </DialogHeader>
        {entry && (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{entry.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Due</span>
                <span>{formatCurrency(entry.amount_due)}</span>
              </div>
              {entry.amount_paid > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already Paid</span>
                  <span className="text-green-600 dark:text-green-400">{formatCurrency(entry.amount_paid)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Remaining</span>
                <span className="text-amber-600 dark:text-amber-400">{formatCurrency(entry.balance)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount">Amount Received</Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                  {currencySymbol}
                </span>
                <Input
                  id="payment-amount"
                  type="number"
                  min={0.01}
                  max={entry.balance}
                  step="0.01"
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="pl-6"
                  autoFocus
                />
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!isValid || isPending}>
            {isPending ? "Saving…" : "Confirm Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ARClient({ initialEntries }: ARClientProps) {
  const { formatCurrency } = useCurrency()
  const [entries, setEntries] = React.useState(initialEntries)
  const [search, setSearch] = React.useState("")
  const [payTarget, setPayTarget] = React.useState<AREntry | null>(null)

  const filtered = entries.filter((e) =>
    e.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    e.transaction_id.toLowerCase().includes(search.toLowerCase())
  )

  const totalDue = entries.reduce((s, e) => s + e.amount_due, 0)
  const totalOutstanding = entries.reduce((s, e) => s + e.balance, 0)

  function handlePaid(id: string, amount: number) {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, amount_paid: e.amount_paid + amount, balance: e.balance - amount }
          : e
      )
    )
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Accounts Receivable</h1>
          <p className="text-sm text-muted-foreground">Credit sales (utang) tracking</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-lg border bg-card px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">Total Billed</p>
            <p className="text-base font-semibold">{formatCurrency(totalDue)}</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-base font-semibold text-amber-600 dark:text-amber-400">
              {formatCurrency(totalOutstanding)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by customer or receipt #"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Customer</th>
              <th className="px-4 py-3 text-left font-semibold">Cashier</th>
              <th className="px-4 py-3 text-right font-semibold">Amount Due</th>
              <th className="px-4 py-3 text-right font-semibold">Paid</th>
              <th className="px-4 py-3 text-right font-semibold">Balance</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No credit sales found
                </td>
              </tr>
            ) : (
              filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 tabular-nums">{formatDate(entry.created_at)}</td>
                  <td className="px-4 py-3 font-medium">{entry.customer_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.cashier_name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(entry.amount_due)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-600 dark:text-green-400">
                    {entry.amount_paid > 0 ? formatCurrency(entry.amount_paid) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {entry.balance > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400">{formatCurrency(entry.balance)}</span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">{formatCurrency(0)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        entry.balance <= 0
                          ? "border-transparent bg-green-500/15 text-green-700 dark:text-green-400"
                          : "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      }
                    >
                      {entry.balance <= 0 ? "Paid" : "Unpaid"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {entry.balance > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setPayTarget(entry)}
                      >
                        Record Payment
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <RecordPaymentDialog
        entry={payTarget}
        onClose={() => setPayTarget(null)}
        onPaid={handlePaid}
      />
    </div>
  )
}

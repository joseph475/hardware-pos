"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useCurrency } from "@/lib/context/currency"
import { voidTransaction, type TransactionSummary } from "@/lib/actions/transactions"

interface VoidWithPinDialogProps {
  transaction: TransactionSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onVoided: (id: string) => void
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  split: "Split",
  gcash: "GCash",
  maya: "Maya",
}

export function VoidWithPinDialog({ transaction, open, onOpenChange, onVoided }: VoidWithPinDialogProps) {
  const { formatCurrency } = useCurrency()
  const [reason, setReason] = React.useState("")
  const [pin, setPin] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  // Reset fields when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setReason("")
      setPin("")
      setError(null)
      setPending(false)
    }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!transaction) return
    setError(null)
    setPending(true)
    try {
      await voidTransaction(transaction.id, reason.trim(), pin)
      onVoided(transaction.id)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setPending(false)
    }
  }

  if (!transaction) return null

  const shortId = transaction.id.slice(0, 8).toUpperCase()
  const time = new Date(transaction.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
  const canSubmit = reason.trim().length >= 3 && pin.length >= 4 && !pending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Void Transaction
          </DialogTitle>
        </DialogHeader>

        {/* Transaction summary */}
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">#{shortId}</span>
            <span className="font-semibold">{formatCurrency(transaction.total)}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{transaction.item_count} item{transaction.item_count !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{PAYMENT_LABELS[transaction.payment_method] ?? transaction.payment_method}</span>
            <span>·</span>
            <span suppressHydrationWarning>{time}</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          This will restore stock for all items in this transaction. This action cannot be undone.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="void-reason">Reason *</Label>
            <Input
              id="void-reason"
              placeholder="e.g. Customer returned item"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manager-pin">Manager PIN *</Label>
            <Input
              id="manager-pin"
              type="password"
              placeholder="Enter manager PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              autoComplete="off"
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <DialogFooter className="mt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={!canSubmit}
            >
              {pending ? "Voiding…" : "Void Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

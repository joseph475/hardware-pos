"use client"

import * as React from "react"
import { toast } from "sonner"
import { PauseCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { useCartStore } from "@/lib/store/cart"
import { useCurrency } from "@/lib/context/currency"
import { createHeldTransaction } from "@/lib/actions/transactions"

interface HoldOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HoldOrderDialog({ open, onOpenChange }: HoldOrderDialogProps) {
  const { items, subtotal, totalDiscount, tax, total, clearCart } = useCartStore()
  const { formatCurrency } = useCurrency()
  const [note, setNote] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)
  const orderTotal = total()

  async function handleSave() {
    if (items.length === 0) return
    setIsSaving(true)
    try {
      await createHeldTransaction({
        items: items.map((i) => ({
          product_id: i.product.id,
          product_name: i.product.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount_amount: i.discount_amount,
        })),
        subtotal: subtotal(),
        discount_amount: totalDiscount(),
        tax_amount: tax(),
        total: orderTotal,
        notes: note.trim() || undefined,
      })
      clearCart()
      onOpenChange(false)
      setNote("")
      toast.success("Order placed on hold", {
        description: `${itemCount} item${itemCount !== 1 ? "s" : ""} — ${formatCurrency(orderTotal)}`,
      })
    } catch (err) {
      toast.error("Failed to hold order", {
        description: err instanceof Error ? err.message : "Something went wrong",
      })
    } finally {
      setIsSaving(false)
    }
  }

  function handleOpenChange(value: boolean) {
    if (!isSaving) {
      if (!value) setNote("")
      onOpenChange(value)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSave()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PauseCircle className="h-5 w-5 text-primary" />
            Hold Order
          </DialogTitle>
          <DialogDescription>
            Save this order to resume later.{" "}
            {itemCount > 0 && (
              <span className="font-medium text-foreground">
                {itemCount} item{itemCount !== 1 ? "s" : ""} &mdash;{" "}
                {formatCurrency(orderTotal)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="hold-note">Note / Customer Name</Label>
          <Input
            id="hold-note"
            placeholder="e.g. Table 4, John Doe…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            maxLength={80}
          />
          <p className="text-xs text-muted-foreground">
            Optional — helps identify the order when resuming.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={items.length === 0 || isSaving}
            className="min-w-[110px]"
          >
            {isSaving ? "Saving…" : "Hold Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

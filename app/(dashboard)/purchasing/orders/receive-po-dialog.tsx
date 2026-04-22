"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { receivePurchaseOrder, type POWithRelations } from "@/lib/actions/purchasing"
import { useCurrency } from "@/lib/context/currency"

interface Props {
  po: POWithRelations | null
  onClose: () => void
}

export function ReceivePODialog({ po, onClose }: Props) {
  const router = useRouter()
  const { formatCurrency } = useCurrency()
  const [isPending, startTransition] = React.useTransition()
  const [quantities, setQuantities] = React.useState<Record<string, number>>({})
  const [updateCostPrice, setUpdateCostPrice] = React.useState(false)

  // Reset form when PO changes
  React.useEffect(() => {
    if (po) {
      const initial: Record<string, number> = {}
      po.purchase_order_items.forEach((item) => {
        initial[item.id] = 0
      })
      setQuantities(initial)
      setUpdateCostPrice(false)
    }
  }, [po?.id])

  function handleSubmit() {
    if (!po) return

    const items = po.purchase_order_items
      .filter((item) => (quantities[item.id] ?? 0) > 0)
      .map((item) => ({
        itemId: item.id,
        productId: item.product_id,
        quantityReceived: quantities[item.id] ?? 0,
        unitCost: item.unit_cost,
      }))

    if (items.length === 0) {
      toast.error("Enter at least one quantity to receive")
      return
    }

    startTransition(async () => {
      try {
        await receivePurchaseOrder({ poId: po.id, items, updateCostPrice })
        toast.success("Goods received successfully")
        router.refresh()
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to receive goods")
      }
    })
  }

  return (
    <Dialog open={po !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receive Goods</DialogTitle>
          {po && (
            <p className="text-sm text-muted-foreground -mt-1">
              PO {po.id.slice(0, 8).toUpperCase()} · {po.suppliers?.name ?? "—"} → {po.branches?.name ?? "—"}
            </p>
          )}
        </DialogHeader>

        {po && (
          <div className="space-y-4">
            {/* Items table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left font-medium px-3 py-2 text-muted-foreground">Product</th>
                    <th className="text-right font-medium px-3 py-2 text-muted-foreground">Unit Cost</th>
                    <th className="text-center font-medium px-3 py-2 text-muted-foreground">Ordered</th>
                    <th className="text-center font-medium px-3 py-2 text-muted-foreground">Received</th>
                    <th className="text-center font-medium px-3 py-2 text-muted-foreground w-32">Receiving Now</th>
                  </tr>
                </thead>
                <tbody>
                  {po.purchase_order_items.map((item, idx) => {
                    const remaining = item.quantity_ordered - item.quantity_received
                    const value = quantities[item.id] ?? 0
                    const isComplete = remaining <= 0
                    return (
                      <tr key={item.id} className={idx > 0 ? "border-t border-border/60" : ""}>
                        <td className="px-3 py-2.5 font-medium text-foreground">
                          {item.products?.name ?? "Unknown product"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(item.unit_cost)}
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
                          {item.quantity_ordered}
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
                          {item.quantity_received}
                        </td>
                        <td className="px-3 py-2.5">
                          {isComplete ? (
                            <p className="text-xs text-emerald-500 text-center font-medium">Complete</p>
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              max={remaining}
                              value={value}
                              onChange={(e) => {
                                const n = Math.max(0, Math.min(remaining, parseInt(e.target.value) || 0))
                                setQuantities((prev) => ({ ...prev, [item.id]: n }))
                              }}
                              className="h-8 text-center"
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Update cost price option */}
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="updateCostPrice"
                checked={updateCostPrice}
                onCheckedChange={(checked) => setUpdateCostPrice(checked as boolean)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="updateCostPrice" className="font-medium cursor-pointer">
                  Update product cost price
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Updates each product's standard cost to match this PO's unit costs
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Receiving…" : "Confirm Receipt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

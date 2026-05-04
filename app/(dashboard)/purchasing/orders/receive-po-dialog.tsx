"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { handleError } from "@/lib/utils/error-handler"
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
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { receivePurchaseOrder, type POWithRelations } from "@/lib/actions/purchasing"
import { useCurrency } from "@/lib/context/currency"

interface Props {
  po: POWithRelations | null
  onClose: () => void
}

export function ReceivePODialog({ po, onClose }: Props) {
  const router = useRouter()
  const { formatCurrency, currencySymbol } = useCurrency()
  const [isPending, startTransition] = React.useTransition()
  const [quantities, setQuantities] = React.useState<Record<string, number>>({})
  const [serials, setSerials] = React.useState<Record<string, string[]>>({})
  const [paymentDueDate, setPaymentDueDate] = React.useState("")
  const [shippingFee, setShippingFee] = React.useState(0)
  const [updateCostPrice, setUpdateCostPrice] = React.useState(false)

  // Reset form when PO changes
  React.useEffect(() => {
    if (po) {
      const initialQty: Record<string, number> = {}
      const initialSerials: Record<string, string[]> = {}
      po.purchase_order_items.forEach((item) => {
        initialQty[item.id] = 0
        initialSerials[item.id] = []
      })
      setQuantities(initialQty)
      setSerials(initialSerials)
      setPaymentDueDate("")
      setShippingFee(0)
      setUpdateCostPrice(false)
    }
  }, [po?.id])

  function handleQuantityChange(itemId: string, isSerial: boolean, newQty: number) {
    setQuantities((prev) => ({ ...prev, [itemId]: newQty }))
    if (isSerial) {
      setSerials((prev) => {
        const arr = prev[itemId] ?? []
        return { ...prev, [itemId]: Array.from({ length: newQty }, (_, i) => arr[i] ?? "") }
      })
    }
  }

  // Computed receipt total
  const itemsSubtotal = po
    ? po.purchase_order_items.reduce((sum, item) => sum + (quantities[item.id] ?? 0) * item.unit_cost, 0)
    : 0
  const receiptTotal = itemsSubtotal + shippingFee

  function handleSubmit() {
    if (!po) return

    // Serial validation
    const missingSerials = po.purchase_order_items.filter((item) => {
      const qty = quantities[item.id] ?? 0
      if (qty === 0 || !item.products?.serial_required) return false
      return (serials[item.id] ?? []).filter((s) => s.trim()).length < qty
    })
    if (missingSerials.length > 0) {
      toast.error(`Enter all serials for: ${missingSerials.map((i) => i.products!.name).join(", ")}`)
      return
    }

    const items = po.purchase_order_items
      .filter((item) => (quantities[item.id] ?? 0) > 0)
      .map((item) => ({
        itemId: item.id,
        productId: item.product_id,
        quantityReceived: quantities[item.id] ?? 0,
        unitCost: item.unit_cost,
        serials: serials[item.id] ?? [],
      }))

    if (items.length === 0) {
      toast.error("Enter at least one quantity to receive")
      return
    }

    startTransition(async () => {
      try {
        await receivePurchaseOrder({
          poId: po.id,
          items,
          updateCostPrice,
          paymentDueDate: paymentDueDate || null,
          shippingFee,
        })
        toast.success("Goods received successfully")
        router.refresh()
        onClose()
      } catch (err) {
        handleError(err, 'receive purchase order')
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
                    const isSerial = item.products?.serial_required ?? false
                    const itemSerials = serials[item.id] ?? []

                    return (
                      <React.Fragment key={item.id}>
                        <tr className={idx > 0 ? "border-t border-border/60" : ""}>
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
                                  handleQuantityChange(item.id, isSerial, n)
                                }}
                                className="h-8 text-center"
                              />
                            )}
                          </td>
                        </tr>

                        {/* Serial number sub-row */}
                        {isSerial && value > 0 && (
                          <tr className="border-t border-border/30 bg-muted/20">
                            <td colSpan={5} className="px-3 py-2.5">
                              <p className="text-xs text-muted-foreground mb-1.5">
                                Serial numbers for{" "}
                                <span className="font-medium text-foreground">{item.products!.name}</span>:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {Array.from({ length: value }, (_, i) => (
                                  <input
                                    key={i}
                                    placeholder={`SN ${i + 1}`}
                                    value={itemSerials[i] ?? ""}
                                    onChange={(e) => {
                                      setSerials((prev) => {
                                        const arr = [...(prev[item.id] ?? [])]
                                        arr[i] = e.target.value
                                        return { ...prev, [item.id]: arr }
                                      })
                                    }}
                                    className={cn(
                                      "h-7 w-40 rounded border bg-background px-2 font-mono text-xs transition-colors outline-none focus:ring-1 focus:ring-primary",
                                      itemSerials[i]
                                        ? "border-green-500/60 text-foreground"
                                        : "border-border text-foreground placeholder:text-muted-foreground"
                                    )}
                                  />
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Separator />

            {/* Payment terms & shipping fee */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="paymentDueDate">
                  Payment Due Date{" "}
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="paymentDueDate"
                  type="date"
                  className="[color-scheme:dark]"
                  value={paymentDueDate}
                  onChange={(e) => setPaymentDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shippingFee">Shipping Fee</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    id="shippingFee"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={shippingFee || ""}
                    onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
                    className="pl-6"
                  />
                </div>
              </div>
            </div>

            {/* Receipt total */}
            <div className="flex justify-between items-center rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                Receipt Total
                {shippingFee > 0 && (
                  <span className="ml-1 text-xs">
                    (items {formatCurrency(itemsSubtotal)} + shipping {formatCurrency(shippingFee)})
                  </span>
                )}
              </span>
              <span className="font-semibold tabular-nums">{formatCurrency(receiptTotal)}</span>
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

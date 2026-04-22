"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { XCircle, SendHorizonal } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { updatePurchaseOrderStatus, type POWithRelations } from "@/lib/actions/purchasing"
import { useCurrency } from "@/lib/context/currency"

type POStatus = "draft" | "ordered" | "partial" | "received" | "cancelled"

const STATUS_CONFIG: Record<POStatus, { label: string; className: string }> = {
  draft:     { label: "Draft",      className: "bg-muted text-muted-foreground border-transparent" },
  ordered:   { label: "Ordered",    className: "bg-blue-500/15 text-blue-500 border-transparent" },
  partial:   { label: "Partial",    className: "bg-amber-500/15 text-amber-500 border-transparent" },
  received:  { label: "Received",   className: "bg-emerald-500/15 text-emerald-500 border-transparent" },
  cancelled: { label: "Cancelled",  className: "bg-red-500/15 text-red-500 border-transparent" },
}

interface Props {
  po: POWithRelations | null
  userRole: "owner" | "manager" | "cashier"
  onClose: () => void
  onReceive: (po: POWithRelations) => void
}

export function ViewPODialog({ po, userRole, onClose, onReceive }: Props) {
  const router = useRouter()
  const { formatCurrency } = useCurrency()
  const [isPending, startTransition] = React.useTransition()

  const canAct = userRole === "owner" || userRole === "manager"

  function handleSubmit() {
    if (!po) return
    startTransition(async () => {
      try {
        await updatePurchaseOrderStatus(po.id, "ordered")
        toast.success("PO submitted to supplier")
        router.refresh()
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to submit PO")
      }
    })
  }

  function handleCancel() {
    if (!po) return
    startTransition(async () => {
      try {
        await updatePurchaseOrderStatus(po.id, "cancelled")
        toast.success("PO cancelled")
        router.refresh()
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to cancel PO")
      }
    })
  }

  if (!po) return null

  const status = po.status as POStatus
  const { label, className } = STATUS_CONFIG[status]
  const lineItems = po.purchase_order_items

  return (
    <Dialog open={po !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>
              PO {po.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
            <Badge className={className}>{label}</Badge>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground -mt-1">
            <span><span className="font-medium text-foreground">Supplier:</span> {po.suppliers?.name ?? "—"}</span>
            <span><span className="font-medium text-foreground">Branch:</span> {po.branches?.name ?? "—"}</span>
            <span><span className="font-medium text-foreground">Date:</span> {po.created_at.slice(0, 10)}</span>
            <span><span className="font-medium text-foreground">Created by:</span> {po.profiles?.full_name ?? "—"}</span>
          </div>
          {po.notes && (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mt-1">
              {po.notes}
            </p>
          )}
        </DialogHeader>

        {/* Scrollable body — table + optional cashier note */}
        <div className="overflow-y-auto max-h-[55vh] space-y-3">
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Horizontal scroll for narrow viewports */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left font-medium px-3 py-2 text-muted-foreground whitespace-nowrap">Product</th>
                    <th className="text-center font-medium px-3 py-2 text-muted-foreground whitespace-nowrap">Ordered</th>
                    <th className="text-center font-medium px-3 py-2 text-muted-foreground whitespace-nowrap">Received</th>
                    <th className="text-right font-medium px-3 py-2 text-muted-foreground whitespace-nowrap">Unit Cost</th>
                    <th className="text-right font-medium px-3 py-2 text-muted-foreground whitespace-nowrap">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, idx) => {
                    const isFullyReceived = item.quantity_received >= item.quantity_ordered
                    return (
                      <tr key={item.id} className={idx > 0 ? "border-t border-border/60" : ""}>
                        <td className="px-3 py-2.5 font-medium text-foreground">
                          {item.products?.name ?? "Unknown product"}
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
                          {item.quantity_ordered}
                        </td>
                        <td className="px-3 py-2.5 text-center tabular-nums">
                          <span className={isFullyReceived ? "text-emerald-500 font-medium" : "text-muted-foreground"}>
                            {item.quantity_received}
                          </span>
                          {isFullyReceived && (
                            <span className="ml-1.5 text-xs text-emerald-500">✓</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(item.unit_cost)}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium text-foreground">
                          {formatCurrency(item.quantity_ordered * item.unit_cost)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Total row — outside scroll so it sticks to bottom of table */}
            <div className="border-t border-border bg-muted/30 px-3 py-2.5 flex justify-end gap-4 text-sm">
              <span className="text-muted-foreground">Order Total</span>
              <span className="font-semibold tabular-nums text-foreground w-24 text-right">
                {formatCurrency(po.total)}
              </span>
            </div>
          </div>

          {/* Role note for cashiers */}
          {!canAct && (
            <p className="text-xs text-muted-foreground text-center pb-1">
              Cashiers can view purchase orders but cannot take actions.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Close
          </Button>

          {canAct && (
            <>
              {/* Draft: submit or cancel */}
              {status === "draft" && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel PO
                  </Button>
                  <Button onClick={handleSubmit} disabled={isPending}>
                    <SendHorizonal className="h-4 w-4" />
                    {isPending ? "Submitting…" : "Submit to Supplier"}
                  </Button>
                </>
              )}

              {/* Ordered: receive or cancel */}
              {status === "ordered" && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isPending}
                    className="text-destructive hover:text-destructive"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancel PO
                  </Button>
                  <Button
                    onClick={() => { onClose(); onReceive(po) }}
                    disabled={isPending}
                  >
                    Receive Items
                  </Button>
                </>
              )}

              {/* Partial: receive remaining */}
              {status === "partial" && (
                <Button
                  onClick={() => { onClose(); onReceive(po) }}
                  disabled={isPending}
                >
                  Receive Remaining Items
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

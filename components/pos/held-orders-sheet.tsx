"use client"

import * as React from "react"
import { toast } from "sonner"
import { PauseCircle, RotateCcw, Trash2, ShoppingBag, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useCartStore } from "@/lib/store/cart"
import { useCurrency } from "@/lib/context/currency"
import {
  getHeldTransactions,
  deleteHeldTransaction,
  clearExpiredHeldOrders,
  type HeldTransaction,
} from "@/lib/actions/transactions"

function getOrderAgeBadge(iso: string): "old" | "expired" | null {
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = diffMs / (1000 * 60 * 60)
  if (hours > 24) return "expired"
  if (hours > 2) return "old"
  return null
}

interface HeldOrdersSheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function HeldOrdersSheet({ open: controlledOpen, onOpenChange: controlledOnChange }: HeldOrdersSheetProps) {
  const { loadHeldOrder, items } = useCartStore()
  const { formatCurrency } = useCurrency()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [heldOrders, setHeldOrders] = React.useState<HeldTransaction[]>([])
  const [loading, setLoading] = React.useState(false)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [clearingExpired, setClearingExpired] = React.useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (controlledOnChange ?? setInternalOpen) : setInternalOpen

  async function fetchHeld(showLoading = true) {
    if (showLoading) setLoading(true)
    try {
      const data = await getHeldTransactions()
      setHeldOrders(data)
    } catch {
      // Silently fail for background fetches
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  // Fetch count on mount so badge shows immediately
  React.useEffect(() => {
    fetchHeld(false)
  }, [])

  React.useEffect(() => {
    if (open) fetchHeld()
  }, [open])

  function handleResume(order: HeldTransaction) {
    if (items.length > 0) {
      toast.error("Clear current cart first", {
        description: "Your cart has items. Clear it before resuming a held order.",
      })
      return
    }
    loadHeldOrder(order.items)
    // Delete the held record in the background
    deleteHeldTransaction(order.id).catch(() => {})
    setOpen(false)
    toast.success("Order resumed", {
      description: order.notes
        ? `"${order.notes}" loaded into cart`
        : "Held order loaded into cart",
    })
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteHeldTransaction(id)
      setHeldOrders((prev) => prev.filter((o) => o.id !== id))
      toast.success("Held order deleted")
    } catch (err) {
      toast.error("Failed to delete", {
        description: err instanceof Error ? err.message : "Something went wrong",
      })
    } finally {
      setDeletingId(null)
    }
  }

  async function handleClearExpired() {
    setClearingExpired(true)
    try {
      const count = await clearExpiredHeldOrders()
      await fetchHeld(false)
      toast.success(count > 0 ? `Cleared ${count} expired order${count !== 1 ? "s" : ""}` : "No expired orders to clear")
    } catch (err) {
      toast.error("Failed to clear expired orders", {
        description: err instanceof Error ? err.message : "Something went wrong",
      })
    } finally {
      setClearingExpired(false)
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const hasExpired = heldOrders.some((o) => getOrderAgeBadge(o.created_at) === "expired")

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" className="relative" />} nativeButton={true}>
        <PauseCircle className="h-4 w-4" />
        Held Orders
        {heldOrders.length > 0 && (
          <Badge className="ml-1 h-5 min-w-5 justify-center px-1.5 text-xs">
            {heldOrders.length}
          </Badge>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col">
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Held Orders</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Resume or discard saved orders
              </p>
            </div>
            {hasExpired && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleClearExpired}
                disabled={clearingExpired}
                className="text-xs text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {clearingExpired ? "Clearing…" : "Clear expired"}
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Loading…
            </div>
          ) : heldOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-foreground">No held orders</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Hold an order from the cart to save it here.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {heldOrders.map((order) => {
                const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)
                const ageBadge = getOrderAgeBadge(order.created_at)
                return (
                  <div key={order.id} className="px-5 py-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">
                          {order.notes || "Unnamed order"}
                        </p>
                        {ageBadge === "expired" && (
                          <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
                            <Clock className="h-2.5 w-2.5 mr-0.5" />
                            Expired
                          </Badge>
                        )}
                        {ageBadge === "old" && (
                          <Badge className="text-[10px] h-4 px-1.5 border-transparent bg-yellow-500/15 text-yellow-600 dark:text-yellow-400">
                            <Clock className="h-2.5 w-2.5 mr-0.5" />
                            Old
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5" suppressHydrationWarning>
                        {itemCount} item{itemCount !== 1 ? "s" : ""} &middot; {formatCurrency(order.total)} &middot; {formatTime(order.created_at)}
                      </p>
                      <ul className="mt-1.5 space-y-0.5">
                        {order.items.slice(0, 3).map((item) => (
                          <li key={item.id} className="text-xs text-muted-foreground truncate">
                            {item.quantity}× {item.product_name}
                          </li>
                        ))}
                        {order.items.length > 3 && (
                          <li className="text-xs text-muted-foreground">
                            +{order.items.length - 3} more
                          </li>
                        )}
                      </ul>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleResume(order)}
                        aria-label="Resume order"
                        title="Resume"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleDelete(order.id)}
                        disabled={deletingId === order.id}
                        aria-label="Delete held order"
                        title="Delete"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

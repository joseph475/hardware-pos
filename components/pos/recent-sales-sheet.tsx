"use client"

import * as React from "react"
import { toast } from "sonner"
import { History, ShoppingBag, Ban, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useCurrency } from "@/lib/context/currency"
import { useUserProfile } from "@/lib/context/user-profile"
import { getRecentBranchTransactions, type TransactionSummary } from "@/lib/actions/transactions"
import { VoidWithPinDialog } from "@/components/pos/void-with-pin-dialog"

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  split: "Split",
  gcash: "GCash",
  maya: "Maya",
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

interface RecentSalesSheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hasPinConfigured: boolean
}

export function RecentSalesSheet({
  open: controlledOpen,
  onOpenChange: controlledOnChange,
  hasPinConfigured,
}: RecentSalesSheetProps) {
  const { formatCurrency } = useCurrency()
  const { profile } = useUserProfile()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [sales, setSales] = React.useState<TransactionSummary[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState(todayISO)
  const [search, setSearch] = React.useState("")
  const [voidTarget, setVoidTarget] = React.useState<TransactionSummary | null>(null)
  const [voidDialogOpen, setVoidDialogOpen] = React.useState(false)

  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (controlledOnChange ?? setInternalOpen) : setInternalOpen

  async function fetchSales() {
    if (!profile?.branch_id) return
    setLoading(true)
    try {
      const data = await getRecentBranchTransactions(profile.branch_id, selectedDate)
      setSales(data)
    } catch (err) {
      toast.error("Failed to load sales", {
        description: err instanceof Error ? err.message : "Something went wrong",
      })
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    if (open) fetchSales()
  }, [open, selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = sales.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.id.slice(0, 8).toLowerCase().includes(q) ||
      String(s.total).includes(q) ||
      (PAYMENT_LABELS[s.payment_method] ?? s.payment_method).toLowerCase().includes(q)
    )
  })

  function handleVoidClick(sale: TransactionSummary) {
    setVoidTarget(sale)
    setVoidDialogOpen(true)
  }

  function handleVoided(id: string) {
    setSales((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "voided" as const } : s))
    )
    toast.success("Transaction voided", {
      description: "Stock has been restored.",
    })
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const isToday = selectedDate === todayISO()
  const dateLabel = isToday
    ? "Today"
    : new Date(selectedDate + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })

  const subtitle = loading
    ? "Loading…"
    : `${dateLabel} · ${filtered.length} transaction${filtered.length !== 1 ? "s" : ""}`

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" />} nativeButton={true}>
          <History className="h-4 w-4" />
          Recent Sales
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col">
          <div className="px-5 pt-5 pb-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Sales</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          </div>

          {/* Date + Search filters */}
          <div className="px-4 py-3 border-b border-border flex gap-2">
            <Input
              type="date"
              value={selectedDate}
              max={todayISO()}
              onChange={(e) => {
                setSearch("")
                setSelectedDate(e.target.value || todayISO())
              }}
              className="w-40 shrink-0 text-sm [color-scheme:dark]"
            />
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ID, amount, payment…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                Loading…
              </div>
            ) : sales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-medium text-foreground">No sales on this day</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Try selecting a different date.
                  </p>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <Search className="h-10 w-10 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-medium text-foreground">No matches</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Try a different search term.
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((sale) => {
                  const shortId = sale.id.slice(0, 8).toUpperCase()
                  const isVoided = sale.status === "voided"
                  const canVoid = !isVoided && hasPinConfigured
                  return (
                    <div key={sale.id} className="px-5 py-4 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">#{shortId}</span>
                          {isVoided ? (
                            <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Voided</Badge>
                          ) : (
                            <Badge className="text-[10px] h-4 px-1.5 border-transparent bg-green-500/15 text-green-700 dark:text-green-400">
                              Completed
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {formatCurrency(sale.total)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5" suppressHydrationWarning>
                          {sale.item_count} item{sale.item_count !== 1 ? "s" : ""}{" "}
                          · {PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}{" "}
                          · {formatTime(sale.created_at)}
                        </p>
                        {isVoided && sale.void_reason && (
                          <p className="mt-1 text-xs text-muted-foreground italic">
                            Voided: {sale.void_reason}
                          </p>
                        )}
                      </div>
                      {canVoid && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleVoidClick(sale)}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          title="Void this transaction"
                        >
                          <Ban className="h-4 w-4" />
                          Void
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {!hasPinConfigured && (
            <div className="border-t border-border px-5 py-3">
              <p className="text-xs text-muted-foreground">
                A manager must configure a PIN in Settings → Organization to enable cashier voids.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <VoidWithPinDialog
        transaction={voidTarget}
        open={voidDialogOpen}
        onOpenChange={setVoidDialogOpen}
        onVoided={handleVoided}
      />
    </>
  )
}

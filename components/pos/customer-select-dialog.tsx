"use client"

import * as React from "react"
import { Search, UserPlus, User, X } from "lucide-react"
import { toast } from "sonner"
import { handleError } from "@/lib/utils/error-handler"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CustomerDialog, type CustomerFormValues } from "@/app/(dashboard)/customers/components/customer-dialog"
import { upsertCustomer } from "@/lib/actions/customers"
import { cn } from "@/lib/utils"
interface CustomerItem {
  id: string
  name: string
  email: string | null
  phone: string | null
  company_name: string | null
  is_active: boolean
}

interface CustomerSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customers: CustomerItem[]
  onConfirm: (customerId: string | null, customerName: string | null) => void
  requireSelection?: boolean
}

export function CustomerSelectDialog({
  open,
  onOpenChange,
  customers,
  onConfirm,
  requireSelection = false,
}: CustomerSelectDialogProps) {
  const [search, setSearch] = React.useState("")
  const [selected, setSelected] = React.useState<{ id: string; name: string } | null>(null)
  const [newCustomerOpen, setNewCustomerOpen] = React.useState(false)
  const [savingCustomer, setSavingCustomer] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setSearch("")
      setSelected(null)
      setNewCustomerOpen(false)
    }
  }, [open])

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return customers.filter((c) => c.is_active)
    return customers.filter(
      (c) =>
        c.is_active &&
        (c.name.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").includes(q) ||
          (c.company_name ?? "").toLowerCase().includes(q))
    )
  }, [search, customers])

  async function handleSaveNewCustomer(values: CustomerFormValues) {
    setSavingCustomer(true)
    try {
      const { id } = await upsertCustomer(values)
      setSelected({ id, name: values.name })
      setNewCustomerOpen(false)
      toast.success("Customer added", { description: values.name })
    } catch (err) {
      handleError(err, 'add customer')
    } finally {
      setSavingCustomer(false)
    }
  }

  function handleConfirm() {
    onConfirm(selected?.id ?? null, selected?.name ?? null)
    onOpenChange(false)
  }

  function handleSkip() {
    onConfirm(null, null)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5 text-primary" />
              Select Customer
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Selected customer badge */}
            {selected && (
              <div className="flex items-center justify-between rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <User className="h-4 w-4 shrink-0" />
                  {selected.name}
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-primary/60 hover:text-primary"
                  aria-label="Clear selection"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute inset-y-0 left-2.5 my-auto h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
                autoFocus
              />
            </div>

            {/* Customer list */}
            <ScrollArea className="h-56 rounded-lg border border-border">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <User className="h-8 w-8 opacity-30" />
                  {search ? "No customers match your search" : "No customers yet"}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelected({ id: c.id, name: c.name })}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/50",
                        selected?.id === c.id && "bg-primary/5"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          selected?.id === c.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{c.name}</p>
                        {(c.company_name || c.phone || c.email) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {[c.company_name, c.phone || c.email].filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Add new customer */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setNewCustomerOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              New Customer
            </Button>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {!requireSelection && (
              <Button variant="ghost" onClick={handleSkip}>
                Walk-in / Skip
              </Button>
            )}
            <Button onClick={handleConfirm} disabled={requireSelection && !selected}>
              Continue →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomerDialog
        open={newCustomerOpen}
        onOpenChange={setNewCustomerOpen}
        onSave={handleSaveNewCustomer}
        isPending={savingCustomer}
      />
    </>
  )
}

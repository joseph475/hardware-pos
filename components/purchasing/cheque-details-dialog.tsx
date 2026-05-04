"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { toast } from "sonner"
import { logError } from "@/lib/actions/errors"
import { Plus, Pencil, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDate, formatNumber } from "@/lib/format"
import {
  getPOCheques,
  addPOCheque,
  updatePOCheque,
  deletePOCheque,
} from "@/lib/actions/purchasing"
import type { PurchaseOrderCheque } from "@/types/database"

const chequeSchema = z.object({
  check_name: z.string().min(1, "Required"),
  check_number: z.string().min(1, "Required"),
  check_date: z.string().min(1, "Required"),
  amount: z.number().positive("Must be positive"),
})

type ChequeFormValues = z.infer<typeof chequeSchema>

interface Props {
  po: { id: string; total: number } | null
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function ChequeDetailsDialog({ po, open, onOpenChange }: Props) {
  const [cheques, setCheques] = React.useState<PurchaseOrderCheque[]>([])
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [showForm, setShowForm] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ChequeFormValues>({
    resolver: zodResolver(chequeSchema),
  })

  React.useEffect(() => {
    if (open && po) {
      getPOCheques(po.id).then(setCheques)
      setShowForm(false)
      setEditingId(null)
      reset()
    }
  }, [open, po?.id])

  if (!po) return null

  const chequeTotal = cheques.reduce((sum, c) => sum + Number(c.amount), 0)
  const remaining = Number(po.total) - chequeTotal
  const isFullyCovered = chequeTotal >= Number(po.total)

  function startEdit(cheque: PurchaseOrderCheque) {
    setEditingId(cheque.id)
    setShowForm(true)
    setValue("check_name", cheque.check_name)
    setValue("check_number", cheque.check_number)
    setValue("check_date", cheque.check_date)
    setValue("amount", Number(cheque.amount))
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    reset()
  }

  function onSubmit(values: ChequeFormValues) {
    startTransition(async () => {
      const result = editingId
        ? await updatePOCheque(editingId, values)
        : await addPOCheque({ po_id: po!.id, ...values })

      if (result.error) {
        toast.error(result.error)
        logError({ message: result.error, context: 'save cheque', url: typeof window !== 'undefined' ? window.location.href : undefined }).catch(() => {})
        return
      }

      const updated = await getPOCheques(po!.id)
      setCheques(updated)
      cancelForm()
      toast.success(editingId ? "Cheque updated" : "Cheque added")
    })
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deletePOCheque(id)
      if (result.error) {
        toast.error(result.error)
        logError({ message: result.error, context: 'delete cheque', url: typeof window !== 'undefined' ? window.location.href : undefined }).catch(() => {})
        return
      }
      setCheques((prev) => prev.filter((c) => c.id !== id))
      toast.success("Cheque deleted")
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Cheque Details — PO #{po.id.slice(0, 8).toUpperCase()}
          </DialogTitle>
        </DialogHeader>

        {/* Running total */}
        <p
          className={`text-sm font-medium ${
            isFullyCovered ? "text-emerald-500" : "text-amber-500"
          }`}
        >
          {formatNumber(chequeTotal)} of {formatNumber(Number(po.total))} covered
          {!isFullyCovered && ` (${formatNumber(remaining)} remaining)`}
        </p>

        {/* Cheques list */}
        {cheques.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Number</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
                  <th className="w-16 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {cheques.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-3 py-2">{c.check_name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{c.check_number}</td>
                    <td className="px-3 py-2 tabular-nums">{formatDate(c.check_date)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {formatNumber(Number(c.amount))}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => startEdit(c)}
                          disabled={isPending}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDelete(c.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cheques.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground">No cheques recorded yet.</p>
        )}

        {/* Add / Edit form */}
        {showForm && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-3 border rounded-md p-4 bg-muted/30"
          >
            <p className="text-sm font-medium">
              {editingId ? "Edit Cheque" : "New Cheque"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Check Name</Label>
                <Input {...register("check_name")} placeholder="Payee name" />
                {errors.check_name && (
                  <p className="text-xs text-destructive">{errors.check_name.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Check Number</Label>
                <Input {...register("check_number")} placeholder="e.g. 001234" />
                {errors.check_number && (
                  <p className="text-xs text-destructive">{errors.check_number.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input
                  type="date"
                  className="[color-scheme:dark]"
                  {...register("check_date")}
                />
                {errors.check_date && (
                  <p className="text-xs text-destructive">{errors.check_date.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("amount", { valueAsNumber: true })}
                />
                {errors.amount && (
                  <p className="text-xs text-destructive">{errors.amount.message}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={cancelForm}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {editingId ? "Save Changes" : "Add Cheque"}
              </Button>
            </div>
          </form>
        )}

        <DialogFooter showCloseButton={false}>
          {!showForm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(true)}
              disabled={isFullyCovered || isPending}
            >
              <Plus className="size-4 mr-1" />
              Add Cheque
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

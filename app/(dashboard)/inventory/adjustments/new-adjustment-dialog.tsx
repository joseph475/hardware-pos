"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createStockAdjustment } from "@/lib/actions/inventory"

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const schema = z
  .object({
    product_id: z.string().min(1, "Product is required"),
    type: z.enum(["adjustment", "damage"]),
    adjustment_direction: z.enum(["add", "remove"]),
    quantity: z
      .number({ message: "Enter a valid quantity" })
      .int("Quantity must be a whole number")
      .positive("Quantity must be greater than 0"),
    notes: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "damage" && !data.notes.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Notes are required for damage adjustments",
        path: ["notes"],
      })
    }
  })

type FormValues = z.infer<typeof schema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  products: Array<{ id: string; name: string; sku: string; unit: string }>
  branches: Array<{ id: string; name: string }>
  defaultBranchId: string
  onSuccess: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function NewAdjustmentDialog({ products, branches, defaultBranchId, onSuccess }: Props) {
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const isSuperAdmin = branches.length > 1

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      product_id: "",
      type: "adjustment",
      adjustment_direction: "add",
      quantity: undefined as unknown as number,
      notes: "",
    },
  })

  const watchedType = watch("type")
  const watchedDirection = watch("adjustment_direction")
  const [selectedProductId, setSelectedProductId] = React.useState<string>("")
  const selectedProduct = products.find((p) => p.id === selectedProductId)
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>(defaultBranchId)
  const selectedBranch = branches.find((b) => b.id === selectedBranchId)

  // When type changes to damage, force direction to "remove"
  React.useEffect(() => {
    if (watchedType === "damage") {
      setValue("adjustment_direction", "remove")
    }
  }, [watchedType, setValue])

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset()
      setSelectedProductId("")
      setSelectedBranchId(defaultBranchId)
    }
    setOpen(next)
  }

  async function onSubmit(values: FormValues) {
    if (!selectedBranchId) return
    setSubmitting(true)
    try {
      await createStockAdjustment({
        product_id: values.product_id,
        branch_id: selectedBranchId,
        type: values.type,
        quantity: values.quantity,
        adjustment_direction: values.adjustment_direction,
        notes: values.notes,
      })
      toast.success("Stock adjustment saved")
      setOpen(false)
      reset()
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save adjustment")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" />
        New Adjustment
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Stock Adjustment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Product */}
          <div className="space-y-1.5">
            <Label htmlFor="product_id">Product</Label>
            <Select<string>
              value={selectedProductId}
              onValueChange={(val) => {
                if (val) {
                  setSelectedProductId(val)
                  setValue("product_id", val, { shouldValidate: true })
                }
              }}
            >
              <SelectTrigger className="w-full" id="product_id" aria-invalid={!!errors.product_id}>
                <SelectValue placeholder="Select a product…">
                  {selectedProduct
                    ? `${selectedProduct.name} (${selectedProduct.sku})`
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.product_id && (
              <p className="text-xs text-destructive">{errors.product_id.message}</p>
            )}
          </div>

          {/* Branch */}
          <div className="space-y-1.5">
            <Label htmlFor="branch_id">Branch</Label>
            {isSuperAdmin ? (
              <Select<string>
                value={selectedBranchId}
                onValueChange={(val) => { if (val) setSelectedBranchId(val) }}
              >
                <SelectTrigger className="w-full" id="branch_id">
                  <SelectValue placeholder="Select a branch…">
                    {selectedBranch?.name ?? null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex h-8 items-center rounded-lg border border-input bg-muted/40 px-2.5 text-sm text-muted-foreground">
                {branches[0]?.name ?? "—"}
              </div>
            )}
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="type">Adjustment Type</Label>
            <Select<string>
              value={watchedType}
              onValueChange={(val) => {
                if (val) setValue("type", val as "adjustment" | "damage", { shouldValidate: true })
              }}
            >
              <SelectTrigger className="w-full" id="type" aria-invalid={!!errors.type}>
                <SelectValue>
                  {watchedType === "damage" ? "Damage" : "Adjustment"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adjustment">Adjustment</SelectItem>
                <SelectItem value="damage">Damage</SelectItem>
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-xs text-destructive">{errors.type.message}</p>
            )}
          </div>

          {/* Direction — only shown for Adjustment type */}
          {watchedType === "adjustment" && (
            <div className="space-y-1.5">
              <Label>Direction</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setValue("adjustment_direction", "add", { shouldValidate: true })}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    watchedDirection === "add"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-500"
                      : "border-border bg-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Add Stock
                </button>
                <button
                  type="button"
                  onClick={() => setValue("adjustment_direction", "remove", { shouldValidate: true })}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    watchedDirection === "remove"
                      ? "border-red-500 bg-red-500/10 text-red-500"
                      : "border-border bg-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  Remove Stock
                </button>
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-1.5">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              step={1}
              placeholder="0"
              aria-invalid={!!errors.quantity}
              {...register("quantity", { valueAsNumber: true })}
            />
            {errors.quantity && (
              <p className="text-xs text-destructive">{errors.quantity.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">
              Notes{" "}
              {watchedType === "damage" ? (
                <span className="text-destructive">*</span>
              ) : (
                <span className="text-muted-foreground text-xs">(optional)</span>
              )}
            </Label>
            <Textarea
              id="notes"
              placeholder={
                watchedType === "damage"
                  ? "Describe the damage…"
                  : "Optional notes…"
              }
              aria-invalid={!!errors.notes}
              {...register("notes")}
            />
            {errors.notes && (
              <p className="text-xs text-destructive">{errors.notes.message}</p>
            )}
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

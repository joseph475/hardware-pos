"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Search, X, KeyRound } from "lucide-react"
import { toast } from "sonner"
import { handleError } from "@/lib/utils/error-handler"
import { verifyManagerOverridePin } from "@/lib/actions/organization"

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
  hasManagerPin: boolean
  onSuccess: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function NewAdjustmentDialog({ products, branches, defaultBranchId, hasManagerPin, onSuccess }: Props) {
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [pinInput, setPinInput] = React.useState("")
  const [pinError, setPinError] = React.useState<string | null>(null)
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
  const [productSearch, setProductSearch] = React.useState("")
  const [productDropdownOpen, setProductDropdownOpen] = React.useState(false)
  const productResults = React.useMemo(() => {
    if (!productSearch.trim()) return []
    const q = productSearch.toLowerCase()
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 8)
  }, [productSearch, products])
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>(
    defaultBranchId || branches[0]?.id || ""
  )
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
      setProductSearch("")
      setProductDropdownOpen(false)
      setSelectedBranchId(defaultBranchId || branches[0]?.id || "")
      setPinInput("")
      setPinError(null)
    }
    setOpen(next)
  }

  async function onSubmit(values: FormValues) {
    if (!selectedBranchId) {
      toast.error("Please select a branch")
      return
    }
    setPinError(null)
    setSubmitting(true)
    try {
      if (hasManagerPin) {
        const valid = await verifyManagerOverridePin(pinInput)
        if (!valid) {
          setPinError("Incorrect PIN. Please try again.")
          setSubmitting(false)
          return
        }
      }
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
      handleError(err, 'save adjustment')
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

      <DialogContent className="flex flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Stock Adjustment</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Product */}
          <div className="space-y-1.5">
            <Label htmlFor="product_search">Product</Label>
            {selectedProduct ? (
              <div className="flex items-center justify-between rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium text-foreground truncate">{selectedProduct.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground font-mono">{selectedProduct.sku}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProductId("")
                    setValue("product_id", "", { shouldValidate: true })
                  }}
                  className="ml-2 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Clear product"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  id="product_search"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value)
                    setProductDropdownOpen(true)
                  }}
                  onFocus={() => { if (productResults.length > 0) setProductDropdownOpen(true) }}
                  onBlur={() => setTimeout(() => setProductDropdownOpen(false), 150)}
                  placeholder="Search by name or SKU…"
                  className={`pl-8 ${errors.product_id ? "border-destructive" : ""}`}
                  autoComplete="off"
                />
                {productDropdownOpen && productResults.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
                    {productResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onMouseDown={() => {
                          setSelectedProductId(p.id)
                          setValue("product_id", p.id, { shouldValidate: true })
                          setProductSearch("")
                          setProductDropdownOpen(false)
                        }}
                        className="w-full text-left px-3 py-2 flex items-center justify-between text-sm hover:bg-accent/50 transition-colors"
                      >
                        <span className="font-medium truncate">{p.name}</span>
                        <span className="ml-3 shrink-0 text-xs text-muted-foreground font-mono">{p.sku}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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

          {/* Manager PIN — only shown when org has a PIN configured */}
          {hasManagerPin && (
            <div className="space-y-1.5">
              <Label htmlFor="manager-pin" className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                Manager PIN <span className="text-destructive">*</span>
              </Label>
              <Input
                id="manager-pin"
                type="password"
                placeholder="Enter PIN to confirm"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))
                  setPinError(null)
                }}
                inputMode="numeric"
                maxLength={6}
                autoComplete="off"
                className={pinError ? "border-destructive" : ""}
              />
              {pinError && <p className="text-xs text-destructive">{pinError}</p>}
            </div>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={submitting || (hasManagerPin && pinInput.length < 4)}
            >
              {submitting ? "Saving…" : "Save Adjustment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

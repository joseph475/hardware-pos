"use client"

import * as React from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
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
import { Separator } from "@/components/ui/separator"
import { useCurrency } from "@/lib/context/currency"
import { createPurchaseOrder } from "@/lib/actions/purchasing"

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const lineItemSchema = z.object({
  product_id: z.string().min(1, "Product is required"),
  quantity_ordered: z
    .number({ message: "Enter a valid qty" })
    .int("Must be whole number")
    .positive("Qty must be > 0"),
  unit_cost: z
    .number({ message: "Enter a valid cost" })
    .min(0, "Cost must be ≥ 0"),
})

const schema = z.object({
  supplier_id: z.string().min(1, "Supplier is required"),
  branch_id: z.string().min(1, "Branch is required"),
  notes: z.string(),
  items: z.array(lineItemSchema).min(1, "At least one item is required"),
})

type FormValues = z.infer<typeof schema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  suppliers: Array<{ id: string; name: string }>
  branches: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string; sku: string; cost_price: number }>
  userBranchId: string | null
  userRole: "owner" | "manager" | "cashier"
  onSuccess: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function NewPOSheet({ suppliers, branches, products, userBranchId, userRole, onSuccess }: Props) {
  const { formatCurrency, currencyCode, locale } = useCurrency()
  const currencySymbol = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value ?? currencyCode,
    [locale, currencyCode],
  )
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const emptyDefaults: FormValues = {
    supplier_id: "",
    branch_id: userBranchId ?? "",
    notes: "",
    items: [{ product_id: "", quantity_ordered: undefined as unknown as number, unit_cost: undefined as unknown as number }],
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyDefaults,
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })
  const watchedItems = watch("items")
  const watchedSupplierId = watch("supplier_id")
  const watchedBranchId = watch("branch_id")

  const selectedSupplier = suppliers.find((s) => s.id === watchedSupplierId)
  const selectedBranch = branches.find((b) => b.id === watchedBranchId)

  const orderTotal = (watchedItems ?? []).reduce((sum, item) => {
    const qty = Number(item.quantity_ordered) || 0
    const cost = Number(item.unit_cost) || 0
    return sum + qty * cost
  }, 0)

  function handleOpenChange(next: boolean) {
    if (!next) {
      reset(emptyDefaults)
    }
    setOpen(next)
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true)
    try {
      await createPurchaseOrder({
        supplier_id: values.supplier_id,
        branch_id: values.branch_id,
        notes: values.notes,
        items: values.items,
      })
      toast.success("Purchase order created")
      setOpen(false)
      reset()
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create purchase order")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={<Button />}>
        <Plus className="h-4 w-4" />
        New PO
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Purchase Order</SheetTitle>
          <SheetDescription>Create a draft purchase order with line items.</SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 overflow-y-auto px-4 pb-0"
        >
          {/* ----------------------------------------------------------------
              Section 1 — Order Details
          ---------------------------------------------------------------- */}
          <div className="space-y-4 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Order Details
            </p>

            {/* Supplier */}
            <div className="space-y-1.5">
              <Label htmlFor="supplier_id">Supplier</Label>
              <Select<string>
                value={watchedSupplierId}
                onValueChange={(val) => {
                  if (val) setValue("supplier_id", val, { shouldValidate: true })
                }}
              >
                <SelectTrigger className="w-full" id="supplier_id" aria-invalid={!!errors.supplier_id}>
                  <SelectValue placeholder="Select a supplier…">
                    {selectedSupplier?.name ?? null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.supplier_id && (
                <p className="text-xs text-destructive">{errors.supplier_id.message}</p>
              )}
            </div>

            {/* Branch */}
            <div className="space-y-1.5">
              <Label htmlFor="branch_id">Branch</Label>
              {userRole === "manager" ? (
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {selectedBranch?.name ?? "—"}
                </div>
              ) : (
                <>
                  <Select<string>
                    value={watchedBranchId}
                    onValueChange={(val) => {
                      if (val) setValue("branch_id", val, { shouldValidate: true })
                    }}
                  >
                    <SelectTrigger className="w-full" id="branch_id" aria-invalid={!!errors.branch_id}>
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
                  {errors.branch_id && (
                    <p className="text-xs text-destructive">{errors.branch_id.message}</p>
                  )}
                </>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">
                Notes{" "}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Textarea
                id="notes"
                placeholder="Add any order notes…"
                {...register("notes")}
              />
            </div>
          </div>

          <Separator className="my-4" />

          {/* ----------------------------------------------------------------
              Section 2 — Line Items
          ---------------------------------------------------------------- */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Line Items
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    product_id: "",
                    quantity_ordered: undefined as unknown as number,
                    unit_cost: undefined as unknown as number,
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>

            {errors.items?.root && (
              <p className="text-xs text-destructive">{errors.items.root.message}</p>
            )}

            <div className="space-y-3">
              {fields.map((field, index) => {
                const qty = Number(watchedItems?.[index]?.quantity_ordered) || 0
                const cost = Number(watchedItems?.[index]?.unit_cost) || 0
                const lineTotal = qty * cost

                return (
                  <div
                    key={field.id}
                    className="rounded-lg border border-border bg-muted/20 p-3 space-y-3"
                  >
                    {/* Product select */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Product</Label>
                      <Select<string>
                        value={watchedItems?.[index]?.product_id ?? ""}
                        onValueChange={(val) => {
                          if (val) {
                            setValue(`items.${index}.product_id`, val, { shouldValidate: true })
                            const prod = products.find((p) => p.id === val)
                            if (prod) {
                              setValue(`items.${index}.unit_cost`, prod.cost_price, {
                                shouldValidate: true,
                              })
                            }
                          }
                        }}
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-invalid={!!errors.items?.[index]?.product_id}
                        >
                          <SelectValue placeholder="Select product…">
                            {(() => {
                              const prod = products.find(
                                (p) => p.id === watchedItems?.[index]?.product_id
                              )
                              return prod ? `${prod.name} (${prod.sku})` : null
                            })()}
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
                      {errors.items?.[index]?.product_id && (
                        <p className="text-xs text-destructive">
                          {errors.items[index]?.product_id?.message}
                        </p>
                      )}
                    </div>

                    {/* Qty + Cost + Total row */}
                    <div className="grid grid-cols-3 gap-2 items-end">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          placeholder="0"
                          className="h-8"
                          aria-invalid={!!errors.items?.[index]?.quantity_ordered}
                          {...register(`items.${index}.quantity_ordered`, { valueAsNumber: true })}
                        />
                        {errors.items?.[index]?.quantity_ordered && (
                          <p className="text-xs text-destructive">
                            {errors.items[index]?.quantity_ordered?.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Unit Cost ({currencySymbol})</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          className="h-8"
                          aria-invalid={!!errors.items?.[index]?.unit_cost}
                          {...register(`items.${index}.unit_cost`, { valueAsNumber: true })}
                        />
                        {errors.items?.[index]?.unit_cost && (
                          <p className="text-xs text-destructive">
                            {errors.items[index]?.unit_cost?.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Line Total</Label>
                        <div className="flex h-8 items-center rounded-lg border border-input bg-muted/40 px-2.5 text-sm font-medium tabular-nums">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>
                    </div>

                    {/* Remove row button */}
                    {fields.length > 1 && (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => remove(index)}
                          aria-label="Remove item"
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Spacer so footer doesn't overlap content */}
          <div className="flex-1 min-h-4" />
        </form>

        {/* ----------------------------------------------------------------
            Footer
        ---------------------------------------------------------------- */}
        <SheetFooter className="border-t border-border bg-background px-4 py-3 gap-0">
          <div className="flex w-full items-center justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Order Total: </span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatCurrency(orderTotal)}
              </span>
            </div>
            <div className="flex gap-2">
              <SheetClose render={<Button variant="outline" type="button" />}>
                Cancel
              </SheetClose>
              <Button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmit(onSubmit)()}
              >
                {submitting ? "Creating…" : "Create PO"}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

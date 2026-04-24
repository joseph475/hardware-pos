"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { PackageOpen, Search, Package, X, Minus, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { createBranchStockRequest } from "@/lib/actions/branch-requests"

const schema = z.object({
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Select a product"),
        productName: z.string(),
        sku: z.string(),
        imageUrl: z.string().nullable(),
        quantity: z.number().min(1, "Quantity must be at least 1"),
      })
    )
    .min(1, "Add at least one item"),
})

type FormValues = z.infer<typeof schema>

type ProductOption = {
  id: string
  name: string
  sku: string
  image_url: string | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Array<ProductOption>
}

export function NewRequestSheet({ open, onOpenChange, products }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [productSearch, setProductSearch] = React.useState("")
  const [dropdownOpen, setDropdownOpen] = React.useState(false)

  const filteredProducts = React.useMemo(() => {
    if (!productSearch.trim()) return []
    const q = productSearch.toLowerCase()
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 8)
  }, [productSearch, products])

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { notes: "", items: [] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })
  const watchedItems = watch("items")

  function handleSelectProduct(product: ProductOption) {
    const existingIndex = fields.findIndex((f) => f.productId === product.id)
    if (existingIndex >= 0) {
      const currentQty = Number(watchedItems[existingIndex]?.quantity) || 0
      setValue(`items.${existingIndex}.quantity`, currentQty + 1, { shouldValidate: true })
    } else {
      append({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        imageUrl: product.image_url,
        quantity: 1,
      })
    }
    setProductSearch("")
    setDropdownOpen(false)
  }

  function onSubmit(data: FormValues) {
    startTransition(async () => {
      try {
        await createBranchStockRequest({
          notes: data.notes ?? "",
          items: data.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        })
        toast.success("Stock request submitted")
        reset()
        onOpenChange(false)
        router.refresh()
      } catch (err) {
        toast.error("Failed to create request", {
          description: err instanceof Error ? err.message : "Unknown error",
        })
      }
    })
  }

  function handleOpenChange(val: boolean) {
    if (!val) {
      reset()
      setProductSearch("")
      setDropdownOpen(false)
    }
    onOpenChange(val)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b border-border shrink-0">
          <SheetTitle>New Stock Request</SheetTitle>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0"
        >
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Product search */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Line Items
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground" />
                <input
                  className="flex h-9 w-full rounded-md border border-input bg-background px-9 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Search by name or SKU to add items…"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value)
                    setDropdownOpen(e.target.value.length > 0)
                  }}
                  onFocus={() => productSearch.length > 0 && setDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                  autoComplete="off"
                />
                {productSearch && (
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 my-auto text-muted-foreground hover:text-foreground"
                    onMouseDown={() => {
                      setProductSearch("")
                      setDropdownOpen(false)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {dropdownOpen && filteredProducts.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                    {filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        onMouseDown={() => handleSelectProduct(product)}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-accent"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">
                            {product.name}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {product.sku}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {errors.items?.root && (
                <p className="text-xs text-destructive">{errors.items.root.message}</p>
              )}
              {errors.items && !errors.items.root && typeof errors.items.message === "string" && (
                <p className="text-xs text-destructive">{errors.items.message}</p>
              )}

              {/* Items list */}
              {fields.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-14 text-muted-foreground">
                  <PackageOpen className="h-8 w-8" />
                  <p className="text-sm">Search for products above to add items</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-border bg-muted/40 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Product</span>
                    <span className="text-center w-24">Quantity</span>
                    <span className="w-8" />
                  </div>
                  <div className="divide-y divide-border">
                    {fields.map((field, index) => {
                      const qty = Number(watchedItems?.[index]?.quantity) || 1
                      return (
                        <div
                          key={field.id}
                          className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-4 py-2.5"
                        >
                          {/* Product */}
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                              {field.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={field.imageUrl} alt={field.productName} className="h-full w-full object-cover" />
                              ) : (
                                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {field.productName}
                              </span>
                              <span className="block font-mono text-[11px] text-muted-foreground">
                                {field.sku}
                              </span>
                            </div>
                          </div>

                          {/* Qty controls */}
                          <div className="flex items-center gap-0.5 w-24">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-xs"
                              onClick={() =>
                                setValue(
                                  `items.${index}.quantity`,
                                  Math.max(1, qty - 1),
                                  { shouldValidate: true }
                                )
                              }
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              min={1}
                              aria-invalid={!!errors.items?.[index]?.quantity}
                              className="h-7 w-12 px-1 text-center text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-xs"
                              onClick={() =>
                                setValue(`items.${index}.quantity`, qty + 1, {
                                  shouldValidate: true,
                                })
                              }
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Remove */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => remove(index)}
                            className="w-8 text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>
                Notes{" "}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Textarea
                {...register("notes")}
                placeholder="Reason for request…"
                rows={2}
              />
            </div>
          </div>

          {/* Sticky footer */}
          <div className="shrink-0 border-t border-border px-6 py-4 flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {fields.length} item{fields.length !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || fields.length === 0}>
                {isPending ? "Submitting…" : "Submit Request"}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

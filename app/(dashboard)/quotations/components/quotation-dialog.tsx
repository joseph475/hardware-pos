'use client'

import * as React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { Trash2, PackageOpen, Search, Package, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { useCurrency } from '@/lib/context/currency'
import type { QuotationWithRelations } from '@/lib/actions/quotations'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const lineItemSchema = z.object({
  product_id: z.string().min(1, 'Product required'),
  product_name: z.string(),
  quantity: z.number({ message: 'Enter a valid qty' }).positive('Qty must be > 0'),
  unit_price: z.number({ message: 'Enter a valid price' }).min(0, 'Price must be ≥ 0'),
  discount_amount: z.number().min(0).optional(),
})

const quotationSchema = z.object({
  customer_id: z.string().min(1, 'Customer required'),
  branch_id: z.string().min(1, 'Branch required'),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
  discount_amount: z.number().min(0).optional(),
  items: z.array(lineItemSchema).min(1, 'At least one item required'),
})

export type QuotationFormValues = z.infer<typeof quotationSchema>

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
type ProductOption = {
  id: string
  name: string
  sku: string
  selling_price: number
  serial_required: boolean
  image_url: string | null
}

interface QuotationDialogProps {
  quotation?: QuotationWithRelations | null
  customers: Array<{ id: string; name: string; company_name: string | null }>
  branches: Array<{ id: string; name: string }>
  products: ProductOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (values: QuotationFormValues) => void
  isPending?: boolean
  preselectedCustomer?: { id: string | null; name: string | null } | null
  userRole: 'owner' | 'manager' | 'cashier'
  userBranchId: string | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function QuotationDialog({
  quotation,
  customers,
  branches,
  products,
  open,
  onOpenChange,
  onSave,
  isPending,
  preselectedCustomer,
  userRole,
  userBranchId,
}: QuotationDialogProps) {
  const { formatCurrency, currencyCode, locale } = useCurrency()
  const currencySymbol = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value ?? currencyCode,
    [locale, currencyCode]
  )

  const isReadOnly = quotation !== null && quotation !== undefined && quotation.status !== 'draft'

  // Local serial state keyed by field-array fieldId (UI-only, not persisted)
  const [itemSerials, setItemSerials] = React.useState<Record<string, string[]>>({})

  // Product search state
  const [productSearch, setProductSearch] = React.useState('')
  const [productDropdownOpen, setProductDropdownOpen] = React.useState(false)
  const productSearchRef = React.useRef<HTMLInputElement>(null)

  const filteredProducts = React.useMemo(() => {
    if (!productSearch.trim()) return []
    const q = productSearch.toLowerCase()
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [productSearch, products])

  const buildDefaults = React.useCallback((): QuotationFormValues => {
    if (quotation) {
      return {
        customer_id: quotation.customer_id,
        branch_id: quotation.branch_id,
        valid_until: quotation.valid_until ?? '',
        notes: quotation.notes ?? '',
        discount_amount: quotation.discount_amount,
        items: quotation.quotation_items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_amount: item.discount_amount,
        })),
      }
    }
    return {
      customer_id: preselectedCustomer?.id ?? '',
      branch_id: userBranchId ?? '',
      valid_until: '',
      notes: '',
      discount_amount: 0,
      items: [],
    }
  }, [quotation, preselectedCustomer, userBranchId])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: buildDefaults(),
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')
  const watchedCustomerId = watch('customer_id')
  const watchedBranchId = watch('branch_id')
  const watchedDiscount = watch('discount_amount')

  // Reset form when dialog opens/closes or quotation changes
  React.useEffect(() => {
    if (open) {
      reset(buildDefaults())
      setItemSerials({})
      setProductSearch('')
      setProductDropdownOpen(false)
    }
  }, [open, buildDefaults, reset])

  const subtotal = (watchedItems ?? []).reduce((sum, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unit_price) || 0
    const disc = Number(item.discount_amount) || 0
    return sum + (qty * price - disc)
  }, 0)
  const overallDiscount = Number(watchedDiscount) || 0
  const grandTotal = subtotal - overallDiscount

  function handleSelectProduct(product: ProductOption) {
    const existingIndex = fields.findIndex((f) => f.product_id === product.id)
    if (existingIndex >= 0) {
      const currentQty = Number(watchedItems[existingIndex]?.quantity) || 0
      const newQty = currentQty + 1
      setValue(`items.${existingIndex}.quantity`, newQty, { shouldValidate: true })
      // Resize serials if serial-required
      if (product.serial_required) {
        const fieldId = fields[existingIndex].id
        setItemSerials((prev) => ({
          ...prev,
          [fieldId]: [...(prev[fieldId] ?? []), ''],
        }))
      }
    } else {
      append({
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.selling_price,
        discount_amount: 0,
      })
      // Initialize serial slots after append (field id available next render)
      if (product.serial_required) {
        // We'll initialize on next render using a timeout
        setTimeout(() => {
          setItemSerials((prev) => {
            // Find the newly appended field
            const newFieldId = fields[fields.length]?.id
            if (!newFieldId) return prev
            return { ...prev, [newFieldId]: [''] }
          })
        }, 0)
      }
    }
    setProductSearch('')
    setProductDropdownOpen(false)
  }

  function handleRemoveItem(index: number) {
    const fieldId = fields[index]?.id
    remove(index)
    if (fieldId) {
      setItemSerials((prev) => {
        const next = { ...prev }
        delete next[fieldId]
        return next
      })
    }
  }

  function onSubmit(values: QuotationFormValues) {
    onSave(values)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {quotation ? (isReadOnly ? 'View Quotation' : 'Edit Quotation') : 'New Quotation'}
          </SheetTitle>
          <SheetDescription>
            {isReadOnly
              ? 'This quotation cannot be edited in its current status.'
              : 'Fill in quote details and line items.'}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col flex-1 overflow-y-auto px-4 pb-0"
        >
          {/* ----------------------------------------------------------------
              Section 1 — Quote Details
          ---------------------------------------------------------------- */}
          <div className="space-y-4 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quote Details
            </p>

            {/* Customer */}
            <div className="space-y-1.5">
              <Label htmlFor="customer_id">Customer</Label>
              {isReadOnly || (!quotation && preselectedCustomer?.id) ? (
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                  {preselectedCustomer?.name ??
                    customers.find((c) => c.id === watchedCustomerId)?.name ??
                    '—'}
                </div>
              ) : (
                <>
                  <Select<string>
                    value={watchedCustomerId}
                    onValueChange={(val) => {
                      if (val) setValue('customer_id', val, { shouldValidate: true })
                    }}
                  >
                    <SelectTrigger
                      className="w-full"
                      id="customer_id"
                      aria-invalid={!!errors.customer_id}
                    >
                      <SelectValue placeholder="Select a customer…">
                        {customers.find((c) => c.id === watchedCustomerId)?.name ??
                          'Select a customer…'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                          {c.company_name ? ` (${c.company_name})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.customer_id && (
                    <p className="text-xs text-destructive">{errors.customer_id.message}</p>
                  )}
                </>
              )}
            </div>

            {/* Branch */}
            <div className="space-y-1.5">
              <Label htmlFor="branch_id">Branch</Label>
              {isReadOnly || userRole !== 'owner' ? (
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                  {branches.find((b) => b.id === watchedBranchId)?.name ?? '—'}
                </div>
              ) : (
                <>
                  <Select<string>
                    value={watchedBranchId}
                    onValueChange={(val) => {
                      if (val) setValue('branch_id', val, { shouldValidate: true })
                    }}
                  >
                    <SelectTrigger
                      className="w-full"
                      id="branch_id"
                      aria-invalid={!!errors.branch_id}
                    >
                      <SelectValue placeholder="Select a branch…">
                        {branches.find((b) => b.id === watchedBranchId)?.name ??
                          'Select a branch…'}
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

            {/* Valid Until */}
            <div className="space-y-1.5">
              <Label htmlFor="valid_until">
                Valid Until{' '}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              {isReadOnly ? (
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                  {watch('valid_until') || '—'}
                </div>
              ) : (
                <Input
                  id="valid_until"
                  type="date"
                  className="w-full [color-scheme:dark]"
                  {...register('valid_until')}
                />
              )}
            </div>

            {/* Overall Discount */}
            <div className="space-y-1.5">
              <Label htmlFor="discount_amount">
                Overall Discount ({currencySymbol}){' '}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              {isReadOnly ? (
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                  {formatCurrency(quotation?.discount_amount ?? 0)}
                </div>
              ) : (
                <Input
                  id="discount_amount"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  {...register('discount_amount', { valueAsNumber: true })}
                />
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">
                Notes <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              {isReadOnly ? (
                <div className="min-h-[60px] w-full rounded-md border border-input bg-muted px-3 py-2 text-sm">
                  {watch('notes') || '—'}
                </div>
              ) : (
                <Textarea
                  id="notes"
                  placeholder="Add any notes for this quotation…"
                  {...register('notes')}
                />
              )}
            </div>
          </div>

          <Separator className="my-4" />

          {/* ----------------------------------------------------------------
              Section 2 — Line Items
          ---------------------------------------------------------------- */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Line Items
            </p>

            {/* Command bar product search — only in edit mode */}
            {!isReadOnly && (
              <div className="relative">
                <div className="relative">
                  <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground" />
                  <input
                    ref={productSearchRef}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-9 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Search by name or SKU to add items…"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value)
                      setProductDropdownOpen(e.target.value.length > 0)
                    }}
                    onFocus={() => productSearch.length > 0 && setProductDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setProductDropdownOpen(false), 150)}
                    autoComplete="off"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      className="absolute inset-y-0 right-3 my-auto text-muted-foreground hover:text-foreground"
                      onMouseDown={() => { setProductSearch(''); setProductDropdownOpen(false) }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown */}
                {productDropdownOpen && filteredProducts.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                    {filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        onMouseDown={() => handleSelectProduct(product)}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-accent"
                      >
                        {/* Thumbnail */}
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-foreground">
                              {product.name}
                            </span>
                            {product.serial_required && (
                              <Badge className="border-transparent bg-amber-500/15 text-[9px] text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
                                Serial req.
                              </Badge>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {product.sku}
                          </span>
                        </div>
                        {/* Price */}
                        <span className="shrink-0 text-sm font-semibold text-foreground">
                          {formatCurrency(product.selling_price)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {errors.items?.root && (
              <p className="text-xs text-destructive">{errors.items.root.message}</p>
            )}

            {/* Empty state */}
            {fields.length === 0 && !isReadOnly && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-8 text-muted-foreground">
                <PackageOpen className="h-6 w-6" />
                <p className="text-xs">Search for products above to add line items</p>
              </div>
            )}

            <div className="space-y-2">
              {fields.map((field, index) => {
                const qty = Number(watchedItems?.[index]?.quantity) || 0
                const price = Number(watchedItems?.[index]?.unit_price) || 0
                const disc = Number(watchedItems?.[index]?.discount_amount) || 0
                const lineTotal = qty * price - disc
                const product = products.find((p) => p.id === field.product_id)
                const sku = product?.sku ?? ''
                const isSerialRequired = product?.serial_required ?? false
                const fieldSerials = itemSerials[field.id] ?? []

                return (
                  <div
                    key={field.id}
                    className="rounded-lg border border-border bg-muted/20 p-3 space-y-2"
                  >
                    {/* Product name + SKU + remove */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex items-start gap-2">
                        {/* Thumbnail */}
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                          {product?.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.image_url}
                              alt={field.product_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium leading-tight truncate">
                              {watchedItems?.[index]?.product_name || '—'}
                            </p>
                            {isSerialRequired && (
                              <Badge className="border-transparent bg-amber-500/15 text-[9px] text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
                                Serial req.
                              </Badge>
                            )}
                          </div>
                          {sku && (
                            <p className="text-xs text-muted-foreground mt-0.5 font-mono">{sku}</p>
                          )}
                        </div>
                      </div>
                      {!isReadOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemoveItem(index)}
                          aria-label="Remove item"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Controls row */}
                    <div className="flex items-end gap-2 flex-wrap">
                      {/* Qty */}
                      <div className="space-y-1">
                        <Label className="text-xs">Qty</Label>
                        {isReadOnly ? (
                          <div className="flex h-8 w-16 items-center rounded-md border border-input bg-muted/40 px-2.5 text-sm tabular-nums">
                            {qty}
                          </div>
                        ) : (
                          <div className="flex items-center h-8 rounded-md border border-input overflow-hidden">
                            <button
                              type="button"
                              className="px-2 h-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-base leading-none"
                              onClick={() => {
                                const newQty = Math.max(1, qty - 1)
                                setValue(`items.${index}.quantity`, newQty, { shouldValidate: true })
                                if (isSerialRequired) {
                                  setItemSerials((prev) => ({
                                    ...prev,
                                    [field.id]: (prev[field.id] ?? []).slice(0, newQty),
                                  }))
                                }
                              }}
                            >
                              −
                            </button>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              className="h-full w-12 border-0 border-x border-input rounded-none text-center px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              aria-invalid={!!errors.items?.[index]?.quantity}
                              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                            />
                            <button
                              type="button"
                              className="px-2 h-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-base leading-none"
                              onClick={() => {
                                const newQty = qty + 1
                                setValue(`items.${index}.quantity`, newQty, { shouldValidate: true })
                                if (isSerialRequired) {
                                  setItemSerials((prev) => ({
                                    ...prev,
                                    [field.id]: [...(prev[field.id] ?? []), ''],
                                  }))
                                }
                              }}
                            >
                              +
                            </button>
                          </div>
                        )}
                        {errors.items?.[index]?.quantity && (
                          <p className="text-xs text-destructive">
                            {errors.items[index]?.quantity?.message}
                          </p>
                        )}
                      </div>

                      {/* Price */}
                      <div className="space-y-1">
                        <Label className="text-xs">Price ({currencySymbol})</Label>
                        {isReadOnly ? (
                          <div className="flex h-8 w-24 items-center rounded-md border border-input bg-muted/40 px-2.5 text-sm tabular-nums">
                            {price.toFixed(2)}
                          </div>
                        ) : (
                          <>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              placeholder="0.00"
                              className="h-8 w-24"
                              aria-invalid={!!errors.items?.[index]?.unit_price}
                              {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                            />
                            {errors.items?.[index]?.unit_price && (
                              <p className="text-xs text-destructive">
                                {errors.items[index]?.unit_price?.message}
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      {/* Discount */}
                      <div className="space-y-1">
                        <Label className="text-xs">Disc ({currencySymbol})</Label>
                        {isReadOnly ? (
                          <div className="flex h-8 w-20 items-center rounded-md border border-input bg-muted/40 px-2.5 text-sm tabular-nums">
                            {disc.toFixed(2)}
                          </div>
                        ) : (
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="0.00"
                            className="h-8 w-20"
                            {...register(`items.${index}.discount_amount`, {
                              valueAsNumber: true,
                            })}
                          />
                        )}
                      </div>

                      {/* Line total */}
                      <div className="space-y-1 ml-auto">
                        <Label className="text-xs text-muted-foreground">Total</Label>
                        <div className="flex h-8 items-center justify-end text-sm font-semibold tabular-nums text-foreground">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>
                    </div>

                    {/* Serial slots — UI only, not persisted to DB */}
                    {isSerialRequired && !isReadOnly && (
                      <div className="pt-1 space-y-1.5">
                        <p className="text-xs text-muted-foreground">
                          Serial numbers <span className="text-[10px]">(optional reference)</span>:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: qty }, (_, i) => (
                            <input
                              key={i}
                              className={cn(
                                'h-7 w-40 rounded border bg-background px-2 font-mono text-xs transition-colors',
                                fieldSerials[i]
                                  ? 'border-green-500/50 text-foreground'
                                  : 'border-border text-foreground placeholder:text-muted-foreground'
                              )}
                              placeholder={`SN ${i + 1}`}
                              value={fieldSerials[i] ?? ''}
                              onChange={(e) => {
                                setItemSerials((prev) => {
                                  const current = [...(prev[field.id] ?? [])]
                                  current[i] = e.target.value
                                  return { ...prev, [field.id]: current }
                                })
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1 min-h-4" />
        </form>

        {/* ----------------------------------------------------------------
            Footer
        ---------------------------------------------------------------- */}
        <SheetFooter className="border-t border-border bg-background px-4 py-3 gap-0">
          <div className="flex w-full items-center justify-between">
            <div className="text-sm space-y-0.5">
              <div>
                <span className="text-muted-foreground">Subtotal: </span>
                <span className="font-medium tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              {overallDiscount > 0 && (
                <div>
                  <span className="text-muted-foreground">Discount: </span>
                  <span className="font-medium tabular-nums text-destructive">
                    -{formatCurrency(overallDiscount)}
                  </span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Total: </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <SheetClose render={<Button variant="outline" type="button" />}>
                {isReadOnly ? 'Close' : 'Cancel'}
              </SheetClose>
              {!isReadOnly && (
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSubmit(onSubmit)()}
                >
                  {isPending ? 'Saving…' : quotation ? 'Update Quote' : 'Create Quote'}
                </Button>
              )}
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

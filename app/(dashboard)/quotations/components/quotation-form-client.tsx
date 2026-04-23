'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { ArrowLeft, PackageOpen, Search, Package, X, Minus, Plus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCurrency } from '@/lib/context/currency'
import { createQuotation, updateQuotation } from '@/lib/actions/quotations'
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
// Types
// ---------------------------------------------------------------------------
type ProductOption = {
  id: string
  name: string
  sku: string
  selling_price: number
  serial_required: boolean
  image_url: string | null
}

interface QuotationFormClientProps {
  quotation?: QuotationWithRelations | null
  customers: Array<{ id: string; name: string; company_name: string | null }>
  branches: Array<{ id: string; name: string }>
  products: ProductOption[]
  preselectedCustomerId?: string | null
  userRole: 'owner' | 'manager' | 'cashier'
  userBranchId: string | null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function QuotationFormClient({
  quotation,
  customers,
  branches,
  products,
  preselectedCustomerId,
  userRole,
  userBranchId,
}: QuotationFormClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { formatCurrency, currencyCode, locale } = useCurrency()
  const currencySymbol = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode })
        .formatToParts(0)
        .find((p) => p.type === 'currency')?.value ?? currencyCode,
    [locale, currencyCode]
  )

  const [productSearch, setProductSearch] = React.useState('')
  const [productDropdownOpen, setProductDropdownOpen] = React.useState(false)
  const [itemSerials, setItemSerials] = React.useState<Record<string, string[]>>({})
  const productSearchRef = React.useRef<HTMLInputElement>(null)

  const filteredProducts = React.useMemo(() => {
    if (!productSearch.trim()) return []
    const q = productSearch.toLowerCase()
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
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
      customer_id: preselectedCustomerId ?? '',
      branch_id: userBranchId ?? '',
      valid_until: '',
      notes: '',
      discount_amount: 0,
      items: [],
    }
  }, [quotation, preselectedCustomerId, userBranchId])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationSchema),
    defaultValues: buildDefaults(),
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')
  const watchedBranchId = watch('branch_id')
  const watchedDiscount = watch('discount_amount')
  const watchedCustomerId = watch('customer_id')

  const subtotal = (watchedItems ?? []).reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0) - (Number(item.discount_amount) || 0)
  }, 0)
  const overallDiscount = Number(watchedDiscount) || 0
  const grandTotal = subtotal - overallDiscount

  const customer = customers.find((c) => c.id === watchedCustomerId)
  const customerDisplayName = customer?.name ?? quotation?.customers?.name ?? '—'
  const pageTitle = quotation
    ? `Edit Quotation — ${quotation.customers?.name ?? ''}`
    : `New Quotation${customer ? ` — ${customer.name}` : ''}`

  function handleSelectProduct(product: ProductOption) {
    const existingIndex = fields.findIndex((f) => f.product_id === product.id)
    if (existingIndex >= 0) {
      const currentQty = Number(watchedItems[existingIndex]?.quantity) || 0
      setValue(`items.${existingIndex}.quantity`, currentQty + 1, { shouldValidate: true })
      if (product.serial_required) {
        const fieldId = fields[existingIndex].id
        setItemSerials((prev) => ({ ...prev, [fieldId]: [...(prev[fieldId] ?? []), ''] }))
      }
    } else {
      append({
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.selling_price,
        discount_amount: 0,
      })
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
    startTransition(async () => {
      try {
        if (quotation) {
          await updateQuotation(quotation.id, {
            customer_id: values.customer_id,
            branch_id: values.branch_id,
            valid_until: values.valid_until,
            notes: values.notes,
            discount_amount: values.discount_amount,
            items: values.items,
          })
          toast.success('Quotation updated')
        } else {
          await createQuotation({
            customer_id: values.customer_id,
            branch_id: values.branch_id,
            valid_until: values.valid_until,
            notes: values.notes,
            discount_amount: values.discount_amount,
            items: values.items,
          })
          toast.success('Quotation created')
        }
        router.push('/quotations')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save quotation')
      }
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => router.push('/quotations')}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          Quotations
        </Button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-sm font-semibold text-foreground flex-1">{pageTitle}</h1>
        {quotation && (
          <Badge className="bg-muted text-muted-foreground border-transparent text-xs capitalize">
            {quotation.status}
          </Badge>
        )}
      </div>

      {/* Two-column body */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 min-h-0">
        {/* Left — Line Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Line Items
          </p>

          {/* Product search */}
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
                  onMouseDown={() => {
                    setProductSearch('')
                    setProductDropdownOpen(false)
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {productDropdownOpen && filteredProducts.length > 0 && (
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
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-foreground">{product.name}</span>
                        {product.serial_required && (
                          <Badge className="border-transparent bg-amber-500/15 text-[9px] text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
                            Serial req.
                          </Badge>
                        )}
                      </div>
                      <span className="font-mono text-[11px] text-muted-foreground">{product.sku}</span>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-foreground">
                      {formatCurrency(product.selling_price)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {errors.items?.root && (
            <p className="text-xs text-destructive">{errors.items.root.message}</p>
          )}

          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-muted-foreground">
              <PackageOpen className="h-8 w-8" />
              <p className="text-sm">Search for products above to add line items</p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
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
                  <div key={field.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                        {product?.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image_url} alt={field.product_name} className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground truncate">
                            {watchedItems?.[index]?.product_name || '—'}
                          </span>
                          {isSerialRequired && (
                            <Badge className="border-transparent bg-amber-500/15 text-[9px] text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
                              Serial req.
                            </Badge>
                          )}
                        </div>
                        {sku && <span className="font-mono text-xs text-muted-foreground">{sku}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-xs"
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
                          <Minus className="h-3 w-3" />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          aria-invalid={!!errors.items?.[index]?.quantity}
                          className="h-6 w-12 px-1 text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          {...register(`items.${index}.quantity`, {
                            valueAsNumber: true,
                            onChange: (e) => {
                              const val = parseInt(e.target.value, 10)
                              if (!isNaN(val) && isSerialRequired) {
                                setItemSerials((prev) => {
                                  const current = prev[field.id] ?? []
                                  if (val > current.length) {
                                    return {
                                      ...prev,
                                      [field.id]: [...current, ...Array(val - current.length).fill('')],
                                    }
                                  }
                                  return { ...prev, [field.id]: current.slice(0, val) }
                                })
                              }
                            },
                          })}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-xs"
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
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          {formatCurrency(lineTotal)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleRemoveItem(index)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Price + Discount row */}
                    <div className="ml-13 mt-2 flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Price</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          aria-invalid={!!errors.items?.[index]?.unit_price}
                          className="h-6 w-24 text-right text-sm"
                          {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Disc ({currencySymbol})</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          className="h-6 w-20 text-right text-sm"
                          {...register(`items.${index}.discount_amount`, { valueAsNumber: true })}
                        />
                      </div>
                    </div>

                    {/* Serial slots */}
                    {isSerialRequired && (
                      <div className="ml-13 mt-2 space-y-1.5">
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
          )}
        </div>

        {/* Right — Details + Totals + Actions */}
        <div className="w-72 shrink-0 border-l border-border flex flex-col overflow-y-auto">
          <div className="flex-1 p-6 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quote Details
            </p>

            {/* Customer — always read-only */}
            <div className="space-y-1.5">
              <Label>Customer</Label>
              <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                {customerDisplayName}
              </div>
            </div>

            {/* Branch */}
            <div className="space-y-1.5">
              <Label htmlFor="branch_id">Branch</Label>
              {userRole === 'owner' ? (
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
                        {branches.find((b) => b.id === watchedBranchId)?.name ?? 'Select a branch…'}
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
              ) : (
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                  {branches.find((b) => b.id === watchedBranchId)?.name ?? '—'}
                </div>
              )}
            </div>

            {/* Valid Until */}
            <div className="space-y-1.5">
              <Label htmlFor="valid_until">
                Valid Until{' '}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="valid_until"
                type="date"
                className="w-full [color-scheme:dark]"
                {...register('valid_until')}
              />
            </div>

            {/* Overall Discount */}
            <div className="space-y-1.5">
              <Label htmlFor="discount_amount">
                Overall Discount ({currencySymbol}){' '}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="discount_amount"
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                {...register('discount_amount', { valueAsNumber: true })}
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">
                Notes <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Textarea
                id="notes"
                placeholder="Add any notes for this quotation…"
                {...register('notes')}
              />
            </div>
          </div>

          {/* Totals + Actions */}
          <div className="shrink-0 border-t border-border p-6 space-y-4">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              {overallDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="tabular-nums text-destructive">−{formatCurrency(overallDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Saving…' : quotation ? 'Update Quote' : 'Save Draft'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.push('/quotations')}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { ArrowLeft, PackageOpen, Search, Package, X, Minus, Plus, Percent } from 'lucide-react'
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
  add_tax_pct: z.number().min(0).max(100).optional(),
})

const quotationSchema = z.object({
  customer_id: z.string().min(1, 'Customer required'),
  branch_id: z.string().min(1, 'Branch required'),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
  discount_amount: z.number().min(0).optional(),
  tax_rate_pct: z.number().min(0).max(100).optional(),
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
        tax_rate_pct: Math.round(quotation.tax_rate * 10000) / 100,
        items: quotation.quotation_items.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_amount: item.discount_amount,
          add_tax_pct: item.add_tax_pct ?? 0,
        })),
      }
    }
    return {
      customer_id: preselectedCustomerId ?? '',
      branch_id: userBranchId ?? '',
      valid_until: '',
      notes: '',
      discount_amount: 0,
      tax_rate_pct: 0,
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
  const watchedTaxRatePct = watch('tax_rate_pct')

  const baseSubtotal = (watchedItems ?? []).reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
  }, 0)
  const addTaxTotal = (watchedItems ?? []).reduce((sum, item) => {
    return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 0) * ((Number(item.add_tax_pct) || 0) / 100)
  }, 0)
  const itemDiscounts = (watchedItems ?? []).reduce((sum, item) => sum + (Number(item.discount_amount) || 0), 0)
  const subtotal = baseSubtotal + addTaxTotal - itemDiscounts
  const overallDiscount = Number(watchedDiscount) || 0
  const taxRatePct = Number(watchedTaxRatePct) || 0
  const taxAmount = (subtotal - overallDiscount) * (taxRatePct / 100)
  const grandTotal = subtotal - overallDiscount + taxAmount

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
    } else {
      append({
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.selling_price,
        discount_amount: 0,
        add_tax_pct: 0,
      })
    }
    setProductSearch('')
    setProductDropdownOpen(false)
  }

  function handleRemoveItem(index: number) {
    remove(index)
  }

  function onSubmit(values: QuotationFormValues) {
    startTransition(async () => {
      try {
        const payload = {
          customer_id: values.customer_id,
          branch_id: values.branch_id,
          valid_until: values.valid_until,
          notes: values.notes,
          discount_amount: values.discount_amount,
          tax_rate: (Number(values.tax_rate_pct) || 0) / 100,
          items: values.items.map((item) => ({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_amount: item.discount_amount ?? 0,
            add_tax_pct: item.add_tax_pct ?? 0,
          })),
        }
        if (quotation) {
          await updateQuotation(quotation.id, payload)
          toast.success('Quotation updated')
        } else {
          await createQuotation(payload)
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

      {/* Body */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col-reverse md:flex-row flex-1 min-h-0 overflow-y-auto md:overflow-hidden">
        {/* Left — Line Items */}
        <div className="flex-1 md:overflow-y-auto p-4 md:p-6 space-y-4">
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
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="overflow-x-auto">
              {/* Table header */}
              <div className="grid grid-cols-[minmax(120px,1fr)_80px_64px_80px_96px_80px_40px] gap-x-2 border-b border-border bg-muted/40 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Item</span>
                <span className="text-right">Price</span>
                <span className="text-center">Tax%</span>
                <span className="text-right">Amount</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              <div className="divide-y divide-border">
                {fields.map((field, index) => {
                  const qty = Number(watchedItems?.[index]?.quantity) || 0
                  const price = Number(watchedItems?.[index]?.unit_price) || 0
                  const disc = Number(watchedItems?.[index]?.discount_amount) || 0
                  const addTaxPct = Number(watchedItems?.[index]?.add_tax_pct) || 0
                  const amount = price * (1 + addTaxPct / 100)
                  const lineTotal = qty * amount - disc
                  const product = products.find((p) => p.id === field.product_id)
                  const sku = product?.sku ?? ''

                  return (
                    <div key={field.id}>
                      <div className="grid grid-cols-[minmax(120px,1fr)_80px_64px_80px_96px_80px_40px] items-center gap-x-2 px-4 py-2">
                        {/* Item name */}
                        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                            {product?.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={product.image_url} alt={field.product_name} className="h-full w-full object-cover" />
                            ) : (
                              <Package className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate text-xs font-medium text-foreground">
                              {watchedItems?.[index]?.product_name || '—'}
                            </span>
                            {sku && <span className="block truncate font-mono text-[10px] text-muted-foreground">{sku}</span>}
                            {product?.serial_required && (
                              <Badge className="border-transparent bg-amber-500/15 text-[9px] text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
                                Serial req.
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Unit price input */}
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          aria-invalid={!!errors.items?.[index]?.unit_price}
                          className="h-7 text-right text-xs"
                          {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                        />

                        {/* Add Tax % input */}
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            placeholder="0"
                            className="h-7 w-full pr-4 text-right text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            {...register(`items.${index}.add_tax_pct`, { valueAsNumber: true })}
                          />
                          <Percent className="pointer-events-none absolute inset-y-0 right-1 my-auto h-2.5 w-2.5 text-muted-foreground" />
                        </div>

                        {/* Amount (computed) */}
                        <span className={cn(
                          'text-right text-xs tabular-nums',
                          addTaxPct > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                        )}>
                          {formatCurrency(amount)}
                        </span>

                        {/* Qty controls */}
                        <div className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            onClick={() => {
                              const newQty = Math.max(1, qty - 1)
                              setValue(`items.${index}.quantity`, newQty, { shouldValidate: true })
                            }}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            aria-invalid={!!errors.items?.[index]?.quantity}
                            className="h-7 w-10 px-1 text-center text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            onClick={() => {
                              const newQty = qty + 1
                              setValue(`items.${index}.quantity`, newQty, { shouldValidate: true })
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Line total */}
                        <span className="text-right text-xs font-semibold tabular-nums text-foreground">
                          {formatCurrency(lineTotal)}
                        </span>

                        {/* Remove */}
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
                  )
                })}
              </div>
              </div>
            </div>
          )}
        </div>

        {/* Right — Details + Totals + Actions */}
        <div className="w-full md:w-72 shrink-0 border-b md:border-b-0 md:border-l border-border flex flex-col">
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

            {/* Tax Rate */}
            <div className="space-y-1.5">
              <Label htmlFor="tax_rate_pct">
                Tax Rate (%){' '}
                <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <div className="relative">
                <Input
                  id="tax_rate_pct"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  placeholder="0"
                  className="pr-7"
                  {...register('tax_rate_pct', { valueAsNumber: true })}
                />
                <Percent className="pointer-events-none absolute inset-y-0 right-2.5 my-auto h-3.5 w-3.5 text-muted-foreground" />
              </div>
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
              {addTaxTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Add Tax</span>
                  <span className="tabular-nums text-blue-600 dark:text-blue-400">+{formatCurrency(addTaxTotal)}</span>
                </div>
              )}
              {overallDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="tabular-nums text-destructive">−{formatCurrency(overallDiscount)}</span>
                </div>
              )}
              {taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({taxRatePct}%)</span>
                  <span className="tabular-nums">+{formatCurrency(taxAmount)}</span>
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

'use client'

import * as React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { Plus, Trash2 } from 'lucide-react'

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
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { useCurrency } from '@/lib/context/currency'
import type { QuotationWithRelations } from '@/lib/actions/quotations'

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
interface QuotationDialogProps {
  quotation?: QuotationWithRelations | null
  customers: Array<{ id: string; name: string; company_name: string | null }>
  branches: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string; sku: string; selling_price: number }>
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (values: QuotationFormValues) => void
  isPending?: boolean
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
      customer_id: '',
      branch_id: '',
      valid_until: '',
      notes: '',
      discount_amount: 0,
      items: [
        {
          product_id: '',
          product_name: '',
          quantity: undefined as unknown as number,
          unit_price: undefined as unknown as number,
          discount_amount: 0,
        },
      ],
    }
  }, [quotation])

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
              {isReadOnly ? (
                <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                  {customers.find((c) => c.id === watchedCustomerId)?.name ?? '—'}
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
              {isReadOnly ? (
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
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Line Items
              </p>
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    append({
                      product_id: '',
                      product_name: '',
                      quantity: undefined as unknown as number,
                      unit_price: undefined as unknown as number,
                      discount_amount: 0,
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Item
                </Button>
              )}
            </div>

            {errors.items?.root && (
              <p className="text-xs text-destructive">{errors.items.root.message}</p>
            )}

            <div className="space-y-3">
              {fields.map((field, index) => {
                const qty = Number(watchedItems?.[index]?.quantity) || 0
                const price = Number(watchedItems?.[index]?.unit_price) || 0
                const disc = Number(watchedItems?.[index]?.discount_amount) || 0
                const lineTotal = qty * price - disc

                return (
                  <div
                    key={field.id}
                    className="rounded-lg border border-border bg-muted/20 p-3 space-y-3"
                  >
                    {/* Product select */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Product</Label>
                      {isReadOnly ? (
                        <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                          {watchedItems?.[index]?.product_name || '—'}
                        </div>
                      ) : (
                        <>
                          <Select<string>
                            value={watchedItems?.[index]?.product_id ?? ''}
                            onValueChange={(val) => {
                              if (val) {
                                const prod = products.find((p) => p.id === val)
                                setValue(`items.${index}.product_id`, val, {
                                  shouldValidate: true,
                                })
                                if (prod) {
                                  setValue(`items.${index}.product_name`, prod.name)
                                  setValue(`items.${index}.unit_price`, prod.selling_price, {
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
                        </>
                      )}
                    </div>

                    {/* Qty + Price + Discount + Total row */}
                    <div className="grid grid-cols-4 gap-2 items-end">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Qty</Label>
                        {isReadOnly ? (
                          <div className="flex h-8 items-center rounded-lg border border-input bg-muted/40 px-2.5 text-sm tabular-nums">
                            {qty}
                          </div>
                        ) : (
                          <>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              placeholder="0"
                              className="h-8"
                              aria-invalid={!!errors.items?.[index]?.quantity}
                              {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                            />
                            {errors.items?.[index]?.quantity && (
                              <p className="text-xs text-destructive">
                                {errors.items[index]?.quantity?.message}
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Price ({currencySymbol})</Label>
                        {isReadOnly ? (
                          <div className="flex h-8 items-center rounded-lg border border-input bg-muted/40 px-2.5 text-sm tabular-nums">
                            {price.toFixed(2)}
                          </div>
                        ) : (
                          <>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              placeholder="0.00"
                              className="h-8"
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

                      <div className="space-y-1.5">
                        <Label className="text-xs">Disc ({currencySymbol})</Label>
                        {isReadOnly ? (
                          <div className="flex h-8 items-center rounded-lg border border-input bg-muted/40 px-2.5 text-sm tabular-nums">
                            {disc.toFixed(2)}
                          </div>
                        ) : (
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="0.00"
                            className="h-8"
                            {...register(`items.${index}.discount_amount`, {
                              valueAsNumber: true,
                            })}
                          />
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Line Total</Label>
                        <div className="flex h-8 items-center rounded-lg border border-input bg-muted/40 px-2.5 text-sm font-medium tabular-nums">
                          {formatCurrency(lineTotal)}
                        </div>
                      </div>
                    </div>

                    {/* Remove row */}
                    {!isReadOnly && fields.length > 1 && (
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

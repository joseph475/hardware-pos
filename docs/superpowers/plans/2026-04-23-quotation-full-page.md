# Quotation Full-Page Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the narrow side-sheet quotation form with a dedicated full-page two-column layout for creating and editing draft quotations.

**Architecture:** A new `QuotationFormClient` component holds all form logic (extracted from `quotation-dialog.tsx`) and renders as a full page with line items on the left and metadata/totals on the right. Two new server-component routes (`/quotations/new` and `/quotations/[id]/edit`) fetch data and render the client. The list page (`quotations-client.tsx`) navigates to these routes instead of opening a Sheet.

**Tech Stack:** Next.js 16 App Router, React 19, React Hook Form v7, Zod v4, shadcn/ui (Base UI), Tailwind CSS v4, Supabase service role client, Clerk auth, Sonner toasts.

---

### Task 1: Create `quotation-form-client.tsx`

The full-page form component. Extracted from `quotation-dialog.tsx` with three key changes: no Sheet wrapper, uses `router.push('/quotations')` on save/cancel, and renders a two-column layout.

**Files:**
- Create: `app/(dashboard)/quotations/components/quotation-form-client.tsx`

- [ ] **Step 1: Create the file**

```tsx
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
                {customer?.name ?? '—'}
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
```

- [ ] **Step 2: Verify the file compiles (TypeScript check)**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | grep quotation-form-client
```

Expected: no output (no errors in this file).

- [ ] **Step 3: Commit**

```bash
git add app/\(dashboard\)/quotations/components/quotation-form-client.tsx
git commit -m "feat: add QuotationFormClient full-page form component"
```

---

### Task 2: Create `/quotations/new` page and skeleton

**Files:**
- Create: `app/(dashboard)/quotations/new/page.tsx`
- Create: `app/(dashboard)/quotations/new/loading.tsx`

- [ ] **Step 1: Create `app/(dashboard)/quotations/new/page.tsx`**

```tsx
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { QuotationFormClient } from '../components/quotation-form-client'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface Props {
  searchParams: Promise<{ customer_id?: string }>
}

export default async function NewQuotationPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { customer_id } = await searchParams

  // Redirect back if no customer selected
  if (!customer_id) redirect('/quotations')

  const supabase = getAdminClient()

  let userRole: 'owner' | 'manager' | 'cashier' = 'cashier'
  let userBranchId: string | null = null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('clerk_user_id', userId)
    .single()

  userRole = profile?.role ?? 'cashier'
  userBranchId = profile?.branch_id ?? null

  const [branchesResult, productsResult] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name')
      .eq('org_id', '00000000-0000-0000-0000-000000000001')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('products')
      .select('id, name, sku, selling_price, serial_required, image_url')
      .eq('org_id', '00000000-0000-0000-0000-000000000001')
      .eq('is_active', true)
      .order('name'),
  ])

  const { data: customerData } = await supabase
    .from('customers')
    .select('id, name, company_name')
    .eq('id', customer_id)
    .single()

  const customers = customerData
    ? [{ id: customerData.id, name: customerData.name, company_name: customerData.company_name }]
    : []

  const branches = (branchesResult.data ?? []) as Array<{ id: string; name: string }>
  const products = (productsResult.data ?? []) as Array<{
    id: string
    name: string
    sku: string
    selling_price: number
    serial_required: boolean
    image_url: string | null
  }>

  return (
    <QuotationFormClient
      customers={customers}
      branches={branches}
      products={products}
      preselectedCustomerId={customer_id}
      userRole={userRole}
      userBranchId={userBranchId}
    />
  )
}
```

- [ ] **Step 2: Create `app/(dashboard)/quotations/new/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function NewQuotationLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3 shrink-0">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-px" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0">
        {/* Left */}
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
          <div className="rounded-lg border border-border overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0">
                <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="w-72 shrink-0 border-l border-border p-6 space-y-4">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <div className="pt-4 border-t border-border space-y-2 mt-auto">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | grep "quotations/new"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/quotations/new/page.tsx" "app/(dashboard)/quotations/new/loading.tsx"
git commit -m "feat: add /quotations/new full-page route"
```

---

### Task 3: Create `/quotations/[id]/edit` page and skeleton

**Files:**
- Create: `app/(dashboard)/quotations/[id]/edit/page.tsx`
- Create: `app/(dashboard)/quotations/[id]/edit/loading.tsx`

- [ ] **Step 1: Create `app/(dashboard)/quotations/[id]/edit/page.tsx`**

```tsx
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import { getQuotations } from '@/lib/actions/quotations'
import { QuotationFormClient } from '../../components/quotation-form-client'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditQuotationPage({ params }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params
  const supabase = getAdminClient()

  let userRole: 'owner' | 'manager' | 'cashier' = 'cashier'
  let userBranchId: string | null = null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, branch_id')
    .eq('clerk_user_id', userId)
    .single()

  userRole = profile?.role ?? 'cashier'
  userBranchId = profile?.branch_id ?? null

  // Fetch all quotations and find the one by id (reuses existing action with relations)
  const quotations = await getQuotations()
  const quotation = quotations.find((q) => q.id === id) ?? null

  if (!quotation) notFound()
  if (quotation.status !== 'draft') redirect('/quotations')

  const [customersResult, branchesResult, productsResult] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, company_name')
      .eq('org_id', '00000000-0000-0000-0000-000000000001')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('branches')
      .select('id, name')
      .eq('org_id', '00000000-0000-0000-0000-000000000001')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('products')
      .select('id, name, sku, selling_price, serial_required, image_url')
      .eq('org_id', '00000000-0000-0000-0000-000000000001')
      .eq('is_active', true)
      .order('name'),
  ])

  const customers = (customersResult.data ?? []) as Array<{
    id: string
    name: string
    company_name: string | null
  }>

  const branches = (branchesResult.data ?? []) as Array<{ id: string; name: string }>

  const products = (productsResult.data ?? []) as Array<{
    id: string
    name: string
    sku: string
    selling_price: number
    serial_required: boolean
    image_url: string | null
  }>

  return (
    <QuotationFormClient
      quotation={quotation}
      customers={customers}
      branches={branches}
      products={products}
      userRole={userRole}
      userBranchId={userBranchId}
    />
  )
}
```

- [ ] **Step 2: Create `app/(dashboard)/quotations/[id]/edit/loading.tsx`**

```tsx
import { Skeleton } from '@/components/ui/skeleton'

export default function EditQuotationLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3 shrink-0">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-px" />
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-5 w-16 rounded-full ml-auto" />
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0">
        {/* Left */}
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
          <div className="rounded-lg border border-border overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0">
                <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="w-72 shrink-0 border-l border-border p-6 space-y-4">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <div className="pt-4 border-t border-border space-y-2 mt-auto">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | grep "quotations/\[id\]"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/quotations/[id]/edit/page.tsx" "app/(dashboard)/quotations/[id]/edit/loading.tsx"
git commit -m "feat: add /quotations/[id]/edit full-page route"
```

---

### Task 4: Update `quotations-client.tsx` to navigate instead of opening Sheet

Replace the Sheet open logic with `router.push`. Remove `dialogOpen`, `editingQuotation`, `isPending`, `handleSave`, `pendingCustomer` state that were only used for the sheet. Keep everything else (status tabs, search, detail sheet for non-drafts, action handlers for mark-sent/approve/reject/delete).

**Files:**
- Modify: `app/(dashboard)/quotations/quotations-client.tsx`

- [ ] **Step 1: Update the file**

Replace the full contents of `quotations-client.tsx` with:

```tsx
'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Plus, Search, Send, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrency } from '@/lib/context/currency'
import {
  deleteQuotation,
  updateQuotationStatus,
  approveQuotation,
} from '@/lib/actions/quotations'
import type { QuotationWithRelations } from '@/lib/actions/quotations'
import type { QuotationStatus } from '@/types/database'
import { QuotationDetailSheet } from './components/quotation-detail-sheet'
import { CustomerSelectDialog } from '@/components/pos/customer-select-dialog'

type StatusFilter = QuotationStatus | 'all'

interface Props {
  initialQuotations: QuotationWithRelations[]
  customers: Array<{ id: string; name: string; company_name: string | null }>
  branches: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string; sku: string; selling_price: number; serial_required: boolean; image_url: string | null }>
  userRole: 'owner' | 'manager' | 'cashier'
  userBranchId: string | null
}

const STATUS_CONFIG: Record<QuotationStatus, { label: string; className: string }> = {
  draft:     { label: 'Draft',     className: 'bg-muted text-muted-foreground border-transparent' },
  sent:      { label: 'Sent',      className: 'bg-blue-500/15 text-blue-500 border-transparent' },
  accepted:  { label: 'Accepted',  className: 'bg-green-500/15 text-green-600 border-transparent' },
  rejected:  { label: 'Rejected',  className: 'bg-red-500/15 text-red-500 border-transparent' },
  expired:   { label: 'Expired',   className: 'bg-orange-500/15 text-orange-500 border-transparent' },
  converted: { label: 'Converted', className: 'bg-emerald-500/15 text-emerald-500 border-transparent' },
}

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all',       label: 'All' },
  { value: 'draft',     label: 'Draft' },
  { value: 'sent',      label: 'Sent' },
  { value: 'accepted',  label: 'Accepted' },
  { value: 'converted', label: 'Converted' },
  { value: 'rejected',  label: 'Rejected' },
]

export function QuotationsClient({
  initialQuotations,
  customers,
  branches: _branches,
  products,
  userRole,
  userBranchId,
}: Props) {
  const router = useRouter()
  const { formatCurrency } = useCurrency()

  const [quotations, setQuotations] = React.useState(initialQuotations)
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [search, setSearch] = React.useState('')
  const [detailSheetOpen, setDetailSheetOpen] = React.useState(false)
  const [viewingQuotation, setViewingQuotation] = React.useState<QuotationWithRelations | null>(null)
  const [customerStepOpen, setCustomerStepOpen] = React.useState(false)

  React.useEffect(() => {
    setQuotations(initialQuotations)
  }, [initialQuotations])

  const filtered = quotations.filter((q) => {
    const matchStatus = statusFilter === 'all' || q.status === statusFilter
    const customerName = q.customers?.name?.toLowerCase() ?? ''
    const matchSearch = !search || customerName.includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  async function handleMarkSent(id: string) {
    try {
      await updateQuotationStatus(id, 'sent')
      toast.success('Quotation marked as sent')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  async function handleApprove(id: string) {
    try {
      await approveQuotation(id)
      toast.success('Quotation approved — sale recorded')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve quotation')
    }
  }

  async function handleReject(id: string) {
    try {
      await updateQuotationStatus(id, 'rejected')
      toast.success('Quotation rejected')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteQuotation(id)
      toast.success('Quotation deleted')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete quotation')
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Quotations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create and manage price quotes for customers
          </p>
        </div>
        <Button
          onClick={() => setCustomerStepOpen(true)}
        >
          <Plus className="h-4 w-4" />
          New Quotation
        </Button>
      </div>

      {/* Status tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {quotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-sm">No quotations yet. Create one to get started.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-sm">No quotations match your filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="pl-4">Quote ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-10 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q) => {
                  const { label, className } = STATUS_CONFIG[q.status]
                  const canEdit = q.status === 'draft'
                  const canMarkSent = q.status === 'draft'
                  const canApprove = q.status !== 'converted' && q.status !== 'rejected'
                  const canReject = q.status === 'draft' || q.status === 'sent' || q.status === 'accepted'
                  const canDelete = q.status === 'draft'

                  return (
                    <TableRow
                      key={q.id}
                      className="border-b border-border/50 cursor-pointer"
                      onClick={() => {
                        if (q.status === 'draft') {
                          router.push(`/quotations/${q.id}/edit`)
                        } else {
                          setViewingQuotation(q)
                          setDetailSheetOpen(true)
                        }
                      }}
                    >
                      <TableCell className="pl-4">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {q.id.slice(0, 8).toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {q.customers?.name ?? '—'}
                        {q.customers?.company_name && (
                          <span className="text-muted-foreground text-xs ml-1">
                            ({q.customers.company_name})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {q.branches?.name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={className}>{label}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {q.valid_until ? q.valid_until.slice(0, 10) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium text-foreground">
                        {formatCurrency(q.total)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {q.creator?.full_name ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {q.created_at.slice(0, 10)}
                      </TableCell>
                      <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon-sm" aria-label="Actions" />
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canEdit && (
                              <DropdownMenuItem
                                onClick={() => router.push(`/quotations/${q.id}/edit`)}
                              >
                                Edit
                              </DropdownMenuItem>
                            )}
                            {!canEdit && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setViewingQuotation(q)
                                  setDetailSheetOpen(true)
                                }}
                              >
                                View Details
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {canMarkSent && (
                              <DropdownMenuItem onClick={() => handleMarkSent(q.id)}>
                                <Send className="h-4 w-4" />
                                Mark as Sent
                              </DropdownMenuItem>
                            )}
                            {canApprove && (
                              <DropdownMenuItem onClick={() => handleApprove(q.id)}>
                                <CheckCircle className="h-4 w-4" />
                                Approve
                              </DropdownMenuItem>
                            )}
                            {canReject && (
                              <DropdownMenuItem onClick={() => handleReject(q.id)}>
                                <XCircle className="h-4 w-4" />
                                Reject
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => handleDelete(q.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-right">
        Showing {filtered.length} of {quotations.length} quotations
      </p>

      {/* Customer picker — navigates to /quotations/new on confirm */}
      <CustomerSelectDialog
        open={customerStepOpen}
        onOpenChange={setCustomerStepOpen}
        customers={customers.map((c) => ({ ...c, email: null, phone: null, is_active: true }))}
        onConfirm={(id) => {
          setCustomerStepOpen(false)
          router.push(`/quotations/new?customer_id=${id}`)
        }}
      />

      {/* Detail sheet — non-draft view only */}
      <QuotationDetailSheet
        quotation={viewingQuotation}
        productMeta={products.map((p) => ({
          id: p.id,
          image_url: p.image_url,
          serial_required: p.serial_required,
        }))}
        open={detailSheetOpen}
        onOpenChange={(open) => {
          setDetailSheetOpen(open)
          if (!open) setViewingQuotation(null)
        }}
        onMarkSent={async (id) => {
          await handleMarkSent(id)
          setDetailSheetOpen(false)
          setViewingQuotation(null)
        }}
        onApprove={async (id) => {
          await handleApprove(id)
          setDetailSheetOpen(false)
          setViewingQuotation(null)
        }}
        onReject={async (id) => {
          await handleReject(id)
          setDetailSheetOpen(false)
          setViewingQuotation(null)
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1 | grep quotations-client
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/quotations/quotations-client.tsx"
git commit -m "feat: navigate to full-page form for draft quotation create/edit"
```

---

### Task 5: Delete `quotation-dialog.tsx` and final type-check

**Files:**
- Delete: `app/(dashboard)/quotations/components/quotation-dialog.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm "app/(dashboard)/quotations/components/quotation-dialog.tsx"
```

- [ ] **Step 2: Full project type-check — confirm no remaining imports**

```bash
cd /Users/joseph-macbookpro-m3/Documents/Apps/practice/hardware-pos && npx tsc --noEmit 2>&1
```

Expected: no errors. If any file still imports from `quotation-dialog`, update the import to `quotation-form-client` or remove it.

- [ ] **Step 3: Start the dev server and manually test the golden paths**

```bash
npm run dev
```

Test checklist (do each manually in the browser at http://localhost:3000):
1. Navigate to `/quotations`
2. Click **New Quotation** → customer picker appears
3. Select a customer → browser navigates to `/quotations/new?customer_id=...`
4. Page shows two-column layout with customer pre-filled and read-only
5. Search for a product and add it → appears in the left column with qty stepper
6. Adjust unit price and discount on a line item
7. Fill in valid until and notes on the right
8. Click **Save Draft** → toast "Quotation created" → redirected to `/quotations`
9. Find the new draft row, click it → navigates to `/quotations/[id]/edit`
10. Edit an item, click **Update Quote** → toast "Quotation updated" → redirected to `/quotations`
11. Click a non-draft row → `QuotationDetailSheet` opens (unchanged behavior)
12. Click **Cancel** on the form → returns to `/quotations` without saving

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove quotation-dialog.tsx (replaced by full-page form)"
```

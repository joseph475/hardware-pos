'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, PackageOpen } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProductSearchInput } from '@/components/pos/product-search-input'
import { createTransfer } from '@/lib/actions/transfers'
import type { Branch, Product } from '@/types/database'

interface LineItem {
  productId: string
  quantity: number
}

interface NewTransferSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  branches: Branch[]
  products: Product[]
  userBranchId: string | null
  isOwner: boolean
  inventoryMap: Record<string, Record<string, number>>
}

export function NewTransferSheet({
  open,
  onOpenChange,
  branches,
  products,
  userBranchId,
  isOwner,
  inventoryMap,
}: NewTransferSheetProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [fromBranchId, setFromBranchId] = React.useState(userBranchId ?? '')
  const [toBranchId, setToBranchId] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [items, setItems] = React.useState<LineItem[]>([])
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setFromBranchId(userBranchId ?? '')
      setToBranchId('')
      setNotes('')
      setItems([])
      setError(null)
    }
  }, [open, userBranchId])

  function getStock(productId: string): number {
    if (!fromBranchId) return 0
    return inventoryMap[fromBranchId]?.[productId] ?? 0
  }

  function handleFromBranchChange(val: string | null) {
    const branchId = val ?? ''
    setFromBranchId(branchId)
    if (toBranchId === branchId) setToBranchId('')
    setItems((prev) =>
      prev
        .map((item) => {
          const stock = inventoryMap[branchId]?.[item.productId] ?? 0
          return { ...item, quantity: Math.min(item.quantity, Math.max(stock, 0)) }
        })
        .filter((item) => {
          const stock = inventoryMap[branchId]?.[item.productId] ?? 0
          return stock > 0
        })
    )
  }

  function handleAddProduct(prod: { id: string; name: string; sku: string }) {
    if (!fromBranchId) {
      setError('Select a source branch first.')
      return
    }
    const stock = getStock(prod.id)
    if (stock <= 0) return // product has no stock, ProductSearchInput already filters
    const exists = items.findIndex((i) => i.productId === prod.id)
    if (exists >= 0) {
      setItems((prev) =>
        prev.map((item, i) =>
          i === exists
            ? { ...item, quantity: Math.min(item.quantity + 1, stock) }
            : item
        )
      )
    } else {
      setItems((prev) => [...prev, { productId: prod.id, quantity: 1 }])
    }
    setError(null)
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function setQuantity(index: number, qty: number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        const stock = getStock(item.productId)
        return { ...item, quantity: Math.max(1, Math.min(qty, stock)) }
      })
    )
  }

  function handleSubmit() {
    if (!fromBranchId) { setError('Select a source branch.'); return }
    if (!toBranchId) { setError('Select a destination branch.'); return }
    if (fromBranchId === toBranchId) { setError('Source and destination must be different.'); return }
    if (items.length === 0) { setError('Add at least one item.'); return }

    for (const item of items) {
      const stock = getStock(item.productId)
      if (item.quantity > stock) {
        const name = products.find((p) => p.id === item.productId)?.name ?? 'Item'
        setError(`${name}: quantity exceeds available stock (${stock}).`)
        return
      }
    }

    setError(null)
    startTransition(async () => {
      try {
        await createTransfer({
          fromBranchId,
          toBranchId,
          notes,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        })
        router.refresh()
        onOpenChange(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  const toBranchOptions = branches.filter((b) => b.id !== fromBranchId)

  // Products that still have stock in the source branch, and not already added
  const addedIds = new Set(items.map((i) => i.productId))
  const searchableProducts = fromBranchId
    ? products.filter((p) => {
        const stock = inventoryMap[fromBranchId]?.[p.id] ?? 0
        return stock > 0
      })
    : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Stock Transfer</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col flex-1 overflow-y-auto px-4 pb-0">
          {/* Branches */}
          <div className="space-y-4 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Transfer Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>From Branch <span className="text-destructive">*</span></Label>
                {isOwner ? (
                  <Select value={fromBranchId} onValueChange={handleFromBranchChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select branch">
                        {branches.find((b) => b.id === fromBranchId)?.name ?? 'Select branch'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                    {branches.find((b) => b.id === fromBranchId)?.name ?? '—'}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>To Branch <span className="text-destructive">*</span></Label>
                <Select
                  value={toBranchId}
                  onValueChange={(v: string | null) => setToBranchId(v ?? '')}
                  disabled={!fromBranchId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select branch">
                      {branches.find((b) => b.id === toBranchId)?.name ?? 'Select branch'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {toBranchOptions.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="transfer-notes">
                Notes <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Textarea
                id="transfer-notes"
                placeholder="Add any notes…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <Separator className="my-4" />

          {/* Line Items */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Items
            </p>

            <ProductSearchInput
              products={searchableProducts.map((p) => ({ id: p.id, name: p.name, sku: p.sku ?? '' }))}
              onSelect={handleAddProduct}
              placeholder={
                !fromBranchId
                  ? 'Select a source branch first…'
                  : 'Search by name or SKU to add items…'
              }
              disabled={!fromBranchId}
            />

            {/* Empty state */}
            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-8 text-muted-foreground">
                <PackageOpen className="h-6 w-6" />
                <p className="text-xs">Search for products above to add items</p>
              </div>
            )}

            <div className="space-y-2">
              {items.map((item, index) => {
                const product = products.find((p) => p.id === item.productId)
                const stock = getStock(item.productId)
                const name = product?.name ?? '—'
                const sku = product?.sku ?? ''

                return (
                  <div
                    key={item.productId}
                    className="rounded-lg border border-border bg-muted/20 p-3 space-y-2"
                  >
                    {/* Product name + SKU + remove */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">{name}</p>
                        {sku && <p className="text-xs text-muted-foreground mt-0.5">{sku}</p>}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeItem(index)}
                        aria-label="Remove item"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Controls row */}
                    <div className="flex items-end gap-2">
                      {/* Qty stepper */}
                      <div className="space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <div className="flex items-center h-8 rounded-md border border-input overflow-hidden">
                          <button
                            type="button"
                            className="px-2 h-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-base leading-none"
                            onClick={() => setQuantity(index, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                          >
                            −
                          </button>
                          <Input
                            type="number"
                            min={1}
                            max={stock}
                            step={1}
                            value={item.quantity}
                            onChange={(e) => setQuantity(index, parseInt(e.target.value) || 1)}
                            className="h-full w-12 border-0 border-x border-input rounded-none text-center px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            className="px-2 h-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-base leading-none disabled:opacity-40"
                            onClick={() => setQuantity(index, item.quantity + 1)}
                            disabled={item.quantity >= stock}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Available stock badge */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Available</Label>
                        <div
                          className={`flex h-8 items-center px-2 rounded-md text-xs font-medium tabular-nums ${
                            stock === 0
                              ? 'bg-destructive/10 text-destructive'
                              : item.quantity >= stock
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {stock} in stock
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex-1 min-h-4" />
        </div>

        {error && (
          <div className="px-4 pb-2">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <SheetFooter className="border-t border-border bg-background px-4 py-3 gap-0">
          <div className="flex w-full items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-2">
              <SheetClose render={<Button variant="outline" type="button" />} disabled={isPending}>
                Cancel
              </SheetClose>
              <Button onClick={handleSubmit} disabled={isPending || items.length === 0}>
                {isPending ? 'Creating…' : 'Create Transfer'}
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

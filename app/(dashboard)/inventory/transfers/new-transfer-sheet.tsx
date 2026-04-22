'use client'

import * as React from 'react'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
}

export function NewTransferSheet({ open, onOpenChange, branches, products }: NewTransferSheetProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [fromBranchId, setFromBranchId] = React.useState('')
  const [toBranchId, setToBranchId] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [items, setItems] = React.useState<LineItem[]>([{ productId: '', quantity: 1 }])
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setFromBranchId('')
      setToBranchId('')
      setNotes('')
      setItems([{ productId: '', quantity: 1 }])
      setError(null)
    }
  }, [open])

  function addItem() {
    setItems((prev) => [...prev, { productId: '', quantity: 1 }])
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  function handleFromBranchChange(val: string | null) {
    setFromBranchId(val ?? '')
    if (toBranchId === val) setToBranchId('')
  }

  function handleSubmit() {
    if (!fromBranchId) { setError('Select a source branch.'); return }
    if (!toBranchId) { setError('Select a destination branch.'); return }
    if (fromBranchId === toBranchId) { setError('Source and destination must be different.'); return }
    if (items.some((i) => !i.productId)) { setError('Select a product for each line item.'); return }
    if (items.some((i) => i.quantity < 1)) { setError('Quantity must be at least 1.'); return }

    setError(null)
    startTransition(async () => {
      try {
        await createTransfer({ fromBranchId, toBranchId, notes, items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })) })
        router.refresh()
        onOpenChange(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  const toBranchOptions = branches.filter((b) => b.id !== fromBranchId)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Stock Transfer</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 px-4 py-4">
          {/* Branches */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>From Branch <span className="text-destructive">*</span></Label>
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
            </div>
            <div className="space-y-1.5">
              <Label>To Branch <span className="text-destructive">*</span></Label>
              <Select value={toBranchId} onValueChange={(v) => setToBranchId(v ?? '')} disabled={!fromBranchId}>
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

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items <span className="text-destructive">*</span></Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>
            {items.map((item, index) => {
              const selectedElsewhere = new Set(
                items.filter((_, i) => i !== index).map((i) => i.productId)
              )
              return (
              <div key={index} className="flex gap-2 items-center">
                <div className="flex-1">
                  <Select value={item.productId} onValueChange={(v) => updateItem(index, 'productId', v ?? '')}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select product">
                        {products.find((p) => p.id === item.productId)?.name ?? 'Select product'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {products.filter((p) => !selectedElsewhere.has(p.id)).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(index, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20"
                />
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              )
            })}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="transfer-notes">Notes</Label>
            <Textarea
              id="transfer-notes"
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <SheetFooter className="px-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'Creating…' : 'Create Transfer'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

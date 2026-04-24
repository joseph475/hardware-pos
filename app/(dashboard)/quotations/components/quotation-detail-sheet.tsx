'use client'

import * as React from 'react'
import { Send, CheckCircle, XCircle, Package, Printer } from 'lucide-react'
import { QuotationPrintDialog } from '@/components/quotations/quotation-print-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetFooter,
} from '@/components/ui/sheet'
import { useCurrency } from '@/lib/context/currency'
import type { QuotationWithRelations } from '@/lib/actions/quotations'
import type { QuotationStatus } from '@/types/database'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<QuotationStatus, { label: string; className: string }> = {
  draft:     { label: 'Draft',     className: 'bg-muted text-muted-foreground border-transparent' },
  sent:      { label: 'Sent',      className: 'bg-blue-500/15 text-blue-500 border-transparent' },
  accepted:  { label: 'Accepted',  className: 'bg-green-500/15 text-green-600 border-transparent' },
  rejected:  { label: 'Rejected',  className: 'bg-red-500/15 text-red-500 border-transparent' },
  expired:   { label: 'Expired',   className: 'bg-orange-500/15 text-orange-500 border-transparent' },
  converted: { label: 'Converted', className: 'bg-emerald-500/15 text-emerald-500 border-transparent' },
}

type ProductMeta = {
  id: string
  image_url: string | null
  serial_required: boolean
}

interface QuotationDetailSheetProps {
  quotation: QuotationWithRelations | null
  productMeta: ProductMeta[]
  orgName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onMarkSent: (id: string) => Promise<void>
  onApprove: (id: string) => Promise<void>
  onReject: (id: string) => Promise<void>
}

export function QuotationDetailSheet({
  quotation,
  productMeta,
  orgName,
  open,
  onOpenChange,
  onMarkSent,
  onApprove,
  onReject,
}: QuotationDetailSheetProps) {
  const { formatCurrency } = useCurrency()
  const [isPending, setIsPending] = React.useState(false)
  const [printOpen, setPrintOpen] = React.useState(false)

  if (!quotation) return null

  const status = quotation.status
  const { label: statusLabel, className: statusClass } = STATUS_CONFIG[status]

  const canMarkSent = status === 'draft'
  const canApprove = status !== 'converted' && status !== 'rejected'
  const canReject = status === 'draft' || status === 'sent' || status === 'accepted'
  const hasActions = canMarkSent || canApprove || canReject

  async function runAction(fn: () => Promise<void>) {
    setIsPending(true)
    try {
      await fn()
      onOpenChange(false)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <SheetTitle className="font-mono text-base">
              #{quotation.id.slice(0, 8).toUpperCase()}
            </SheetTitle>
            <Badge className={statusClass}>{statusLabel}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Created {quotation.created_at.slice(0, 10)}
            {quotation.creator?.full_name && ` by ${quotation.creator.full_name}`}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-5 py-2">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Customer
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {quotation.customers?.name ?? '—'}
              </p>
              {quotation.customers?.company_name && (
                <p className="text-xs text-muted-foreground">
                  {quotation.customers.company_name}
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Branch
              </p>
              <p className="mt-0.5 text-sm font-medium text-foreground">
                {quotation.branches?.name ?? '—'}
              </p>
            </div>
            {quotation.valid_until && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Valid Until
                </p>
                <p className="mt-0.5 text-sm font-medium text-foreground">
                  {quotation.valid_until.slice(0, 10)}
                </p>
              </div>
            )}
            {quotation.transaction_id && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Transaction
                </p>
                <p className="mt-0.5 font-mono text-xs text-foreground">
                  #{quotation.transaction_id.slice(0, 8).toUpperCase()}
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          {quotation.notes && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Notes
              </p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{quotation.notes}</p>
            </div>
          )}

          <Separator />

          {/* Items */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Items ({quotation.quotation_items.length})
            </p>
            <div className="rounded-lg border border-border overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_60px_48px_60px_40px_64px] gap-x-2 border-b border-border bg-muted/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Item</span>
                <span className="text-right">Price</span>
                <span className="text-center">Tax%</span>
                <span className="text-right">Amount</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Total</span>
              </div>
              <div className="divide-y divide-border">
                {quotation.quotation_items.map((item) => {
                  const meta = productMeta.find((p) => p.id === item.product_id)
                  const addTaxPct = item.add_tax_pct ?? 0
                  const amount = item.unit_price * (1 + addTaxPct / 100)
                  const lineTotal = amount * item.quantity - item.discount_amount

                  return (
                    <div key={item.id} className="grid grid-cols-[1fr_60px_48px_60px_40px_64px] items-center gap-x-2 px-3 py-2">
                      {/* Item name */}
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                          {meta?.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={meta.image_url} alt={item.product_name} className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-medium text-foreground">{item.product_name}</span>
                          {meta?.serial_required && (
                            <Badge className="border-transparent bg-amber-500/15 text-[9px] text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
                              Serial req.
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="text-right text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(item.unit_price)}
                      </span>
                      <span className={cn(
                        'text-center text-xs tabular-nums',
                        addTaxPct > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                      )}>
                        {addTaxPct}%
                      </span>
                      <span className={cn(
                        'text-right text-xs tabular-nums',
                        addTaxPct > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'
                      )}>
                        {formatCurrency(amount)}
                      </span>
                      <span className="text-center text-xs tabular-nums text-foreground">
                        {item.quantity}
                      </span>
                      <span className="text-right text-xs font-semibold tabular-nums text-foreground">
                        {formatCurrency(lineTotal)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <Separator />

          {/* Summary */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{formatCurrency(quotation.subtotal)}</span>
            </div>
            {(quotation.add_tax_amount ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Add Tax</span>
                <span className="tabular-nums text-blue-600 dark:text-blue-400">
                  +{formatCurrency(quotation.add_tax_amount)}
                </span>
              </div>
            )}
            {quotation.discount_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="tabular-nums text-destructive">
                  −{formatCurrency(quotation.discount_amount)}
                </span>
              </div>
            )}
            {quotation.tax_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Tax ({Math.round((quotation.tax_rate ?? 0) * 10000) / 100}%)
                </span>
                <span className="tabular-nums">{formatCurrency(quotation.tax_amount)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-lg tabular-nums">{formatCurrency(quotation.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <SheetFooter className="border-t border-border bg-background px-4 py-3">
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex gap-2">
              <SheetClose render={<Button variant="outline" type="button" />}>
                Close
              </SheetClose>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPrintOpen(true)}
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Print
              </Button>
            </div>
            {hasActions && (
              <div className="flex gap-2">
                {canMarkSent && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => runAction(() => onMarkSent(quotation.id))}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Mark Sent
                  </Button>
                )}
                {canReject && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => runAction(() => onReject(quotation.id))}
                    className="text-destructive hover:text-destructive"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    Reject
                  </Button>
                )}
                {canApprove && (
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => runAction(() => onApprove(quotation.id))}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    Approve
                  </Button>
                )}
              </div>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
      <QuotationPrintDialog
        quotation={quotation}
        orgName={orgName}
        open={printOpen}
        onOpenChange={setPrintOpen}
      />
    </Sheet>
  )
}

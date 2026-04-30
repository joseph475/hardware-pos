"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useCurrency } from "@/lib/context/currency"
import type { QuotationWithRelations } from "@/lib/actions/quotations"
import type { QuotationItem } from "@/types/database"

type OrgInfo = { name: string; company_name: string | null; address_1: string | null; address_2: string | null }

interface QuotationPrintDialogProps {
  quotation: QuotationWithRelations
  org: OrgInfo
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    accepted: "Accepted",
    rejected: "Rejected",
    expired: "Expired",
    converted: "Converted",
  }
  return map[status] ?? status
}

function itemUnitPrice(item: QuotationItem): number {
  return item.unit_price * (1 + (item.add_tax_pct ?? 0) / 100)
}

function itemDisplayedTotal(item: QuotationItem): number {
  return itemUnitPrice(item) * item.quantity - item.discount_amount
}

// ─── Print-only content (inline styles — no Tailwind/CSS vars needed) ─────────

function QuotationPrintContent({
  quotation,
  org,
  formatCurrency,
  quoteNumber,
}: {
  quotation: QuotationWithRelations
  org: OrgInfo
  formatCurrency: (v: number) => string
  quoteNumber: string
}) {
  const branch = quotation.branches
  const customer = quotation.customers
  const items = quotation.quotation_items

  const addTaxAmount = quotation.add_tax_amount ?? 0
  const displayedSubtotal = quotation.subtotal + addTaxAmount
  const displayedTotal = quotation.total + addTaxAmount
  const vatAmount = quotation.tax_amount
  const taxPct = Math.round((quotation.tax_rate ?? 0) * 100)

  return (
    <div style={{ fontFamily: "serif", fontSize: 13, color: "#000", lineHeight: 1.6 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: "bold" }}>{org.company_name ?? org.name}</div>
          <div style={{ marginTop: 4, color: "#555" }}>
            {org.address_1 && <div>{org.address_1}</div>}
            {org.address_2 && <div>{org.address_2}</div>}
            {branch && (
              <>
                <div>{branch.name}</div>
                {branch.address && <div>{branch.address}</div>}
                {branch.phone && <div>{branch.phone}</div>}
              </>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: "bold", letterSpacing: 2 }}>QUOTATION</div>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#555", marginTop: 2 }}>#{quoteNumber}</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>Status: {statusLabel(quotation.status)}</div>
        </div>
      </div>

      <hr style={{ borderTop: "1px solid #000", margin: "12px 0" }} />

      {/* Customer + dates */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#888", marginBottom: 4 }}>Bill To</div>
          {customer ? (
            <div>
              <div style={{ fontWeight: "bold" }}>{customer.name}</div>
              {customer.company_name && <div style={{ color: "#555" }}>{customer.company_name}</div>}
              {customer.email && <div style={{ color: "#555" }}>{customer.email}</div>}
            </div>
          ) : (
            <div style={{ color: "#888" }}>—</div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#888" }}>Date Issued</div>
            <div>{formatDate(quotation.created_at)}</div>
          </div>
          {quotation.valid_until && (
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#888" }}>Valid Until</div>
              <div>{formatDate(quotation.valid_until)}</div>
            </div>
          )}
          {quotation.creator && (
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#888" }}>Prepared By</div>
              <div>{quotation.creator.full_name}</div>
            </div>
          )}
        </div>
      </div>

      <hr style={{ borderTop: "1px solid #000", margin: "12px 0" }} />

      {/* Items table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12, fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #000" }}>
            <th style={{ textAlign: "left", paddingBottom: 6 }}>Item</th>
            <th style={{ textAlign: "right", paddingBottom: 6 }}>Qty</th>
            <th style={{ textAlign: "right", paddingBottom: 6 }}>Unit Price</th>
            <th style={{ textAlign: "right", paddingBottom: 6 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "5px 8px 5px 0" }}>{item.product_name}</td>
              <td style={{ textAlign: "right", padding: "5px 0" }}>{item.quantity}</td>
              <td style={{ textAlign: "right", padding: "5px 0" }}>{formatCurrency(itemUnitPrice(item))}</td>
              <td style={{ textAlign: "right", padding: "5px 0", fontWeight: "bold" }}>
                {formatCurrency(itemDisplayedTotal(item))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <table style={{ width: 240, borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            <tr>
              <td style={{ paddingBottom: 3, color: "#555" }}>Subtotal</td>
              <td style={{ textAlign: "right", paddingBottom: 3, color: "#555" }}>{formatCurrency(displayedSubtotal)}</td>
            </tr>
            {quotation.discount_amount > 0 && (
              <tr>
                <td style={{ paddingBottom: 3, color: "#555" }}>Discount</td>
                <td style={{ textAlign: "right", paddingBottom: 3, color: "#c00" }}>−{formatCurrency(quotation.discount_amount)}</td>
              </tr>
            )}
            {vatAmount > 0 && (
              <tr>
                <td style={{ paddingBottom: 3, color: "#555" }}>
                  {taxPct > 0 ? `VAT (${taxPct}%)` : "VAT"}
                </td>
                <td style={{ textAlign: "right", paddingBottom: 3, color: "#555" }}>{formatCurrency(vatAmount)}</td>
              </tr>
            )}
            <tr style={{ borderTop: "2px solid #000" }}>
              <td style={{ paddingTop: 6, fontWeight: "bold", fontSize: 14 }}>TOTAL</td>
              <td style={{ textAlign: "right", paddingTop: 6, fontWeight: "bold", fontSize: 14 }}>{formatCurrency(displayedTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notes */}
      {quotation.notes && (
        <>
          <hr style={{ borderTop: "1px solid #000", margin: "12px 0" }} />
          <div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#888", marginBottom: 4 }}>Notes</div>
            <div style={{ color: "#444", whiteSpace: "pre-wrap" }}>{quotation.notes}</div>
          </div>
        </>
      )}

      {/* Signature lines */}
      <div style={{ display: "flex", gap: 48, marginTop: 48 }}>
        <div style={{ flex: 1 }}>
          <div style={{ borderTop: "1px solid #000", paddingTop: 6 }}>
            <div style={{ fontSize: 10, color: "#888" }}>Authorized Signature</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ borderTop: "1px solid #000", paddingTop: 6 }}>
            <div style={{ fontSize: 10, color: "#888" }}>Customer Signature</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Dialog preview (Tailwind-styled, screen only) ───────────────────────────

function QuotationDocument({
  quotation,
  org,
  formatCurrency,
  quoteNumber,
}: {
  quotation: QuotationWithRelations
  org: OrgInfo
  formatCurrency: (v: number) => string
  quoteNumber: string
}) {
  const branch = quotation.branches
  const customer = quotation.customers
  const items = quotation.quotation_items

  const addTaxAmount = quotation.add_tax_amount ?? 0
  const displayedSubtotal = quotation.subtotal + addTaxAmount
  const displayedTotal = quotation.total + addTaxAmount
  const vatAmount = quotation.tax_amount
  const taxPct = Math.round((quotation.tax_rate ?? 0) * 100)

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm p-6 text-xs text-foreground">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-base font-bold tracking-tight">{org.company_name ?? org.name}</h1>
          <div className="mt-1 text-muted-foreground space-y-0.5 leading-relaxed">
            {org.address_1 && <p>{org.address_1}</p>}
            {org.address_2 && <p>{org.address_2}</p>}
            {branch && (
              <>
                <p className="font-medium">{branch.name}</p>
                {branch.address && <p>{branch.address}</p>}
                {branch.phone && <p>{branch.phone}</p>}
              </>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold tracking-widest text-primary uppercase">Quotation</p>
          <p className="mt-1 font-mono text-muted-foreground">#{quoteNumber}</p>
          <span className="inline-block mt-1.5 px-2 py-0.5 font-medium rounded-full bg-muted text-muted-foreground border border-border">
            {statusLabel(quotation.status)}
          </span>
        </div>
      </div>

      <div className="border-t border-border my-4" />

      {/* Meta row */}
      <div className="grid grid-cols-2 gap-6 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 font-semibold">Bill To</p>
          {customer ? (
            <div className="space-y-0.5">
              <p className="font-semibold">{customer.name}</p>
              {customer.company_name && <p className="text-muted-foreground">{customer.company_name}</p>}
              {customer.email && <p className="text-muted-foreground">{customer.email}</p>}
            </div>
          ) : (
            <p className="text-muted-foreground">—</p>
          )}
        </div>
        <div className="text-right space-y-1.5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Date Issued</p>
            <p className="font-medium mt-0.5">{formatDate(quotation.created_at)}</p>
          </div>
          {quotation.valid_until && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Valid Until</p>
              <p className="font-medium mt-0.5">{formatDate(quotation.valid_until)}</p>
            </div>
          )}
          {quotation.creator && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Prepared By</p>
              <p className="font-medium mt-0.5">{quotation.creator.full_name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Items table */}
      <div className="rounded-md overflow-hidden border border-border mb-4">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-auto" />
            <col className="w-10" />
            <col className="w-28" />
            <col className="w-28" />
          </colgroup>
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="py-2 px-3 text-left text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Item</th>
              <th className="py-2 px-3 text-right text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Qty</th>
              <th className="py-2 px-3 text-right text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Unit Price</th>
              <th className="py-2 px-3 text-right text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                <td className="py-2 px-3 font-medium truncate max-w-0">{item.product_name}</td>
                <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">{item.quantity}</td>
                <td className="py-2 px-3 text-right tabular-nums">
                  {formatCurrency(itemUnitPrice(item))}
                </td>
                <td className="py-2 px-3 text-right tabular-nums font-semibold">
                  {formatCurrency(itemDisplayedTotal(item))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-4">
        <div className="w-56 space-y-1">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCurrency(displayedSubtotal)}</span>
          </div>
          {quotation.discount_amount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span className="tabular-nums text-destructive">−{formatCurrency(quotation.discount_amount)}</span>
            </div>
          )}
          {vatAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{taxPct > 0 ? `VAT (${taxPct}%)` : "VAT"}</span>
              <span className="tabular-nums">{formatCurrency(vatAmount)}</span>
            </div>
          )}
          <div className="border-t border-border pt-1.5">
            <div className="flex justify-between font-bold text-sm">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(displayedTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {quotation.notes && (
        <>
          <div className="border-t border-border my-4" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Notes</p>
            <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{quotation.notes}</p>
          </div>
        </>
      )}

      {/* Signature lines */}
      <div className="mt-8 grid grid-cols-2 gap-12">
        <div>
          <div className="border-t border-border pt-2">
            <p className="text-muted-foreground">Authorized Signature</p>
          </div>
        </div>
        <div>
          <div className="border-t border-border pt-2">
            <p className="text-muted-foreground">Customer Signature</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function QuotationPrintDialog({
  quotation,
  org,
  open,
  onOpenChange,
}: QuotationPrintDialogProps) {
  const { formatCurrency } = useCurrency()
  const [mounted, setMounted] = React.useState(false)
  const quoteNumber = quotation.id.slice(0, 8).toUpperCase()

  React.useEffect(() => { setMounted(true) }, [])

  function handlePrint() {
    document.body.setAttribute("data-printing", "quotation")
    window.print()
    document.body.removeAttribute("data-printing")
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] sm:w-[92vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto overflow-x-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">Quotation #{quoteNumber}</DialogTitle>
          </DialogHeader>

          {/* Screen preview */}
          <div className="min-w-0 flex-1 overflow-x-hidden pb-1">
            <QuotationDocument
              quotation={quotation}
              org={org}
              formatCurrency={formatCurrency}
              quoteNumber={quoteNumber}
            />
          </div>

          <div className="border-t border-border pt-3 flex justify-end">
            <Button size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print portal — direct body child so globals.css @media print can target it */}
      {mounted && createPortal(
        <div id="quotation-print">
          <QuotationPrintContent
            quotation={quotation}
            org={org}
            formatCurrency={formatCurrency}
            quoteNumber={quoteNumber}
          />
        </div>,
        document.body
      )}
    </>
  )
}

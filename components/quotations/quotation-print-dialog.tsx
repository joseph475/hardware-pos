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
import { Separator } from "@/components/ui/separator"
import { useCurrency } from "@/lib/context/currency"
import type { QuotationWithRelations } from "@/lib/actions/quotations"

interface QuotationPrintDialogProps {
  quotation: QuotationWithRelations
  orgName: string
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

// ─── Print-only content (inline styles — no Tailwind/CSS vars needed) ─────────

function QuotationPrintContent({
  quotation,
  orgName,
  formatCurrency,
  quoteNumber,
}: {
  quotation: QuotationWithRelations
  orgName: string
  formatCurrency: (v: number) => string
  quoteNumber: string
}) {
  const branch = quotation.branches
  const customer = quotation.customers
  const items = quotation.quotation_items

  return (
    <div style={{ fontFamily: "serif", fontSize: 13, color: "#000", lineHeight: 1.6 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: "bold" }}>{orgName}</div>
          {branch && (
            <div style={{ marginTop: 4, color: "#555" }}>
              <div>{branch.name}</div>
              {branch.address && <div>{branch.address}</div>}
              {branch.phone && <div>{branch.phone}</div>}
            </div>
          )}
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
            <th style={{ textAlign: "right", paddingBottom: 6 }}>Tax%</th>
            <th style={{ textAlign: "right", paddingBottom: 6 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "5px 8px 5px 0" }}>{item.product_name}</td>
              <td style={{ textAlign: "right", padding: "5px 0" }}>{item.quantity}</td>
              <td style={{ textAlign: "right", padding: "5px 0" }}>{formatCurrency(item.unit_price)}</td>
              <td style={{ textAlign: "right", padding: "5px 0", color: "#666" }}>
                {item.add_tax_pct ? `${item.add_tax_pct}%` : "—"}
              </td>
              <td style={{ textAlign: "right", padding: "5px 0", fontWeight: "bold" }}>
                {formatCurrency(item.total)}
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
              <td style={{ textAlign: "right", paddingBottom: 3, color: "#555" }}>{formatCurrency(quotation.subtotal)}</td>
            </tr>
            {quotation.add_tax_amount > 0 && (
              <tr>
                <td style={{ paddingBottom: 3, color: "#555" }}>Item Tax</td>
                <td style={{ textAlign: "right", paddingBottom: 3, color: "#555" }}>{formatCurrency(quotation.add_tax_amount)}</td>
              </tr>
            )}
            {quotation.discount_amount > 0 && (
              <tr>
                <td style={{ paddingBottom: 3, color: "#555" }}>Discount</td>
                <td style={{ textAlign: "right", paddingBottom: 3, color: "#c00" }}>−{formatCurrency(quotation.discount_amount)}</td>
              </tr>
            )}
            {quotation.tax_amount > 0 && (
              <tr>
                <td style={{ paddingBottom: 3, color: "#555" }}>VAT ({Math.round(quotation.tax_rate * 100)}%)</td>
                <td style={{ textAlign: "right", paddingBottom: 3, color: "#555" }}>{formatCurrency(quotation.tax_amount)}</td>
              </tr>
            )}
            <tr style={{ borderTop: "2px solid #000" }}>
              <td style={{ paddingTop: 6, fontWeight: "bold", fontSize: 14 }}>TOTAL</td>
              <td style={{ textAlign: "right", paddingTop: 6, fontWeight: "bold", fontSize: 14 }}>{formatCurrency(quotation.total)}</td>
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
  orgName,
  formatCurrency,
  quoteNumber,
}: {
  quotation: QuotationWithRelations
  orgName: string
  formatCurrency: (v: number) => string
  quoteNumber: string
}) {
  const branch = quotation.branches
  const customer = quotation.customers
  const items = quotation.quotation_items

  return (
    <div className="space-y-5 text-sm text-foreground">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{orgName}</h1>
          {branch && (
            <div className="mt-1 text-muted-foreground space-y-0.5">
              <p>{branch.name}</p>
              {branch.address && <p>{branch.address}</p>}
              {branch.phone && <p>{branch.phone}</p>}
            </div>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tracking-tight text-primary">QUOTATION</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">#{quoteNumber}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Status: <span className="font-medium text-foreground">{statusLabel(quotation.status)}</span>
          </p>
        </div>
      </div>

      <Separator />

      {/* Meta row */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Bill To</p>
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
        <div className="text-right space-y-1">
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Date Issued</span>
            <p className="font-medium">{formatDate(quotation.created_at)}</p>
          </div>
          {quotation.valid_until && (
            <div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Valid Until</span>
              <p className="font-medium">{formatDate(quotation.valid_until)}</p>
            </div>
          )}
          {quotation.creator && (
            <div>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Prepared By</span>
              <p className="font-medium">{quotation.creator.full_name}</p>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* Items table */}
      <div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-2 text-left font-semibold text-muted-foreground">Item</th>
              <th className="pb-2 text-right font-semibold text-muted-foreground">Qty</th>
              <th className="pb-2 text-right font-semibold text-muted-foreground">Unit Price</th>
              <th className="pb-2 text-right font-semibold text-muted-foreground">Tax%</th>
              <th className="pb-2 text-right font-semibold text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="py-2 pr-4 font-medium">{item.product_name}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">
                  {item.quantity}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatCurrency(item.unit_price)}
                </td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">
                  {item.add_tax_pct ? `${item.add_tax_pct}%` : "—"}
                </td>
                <td className="py-2 text-right tabular-nums font-medium">
                  {formatCurrency(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Separator />

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-60 space-y-1.5">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCurrency(quotation.subtotal)}</span>
          </div>
          {quotation.add_tax_amount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Item Tax</span>
              <span className="tabular-nums">{formatCurrency(quotation.add_tax_amount)}</span>
            </div>
          )}
          {quotation.discount_amount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Discount</span>
              <span className="tabular-nums text-red-500">−{formatCurrency(quotation.discount_amount)}</span>
            </div>
          )}
          {quotation.tax_amount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>VAT ({Math.round(quotation.tax_rate * 100)}%)</span>
              <span className="tabular-nums">{formatCurrency(quotation.tax_amount)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(quotation.total)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {quotation.notes && (
        <>
          <Separator />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{quotation.notes}</p>
          </div>
        </>
      )}

      {/* Signature line */}
      <div className="mt-8 grid grid-cols-2 gap-12">
        <div>
          <div className="border-t border-border pt-2">
            <p className="text-xs text-muted-foreground">Authorized Signature</p>
          </div>
        </div>
        <div>
          <div className="border-t border-border pt-2">
            <p className="text-xs text-muted-foreground">Customer Signature</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function QuotationPrintDialog({
  quotation,
  orgName,
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-border pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle>Print Quotation #{quoteNumber}</DialogTitle>
              <Button size="sm" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </DialogHeader>

          {/* Screen preview */}
          <div className="p-2">
            <QuotationDocument
              quotation={quotation}
              orgName={orgName}
              formatCurrency={formatCurrency}
              quoteNumber={quoteNumber}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Print portal — direct body child so globals.css @media print can target it */}
      {mounted && createPortal(
        <div id="quotation-print">
          <QuotationPrintContent
            quotation={quotation}
            orgName={orgName}
            formatCurrency={formatCurrency}
            quoteNumber={quoteNumber}
          />
        </div>,
        document.body
      )}
    </>
  )
}

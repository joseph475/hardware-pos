"use client"

import * as React from "react"
import { toast } from "sonner"
import { CheckCircle2, QrCode, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useCartStore } from "@/lib/store/cart"
import { useCurrency } from "@/lib/context/currency"
import { useUserProfile } from "@/lib/context/user-profile"
import { createTransaction } from "@/lib/actions/transactions"
import { ReceiptDialog, type ReceiptData } from "@/components/pos/receipt-dialog"

type PaymentMethod = "cash" | "card" | "split" | "gcash" | "maya"

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  paymentMethod: PaymentMethod
  gcashQrUrl?: string | null
  mayaQrUrl?: string | null
  receiptHeader?: string | null
  receiptFooter?: string | null
}

function paymentMethodLabel(method: PaymentMethod): string {
  if (method === "gcash") return "GCash"
  if (method === "maya") return "Maya"
  if (method === "split") return "Split"
  return method.charAt(0).toUpperCase() + method.slice(1)
}

export function PaymentDialog({
  open,
  onOpenChange,
  paymentMethod,
  gcashQrUrl,
  mayaQrUrl,
  receiptHeader,
  receiptFooter,
}: PaymentDialogProps) {
  const { items, clearCart, subtotal, totalDiscount, tax, total } = useCartStore()
  const { formatCurrency, taxRate, currencySymbol } = useCurrency()
  const { profile, branch } = useUserProfile()

  const [cashTendered, setCashTendered] = React.useState("")
  const [splitCash, setSplitCash] = React.useState("")
  const [splitCard, setSplitCard] = React.useState("")
  const [isProcessing, setIsProcessing] = React.useState(false)
  const [qrConfirmed, setQrConfirmed] = React.useState(false)
  const [qrElapsed, setQrElapsed] = React.useState(0)
  const [receiptData, setReceiptData] = React.useState<ReceiptData | null>(null)
  const [receiptOpen, setReceiptOpen] = React.useState(false)

  const isQrPayment = paymentMethod === "gcash" || paymentMethod === "maya"

  // Timer for QR payments
  React.useEffect(() => {
    if (!isQrPayment || !open) {
      setQrElapsed(0)
      return
    }
    const startTime = Date.now()
    const interval = setInterval(() => {
      setQrElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [isQrPayment, open])

  // Reset QR confirmation when payment method or dialog state changes
  React.useEffect(() => {
    if (!open) setQrConfirmed(false)
  }, [open])
  React.useEffect(() => {
    setQrConfirmed(false)
    setQrElapsed(0)
  }, [paymentMethod])

  const orderTotal = total()
  const orderSubtotal = subtotal()
  const orderDiscount = totalDiscount()
  const orderTax = tax()
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  const cashTenderedNum = parseFloat(cashTendered) || 0
  const change = cashTenderedNum - orderTotal

  const splitCashNum = parseFloat(splitCash) || 0
  const splitCardNum = parseFloat(splitCard) || 0
  const splitTotal = Math.round((splitCashNum + splitCardNum) * 100) / 100
  const splitRemaining = orderTotal - splitTotal

  const isCashValid =
    paymentMethod === "cash" ? cashTenderedNum >= orderTotal : true
  const isSplitValid =
    paymentMethod === "split"
      ? Math.abs(splitRemaining) < 0.005
      : true
  const canConfirm =
    paymentMethod === "card" ||
    (paymentMethod === "cash" && isCashValid) ||
    (paymentMethod === "split" && isSplitValid) ||
    (isQrPayment && qrConfirmed)

  async function handleConfirm() {
    if (!canConfirm) return
    setIsProcessing(true)
    try {
      const result = await createTransaction({
        items: items.map((i) => ({
          product_id: i.product.id,
          product_name: i.product.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount_amount: i.discount_amount,
        })),
        subtotal: orderSubtotal,
        discount_amount: orderDiscount,
        tax_amount: orderTax,
        total: orderTotal,
        payment_method: paymentMethod,
      })

      // Capture receipt data before clearing cart
      setReceiptData({
        transactionId: result.id,
        timestamp: new Date(),
        branchName: branch?.name ?? "Store",
        branchAddress: branch?.address ?? null,
        branchPhone: branch?.phone ?? null,
        cashierName: profile?.full_name ?? "Cashier",
        items: items.map((i) => ({
          name: i.product.name,
          qty: i.quantity,
          unitPrice: i.unit_price,
          discountAmount: i.discount_amount,
          lineTotal: i.unit_price * i.quantity - i.discount_amount,
        })),
        subtotal: orderSubtotal,
        discountAmount: orderDiscount,
        taxAmount: orderTax,
        taxRate,
        total: orderTotal,
        paymentMethod,
        cashTendered: paymentMethod === "cash" ? cashTenderedNum : undefined,
        change: paymentMethod === "cash" ? change : undefined,
        splitCash: paymentMethod === "split" ? splitCashNum : undefined,
        splitCard: paymentMethod === "split" ? splitCardNum : undefined,
        receiptHeader: receiptHeader ?? undefined,
        receiptFooter: receiptFooter ?? undefined,
        formatCurrency,
      })
      setReceiptOpen(true)

      clearCart()
      onOpenChange(false)
      setCashTendered("")
      setSplitCash("")
      setSplitCard("")
      toast.success("Transaction completed", {
        description: `${itemCount} item${itemCount !== 1 ? "s" : ""} — ${formatCurrency(orderTotal)}`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong"
      if (message.startsWith("Insufficient stock for:")) {
        toast.error("Stock unavailable", { description: message })
      } else {
        toast.error("Transaction failed", { description: message })
      }
      // Dialog stays open so cashier can adjust cart
    } finally {
      setIsProcessing(false)
    }
  }

  function handleOpenChange(value: boolean) {
    if (!isProcessing) {
      if (!value) {
        setCashTendered("")
        setSplitCash("")
        setSplitCard("")
      }
      onOpenChange(value)
    }
  }

  function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!isProcessing}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Confirm Payment
          </DialogTitle>
        </DialogHeader>

        {/* Order Summary */}
        <div className="space-y-1 rounded-lg bg-muted/50 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </span>
            <span className="font-medium">{paymentMethodLabel(paymentMethod)}</span>
          </div>
          <Separator className="my-2" />
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(orderSubtotal)}</span>
            </div>
            {orderDiscount > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Discount</span>
                <span>−{formatCurrency(orderDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Tax ({Math.round(taxRate * 10000) / 100}%)
              </span>
              <span>{formatCurrency(orderTax)}</span>
            </div>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(orderTotal)}</span>
          </div>
        </div>

        {/* Cash payment */}
        {paymentMethod === "cash" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cash-tendered">Amount Tendered</Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                  {currencySymbol}
                </span>
                <Input
                  id="cash-tendered"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  className="pl-6"
                  autoFocus
                />
              </div>
            </div>

            {cashTenderedNum > 0 && (
              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                  change >= 0
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                <span>{change >= 0 ? "Change" : "Insufficient"}</span>
                <span>
                  {change >= 0
                    ? formatCurrency(change)
                    : `${formatCurrency(Math.abs(change))} short`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Card payment */}
        {paymentMethod === "card" && (
          <div className="rounded-lg bg-muted/50 p-3 text-center text-sm text-muted-foreground">
            Card terminal ready. Please swipe, tap, or insert card to proceed.
          </div>
        )}

        {/* GCash / Maya QR payment */}
        {isQrPayment && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <QrCode className="h-4 w-4 text-muted-foreground" />
              <span>Scan {paymentMethodLabel(paymentMethod)} QR to pay</span>
              {qrElapsed > 0 && (
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground font-mono">
                  <Timer className="h-3 w-3" />
                  {formatElapsed(qrElapsed)}
                </span>
              )}
            </div>
            {(paymentMethod === "gcash" ? gcashQrUrl : mayaQrUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={(paymentMethod === "gcash" ? gcashQrUrl : mayaQrUrl)!}
                alt={`${paymentMethodLabel(paymentMethod)} QR Code`}
                className="h-48 w-48 rounded object-contain"
              />
            ) : (
              <p className="text-xs text-muted-foreground">QR image not configured.</p>
            )}
            <p className="text-xl font-bold text-foreground">{formatCurrency(orderTotal)}</p>
            <div className="flex items-center gap-2 w-full">
              <Checkbox
                id="qr-confirmed"
                checked={qrConfirmed}
                onCheckedChange={(checked) => setQrConfirmed(!!checked)}
              />
              <Label htmlFor="qr-confirmed" className="text-sm cursor-pointer">
                I confirm the customer has scanned and paid
              </Label>
            </div>
          </div>
        )}

        {/* Split payment */}
        {paymentMethod === "split" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="split-cash">Cash Amount</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    id="split-cash"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={splitCash}
                    onChange={(e) => setSplitCash(e.target.value)}
                    className="pl-6"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="split-card">Card Amount</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    id="split-card"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={splitCard}
                    onChange={(e) => setSplitCard(e.target.value)}
                    className="pl-6"
                  />
                </div>
              </div>
            </div>

            <div
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                Math.abs(splitRemaining) < 0.005
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : splitRemaining > 0
                  ? "bg-muted text-muted-foreground"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              <span>
                {Math.abs(splitRemaining) < 0.005
                  ? "Balanced"
                  : splitRemaining > 0
                  ? "Remaining"
                  : "Over by"}
              </span>
              <span>
                {Math.abs(splitRemaining) < 0.005
                  ? "Ready to process"
                  : formatCurrency(Math.abs(splitRemaining))}
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isProcessing}
            className="min-w-[120px]"
          >
            {isProcessing ? "Processing…" : "Confirm Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {receiptData && (
      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={(val) => {
          setReceiptOpen(val)
          if (!val) setReceiptData(null)
        }}
        data={receiptData}
      />
    )}
  </>
  )
}

"use client"

import * as React from "react"
import { toast } from "sonner"
import { CheckCircle2, QrCode, Timer, User } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCartStore } from "@/lib/store/cart"
import { useCurrency } from "@/lib/context/currency"
import { useUserProfile } from "@/lib/context/user-profile"
import { createTransaction } from "@/lib/actions/transactions"
import { sendQuotationToPos } from "@/lib/actions/quotations"
import { ReceiptDialog, type ReceiptData } from "@/components/pos/receipt-dialog"

type PaymentMethod = "cash" | "card" | "split" | "gcash" | "maya" | "check" | "e_wallet" | "home_credit"
type SplitLegMethod = "cash" | "card" | "e_wallet"

const EWALLET_PROVIDERS = ["GCash", "PayMaya", "Maribank"] as const
type EwalletProvider = typeof EWALLET_PROVIDERS[number]

const INSTALLMENT_COMPANIES = ["HomeCredit", "SKYGO"] as const
type InstallmentCompany = typeof INSTALLMENT_COMPANIES[number]

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  paymentMethod: PaymentMethod
  customerId?: string | null
  customerName?: string | null
  gcashQrUrl?: string | null
  mayaQrUrl?: string | null
  receiptHeader?: string | null
  receiptFooter?: string | null
  companyName?: string | null
  companyAddress1?: string | null
  quotationId?: string | null
}

function paymentMethodLabel(method: PaymentMethod): string {
  if (method === "gcash") return "GCash"
  if (method === "maya") return "Maya"
  if (method === "split") return "Split"
  if (method === "check") return "Check"
  if (method === "e_wallet") return "E-Wallet"
  if (method === "home_credit") return "Installment"
  return method.charAt(0).toUpperCase() + method.slice(1)
}

function splitLegLabel(method: SplitLegMethod): string {
  if (method === "e_wallet") return "E-Wallet"
  return method.charAt(0).toUpperCase() + method.slice(1)
}

export function PaymentDialog({
  open,
  onOpenChange,
  paymentMethod,
  customerId,
  customerName,
  gcashQrUrl,
  mayaQrUrl,
  receiptHeader,
  receiptFooter,
  companyName,
  companyAddress1,
  quotationId,
}: PaymentDialogProps) {
  const { items, bundleItems, clearCart, subtotal, totalDiscount, tax, total } = useCartStore()
  const { formatCurrency, taxRate, currencySymbol } = useCurrency()
  const { profile, branch } = useUserProfile()

  const [cashTendered, setCashTendered] = React.useState("")
  // Split state — two independent legs
  const [splitMethod1, setSplitMethod1] = React.useState<SplitLegMethod>("cash")
  const [splitAmount1, setSplitAmount1] = React.useState("")
  const [splitMethod2, setSplitMethod2] = React.useState<SplitLegMethod>("card")
  const [splitAmount2, setSplitAmount2] = React.useState("")
  // E-wallet state (shared between standalone e_wallet and split legs)
  const [ewalletProvider, setEwalletProvider] = React.useState<EwalletProvider>("GCash")
  const [ewalletReference, setEwalletReference] = React.useState("")
  // Check state
  const [checkBankName, setCheckBankName] = React.useState("")
  const [checkDate, setCheckDate] = React.useState("")
  const [checkNumber, setCheckNumber] = React.useState("")
  const [checkName, setCheckName] = React.useState("")
  const [checkAmountStr, setCheckAmountStr] = React.useState("")
  const [hcDownpayment, setHcDownpayment] = React.useState("")
  const [hcTerms, setHcTerms] = React.useState<number | null>(null)
  const [hcAccountNumber, setHcAccountNumber] = React.useState("")
  const [installmentCompany, setInstallmentCompany] = React.useState<InstallmentCompany>("HomeCredit")
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

  React.useEffect(() => {
    if (!open) setQrConfirmed(false)
  }, [open])
  React.useEffect(() => {
    setQrConfirmed(false)
    setQrElapsed(0)
  }, [paymentMethod])

  // When split method 1 changes to match method 2, auto-change method 2
  React.useEffect(() => {
    if (splitMethod1 === splitMethod2) {
      const options: SplitLegMethod[] = ["cash", "card", "e_wallet"]
      const next = options.find((m) => m !== splitMethod1)
      if (next) setSplitMethod2(next)
    }
  }, [splitMethod1, splitMethod2])

  React.useEffect(() => {
    if (splitMethod2 === splitMethod1) {
      const options: SplitLegMethod[] = ["cash", "card", "e_wallet"]
      const next = options.find((m) => m !== splitMethod2)
      if (next) setSplitMethod1(next)
    }
  }, [splitMethod2, splitMethod1])

  const orderTotal = total()
  const orderSubtotal = subtotal()
  const orderDiscount = totalDiscount()
  const orderTax = tax()
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0) + bundleItems.reduce((sum, b) => sum + b.quantity, 0)

  const cashTenderedNum = parseFloat(cashTendered) || 0
  const change = cashTenderedNum - orderTotal

  const splitAmount1Num = parseFloat(splitAmount1) || 0
  const splitAmount2Num = parseFloat(splitAmount2) || 0
  const splitTotal = Math.round((splitAmount1Num + splitAmount2Num) * 100) / 100
  const splitRemaining = orderTotal - splitTotal

  const splitHasEwallet = paymentMethod === "split" && (splitMethod1 === "e_wallet" || splitMethod2 === "e_wallet")

  const checkAmountNum = parseFloat(checkAmountStr) || 0

  const isCashValid = paymentMethod === "cash" ? cashTenderedNum >= orderTotal : true
  const isSplitValid =
    paymentMethod === "split"
      ? Math.abs(splitRemaining) < 0.005 &&
        splitMethod1 !== splitMethod2 &&
        (!splitHasEwallet || ewalletReference.trim() !== "")
      : true
  const isCheckValid =
    paymentMethod === "check"
      ? checkBankName.trim() !== "" &&
        checkDate !== "" &&
        checkNumber.trim() !== "" &&
        checkName.trim() !== "" &&
        checkAmountNum >= orderTotal
      : true
  const isEwalletValid =
    paymentMethod === "e_wallet"
      ? ewalletReference.trim() !== ""
      : true

  const hcDownpaymentNum = parseFloat(hcDownpayment) || 0
  const hcAmountComputed = Math.max(0, orderTotal - hcDownpaymentNum)
  const isHcValid =
    paymentMethod === "home_credit"
      ? hcTerms !== null && hcAmountComputed > 0
      : true

  const canConfirm =
    paymentMethod === "card" ||
    (paymentMethod === "cash" && isCashValid) ||
    (paymentMethod === "split" && isSplitValid) ||
    (paymentMethod === "check" && isCheckValid) ||
    (paymentMethod === "e_wallet" && isEwalletValid) ||
    (isQrPayment && qrConfirmed) ||
    (paymentMethod === "home_credit" && isHcValid)

  async function handleConfirm() {
    if (!canConfirm) return
    setIsProcessing(true)
    try {
      const hasEwallet = paymentMethod === "e_wallet" || splitHasEwallet
      const result = await createTransaction({
        items: items.map((i) => ({
          product_id: i.product.id,
          product_name: i.product.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount_amount: i.discount_amount,
          serials: i.serials,
        })),
        bundleItems: bundleItems.map((b) => ({
          bundle_id: b.bundle_id,
          bundle_name: b.bundle_name,
          quantity: b.quantity,
          unit_price: b.unit_price,
          discount_amount: b.discount_amount,
          components: b.components,
          component_serials: Object.keys(b.serials).length > 0 ? b.serials : undefined,
        })),
        subtotal: orderSubtotal,
        discount_amount: orderDiscount,
        tax_amount: orderTax,
        total: orderTotal,
        payment_method: paymentMethod,
        customer_id: customerId ?? null,
        check_bank_name: paymentMethod === "check" ? checkBankName : null,
        check_date: paymentMethod === "check" ? checkDate : null,
        check_number: paymentMethod === "check" ? checkNumber : null,
        check_name: paymentMethod === "check" ? checkName : null,
        check_amount: paymentMethod === "check" ? checkAmountNum : null,
        ewallet_provider: hasEwallet ? ewalletProvider : null,
        ewallet_reference: hasEwallet ? ewalletReference.trim() : null,
        hc_downpayment: paymentMethod === "home_credit" ? hcDownpaymentNum : null,
        hc_terms: paymentMethod === "home_credit" ? hcTerms : null,
        hc_amount: paymentMethod === "home_credit" ? hcAmountComputed : null,
        hc_account_number: paymentMethod === "home_credit" ? (hcAccountNumber.trim() || null) : null,
        installment_company: paymentMethod === "home_credit" ? installmentCompany : null,
      })

      setReceiptData({
        transactionId: result.id,
        timestamp: new Date(),
        branchName: branch?.name ?? "Store",
        branchAddress: branch?.address ?? null,
        branchPhone: branch?.phone ?? null,
        cashierName: profile?.full_name ?? "Cashier",
        items: [
          ...items.map((i) => ({
            name: i.product.name,
            qty: i.quantity,
            unitPrice: i.unit_price,
            discountAmount: i.discount_amount,
            lineTotal: i.unit_price * i.quantity - i.discount_amount,
          })),
          ...bundleItems.map((b) => ({
            name: `${b.bundle_name} (Bundle)`,
            qty: b.quantity,
            unitPrice: b.unit_price,
            discountAmount: b.discount_amount,
            lineTotal: b.unit_price * b.quantity - b.discount_amount,
          })),
        ],
        subtotal: orderSubtotal,
        discountAmount: orderDiscount,
        taxAmount: orderTax,
        taxRate,
        total: orderTotal,
        paymentMethod,
        cashTendered: paymentMethod === "cash" ? cashTenderedNum : undefined,
        change: paymentMethod === "cash" ? change : undefined,
        splitMethod1: paymentMethod === "split" ? splitMethod1 : undefined,
        splitAmount1: paymentMethod === "split" ? splitAmount1Num : undefined,
        splitMethod2: paymentMethod === "split" ? splitMethod2 : undefined,
        splitAmount2: paymentMethod === "split" ? splitAmount2Num : undefined,
        checkBankName: paymentMethod === "check" ? checkBankName : undefined,
        checkDate: paymentMethod === "check" ? checkDate : undefined,
        checkNumber: paymentMethod === "check" ? checkNumber : undefined,
        checkName: paymentMethod === "check" ? checkName : undefined,
        checkAmount: paymentMethod === "check" ? checkAmountNum : undefined,
        ewalletProvider: hasEwallet ? ewalletProvider : undefined,
        ewalletReference: hasEwallet ? ewalletReference.trim() : undefined,
        receiptHeader: receiptHeader ?? undefined,
        receiptFooter: receiptFooter ?? undefined,
        companyName: companyName ?? undefined,
        companyAddress1: companyAddress1 ?? undefined,
        formatCurrency,
      })
      setReceiptOpen(true)

      if (quotationId) {
        sendQuotationToPos(quotationId).catch(() => {})
      }
      clearCart()
      onOpenChange(false)
      setCashTendered("")
      setSplitAmount1("")
      setSplitAmount2("")
      setEwalletReference("")
      setHcDownpayment("")
      setHcTerms(null)
      setHcAccountNumber("")
      setInstallmentCompany("HomeCredit")
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
    } finally {
      setIsProcessing(false)
    }
  }

  function handleOpenChange(value: boolean) {
    if (!isProcessing) {
      if (!value) {
        setCashTendered("")
        setSplitAmount1("")
        setSplitAmount2("")
        setSplitMethod1("cash")
        setSplitMethod2("card")
        setEwalletProvider("GCash")
        setEwalletReference("")
        setCheckBankName("")
        setCheckDate("")
        setCheckNumber("")
        setCheckName("")
        setCheckAmountStr("")
        setHcDownpayment("")
        setHcTerms(null)
        setHcAccountNumber("")
        setInstallmentCompany("HomeCredit")
      }
      onOpenChange(value)
    }
  }

  function formatElapsed(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  const splitLegOptions: SplitLegMethod[] = ["cash", "card", "e_wallet"]

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
          {customerName && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{customerName}</span>
            </div>
          )}
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

        {/* E-Wallet payment */}
        {paymentMethod === "e_wallet" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select
                value={ewalletProvider}
                onValueChange={(val) => setEwalletProvider(val as EwalletProvider)}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Select provider">
                    {ewalletProvider}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {EWALLET_PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ewallet-ref">Reference No. <span className="text-destructive">*</span></Label>
              <Input
                id="ewallet-ref"
                placeholder="Enter reference number"
                value={ewalletReference}
                onChange={(e) => setEwalletReference(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Split payment */}
        {paymentMethod === "split" && (
          <div className="space-y-3">
            {/* Leg 1 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">First Payment</Label>
              <div className="flex gap-2">
                <Select
                  value={splitMethod1}
                  onValueChange={(val) => setSplitMethod1(val as SplitLegMethod)}
                >
                  <SelectTrigger className="w-[130px] h-9 shrink-0">
                    <SelectValue placeholder="Method">
                      {splitLegLabel(splitMethod1)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {splitLegOptions.filter((m) => m !== splitMethod2).map((m) => (
                      <SelectItem key={m} value={m}>{splitLegLabel(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={splitAmount1}
                    onChange={(e) => setSplitAmount1(e.target.value)}
                    className="pl-6 h-9"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            {/* Leg 2 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Second Payment</Label>
              <div className="flex gap-2">
                <Select
                  value={splitMethod2}
                  onValueChange={(val) => setSplitMethod2(val as SplitLegMethod)}
                >
                  <SelectTrigger className="w-[130px] h-9 shrink-0">
                    <SelectValue placeholder="Method">
                      {splitLegLabel(splitMethod2)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {splitLegOptions.filter((m) => m !== splitMethod1).map((m) => (
                      <SelectItem key={m} value={m}>{splitLegLabel(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={splitAmount2}
                    onChange={(e) => setSplitAmount2(e.target.value)}
                    className="pl-6 h-9"
                  />
                </div>
              </div>
            </div>

            {/* E-Wallet fields for split */}
            {splitHasEwallet && (
              <div className="space-y-3 rounded-lg border border-border p-3">
                <div className="space-y-1.5">
                  <Label>E-Wallet Provider</Label>
                  <Select
                    value={ewalletProvider}
                    onValueChange={(val) => setEwalletProvider(val as EwalletProvider)}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="Select provider">
                        {ewalletProvider}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {EWALLET_PROVIDERS.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="split-ewallet-ref">Reference No. <span className="text-destructive">*</span></Label>
                  <Input
                    id="split-ewallet-ref"
                    placeholder="Enter reference number"
                    value={ewalletReference}
                    onChange={(e) => setEwalletReference(e.target.value)}
                  />
                </div>
              </div>
            )}

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

        {/* Check payment */}
        {paymentMethod === "check" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="check-bank">Bank Name</Label>
                <Input
                  id="check-bank"
                  placeholder="e.g. BDO"
                  value={checkBankName}
                  onChange={(e) => setCheckBankName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="check-date">Check Date</Label>
                <Input
                  id="check-date"
                  type="date"
                  value={checkDate}
                  onChange={(e) => setCheckDate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="check-number">Check #</Label>
                <Input
                  id="check-number"
                  placeholder="123456"
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="check-amount">Check Amount</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    id="check-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={checkAmountStr}
                    onChange={(e) => setCheckAmountStr(e.target.value)}
                    className="pl-6"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="check-name">Check Name (Payee)</Label>
              <Input
                id="check-name"
                placeholder="Name on check"
                value={checkName}
                onChange={(e) => setCheckName(e.target.value)}
              />
            </div>
            {checkAmountNum > 0 && (
              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${
                  checkAmountNum >= orderTotal
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                <span>{checkAmountNum >= orderTotal ? "Change" : "Insufficient"}</span>
                <span>
                  {checkAmountNum >= orderTotal
                    ? formatCurrency(checkAmountNum - orderTotal)
                    : `${formatCurrency(orderTotal - checkAmountNum)} short`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Installment payment */}
        {paymentMethod === "home_credit" && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Company <span className="text-destructive">*</span></Label>
              <Select
                value={installmentCompany}
                onValueChange={(val) => setInstallmentCompany(val as InstallmentCompany)}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Select company">
                    {installmentCompany}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {INSTALLMENT_COMPANIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hc-downpayment">
                Downpayment <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-muted-foreground">
                  {currencySymbol}
                </span>
                <Input
                  id="hc-downpayment"
                  type="number"
                  min={0}
                  max={orderTotal}
                  step="0.01"
                  placeholder="0.00"
                  value={hcDownpayment}
                  onChange={(e) => setHcDownpayment(e.target.value)}
                  className="pl-6"
                  autoFocus
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Leave blank if fully financed by {installmentCompany}.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hc-account">
                HC Account Number <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input
                id="hc-account"
                placeholder="e.g. 1234-5678-9012"
                value={hcAccountNumber}
                onChange={(e) => setHcAccountNumber(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Terms <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2 flex-wrap">
                {[3, 6, 12, 18, 24].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setHcTerms(t)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      hcTerms === t
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {t} mos
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Downpayment collected now</span>
                <span className="font-medium">{formatCurrency(hcDownpaymentNum)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{installmentCompany} amount (awaiting payout)</span>
                <span className="font-medium">{formatCurrency(hcAmountComputed)}</span>
              </div>
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

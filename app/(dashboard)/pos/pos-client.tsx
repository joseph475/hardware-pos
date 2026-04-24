"use client"

import * as React from "react"
import {
  Search,
  Trash2,
  X,
  Plus,
  Minus,
  Percent,
  CreditCard,
  Banknote,
  SplitSquareHorizontal,
  Package,
  Clock,
  Receipt,
  Smartphone,
  CheckSquare,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useCartStore } from "@/lib/store/cart"
import { useCurrency } from "@/lib/context/currency"
import { useUserProfile } from "@/lib/context/user-profile"
import { PaymentDialog } from "@/components/pos/payment-dialog"
import { HoldOrderDialog } from "@/components/pos/hold-order-dialog"
import { HeldOrdersSheet } from "@/components/pos/held-orders-sheet"
import { RecentSalesSheet } from "@/components/pos/recent-sales-sheet"
import { CustomerSelectDialog } from "@/components/pos/customer-select-dialog"
import type { POSProduct } from "@/lib/actions/inventory"
import type { Customer } from "@/types/database"
import type { QuotationWithRelations } from "@/lib/actions/quotations"
import { cn } from "@/lib/utils"

type PaymentMethod = "cash" | "card" | "split" | "gcash" | "maya" | "check"

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <Badge variant="destructive" className="text-[10px]">
        Out of stock
      </Badge>
    )
  }
  if (stock <= 10) {
    return (
      <Badge className="border-transparent bg-yellow-500/15 text-[10px] text-yellow-600 dark:bg-yellow-400/15 dark:text-yellow-400">
        Low: {stock}
      </Badge>
    )
  }
  return (
    <Badge className="border-transparent bg-green-500/15 text-[10px] text-green-600 dark:bg-green-400/15 dark:text-green-400">
      In stock
    </Badge>
  )
}

export function POSClient({
  initialProducts,
  customers,
  userRole,
  gcashQrUrl,
  mayaQrUrl,
  maxCashierDiscountPct,
  receiptHeader,
  receiptFooter,
  hasPinConfigured,
  initialQuotation,
}: {
  initialProducts: POSProduct[]
  customers: Customer[]
  userRole: string
  gcashQrUrl?: string | null
  mayaQrUrl?: string | null
  maxCashierDiscountPct: number
  receiptHeader?: string | null
  receiptFooter?: string | null
  hasPinConfigured?: boolean
  initialQuotation?: QuotationWithRelations | null
}) {
  const { formatCurrency } = useCurrency()
  const { branch } = useUserProfile()

  const {
    items,
    discount,
    taxRate,
    addItem,
    removeItem,
    updateQuantity,
    updateItemDiscount,
    updateItemAddTax,
    updateItemSerials,
    isReadyToCharge,
    setDiscount,
    setTaxRate,
    clearCart,
    loadQuotationOrder,
    subtotal,
    totalDiscount,
    totalAddTax,
    tax,
    total,
  } = useCartStore()

  // Search + dropdown
  const [search, setSearch] = React.useState("")
  const [dropdownOpen, setDropdownOpen] = React.useState(false)
  const searchRef = React.useRef<HTMLInputElement>(null)

  // Serial number input refs keyed by product id
  const serialRefs = React.useRef<Record<string, (HTMLInputElement | null)[]>>({})

  // Dialog / sheet state
  const [heldOrdersOpen, setHeldOrdersOpen] = React.useState(false)
  const [recentSalesOpen, setRecentSalesOpen] = React.useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false)
  const [holdDialogOpen, setHoldDialogOpen] = React.useState(false)
  const [customerStepOpen, setCustomerStepOpen] = React.useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | null>(null)
  const [selectedCustomerName, setSelectedCustomerName] = React.useState<string | null>(null)

  // Payment method
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("cash")

  // Overall discount
  const [discountInput, setDiscountInput] = React.useState("")

  // Item-level discount
  const [itemDiscountTarget, setItemDiscountTarget] = React.useState<string | null>(null)
  const [itemDiscountInput, setItemDiscountInput] = React.useState("")

  React.useEffect(() => {
    setDiscountInput(discount > 0 ? String(discount) : "")
  }, [discount])

  // Keyboard shortcuts
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (
        e.key === "Escape" &&
        document.activeElement === searchRef.current &&
        search
      ) {
        setSearch("")
        setDropdownOpen(false)
      } else if ((e.ctrlKey || e.metaKey) && e.key === "h") {
        e.preventDefault()
        setHeldOrdersOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [search])

  // Load quotation items and customer on mount if navigated from quotation
  React.useEffect(() => {
    if (!initialQuotation) return
    const mappedItems = initialQuotation.quotation_items.map((qi) => {
      const found = initialProducts.find((p) => p.id === qi.product_id)
      const product = found
        ? found
        : {
            id: qi.product_id,
            name: qi.product_name,
            sku: '',
            barcode: null,
            selling_price: qi.unit_price,
            serial_required: false,
            stock: 0,
            image_url: null,
          }
      return {
        product: product as any,
        quantity: qi.quantity,
        unit_price: qi.unit_price,
        discount_amount: qi.discount_amount,
        add_tax_pct: qi.add_tax_pct ?? 0,
      }
    })
    loadQuotationOrder(mappedItems)
    if (initialQuotation.customer_id && initialQuotation.customers) {
      setSelectedCustomerId(initialQuotation.customer_id)
      setSelectedCustomerName(initialQuotation.customers.name)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filtered products for the dropdown (max 8)
  const filteredProducts = React.useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return initialProducts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode ?? "").includes(q)
      )
      .slice(0, 8)
  }, [search, initialProducts])

  const isCashier = userRole === "cashier"
  const readyToCharge = isReadyToCharge()

  function handleDiscountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setDiscountInput(val)
    const num = parseFloat(val)
    if (!isNaN(num) && num >= 0 && num <= 100) {
      if (isCashier && num > maxCashierDiscountPct) {
        setDiscount(maxCashierDiscountPct)
        setDiscountInput(String(maxCashierDiscountPct))
        toast.warning(`Discount capped at ${maxCashierDiscountPct}% for cashiers`)
        return
      }
      setDiscount(num)
    } else if (val === "" || val === "0") {
      setDiscount(0)
    }
  }

  function handleQuantityInput(productId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value, 10)
    if (!isNaN(val)) updateQuantity(productId, val)
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return
    const q = search.trim()
    if (!q) return

    // 1. Exact barcode match
    const exactBarcode = initialProducts.find(
      (p) => p.barcode && p.barcode === q && p.stock > 0
    )
    if (exactBarcode) {
      addItem(exactBarcode)
      setSearch("")
      setDropdownOpen(false)
      toast.success(`Added: ${exactBarcode.name}`)
      return
    }

    // 2. Single filtered result
    if (filteredProducts.length === 1 && filteredProducts[0].stock > 0) {
      addItem(filteredProducts[0])
      setSearch("")
      setDropdownOpen(false)
      toast.success(`Added: ${filteredProducts[0].name}`)
      return
    }

    // 3. No match
    if (filteredProducts.length === 0) {
      toast.error("No product found", { description: q })
    }
  }

  function handleSelectProduct(product: POSProduct) {
    if (product.stock === 0) {
      toast.error("Out of stock")
      return
    }
    addItem(product)
    setSearch("")
    setDropdownOpen(false)
    // Auto-focus the first empty serial slot after adding a serial-required product
    if (product.serial_required) {
      setTimeout(() => {
        const refs = serialRefs.current[product.id]
        if (refs) {
          const emptySlot = refs.find((r) => r && r.value === "")
          emptySlot?.focus()
        }
      }, 50)
    }
  }

  function openItemDiscount(productId: string, currentPct: number) {
    if (itemDiscountTarget === productId) {
      setItemDiscountTarget(null)
      setItemDiscountInput("")
      return
    }
    setItemDiscountTarget(productId)
    setItemDiscountInput(currentPct > 0 ? String(currentPct) : "")
  }

  function applyItemDiscount(productId: string) {
    const num = parseFloat(itemDiscountInput)
    const pct = isNaN(num) ? 0 : Math.min(100, Math.max(0, num))
    if (isCashier && pct > maxCashierDiscountPct) {
      updateItemDiscount(productId, maxCashierDiscountPct)
      toast.warning(`Discount capped at ${maxCashierDiscountPct}% for cashiers`)
    } else {
      updateItemDiscount(productId, pct)
    }
    setItemDiscountTarget(null)
    setItemDiscountInput("")
  }

  function handleSerialKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    productId: string,
    slotIndex: number,
    totalSlots: number
  ) {
    if (e.key !== "Enter") return
    e.preventDefault()
    const refs = serialRefs.current[productId]
    if (!refs) return
    // Focus next slot in this item, or first empty slot
    if (slotIndex < totalSlots - 1) {
      refs[slotIndex + 1]?.focus()
    }
  }

  const paymentMethods: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { value: "cash", label: "Cash", icon: <Banknote className="h-4 w-4" /> },
    { value: "card", label: "Card", icon: <CreditCard className="h-4 w-4" /> },
    { value: "check", label: "Check", icon: <CheckSquare className="h-4 w-4" /> },
    { value: "split", label: "Split", icon: <SplitSquareHorizontal className="h-4 w-4" /> },
    ...(gcashQrUrl ? [{ value: "gcash" as const, label: "GCash", icon: <Smartphone className="h-4 w-4" /> }] : []),
    ...(mayaQrUrl ? [{ value: "maya" as const, label: "Maya", icon: <Smartphone className="h-4 w-4" /> }] : []),
  ]

  return (
    <>
      <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">

        {/* ── TOPBAR ─────────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-4 py-2">
          <span className="text-sm font-semibold text-foreground">
            {branch?.name ?? "POS"}
          </span>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setHeldOrdersOpen(true)}
          >
            <Clock className="h-3.5 w-3.5" />
            Held Orders
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => setRecentSalesOpen(true)}
          >
            <Receipt className="h-3.5 w-3.5" />
            Recent Sales
          </Button>
        </div>

        {/* ── SEARCH BAR + DROPDOWN ──────────────────────────────────────────── */}
        <div className="relative shrink-0 border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Search product, SKU, or scan barcode… (F2)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setDropdownOpen(e.target.value.length > 0)
              }}
              onFocus={() => search.length > 0 && setDropdownOpen(true)}
              onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
              onKeyDown={handleSearchKeyDown}
              className="pl-9 pr-10"
              autoComplete="off"
            />
            {search && (
              <button
                className="absolute inset-y-0 right-3 my-auto text-muted-foreground hover:text-foreground"
                onMouseDown={() => { setSearch(""); setDropdownOpen(false) }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Dropdown results */}
          {dropdownOpen && filteredProducts.length > 0 && (
            <div className="absolute left-3 right-3 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  onMouseDown={() => handleSelectProduct(product)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-accent",
                    product.stock === 0 && "cursor-not-allowed opacity-50"
                  )}
                >
                  {/* Thumbnail */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">
                        {product.name}
                      </span>
                      {product.serial_required && (
                        <Badge className="border-transparent bg-amber-500/15 text-[9px] text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
                          Serial req.
                        </Badge>
                      )}
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {product.sku}
                    </span>
                  </div>
                  {/* Price + stock */}
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(product.selling_price)}
                    </span>
                    <StockBadge stock={product.stock} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── ORDER LIST ─────────────────────────────────────────────────────── */}
        <ScrollArea className="flex-1 min-h-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
              <Package className="h-12 w-12 text-muted-foreground/30" />
              <div>
                <p className="text-sm font-medium text-foreground">No items yet</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Search or scan a product to begin
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_68px_60px_72px_88px_76px_52px] gap-x-2 border-b border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Item</span>
                <span className="text-right">Price</span>
                <span className="text-center">Tax%</span>
                <span className="text-right">Amount</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              <div className="divide-y divide-border">
                {items.map((item) => {
                  const addTaxAmt = item.unit_price * (item.add_tax_pct / 100)
                  const amount = item.unit_price + addTaxAmt
                  const itemTotal = amount * item.quantity - item.discount_amount
                  const isDiscountOpen = itemDiscountTarget === item.product.id
                  if (!serialRefs.current[item.product.id]) {
                    serialRefs.current[item.product.id] = []
                  }

                  return (
                    <div key={item.product.id}>
                      {/* Main row */}
                      <div className="grid grid-cols-[1fr_68px_60px_72px_88px_76px_52px] items-center gap-x-2 px-3 py-2">
                        {/* Item name + image */}
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
                            {(item.product as POSProduct).image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={(item.product as POSProduct).image_url!}
                                alt={item.product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate text-xs font-medium text-foreground">
                              {item.product.name}
                            </span>
                            {item.product.serial_required && (
                              <Badge className="border-transparent bg-amber-500/15 text-[9px] text-amber-600 dark:bg-amber-400/15 dark:text-amber-400">
                                Serial req.
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Unit price */}
                        <span className="text-right text-xs tabular-nums text-muted-foreground">
                          {formatCurrency(item.unit_price)}
                        </span>

                        {/* Add Tax % input */}
                        <div className="relative">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={0.5}
                            value={item.add_tax_pct}
                            onChange={(e) =>
                              updateItemAddTax(
                                item.product.id,
                                Math.min(100, Math.max(0, Number(e.target.value) || 0))
                              )
                            }
                            className="h-6 w-full pr-4 text-right text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <Percent className="pointer-events-none absolute inset-y-0 right-1 my-auto h-2.5 w-2.5 text-muted-foreground" />
                        </div>

                        {/* Amount (unit price + add tax) */}
                        <span className={cn(
                          "text-right text-xs tabular-nums",
                          item.add_tax_pct > 0 ? "text-blue-600 dark:text-blue-400" : "text-foreground"
                        )}>
                          {formatCurrency(amount)}
                        </span>

                        {/* Qty controls */}
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="outline"
                            size="icon-xs"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => handleQuantityInput(item.product.id, e)}
                            className="h-6 w-10 px-1 text-center text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <Button
                            variant="outline"
                            size="icon-xs"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Line total */}
                        <span className={cn(
                          "text-right text-xs font-semibold tabular-nums",
                          item.discount_pct > 0 ? "text-orange-500 dark:text-orange-400" : "text-foreground"
                        )}>
                          {formatCurrency(itemTotal)}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => openItemDiscount(item.product.id, item.discount_pct)}
                            className={cn(
                              "text-muted-foreground",
                              item.discount_pct > 0 && "text-orange-500 dark:text-orange-400"
                            )}
                          >
                            <Percent className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeItem(item.product.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Item discount inline input */}
                      {isDiscountOpen && (
                        <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1.5">
                          <div className="relative flex-1">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              placeholder="0"
                              value={itemDiscountInput}
                              onChange={(e) => setItemDiscountInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") applyItemDiscount(item.product.id)
                                if (e.key === "Escape") { setItemDiscountTarget(null); setItemDiscountInput("") }
                              }}
                              className="h-6 pr-6 text-right text-sm"
                              autoFocus
                            />
                            <Percent className="pointer-events-none absolute inset-y-0 right-1.5 my-auto h-3 w-3 text-muted-foreground" />
                          </div>
                          <Button size="xs" onClick={() => applyItemDiscount(item.product.id)} className="h-6 px-2 text-xs">
                            Apply
                          </Button>
                          <Button size="xs" variant="ghost" onClick={() => { setItemDiscountTarget(null); setItemDiscountInput("") }} className="h-6 px-2 text-xs">
                            Cancel
                          </Button>
                        </div>
                      )}

                      {/* Serial number slots */}
                      {item.product.serial_required && (
                        <div className="mx-3 mb-2 space-y-1.5">
                          <p className="text-xs text-muted-foreground">Serial numbers:</p>
                          <div className="flex flex-wrap gap-2">
                            {Array.from({ length: item.quantity }, (_, i) => (
                              <input
                                key={i}
                                ref={(el) => {
                                  if (!serialRefs.current[item.product.id]) {
                                    serialRefs.current[item.product.id] = []
                                  }
                                  serialRefs.current[item.product.id][i] = el
                                }}
                                className={cn(
                                  "h-7 w-44 rounded border bg-background px-2 font-mono text-xs transition-colors",
                                  item.serials[i]
                                    ? "border-green-500/50 text-foreground"
                                    : "border-border text-foreground placeholder:text-muted-foreground"
                                )}
                                placeholder={`SN ${i + 1}`}
                                value={item.serials[i] ?? ""}
                                onChange={(e) => {
                                  const newSerials = [...item.serials]
                                  newSerials[i] = e.target.value
                                  updateItemSerials(item.product.id, newSerials)
                                }}
                                onKeyDown={(e) =>
                                  handleSerialKeyDown(e, item.product.id, i, item.quantity)
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </ScrollArea>

        {/* ── SUMMARY + ACTIONS ──────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-border bg-card">
          {items.length > 0 && (
            <>
              {/* Totals */}
              <div className="space-y-1.5 px-4 pt-3 pb-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal())}</span>
                </div>

                {/* Overall discount row */}
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="shrink-0 text-muted-foreground">Discount</span>
                  <div className="flex items-center gap-1.5">
                    <div className="relative w-20">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        placeholder="0"
                        value={discountInput}
                        onChange={handleDiscountChange}
                        className="h-6 pr-6 text-right text-sm"
                      />
                      <Percent className="pointer-events-none absolute inset-y-0 right-1.5 my-auto h-3 w-3 text-muted-foreground" />
                    </div>
                    {totalDiscount() > 0 && (
                      <span className="text-destructive">−{formatCurrency(totalDiscount())}</span>
                    )}
                  </div>
                </div>

                {totalAddTax() > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Add Tax</span>
                    <span className="text-blue-600 dark:text-blue-400">+{formatCurrency(totalAddTax())}</span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-muted-foreground">Tax</span>
                    <div className="relative w-16">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        placeholder="0"
                        value={Math.round(taxRate * 10000) / 100}
                        onChange={(e) => setTaxRate((Number(e.target.value) || 0) / 100)}
                        className="h-6 pr-5 text-right text-sm"
                      />
                      <Percent className="pointer-events-none absolute inset-y-0 right-1 my-auto h-3 w-3 text-muted-foreground" />
                    </div>
                  </div>
                  <span>{formatCurrency(tax())}</span>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold">Total</span>
                  <span className="text-xl font-bold text-foreground">
                    {formatCurrency(total())}
                  </span>
                </div>
              </div>

              {/* Payment method selector */}
              <div className="px-4 pb-3">
                <div className={cn("grid gap-1.5", paymentMethods.length <= 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-5")}>
                  {paymentMethods.map((method) => (
                    <button
                      key={method.value}
                      onClick={() => setPaymentMethod(method.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-all",
                        paymentMethod === method.value
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border bg-background text-muted-foreground hover:border-ring/50 hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {method.icon}
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 px-4 pb-4">
            <Button
              variant="outline"
              className="flex-1 text-sm"
              disabled={items.length === 0}
              onClick={() => setHoldDialogOpen(true)}
            >
              Hold
            </Button>
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearCart}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Clear order"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              className="flex-1 text-sm font-semibold"
              disabled={items.length === 0 || !readyToCharge}
              onClick={() => {
                if (selectedCustomerId) {
                  setPaymentDialogOpen(true)
                } else {
                  setCustomerStepOpen(true)
                }
              }}
              title={!readyToCharge ? "Enter all serial numbers to continue" : undefined}
            >
              {items.length > 0 && !readyToCharge ? "Enter serials first" : "Charge →"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── DIALOGS & SHEETS ────────────────────────────────────────────────── */}
      <HeldOrdersSheet open={heldOrdersOpen} onOpenChange={setHeldOrdersOpen} />
      <RecentSalesSheet
        open={recentSalesOpen}
        onOpenChange={setRecentSalesOpen}
        hasPinConfigured={hasPinConfigured ?? false}
      />
      <CustomerSelectDialog
        open={customerStepOpen}
        onOpenChange={setCustomerStepOpen}
        customers={customers}
        onConfirm={(id, name) => {
          setSelectedCustomerId(id)
          setSelectedCustomerName(name)
          setPaymentDialogOpen(true)
        }}
      />
      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={(val) => {
          setPaymentDialogOpen(val)
          if (!val) {
            setSelectedCustomerId(null)
            setSelectedCustomerName(null)
          }
        }}
        paymentMethod={paymentMethod}
        customerId={selectedCustomerId}
        customerName={selectedCustomerName}
        gcashQrUrl={gcashQrUrl}
        mayaQrUrl={mayaQrUrl}
        receiptHeader={receiptHeader}
        receiptFooter={receiptFooter}
        quotationId={initialQuotation?.id ?? null}
      />
      <HoldOrderDialog
        open={holdDialogOpen}
        onOpenChange={setHoldDialogOpen}
      />
    </>
  )
}

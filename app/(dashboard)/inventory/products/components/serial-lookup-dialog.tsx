"use client"

import * as React from "react"
import { toast } from "sonner"
import { Search, Package, ArrowDownToLine, ShoppingCart, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { lookupSerial, type SerialLookupResult } from "@/lib/actions/inventory"
import { formatDate, formatTime } from "@/lib/format"

interface SerialLookupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SerialLookupDialog({ open, onOpenChange }: SerialLookupDialogProps) {
  const [query, setQuery] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [result, setResult] = React.useState<SerialLookupResult | null>(null)
  const [searched, setSearched] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) {
      setQuery("")
      setResult(null)
      setSearched(false)
    } else {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  async function handleSearch() {
    if (!query.trim()) return
    setIsLoading(true)
    setSearched(false)
    try {
      const data = await lookupSerial(query)
      setResult(data)
      setSearched(true)
    } catch {
      toast.error("Lookup failed")
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch()
  }

  const notFound = searched && !result?.product

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Serial Number Lookup
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Enter serial number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="font-mono"
          />
          <Button onClick={handleSearch} disabled={isLoading || !query.trim()}>
            {isLoading ? "Searching…" : "Search"}
          </Button>
        </div>

        {notFound && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            No records found for <span className="font-mono font-medium text-foreground">"{result?.serial}"</span>
          </div>
        )}

        {result?.product && (
          <div className="space-y-4">
            {/* Product card */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary shrink-0" />
                <span className="font-semibold text-sm text-foreground">{result.product.name}</span>
              </div>
              <p className="text-xs text-muted-foreground pl-6">SKU: {result.product.sku}</p>
              <p className="text-xs font-mono text-muted-foreground pl-6">Serial: {result.serial}</p>
              <div className="pl-6 pt-0.5">
                {result.sold.length > 0 ? (
                  <Badge className="text-xs bg-blue-500/10 text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700">
                    Sold
                  </Badge>
                ) : result.received.length > 0 ? (
                  <Badge className="text-xs bg-green-500/10 text-green-600 border-green-300 dark:text-green-400 dark:border-green-700">
                    In Stock
                  </Badge>
                ) : null}
              </div>
            </div>

            <Separator />

            {/* Received history */}
            {result.received.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                  Received via PO
                </p>
                {result.received.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm px-1">
                    <div className="space-y-0.5">
                      <p className="text-foreground">{formatDate(r.date)}{" "}
                        <span className="text-muted-foreground text-xs">{formatTime(r.date)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{r.branch}</p>
                    </div>
                    {r.reference_id && (
                      <span className="font-mono text-xs text-muted-foreground">
                        PO {r.reference_id.slice(0, 8).toUpperCase()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Sold history */}
            {result.sold.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Sold
                </p>
                {result.sold.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-sm px-1">
                    <div className="space-y-0.5">
                      <p className="text-foreground">{formatDate(s.date)}{" "}
                        <span className="text-muted-foreground text-xs">{formatTime(s.date)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{s.branch}</p>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      TX {s.transaction_id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

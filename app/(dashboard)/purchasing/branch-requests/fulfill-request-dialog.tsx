"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import { handleError } from "@/lib/utils/error-handler"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { fulfillBranchStockRequest } from "@/lib/actions/branch-requests"
import type { BranchStockRequestWithRelations } from "@/types/database"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: BranchStockRequestWithRelations
  mainBranchId: string
}

export function FulfillRequestDialog({
  open,
  onOpenChange,
  request,
  mainBranchId,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [quantities, setQuantities] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      const init: Record<string, string> = {}
      request.branch_stock_request_items.forEach((item) => {
        init[item.id] = String(item.quantity)
      })
      setQuantities(init)
    }
  }, [open, request])

  function handleSubmit() {
    startTransition(async () => {
      try {
        await fulfillBranchStockRequest({
          requestId: request.id,
          mainBranchId,
          items: request.branch_stock_request_items.map((item) => ({
            productId: item.product_id,
            quantity:
              parseFloat(quantities[item.id] ?? "0") || item.quantity,
          })),
        })
        toast.success("Request fulfilled — stock transfer created")
        onOpenChange(false)
        router.refresh()
      } catch (err) {
        handleError(err, 'fulfill request')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fulfill Stock Request</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          From:{" "}
          <strong>{request.requesting_branch?.name ?? "Unknown branch"}</strong>
        </p>
        <div className="space-y-3">
          {request.branch_stock_request_items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex-1 text-sm">
                <p className="font-medium">
                  {item.product?.name ?? "Unknown product"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.product?.sku}
                </p>
              </div>
              <div className="w-36 space-y-0.5">
                <Label className="text-xs text-muted-foreground">
                  Qty (requested: {item.quantity})
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  value={quantities[item.id] ?? ""}
                  onChange={(e) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [item.id]: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Creating Transfer…" : "Create Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

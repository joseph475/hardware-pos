"use client"

import * as React from "react"
import { formatDate } from "@/lib/format"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type {
  BranchStockRequestWithRelations,
  BranchRequestStatus,
} from "@/types/database"

const STATUS_CONFIG: Record<
  BranchRequestStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-500/15 text-amber-500 border-transparent",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-blue-500/15 text-blue-500 border-transparent",
  },
  fulfilled: {
    label: "Fulfilled",
    className: "bg-emerald-500/15 text-emerald-500 border-transparent",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground border-transparent",
  },
}

interface Props {
  request: BranchStockRequestWithRelations | null
  isMainBranch: boolean
  onClose: () => void
}

export function ViewRequestDialog({ request, isMainBranch, onClose }: Props) {
  if (!request) return null

  const { label, className } = STATUS_CONFIG[request.status]

  return (
    <Dialog open={request !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="font-mono">
              {request.id.slice(0, 8).toUpperCase()}
            </DialogTitle>
            <Badge className={className}>{label}</Badge>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground -mt-1">
            {isMainBranch && (
              <span>
                <span className="font-medium text-foreground">Branch:</span>{" "}
                {request.requesting_branch?.name ?? "—"}
              </span>
            )}
            <span>
              <span className="font-medium text-foreground">Created by:</span>{" "}
              {request.creator?.full_name ?? "—"}
            </span>
            <span>
              <span className="font-medium text-foreground">Date:</span>{" "}
              {formatDate(request.created_at)}
            </span>
          </div>
          {request.notes && (
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mt-1">
              {request.notes}
            </p>
          )}
        </DialogHeader>

        <div className="overflow-y-auto max-h-[55vh]">
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left font-medium px-3 py-2 text-muted-foreground">
                      Product
                    </th>
                    <th className="text-left font-medium px-3 py-2 text-muted-foreground whitespace-nowrap">
                      SKU
                    </th>
                    <th className="text-center font-medium px-3 py-2 text-muted-foreground whitespace-nowrap">
                      Qty Requested
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {request.branch_stock_request_items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={idx > 0 ? "border-t border-border/60" : ""}
                    >
                      <td className="px-3 py-2.5 font-medium text-foreground">
                        {item.product?.name ?? "Unknown product"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground font-mono text-xs">
                        {item.product?.sku ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">
                        {item.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border bg-muted/30 px-3 py-2 flex justify-end gap-4 text-sm">
              <span className="text-muted-foreground">Total items</span>
              <span className="font-semibold tabular-nums text-foreground w-8 text-right">
                {request.branch_stock_request_items.length}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

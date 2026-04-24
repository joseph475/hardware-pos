"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Plus, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NewRequestSheet } from "./new-request-sheet"
import { FulfillRequestDialog } from "./fulfill-request-dialog"
import { updateBranchStockRequestStatus } from "@/lib/actions/branch-requests"
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
  requests: BranchStockRequestWithRelations[]
  isMainBranch: boolean
  mainBranchId: string | null
  products: Array<{ id: string; name: string; sku: string }>
}

export function BranchRequestsClient({
  requests,
  isMainBranch,
  mainBranchId,
  products,
}: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [fulfillTarget, setFulfillTarget] =
    React.useState<BranchStockRequestWithRelations | null>(null)

  function handleStatusChange(requestId: string, status: BranchRequestStatus) {
    startTransition(async () => {
      try {
        await updateBranchStockRequestStatus(requestId, status)
        router.refresh()
      } catch (err) {
        toast.error("Failed to update status", {
          description:
            err instanceof Error ? err.message : "Unknown error",
        })
      }
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {isMainBranch ? "Branch Stock Requests" : "Stock Requests"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isMainBranch
              ? "Incoming stock requests from sub-branches"
              : "Request stock from the main branch"}
          </p>
        </div>
        {!isMainBranch && (
          <Button onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Request
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="pl-4">Request ID</TableHead>
                {isMainBranch && <TableHead>Branch</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isMainBranch ? 7 : 6}
                    className="py-16 text-center text-muted-foreground"
                  >
                    No requests found.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((req) => {
                  const { label, className } = STATUS_CONFIG[req.status]
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="pl-4 font-mono text-xs">
                        {req.id.slice(0, 8).toUpperCase()}
                      </TableCell>
                      {isMainBranch && (
                        <TableCell>
                          {req.requesting_branch?.name ?? "—"}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge className={className}>{label}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {req.branch_stock_request_items.length}
                      </TableCell>
                      <TableCell>
                        {req.creator?.full_name ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isMainBranch &&
                              req.status === "pending" &&
                              mainBranchId && (
                                <DropdownMenuItem
                                  onClick={() => setFulfillTarget(req)}
                                >
                                  Fulfill (Create Transfer)
                                </DropdownMenuItem>
                              )}
                            {req.status === "pending" && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() =>
                                  handleStatusChange(req.id, "cancelled")
                                }
                              >
                                Cancel
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewRequestSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        products={products}
      />

      {fulfillTarget && mainBranchId && (
        <FulfillRequestDialog
          open={!!fulfillTarget}
          onOpenChange={(val) => {
            if (!val) setFulfillTarget(null)
          }}
          request={fulfillTarget}
          mainBranchId={mainBranchId}
        />
      )}
    </div>
  )
}

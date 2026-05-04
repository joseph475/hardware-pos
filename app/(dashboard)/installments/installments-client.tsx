"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { handleError } from "@/lib/utils/error-handler"
import { Search, CreditCard } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { markInstallmentReceived, type InstallmentPlanRow } from "@/lib/actions/installments"
import { useCurrency } from "@/lib/context/currency"
import { formatDate } from "@/lib/format"

interface InstallmentsClientProps {
  initialPlans: InstallmentPlanRow[]
  userRole: string
}

export function InstallmentsClient({ initialPlans, userRole }: InstallmentsClientProps) {
  const router = useRouter()
  const { formatCurrency } = useCurrency()
  const [filter, setFilter] = React.useState<"all" | "pending" | "received">("all")
  const [search, setSearch] = React.useState("")
  const [isPending, startTransition] = React.useTransition()

  const canMarkReceived = userRole === "manager" || userRole === "owner"

  const filtered = initialPlans.filter((plan) => {
    if (filter !== "all" && plan.status !== filter) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return plan.customer_name?.toLowerCase().includes(q) ?? false
    }
    return true
  })

  const pendingPlans = initialPlans.filter((p) => p.status === "pending")
  const receivedPlans = initialPlans.filter((p) => p.status === "received")
  const pendingTotal = pendingPlans.reduce((s, p) => s + p.hc_amount, 0)
  const receivedTotal = receivedPlans.reduce((s, p) => s + p.hc_amount, 0)

  function handleMarkReceived(planId: string) {
    startTransition(async () => {
      try {
        await markInstallmentReceived(planId)
        toast.success("Marked as received")
        router.refresh()
      } catch (err) {
        handleError(err, 'mark installment received')
      }
    })
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Installments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track payout status for all installment sales
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap justify-end">
          <Badge className="rounded-full px-3 py-1 text-xs font-semibold bg-yellow-500/10 text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-600">
            {pendingPlans.length} Pending · {formatCurrency(pendingTotal)}
          </Badge>
          <Badge className="rounded-full px-3 py-1 text-xs font-semibold bg-green-500/10 text-green-700 border-green-300 dark:text-green-400 dark:border-green-600">
            {receivedPlans.length} Received · {formatCurrency(receivedTotal)}
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        {(["all", "pending", "received"] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className="capitalize h-9"
          >
            {f}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Sale Total</TableHead>
              <TableHead className="text-right">Downpayment</TableHead>
              <TableHead className="text-right">Financed Amount</TableHead>
              <TableHead className="text-center">Terms</TableHead>
              <TableHead>Account #</TableHead>
              <TableHead className="text-center">Status</TableHead>
              {canMarkReceived && <TableHead className="text-center">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canMarkReceived ? 10 : 9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <CreditCard className="h-8 w-8 opacity-30" />
                    <p className="text-sm">No installment records found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(plan.transaction_date)}
                  </TableCell>
                  <TableCell className="text-sm font-medium whitespace-nowrap">
                    {plan.installment_company ?? "HomeCredit"}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {plan.customer_name ?? (
                      <span className="text-muted-foreground italic">No customer</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(plan.sale_total)}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {plan.downpayment > 0 ? formatCurrency(plan.downpayment) : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold">
                    {formatCurrency(plan.hc_amount)}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {plan.terms} mos
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {plan.hc_account_number ?? <span className="italic">—</span>}
                  </TableCell>
                  <TableCell className="text-center">
                    {plan.status === "pending" ? (
                      <Badge className="rounded-full text-xs bg-yellow-500/10 text-yellow-700 border-yellow-300 dark:text-yellow-400 dark:border-yellow-600">
                        Pending
                      </Badge>
                    ) : (
                      <div className="flex flex-col items-center gap-0.5">
                        <Badge className="rounded-full text-xs bg-green-500/10 text-green-700 border-green-300 dark:text-green-400 dark:border-green-600">
                          Received
                        </Badge>
                        {plan.received_at && (
                          <span className="text-[11px] text-muted-foreground">
                            {formatDate(plan.received_at)}
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  {canMarkReceived && (
                    <TableCell className="text-center">
                      {plan.status === "pending" ? (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs"
                          disabled={isPending}
                          onClick={() => handleMarkReceived(plan.id)}
                        >
                          Mark Received
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

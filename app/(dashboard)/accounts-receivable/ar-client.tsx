"use client"

import * as React from "react"
import { formatDate } from "@/lib/format"
import { useCurrency } from "@/lib/context/currency"
import type { AREntry } from "@/lib/actions/ar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"

interface ARClientProps {
  initialEntries: AREntry[]
  userRole: string
}

export function ARClient({ initialEntries }: ARClientProps) {
  const { formatCurrency } = useCurrency()
  const [search, setSearch] = React.useState("")

  const filtered = initialEntries.filter((e) =>
    e.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    e.transaction_id.toLowerCase().includes(search.toLowerCase())
  )

  const totalDue = initialEntries.reduce((s, e) => s + e.amount_due, 0)
  const totalOutstanding = initialEntries.reduce((s, e) => s + e.balance, 0)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Accounts Receivable</h1>
          <p className="text-sm text-muted-foreground">Credit sales (utang) tracking</p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-lg border bg-card px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">Total Billed</p>
            <p className="text-base font-semibold">{formatCurrency(totalDue)}</p>
          </div>
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-base font-semibold text-amber-600 dark:text-amber-400">
              {formatCurrency(totalOutstanding)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by customer or receipt #"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left font-semibold">Date</th>
              <th className="px-4 py-3 text-left font-semibold">Customer</th>
              <th className="px-4 py-3 text-left font-semibold">Cashier</th>
              <th className="px-4 py-3 text-right font-semibold">Amount Due</th>
              <th className="px-4 py-3 text-right font-semibold">Paid</th>
              <th className="px-4 py-3 text-right font-semibold">Balance</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No credit sales found
                </td>
              </tr>
            ) : (
              filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 tabular-nums">{formatDate(entry.created_at)}</td>
                  <td className="px-4 py-3 font-medium">{entry.customer_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.cashier_name}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(entry.amount_due)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-green-600 dark:text-green-400">
                    {entry.amount_paid > 0 ? formatCurrency(entry.amount_paid) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {entry.balance > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400">{formatCurrency(entry.balance)}</span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">{formatCurrency(0)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        entry.balance <= 0
                          ? "border-transparent bg-green-500/15 text-green-700 dark:text-green-400"
                          : "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      }
                    >
                      {entry.balance <= 0 ? "Paid" : "Unpaid"}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

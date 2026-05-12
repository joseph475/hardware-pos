"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type MatrixRow = {
  product_id: string
  product_name: string
  sku: string
  byBranch: Record<string, number>
}

interface Props {
  branches: Array<{ id: string; name: string }>
  rows: MatrixRow[]
}

export function CrossBranchClient({ branches, rows }: Props) {
  const [inputValue, setInputValue] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [isPending, startTransition] = React.useTransition()

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)
    startTransition(() => setSearch(val))
  }

  const filtered = rows.filter(
    (r) =>
      r.product_name.toLowerCase().includes(search.toLowerCase()) ||
      r.sku.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Cross-Branch Stock</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Stock levels per product across all branches
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Input
          placeholder="Search products…"
          value={inputValue}
          onChange={handleSearch}
          className="max-w-xs"
        />
        <span className="text-sm text-muted-foreground">
          {isPending ? "…" : `${filtered.length} product${filtered.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="pl-4 min-w-[200px]">Product</TableHead>
                <TableHead className="min-w-[80px]">SKU</TableHead>
                {branches.map((b) => (
                  <TableHead
                    key={b.id}
                    className="text-center min-w-[100px]"
                  >
                    {b.name}
                  </TableHead>
                ))}
                <TableHead className="text-center min-w-[80px]">
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={branches.length + 3}
                    className="py-16 text-center text-muted-foreground"
                  >
                    No products found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => {
                  const total = branches.reduce(
                    (sum, b) => sum + (row.byBranch[b.id] ?? 0),
                    0
                  )
                  return (
                    <TableRow key={row.product_id}>
                      <TableCell className="pl-4 font-medium">
                        {row.product_name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {row.sku}
                      </TableCell>
                      {branches.map((b) => {
                        const qty = row.byBranch[b.id] ?? 0
                        return (
                          <TableCell
                            key={b.id}
                            className={cn(
                              "text-center tabular-nums",
                              qty === 0 && "text-muted-foreground"
                            )}
                          >
                            {qty}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-center font-semibold tabular-nums">
                        {total}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

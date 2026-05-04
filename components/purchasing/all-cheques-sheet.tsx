"use client"

import * as React from "react"
import { Banknote, ChevronLeft, ChevronRight, Search } from "lucide-react"
import { toast } from "sonner"
import { handleError } from "@/lib/utils/error-handler"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDate, formatNumber } from "@/lib/format"
import { getAllCheques } from "@/lib/actions/purchasing"
import { ChequeDetailsDialog } from "@/components/purchasing/cheque-details-dialog"
import type { ChequeWithPO } from "@/lib/actions/purchasing"

const PAGE_SIZE = 10

export function AllChequesSheet() {
  const [open, setOpen] = React.useState(false)
  const [cheques, setCheques] = React.useState<ChequeWithPO[]>([])
  const [chequePO, setChequePO] = React.useState<{ id: string; total: number } | null>(null)
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)

  async function fetchCheques() {
    try {
      const data = await getAllCheques()
      setCheques(data)
    } catch (err) {
      handleError(err, 'load cheques')
    }
  }

  React.useEffect(() => {
    if (open) {
      fetchCheques()
      setSearch("")
      setPage(1)
    }
  }, [open])

  const filtered = cheques.filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      c.po_id.slice(0, 8).toLowerCase().includes(q) ||
      c.check_number.toLowerCase().includes(q)
    )
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleRowClick(cheque: ChequeWithPO) {
    setChequePO({ id: cheque.po_id, total: cheque.po_total })
  }

  function handleDialogClose(v: boolean) {
    if (!v) {
      setChequePO(null)
      fetchCheques()
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Banknote className="size-4 mr-2" />
        View All Cheques
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>All Cheques</DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by PO # or Check #…"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          {cheques.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cheques recorded yet.</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cheques match your search.</p>
          ) : (
            <div className="overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="pl-4">PO</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Payee</TableHead>
                    <TableHead>Check #</TableHead>
                    <TableHead className="text-right pr-4">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((c) => (
                    <TableRow
                      key={c.id}
                      className="border-b border-border/50 cursor-pointer hover:bg-muted/40"
                      onClick={() => handleRowClick(c)}
                    >
                      <TableCell className="pl-4 text-xs text-muted-foreground">
                        <span className="font-mono">{c.po_id.slice(0, 8).toUpperCase()}</span>
                        <span className="ml-1 text-muted-foreground/70">· {c.supplier_name}</span>
                      </TableCell>
                      <TableCell className="tabular-nums text-sm">
                        {formatDate(c.check_date)}
                      </TableCell>
                      <TableCell className="text-sm">{c.check_name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.check_number}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums pr-4">
                        {formatNumber(c.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {filtered.length > PAGE_SIZE
                  ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length}`
                  : `${filtered.length} cheque${filtered.length !== 1 ? "s" : ""}`}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-1">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ChequeDetailsDialog
        po={chequePO}
        open={!!chequePO}
        onOpenChange={handleDialogClose}
      />
    </>
  )
}

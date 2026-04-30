"use client"

import * as React from "react"
import { Banknote } from "lucide-react"
import { toast } from "sonner"
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
import { formatDate, formatNumber } from "@/lib/format"
import { getAllCheques } from "@/lib/actions/purchasing"
import { ChequeDetailsDialog } from "@/components/purchasing/cheque-details-dialog"
import type { ChequeWithPO } from "@/lib/actions/purchasing"

export function AllChequesSheet() {
  const [open, setOpen] = React.useState(false)
  const [cheques, setCheques] = React.useState<ChequeWithPO[]>([])
  const [chequePO, setChequePO] = React.useState<{ id: string; total: number } | null>(null)

  async function fetchCheques() {
    try {
      const data = await getAllCheques()
      setCheques(data)
    } catch {
      toast.error("Failed to load cheques")
    }
  }

  React.useEffect(() => {
    if (open) fetchCheques()
  }, [open])

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

          {cheques.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cheques recorded yet.</p>
          ) : (
            <div className="overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Payee</TableHead>
                    <TableHead>Check #</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="pr-4">PO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cheques.map((c) => (
                    <TableRow
                      key={c.id}
                      className="border-b border-border/50 cursor-pointer hover:bg-muted/40"
                      onClick={() => handleRowClick(c)}
                    >
                      <TableCell className="pl-4 tabular-nums text-sm">
                        {formatDate(c.check_date)}
                      </TableCell>
                      <TableCell className="text-sm">{c.check_name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.check_number}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {formatNumber(c.amount)}
                      </TableCell>
                      <TableCell className="pr-4 text-xs text-muted-foreground">
                        <span className="font-mono">{c.po_id.slice(0, 8).toUpperCase()}</span>
                        <span className="ml-1 text-muted-foreground/70">· {c.supplier_name}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {cheques.length > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              {cheques.length} cheque{cheques.length !== 1 ? "s" : ""}
            </p>
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

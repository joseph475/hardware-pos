"use client"

import * as React from "react"
import { Banknote } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
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
import type { ChequeWithPO, POWithRelations } from "@/lib/actions/purchasing"

interface Props {
  fullOrders: POWithRelations[]
}

export function AllChequesSheet({ fullOrders: _fullOrders }: Props) {
  const [open, setOpen] = React.useState(false)
  const [cheques, setCheques] = React.useState<ChequeWithPO[]>([])
  const [chequePO, setChequePO] = React.useState<{ id: string; total: number } | null>(null)

  async function fetchCheques() {
    try {
      const data = await getAllCheques()
      setCheques(data)
    } catch {
      // auth failure or server error — silently fail, sheet stays empty
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
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" />} nativeButton={true}>
          <Banknote className="size-4 mr-2" />
          View All Cheques
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>All Cheques</SheetTitle>
          </SheetHeader>

          {cheques.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-4">No cheques recorded yet.</p>
          ) : (
            <div className="mt-4 border rounded-md overflow-hidden">
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
            <p className="text-xs text-muted-foreground mt-3 text-right">
              {cheques.length} cheque{cheques.length !== 1 ? "s" : ""}
            </p>
          )}
        </SheetContent>
      </Sheet>

      <ChequeDetailsDialog
        po={chequePO}
        open={!!chequePO}
        onOpenChange={handleDialogClose}
      />
    </>
  )
}

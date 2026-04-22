"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NewTransferSheet } from "./new-transfer-sheet";
import { updateTransferStatus } from "@/lib/actions/transfers";
import type { Branch, Product } from "@/types/database";

type TransferStatus = "pending" | "approved" | "in_transit" | "completed" | "cancelled";

export interface TransferRow {
  id: string;
  from_branch: string;
  to_branch: string;
  status: TransferStatus;
  items: number;
  created_by: string;
  created_at: string;
  notes: string | null;
}

interface TransfersClientProps {
  initialTransfers: TransferRow[];
  branches: Branch[];
  products: Product[];
  isCashier: boolean;
}

const STATUS_CONFIG: Record<TransferStatus, { label: string; className: string }> = {
  pending:    { label: "Pending",    className: "bg-amber-500/15 text-amber-500 border-transparent" },
  approved:   { label: "Approved",   className: "bg-blue-500/15 text-blue-500 border-transparent" },
  in_transit: { label: "In Transit", className: "bg-violet-500/15 text-violet-500 border-transparent" },
  completed:  { label: "Completed",  className: "bg-emerald-500/15 text-emerald-500 border-transparent" },
  cancelled:  { label: "Cancelled",  className: "bg-muted text-muted-foreground border-transparent" },
};

function TransferBadge({ status }: { status: TransferStatus }) {
  const { label, className } = STATUS_CONFIG[status];
  return <Badge className={className}>{label}</Badge>;
}

function TransfersTable({
  transfers,
  onStatusChange,
  isCashier,
}: {
  transfers: TransferRow[];
  onStatusChange: (id: string, status: "approved" | "in_transit" | "completed" | "cancelled") => void;
  isCashier: boolean;
}) {
  if (transfers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ArrowRight className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-foreground">No transfers found</p>
        <p className="text-xs text-muted-foreground mt-1">
          Transfers in this category will appear here.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-b border-border hover:bg-transparent">
          <TableHead className="pl-4">Transfer ID</TableHead>
          <TableHead>From</TableHead>
          <TableHead />
          <TableHead>To</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-center">Items</TableHead>
          <TableHead>Created By</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="w-10 pr-4" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {transfers.map((t) => (
          <TableRow key={t.id} className="border-b border-border/50">
            <TableCell className="pl-4">
              <span className="font-mono text-xs text-foreground font-medium">
                {t.id.slice(0, 8).toUpperCase()}
              </span>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{t.from_branch}</TableCell>
            <TableCell className="px-1">
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{t.to_branch}</TableCell>
            <TableCell>
              <TransferBadge status={t.status} />
            </TableCell>
            <TableCell className="text-center text-sm tabular-nums text-muted-foreground">
              {t.items}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{t.created_by}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground" suppressHydrationWarning>
              {new Date(t.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell className="pr-4">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!isCashier && t.status === "pending" && (
                    <DropdownMenuItem onClick={() => onStatusChange(t.id, "approved")}>
                      Approve
                    </DropdownMenuItem>
                  )}
                  {!isCashier && t.status === "approved" && (
                    <DropdownMenuItem onClick={() => onStatusChange(t.id, "in_transit")}>
                      Mark In Transit
                    </DropdownMenuItem>
                  )}
                  {!isCashier && t.status === "in_transit" && (
                    <DropdownMenuItem onClick={() => onStatusChange(t.id, "completed")}>
                      Mark Completed
                    </DropdownMenuItem>
                  )}
                  {!isCashier && (t.status === "pending" || t.status === "approved") && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onStatusChange(t.id, "cancelled")}
                      >
                        Cancel
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function TransfersClient({ initialTransfers, branches, products, isCashier }: TransfersClientProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [isPending, startTransition] = useTransition();

  const byStatus = (statuses: TransferStatus[]) =>
    initialTransfers.filter((t) => statuses.includes(t.status));

  function handleStatusChange(
    transferId: string,
    status: "approved" | "in_transit" | "completed" | "cancelled"
  ) {
    startTransition(async () => {
      await updateTransferStatus({ transferId, status });
      router.refresh();
    });
  }

  function handleSheetOpenChange(open: boolean) {
    setSheetOpen(open);
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Stock Transfers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage stock movements between branches
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)} disabled={isPending}>
          <Plus className="h-4 w-4" />
          New Transfer
        </Button>
      </div>

      {/* Tabs + Table */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            All
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0 text-xs tabular-nums text-muted-foreground">
              {initialTransfers.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0 text-xs tabular-nums text-muted-foreground">
              {byStatus(["pending"]).length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="in_transit">
            In Transit
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0 text-xs tabular-nums text-muted-foreground">
              {byStatus(["approved", "in_transit"]).length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed
            <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0 text-xs tabular-nums text-muted-foreground">
              {byStatus(["completed"]).length}
            </span>
          </TabsTrigger>
        </TabsList>

        <Card className="mt-3">
          <CardContent className="p-0">
            <TabsContent value="all">
              <TransfersTable transfers={initialTransfers} onStatusChange={handleStatusChange} isCashier={isCashier} />
            </TabsContent>
            <TabsContent value="pending">
              <TransfersTable transfers={byStatus(["pending"])} onStatusChange={handleStatusChange} isCashier={isCashier} />
            </TabsContent>
            <TabsContent value="in_transit">
              <TransfersTable transfers={byStatus(["approved", "in_transit"])} onStatusChange={handleStatusChange} isCashier={isCashier} />
            </TabsContent>
            <TabsContent value="completed">
              <TransfersTable transfers={byStatus(["completed"])} onStatusChange={handleStatusChange} isCashier={isCashier} />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      <NewTransferSheet
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        branches={branches}
        products={products}
      />
    </div>
  );
}

"use client";

import * as React from "react";
import { Package, AlertTriangle, XCircle, Building2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Branch } from "@/types/database";

export interface StockRow {
  id: string;
  product_name: string;
  sku: string;
  branch_name: string;
  branch_id: string;
  quantity: number;
  threshold: number;
  updated_at: string;
}

interface StockClientProps {
  initialRows: StockRow[];
  branches: Branch[];
  userBranchId?: string | null;
  userRole?: "owner" | "manager" | "cashier";
}

type StockStatus = "in_stock" | "low" | "out";

function getStatus(qty: number, threshold: number): StockStatus {
  if (qty === 0) return "out";
  if (qty <= threshold) return "low";
  return "in_stock";
}

function StatusBadge({ qty, threshold }: { qty: number; threshold: number }) {
  const status = getStatus(qty, threshold);
  if (status === "out") {
    return (
      <Badge className="bg-red-500/15 text-red-500 border-transparent">
        Out of Stock
      </Badge>
    );
  }
  if (status === "low") {
    return (
      <Badge className="bg-amber-500/15 text-amber-500 border-transparent">
        Low Stock
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-500/15 text-emerald-500 border-transparent">
      In Stock
    </Badge>
  );
}

export function StockClient({ initialRows, branches, userBranchId, userRole }: StockClientProps) {
  const defaultBranch =
    userRole && userRole !== "owner" && userBranchId ? userBranchId : "all";
  const [selectedBranch, setSelectedBranch] = React.useState(defaultBranch);
  const [search, setSearch] = React.useState("");

  const filtered = initialRows.filter((r) => {
    const matchBranch = selectedBranch === "all" || r.branch_id === selectedBranch;
    const matchSearch =
      !search ||
      r.product_name.toLowerCase().includes(search.toLowerCase()) ||
      r.sku.toLowerCase().includes(search.toLowerCase());
    return matchBranch && matchSearch;
  });

  const totalProducts = filtered.length;
  const lowStock = filtered.filter(
    (r) => getStatus(r.quantity, r.threshold) === "low"
  ).length;
  const outOfStock = filtered.filter((r) => r.quantity === 0).length;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Stock Levels</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor inventory across branches
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-full sm:w-52"
            />
          </div>
          <Building2 className="hidden sm:block h-4 w-4 text-muted-foreground" />
          <Select
            value={selectedBranch}
            onValueChange={(v) => { if (v !== null) setSelectedBranch(v); }}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue>
                {selectedBranch === "all"
                  ? "All Branches"
                  : (branches.find((b) => b.id === selectedBranch)?.name ?? "All Branches")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <Package className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{totalProducts}</p>
              <p className="text-xs text-muted-foreground">Total Products</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{lowStock}</p>
              <p className="text-xs text-muted-foreground">Low Stock Items</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{outOfStock}</p>
              <p className="text-xs text-muted-foreground">Out of Stock</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-sm font-medium">Inventory Details</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">No inventory records found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try selecting a different branch.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="pl-4">Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Threshold</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-muted-foreground">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => (
                  <TableRow key={row.id} className="border-b border-border/50">
                    <TableCell className="pl-4 font-medium text-foreground">
                      {row.product_name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.sku}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.branch_name}</TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${
                        row.quantity === 0
                          ? "text-red-500"
                          : row.quantity <= row.threshold
                          ? "text-amber-500"
                          : "text-foreground"
                      }`}
                    >
                      {row.quantity}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {row.threshold}
                    </TableCell>
                    <TableCell>
                      <StatusBadge qty={row.quantity} threshold={row.threshold} />
                    </TableCell>
                    <TableCell className="pr-4 text-xs text-muted-foreground font-mono" suppressHydrationWarning>
                      {new Date(row.updated_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

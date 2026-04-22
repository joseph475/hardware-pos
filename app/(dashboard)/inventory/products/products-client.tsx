"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ProductDialog } from "./components/product-dialog";
import { useCurrency } from "@/lib/context/currency";
import { upsertProduct, deleteProduct, toggleProductActive } from "@/lib/actions/products";
import { createStockAdjustment } from "@/lib/actions/inventory";
import type { ProductSaveValues } from "./components/product-dialog";
import type { Product, Category, Branch } from "@/types/database";

export type ProductWithCategory = Product & { category_name: string | null };

interface ProductsClientProps {
  initialProducts: ProductWithCategory[];
  categories: Category[];
  branches: Branch[];
}

const PAGE_SIZE = 6;

function ProductAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <Avatar className="h-8 w-8 rounded-md">
      <AvatarFallback className="rounded-md bg-muted text-muted-foreground text-xs font-medium">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

export function ProductsClient({ initialProducts, categories, branches }: ProductsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("All");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [editingProduct, setEditingProduct] = React.useState<ProductWithCategory | null>(null);

  function handleSave(product: Product | undefined, values: ProductSaveValues) {
    startTransition(async () => {
      const { id: productId } = await upsertProduct({ id: product?.id, ...values });
      if (!product && values.opening_stock_qty && values.opening_stock_qty > 0 && values.opening_stock_branch_id) {
        await createStockAdjustment({
          product_id: productId,
          branch_id: values.opening_stock_branch_id,
          type: "adjustment",
          quantity: values.opening_stock_qty,
          adjustment_direction: "add",
          notes: "Opening stock",
        });
      }
      router.refresh();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteProduct(id);
      router.refresh();
    });
  }

  function handleToggleActive(id: string, isActive: boolean) {
    startTransition(async () => {
      await toggleProductActive(id, isActive);
      router.refresh();
    });
  }

  const categoryOptions = ["All", ...categories.map((c) => c.name)];

  const filtered = initialProducts.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      categoryFilter === "All" || p.category_name === categoryFilter;
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && p.is_active) ||
      (statusFilter === "inactive" && !p.is_active);
    return matchSearch && matchCategory && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  React.useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your product catalog
          </p>
        </div>
        <ProductDialog
          categories={categories}
          branches={branches}
          onSave={(values) => handleSave(undefined, values)}
          trigger={
            <Button>
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          }
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name or SKU…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={categoryFilter}
              onValueChange={(v) => { if (v !== null) setCategoryFilter(v); }}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => { if (v !== null) setStatusFilter(v); }}
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">No products found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try adjusting your filters or add a new product.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="w-10 pl-4" />
                  <TableHead>Name / SKU</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((product) => (
                  <TableRow key={product.id} className="border-b border-border/50">
                    <TableCell className="pl-4">
                      <ProductAvatar name={product.name} />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">{product.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{product.sku}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.category_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground capitalize">
                      {product.unit}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(product.cost_price)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">
                      {formatCurrency(product.selling_price)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={product.is_active ? "default" : "outline"}
                        className={
                          product.is_active
                            ? "bg-emerald-500/15 text-emerald-500 border-transparent"
                            : "text-muted-foreground"
                        }
                      >
                        {product.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="ghost" size="icon-sm" aria-label="Actions" />
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingProduct(product)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(product.id, !product.is_active)}>
                            <ToggleLeft className="h-4 w-4" />
                            {product.is_active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => handleDelete(product.id)}>
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit product dialog (controlled, outside dropdown) */}
      <ProductDialog
        product={editingProduct ?? undefined}
        categories={categories}
        open={!!editingProduct}
        onOpenChange={(v) => { if (!v) setEditingProduct(null); }}
        onSave={(values) => {
          if (editingProduct) handleSave(editingProduct, values);
          setEditingProduct(null);
        }}
      />

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Pencil, Trash2, Tag } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { upsertCategory, deleteCategory } from "@/lib/actions/categories";
import type { Category } from "@/types/database";

type CategoryRow = Category & { product_count: number };

const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(50, "Name too long"),
});
type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryDialogProps {
  category?: CategoryRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: CategoryFormValues) => void;
  isPending: boolean;
}

function CategoryDialog({ category, open, onOpenChange, onSave, isPending }: CategoryDialogProps) {
  const isEdit = !!category;
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: category?.name ?? "" },
  });

  React.useEffect(() => {
    if (open) reset({ name: category?.name ?? "" });
  }, [open, category, reset]);

  function onSubmit(values: CategoryFormValues) {
    onSave(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Category" : "Add Category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cat-name"
              placeholder="e.g. Beverages"
              autoFocus
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CategoriesClientProps {
  initialCategories: CategoryRow[];
}

export function CategoriesClient({ initialCategories }: CategoriesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingCat, setEditingCat] = React.useState<CategoryRow | undefined>();

  function openAdd() {
    setEditingCat(undefined);
    setDialogOpen(true);
  }

  function openEdit(cat: CategoryRow) {
    setEditingCat(cat);
    setDialogOpen(true);
  }

  function handleSave(values: CategoryFormValues) {
    startTransition(async () => {
      await upsertCategory({ id: editingCat?.id, name: values.name });
      router.refresh();
      setDialogOpen(false);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteCategory(id);
      router.refresh();
    });
  }

  const totalProducts = initialCategories.reduce((s, c) => s + c.product_count, 0);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organise your products into categories
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Category
        </Button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{initialCategories.length}</span> categories
        </span>
        <span>·</span>
        <span>
          <span className="font-medium text-foreground">{totalProducts}</span> total products
        </span>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {initialCategories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Tag className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">No categories yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add your first category to get started.</p>
              <Button className="mt-4" size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Add Category
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="pl-4 w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead className="text-center">Products</TableHead>
                  <TableHead className="pr-4">Created</TableHead>
                  <TableHead className="w-10 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialCategories.map((cat) => (
                  <TableRow key={cat.id} className="border-b border-border/50">
                    <TableCell className="pl-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{cat.name}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
                        {cat.product_count}
                      </span>
                    </TableCell>
                    <TableCell className="pr-4 font-mono text-xs text-muted-foreground">
                      {cat.created_at.slice(0, 10)}
                    </TableCell>
                    <TableCell className="pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(cat)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDelete(cat.id)}
                          >
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

      <CategoryDialog
        category={editingCat}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        isPending={isPending}
      />
    </div>
  );
}

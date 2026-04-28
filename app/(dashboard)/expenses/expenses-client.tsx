"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Pencil, Trash2, Receipt } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { upsertExpense, deleteExpense } from "@/lib/actions/expenses";
import type { ExpenseWithCreator } from "@/lib/actions/expenses";
import { useCurrency } from "@/lib/context/currency";
import { formatDate } from "@/lib/format";

const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Salaries & Wages",
  "Office Supplies",
  "Equipment & Maintenance",
  "Marketing & Advertising",
  "Transportation",
  "Taxes & Licenses",
  "Insurance",
  "Food & Entertainment",
  "Bank Charges",
  "Repairs & Maintenance",
  "Others",
] as const;

// Returns today's date as YYYY-MM-DD in Philippine Time (UTC+8)
function getPHTodayString() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const expenseSchema = z.object({
  category: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  note: z.string().optional(),
});
type ExpenseFormValues = z.infer<typeof expenseSchema>;

interface ExpenseDialogProps {
  expense?: ExpenseWithCreator;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function ExpenseDialog({ expense, open, onOpenChange, onSaved }: ExpenseDialogProps) {
  const isEdit = !!expense;
  const [saving, setSaving] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(expenseSchema) as any,
    defaultValues: {
      category: expense?.category ?? "",
      date: expense?.date ?? getPHTodayString(),
      amount: expense?.amount ?? undefined,
      note: expense?.note ?? "",
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        category: expense?.category ?? "",
        date: expense?.date ?? getPHTodayString(),
        amount: expense?.amount ?? undefined,
        note: expense?.note ?? "",
      });
    }
  }, [open, expense, reset]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function onSubmit(values: any) {
    setSaving(true);
    try {
      await upsertExpense({
        id: expense?.id,
        category: values.category,
        date: values.date,
        amount: values.amount,
        note: values.note || null,
      });
      toast.success(isEdit ? "Expense updated" : "Expense added");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setSaving(false);
    }
  }

  const selectedCategory = watch("category");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Expense" : "Add Expense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>
              Category <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedCategory}
              onValueChange={(val) => { if (val !== null) setValue("category", val, { shouldValidate: true }); }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select category">
                  {selectedCategory || "Select category"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="exp-date"
              type="date"
              aria-invalid={!!errors.date}
              {...register("date")}
            />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-amount">
              Amount <span className="text-destructive">*</span>
            </Label>
            <Input
              id="exp-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              aria-invalid={!!errors.amount}
              {...register("amount")}
            />
            {errors.amount && (
              <p className="text-xs text-destructive">{errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exp-note">Note</Label>
            <Textarea
              id="exp-note"
              placeholder="Optional note"
              rows={3}
              {...register("note")}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ExpensesClientProps {
  initialExpenses: ExpenseWithCreator[];
}

export function ExpensesClient({ initialExpenses }: ExpensesClientProps) {
  const router = useRouter();
  const { formatCurrency } = useCurrency();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingExpense, setEditingExpense] = React.useState<ExpenseWithCreator | undefined>();
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [deleting, setDeleting] = React.useState<string | null>(null);

  function openAdd() {
    setEditingExpense(undefined);
    setDialogOpen(true);
  }

  function openEdit(expense: ExpenseWithCreator) {
    setEditingExpense(expense);
    setDialogOpen(true);
  }

  async function handleDelete(expense: ExpenseWithCreator) {
    if (!window.confirm(`Delete this expense (${expense.category} — ${formatCurrency(expense.amount)})?`)) return;
    setDeleting(expense.id);
    try {
      await deleteExpense(expense.id);
      toast.success("Expense deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete expense");
    } finally {
      setDeleting(null);
    }
  }

  const hasFilters = categoryFilter !== "all" || dateFrom !== "" || dateTo !== "";

  const filtered = initialExpenses.filter((e) => {
    if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  });

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track and manage company expenses
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Expense
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="w-64">
            <p className="text-xs text-muted-foreground mb-1.5">Category</p>
            <Select value={categoryFilter} onValueChange={(v) => { if (v !== null) setCategoryFilter(v); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All categories">
                  {categoryFilter === "all" ? "All categories" : categoryFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1.5">From</p>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
            />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1.5">To</p>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
            />
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCategoryFilter("all"); setDateFrom(""); setDateTo(""); }}
              className="text-muted-foreground"
            >
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Receipt className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No expenses found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {hasFilters ? "Try adjusting your filters" : "Add your first expense to get started"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">{expense.category}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(expense.date)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {expense.note ?? <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon" className="h-8 w-8" disabled={deleting === expense.id} aria-label="Actions" />}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(expense)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(expense)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
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

        {filtered.length > 0 && (
          <div className="border-t border-border px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "expense" : "expenses"}
            </p>
            <p className="text-sm font-semibold">
              Total: {formatCurrency(total)}
            </p>
          </div>
        )}
      </Card>

      <ExpenseDialog
        expense={editingExpense}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

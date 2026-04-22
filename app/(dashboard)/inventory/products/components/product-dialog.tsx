"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Product, Category, Branch } from "@/types/database";
import { useCurrency } from "@/lib/context/currency";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  barcode: z.string().optional(),
  category_id: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  cost_price: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Must be 0 or greater"),
  selling_price: z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Must be 0 or greater"),
  description: z.string().optional(),
  is_active: z.boolean(),
  opening_stock_qty: z.string().optional(),
  opening_stock_branch_id: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export interface ProductSaveValues {
  name: string;
  sku: string;
  barcode?: string;
  category_id?: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  description?: string;
  is_active: boolean;
  opening_stock_qty?: number;
  opening_stock_branch_id?: string;
}

const UNITS = ["each", "kg", "g", "liter", "ml", "dozen", "pack", "box", "bottle", "can"];

interface ProductDialogProps {
  product?: Product;
  trigger?: React.ReactNode;
  categories: Category[];
  branches?: Branch[];
  onSave?: (values: ProductSaveValues) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ProductDialog({ product, trigger, categories, branches = [], onSave, open: controlledOpen, onOpenChange }: ProductDialogProps) {
  const isEdit = !!product;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const { currencyCode, locale } = useCurrency();
  const currencySymbol = new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? currencyCode;

  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      sku: product?.sku ?? "",
      barcode: product?.barcode ?? "",
      category_id: product?.category_id ?? "",
      unit: product?.unit ?? "each",
      cost_price: String(product?.cost_price ?? "0"),
      selling_price: String(product?.selling_price ?? "0"),
      description: product?.description ?? "",
      is_active: product?.is_active ?? true,
      opening_stock_qty: "",
      opening_stock_branch_id: "",
    },
  });

  React.useEffect(() => {
    if (open) {
      reset({
        name: product?.name ?? "",
        sku: product?.sku ?? "",
        barcode: product?.barcode ?? "",
        category_id: product?.category_id ?? "",
        unit: product?.unit ?? "each",
        cost_price: String(product?.cost_price ?? "0"),
        selling_price: String(product?.selling_price ?? "0"),
        description: product?.description ?? "",
        is_active: product?.is_active ?? true,
        opening_stock_qty: "",
        opening_stock_branch_id: "",
      });
    }
  }, [open, product, reset]);

  const isActive = watch("is_active");

  const openingBranchId = watch("opening_stock_branch_id");

  function onSubmit(values: ProductFormValues) {
    const qty = parseFloat(values.opening_stock_qty ?? "") || 0;
    onSave?.({
      ...values,
      cost_price: parseFloat(values.cost_price),
      selling_price: parseFloat(values.selling_price),
      opening_stock_qty: qty > 0 ? qty : undefined,
      opening_stock_branch_id: qty > 0 ? values.opening_stock_branch_id : undefined,
    });
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger && (
        <SheetTrigger render={trigger as React.ReactElement} />
      )}
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">
              {isEdit ? "Edit Product" : "Add Product"}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isEdit ? "Update product details" : "Add a new product to your inventory"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1">
            <div className="flex-1 px-6 py-4 space-y-4 overflow-y-auto">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Product name"
                  aria-invalid={!!errors.name}
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* SKU + Barcode */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sku">
                    SKU <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="sku"
                    placeholder="SKU-001"
                    aria-invalid={!!errors.sku}
                    {...register("sku")}
                  />
                  {errors.sku && (
                    <p className="text-xs text-destructive">{errors.sku.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    id="barcode"
                    placeholder="Optional"
                    {...register("barcode")}
                  />
                </div>
              </div>

              {/* Category + Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={watch("category_id") ?? ""}
                    onValueChange={(val) => {
                      if (val !== null) setValue("category_id", val);
                    }}
                  >
                    <SelectTrigger className="w-full" id="category">
                      <SelectValue placeholder="Select category">
                        {categories.find((c) => c.id === watch("category_id"))?.name ?? "Select category"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unit">
                    Unit <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={watch("unit") ?? "each"}
                    onValueChange={(val) => {
                      if (val !== null) setValue("unit", val);
                    }}
                  >
                    <SelectTrigger className="w-full" id="unit">
                      <SelectValue placeholder="Select unit">
                        {watch("unit") ?? "Select unit"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.unit && (
                    <p className="text-xs text-destructive">{errors.unit.message}</p>
                  )}
                </div>
              </div>

              {/* Cost Price + Selling Price */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cost_price">
                    Cost Price <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
                    <Input
                      id="cost_price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="pl-6"
                      aria-invalid={!!errors.cost_price}
                      {...register("cost_price")}
                    />
                  </div>
                  {errors.cost_price && (
                    <p className="text-xs text-destructive">{errors.cost_price.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="selling_price">
                    Selling Price <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
                    <Input
                      id="selling_price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="pl-6"
                      aria-invalid={!!errors.selling_price}
                      {...register("selling_price")}
                    />
                  </div>
                  {errors.selling_price && (
                    <p className="text-xs text-destructive">{errors.selling_price.message}</p>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional product description"
                  rows={3}
                  {...register("description")}
                />
              </div>

              {/* Opening Stock (add mode only) */}
              {!isEdit && branches.length > 0 && (
                <div className="space-y-3 rounded-lg border border-dashed border-border px-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Opening Stock</p>
                    <p className="text-xs text-muted-foreground">Optional — set initial quantity for a branch</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="opening_stock_qty">Quantity</Label>
                      <Input
                        id="opening_stock_qty"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="0"
                        {...register("opening_stock_qty")}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="opening_stock_branch">Branch</Label>
                      <Select
                        value={openingBranchId ?? ""}
                        onValueChange={(val) => {
                          if (val !== null) setValue("opening_stock_branch_id", val);
                        }}
                      >
                        <SelectTrigger className="w-full" id="opening_stock_branch">
                          <SelectValue placeholder="Select branch">
                            {branches.find((b) => b.id === openingBranchId)?.name ?? "Select branch"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">Active</p>
                  <p className="text-xs text-muted-foreground">Product is available for sale</p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={(checked) => setValue("is_active", checked)}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border bg-muted/40 px-6 py-4 flex items-center justify-end gap-2">
              <Button type="submit">
                {isEdit ? "Save Changes" : "Add Product"}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}

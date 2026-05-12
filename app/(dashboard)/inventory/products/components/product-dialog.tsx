"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import type { Product, Category, Branch, Supplier } from "@/types/database";
import { useCurrency } from "@/lib/context/currency";
import { ImageIcon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { handleError } from "@/lib/utils/error-handler";
import { uploadProductImage } from "@/lib/actions/upload";

const supplierRowSchema = z.object({
  supplier_id: z.string().min(1, "Select a supplier"),
  cost_price: z.string().refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
    "Must be 0 or greater"
  ),
  stock_qty: z.string().optional(),
});

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  barcode: z.string().optional(),
  category_id: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
  selling_price: z.string().refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
    "Must be 0 or greater"
  ),
  description: z.string().optional(),
  is_active: z.boolean(),
  serial_required: z.boolean(),
  warranty_days: z.number().int().min(0).nullable().optional(),
  suppliers: z.array(supplierRowSchema).optional(),
  opening_stock_branch_id: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export interface ProductSaveValues {
  name: string;
  sku: string;
  barcode?: string;
  category_id?: string;
  supplier_id?: string;
  unit: string;
  cost_price: number;
  selling_price: number;
  description?: string;
  is_active: boolean;
  serial_required: boolean;
  warranty_days?: number | null;
  image_url?: string | null;
  suppliers: Array<{ supplier_id: string; cost_price: number; stock_qty?: number }>;
  opening_stock_branch_id?: string;
}

const UNITS = ["each", "kg", "g", "liter", "ml", "dozen", "pack", "box", "bottle", "can"];

interface ProductDialogProps {
  product?: Product;
  productSuppliers?: Array<{ supplier_id: string; cost_price: number }>;
  trigger?: React.ReactNode;
  categories: Category[];
  branches?: Branch[];
  suppliers?: Pick<Supplier, "id" | "name">[];
  defaultBranchId?: string;
  onSave?: (values: ProductSaveValues) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ProductDialog({
  product,
  productSuppliers = [],
  trigger,
  categories,
  branches = [],
  suppliers = [],
  defaultBranchId,
  onSave,
  open: controlledOpen,
  onOpenChange,
}: ProductDialogProps) {
  const isEdit = !!product;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = React.useState<string | null>(product?.image_url ?? null);
  const [uploading, setUploading] = React.useState(false);
  const { currencyCode, locale } = useCurrency();
  const currencySymbol = new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode })
    .formatToParts(0)
    .find((p) => p.type === "currency")?.value ?? currencyCode;

  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  function buildDefaultSuppliers() {
    if (productSuppliers.length > 0) {
      return productSuppliers.map((ps) => ({
        supplier_id: ps.supplier_id,
        cost_price: String(ps.cost_price),
        stock_qty: "",
      }));
    }
    return [];
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      sku: product?.sku ?? "",
      barcode: product?.barcode ?? "",
      category_id: product?.category_id ?? "",
      unit: product?.unit ?? "each",
      selling_price: String(product?.selling_price ?? "0"),
      description: product?.description ?? "",
      is_active: product?.is_active ?? true,
      serial_required: product?.serial_required ?? false,
      warranty_days: product?.warranty_days ?? null,
      suppliers: buildDefaultSuppliers(),
      opening_stock_branch_id: defaultBranchId ?? "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "suppliers" });
  const watchedSuppliers = watch("suppliers") ?? [];

  React.useEffect(() => {
    if (open) {
      reset({
        name: product?.name ?? "",
        sku: product?.sku ?? "",
        barcode: product?.barcode ?? "",
        category_id: product?.category_id ?? "",
        unit: product?.unit ?? "each",
        selling_price: String(product?.selling_price ?? "0"),
        description: product?.description ?? "",
        is_active: product?.is_active ?? true,
        serial_required: product?.serial_required ?? false,
        warranty_days: product?.warranty_days ?? null,
        suppliers: buildDefaultSuppliers(),
        opening_stock_branch_id: defaultBranchId ?? "",
      });
      setImageUrl(product?.image_url ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isActive = watch("is_active");
  const openingBranchId = watch("opening_stock_branch_id");
  const hasAnyStock = !isEdit && watchedSuppliers.some((s) => parseFloat(s.stock_qty ?? "") > 0);

  function getUsedSupplierIds(excludeIndex: number) {
    return watchedSuppliers
      .filter((_, i) => i !== excludeIndex)
      .map((s) => s.supplier_id)
      .filter(Boolean);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const url = await uploadProductImage(fd);
      setImageUrl(url);
      toast.success("Image uploaded");
    } catch (err) {
      handleError(err, 'upload product image');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function onSubmit(values: ProductFormValues) {
    const supplierRows = (values.suppliers ?? [])
      .filter((s) => s.supplier_id)
      .map((s) => ({
        supplier_id: s.supplier_id,
        cost_price: parseFloat(s.cost_price) || 0,
        stock_qty: parseFloat(s.stock_qty ?? "") > 0
          ? parseFloat(s.stock_qty ?? "")
          : undefined,
      }));

    const minCost = supplierRows.length > 0
      ? Math.min(...supplierRows.map((s) => s.cost_price))
      : 0;

    onSave?.({
      name: values.name,
      sku: values.sku,
      barcode: values.barcode || undefined,
      category_id: values.category_id || undefined,
      unit: values.unit,
      cost_price: minCost,
      selling_price: parseFloat(values.selling_price),
      description: values.description || undefined,
      is_active: values.is_active,
      serial_required: values.serial_required,
      warranty_days: values.warranty_days ?? null,
      image_url: imageUrl ?? undefined,
      suppliers: supplierRows,
      opening_stock_branch_id: values.opening_stock_branch_id || undefined,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && (
        <DialogTrigger render={trigger as React.ReactElement} />
      )}
      <DialogContent className="sm:max-w-2xl p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border pr-14">
          <DialogTitle>{isEdit ? "Edit Product" : "Add Product"}</DialogTitle>
          <DialogDescription className="mt-0.5">
            {isEdit ? "Update product details" : "Add a new product to your inventory"}
          </DialogDescription>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
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
                  <Input id="barcode" placeholder="Optional" {...register("barcode")} />
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

              {/* Selling Price */}
              <div className="space-y-1.5">
                <Label htmlFor="selling_price">
                  Selling Price <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {currencySymbol}
                  </span>
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

              {/* Suppliers section */}
              {suppliers.length > 0 && (
                <div className="space-y-3 rounded-lg border border-border px-3 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">Suppliers</p>
                      <p className="text-xs text-muted-foreground">
                        Each supplier can have a different cost price
                        {!isEdit && " and opening stock"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ supplier_id: "", cost_price: "0", stock_qty: "" })}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add
                    </Button>
                  </div>

                  {/* Column headers */}
                  {fields.length > 0 && (
                    <div className={`grid gap-2 text-xs font-medium text-muted-foreground ${!isEdit ? "grid-cols-[1fr_90px_60px_20px]" : "grid-cols-[1fr_90px_20px]"}`}>
                      <span>Supplier</span>
                      <span>Cost ({currencySymbol})</span>
                      {!isEdit && <span>Qty</span>}
                      <span />
                    </div>
                  )}

                  {/* Supplier rows */}
                  <div className="space-y-2">
                    {fields.map((field, index) => {
                      const usedIds = getUsedSupplierIds(index);
                      const currentVal = watchedSuppliers[index];
                      return (
                        <div
                          key={field.id}
                          className={`grid gap-2 items-center ${!isEdit ? "grid-cols-[1fr_90px_60px_20px]" : "grid-cols-[1fr_90px_20px]"}`}
                        >
                          {/* Supplier select */}
                          <Select
                            value={currentVal?.supplier_id ?? ""}
                            onValueChange={(val) => {
                              if (val !== null) setValue(`suppliers.${index}.supplier_id`, val);
                            }}
                          >
                            <SelectTrigger className="w-full h-8 text-xs" aria-invalid={!!errors.suppliers?.[index]?.supplier_id}>
                              <SelectValue placeholder="Select…">
                                {suppliers.find((s) => s.id === currentVal?.supplier_id)?.name ?? "Select…"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {suppliers
                                .filter((s) => !usedIds.includes(s.id))
                                .map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>

                          {/* Cost price */}
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            className="h-8 text-xs"
                            aria-invalid={!!errors.suppliers?.[index]?.cost_price}
                            {...register(`suppliers.${index}.cost_price`)}
                          />

                          {/* Stock qty (add mode only) */}
                          {!isEdit && (
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="0"
                              className="h-8 text-xs"
                              {...register(`suppliers.${index}.stock_qty`)}
                            />
                          )}

                          {/* Remove */}
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Remove supplier"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {fields.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-1">
                      No suppliers added — click Add to link a supplier
                    </p>
                  )}

                  {/* Shared branch selector for opening stock (add mode only) */}
                  {!isEdit && hasAnyStock && branches.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-border">
                      <Label className="text-xs font-medium">Opening stock branch</Label>
                      <Select
                        value={openingBranchId ?? ""}
                        onValueChange={(val) => {
                          if (val !== null) setValue("opening_stock_branch_id", val);
                        }}
                      >
                        <SelectTrigger className="w-full">
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
                  )}
                </div>
              )}

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

              {/* Product Image */}
              <div className="space-y-1.5">
                <Label>Product Image</Label>
                <div className="flex items-center gap-3">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Product"
                      className="h-16 w-16 rounded-lg object-cover border border-border"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg border border-dashed border-border bg-muted flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? "Uploading…" : imageUrl ? "Change Image" : "Upload Image"}
                    </Button>
                    {imageUrl && (
                      <button
                        type="button"
                        className="text-xs text-destructive text-left"
                        onClick={() => setImageUrl(null)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Optional. Max 5 MB.</p>
              </div>

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

              {/* Serial Required Toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Serial Required</Label>
                  <p className="text-[0.8rem] text-muted-foreground">
                    Require serial number entry at point of sale
                  </p>
                </div>
                <Switch
                  checked={watch("serial_required")}
                  onCheckedChange={(checked) => setValue("serial_required", checked)}
                />
              </div>

              {/* Warranty */}
              <div className="space-y-1.5">
                <Label htmlFor="warranty_days">Warranty (days)</Label>
                <Input
                  id="warranty_days"
                  type="number"
                  min={0}
                  step={1}
                  placeholder="e.g. 365 — leave blank if none"
                  value={watch("warranty_days") ?? ""}
                  onChange={(e) =>
                    setValue(
                      "warranty_days",
                      e.target.value === "" ? null : parseInt(e.target.value, 10)
                    )
                  }
                />
                {errors.warranty_days && (
                  <p className="text-xs text-destructive">{errors.warranty_days.message as string}</p>
                )}
              </div>
            </div>

            {/* Footer */}
          <div className="border-t border-border bg-muted/40 px-6 py-4 flex items-center justify-end gap-2">
            <Button type="submit">
              {isEdit ? "Save Changes" : "Add Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client"

import * as React from "react"
import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, ToggleLeft, Package, Search, X, Minus } from "lucide-react"
import { toast } from "sonner"
import { handleError } from "@/lib/utils/error-handler"
import { z } from "zod/v4"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useCurrency } from "@/lib/context/currency"
import { createBundle, updateBundle, toggleBundleActive } from "@/lib/actions/bundles"
import type { BundleWithItems } from "@/lib/actions/bundles"

const bundleSchema = z.object({
  name: z.string().min(1, "Name required"),
  price: z.number({ message: "Enter a valid price" }).positive("Price must be > 0"),
  items: z
    .array(
      z.object({
        product_id: z.string().min(1),
        product_name: z.string(),
        quantity: z.number().positive(),
      })
    )
    .min(1, "Add at least one item"),
})
type BundleFormValues = z.infer<typeof bundleSchema>

interface BundlesClientProps {
  initialBundles: BundleWithItems[]
  products: Array<{ id: string; name: string; sku: string }>
}

export function BundlesClient({ initialBundles, products }: BundlesClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { formatCurrency } = useCurrency()

  const [search, setSearch] = React.useState("")
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editingBundle, setEditingBundle] = React.useState<BundleWithItems | null>(null)
  const [productSearch, setProductSearch] = React.useState("")
  const [productDropdownOpen, setProductDropdownOpen] = React.useState(false)

  const filteredBundles = React.useMemo(() => {
    if (!search.trim()) return initialBundles
    const q = search.toLowerCase()
    return initialBundles.filter((b) => b.name.toLowerCase().includes(q))
  }, [search, initialBundles])

  const filteredProducts = React.useMemo(() => {
    if (!productSearch.trim()) return []
    const q = productSearch.toLowerCase()
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 8)
  }, [productSearch, products])

  const { register, control, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<BundleFormValues>({
      resolver: zodResolver(bundleSchema),
      defaultValues: { name: "", price: 0, items: [] },
    })
  const { fields, append, remove } = useFieldArray({ control, name: "items" })
  const watchedItems = watch("items")

  function openCreate() {
    setEditingBundle(null)
    reset({ name: "", price: 0, items: [] })
    setSheetOpen(true)
  }

  function openEdit(bundle: BundleWithItems) {
    setEditingBundle(bundle)
    reset({
      name: bundle.name,
      price: bundle.price,
      items: bundle.items.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: i.quantity,
      })),
    })
    setSheetOpen(true)
  }

  function handleAddProduct(product: { id: string; name: string; sku: string }) {
    const existing = watchedItems.find((i) => i.product_id === product.id)
    if (existing) {
      toast.info(`${product.name} is already in this bundle`)
    } else {
      append({ product_id: product.id, product_name: product.name, quantity: 1 })
    }
    setProductSearch("")
    setProductDropdownOpen(false)
  }

  function onSubmit(values: BundleFormValues) {
    startTransition(async () => {
      try {
        if (editingBundle) {
          await updateBundle(editingBundle.id, {
            name: values.name,
            price: values.price,
            items: values.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          })
          toast.success("Bundle updated")
        } else {
          await createBundle({
            name: values.name,
            price: values.price,
            items: values.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
          })
          toast.success("Bundle created")
        }
        setSheetOpen(false)
        router.refresh()
      } catch (err) {
        handleError(err, 'save bundle')
      }
    })
  }

  function handleToggleActive(bundle: BundleWithItems) {
    startTransition(async () => {
      try {
        await toggleBundleActive(bundle.id, !bundle.is_active)
        toast.success(bundle.is_active ? "Bundle deactivated" : "Bundle activated")
        router.refresh()
      } catch (err) {
        handleError(err, 'toggle bundle active')
      }
    })
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Bundles</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create product bundles sold at a fixed price
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Bundle
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search bundles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bundle</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-center">Items</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBundles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
                  No bundles yet. Click &quot;New Bundle&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              filteredBundles.map((bundle) => (
                <TableRow key={bundle.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
                        {bundle.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={bundle.image_url}
                            alt={bundle.name}
                            className="h-full w-full rounded-md object-cover"
                          />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{bundle.name}</p>
                        {bundle.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[240px]">
                            {bundle.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatCurrency(bundle.price)}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {bundle.items.length} item{bundle.items.length !== 1 ? "s" : ""}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      className={
                        bundle.is_active
                          ? "border-transparent bg-green-500/15 text-green-600 dark:bg-green-400/15 dark:text-green-400"
                          : "border-transparent bg-muted text-muted-foreground"
                      }
                    >
                      {bundle.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-xs" onClick={() => openEdit(bundle)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleToggleActive(bundle)}
                      >
                        <ToggleLeft className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 max-h-[90vh] flex flex-col overflow-hidden">
          <div className="px-6 pt-6 pb-4 border-b border-border pr-14">
            <DialogTitle>{editingBundle ? "Edit Bundle" : "New Bundle"}</DialogTitle>
            <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
              {editingBundle
                ? "Update bundle details and component products."
                : "Create a new bundle with a fixed price and component products."}
            </DialogDescription>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 px-6 py-4 space-y-4 overflow-y-auto">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" {...register("name")} placeholder="e.g. Paint Starter Kit" />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* Product picker */}
              <div className="space-y-2">
                <Label>Components *</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search and add products…"
                    value={productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value)
                      setProductDropdownOpen(e.target.value.length > 0)
                    }}
                    onFocus={() => productSearch.length > 0 && setProductDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setProductDropdownOpen(false), 150)}
                    className="pl-9"
                  />
                  {productDropdownOpen && filteredProducts.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                      {filteredProducts.map((p) => (
                        <div
                          key={p.id}
                          onMouseDown={() => handleAddProduct(p)}
                          className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-accent"
                        >
                          <span className="flex-1 text-sm">{p.name}</span>
                          <span className="font-mono text-xs text-muted-foreground">{p.sku}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {errors.items && (
                  <p className="text-xs text-destructive">{errors.items.message as string}</p>
                )}

                {/* Items list */}
                {fields.length > 0 && (
                  <div className="rounded-lg border border-border divide-y divide-border">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex items-center gap-2 px-3 py-2">
                        <span className="flex-1 text-sm truncate">{field.product_name}</span>
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            onClick={() => {
                              const current = watchedItems[index]?.quantity ?? 1
                              if (current <= 1) return
                              setValue(`items.${index}.quantity`, current - 1)
                            }}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                            className="h-6 w-12 text-center text-xs px-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            onClick={() => {
                              const current = watchedItems[index]?.quantity ?? 1
                              setValue(`items.${index}.quantity`, current + 1)
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => remove(index)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="price">Bundle Price *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("price", { valueAsNumber: true })}
                  placeholder="0.00"
                />
                {errors.price && (
                  <p className="text-xs text-destructive">{errors.price.message}</p>
                )}
              </div>
            </div>

            <div className="border-t border-border bg-muted/40 px-6 py-4 flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : editingBundle ? "Save Changes" : "Create Bundle"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

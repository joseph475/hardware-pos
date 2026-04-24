"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createBranchStockRequest } from "@/lib/actions/branch-requests"

const schema = z.object({
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Select a product"),
        quantity: z.coerce.number().min(0.001, "Quantity required"),
      })
    )
    .min(1, "Add at least one item"),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Array<{ id: string; name: string; sku: string }>
}

export function NewRequestSheet({ open, onOpenChange, products }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { notes: "", items: [{ productId: "", quantity: 1 }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })

  function onSubmit(data: FormValues) {
    startTransition(async () => {
      try {
        await createBranchStockRequest({
          notes: data.notes ?? "",
          items: data.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        })
        toast.success("Stock request submitted")
        reset()
        onOpenChange(false)
        router.refresh()
      } catch (err) {
        toast.error("Failed to create request", {
          description: err instanceof Error ? err.message : "Unknown error",
        })
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New Stock Request</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 py-4"
        >
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              {...register("notes")}
              placeholder="Reason for request..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ productId: "", quantity: 1 })}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
              </Button>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Select
                    value={watch(`items.${index}.productId`)}
                    onValueChange={(val) =>
                      setValue(`items.${index}.productId`, val)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product">
                        {products.find(
                          (p) => p.id === watch(`items.${index}.productId`)
                        )?.name ?? "Select product"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}{" "}
                          <span className="text-muted-foreground text-xs ml-1">
                            {p.sku}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  min={0.001}
                  step="0.001"
                  className="w-24"
                  {...register(`items.${index}.quantity`)}
                  placeholder="Qty"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {errors.items && (
              <p className="text-xs text-destructive">{errors.items.message}</p>
            )}
          </div>

          <SheetFooter>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Submitting…" : "Submit Request"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

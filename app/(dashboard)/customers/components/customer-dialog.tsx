'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import type { Customer } from '@/types/database'

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  company_name: z.string().optional(),
  tax_id: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean(),
})

export type CustomerFormValues = z.infer<typeof customerSchema>

interface CustomerDialogProps {
  customer?: Customer | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (values: CustomerFormValues) => void
  isPending?: boolean
}

export function CustomerDialog({
  customer,
  open,
  onOpenChange,
  onSave,
  isPending,
}: CustomerDialogProps) {
  const isEdit = !!customer

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer?.name ?? '',
      email: customer?.email ?? '',
      phone: customer?.phone ?? '',
      address: customer?.address ?? '',
      company_name: customer?.company_name ?? '',
      tax_id: customer?.tax_id ?? '',
      notes: customer?.notes ?? '',
      is_active: customer?.is_active ?? true,
    },
  })

  React.useEffect(() => {
    if (open) {
      reset({
        name: customer?.name ?? '',
        email: customer?.email ?? '',
        phone: customer?.phone ?? '',
        address: customer?.address ?? '',
        company_name: customer?.company_name ?? '',
        tax_id: customer?.tax_id ?? '',
        notes: customer?.notes ?? '',
        is_active: customer?.is_active ?? true,
      })
    }
  }, [open, customer, reset])

  const isActive = watch('is_active')

  function onSubmit(values: CustomerFormValues) {
    onSave(values)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">
              {isEdit ? 'Edit Customer' : 'Add Customer'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isEdit ? 'Update customer details' : 'Add a new customer to your records'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1">
            <div className="flex-1 px-6 py-4 space-y-4 overflow-y-auto">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="c-name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="c-name"
                  placeholder="Customer name"
                  aria-invalid={!!errors.name}
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="c-email">Email</Label>
                  <Input
                    id="c-email"
                    type="email"
                    placeholder="email@example.com"
                    aria-invalid={!!errors.email}
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">{errors.email.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-phone">Phone</Label>
                  <Input id="c-phone" placeholder="+1 555-0000" {...register('phone')} />
                </div>
              </div>

              {/* Company Name + Tax ID */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="c-company">Company Name</Label>
                  <Input id="c-company" placeholder="Company Ltd." {...register('company_name')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-tax-id">Tax ID</Label>
                  <Input id="c-tax-id" placeholder="TAX-00000" {...register('tax_id')} />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <Label htmlFor="c-address">Address</Label>
                <Textarea
                  id="c-address"
                  placeholder="Street, City, Country"
                  rows={2}
                  {...register('address')}
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="c-notes">Notes</Label>
                <Textarea
                  id="c-notes"
                  placeholder="Optional notes about this customer"
                  rows={3}
                  {...register('notes')}
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-foreground">Active</p>
                  <p className="text-xs text-muted-foreground">Customer is available for transactions</p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={(checked) => setValue('is_active', checked)}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border bg-muted/40 px-6 py-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Customer'}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}

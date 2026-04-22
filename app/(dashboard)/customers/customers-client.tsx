'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  Search,
  PowerOff,
  Power,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { deleteCustomer, toggleCustomerActive, upsertCustomer } from '@/lib/actions/customers'
import type { Customer } from '@/types/database'
import { CustomerDialog } from './components/customer-dialog'
import type { CustomerFormValues } from './components/customer-dialog'

type StatusFilter = 'all' | 'active' | 'inactive'

interface CustomersClientProps {
  initialCustomers: Customer[]
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function CustomersClient({ initialCustomers }: CustomersClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingCustomer, setEditingCustomer] = React.useState<Customer | null>(null)

  function openAdd() {
    setEditingCustomer(null)
    setDialogOpen(true)
  }

  function openEdit(customer: Customer) {
    setEditingCustomer(customer)
    setDialogOpen(true)
  }

  function handleSave(values: CustomerFormValues) {
    startTransition(async () => {
      try {
        await upsertCustomer({ id: editingCustomer?.id, ...values })
        setDialogOpen(false)
        router.refresh()
        toast.success(editingCustomer ? 'Customer updated' : 'Customer added')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save customer')
      }
    })
  }

  function handleToggleActive(customer: Customer) {
    startTransition(async () => {
      try {
        await toggleCustomerActive(customer.id, !customer.is_active)
        router.refresh()
        toast.success(customer.is_active ? 'Customer deactivated' : 'Customer activated')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update customer')
      }
    })
  }

  function handleDelete(customer: Customer) {
    startTransition(async () => {
      try {
        await deleteCustomer(customer.id)
        router.refresh()
        toast.success('Customer deleted')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete customer')
      }
    })
  }

  const filtered = initialCustomers.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.company_name ?? '').toLowerCase().includes(search.toLowerCase())

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && c.is_active) ||
      (statusFilter === 'inactive' && !c.is_active)

    return matchesSearch && matchesStatus
  })

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage your customer records
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add Customer
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, email, or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(['all', 'active', 'inactive'] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">
                {initialCustomers.length === 0 ? 'No customers yet' : 'No customers match your search'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {initialCustomers.length === 0
                  ? 'Add your first customer to get started.'
                  : 'Try adjusting your search or filter.'}
              </p>
              {initialCustomers.length === 0 && (
                <Button className="mt-4" size="sm" onClick={openAdd}>
                  <Plus className="h-4 w-4" />
                  Add Customer
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="pl-4 w-8" />
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((customer) => (
                  <TableRow key={customer.id} className="border-b border-border/50">
                    {/* Avatar */}
                    <TableCell className="pl-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {getInitials(customer.name)}
                      </div>
                    </TableCell>

                    {/* Name + Company */}
                    <TableCell>
                      <p className="font-medium text-foreground">{customer.name}</p>
                      {customer.company_name && (
                        <p className="text-xs text-muted-foreground">{customer.company_name}</p>
                      )}
                    </TableCell>

                    {/* Email */}
                    <TableCell className="text-sm text-muted-foreground">
                      {customer.email ?? '—'}
                    </TableCell>

                    {/* Phone */}
                    <TableCell className="text-sm text-muted-foreground font-mono">
                      {customer.phone ?? '—'}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge variant={customer.is_active ? 'default' : 'outline'}>
                        {customer.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(customer)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleToggleActive(customer)}>
                            {customer.is_active ? (
                              <>
                                <PowerOff className="h-4 w-4" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Power className="h-4 w-4" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDelete(customer)}
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

      <CustomerDialog
        customer={editingCustomer}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        isPending={isPending}
      />
    </div>
  )
}

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Plus, Search, Send, CheckCircle, XCircle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrency } from '@/lib/context/currency'
import {
  createQuotation,
  updateQuotation,
  deleteQuotation,
  updateQuotationStatus,
  approveQuotation,
} from '@/lib/actions/quotations'
import type { QuotationWithRelations } from '@/lib/actions/quotations'
import type { QuotationStatus } from '@/types/database'
import { QuotationDialog, type QuotationFormValues } from './components/quotation-dialog'
import { QuotationDetailSheet } from './components/quotation-detail-sheet'
import { CustomerSelectDialog } from '@/components/pos/customer-select-dialog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type StatusFilter = QuotationStatus | 'all'

interface Props {
  initialQuotations: QuotationWithRelations[]
  customers: Array<{ id: string; name: string; company_name: string | null }>
  branches: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string; sku: string; selling_price: number; serial_required: boolean; image_url: string | null }>
  userRole: 'owner' | 'manager' | 'cashier'
  userBranchId: string | null
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------
const STATUS_CONFIG: Record<
  QuotationStatus,
  { label: string; className: string }
> = {
  draft:     { label: 'Draft',     className: 'bg-muted text-muted-foreground border-transparent' },
  sent:      { label: 'Sent',      className: 'bg-blue-500/15 text-blue-500 border-transparent' },
  accepted:  { label: 'Accepted',  className: 'bg-green-500/15 text-green-600 border-transparent' },
  rejected:  { label: 'Rejected',  className: 'bg-red-500/15 text-red-500 border-transparent' },
  expired:   { label: 'Expired',   className: 'bg-orange-500/15 text-orange-500 border-transparent' },
  converted: { label: 'Converted', className: 'bg-emerald-500/15 text-emerald-500 border-transparent' },
}

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all',       label: 'All' },
  { value: 'draft',     label: 'Draft' },
  { value: 'sent',      label: 'Sent' },
  { value: 'accepted',  label: 'Accepted' },
  { value: 'converted', label: 'Converted' },
  { value: 'rejected',  label: 'Rejected' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function QuotationsClient({
  initialQuotations,
  customers,
  branches,
  products,
  userRole,
  userBranchId,
}: Props) {
  const router = useRouter()
  const { formatCurrency } = useCurrency()

  const [quotations, setQuotations] = React.useState(initialQuotations)
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [search, setSearch] = React.useState('')
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingQuotation, setEditingQuotation] = React.useState<QuotationWithRelations | null>(null)
  const [isPending, setIsPending] = React.useState(false)
  const [detailSheetOpen, setDetailSheetOpen] = React.useState(false)
  const [viewingQuotation, setViewingQuotation] = React.useState<QuotationWithRelations | null>(null)
  const [customerStepOpen, setCustomerStepOpen] = React.useState(false)
  const [pendingCustomer, setPendingCustomer] = React.useState<{ id: string | null; name: string | null }>({ id: null, name: null })

  // Sync when server re-renders
  React.useEffect(() => {
    setQuotations(initialQuotations)
  }, [initialQuotations])

  // ---------------------------------------------------------------------------
  // Filter
  // ---------------------------------------------------------------------------
  const filtered = quotations.filter((q) => {
    const matchStatus = statusFilter === 'all' || q.status === statusFilter
    const customerName = q.customers?.name?.toLowerCase() ?? ''
    const matchSearch = !search || customerName.includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  async function handleSave(values: QuotationFormValues) {
    setIsPending(true)
    try {
      if (editingQuotation) {
        await updateQuotation(editingQuotation.id, {
          customer_id: values.customer_id,
          branch_id: values.branch_id,
          valid_until: values.valid_until,
          notes: values.notes,
          discount_amount: values.discount_amount,
          items: values.items,
        })
        toast.success('Quotation updated')
      } else {
        await createQuotation({
          customer_id: values.customer_id,
          branch_id: values.branch_id,
          valid_until: values.valid_until,
          notes: values.notes,
          discount_amount: values.discount_amount,
          items: values.items,
        })
        toast.success('Quotation created')
      }
      setDialogOpen(false)
      setEditingQuotation(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save quotation')
    } finally {
      setIsPending(false)
    }
  }

  async function handleMarkSent(id: string) {
    try {
      await updateQuotationStatus(id, 'sent')
      toast.success('Quotation marked as sent')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  async function handleApprove(id: string) {
    try {
      await approveQuotation(id)
      toast.success('Quotation approved — sale recorded')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve quotation')
    }
  }

  async function handleReject(id: string) {
    try {
      await updateQuotationStatus(id, 'rejected')
      toast.success('Quotation rejected')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteQuotation(id)
      toast.success('Quotation deleted')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete quotation')
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Quotations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create and manage price quotes for customers
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingQuotation(null)
            setPendingCustomer({ id: null, name: null })
            setCustomerStepOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          New Quotation
        </Button>
      </div>

      {/* Status tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {quotations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-sm">No quotations yet. Create one to get started.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <p className="text-sm">No quotations match your filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="pl-4">Quote ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-10 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q) => {
                  const { label, className } = STATUS_CONFIG[q.status]
                  const canEdit = q.status === 'draft'
                  const canMarkSent = q.status === 'draft'
                  const canApprove = q.status !== 'converted' && q.status !== 'rejected'
                  const canReject =
                    q.status === 'draft' || q.status === 'sent' || q.status === 'accepted'
                  const canDelete = q.status === 'draft'

                  return (
                    <TableRow
                      key={q.id}
                      className="border-b border-border/50 cursor-pointer"
                      onClick={() => {
                        if (q.status === 'draft') {
                          setEditingQuotation(q)
                          setDialogOpen(true)
                        } else {
                          setViewingQuotation(q)
                          setDetailSheetOpen(true)
                        }
                      }}
                    >
                      <TableCell className="pl-4">
                        <span className="font-mono text-xs font-medium text-foreground">
                          {q.id.slice(0, 8).toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {q.customers?.name ?? '—'}
                        {q.customers?.company_name && (
                          <span className="text-muted-foreground text-xs ml-1">
                            ({q.customers.company_name})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {q.branches?.name ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={className}>{label}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {q.valid_until ? q.valid_until.slice(0, 10) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium text-foreground">
                        {formatCurrency(q.total)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {q.creator?.full_name ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {q.created_at.slice(0, 10)}
                      </TableCell>
                      <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon-sm" aria-label="Actions" />
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canEdit && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingQuotation(q)
                                  setDialogOpen(true)
                                }}
                              >
                                Edit
                              </DropdownMenuItem>
                            )}
                            {!canEdit && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setViewingQuotation(q)
                                  setDetailSheetOpen(true)
                                }}
                              >
                                View Details
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {canMarkSent && (
                              <DropdownMenuItem onClick={() => handleMarkSent(q.id)}>
                                <Send className="h-4 w-4" />
                                Mark as Sent
                              </DropdownMenuItem>
                            )}
                            {canApprove && (
                              <DropdownMenuItem onClick={() => handleApprove(q.id)}>
                                <CheckCircle className="h-4 w-4" />
                                Approve
                              </DropdownMenuItem>
                            )}
                            {canReject && (
                              <DropdownMenuItem onClick={() => handleReject(q.id)}>
                                <XCircle className="h-4 w-4" />
                                Reject
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => handleDelete(q.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-right">
        Showing {filtered.length} of {quotations.length} quotations
      </p>

      {/* Customer step (new quotation only) */}
      <CustomerSelectDialog
        open={customerStepOpen}
        onOpenChange={setCustomerStepOpen}
        customers={customers.map((c) => ({ ...c, email: null, phone: null, is_active: true }))}
        onConfirm={(id, name) => {
          setPendingCustomer({ id, name })
          setCustomerStepOpen(false)
          setDialogOpen(true)
        }}
      />

      {/* Quotation Dialog */}
      <QuotationDialog
        quotation={editingQuotation}
        customers={customers}
        branches={branches}
        products={products}
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingQuotation(null)
        }}
        onSave={handleSave}
        isPending={isPending}
        preselectedCustomer={!editingQuotation ? pendingCustomer : null}
        userRole={userRole}
        userBranchId={userBranchId}
      />

      {/* Quotation Detail Sheet (non-draft) */}
      <QuotationDetailSheet
        quotation={viewingQuotation}
        productMeta={products.map((p) => ({
          id: p.id,
          image_url: p.image_url,
          serial_required: p.serial_required,
        }))}
        open={detailSheetOpen}
        onOpenChange={(open) => {
          setDetailSheetOpen(open)
          if (!open) setViewingQuotation(null)
        }}
        onMarkSent={async (id) => {
          await handleMarkSent(id)
          setDetailSheetOpen(false)
          setViewingQuotation(null)
        }}
        onApprove={async (id) => {
          await handleApprove(id)
          setDetailSheetOpen(false)
          setViewingQuotation(null)
        }}
        onReject={async (id) => {
          await handleReject(id)
          setDetailSheetOpen(false)
          setViewingQuotation(null)
        }}
      />
    </div>
  )
}

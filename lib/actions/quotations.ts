'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { Database } from '@/types/database'
import type { Quotation, QuotationItem, QuotationStatus } from '@/types/database'
import { CACHE_TAGS } from '@/lib/cache-tags'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ORG_ID = '00000000-0000-0000-0000-000000000001'

export type QuotationWithRelations = Quotation & {
  customers: { name: string; email: string | null; company_name: string | null } | null
  branches: { name: string } | null
  creator: { full_name: string } | null
  quotation_items: QuotationItem[]
}

async function getProfile() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, branch_id, role')
    .eq('clerk_user_id', userId)
    .single()

  if (error || !profile) throw new Error('Profile not found')
  return profile as { id: string; branch_id: string | null; role: string }
}

function revalidateAll() {
  revalidateTag(CACHE_TAGS.QUOTATIONS, {})
  revalidatePath('/quotations')
}

// ---------------------------------------------------------------------------
// getQuotations
// ---------------------------------------------------------------------------
export async function getQuotations(filters?: {
  status?: QuotationStatus | 'all'
  branchId?: string
}): Promise<QuotationWithRelations[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const supabase = getAdminClient()

  let query = supabase
    .from('quotations')
    .select(`
      *,
      customers(name, email, company_name),
      branches(name),
      creator:profiles!created_by(full_name),
      quotation_items(*)
    `)
    .eq('org_id', ORG_ID)
    .order('created_at', { ascending: false })

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }
  if (filters?.branchId) {
    query = query.eq('branch_id', filters.branchId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as QuotationWithRelations[]
}

// ---------------------------------------------------------------------------
// getQuotationById
// ---------------------------------------------------------------------------
export async function getQuotationById(id: string): Promise<QuotationWithRelations | null> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('quotations')
    .select(`
      *,
      customers(name, email, company_name),
      branches(name),
      creator:profiles!created_by(full_name),
      quotation_items(*)
    `)
    .eq('org_id', ORG_ID)
    .eq('id', id)
    .single()

  if (error) return null
  return data as unknown as QuotationWithRelations
}

// ---------------------------------------------------------------------------
// createQuotation
// ---------------------------------------------------------------------------
export async function createQuotation(params: {
  customer_id: string
  branch_id: string
  valid_until?: string
  notes?: string
  discount_amount?: number
  tax_rate?: number
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    discount_amount?: number
  }>
}): Promise<{ id: string }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()
  if (profileError || !profile) throw new Error('Profile not found')

  // Compute totals
  const itemsWithTotals = params.items.map((item) => ({
    ...item,
    total: item.quantity * item.unit_price - (item.discount_amount ?? 0),
  }))
  const subtotal = itemsWithTotals.reduce((s, i) => s + i.total, 0)
  const taxAmount = subtotal * (params.tax_rate ?? 0)
  const grandTotal = subtotal - (params.discount_amount ?? 0) + taxAmount

  const { data: quotation, error: qError } = await supabase
    .from('quotations')
    .insert({
      org_id: ORG_ID,
      customer_id: params.customer_id,
      branch_id: params.branch_id,
      created_by: profile.id,
      status: 'draft',
      valid_until: params.valid_until || null,
      notes: params.notes ?? null,
      subtotal,
      discount_amount: params.discount_amount ?? 0,
      tax_amount: taxAmount,
      total: grandTotal,
    })
    .select('id')
    .single()
  if (qError || !quotation) throw new Error(qError?.message ?? 'Failed to create quotation')

  const { error: itemsError } = await supabase.from('quotation_items').insert(
    itemsWithTotals.map((item) => ({
      quotation_id: quotation.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_amount: item.discount_amount ?? 0,
      total: item.total,
    }))
  )
  if (itemsError) throw new Error(itemsError.message)

  revalidateAll()
  return { id: quotation.id }
}

// ---------------------------------------------------------------------------
// updateQuotation
// ---------------------------------------------------------------------------
export async function updateQuotation(
  id: string,
  params: {
    customer_id?: string
    branch_id?: string
    valid_until?: string
    notes?: string
    discount_amount?: number
    tax_rate?: number
    items?: Array<{
      product_id: string
      product_name: string
      quantity: number
      unit_price: number
      discount_amount?: number
    }>
  }
): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  // Guard: must be draft
  const { data: existing } = await supabase
    .from('quotations')
    .select('status, subtotal, discount_amount, tax_amount, total')
    .eq('id', id)
    .single()
  if (!existing) throw new Error('Quotation not found')
  if (existing.status !== 'draft') throw new Error('Only draft quotations can be edited')

  let subtotal = existing.subtotal
  let taxAmount = existing.tax_amount
  let discountAmount = params.discount_amount ?? existing.discount_amount
  let grandTotal = existing.total

  if (params.items) {
    const itemsWithTotals = params.items.map((item) => ({
      ...item,
      total: item.quantity * item.unit_price - (item.discount_amount ?? 0),
    }))
    subtotal = itemsWithTotals.reduce((s, i) => s + i.total, 0)
    taxAmount = subtotal * (params.tax_rate ?? 0)
    grandTotal = subtotal - discountAmount + taxAmount

    // Replace items
    await supabase.from('quotation_items').delete().eq('quotation_id', id)
    const { error: itemsError } = await supabase.from('quotation_items').insert(
      itemsWithTotals.map((item) => ({
        quotation_id: id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount ?? 0,
        total: item.total,
      }))
    )
    if (itemsError) throw new Error(itemsError.message)
  }

  const updatePayload: Record<string, unknown> = {
    subtotal,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total: grandTotal,
    updated_at: new Date().toISOString(),
  }
  if (params.customer_id !== undefined) updatePayload.customer_id = params.customer_id
  if (params.branch_id !== undefined) updatePayload.branch_id = params.branch_id
  if (params.valid_until !== undefined) updatePayload.valid_until = params.valid_until || null
  if (params.notes !== undefined) updatePayload.notes = params.notes || null

  const { error } = await supabase
    .from('quotations')
    .update(updatePayload as any)
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidateAll()
}

// ---------------------------------------------------------------------------
// deleteQuotation
// ---------------------------------------------------------------------------
export async function deleteQuotation(id: string): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: existing } = await supabase
    .from('quotations')
    .select('status')
    .eq('id', id)
    .single()
  if (!existing) throw new Error('Quotation not found')
  if (existing.status !== 'draft') throw new Error('Only draft quotations can be deleted')

  await supabase.from('quotation_items').delete().eq('quotation_id', id)
  await supabase.from('quotations').delete().eq('id', id)

  revalidateAll()
}

// ---------------------------------------------------------------------------
// updateQuotationStatus
// ---------------------------------------------------------------------------
export async function updateQuotationStatus(
  id: string,
  status: 'sent' | 'rejected' | 'expired' | 'accepted'
): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { error } = await supabase
    .from('quotations')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)

  revalidateAll()
}

// ---------------------------------------------------------------------------
// approveQuotation — converts a quotation into a transaction
// ---------------------------------------------------------------------------
export async function approveQuotation(id: string): Promise<{ transaction_id: string }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  // Get profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, branch_id')
    .eq('clerk_user_id', userId)
    .single()
  if (profileError || !profile) throw new Error('Profile not found')

  // Fetch quotation with items
  const { data: quotationRaw, error: qError } = await supabase
    .from('quotations')
    .select('*, quotation_items(*)')
    .eq('id', id)
    .single()
  if (qError || !quotationRaw) throw new Error('Quotation not found')
  const quotation = quotationRaw as any

  // Guard: not already converted
  if (quotation.status === 'converted') {
    throw new Error('Quotation already converted')
  }

  // Stock validation
  const insufficientItems: string[] = []
  for (const item of quotation.quotation_items as any[]) {
    const { data: inv } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', item.product_id)
      .eq('branch_id', quotation.branch_id)
      .single()
    if (!inv || inv.quantity < item.quantity) {
      insufficientItems.push(item.product_name)
    }
  }
  if (insufficientItems.length > 0) {
    throw new Error(`Insufficient stock for: ${insufficientItems.join(', ')}`)
  }

  // Optimistic lock — update status to 'converted' before creating transaction
  const { data: lockResult, error: lockError } = await supabase
    .from('quotations')
    .update({ status: 'converted', updated_at: new Date().toISOString() })
    .eq('id', id)
    .neq('status', 'converted')
    .select('id')
  if (lockError) throw new Error(lockError.message)
  if (!lockResult || lockResult.length === 0) throw new Error('Quotation already processed')

  // Insert transaction
  const { data: tx, error: txError } = await supabase
    .from('transactions')
    .insert({
      branch_id: quotation.branch_id,
      cashier_id: profile.id,
      customer_id: quotation.customer_id,
      subtotal: quotation.subtotal,
      discount_amount: quotation.discount_amount,
      tax_amount: quotation.tax_amount,
      total: quotation.total,
      payment_method: 'cash',
      status: 'completed',
      notes: `Quotation #${id.slice(0, 8).toUpperCase()}`,
    })
    .select('id')
    .single()
  if (txError || !tx) throw new Error(txError?.message ?? 'Failed to create transaction')
  const transaction_id = tx.id

  // Insert transaction_items
  const txItems = (quotation.quotation_items as any[]).map((item: any) => ({
    transaction_id,
    product_id: item.product_id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_amount: item.discount_amount,
    total: item.total,
  }))
  const { error: txItemsError } = await supabase.from('transaction_items').insert(txItems)
  if (txItemsError) throw new Error(txItemsError.message)

  // Deduct inventory + log movements
  for (const item of quotation.quotation_items as any[]) {
    const { data: inv } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', item.product_id)
      .eq('branch_id', quotation.branch_id)
      .single()
    const currentQty = inv?.quantity ?? 0
    const newQty = Math.max(0, currentQty - item.quantity)

    await supabase
      .from('inventory')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('product_id', item.product_id)
      .eq('branch_id', quotation.branch_id)

    await supabase.from('inventory_movements').insert({
      product_id: item.product_id,
      branch_id: quotation.branch_id,
      type: 'sale',
      quantity: -item.quantity,
      reference_id: transaction_id,
      created_by: profile.id,
      notes: `Quotation approval: ${id.slice(0, 8).toUpperCase()}`,
    })
  }

  // Link transaction back to quotation
  await supabase.from('quotations').update({ transaction_id }).eq('id', id)

  // Revalidate
  revalidateTag(CACHE_TAGS.INVENTORY, {})
  revalidateTag(CACHE_TAGS.QUOTATIONS, {})
  revalidatePath('/quotations')
  revalidatePath('/inventory/stock')
  revalidatePath('/reports/transactions')

  return { transaction_id }
}

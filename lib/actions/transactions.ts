'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { Database } from '@/types/database'
import { CACHE_TAGS } from '@/lib/cache-tags'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface TxItem {
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  discount_amount: number
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
  if (!profile.branch_id) throw new Error('No branch assigned to your account')

  return profile as { id: string; branch_id: string; role: string }
}

export async function createTransaction(params: {
  items: TxItem[]
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  payment_method: 'cash' | 'card' | 'split' | 'gcash' | 'maya'
  notes?: string
}): Promise<{ id: string }> {
  const profile = await getProfile()
  const supabase = getAdminClient()

  // Pre-checkout stock validation
  const productIds = params.items.map((i) => i.product_id)
  const { data: inventoryRows } = await supabase
    .from('inventory')
    .select('product_id, quantity')
    .in('product_id', productIds)
    .eq('branch_id', profile.branch_id)

  const insufficientItems: string[] = []
  for (const item of params.items) {
    const inv = inventoryRows?.find((r) => r.product_id === item.product_id)
    if (!inv || inv.quantity < item.quantity) {
      insufficientItems.push(item.product_name)
    }
  }
  if (insufficientItems.length > 0) {
    throw new Error(`Insufficient stock for: ${insufficientItems.join(', ')}`)
  }

  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      branch_id: profile.branch_id,
      cashier_id: profile.id,
      subtotal: params.subtotal,
      discount_amount: params.discount_amount,
      tax_amount: params.tax_amount,
      total: params.total,
      payment_method: params.payment_method,
      status: 'completed',
      notes: params.notes ?? null,
    })
    .select('id')
    .single()

  if (txError || !transaction) throw new Error(txError?.message ?? 'Failed to create transaction')

  const { error: itemsError } = await supabase.from('transaction_items').insert(
    params.items.map((item) => ({
      transaction_id: transaction.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_amount: item.discount_amount,
      total: item.unit_price * item.quantity - item.discount_amount,
    }))
  )
  if (itemsError) throw new Error(itemsError.message)

  // Deduct inventory for each item
  for (const item of params.items) {
    const { data: inv } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', item.product_id)
      .eq('branch_id', profile.branch_id)
      .single()

    if (inv) {
      await supabase
        .from('inventory')
        .update({ quantity: Math.max(0, inv.quantity - item.quantity) })
        .eq('product_id', item.product_id)
        .eq('branch_id', profile.branch_id)
    }

    await supabase.from('inventory_movements').insert({
      product_id: item.product_id,
      branch_id: profile.branch_id,
      type: 'sale',
      quantity: -item.quantity,
      reference_id: transaction.id,
      notes: `Sale #${transaction.id.slice(0, 8)}`,
      created_by: profile.id,
    })
  }

  revalidateTag(CACHE_TAGS.INVENTORY, {})
  revalidateTag(CACHE_TAGS.INVENTORY_MOVEMENTS, {})
  revalidatePath('/inventory')
  revalidatePath('/inventory/adjustments')
  return { id: transaction.id }
}

export async function voidTransaction(id: string, reason: string, managerPin?: string): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile) throw new Error('Profile not found')

  const isCashier = profile.role === 'cashier'
  const isManager = ['manager', 'owner'].includes(profile.role)

  if (!isCashier && !isManager) throw new Error('Forbidden')

  if (isCashier) {
    if (!managerPin) throw new Error('Manager PIN required')
    const { verifyManagerOverridePin } = await import('./organization')
    const valid = await verifyManagerOverridePin(managerPin)
    if (!valid) throw new Error('Invalid manager PIN')
  }

  // Get the transaction
  const { data: tx } = await supabase
    .from('transactions')
    .select('id, branch_id, status')
    .eq('id', id)
    .single()

  if (!tx) throw new Error('Transaction not found')
  if (tx.status !== 'completed') throw new Error('Only completed transactions can be voided')

  // Get items before voiding
  const { data: txItems } = await supabase
    .from('transaction_items')
    .select('product_id, product_name, quantity')
    .eq('transaction_id', id)

  // Mark as voided
  const { error: updateError } = await supabase
    .from('transactions')
    .update({
      status: 'voided',
      void_reason: reason,
      voided_by: profile.id,
      voided_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'completed')

  if (updateError) throw new Error(updateError.message)

  // Restore inventory
  for (const item of txItems ?? []) {
    const { data: inv } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('product_id', item.product_id)
      .eq('branch_id', tx.branch_id)
      .single()

    if (inv) {
      await supabase
        .from('inventory')
        .update({ quantity: inv.quantity + item.quantity })
        .eq('product_id', item.product_id)
        .eq('branch_id', tx.branch_id)
    }

    await supabase.from('inventory_movements').insert({
      product_id: item.product_id,
      branch_id: tx.branch_id,
      type: 'adjustment',
      quantity: item.quantity,
      reference_id: id,
      notes: `Void of transaction #${id.slice(0, 8)}: ${reason}`,
      created_by: profile.id,
    })
  }

  revalidateTag(CACHE_TAGS.INVENTORY, {})
  revalidateTag(CACHE_TAGS.INVENTORY_MOVEMENTS, {})
  revalidatePath('/inventory')
  revalidatePath('/reports/transactions')
}

export type TransactionSummary = {
  id: string
  created_at: string
  branch_id: string
  branch_name: string
  branch_address: string | null
  branch_phone: string | null
  cashier_name: string
  item_count: number
  payment_method: string
  total: number
  discount_amount: number
  status: 'completed' | 'voided' | 'held'
  void_reason: string | null
  items: Array<{
    id: string
    product_name: string
    quantity: number
    unit_price: number
    discount_amount: number
    total: number
  }>
}

export async function getTransactions(filters: {
  dateFrom: string
  dateTo: string
  paymentMethod?: string
  status?: string
  branchId?: string
}): Promise<TransactionSummary[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile || !['manager', 'owner'].includes(profile.role)) {
    throw new Error('Forbidden')
  }

  let query = supabase
    .from('transactions')
    .select('id, created_at, branch_id, cashier_id, payment_method, total, discount_amount, status, void_reason')
    .gte('created_at', filters.dateFrom)
    .lte('created_at', filters.dateTo + 'T23:59:59.999Z')
    .order('created_at', { ascending: false })
    .limit(500)

  if (filters.paymentMethod) {
    query = query.eq('payment_method', filters.paymentMethod as 'cash' | 'card' | 'split' | 'gcash' | 'maya')
  }
  if (filters.status) {
    query = query.eq('status', filters.status as 'completed' | 'voided' | 'held')
  }
  if (filters.branchId) {
    query = query.eq('branch_id', filters.branchId)
  }

  const { data: txns, error } = await query
  if (error) throw new Error(error.message)

  const transactions = (txns ?? []) as any[]

  // Get cashier names
  const cashierIds = [...new Set(transactions.map((t) => t.cashier_id as string))]
  const cashierMap = new Map<string, string>()
  if (cashierIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', cashierIds)
    for (const p of profileRows ?? []) cashierMap.set(p.id, p.full_name)
  }

  // Get branch info
  const branchIds = [...new Set(transactions.map((t) => t.branch_id as string))]
  const branchMap = new Map<string, { name: string; address: string | null; phone: string | null }>()
  if (branchIds.length > 0) {
    const { data: branchRows } = await supabase
      .from('branches')
      .select('id, name, address, phone')
      .in('id', branchIds)
    for (const b of (branchRows ?? []) as any[]) {
      branchMap.set(b.id, { name: b.name, address: b.address, phone: b.phone })
    }
  }

  // Get items for all transactions
  const txnIds = transactions.map((t) => t.id as string)
  const itemsMap = new Map<string, TransactionSummary['items']>()
  if (txnIds.length > 0) {
    const { data: allItems } = await supabase
      .from('transaction_items')
      .select('id, transaction_id, product_name, quantity, unit_price, discount_amount, total')
      .in('transaction_id', txnIds)
    for (const item of (allItems ?? []) as any[]) {
      if (!itemsMap.has(item.transaction_id)) itemsMap.set(item.transaction_id, [])
      itemsMap.get(item.transaction_id)!.push({
        id: item.id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        total: item.total,
      })
    }
  }

  return transactions.map((tx) => {
    const items = itemsMap.get(tx.id) ?? []
    const item_count = items.reduce((s, i) => s + i.quantity, 0)
    const branch = branchMap.get(tx.branch_id)
    return {
      id: tx.id,
      created_at: tx.created_at,
      branch_id: tx.branch_id,
      branch_name: branch?.name ?? 'Unknown',
      branch_address: branch?.address ?? null,
      branch_phone: branch?.phone ?? null,
      cashier_name: cashierMap.get(tx.cashier_id) ?? 'Unknown',
      item_count,
      payment_method: tx.payment_method,
      total: tx.total,
      discount_amount: tx.discount_amount,
      status: tx.status,
      void_reason: tx.void_reason,
      items,
    }
  })
}

export async function getRecentBranchTransactions(branchId: string, date: string): Promise<TransactionSummary[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: txns, error } = await supabase
    .from('transactions')
    .select('id, created_at, branch_id, cashier_id, payment_method, total, discount_amount, status, void_reason')
    .eq('branch_id', branchId)
    .in('status', ['completed', 'voided'])
    .gte('created_at', `${date}T00:00:00.000Z`)
    .lte('created_at', `${date}T23:59:59.999Z`)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const transactions = (txns ?? []) as any[]

  // Get cashier names
  const cashierIds = [...new Set(transactions.map((t) => t.cashier_id as string))]
  const cashierMap = new Map<string, string>()
  if (cashierIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', cashierIds)
    for (const p of profileRows ?? []) cashierMap.set(p.id, p.full_name)
  }

  // Get branch info
  const { data: branchRow } = await supabase
    .from('branches')
    .select('id, name, address, phone')
    .eq('id', branchId)
    .single()
  const branch = branchRow as { id: string; name: string; address: string | null; phone: string | null } | null

  // Get items
  const txnIds = transactions.map((t) => t.id as string)
  const itemsMap = new Map<string, TransactionSummary['items']>()
  if (txnIds.length > 0) {
    const { data: allItems } = await supabase
      .from('transaction_items')
      .select('id, transaction_id, product_name, quantity, unit_price, discount_amount, total')
      .in('transaction_id', txnIds)
    for (const item of (allItems ?? []) as any[]) {
      if (!itemsMap.has(item.transaction_id)) itemsMap.set(item.transaction_id, [])
      itemsMap.get(item.transaction_id)!.push({
        id: item.id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount_amount,
        total: item.total,
      })
    }
  }

  return transactions.map((tx) => {
    const items = itemsMap.get(tx.id) ?? []
    const item_count = items.reduce((s, i) => s + i.quantity, 0)
    return {
      id: tx.id,
      created_at: tx.created_at,
      branch_id: tx.branch_id,
      branch_name: branch?.name ?? 'Unknown',
      branch_address: branch?.address ?? null,
      branch_phone: branch?.phone ?? null,
      cashier_name: cashierMap.get(tx.cashier_id) ?? 'Unknown',
      item_count,
      payment_method: tx.payment_method,
      total: tx.total,
      discount_amount: tx.discount_amount,
      status: tx.status,
      void_reason: tx.void_reason,
      items,
    }
  })
}

export async function clearExpiredHeldOrders(): Promise<number> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: expired } = await supabase
    .from('transactions')
    .select('id')
    .eq('status', 'held')
    .lt('created_at', cutoff)

  const ids = (expired ?? []).map((t) => t.id)
  if (ids.length === 0) return 0

  await supabase.from('transaction_items').delete().in('transaction_id', ids)
  await supabase.from('transactions').delete().in('id', ids).eq('status', 'held')

  return ids.length
}

export async function createHeldTransaction(params: {
  items: TxItem[]
  subtotal: number
  discount_amount: number
  tax_amount: number
  total: number
  notes?: string
}): Promise<void> {
  const profile = await getProfile()
  const supabase = getAdminClient()

  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      branch_id: profile.branch_id,
      cashier_id: profile.id,
      subtotal: params.subtotal,
      discount_amount: params.discount_amount,
      tax_amount: params.tax_amount,
      total: params.total,
      payment_method: 'cash',
      status: 'held',
      notes: params.notes ?? null,
    })
    .select('id')
    .single()

  if (txError || !transaction) throw new Error(txError?.message ?? 'Failed to hold transaction')

  const { error: itemsError } = await supabase.from('transaction_items').insert(
    params.items.map((item) => ({
      transaction_id: transaction.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount_amount: item.discount_amount,
      total: item.unit_price * item.quantity - item.discount_amount,
    }))
  )
  if (itemsError) throw new Error(itemsError.message)
}

export type HeldTransaction = {
  id: string
  notes: string | null
  total: number
  created_at: string
  items: Array<{
    id: string
    product_id: string
    product_name: string
    quantity: number
    unit_price: number
    discount_amount: number
  }>
}

export async function getHeldTransactions(): Promise<HeldTransaction[]> {
  const { userId } = await auth()
  if (!userId) return []

  const supabase = getAdminClient()
  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, branch_id')
    .eq('clerk_user_id', userId)
    .single()

  if (!profileData?.branch_id) return []

  const profile = profileData as { id: string; branch_id: string }

  const { data, error } = await supabase
    .from('transactions')
    .select('id, notes, total, created_at, transaction_items(id, product_id, product_name, quantity, unit_price, discount_amount)')
    .eq('status', 'held')
    .eq('branch_id', profile.branch_id)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map((tx) => ({
    id: tx.id as string,
    notes: tx.notes as string | null,
    total: tx.total as number,
    created_at: tx.created_at as string,
    items: (Array.isArray(tx.transaction_items) ? tx.transaction_items : []) as HeldTransaction['items'],
  }))
}

export async function deleteHeldTransaction(id: string): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  await supabase.from('transaction_items').delete().eq('transaction_id', id)
  await supabase.from('transactions').delete().eq('id', id).eq('status', 'held')
}

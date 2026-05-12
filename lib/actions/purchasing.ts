'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import type { Database, PurchaseOrder as PurchaseOrderRow, PurchaseOrderCheque } from '@/types/database'
import { CACHE_TAGS } from '@/lib/cache-tags'

export type POWithRelations = PurchaseOrderRow & {
  suppliers: { name: string } | null
  branches: { name: string } | null
  profiles: { full_name: string } | null
  purchase_order_items: Array<{
    id: string
    product_id: string
    quantity_ordered: number
    quantity_received: number
    unit_cost: number
    products: { name: string; serial_required: boolean } | null
  }>
  purchase_order_cheques: Array<{ id: string }>
}

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Create a new purchase order with line items
export async function createPurchaseOrder(params: {
  supplier_id: string
  branch_id: string
  notes: string
  items: Array<{
    product_id: string
    quantity_ordered: number
    unit_cost: number
  }>
}) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, branch_id')
    .eq('clerk_user_id', userId)
    .single()
  if (!profile) throw new Error('Profile not found')

  // Only main branch can create supplier POs
  if (profile.branch_id) {
    const { data: branch } = await supabase
      .from('branches')
      .select('is_main')
      .eq('id', profile.branch_id)
      .single()
    if (!branch?.is_main) throw new Error('Only the main branch can create supplier purchase orders')
  }

  const total = params.items.reduce((sum, item) => sum + item.quantity_ordered * item.unit_cost, 0)

  // Validate supplier exists (guard against stale dropdown data)
  const { data: supplierExists } = await supabase
    .from('suppliers')
    .select('id')
    .eq('id', params.supplier_id)
    .single()
  if (!supplierExists) throw new Error('The selected supplier no longer exists. Please refresh and select a valid supplier.')

  // Create the PO
  const { data: poRaw, error: poErr } = await supabase
    .from('purchase_orders')
    .insert({
      supplier_id: params.supplier_id,
      branch_id: params.branch_id,
      status: 'draft',
      total,
      notes: params.notes || null,
      created_by: profile.id,
    })
    .select()
    .single()
  if (poErr) throw new Error(poErr.message)
  const po = poRaw as unknown as PurchaseOrderRow

  // Insert line items
  const { error: itemErr } = await supabase
    .from('purchase_order_items')
    .insert(
      params.items.map((item) => ({
        po_id: po.id,
        product_id: item.product_id,
        quantity_ordered: item.quantity_ordered,
        quantity_received: 0,
        unit_cost: item.unit_cost,
      }))
    )
  if (itemErr) throw new Error(itemErr.message)

  revalidateTag(CACHE_TAGS.PURCHASE_ORDERS, {})
  revalidatePath('/purchasing/orders')
  return po
}

// Update PO status (submit to ordered or cancel)
export async function updatePurchaseOrderStatus(poId: string, status: 'ordered' | 'cancelled') {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()
  if (!profile) throw new Error('Profile not found')
  if (profile.role === 'cashier') throw new Error('Insufficient permissions')

  const { error } = await supabase
    .from('purchase_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', poId)
  if (error) throw new Error(error.message)
  revalidateTag(CACHE_TAGS.PURCHASE_ORDERS, {})
  revalidatePath('/purchasing/orders')
}

// Update a draft PO's details and line items
export async function updatePurchaseOrder(poId: string, params: {
  supplier_id: string
  branch_id: string
  notes: string
  items: Array<{
    product_id: string
    quantity_ordered: number
    unit_cost: number
  }>
}) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: existing } = await supabase
    .from('purchase_orders')
    .select('status')
    .eq('id', poId)
    .single()
  if (!existing) throw new Error('Purchase order not found')
  if (existing.status !== 'draft') throw new Error('Only draft purchase orders can be edited')

  // Validate supplier exists
  const { data: supplierExists } = await supabase
    .from('suppliers')
    .select('id')
    .eq('id', params.supplier_id)
    .single()
  if (!supplierExists) throw new Error('The selected supplier no longer exists. Please refresh and select a valid supplier.')

  const total = params.items.reduce((sum, item) => sum + item.quantity_ordered * item.unit_cost, 0)

  const { error: poErr } = await supabase
    .from('purchase_orders')
    .update({
      supplier_id: params.supplier_id,
      branch_id: params.branch_id,
      notes: params.notes || null,
      total,
      updated_at: new Date().toISOString(),
    })
    .eq('id', poId)
  if (poErr) throw new Error(poErr.message)

  // Replace all line items
  await supabase.from('purchase_order_items').delete().eq('po_id', poId)
  const { error: itemErr } = await supabase
    .from('purchase_order_items')
    .insert(
      params.items.map((item) => ({
        po_id: poId,
        product_id: item.product_id,
        quantity_ordered: item.quantity_ordered,
        quantity_received: 0,
        unit_cost: item.unit_cost,
      }))
    )
  if (itemErr) throw new Error(itemErr.message)

  revalidateTag(CACHE_TAGS.PURCHASE_ORDERS, {})
  revalidatePath('/purchasing/orders')
}

// Get all purchase orders with related data
const getPurchaseOrdersCached = unstable_cache(
  async (filters?: { status?: string; branch_id?: string }): Promise<POWithRelations[]> => {
    const supabase = getAdminClient()
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        suppliers(name),
        branches(name),
        profiles!created_by(full_name),
        purchase_order_items(id, product_id, quantity_ordered, quantity_received, unit_cost, products(name, serial_required)),
        purchase_order_cheques(id)
      `)
      .order('created_at', { ascending: false })

    if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status as any)
    if (filters?.branch_id) query = query.eq('branch_id', filters.branch_id)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []) as unknown as POWithRelations[]
  },
  ['purchase-orders-v3'],
  { tags: [CACHE_TAGS.PURCHASE_ORDERS] }
)

export async function getPurchaseOrders(filters?: { status?: string; branch_id?: string }): Promise<POWithRelations[]> {
  return getPurchaseOrdersCached(filters)
}

// Get suppliers
const getSuppliersCached = unstable_cache(
  async () => {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .order('name')
    return data ?? []
  },
  ['suppliers'],
  { tags: [CACHE_TAGS.SUPPLIERS] }
)

export async function getSuppliers() {
  return getSuppliersCached()
}

// Get branches
const getBranchesCached = unstable_cache(
  async () => {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
    return data ?? []
  },
  ['branches'],
  { tags: [CACHE_TAGS.BRANCHES] }
)

export async function getBranches() {
  return getBranchesCached()
}

// Get per-supplier costs for all products (for PO unit cost auto-fill)
const getProductSupplierCostsCached = unstable_cache(
  async (): Promise<Array<{ product_id: string; supplier_id: string; cost_price: number }>> => {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('product_suppliers')
      .select('product_id, supplier_id, cost_price')
    return (data ?? []) as Array<{ product_id: string; supplier_id: string; cost_price: number }>
  },
  ['product-supplier-costs'],
  { tags: [CACHE_TAGS.PRODUCTS] }
)

export async function getProductSupplierCosts() {
  return getProductSupplierCostsCached()
}

// Receive goods against a purchase order
export async function receivePurchaseOrder(params: {
  poId: string
  items: Array<{ itemId: string; productId: string; quantityReceived: number; unitCost: number; serials: string[] }>
  updateCostPrice: boolean
  paymentDueDate: string | null
  shippingFee: number
}): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_user_id', userId)
    .single()
  if (!profile) throw new Error('Profile not found')
  if (profile.role === 'cashier') throw new Error('Insufficient permissions')

  const { data: poRaw } = await supabase
    .from('purchase_orders')
    .select('id, branch_id, supplier_id, status')
    .eq('id', params.poId)
    .single()
  if (!poRaw) throw new Error('Purchase order not found')
  const po = poRaw as unknown as { id: string; branch_id: string; supplier_id: string; status: string }

  if (po.status !== 'ordered' && po.status !== 'partial') {
    throw new Error('Can only receive goods for orders with status "ordered" or "partial"')
  }

  const itemsToProcess = params.items.filter((item) => item.quantityReceived > 0)
  if (itemsToProcess.length === 0) throw new Error('No quantities to receive')

  for (const item of itemsToProcess) {
    // Increment quantity_received on PO item
    const { data: existing } = await supabase
      .from('purchase_order_items')
      .select('quantity_received')
      .eq('id', item.itemId)
      .single()
    if (existing) {
      await supabase
        .from('purchase_order_items')
        .update({ quantity_received: existing.quantity_received + item.quantityReceived })
        .eq('id', item.itemId)
    }

    // Update inventory (select then update or insert)
    const { data: inv } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('product_id', item.productId)
      .eq('branch_id', po.branch_id)
      .single()
    if (inv) {
      await supabase
        .from('inventory')
        .update({ quantity: inv.quantity + item.quantityReceived, updated_at: new Date().toISOString() })
        .eq('id', inv.id)
    } else {
      await supabase.from('inventory').insert({
        product_id: item.productId,
        branch_id: po.branch_id,
        quantity: item.quantityReceived,
        low_stock_threshold: 10,
      })
    }

    // Log inventory movement
    await supabase.from('inventory_movements').insert({
      product_id: item.productId,
      branch_id: po.branch_id,
      type: 'purchase' as const,
      quantity: item.quantityReceived,
      reference_id: params.poId,
      notes: `Received via PO ${params.poId.slice(0, 8).toUpperCase()}`,
      created_by: profile.id,
      serials: item.serials,
    })

    // Update product_supplier_stock for the PO's supplier
    const { data: pss } = await supabase
      .from('product_supplier_stock')
      .select('quantity')
      .eq('product_id', item.productId)
      .eq('supplier_id', po.supplier_id)
      .eq('branch_id', po.branch_id)
      .single()
    if (pss) {
      await supabase
        .from('product_supplier_stock')
        .update({ quantity: pss.quantity + item.quantityReceived, updated_at: new Date().toISOString() })
        .eq('product_id', item.productId)
        .eq('supplier_id', po.supplier_id)
        .eq('branch_id', po.branch_id)
    } else {
      await supabase.from('product_supplier_stock').insert({
        product_id: item.productId,
        supplier_id: po.supplier_id,
        branch_id: po.branch_id,
        quantity: item.quantityReceived,
      })
    }

    // Optionally update product cost price and product_suppliers cost
    if (params.updateCostPrice) {
      await supabase
        .from('products')
        .update({ cost_price: item.unitCost, updated_at: new Date().toISOString() })
        .eq('id', item.productId)
      // Also update the per-supplier cost record
      await supabase
        .from('product_suppliers')
        .update({ cost_price: item.unitCost })
        .eq('product_id', item.productId)
        .eq('supplier_id', po.supplier_id)
    }
  }

  // Determine new PO status based on all items
  const { data: allItems } = await supabase
    .from('purchase_order_items')
    .select('quantity_ordered, quantity_received')
    .eq('po_id', params.poId)

  const allReceived = (allItems ?? []).every(
    (i: any) => i.quantity_received >= i.quantity_ordered
  )

  await supabase
    .from('purchase_orders')
    .update({
      status: allReceived ? 'received' : 'partial',
      payment_due_date: params.paymentDueDate ?? null,
      shipping_fee: params.shippingFee,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.poId)

  revalidateTag(CACHE_TAGS.INVENTORY, {})
  revalidateTag(CACHE_TAGS.INVENTORY_MOVEMENTS, {})
  revalidateTag(CACHE_TAGS.PURCHASE_ORDERS, {})
  if (params.updateCostPrice) revalidateTag(CACHE_TAGS.PRODUCTS, {})
  revalidatePath('/purchasing/orders')
  revalidatePath('/inventory/stock')
  revalidatePath('/inventory/adjustments')
}

// Upsert a supplier
export async function upsertSupplier(params: {
  id?: string
  name: string
  contact_name: string
  email: string
  phone: string
}) {
  const supabase = getAdminClient()
  const orgId = '00000000-0000-0000-0000-000000000001'
  if (params.id) {
    const { error } = await supabase
      .from('suppliers')
      .update({
        name: params.name,
        contact_name: params.contact_name || null,
        email: params.email || null,
        phone: params.phone || null,
      })
      .eq('id', params.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('suppliers')
      .insert({
        org_id: orgId,
        name: params.name,
        contact_name: params.contact_name || null,
        email: params.email || null,
        phone: params.phone || null,
      })
    if (error) throw new Error(error.message)
  }
  revalidateTag(CACHE_TAGS.SUPPLIERS, {})
  revalidatePath('/purchasing/suppliers')
}

// Delete a supplier — fails if the supplier has existing purchase orders
export async function deleteSupplier(id: string): Promise<void> {
  const supabase = getAdminClient()
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') throw new Error('Cannot delete this supplier because it has existing purchase orders.')
    throw new Error(error.message)
  }
  revalidateTag(CACHE_TAGS.SUPPLIERS, {})
  revalidatePath('/purchasing/suppliers')
}

// ---------------------------------------------------------------------------
// Cheque CRUD
// ---------------------------------------------------------------------------

const ORG_ID = '00000000-0000-0000-0000-000000000001'

export async function getPOCheques(poId: string): Promise<PurchaseOrderCheque[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('purchase_order_cheques')
    .select('*')
    .eq('po_id', poId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as PurchaseOrderCheque[]
}

export async function addPOCheque(params: {
  po_id: string
  check_name: string
  check_number: string
  check_date: string
  amount: number
}): Promise<{ error?: string }> {
  const { userId } = await auth()
  if (!userId) return { error: 'Unauthorized' }

  const supabase = getAdminClient()

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('total')
    .eq('id', params.po_id)
    .single()

  if (!po) return { error: 'PO not found' }

  const { data: existing } = await supabase
    .from('purchase_order_cheques')
    .select('amount')
    .eq('po_id', params.po_id)

  const existingTotal = ((existing ?? []) as any[]).reduce(
    (sum: number, c: any) => sum + Number(c.amount),
    0
  )

  if (existingTotal + params.amount > Number((po as any).total)) {
    return { error: 'Total cheque amount exceeds PO total' }
  }

  const { error } = await supabase
    .from('purchase_order_cheques')
    .insert({
      org_id: ORG_ID,
      po_id: params.po_id,
      check_name: params.check_name,
      check_number: params.check_number,
      check_date: params.check_date,
      amount: params.amount,
    })

  if (error) return { error: error.message }

  revalidateTag(CACHE_TAGS.PURCHASE_ORDERS, {})
  revalidatePath('/purchasing/orders')
  return {}
}

export async function updatePOCheque(
  id: string,
  params: {
    check_name: string
    check_number: string
    check_date: string
    amount: number
  }
): Promise<{ error?: string }> {
  const { userId } = await auth()
  if (!userId) return { error: 'Unauthorized' }

  const supabase = getAdminClient()

  const { data: cheque } = await supabase
    .from('purchase_order_cheques')
    .select('po_id')
    .eq('id', id)
    .single()

  if (!cheque) return { error: 'Cheque not found' }

  const poId = (cheque as any).po_id

  const { data: po } = await supabase
    .from('purchase_orders')
    .select('total')
    .eq('id', poId)
    .single()

  if (!po) return { error: 'PO not found' }

  const { data: others } = await supabase
    .from('purchase_order_cheques')
    .select('amount')
    .eq('po_id', poId)
    .neq('id', id)

  const othersTotal = ((others ?? []) as any[]).reduce(
    (sum: number, c: any) => sum + Number(c.amount),
    0
  )

  if (othersTotal + params.amount > Number((po as any).total)) {
    return { error: 'Total cheque amount exceeds PO total' }
  }

  const { error } = await supabase
    .from('purchase_order_cheques')
    .update({
      check_name: params.check_name,
      check_number: params.check_number,
      check_date: params.check_date,
      amount: params.amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidateTag(CACHE_TAGS.PURCHASE_ORDERS, {})
  revalidatePath('/purchasing/orders')
  return {}
}

export async function deletePOCheque(id: string): Promise<{ error?: string }> {
  const { userId } = await auth()
  if (!userId) return { error: 'Unauthorized' }

  const supabase = getAdminClient()

  const { error } = await supabase
    .from('purchase_order_cheques')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidateTag(CACHE_TAGS.PURCHASE_ORDERS, {})
  revalidatePath('/purchasing/orders')
  return {}
}

export type ChequeWithPO = {
  id: string
  check_name: string
  check_number: string
  check_date: string
  amount: number
  po_id: string
  po_total: number
  supplier_name: string
}

export async function getAllCheques(): Promise<ChequeWithPO[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('purchase_order_cheques')
    .select('*, po:purchase_orders!po_id(id, total, supplier:suppliers!supplier_id(name))')
    .order('check_date', { ascending: false })

  if (error) throw new Error(error.message)

  return ((data ?? []) as any[]).map((c: any) => ({
    id: c.id,
    check_name: c.check_name,
    check_number: c.check_number,
    check_date: c.check_date,
    amount: Number(c.amount),
    po_id: c.po_id,
    po_total: Number(c.po?.total ?? 0),
    supplier_name: c.po?.supplier?.name ?? 'Unknown',
  }))
}

'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import type { Database, InventoryMovement } from '@/types/database'
import { CACHE_TAGS } from '@/lib/cache-tags'

export type MovementWithRelations = InventoryMovement & {
  products: { name: string; sku: string } | null
  branches: { name: string } | null
  profiles: { full_name: string } | null
}

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Create a manual stock adjustment
export async function createStockAdjustment(params: {
  product_id: string
  branch_id: string
  type: 'adjustment' | 'damage'
  quantity: number  // positive number, direction inferred from type field
  adjustment_direction: 'add' | 'remove'  // user picks add or remove
  notes: string
}) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  // Get the profile id for created_by
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_user_id', userId)
    .single()
  if (!profile) throw new Error('Profile not found')

  // Direction: damage is always negative, adjustment can be + or -
  const finalQty = params.adjustment_direction === 'add' ? params.quantity : -params.quantity

  // Insert inventory movement (append-only log)
  const { error: movErr } = await supabase
    .from('inventory_movements')
    .insert({
      product_id: params.product_id,
      branch_id: params.branch_id,
      type: params.type,
      quantity: finalQty,
      notes: params.notes || null,
      created_by: profile.id,
    })
  if (movErr) throw new Error(movErr.message)

  // Update inventory quantity
  const { data: inv } = await supabase
    .from('inventory')
    .select('id, quantity')
    .eq('product_id', params.product_id)
    .eq('branch_id', params.branch_id)
    .single()

  if (inv) {
    await supabase
      .from('inventory')
      .update({ quantity: Math.max(0, inv.quantity + finalQty), updated_at: new Date().toISOString() })
      .eq('id', inv.id)
  } else {
    // Create inventory row if doesn't exist
    await supabase.from('inventory').insert({
      product_id: params.product_id,
      branch_id: params.branch_id,
      quantity: Math.max(0, finalQty),
      low_stock_threshold: 10,
    })
  }

  revalidateTag(CACHE_TAGS.INVENTORY, {})
  revalidateTag(CACHE_TAGS.INVENTORY_MOVEMENTS, {})
  revalidateTag(CACHE_TAGS.BUNDLES, {})
  revalidatePath('/inventory/adjustments')
  revalidatePath('/inventory/stock')
}

// Fetch inventory movements with product + branch info — no cache, always fresh
export async function getInventoryMovements(filters?: {
  branch_id?: string
  type?: string
  date_from?: string
  date_to?: string
}): Promise<MovementWithRelations[]> {
  const supabase = getAdminClient()
  let query = supabase
    .from('inventory_movements')
    .select(`
      *,
      products(name, sku),
      branches(name),
      profiles(full_name)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (filters?.branch_id) query = query.eq('branch_id', filters.branch_id)
  if (filters?.type && filters.type !== 'all') query = query.eq('type', filters.type as any)
  if (filters?.date_from) query = query.gte('created_at', filters.date_from)
  if (filters?.date_to) query = query.lte('created_at', filters.date_to + 'T23:59:59')

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as MovementWithRelations[]
}

// Get products for a branch
const getProductsForBranchCached = unstable_cache(
  async (branch_id?: string) => {
    const supabase = getAdminClient()
    const PAGE_SIZE = 1000
    const allRows: any[] = []
    let page = 0

    while (true) {
      const from = page * PAGE_SIZE
      const { data } = await supabase
        .from('products')
        .select('id, name, sku, unit, cost_price, is_active, image_url')
        .eq('is_active', true)
        .order('name')
        .range(from, from + PAGE_SIZE - 1)

      if (!data || data.length === 0) break
      allRows.push(...data)
      if (data.length < PAGE_SIZE) break
      page++
    }

    return allRows
  },
  ['products-branch-v3'],
  { tags: [CACHE_TAGS.PRODUCTS], revalidate: 300 }
)

export async function getProductsForBranch(branch_id?: string) {
  return getProductsForBranchCached(branch_id)
}

export type POSProduct = {
  id: string
  org_id: string
  sku: string
  barcode: string | null
  name: string
  description: string | null
  category_id: string | null
  supplier_id: string | null
  category_name: string | null
  unit: string
  cost_price: number
  selling_price: number
  image_url: string | null
  is_active: boolean
  serial_required: boolean
  warranty_days: number | null
  created_at: string
  updated_at: string
  stock: number
}

function mapPOSProduct(p: any, branch_id: string | null): POSProduct {
  const invArr: Array<{ quantity: number; branch_id: string }> = Array.isArray(p.inventory)
    ? p.inventory
    : p.inventory ? [p.inventory] : []

  const relevant = branch_id
    ? invArr.filter((inv) => inv.branch_id === branch_id)
    : invArr

  return {
    id: p.id,
    org_id: p.org_id,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    description: p.description,
    category_id: p.category_id,
    supplier_id: p.supplier_id ?? null,
    category_name: p.categories?.name ?? null,
    unit: p.unit,
    cost_price: p.cost_price,
    selling_price: p.selling_price,
    image_url: p.image_url,
    is_active: p.is_active,
    serial_required: p.serial_required,
    warranty_days: p.warranty_days ?? null,
    created_at: p.created_at,
    updated_at: p.updated_at,
    stock: relevant.reduce((sum, inv) => sum + inv.quantity, 0),
  }
}

// Fetch products with branch-scoped stock for the POS
// Uses pagination to bypass PostgREST max-rows cap (default 1000)
const getPOSProductsCached = unstable_cache(
  async (branch_id: string | null): Promise<POSProduct[]> => {
    const supabase = getAdminClient()
    const PAGE_SIZE = 1000
    const allRows: any[] = []
    let page = 0

    while (true) {
      const from = page * PAGE_SIZE
      const to = from + PAGE_SIZE - 1
      const { data, error } = await supabase
        .from('products')
        .select('*, inventory(quantity, branch_id), categories(id, name)')
        .eq('is_active', true)
        .order('name')
        .range(from, to)

      if (error) throw new Error(error.message)
      if (!data || data.length === 0) break
      allRows.push(...data)
      if (data.length < PAGE_SIZE) break
      page++
    }

    return allRows.map((p) => mapPOSProduct(p, branch_id))
  },
  ['pos-products-v3'],
  { tags: [CACHE_TAGS.PRODUCTS, CACHE_TAGS.INVENTORY], revalidate: 300 }
)

export async function getPOSProducts(branch_id: string | null): Promise<POSProduct[]> {
  return getPOSProductsCached(branch_id)
}

const ORG_ID_BUNDLES = '00000000-0000-0000-0000-000000000001'

export type POSBundle = {
  id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_active: boolean
  items: Array<{ product_id: string; product_name: string; quantity: number; serial_required: boolean }>
}

const getPOSBundlesCached = unstable_cache(
  async (branch_id: string | null): Promise<POSBundle[]> => {
    const supabase = getAdminClient()

    const { data: bundles, error } = await supabase
      .from('bundles')
      .select('id, name, description, price, image_url, is_active')
      .eq('org_id', ORG_ID_BUNDLES)
      .eq('is_active', true)
      .order('name')

    if (error || !bundles || bundles.length === 0) return []

    const bundleIds = (bundles as any[]).map((b) => b.id as string)

    const { data: bundleItemRows } = await supabase
      .from('bundle_items')
      .select('bundle_id, product_id, quantity, products(name)')
      .in('bundle_id', bundleIds)

    // Collect all component product IDs to check stock + active status
    const productIds = [...new Set((bundleItemRows ?? []).map((bi: any) => bi.product_id as string))]

    const stockMap = new Map<string, number>()
    if (productIds.length > 0 && branch_id) {
      const { data: invRows } = await supabase
        .from('inventory')
        .select('product_id, quantity')
        .in('product_id', productIds)
        .eq('branch_id', branch_id)
      for (const row of (invRows ?? []) as any[]) {
        stockMap.set(row.product_id, row.quantity)
      }
    }

    const activeProducts = new Set<string>()
    const serialRequiredMap = new Map<string, boolean>()
    if (productIds.length > 0) {
      const { data: productRows } = await supabase
        .from('products')
        .select('id, is_active, serial_required')
        .in('id', productIds)
      for (const p of (productRows ?? []) as any[]) {
        if (p.is_active) activeProducts.add(p.id)
        serialRequiredMap.set(p.id, p.serial_required ?? false)
      }
    }

    // Build items map
    const itemsMap = new Map<string, POSBundle['items']>()
    for (const bi of (bundleItemRows ?? []) as any[]) {
      if (!itemsMap.has(bi.bundle_id)) itemsMap.set(bi.bundle_id, [])
      itemsMap.get(bi.bundle_id)!.push({
        product_id: bi.product_id,
        product_name: bi.products?.name ?? 'Unknown',
        quantity: bi.quantity,
        serial_required: serialRequiredMap.get(bi.product_id) ?? false,
      })
    }

    return (bundles as any[])
      .map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        price: b.price,
        image_url: b.image_url,
        is_active: b.is_active,
        items: itemsMap.get(b.id) ?? [],
      }))
      .filter((bundle) =>
        bundle.items.length > 0 &&
        bundle.items.every((item) => {
          if (!activeProducts.has(item.product_id)) return false
          // If no branch_id, skip stock check (e.g. quotation form)
          if (!branch_id) return true
          return (stockMap.get(item.product_id) ?? 0) >= item.quantity
        })
      )
  },
  ['pos-bundles'],
  { tags: [CACHE_TAGS.BUNDLES, CACHE_TAGS.PRODUCTS, CACHE_TAGS.INVENTORY] }
)

export async function getPOSBundles(branch_id: string | null): Promise<POSBundle[]> {
  return getPOSBundlesCached(branch_id)
}

export type SerialLookupResult = {
  serial: string
  product: { id: string; name: string; sku: string } | null
  received: Array<{ date: string; reference_id: string | null; branch: string }>
  sold: Array<{ date: string; transaction_id: string; branch: string }>
}

export async function lookupSerial(serial: string): Promise<SerialLookupResult> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const trimmed = serial.trim()

  // Find in inventory_movements (PO receipts)
  const { data: movements } = await supabase
    .from('inventory_movements')
    .select('reference_id, created_at, product_id, products(name, sku), branches(name)')
    .eq('type', 'purchase')
    .contains('serials', [trimmed])
    .order('created_at', { ascending: false })

  // Find in transaction_items (sales)
  const { data: txItems } = await supabase
    .from('transaction_items')
    .select('transaction_id, product_id, products(name, sku), transactions(id, created_at, branch_id, branches(name))')
    .contains('serials', [trimmed])
    .order('transaction_id', { ascending: false })

  const movementsTyped = (movements ?? []) as any[]
  const txItemsTyped = (txItems ?? []) as any[]

  // Determine product from whichever source has data
  let product: SerialLookupResult['product'] = null
  if (movementsTyped.length > 0) {
    const p = movementsTyped[0].products
    if (p) product = { id: movementsTyped[0].product_id, name: p.name, sku: p.sku }
  } else if (txItemsTyped.length > 0) {
    const p = txItemsTyped[0].products
    if (p) product = { id: txItemsTyped[0].product_id, name: p.name, sku: p.sku }
  }

  return {
    serial: trimmed,
    product,
    received: movementsTyped.map((m) => ({
      date: m.created_at,
      reference_id: m.reference_id,
      branch: m.branches?.name ?? '—',
    })),
    sold: txItemsTyped.map((t) => ({
      date: t.transactions?.created_at ?? '',
      transaction_id: t.transaction_id,
      branch: t.transactions?.branches?.name ?? '—',
    })),
  }
}

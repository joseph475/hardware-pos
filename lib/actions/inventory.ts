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
    const { data } = await supabase
      .from('products')
      .select('id, name, sku, unit, cost_price, is_active')
      .eq('is_active', true)
      .order('name')
    return data ?? []
  },
  ['products-branch'],
  { tags: [CACHE_TAGS.PRODUCTS] }
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
  category_name: string | null
  unit: string
  cost_price: number
  selling_price: number
  image_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  stock: number
}

// Fetch products with branch-scoped stock for the POS
const getPOSProductsCached = unstable_cache(
  async (branch_id: string | null): Promise<POSProduct[]> => {
    const supabase = getAdminClient()

    const { data, error } = await supabase
      .from('products')
      .select('*, inventory(quantity, branch_id), categories(id, name)')
      .eq('is_active', true)
      .order('name')

    if (error) throw new Error(error.message)
    if (!data) return []

    return data.map((p: any) => {
      const invArr: Array<{ quantity: number; branch_id: string }> = Array.isArray(p.inventory)
        ? p.inventory
        : p.inventory ? [p.inventory] : []

      const relevant = branch_id
        ? invArr.filter((inv) => inv.branch_id === branch_id)
        : invArr

      const stock = relevant.reduce((sum, inv) => sum + inv.quantity, 0)

      return {
        id: p.id,
        org_id: p.org_id,
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        description: p.description,
        category_id: p.category_id,
        category_name: p.categories?.name ?? null,
        unit: p.unit,
        cost_price: p.cost_price,
        selling_price: p.selling_price,
        image_url: p.image_url,
        is_active: p.is_active,
        created_at: p.created_at,
        updated_at: p.updated_at,
        stock,
      }
    })
  },
  ['pos-products'],
  { tags: [CACHE_TAGS.PRODUCTS, CACHE_TAGS.INVENTORY] }
)

export async function getPOSProducts(branch_id: string | null): Promise<POSProduct[]> {
  return getPOSProductsCached(branch_id)
}

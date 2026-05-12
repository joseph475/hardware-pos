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

const ORG_ID = '00000000-0000-0000-0000-000000000001'

export async function upsertProduct(params: {
  id?: string
  name: string
  sku: string
  barcode?: string
  category_id?: string
  supplier_id?: string
  unit: string
  cost_price: number
  selling_price: number
  description?: string
  is_active: boolean
  image_url?: string | null
  serial_required?: boolean
  warranty_days?: number | null
  suppliers?: Array<{ supplier_id: string; cost_price: number; stock_qty?: number }>
  opening_stock_branch_id?: string
}): Promise<{ id: string } | { error: string }> {
  const { userId } = await auth()
  if (!userId) return { error: 'Unauthorized' }

  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, branch_id')
    .eq('clerk_user_id', userId)
    .single()
  if (!profile) return { error: 'Profile not found' }

  const supplierRows = params.suppliers ?? []

  // Derive cost_price as min across suppliers (or use provided value if no suppliers)
  const effectiveCostPrice = supplierRows.length > 0
    ? Math.min(...supplierRows.map((s) => s.cost_price))
    : params.cost_price

  // Keep supplier_id on products for backward compat (cheapest supplier)
  const defaultSupplierId = supplierRows.length > 0
    ? supplierRows.reduce((min, s) => s.cost_price < min.cost_price ? s : min).supplier_id
    : null

  const payload = {
    name: params.name,
    sku: params.sku,
    barcode: params.barcode || null,
    category_id: params.category_id || null,
    supplier_id: defaultSupplierId,
    unit: params.unit,
    cost_price: effectiveCostPrice,
    selling_price: params.selling_price,
    description: params.description || null,
    is_active: params.is_active,
    serial_required: params.serial_required ?? false,
    warranty_days: params.warranty_days ?? null,
    ...(params.image_url !== undefined && { image_url: params.image_url }),
  }

  let productId: string

  if (params.id) {
    const { error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', params.id)
    if (error) {
      if (error.code === '23505') return { error: 'A product with that SKU already exists.' }
      return { error: error.message }
    }
    productId = params.id
  } else {
    const { data, error } = await supabase
      .from('products')
      .insert({ ...payload, org_id: ORG_ID })
      .select('id')
      .single()
    if (error) {
      if (error.code === '23505') return { error: 'A product with that SKU already exists.' }
      return { error: error.message }
    }
    productId = data.id
  }

  // Replace product_suppliers rows
  await supabase.from('product_suppliers').delete().eq('product_id', productId)

  if (supplierRows.length > 0) {
    const cheapestCost = effectiveCostPrice
    const { error: psErr } = await supabase.from('product_suppliers').insert(
      supplierRows.map((s) => ({
        product_id: productId,
        supplier_id: s.supplier_id,
        cost_price: s.cost_price,
        is_default: s.cost_price === cheapestCost,
      }))
    )
    if (psErr) return { error: psErr.message }

    // Add mode only: set opening stock per supplier at shared branch
    const effectiveBranchId = params.opening_stock_branch_id || (profile as any).branch_id
    if (!params.id && effectiveBranchId) {
      const branchId = effectiveBranchId
      for (const s of supplierRows) {
        const qty = s.stock_qty ?? 0
        if (qty <= 0) continue

        // Upsert product_supplier_stock
        const { data: existingPss } = await supabase
          .from('product_supplier_stock')
          .select('quantity')
          .eq('product_id', productId)
          .eq('supplier_id', s.supplier_id)
          .eq('branch_id', branchId)
          .single()

        if (existingPss) {
          await supabase
            .from('product_supplier_stock')
            .update({ quantity: existingPss.quantity + qty, updated_at: new Date().toISOString() })
            .eq('product_id', productId)
            .eq('supplier_id', s.supplier_id)
            .eq('branch_id', branchId)
        } else {
          await supabase.from('product_supplier_stock').insert({
            product_id: productId,
            supplier_id: s.supplier_id,
            branch_id: branchId,
            quantity: qty,
          })
        }

        // Update total inventory
        const { data: inv } = await supabase
          .from('inventory')
          .select('id, quantity')
          .eq('product_id', productId)
          .eq('branch_id', branchId)
          .single()

        if (inv) {
          await supabase
            .from('inventory')
            .update({ quantity: inv.quantity + qty, updated_at: new Date().toISOString() })
            .eq('id', inv.id)
        } else {
          await supabase.from('inventory').insert({
            product_id: productId,
            branch_id: branchId,
            quantity: qty,
            low_stock_threshold: 10,
          })
        }

        // Log inventory movement
        await supabase.from('inventory_movements').insert({
          product_id: productId,
          branch_id: branchId,
          type: 'purchase' as const,
          quantity: qty,
          notes: 'Opening stock',
          created_by: profile.id,
        })
      }
    }
  }

  revalidateTag(CACHE_TAGS.PRODUCTS, {})
  revalidatePath('/inventory/products')
  return { id: productId }
}

export async function deleteProduct(id: string): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidateTag(CACHE_TAGS.PRODUCTS, {})
  revalidatePath('/inventory/products')
}

export async function toggleProductActive(id: string, isActive: boolean): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidateTag(CACHE_TAGS.PRODUCTS, {})
  revalidatePath('/inventory/products')
}

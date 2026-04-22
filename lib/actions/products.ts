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
  unit: string
  cost_price: number
  selling_price: number
  description?: string
  is_active: boolean
}): Promise<{ id: string }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()
  const payload = {
    name: params.name,
    sku: params.sku,
    barcode: params.barcode || null,
    category_id: params.category_id || null,
    unit: params.unit,
    cost_price: params.cost_price,
    selling_price: params.selling_price,
    description: params.description || null,
    is_active: params.is_active,
  }

  let productId: string

  if (params.id) {
    const { error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', params.id)
    if (error) throw new Error(error.message)
    productId = params.id
  } else {
    const { data, error } = await supabase
      .from('products')
      .insert({ ...payload, org_id: ORG_ID })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    productId = data.id
  }

  revalidateTag(CACHE_TAGS.PRODUCTS, {})
  revalidatePath('/inventory/products')
  return { id: productId }
}

export async function deleteProduct(id: string): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()
  const { error } = await supabase
    .from('products')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidateTag(CACHE_TAGS.PRODUCTS, {})
  revalidatePath('/inventory/products')
}

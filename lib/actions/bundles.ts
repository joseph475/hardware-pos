'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { revalidateTag, revalidatePath } from 'next/cache'
import type { Database } from '@/types/database'
import { CACHE_TAGS } from '@/lib/cache-tags'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function requireManagerOrOwner() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_user_id', userId)
    .single()
  if (!profile || !['manager', 'owner'].includes(profile.role)) {
    throw new Error('Forbidden')
  }
  return profile
}

export type BundleWithItems = {
  id: string
  org_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  items: Array<{
    id: string
    product_id: string
    product_name: string
    quantity: number
  }>
}

export async function getBundles(): Promise<BundleWithItems[]> {
  const supabase = getAdminClient()

  const { data: bundles, error } = await supabase
    .from('bundles')
    .select('*')
    .eq('org_id', ORG_ID)
    .order('name')

  if (error) throw new Error(error.message)
  if (!bundles || bundles.length === 0) return []

  const bundleIds = (bundles as any[]).map((b) => b.id as string)

  const { data: items } = await supabase
    .from('bundle_items')
    .select('id, bundle_id, product_id, quantity, products(name)')
    .in('bundle_id', bundleIds)

  const itemsMap = new Map<string, BundleWithItems['items']>()
  for (const item of (items ?? []) as any[]) {
    if (!itemsMap.has(item.bundle_id)) itemsMap.set(item.bundle_id, [])
    itemsMap.get(item.bundle_id)!.push({
      id: item.id,
      product_id: item.product_id,
      product_name: item.products?.name ?? 'Unknown',
      quantity: item.quantity,
    })
  }

  return (bundles as any[]).map((b) => ({
    ...b,
    items: itemsMap.get(b.id) ?? [],
  }))
}

export async function createBundle(params: {
  name: string
  description?: string | null
  price: number
  image_url?: string | null
  items: Array<{ product_id: string; quantity: number }>
}): Promise<void> {
  await requireManagerOrOwner()
  const supabase = getAdminClient()

  const { data: bundle, error: bundleError } = await supabase
    .from('bundles')
    .insert({
      org_id: ORG_ID,
      name: params.name,
      description: params.description ?? null,
      price: params.price,
      image_url: params.image_url ?? null,
    })
    .select('id')
    .single()

  if (bundleError || !bundle) throw new Error(bundleError?.message ?? 'Failed to create bundle')

  const { error: itemsError } = await supabase.from('bundle_items').insert(
    params.items.map((item) => ({
      bundle_id: (bundle as any).id,
      product_id: item.product_id,
      quantity: item.quantity,
    }))
  )
  if (itemsError) throw new Error(itemsError.message)

  revalidateTag(CACHE_TAGS.BUNDLES, {})
  revalidatePath('/inventory/bundles')
}

export async function updateBundle(
  id: string,
  params: {
    name: string
    description?: string | null
    price: number
    image_url?: string | null
    items: Array<{ product_id: string; quantity: number }>
  }
): Promise<void> {
  await requireManagerOrOwner()
  const supabase = getAdminClient()

  const { error: bundleError } = await supabase
    .from('bundles')
    .update({
      name: params.name,
      description: params.description ?? null,
      price: params.price,
      image_url: params.image_url ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', ORG_ID)

  if (bundleError) throw new Error(bundleError.message)

  await supabase.from('bundle_items').delete().eq('bundle_id', id)

  const { error: itemsError } = await supabase.from('bundle_items').insert(
    params.items.map((item) => ({
      bundle_id: id,
      product_id: item.product_id,
      quantity: item.quantity,
    }))
  )
  if (itemsError) throw new Error(itemsError.message)

  revalidateTag(CACHE_TAGS.BUNDLES, {})
  revalidatePath('/inventory/bundles')
}

export async function toggleBundleActive(id: string, isActive: boolean): Promise<void> {
  await requireManagerOrOwner()
  const supabase = getAdminClient()

  const { error } = await supabase
    .from('bundles')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', ORG_ID)

  if (error) throw new Error(error.message)

  revalidateTag(CACHE_TAGS.BUNDLES, {})
  revalidatePath('/inventory/bundles')
}

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

export async function upsertCategory(params: {
  id?: string
  name: string
}): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()
  if (params.id) {
    const { error } = await supabase
      .from('categories')
      .update({ name: params.name })
      .eq('id', params.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('categories')
      .insert({ name: params.name, org_id: ORG_ID })
    if (error) throw new Error(error.message)
  }

  revalidateTag(CACHE_TAGS.CATEGORIES, {})
  revalidatePath('/settings/categories')
}

export async function deleteCategory(id: string): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidateTag(CACHE_TAGS.CATEGORIES, {})
  revalidatePath('/settings/categories')
}

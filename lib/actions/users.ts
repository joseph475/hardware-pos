'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import type { Profile, Branch } from '@/types/database'
import { CACHE_TAGS } from '@/lib/cache-tags'

// Service role client — bypasses RLS. Not typed with Database generic to avoid
// compatibility issues with the hand-authored Database type (missing Relationships).
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type UserWithBranch = Profile & {
  branches: { name: string } | null
}

export async function getMyProfile(): Promise<{ profile: Profile | null; branch: Branch | null }> {
  const { userId } = await auth()
  if (!userId) return { profile: null, branch: null }

  const supabase = getAdminClient()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('clerk_user_id', userId)
    .single()

  const profile = (profileData as Profile | null) ?? null

  let branch: Branch | null = null
  if (profile?.branch_id) {
    const { data: branchData } = await supabase
      .from('branches')
      .select('*')
      .eq('id', profile.branch_id)
      .single()
    branch = (branchData as Branch | null) ?? null
  }

  return { profile, branch }
}

export async function assignUserBranch(params: {
  profileId: string
  branchId: string | null
  role: 'owner' | 'manager' | 'cashier'
}): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()
  const { error } = await supabase
    .from('profiles')
    .update({
      branch_id: params.role === 'owner' ? null : params.branchId,
      role: params.role,
    })
    .eq('id', params.profileId)

  if (error) throw new Error(error.message)
  revalidateTag(CACHE_TAGS.USERS, {})
  revalidatePath('/settings/users')
}

const getAllUsersCached = unstable_cache(
  async (): Promise<UserWithBranch[]> => {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('*, branches(name)')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []) as UserWithBranch[]
  },
  ['users'],
  { tags: [CACHE_TAGS.USERS] }
)

export async function getAllUsers(): Promise<UserWithBranch[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  return getAllUsersCached()
}

const getAllBranchesCached = unstable_cache(
  async (): Promise<Branch[]> => {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('branches')
      .select('*')
      .eq('is_active', true)
      .order('name')
    return (data ?? []) as Branch[]
  },
  ['branches'],
  { tags: [CACHE_TAGS.BRANCHES] }
)

export async function getAllBranches(): Promise<Branch[]> {
  return getAllBranchesCached()
}

export async function upsertBranch(params: {
  id?: string
  name: string
  address: string
  phone: string
  timezone: string
  is_active: boolean
}): Promise<void> {
  const supabase = getAdminClient()
  const orgId = '00000000-0000-0000-0000-000000000001'
  if (params.id) {
    const { error } = await supabase
      .from('branches')
      .update({
        name: params.name,
        address: params.address || null,
        phone: params.phone || null,
        timezone: params.timezone,
        is_active: params.is_active,
      })
      .eq('id', params.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('branches')
      .insert({
        org_id: orgId,
        name: params.name,
        address: params.address || null,
        phone: params.phone || null,
        timezone: params.timezone,
        is_active: params.is_active,
      })
    if (error) throw new Error(error.message)
  }
  revalidateTag(CACHE_TAGS.BRANCHES, {})
  revalidatePath('/settings/branches')
}

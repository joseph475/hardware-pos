'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { createHash } from 'crypto'
import type { Database } from '@/types/database'
import { CACHE_TAGS } from '@/lib/cache-tags'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const getOrgSettingsCached = unstable_cache(
  async () => {
    const supabase = getAdminClient()
    const { data } = await supabase
      .from('organizations')
      .select('currency_code, currency_locale, tax_rate, gcash_qr_url, maya_qr_url, receipt_header, receipt_footer, max_cashier_discount_pct, manager_override_pin')
      .eq('id', ORG_ID)
      .single()
    return data ?? {
      currency_code: 'USD',
      currency_locale: 'en-US',
      tax_rate: 0.12,
      gcash_qr_url: null,
      maya_qr_url: null,
      receipt_header: null,
      receipt_footer: null,
      max_cashier_discount_pct: 20,
      manager_override_pin: null,
    }
  },
  ['org-settings'],
  { tags: [CACHE_TAGS.ORG_SETTINGS] }
)

export async function getOrgSettings() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const raw = await getOrgSettingsCached()
  // Never expose the PIN hash to the client — return a boolean indicator instead
  const { manager_override_pin, ...rest } = raw
  return { ...rest, has_manager_pin: manager_override_pin !== null }
}

export async function updateOrgSettings(settings: {
  currency_code: string
  currency_locale: string
  tax_rate: number
}) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  // Only owner may update currency/tax settings
  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()

  if (profile?.role !== 'owner') throw new Error('Forbidden')

  const { error: updateError } = await supabase
    .from('organizations')
    .update(settings)
    .eq('id', ORG_ID)

  if (updateError) throw new Error(updateError.message)

  revalidateTag(CACHE_TAGS.ORG_SETTINGS, {})
  revalidatePath('/settings/organization')
}

function hashPin(pin: string): string {
  return createHash('sha256').update(ORG_ID + pin).digest('hex')
}

export async function setManagerOverridePin(pin: string): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()

  if (!profile || !['owner', 'manager'].includes(profile.role)) {
    throw new Error('Forbidden')
  }

  // Empty string = clear the PIN
  if (pin !== '' && (!/^\d{4,6}$/.test(pin))) {
    throw new Error('PIN must be 4–6 digits')
  }

  const hashed = pin === '' ? null : hashPin(pin)

  const { error } = await supabase
    .from('organizations')
    .update({ manager_override_pin: hashed })
    .eq('id', ORG_ID)

  if (error) throw new Error(error.message)

  revalidateTag(CACHE_TAGS.ORG_SETTINGS, {})
  revalidatePath('/settings/organization')
}

export async function verifyManagerOverridePin(pin: string): Promise<boolean> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data } = await supabase
    .from('organizations')
    .select('manager_override_pin')
    .eq('id', ORG_ID)
    .single()

  if (!data?.manager_override_pin) return false
  return hashPin(pin) === data.manager_override_pin
}

export async function updateQRSettings(settings: {
  gcash_qr_url: string | null
  maya_qr_url: string | null
}) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()

  if (profile?.role !== 'owner') throw new Error('Forbidden')

  const { error: updateError } = await supabase
    .from('organizations')
    .update(settings)
    .eq('id', ORG_ID)

  if (updateError) throw new Error(updateError.message)

  revalidateTag(CACHE_TAGS.ORG_SETTINGS, {})
  revalidatePath('/settings/organization')
  revalidatePath('/pos')
}

export async function uploadQrImage(formData: FormData, type: 'gcash' | 'maya'): Promise<string> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()

  if (profile?.role !== 'owner') throw new Error('Forbidden')

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) throw new Error('No file provided')
  if (file.size > 2 * 1024 * 1024) throw new Error('File must be under 2 MB')

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${ORG_ID}/${type}-qr.${ext}`

  const { error } = await supabase.storage
    .from('qr-images')
    .upload(path, file, { contentType: file.type, upsert: true })

  if (error) throw new Error(error.message)

  const { data: { publicUrl } } = supabase.storage.from('qr-images').getPublicUrl(path)

  // Immediately persist the URL to the DB and bust the cache so all pages see it
  const column = type === 'gcash' ? 'gcash_qr_url' : 'maya_qr_url'
  const { error: updateError } = await supabase
    .from('organizations')
    .update({ [column]: publicUrl })
    .eq('id', ORG_ID)
  if (updateError) throw new Error(updateError.message)

  revalidateTag(CACHE_TAGS.ORG_SETTINGS, {})
  revalidatePath('/settings/organization')
  revalidatePath('/pos')

  return publicUrl
}

export async function updateOwnerSettings(settings: {
  receipt_header: string | null
  receipt_footer: string | null
  max_cashier_discount_pct: number
}) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()

  if (profile?.role !== 'owner') throw new Error('Forbidden')

  const { error: updateError } = await supabase
    .from('organizations')
    .update(settings)
    .eq('id', ORG_ID)

  if (updateError) throw new Error(updateError.message)

  revalidateTag(CACHE_TAGS.ORG_SETTINGS, {})
  revalidatePath('/settings/organization')
}

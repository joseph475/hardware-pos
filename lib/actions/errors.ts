'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import type { Database } from '@/types/database'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function logError(data: {
  message: string
  stack?: string
  context?: string
  url?: string
}) {
  try {
    const { userId } = await auth()
    const supabase = getAdminClient()
    await supabase.from('error_logs').insert({
      org_id: ORG_ID,
      user_id: userId ?? null,
      message: data.message,
      stack: data.stack ?? null,
      context: data.context ?? null,
      url: data.url ?? null,
    } as any)
  } catch {
    // Silently swallow — logging failure must not affect the user
  }
}

export async function getErrorLogs(limit = 200) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('error_logs' as any)
    .select('*')
    .eq('org_id', ORG_ID)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as {
    id: string
    user_id: string | null
    message: string
    stack: string | null
    context: string | null
    url: string | null
    created_at: string
  }[]
}

'use server'

import { clerkClient } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type DemoRole = 'owner' | 'manager' | 'manager2' | 'manager3' | 'cashier' | 'cashier2' | 'cashier3'

const ROLE_EMAIL: Record<DemoRole, string | undefined> = {
  owner:    process.env.DEMO_OWNER_EMAIL,
  manager:  process.env.DEMO_MANAGER_EMAIL,
  manager2: process.env.DEMO_MANAGER2_EMAIL,
  manager3: process.env.DEMO_MANAGER3_EMAIL,
  cashier:  process.env.DEMO_CASHIER_EMAIL,
  cashier2: process.env.DEMO_CASHIER2_EMAIL,
  cashier3: process.env.DEMO_CASHIER3_EMAIL,
}

export async function getDemoSignInUrl(role: DemoRole): Promise<string> {
  if (process.env.NEXT_PUBLIC_DEMO_MODE?.trim() !== 'true') {
    throw new Error('Demo mode is not enabled')
  }

  const email = ROLE_EMAIL[role]?.trim()
  if (!email) throw new Error(`Demo email not configured for role: ${role}`)

  const client = await clerkClient()
  const { data: users } = await client.users.getUserList({ emailAddress: [email] })
  const user = users[0]
  if (!user) throw new Error(`Demo account not found in Clerk: ${email}`)

  const { token } = await client.signInTokens.createSignInToken({
    userId: user.id,
    expiresInSeconds: 60,
  })

  return `/sign-in?__clerk_ticket=${token}`
}

export type DemoBranchNames = Record<DemoRole, string>

export async function getDemoBranchNames(): Promise<DemoBranchNames> {
  const supabase = getAdminClient()
  const emails = Object.values(ROLE_EMAIL).filter(Boolean) as string[]

  const { data: profiles } = await supabase
    .from('profiles')
    .select('email, branch_id')
    .in('email', emails)

  const branchIds = [...new Set((profiles ?? []).map((p: any) => p.branch_id).filter(Boolean))]
  const { data: branches } = branchIds.length
    ? await supabase.from('branches').select('id, name').in('id', branchIds)
    : { data: [] }

  const branchMap = Object.fromEntries((branches ?? []).map((b: any) => [b.id, b.name]))
  const emailToProfile = Object.fromEntries((profiles ?? []).map((p: any) => [p.email, p]))

  const result = {} as DemoBranchNames
  for (const [role, email] of Object.entries(ROLE_EMAIL) as [DemoRole, string | undefined][]) {
    if (!email) { result[role] = 'Unknown'; continue }
    const profile = emailToProfile[email.trim()]
    result[role] = profile?.branch_id ? (branchMap[profile.branch_id] ?? 'Unknown') : 'All Branches'
  }
  return result
}

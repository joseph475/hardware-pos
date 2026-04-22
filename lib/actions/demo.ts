'use server'

import { clerkClient } from '@clerk/nextjs/server'

type DemoRole = 'owner' | 'manager' | 'cashier'

const ROLE_EMAIL: Record<DemoRole, string | undefined> = {
  owner: process.env.DEMO_OWNER_EMAIL,
  manager: process.env.DEMO_MANAGER_EMAIL,
  cashier: process.env.DEMO_CASHIER_EMAIL,
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

import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

// Use service role client (no RLS). Typed via explicit insert/update objects.
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface ClerkEmailAddress {
  id: string
  email_address: string
  verification: { status: string } | null
}

interface ClerkUserCreatedData {
  id: string
  first_name: string | null
  last_name: string | null
  email_addresses: ClerkEmailAddress[]
  primary_email_address_id: string | null
}

interface ClerkUserUpdatedData {
  id: string
  first_name: string | null
  last_name: string | null
  email_addresses: ClerkEmailAddress[]
  primary_email_address_id: string | null
}

function getPrimaryEmail(
  emailAddresses: ClerkEmailAddress[],
  primaryEmailId: string | null
): string {
  if (primaryEmailId) {
    const match = emailAddresses.find((e) => e.id === primaryEmailId)
    if (match) return match.email_address
  }
  return emailAddresses[0]?.email_address ?? ''
}

function buildFullName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(' ')
}

export async function POST(req: Request) {
  const headersList = await headers()

  const svixId = headersList.get('svix-id')
  const svixTimestamp = headersList.get('svix-timestamp')
  const svixSignature = headersList.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    console.error('CLERK_WEBHOOK_SECRET is not set')
    return new Response('Webhook secret not configured', { status: 500 })
  }

  let payload: string
  try {
    payload = await req.text()
  } catch {
    return new Response('Failed to read request body', { status: 400 })
  }

  const wh = new Webhook(secret)
  let event: { type: string; data: Record<string, unknown> }

  try {
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: Record<string, unknown> }
  } catch (err) {
    console.error('Svix signature verification failed:', err)
    return new Response('Invalid signature', { status: 400 })
  }

  const supabase = getAdminClient()

  try {
    if (event.type === 'user.created') {
      const data = event.data as unknown as ClerkUserCreatedData

      const fullName = buildFullName(data.first_name, data.last_name)
      const email = getPrimaryEmail(data.email_addresses, data.primary_email_address_id)

      const { error } = await supabase.from('profiles').insert({
        clerk_user_id: data.id,
        full_name: fullName,
        email: email,
        org_id: ORG_ID,
        role: 'cashier',
        branch_id: null,
      })

      if (error) {
        console.error('Error inserting profile:', error)
        return new Response('Database error on user.created', { status: 500 })
      }

      console.log(`Profile created for Clerk user: ${data.id}`)
    }

    if (event.type === 'user.updated') {
      const data = event.data as unknown as ClerkUserUpdatedData

      const fullName = buildFullName(data.first_name, data.last_name)
      const email = getPrimaryEmail(data.email_addresses, data.primary_email_address_id)

      console.log(`[Webhook] user.updated received for ${data.id}`)
      console.log(`[Webhook] Updating profile: full_name="${fullName}", email="${email}"`)

      const { error, data: updateResult } = await supabase
        .from('profiles')
        .update({ full_name: fullName, email: email })
        .eq('clerk_user_id', data.id)
        .select()

      if (error) {
        console.error('[Webhook] Error updating profile:', error)
        return new Response('Database error on user.updated', { status: 500 })
      }

      if (!updateResult || updateResult.length === 0) {
        console.warn(`[Webhook] No profile found for clerk_user_id: ${data.id}`)
        return new Response('Profile not found', { status: 404 })
      }

      console.log(`[Webhook] Profile updated successfully for Clerk user: ${data.id}`, updateResult)
    }
  } catch (err) {
    console.error('Unexpected error handling webhook:', err)
    return new Response('Internal server error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
}

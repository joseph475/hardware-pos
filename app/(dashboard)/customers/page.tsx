import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { Customer } from '@/types/database'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { CustomersClient } from './customers-client'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ORG_ID = '00000000-0000-0000-0000-000000000001'

export default async function CustomersPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = getAdminClient()
  const { data } = await supabase
    .from('customers')
    .select('*')
    .eq('org_id', ORG_ID)
    .order('name')

  const customers = (data ?? []) as Customer[]
  return <CustomersClient initialCustomers={customers} />
}

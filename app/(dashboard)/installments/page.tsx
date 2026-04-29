import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getInstallmentPlans } from '@/lib/actions/installments'
import { InstallmentsClient } from './installments-client'

export const dynamic = 'force-dynamic'

export default async function InstallmentsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('clerk_user_id', userId)
    .single()

  const role = (profileData as any)?.role ?? 'cashier'
  const plans = await getInstallmentPlans()

  return <InstallmentsClient initialPlans={plans} userRole={role} />
}

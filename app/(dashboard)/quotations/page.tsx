import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { getQuotations } from '@/lib/actions/quotations'
import { QuotationsClient } from './quotations-client'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function QuotationsPage() {
  const { userId } = await auth()

  let userRole: 'owner' | 'manager' | 'cashier' = 'cashier'
  let userBranchId: string | null = null

  if (userId) {
    const supabase = getAdminClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, branch_id')
      .eq('clerk_user_id', userId)
      .single()
    userRole = profile?.role ?? 'cashier'
    userBranchId = profile?.branch_id ?? null
  }

  const supabase = getAdminClient()

  const [quotations, customersResult, branchesResult, productsResult] = await Promise.all([
    getQuotations(),
    supabase
      .from('customers')
      .select('id, name, company_name')
      .eq('org_id', '00000000-0000-0000-0000-000000000001')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('branches')
      .select('id, name')
      .eq('org_id', '00000000-0000-0000-0000-000000000001')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('products')
      .select('id, name, sku, selling_price')
      .eq('org_id', '00000000-0000-0000-0000-000000000001')
      .eq('is_active', true)
      .order('name'),
  ])

  const customers = (customersResult.data ?? []) as Array<{
    id: string
    name: string
    company_name: string | null
  }>

  const branches = (branchesResult.data ?? []) as Array<{
    id: string
    name: string
  }>

  const products = (productsResult.data ?? []) as Array<{
    id: string
    name: string
    sku: string
    selling_price: number
  }>

  return (
    <QuotationsClient
      initialQuotations={quotations}
      customers={customers}
      branches={branches}
      products={products}
      userRole={userRole}
      userBranchId={userBranchId}
    />
  )
}

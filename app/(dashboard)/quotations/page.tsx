import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
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

  const [quotations, customersResult, productsResult, orgResult] = await Promise.all([
    getQuotations(userBranchId ? { branchId: userBranchId } : undefined),
    supabase
      .from('customers')
      .select('id, name, company_name')
      .eq('org_id', '00000000-0000-0000-0000-000000000001')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('products')
      .select('id, name, sku, selling_price, serial_required, image_url')
      .eq('org_id', '00000000-0000-0000-0000-000000000001')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('organizations')
      .select('name, company_name, address_1, address_2')
      .eq('id', '00000000-0000-0000-0000-000000000001')
      .single(),
  ])

  const customers = (customersResult.data ?? []) as Array<{
    id: string
    name: string
    company_name: string | null
  }>

  const products = (productsResult.data ?? []) as Array<{
    id: string
    name: string
    sku: string
    selling_price: number
    serial_required: boolean
    image_url: string | null
  }>

  const org = {
    name: orgResult.data?.name ?? '',
    company_name: orgResult.data?.company_name ?? null,
    address_1: orgResult.data?.address_1 ?? null,
    address_2: orgResult.data?.address_2 ?? null,
  }

  return (
    <QuotationsClient
      initialQuotations={quotations}
      customers={customers}
      products={products}
      org={org}
    />
  )
}

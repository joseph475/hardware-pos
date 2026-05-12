import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { QuotationFormClient } from '../components/quotation-form-client'
import { getPOSBundles } from '@/lib/actions/inventory'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface Props {
  searchParams: Promise<{ customer_id?: string }>
}

export default async function NewQuotationPage({ searchParams }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { customer_id } = await searchParams

  // Redirect back if no customer selected
  if (!customer_id) redirect('/quotations')

  const supabase = getAdminClient()

  const [profileResult, branchesResult, productsResult, customerResult, bundles] = await Promise.all([
    supabase.from('profiles').select('role, branch_id').eq('clerk_user_id', userId).single(),
    supabase
      .from('branches')
      .select('id, name')
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
      .from('customers')
      .select('id, name, company_name')
      .eq('id', customer_id)
      .eq('org_id', '00000000-0000-0000-0000-000000000001')
      .eq('is_active', true)
      .single(),
    getPOSBundles(null),
  ])

  const userRole = (profileResult.data?.role ?? 'cashier') as 'owner' | 'manager' | 'cashier'

  let userBranchId = profileResult.data?.branch_id ?? null
  if (userRole === 'owner') {
    const { data: mainBranch } = await supabase
      .from('branches')
      .select('id')
      .eq('org_id', '00000000-0000-0000-0000-000000000001')
      .eq('is_main', true)
      .single()
    userBranchId = mainBranch?.id ?? null
  }
  const customerData = customerResult.data
  if (!customerData) redirect('/quotations')

  const customers = [{ id: customerData.id, name: customerData.name, company_name: customerData.company_name }]
  const branches = (branchesResult.data ?? []) as Array<{ id: string; name: string }>
  const products = (productsResult.data ?? []) as Array<{
    id: string
    name: string
    sku: string
    selling_price: number
    serial_required: boolean
    image_url: string | null
  }>

  return (
    <QuotationFormClient
      customers={customers}
      branches={branches}
      products={products}
      bundles={bundles}
      preselectedCustomerId={customer_id}
      userBranchId={userBranchId}
    />
  )
}

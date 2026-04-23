import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'
import { getQuotationById } from '@/lib/actions/quotations'
import { QuotationFormClient } from '../../components/quotation-form-client'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditQuotationPage({ params }: Props) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params
  const supabase = getAdminClient()

  const [profileResult, quotation, branchesResult, productsResult, customersResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, branch_id')
      .eq('clerk_user_id', userId)
      .single(),
    getQuotationById(id),
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
      .eq('org_id', '00000000-0000-0000-0000-000000000001')
      .eq('is_active', true)
      .order('name'),
  ])

  const userRole = (profileResult.data?.role ?? 'cashier') as 'owner' | 'manager' | 'cashier'
  const userBranchId = profileResult.data?.branch_id ?? null

  if (!quotation) notFound()
  if (quotation.status !== 'draft') redirect('/quotations')

  // Non-owner roles can only edit quotations belonging to their branch
  if (userRole !== 'owner' && userBranchId && quotation.branch_id !== userBranchId) {
    notFound()
  }

  const customers = (customersResult.data ?? []) as Array<{
    id: string
    name: string
    company_name: string | null
  }>

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
      quotation={quotation}
      customers={customers}
      branches={branches}
      products={products}
      userRole={userRole}
      userBranchId={userBranchId}
    />
  )
}

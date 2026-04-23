'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { Database } from '@/types/database'
import type { Customer } from '@/types/database'
import { CACHE_TAGS } from '@/lib/cache-tags'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

const ORG_ID = '00000000-0000-0000-0000-000000000001'

export async function getCustomers(): Promise<Customer[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('org_id', ORG_ID)
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []) as Customer[]
}

export async function upsertCustomer(params: {
  id?: string
  name: string
  email?: string
  phone?: string
  address?: string
  company_name?: string
  tax_id?: string
  notes?: string
  is_active?: boolean
}): Promise<{ id: string }> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const payload = {
    name: params.name,
    email: params.email || null,
    phone: params.phone || null,
    address: params.address || null,
    company_name: params.company_name || null,
    tax_id: params.tax_id || null,
    notes: params.notes || null,
    is_active: params.is_active ?? true,
  }

  if (params.id) {
    const { error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', params.id)
    if (error) throw new Error(error.message)
    revalidateTag(CACHE_TAGS.CUSTOMERS, {})
    revalidatePath('/customers')
    return { id: params.id }
  } else {
    const { data, error } = await supabase
      .from('customers')
      .insert({ ...payload, org_id: ORG_ID })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    revalidateTag(CACHE_TAGS.CUSTOMERS, {})
    revalidatePath('/customers')
    return { id: (data as { id: string }).id }
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  // Guard: check for quotations
  const { count: quotationCount } = await supabase
    .from('quotations')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', id)

  // Guard: check for transactions
  const { count: transactionCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', id)

  if ((quotationCount ?? 0) > 0 || (transactionCount ?? 0) > 0) {
    throw new Error('Cannot delete customer with existing records. Deactivate instead.')
  }

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidateTag(CACHE_TAGS.CUSTOMERS, {})
  revalidatePath('/customers')
}

export async function toggleCustomerActive(id: string, isActive: boolean): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { error } = await supabase
    .from('customers')
    .update({ is_active: isActive })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidateTag(CACHE_TAGS.CUSTOMERS, {})
  revalidatePath('/customers')
}

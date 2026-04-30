'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import type { Database } from '@/types/database'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getProfile() {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const supabase = getAdminClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_user_id', userId)
    .single()
  if (error || !profile) throw new Error('Profile not found')
  return profile as { id: string; role: string }
}

export type InstallmentPlanRow = {
  id: string
  transaction_id: string
  downpayment: number
  hc_amount: number
  terms: number
  status: 'pending' | 'received'
  received_at: string | null
  hc_account_number: string | null
  installment_company: string | null
  created_at: string
  customer_name: string | null
  sale_total: number
  transaction_date: string
}

export async function getInstallmentPlans(filter?: 'pending' | 'received'): Promise<InstallmentPlanRow[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  let query = supabase
    .from('installment_plans')
    .select('*')
    .eq('org_id', ORG_ID)
    .order('created_at', { ascending: false })

  if (filter) {
    query = query.eq('status', filter)
  }

  const { data: plans, error } = await query
  if (error) throw new Error(error.message)
  if (!plans || plans.length === 0) return []

  const transactionIds = (plans as any[]).map((p) => p.transaction_id)

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, total, created_at, customer_id')
    .in('id', transactionIds)

  const txMap = new Map<string, { total: number; created_at: string; customer_id: string | null }>()
  for (const tx of (transactions as any[]) ?? []) {
    txMap.set(tx.id, { total: tx.total, created_at: tx.created_at, customer_id: tx.customer_id })
  }

  const customerIds = [...new Set(
    (transactions as any[])?.map((t) => t.customer_id).filter(Boolean) ?? []
  )]

  const customerMap = new Map<string, string>()
  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name')
      .in('id', customerIds)
    for (const c of (customers as any[]) ?? []) {
      customerMap.set(c.id, c.name)
    }
  }

  return (plans as any[]).map((plan) => {
    const tx = txMap.get(plan.transaction_id)
    return {
      id: plan.id,
      transaction_id: plan.transaction_id,
      downpayment: plan.downpayment,
      hc_amount: plan.hc_amount,
      terms: plan.terms,
      status: plan.status,
      received_at: plan.received_at,
      hc_account_number: plan.hc_account_number ?? null,
      installment_company: plan.installment_company ?? null,
      created_at: plan.created_at,
      customer_name: tx?.customer_id ? (customerMap.get(tx.customer_id) ?? null) : null,
      sale_total: tx?.total ?? 0,
      transaction_date: tx?.created_at ?? plan.created_at,
    }
  })
}

export async function markInstallmentReceived(planId: string): Promise<void> {
  const profile = await getProfile()
  if (profile.role === 'cashier') throw new Error('Unauthorized: only managers and owners can mark installments as received')

  const supabase = getAdminClient()

  const { error } = await supabase
    .from('installment_plans')
    .update({
      status: 'received',
      received_at: new Date().toISOString(),
      received_by: profile.id,
    })
    .eq('id', planId)
    .eq('org_id', ORG_ID)

  if (error) throw new Error(error.message)
  revalidatePath('/installments')
}

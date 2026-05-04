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

export type AREntry = {
  id: string
  transaction_id: string
  customer_name: string
  amount_due: number
  amount_paid: number
  balance: number
  notes: string | null
  created_at: string
  branch_name: string
  cashier_name: string
}

export async function getAREntries(): Promise<AREntry[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  const supabase = getAdminClient()

  const { data, error } = await supabase
    .from('accounts_receivable')
    .select('*, branch:branches!branch_id(name), cashier:profiles!cashier_id(full_name)')
    .eq('org_id', ORG_ID)
    .order('created_at', { ascending: false }) as any

  if (error) throw new Error(error.message)
  return (data ?? []).map((r: any) => ({
    id: r.id,
    transaction_id: r.transaction_id,
    customer_name: r.customer_name,
    amount_due: r.amount_due,
    amount_paid: r.amount_paid,
    balance: r.amount_due - r.amount_paid,
    notes: r.notes,
    created_at: r.created_at,
    branch_name: r.branch?.name ?? '—',
    cashier_name: r.cashier?.full_name ?? '—',
  }))
}

export async function recordARPayment(id: string, amount: number): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: entry, error: fetchError } = await supabase
    .from('accounts_receivable')
    .select('amount_due, amount_paid')
    .eq('id', id)
    .single()

  if (fetchError || !entry) throw new Error('AR entry not found')

  const remaining = (entry as any).amount_due - (entry as any).amount_paid
  if (amount <= 0 || amount > remaining + 0.005) throw new Error('Invalid payment amount')

  const { error } = await supabase
    .from('accounts_receivable')
    .update({ amount_paid: (entry as any).amount_paid + amount } as any)
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/accounts-receivable')
}

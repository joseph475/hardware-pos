'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import type { Database, Expense } from '@/types/database'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type ExpenseWithCreator = Expense & {
  creator: { full_name: string } | null
}

export async function getExpenses(): Promise<ExpenseWithCreator[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('expenses')
    .select('*, creator:profiles!created_by(full_name)')
    .eq('org_id', ORG_ID)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ExpenseWithCreator[]
}

export async function upsertExpense(params: {
  id?: string
  category: string
  date: string
  amount: number
  note?: string | null
}) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('clerk_user_id', userId)
    .single()
  if (!profile) throw new Error('Profile not found')

  if (params.id) {
    const { error } = await supabase
      .from('expenses')
      .update({
        category: params.category,
        date: params.date,
        amount: params.amount,
        note: params.note ?? null,
      })
      .eq('id', params.id)
      .eq('org_id', ORG_ID)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('expenses')
      .insert({
        org_id: ORG_ID,
        category: params.category,
        date: params.date,
        amount: params.amount,
        note: params.note ?? null,
        created_by: profile.id,
      })
    if (error) throw new Error(error.message)
  }

  revalidatePath('/expenses')
}

export async function deleteExpense(id: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('org_id', ORG_ID)
  if (error) throw new Error(error.message)

  revalidatePath('/expenses')
}

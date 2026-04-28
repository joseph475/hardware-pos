import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getExpenses } from '@/lib/actions/expenses'
import { ExpensesClient } from './expenses-client'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const expenses = await getExpenses()

  return <ExpensesClient initialExpenses={expenses} />
}

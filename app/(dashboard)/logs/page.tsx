import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getErrorLogs } from '@/lib/actions/errors'
import LogsClient from './logs-client'

export default async function LogsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const logs = await getErrorLogs(200)
  return <LogsClient initialLogs={logs} />
}

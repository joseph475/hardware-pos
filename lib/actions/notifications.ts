'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import type { Database } from '@/types/database'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type NotificationCounts = {
  draftPOs: number
  orderedPOs: number
  pendingTransfers: number
  pendingBranchRequests: number
  total: number
}

const EMPTY_COUNTS: NotificationCounts = {
  draftPOs: 0,
  orderedPOs: 0,
  pendingTransfers: 0,
  pendingBranchRequests: 0,
  total: 0,
}

export async function getMyNotificationCounts(): Promise<NotificationCounts> {
  const { userId } = await auth()
  if (!userId) return EMPTY_COUNTS

  const supabase = getAdminClient()

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('role, branch_id, branches(is_main)')
    .eq('clerk_user_id', userId)
    .single()

  const profile = profileRaw as any

  if (!profile || profile.role === 'cashier') return EMPTY_COUNTS

  const isMainBranch = profile.branches?.is_main === true
  const isGlobalView = profile.role === 'owner' || isMainBranch
  const branchId = profile.branch_id

  const [draftPORes, orderedPORes, transferRes, branchReqRes] = await Promise.all([
    isGlobalView
      ? supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'draft')
      : Promise.resolve({ count: 0 }),

    isGlobalView
      ? supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'ordered')
      : Promise.resolve({ count: 0 }),

    isGlobalView
      ? supabase.from('stock_transfers').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      : branchId
        ? supabase
            .from('stock_transfers')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending')
            .or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`)
        : Promise.resolve({ count: 0 }),

    isGlobalView
      ? supabase.from('branch_stock_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      : branchId
        ? supabase
            .from('branch_stock_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending')
            .eq('requesting_branch_id', branchId)
        : Promise.resolve({ count: 0 }),
  ])

  const draftPOs = draftPORes.count ?? 0
  const orderedPOs = orderedPORes.count ?? 0
  const pendingTransfers = transferRes.count ?? 0
  const pendingBranchRequests = branchReqRes.count ?? 0

  return {
    draftPOs,
    orderedPOs,
    pendingTransfers,
    pendingBranchRequests,
    total: draftPOs + orderedPOs + pendingTransfers + pendingBranchRequests,
  }
}

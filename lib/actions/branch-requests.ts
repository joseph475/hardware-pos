'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import type { BranchStockRequestWithRelations, BranchRequestStatus } from '@/types/database'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function createBranchStockRequest(params: {
  notes: string
  items: { productId: string; quantity: number }[]
}): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, branch_id, branches(is_main)')
    .eq('clerk_user_id', userId)
    .single()
  if (!profile) throw new Error('Profile not found')
  if (profile.role === 'cashier') throw new Error('Insufficient permissions')
  if (!profile.branch_id) throw new Error('No branch assigned')

  const branch = (profile.branches as any)
  if (branch?.is_main) throw new Error('Main branch must create supplier POs instead')

  const { data: request, error } = await supabase
    .from('branch_stock_requests')
    .insert({
      requesting_branch_id: profile.branch_id,
      notes: params.notes || null,
      created_by: profile.id,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error || !request) throw new Error(error?.message ?? 'Failed to create request')

  const { error: itemsError } = await supabase
    .from('branch_stock_request_items')
    .insert(
      params.items.map((item) => ({
        request_id: request.id,
        product_id: item.productId,
        quantity: item.quantity,
      }))
    )
  if (itemsError) throw new Error(itemsError.message)

  revalidatePath('/purchasing/branch-requests')
}

export async function getBranchStockRequests(params?: {
  branchId?: string | null
}): Promise<BranchStockRequestWithRelations[]> {
  const supabase = getAdminClient()

  let query = supabase
    .from('branch_stock_requests')
    .select(`
      *,
      requesting_branch:branches!requesting_branch_id(name),
      creator:profiles!created_by(full_name),
      branch_stock_request_items(
        id, product_id, quantity,
        product:products(name, sku)
      )
    `)
    .order('created_at', { ascending: false })

  if (params?.branchId) {
    query = query.eq('requesting_branch_id', params.branchId)
  }

  const { data } = await query
  return (data ?? []) as any[]
}

export async function updateBranchStockRequestStatus(
  requestId: string,
  status: BranchRequestStatus
): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_user_id', userId)
    .single()
  if (!profile) throw new Error('Profile not found')
  if (profile.role === 'cashier') throw new Error('Insufficient permissions')

  const { error } = await supabase
    .from('branch_stock_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', requestId)
  if (error) throw new Error(error.message)

  revalidatePath('/purchasing/branch-requests')
}

export async function fulfillBranchStockRequest(params: {
  requestId: string
  items: { productId: string; quantity: number }[]
  mainBranchId: string
}): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, branches(is_main)')
    .eq('clerk_user_id', userId)
    .single()
  if (!profile) throw new Error('Profile not found')
  if (profile.role === 'cashier') throw new Error('Insufficient permissions')
  const branch = (profile.branches as any)
  if (!branch?.is_main) throw new Error('Only main branch can fulfill requests')

  const { data: request } = await supabase
    .from('branch_stock_requests')
    .select('requesting_branch_id, status')
    .eq('id', params.requestId)
    .single()
  if (!request) throw new Error('Request not found')
  if (request.status !== 'pending') throw new Error('Request is not in pending state')

  // Create a stock transfer from main → requesting branch
  const { data: transfer, error: transferError } = await supabase
    .from('stock_transfers')
    .insert({
      from_branch_id: params.mainBranchId,
      to_branch_id: request.requesting_branch_id,
      notes: `Fulfills stock request ${params.requestId.slice(0, 8).toUpperCase()}`,
      created_by: profile.id,
      status: 'pending',
    })
    .select('id')
    .single()
  if (transferError || !transfer) throw new Error(transferError?.message ?? 'Failed to create transfer')

  const { error: itemsError } = await supabase
    .from('stock_transfer_items')
    .insert(
      params.items.map((item) => ({
        transfer_id: transfer.id,
        product_id: item.productId,
        quantity: item.quantity,
      }))
    )
  if (itemsError) throw new Error(itemsError.message)

  // Link transfer to request and mark in_progress
  const { error: updateError } = await supabase
    .from('branch_stock_requests')
    .update({
      status: 'in_progress',
      fulfillment_transfer_id: transfer.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.requestId)
  if (updateError) throw new Error(updateError.message)

  revalidatePath('/purchasing/branch-requests')
  revalidatePath('/inventory/transfers')
}

'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { Database } from '@/types/database'
import { CACHE_TAGS } from '@/lib/cache-tags'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function createTransfer(params: {
  fromBranchId: string
  toBranchId: string
  notes: string
  items: { productId: string; quantity: number }[]
}): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_user_id', userId)
    .single()
  if (!profile) throw new Error('Profile not found')

  const { data: transfer, error } = await supabase
    .from('stock_transfers')
    .insert({
      from_branch_id: params.fromBranchId,
      to_branch_id: params.toBranchId,
      notes: params.notes || null,
      created_by: profile.id,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error || !transfer) throw new Error(error?.message ?? 'Failed to create transfer')

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

  revalidatePath('/inventory/transfers')
}

export async function updateTransferStatus(params: {
  transferId: string
  status: 'approved' | 'in_transit' | 'completed' | 'cancelled'
}): Promise<void> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('clerk_user_id', userId)
    .single()
  if (!profile) throw new Error('Profile not found')
  if (profile.role === 'cashier') throw new Error('Insufficient permissions to update transfer status.')

  const { data: transfer, error: fetchError } = await supabase
    .from('stock_transfers')
    .select('*, stock_transfer_items(*)')
    .eq('id', params.transferId)
    .single() as any

  if (fetchError || !transfer) throw new Error('Transfer not found')

  const updateData: Record<string, unknown> = { status: params.status }
  if (params.status === 'approved') updateData.approved_by = profile.id

  const { error } = await supabase
    .from('stock_transfers')
    .update(updateData)
    .eq('id', params.transferId)

  if (error) throw new Error(error.message)

  // On completion: move stock between branches and log movements
  if (params.status === 'completed') {
    const items = transfer.stock_transfer_items as Array<{ product_id: string; quantity: number }>

    for (const item of items) {
      // Deduct from source
      const { data: fromRow } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('product_id', item.product_id)
        .eq('branch_id', transfer.from_branch_id)
        .single()

      if (fromRow) {
        await supabase
          .from('inventory')
          .update({ quantity: Math.max(0, fromRow.quantity - item.quantity) })
          .eq('product_id', item.product_id)
          .eq('branch_id', transfer.from_branch_id)
      }

      // Add to destination (upsert)
      const { data: toRow } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('product_id', item.product_id)
        .eq('branch_id', transfer.to_branch_id)
        .single()

      if (toRow) {
        await supabase
          .from('inventory')
          .update({ quantity: toRow.quantity + item.quantity })
          .eq('product_id', item.product_id)
          .eq('branch_id', transfer.to_branch_id)
      } else {
        await supabase.from('inventory').insert({
          product_id: item.product_id,
          branch_id: transfer.to_branch_id,
          quantity: item.quantity,
        })
      }

      // Log movements
      await supabase.from('inventory_movements').insert([
        {
          product_id: item.product_id,
          branch_id: transfer.from_branch_id,
          type: 'transfer_out' as const,
          quantity: item.quantity,
          reference_id: params.transferId,
          created_by: profile.id,
        },
        {
          product_id: item.product_id,
          branch_id: transfer.to_branch_id,
          type: 'transfer_in' as const,
          quantity: item.quantity,
          reference_id: params.transferId,
          created_by: profile.id,
        },
      ])
    }
  }

  if (params.status === 'completed') {
    revalidateTag(CACHE_TAGS.INVENTORY, {})
    revalidateTag(CACHE_TAGS.INVENTORY_MOVEMENTS, {})
  }
  revalidatePath('/inventory/transfers')
}

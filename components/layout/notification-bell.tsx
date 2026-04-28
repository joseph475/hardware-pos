'use client'

import { useEffect, useState } from 'react'
import { Bell, ShoppingCart, ArrowLeftRight, Package } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getMyNotificationCounts } from '@/lib/actions/notifications'
import type { NotificationCounts } from '@/lib/actions/notifications'

const POLL_INTERVAL_MS = 30_000

export function NotificationBell({ initialCounts }: { initialCounts: NotificationCounts }) {
  const [counts, setCounts] = useState<NotificationCounts>(initialCounts)

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null

    function startPolling() {
      id = setInterval(async () => {
        try {
          const fresh = await getMyNotificationCounts()
          setCounts(fresh)
        } catch {
          // keep stale counts on error
        }
      }, POLL_INTERVAL_MS)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        if (id !== null) { clearInterval(id); id = null }
      } else {
        getMyNotificationCounts().then(setCounts).catch(() => {})
        startPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      if (id !== null) clearInterval(id)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const hasPOs = counts.draftPOs > 0 || counts.orderedPOs > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Notifications${counts.total > 0 ? ` (${counts.total})` : ''}`}
          />
        }
      >
        <div className="relative">
          <Bell className="h-5 w-5" />
          {counts.total > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
              {counts.total > 9 ? '9+' : counts.total}
            </span>
          )}
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        {/* Plain div — GroupLabel requires a Group parent, so use a div for the header */}
        <div className="px-1.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Notifications
        </div>
        <DropdownMenuSeparator />

        {counts.total === 0 && (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            No pending items
          </div>
        )}

        {/* Purchase Orders */}
        {hasPOs && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex items-center gap-2">
              <ShoppingCart className="h-3.5 w-3.5" />
              Purchase Orders
            </DropdownMenuLabel>
            {counts.draftPOs > 0 && (
              <DropdownMenuItem render={<Link href="/purchasing/orders" />}>
                <span className="flex-1 text-sm">Draft orders</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                  {counts.draftPOs}
                </span>
              </DropdownMenuItem>
            )}
            {counts.orderedPOs > 0 && (
              <DropdownMenuItem render={<Link href="/purchasing/orders" />}>
                <span className="flex-1 text-sm">Awaiting receipt</span>
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {counts.orderedPOs}
                </span>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        )}

        {/* Stock Transfers */}
        {counts.pendingTransfers > 0 && (
          <>
            {hasPOs && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Stock Transfers
              </DropdownMenuLabel>
              <DropdownMenuItem render={<Link href="/inventory/transfers" />}>
                <span className="flex-1 text-sm">Pending approval</span>
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {counts.pendingTransfers}
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}

        {/* Branch Requests */}
        {counts.pendingBranchRequests > 0 && (
          <>
            {(hasPOs || counts.pendingTransfers > 0) && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex items-center gap-2">
                <Package className="h-3.5 w-3.5" />
                Branch Requests
              </DropdownMenuLabel>
              <DropdownMenuItem render={<Link href="/purchasing/branch-requests" />}>
                <span className="flex-1 text-sm">Pending fulfillment</span>
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {counts.pendingBranchRequests}
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

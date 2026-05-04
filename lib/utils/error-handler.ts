'use client'

import { toast } from 'sonner'
import { logError } from '@/lib/actions/errors'

export function handleError(err: unknown, context?: string): void {
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? (err.stack ?? undefined) : undefined

  toast.error(message)

  // Fire-and-forget — never block the UI
  logError({
    message,
    stack,
    context,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  }).catch(() => {})
}

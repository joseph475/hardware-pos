'use client'

import { useState } from 'react'
import { formatDate, formatTime } from '@/lib/format'

type ErrorLog = {
  id: string
  user_id: string | null
  message: string
  stack: string | null
  context: string | null
  url: string | null
  created_at: string
}

export default function LogsClient({ initialLogs }: { initialLogs: ErrorLog[] }) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = initialLogs.filter(
    (log) =>
      log.message.toLowerCase().includes(search.toLowerCase()) ||
      (log.context ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (log.url ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Error Logs</h1>
        <span className="text-sm text-muted-foreground">{filtered.length} entries</span>
      </div>

      <input
        type="search"
        placeholder="Filter by message, context, or URL…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">No errors found.</p>
        )}
        {filtered.map((log) => (
          <div key={log.id} className="rounded-lg border bg-card p-4 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-destructive break-words flex-1">{log.message}</p>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDate(log.created_at)} {formatTime(log.created_at)}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {log.context && (
                <span className="bg-muted px-1.5 py-0.5 rounded">{log.context}</span>
              )}
              {log.url && <span className="truncate max-w-xs">{log.url}</span>}
              {log.user_id && <span>user: {log.user_id.slice(0, 12)}…</span>}
            </div>
            {log.stack && (
              <button
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                className="text-xs text-blue-500 hover:underline"
              >
                {expanded === log.id ? 'Hide stack trace' : 'Show stack trace'}
              </button>
            )}
            {expanded === log.id && log.stack && (
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
                {log.stack}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

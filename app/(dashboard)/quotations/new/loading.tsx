import { Skeleton } from '@/components/ui/skeleton'

export default function NewQuotationLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3 shrink-0">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-px" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0">
        {/* Left */}
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-9 w-full" />
          <div className="rounded-lg border border-border overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0">
                <Skeleton className="h-10 w-10 rounded-md shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="w-72 shrink-0 border-l border-border p-6 space-y-4">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <div className="pt-4 border-t border-border space-y-2 mt-auto">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

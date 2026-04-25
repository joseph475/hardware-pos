import { Skeleton } from "@/components/ui/skeleton"

export default function SupplierReportLoading() {
  return (
    <div className="p-6 space-y-5">
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <Skeleton className="h-5 w-40" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b border-border/50 flex gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-16 ml-auto" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}

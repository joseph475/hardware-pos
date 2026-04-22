import { Skeleton } from "@/components/ui/skeleton"

export default function OrganizationLoading() {
  return (
    <div className="p-6 max-w-2xl space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Currency card */}
      <div className="rounded-xl border border-border">
        <div className="border-b border-border p-6 space-y-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-72 rounded-md" />
          </div>
          <Skeleton className="h-14 w-full rounded-lg" />
        </div>
      </div>

      {/* Tax rate card */}
      <div className="rounded-xl border border-border">
        <div className="border-b border-border p-6 space-y-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="p-6 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>

      <div className="flex justify-end">
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    </div>
  )
}

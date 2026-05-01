import { Skeleton } from "@/components/ui/skeleton"

export default function ARLoading() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-44" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-14 w-32 rounded-lg" />
          <Skeleton className="h-14 w-32 rounded-lg" />
        </div>
      </div>
      <Skeleton className="h-9 w-72" />
      <div className="rounded-xl border overflow-hidden">
        <div className="flex gap-4 px-4 py-3 border-b bg-muted/40">
          {["w-20", "w-32", "w-24", "w-24", "w-20", "w-20", "w-16"].map((w, i) => (
            <Skeleton key={i} className={`h-4 ${w}`} />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24 ml-auto" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

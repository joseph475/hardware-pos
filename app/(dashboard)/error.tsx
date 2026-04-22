"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-base">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>An unexpected error occurred. Try refreshing or go back to the dashboard.</p>
          {error.digest && (
            <p className="mt-2 font-mono text-xs">Error ID: {error.digest}</p>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            Try again
          </Button>
          <a href="/dashboard" className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90">
            Back to dashboard
          </a>
        </CardFooter>
      </Card>
    </div>
  )
}

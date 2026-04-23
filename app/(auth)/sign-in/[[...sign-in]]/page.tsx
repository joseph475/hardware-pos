import { SignIn } from "@clerk/nextjs";
import { DemoLoginButtons } from "@/components/auth/demo-login-buttons";

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

interface Props {
  searchParams: Promise<{ __clerk_ticket?: string }>
}

export default async function SignInPage({ searchParams }: Props) {
  const params = await searchParams
  const hasTicket = !!params.__clerk_ticket

  // In demo mode with a ticket, render SignIn so Clerk can process it and redirect
  if (isDemoMode && hasTicket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <SignIn forceRedirectUrl="/api/auth/redirect" />
      </div>
    )
  }

  // In demo mode without a ticket, show the demo panel only
  if (isDemoMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm px-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
            <div className="space-y-1">
              <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/30">
                Demo Mode
              </span>
              <p className="text-sm font-semibold text-foreground">Choose a role to sign in</p>
              <p className="text-xs text-muted-foreground">
                Each account has a different branch and permission level.
              </p>
            </div>
            <DemoLoginButtons />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn forceRedirectUrl="/api/auth/redirect" />
    </div>
  )
}

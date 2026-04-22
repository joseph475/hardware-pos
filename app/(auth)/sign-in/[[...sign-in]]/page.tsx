import { SignIn } from "@clerk/nextjs";
import { DemoLoginButtons } from "@/components/auth/demo-login-buttons";

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6 w-full max-w-3xl px-4">
        {isDemoMode && (
          <div className="w-full md:w-72 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/30">
                Demo Mode
              </span>
              <p className="text-xs text-muted-foreground">Click a role to sign in instantly</p>
            </div>
            <DemoLoginButtons />
          </div>
        )}
        <SignIn forceRedirectUrl="/api/auth/redirect" />
      </div>
    </div>
  );
}

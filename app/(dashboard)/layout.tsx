import * as React from "react";
import { UserButton } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Menu, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar";
import { UserProfileProvider } from "@/lib/context/user-profile";
import { CurrencyProvider } from "@/lib/context/currency";
import { TaxRateSync } from "@/lib/context/tax-rate-sync";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type ProfileWithBranch = {
  profile: import("@/types/database").Profile;
  branch: import("@/types/database").Branch | null;
} | null;

async function ensureProfile(userId: string): Promise<ProfileWithBranch> {
  const supabase = getAdminClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("*, branches(*)")
    .eq("clerk_user_id", userId)
    .single();

  if (existing) {
    const { branches, ...profileRow } = existing as any;
    return {
      profile: profileRow as import("@/types/database").Profile,
      branch: (branches ?? null) as import("@/types/database").Branch | null,
    };
  }

  // Profile missing — create it now (fallback for local dev / missed webhook)
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? null;
  const full_name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

  const orgId = process.env.NEXT_PUBLIC_DEFAULT_ORG_ID!;

  await supabase.from("profiles").upsert(
    {
      clerk_user_id: userId,
      email: email ?? "",
      full_name: full_name ?? "",
      role: "cashier",
      org_id: orgId,
      branch_id: null,
    },
    { onConflict: "clerk_user_id", ignoreDuplicates: true }
  );

  // Re-fetch in case the webhook already created it
  const { data: created } = await supabase
    .from("profiles")
    .select("*, branches(*)")
    .eq("clerk_user_id", userId)
    .single();

  if (created) {
    const { branches, ...profileRow } = created as any;
    return {
      profile: profileRow as import("@/types/database").Profile,
      branch: (branches ?? null) as import("@/types/database").Branch | null,
    };
  }
  return null;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = getAdminClient();
  const [profile, orgData] = await Promise.all([
    ensureProfile(userId),
    supabase
      .from("organizations")
      .select("currency_code, currency_locale, tax_rate")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single(),
  ]);

  const isOwner = profile?.profile?.role === "owner";
  const branchLabel = isOwner
    ? "All Branches"
    : (profile?.branch?.name ?? "No Branch");

  const currencyCode = orgData.data?.currency_code ?? "USD";
  const currencyLocale = orgData.data?.currency_locale ?? "en-US";
  const taxRate = orgData.data?.tax_rate ?? 0.12;

  return (
    <CurrencyProvider currencyCode={currencyCode} locale={currencyLocale} taxRate={taxRate}>
    <TaxRateSync />
    <UserProfileProvider initialProfile={profile?.profile ?? null} initialBranch={profile?.branch ?? null}>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
          <SidebarNav className="h-full" />
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top header */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
            {/* Mobile hamburger */}
            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="lg:hidden"
                    aria-label="Open navigation"
                  />
                }
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-60 p-0" showCloseButton={false}>
                <SidebarNav className="h-full" />
              </SheetContent>
            </Sheet>

            {/* Branch indicator */}
            <div className="hidden items-center gap-2 sm:flex">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {branchLabel}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-7 w-7",
                  },
                }}
              />
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </UserProfileProvider>
    </CurrencyProvider>
  );
}

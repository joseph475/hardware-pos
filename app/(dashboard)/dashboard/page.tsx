import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { getDashboardStats } from "@/lib/actions/reports";
import { DashboardClient } from "./dashboard-client";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function DashboardPage() {
  const { userId } = await auth();

  let branchId: string | null = null;
  if (userId) {
    const supabase = getAdminClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, branch_id")
      .eq("clerk_user_id", userId)
      .single();
    if (profile?.role !== "owner") branchId = profile?.branch_id ?? null;
  }

  const data = await getDashboardStats(branchId ?? undefined);
  return <DashboardClient data={data} />;
}

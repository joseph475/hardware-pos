import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSalesReport } from "@/lib/actions/reports";
import SalesClient from "./sales-client";

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function SalesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = getAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id")
    .eq("clerk_user_id", userId)
    .single();

  if (profile?.role === "cashier") redirect("/pos");

  const branchId = profile?.role !== "owner" ? (profile?.branch_id ?? null) : null;

  const data = await getSalesReport("month", branchId);
  return <SalesClient initialData={data} initialRange="This Month" userBranchId={branchId} />;
}

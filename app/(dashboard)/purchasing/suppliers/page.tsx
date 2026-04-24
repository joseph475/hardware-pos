import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Database, Supplier } from "@/types/database";
import { SuppliersClient } from "./suppliers-client";

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function SuppliersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = getAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id")
    .eq("clerk_user_id", userId)
    .single();

  const userRole = profile?.role ?? "cashier";
  const userBranchId = profile?.branch_id ?? null;

  let isMainBranch = false;
  if (userBranchId) {
    const { data: branchData } = await supabase
      .from("branches")
      .select("is_main")
      .eq("id", userBranchId)
      .single();
    isMainBranch = branchData?.is_main ?? false;
  }

  if (!isMainBranch && userRole !== "owner") redirect("/purchasing/branch-requests");

  const { data } = await supabase
    .from("suppliers")
    .select("*")
    .order("name");

  const suppliers: Supplier[] = (data ?? []) as Supplier[];

  return <SuppliersClient initialSuppliers={suppliers} />;
}

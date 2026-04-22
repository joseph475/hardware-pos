import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import type { Database, Branch } from "@/types/database";
import { BranchesClient } from "./branches-client";

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function BranchesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = getAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("clerk_user_id", userId)
    .single();

  if (profile?.role !== "owner") {
    redirect("/dashboard");
  }

  const canAddBranch = true;
  const canEditBranch = true;

  const { data } = await supabase
    .from("branches")
    .select("*")
    .eq("org_id", "00000000-0000-0000-0000-000000000001")
    .order("name");

  const branches: Branch[] = (data ?? []) as Branch[];

  return <BranchesClient initialBranches={branches} canAddBranch={canAddBranch} canEditBranch={canEditBranch} />;
}

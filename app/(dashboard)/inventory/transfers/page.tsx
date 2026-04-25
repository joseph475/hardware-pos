import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import type { Database, Branch, Product } from "@/types/database";
import { TransfersClient, type TransferRow } from "./transfers-client";

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const { userId } = await auth();
  const supabase = getAdminClient();

  const [
    { data: transferData },
    { data: branches },
    { data: products },
    { data: profileData },
    { data: inventoryData },
  ] = await Promise.all([
    supabase
      .from("stock_transfers")
      .select(`
        *,
        from_branch:branches!from_branch_id(name),
        to_branch:branches!to_branch_id(name),
        creator:profiles!created_by(full_name),
        stock_transfer_items(id)
      `)
      .order("created_at", { ascending: false }),
    supabase.from("branches").select("*").eq("is_active", true).order("name"),
    supabase.from("products").select("*").eq("is_active", true).order("name"),
    supabase.from("profiles").select("role, branch_id").eq("clerk_user_id", userId ?? "").single(),
    supabase.from("inventory").select("product_id, branch_id, quantity"),
  ]);

  const role = profileData?.role ?? null;
  const userBranchId = profileData?.branch_id ?? null;
  const userBranch = (branches ?? []).find((b) => (b as any).id === userBranchId);
  const isMainBranch = (userBranch as any)?.is_main === true;
  const isOwner = role === "owner";

  if (role === "cashier") redirect("/pos");
  if (!isOwner && !isMainBranch) redirect("/dashboard");

  const transfers: TransferRow[] = (transferData ?? []).map((t: any) => ({
    id: t.id,
    from_branch: t.from_branch?.name ?? "Unknown",
    to_branch: t.to_branch?.name ?? "Unknown",
    to_branch_id: t.to_branch_id,
    status: t.status,
    items: Array.isArray(t.stock_transfer_items) ? t.stock_transfer_items.length : 0,
    created_by: t.creator?.full_name ?? "Unknown",
    created_at: t.created_at,
    notes: t.notes,
  }));

  // Build inventory map: { [branchId]: { [productId]: quantity } }
  const inventoryMap: Record<string, Record<string, number>> = {};
  for (const row of inventoryData ?? []) {
    if (!inventoryMap[row.branch_id]) inventoryMap[row.branch_id] = {};
    inventoryMap[row.branch_id][row.product_id] = row.quantity;
  }

  return (
    <TransfersClient
      initialTransfers={transfers}
      branches={(branches ?? []) as Branch[]}
      products={(products ?? []) as Product[]}
      isCashier={false}
      userBranchId={userBranchId}
      isOwner={isOwner}
      inventoryMap={inventoryMap}
    />
  );
}

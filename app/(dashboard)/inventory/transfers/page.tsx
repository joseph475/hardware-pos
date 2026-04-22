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

  const [{ data: transferData }, { data: branches }, { data: products }, { data: profileData }] = await Promise.all([
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
    supabase.from("profiles").select("role").eq("clerk_user_id", userId ?? "").single(),
  ]);

  const transfers: TransferRow[] = (transferData ?? []).map((t: any) => ({
    id: t.id,
    from_branch: t.from_branch?.name ?? "Unknown",
    to_branch: t.to_branch?.name ?? "Unknown",
    status: t.status,
    items: Array.isArray(t.stock_transfer_items) ? t.stock_transfer_items.length : 0,
    created_by: t.creator?.full_name ?? "Unknown",
    created_at: t.created_at,
    notes: t.notes,
  }));

  if (profileData?.role === 'cashier') redirect("/pos");

  const isCashier = false;

  return (
    <TransfersClient
      initialTransfers={transfers}
      branches={(branches ?? []) as Branch[]}
      products={(products ?? []) as Product[]}
      isCashier={isCashier}
    />
  );
}

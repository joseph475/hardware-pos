import { createClient } from "@supabase/supabase-js"
import { auth } from "@clerk/nextjs/server"
import { getInventoryMovements, getProductsForBranch } from "@/lib/actions/inventory"
import { AdjustmentsClient } from "./adjustments-client"
import type { Database } from "@/types/database"

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function AdjustmentsPage() {
  const { userId } = await auth()

  let branches: Array<{ id: string; name: string }> = []
  let defaultBranchId = ""

  if (userId) {
    const supabase = getAdminClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, branch_id")
      .eq("clerk_user_id", userId)
      .single()

    if (profile?.role === "owner") {
      // Owner sees all branches and can pick
      const { data: allBranches } = await supabase
        .from("branches")
        .select("id, name")
        .eq("is_active", true)
        .order("name")
      branches = allBranches ?? []
    } else if (profile?.branch_id) {
      // Manager / cashier — locked to their branch
      const { data: branchData } = await supabase
        .from("branches")
        .select("id, name")
        .eq("id", profile.branch_id)
        .single()
      if (branchData) {
        branches = [branchData]
        defaultBranchId = branchData.id
      }
    }
  }

  const [movements, products] = await Promise.all([
    getInventoryMovements(),
    getProductsForBranch(),
  ])

  const rows = movements.map((m) => {
    const prod = m.products as { name: string; sku: string } | null
    const branch = m.branches as { name: string } | null
    const creator = m.profiles as { full_name: string } | null
    return {
      id: m.id,
      date: m.created_at,
      product: prod?.name ?? "Unknown product",
      sku: prod?.sku ?? "",
      branch: branch?.name ?? "Unknown branch",
      type: m.type,
      quantity: m.quantity,
      reference: m.reference_id,
      notes: m.notes,
      created_by: creator?.full_name ?? "—",
    }
  })

  const productList = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    unit: p.unit,
  }))

  return (
    <AdjustmentsClient
      initialRows={rows}
      products={productList}
      branches={branches}
      defaultBranchId={defaultBranchId}
    />
  )
}

import { createClient } from "@supabase/supabase-js"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { CrossBranchClient, type MatrixRow } from "./cross-branch-client"

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const dynamic = "force-dynamic"

export default async function CrossBranchStockPage() {
  const { userId } = await auth()
  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id, branches(is_main)")
    .eq("clerk_user_id", userId ?? "")
    .single()

  if (!profile) redirect("/pos")

  const branch = (profile.branches as any)
  const isMainBranch = branch?.is_main === true
  const isOwner = profile.role === "owner"

  if (!isMainBranch && !isOwner) redirect("/inventory/stock")

  const [{ data: branchData }, { data: inventoryData }] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("inventory")
      .select("product_id, branch_id, quantity, products(name, sku)")
      .order("product_id"),
  ])

  const branches = (branchData ?? []) as Array<{ id: string; name: string }>
  const inventory = (inventoryData ?? []) as any[]

  // Build product → branch quantity matrix
  const productMap = new Map<string, MatrixRow>()
  for (const row of inventory) {
    const productId = row.product_id
    if (!productMap.has(productId)) {
      productMap.set(productId, {
        product_id: productId,
        product_name: row.products?.name ?? "Unknown",
        sku: row.products?.sku ?? "",
        byBranch: {},
      })
    }
    productMap.get(productId)!.byBranch[row.branch_id] = row.quantity
  }

  const matrixRows = Array.from(productMap.values()).sort((a, b) =>
    a.product_name.localeCompare(b.product_name)
  )

  return <CrossBranchClient branches={branches} rows={matrixRows} />
}

import { createClient } from "@supabase/supabase-js"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getBranchStockRequests } from "@/lib/actions/branch-requests"
import { getProductsForBranch } from "@/lib/actions/inventory"
import { BranchRequestsClient } from "./branch-requests-client"

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const dynamic = "force-dynamic"

export default async function BranchRequestsPage() {
  const { userId } = await auth()
  const supabase = getAdminClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, branch_id, branches(is_main, id, name)")
    .eq("clerk_user_id", userId ?? "")
    .single()

  if (!profile || profile.role === "cashier") redirect("/pos")

  const branch = (profile.branches as any) ?? null
  const isMainBranch = branch?.is_main === true
  const userBranchId = profile.branch_id

  // Get main branch ID for fulfillment actions
  const { data: mainBranchData } = await supabase
    .from("branches")
    .select("id")
    .eq("is_main", true)
    .single()
  const mainBranchId = mainBranchData?.id ?? null

  // Main branch sees all; sub-branch sees only their own
  const requests = await getBranchStockRequests(
    isMainBranch ? {} : { branchId: userBranchId }
  )

  const products = await getProductsForBranch()
  const productList = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    image_url: p.image_url,
  }))

  return (
    <BranchRequestsClient
      requests={requests}
      isMainBranch={isMainBranch}
      mainBranchId={mainBranchId}
      products={productList}
      userRole={profile.role as "owner" | "manager"}
    />
  )
}

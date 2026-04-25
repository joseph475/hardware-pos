import { createClient } from "@supabase/supabase-js"
import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getPurchaseOrders, getSuppliers, getBranches, getProductSupplierCosts } from "@/lib/actions/purchasing"
import { getProductsForBranch } from "@/lib/actions/inventory"
import { OrdersClient } from "./orders-client"

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function PurchaseOrdersPage() {
  const { userId } = await auth()

  // Resolve user's branch and role
  let userBranchId: string | null = null
  let userRole: "owner" | "manager" | "cashier" = "cashier"

  if (userId) {
    const supabase = getAdminClient()
    const { data: profile } = await supabase
      .from("profiles")
      .select("branch_id, role")
      .eq("clerk_user_id", userId)
      .single()

    userBranchId = profile?.branch_id ?? null
    userRole = profile?.role ?? "cashier"
  }

  let isMainBranch = false
  if (userBranchId) {
    const supabaseCheck = getAdminClient()
    const { data: branchData } = await supabaseCheck
      .from('branches')
      .select('is_main')
      .eq('id', userBranchId)
      .single()
    isMainBranch = branchData?.is_main ?? false
  }

  if (!isMainBranch && userRole !== "owner") redirect("/purchasing/branch-requests")

  // Fetch all data in parallel
  const [orders, suppliers, branches, products, productSupplierCosts] = await Promise.all([
    getPurchaseOrders(),
    getSuppliers(),
    getBranches(),
    getProductsForBranch(),
    getProductSupplierCosts(),
  ])

  // Map PO rows
  const orderRows = orders.map((o) => ({
    id: o.id,
    supplier: o.suppliers?.name ?? "Unknown supplier",
    branch: o.branches?.name ?? "Unknown branch",
    status: o.status,
    items: o.purchase_order_items.length,
    total: o.total,
    created_by: o.profiles?.full_name ?? "—",
    created_at: o.created_at,
  }))

  const productList = products.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    cost_price: p.cost_price,
  }))

  // Unique supplier names for the filter dropdown
  const supplierNames = Array.from(new Set(orderRows.map((o) => o.supplier).filter(Boolean)))

  return (
    <OrdersClient
      initialOrders={orderRows}
      fullOrders={orders}
      suppliers={suppliers}
      branches={branches}
      products={productList}
      productSupplierCosts={productSupplierCosts}
      userBranchId={userBranchId}
      userRole={userRole}
      isMainBranch={isMainBranch}
      supplierNames={supplierNames}
    />
  )
}

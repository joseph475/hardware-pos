import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { getPOSProducts, getPOSBundles } from "@/lib/actions/inventory"
import { getOrgSettings } from "@/lib/actions/organization"
import { getCustomers } from "@/lib/actions/customers"
import { getQuotationById } from "@/lib/actions/quotations"
import { POSClient } from "./pos-client"

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function POSPage({
  searchParams,
}: {
  searchParams: Promise<{ quotation_id?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("branch_id, role")
    .eq("clerk_user_id", userId)
    .single()

  if (profile?.role === "owner") redirect("/dashboard")

  const params = await searchParams
  const quotationId = params?.quotation_id ?? null

  const [products, bundles, orgSettings, customers, initialQuotation] = await Promise.all([
    getPOSProducts(profile?.branch_id ?? null),
    getPOSBundles(profile?.branch_id ?? null),
    getOrgSettings(),
    getCustomers(),
    quotationId ? getQuotationById(quotationId) : Promise.resolve(null),
  ])

  return (
    <POSClient
      initialProducts={products}
      initialBundles={bundles}
      customers={customers}
      userRole={profile?.role ?? "cashier"}
      gcashQrUrl={orgSettings.gcash_qr_url ?? null}
      mayaQrUrl={orgSettings.maya_qr_url ?? null}
      maxCashierDiscountPct={orgSettings.max_cashier_discount_pct}
      receiptHeader={orgSettings.receipt_header ?? null}
      receiptFooter={orgSettings.receipt_footer ?? null}
      hasPinConfigured={orgSettings.has_manager_pin}
      initialQuotation={initialQuotation}
    />
  )
}

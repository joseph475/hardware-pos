import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { getPOSProducts } from "@/lib/actions/inventory"
import { getOrgSettings } from "@/lib/actions/organization"
import { POSClient } from "./pos-client"

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function POSPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("branch_id, role")
    .eq("clerk_user_id", userId)
    .single()

  const [products, orgSettings] = await Promise.all([
    getPOSProducts(profile?.branch_id ?? null),
    getOrgSettings(),
  ])

  return (
    <POSClient
      initialProducts={products}
      userRole={profile?.role ?? "cashier"}
      gcashQrUrl={orgSettings.gcash_qr_url ?? null}
      mayaQrUrl={orgSettings.maya_qr_url ?? null}
      maxCashierDiscountPct={orgSettings.max_cashier_discount_pct}
      receiptHeader={orgSettings.receipt_header ?? null}
      receiptFooter={orgSettings.receipt_footer ?? null}
      hasPinConfigured={orgSettings.has_manager_pin}
    />
  )
}

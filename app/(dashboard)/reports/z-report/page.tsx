import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { getSalesReading } from "@/lib/actions/reports"
import { getOrgSettings } from "@/lib/actions/organization"
import { ZReportClient } from "./z-report-client"

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function ZReportPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, branch_id")
    .eq("clerk_user_id", userId)
    .single()

  if (profile?.role === "cashier") redirect("/pos")

  const branchId = profile?.role !== "owner" ? (profile?.branch_id ?? null) : null

  let timezone = "UTC"
  if (branchId) {
    const { data: branch } = await supabase.from("branches").select("timezone").eq("id", branchId).single()
    if (branch?.timezone) timezone = branch.timezone
  } else {
    const { data: anyBranch } = await supabase.from("branches").select("timezone").limit(1).single()
    if (anyBranch?.timezone) timezone = anyBranch.timezone
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: timezone })
  const [initialData, orgSettings] = await Promise.all([
    getSalesReading({ mode: "all-time", branch_id: branchId }),
    getOrgSettings(),
  ])

  return (
    <ZReportClient
      initialData={initialData}
      initialDate={today}
      userBranchId={branchId}
      companyName={orgSettings.company_name ?? null}
      address1={orgSettings.address_1 ?? null}
      address2={orgSettings.address_2 ?? null}
      logoUrl={orgSettings.logo_url ?? null}
    />
  )
}

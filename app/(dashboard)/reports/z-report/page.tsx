import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { getZReport } from "@/lib/actions/reports"
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
    .select("role")
    .eq("clerk_user_id", userId)
    .single()

  if (profile?.role === "cashier") redirect("/pos")

  const today = new Date().toISOString().slice(0, 10)
  const initialData = await getZReport(today)

  return <ZReportClient initialData={initialData} initialDate={today} />
}

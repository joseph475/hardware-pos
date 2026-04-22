import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { getTransactions } from "@/lib/actions/transactions"
import { getOrgSettings } from "@/lib/actions/organization"
import { TransactionsClient } from "./transactions-client"

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function TransactionsPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("clerk_user_id", userId)
    .single()

  if (profile?.role === "cashier") redirect("/pos")

  const dateTo = new Date().toISOString().slice(0, 10)
  const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [initialData, orgSettings] = await Promise.all([
    getTransactions({ dateFrom, dateTo }),
    getOrgSettings(),
  ])

  return (
    <TransactionsClient
      initialData={initialData}
      initialDateFrom={dateFrom}
      initialDateTo={dateTo}
      userRole={profile?.role ?? "manager"}
      orgSettings={{
        tax_rate: orgSettings.tax_rate,
        receipt_header: orgSettings.receipt_header ?? null,
        receipt_footer: orgSettings.receipt_footer ?? null,
        currency_code: orgSettings.currency_code,
        currency_locale: orgSettings.currency_locale,
      }}
    />
  )
}

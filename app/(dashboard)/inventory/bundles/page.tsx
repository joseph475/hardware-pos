import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { getBundles } from "@/lib/actions/bundles"
import { BundlesClient } from "./bundles-client"

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export default async function BundlesPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("clerk_user_id", userId)
    .single()

  if (!profile || !['manager', 'owner'].includes(profile.role)) {
    redirect("/dashboard")
  }

  const [bundles, productsResult] = await Promise.all([
    getBundles(),
    supabase
      .from("products")
      .select("id, name, sku")
      .eq("org_id", ORG_ID)
      .eq("is_active", true)
      .order("name"),
  ])

  const products = (productsResult.data ?? []) as Array<{ id: string; name: string; sku: string }>

  return <BundlesClient initialBundles={bundles} products={products} />
}

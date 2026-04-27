import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getSupplierFastMovingReport } from "@/lib/actions/reports"
import { getSuppliers } from "@/lib/actions/purchasing"
import { getOrgSettings } from "@/lib/actions/organization"
import { SuppliersReportClient } from "./suppliers-client"

export default async function SupplierReportPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [rows, suppliers, orgSettings] = await Promise.all([
    getSupplierFastMovingReport(),
    getSuppliers(),
    getOrgSettings(),
  ])

  return (
    <SuppliersReportClient
      rows={rows}
      suppliers={suppliers}
      companyName={orgSettings.company_name ?? null}
      address1={orgSettings.address_1 ?? null}
      address2={orgSettings.address_2 ?? null}
      logoUrl={orgSettings.logo_url ?? null}
    />
  )
}

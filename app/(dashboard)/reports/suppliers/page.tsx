import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { getSupplierFastMovingReport } from "@/lib/actions/reports"
import { getSuppliers } from "@/lib/actions/purchasing"
import { SuppliersReportClient } from "./suppliers-client"

export default async function SupplierReportPage() {
  const { userId } = await auth()
  if (!userId) redirect("/sign-in")

  const [rows, suppliers] = await Promise.all([
    getSupplierFastMovingReport(),
    getSuppliers(),
  ])

  return <SuppliersReportClient rows={rows} suppliers={suppliers} />
}

import { getDashboardStats } from "@/lib/actions/reports";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const data = await getDashboardStats();
  return <DashboardClient data={data} />;
}

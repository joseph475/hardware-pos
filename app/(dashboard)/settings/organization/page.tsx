import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getOrgSettings } from "@/lib/actions/organization";
import { OrganizationClient } from "./organization-client";

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function OrganizationSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const supabase = getAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("clerk_user_id", userId)
    .single();

  if (!["owner", "manager"].includes(profile?.role ?? "")) redirect("/dashboard");

  const settings = await getOrgSettings();

  return (
    <OrganizationClient
      initialCurrencyCode={settings.currency_code}
      initialTaxRate={settings.tax_rate}
      initialGcashQrUrl={settings.gcash_qr_url ?? null}
      initialMayaQrUrl={settings.maya_qr_url ?? null}
      initialReceiptHeader={settings.receipt_header ?? null}
      initialReceiptFooter={settings.receipt_footer ?? null}
      initialMaxCashierDiscountPct={settings.max_cashier_discount_pct}
      initialHasManagerPin={settings.has_manager_pin}
      isOwner={profile?.role === "owner"}
    />
  );
}

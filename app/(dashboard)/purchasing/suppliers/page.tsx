import { createClient } from "@supabase/supabase-js";
import type { Database, Supplier } from "@/types/database";
import { SuppliersClient } from "./suppliers-client";

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function SuppliersPage() {
  const supabase = getAdminClient();

  const { data } = await supabase
    .from("suppliers")
    .select("*")
    .order("name");

  const suppliers: Supplier[] = (data ?? []) as Supplier[];

  return <SuppliersClient initialSuppliers={suppliers} />;
}

import { createClient } from "@supabase/supabase-js";
import type { Database, Category, Branch } from "@/types/database";
import { ProductsClient, type ProductWithCategory } from "./products-client";

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function ProductsPage() {
  const supabase = getAdminClient();

  const [productsResult, categoriesResult, branchesResult] = await Promise.all([
    supabase
      .from("products")
      .select("*, categories(name)")
      .order("name"),
    supabase
      .from("categories")
      .select("*")
      .order("name"),
    supabase
      .from("branches")
      .select("*")
      .eq("is_active", true)
      .order("name"),
  ]);

  const rawProducts = productsResult.data ?? [];
  const categories: Category[] = (categoriesResult.data ?? []) as Category[];
  const branches: Branch[] = (branchesResult.data ?? []) as Branch[];

  // Flatten the joined categories(name) into category_name
  const products: ProductWithCategory[] = rawProducts.map((p: any) => ({
    ...p,
    category_name: p.categories?.name ?? null,
    categories: undefined,
  }));

  return <ProductsClient initialProducts={products} categories={categories} branches={branches} />;
}

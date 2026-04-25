import { createClient } from "@supabase/supabase-js";
import type { Database, Category, Branch, Supplier } from "@/types/database";
import { ProductsClient, type ProductWithCategory } from "./products-client";

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function ProductsPage() {
  const supabase = getAdminClient();

  const [productsResult, categoriesResult, branchesResult, suppliersResult, productSuppliersResult] =
    await Promise.all([
      supabase.from("products").select("*, categories(name)").order("name"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("branches").select("*").eq("is_active", true).order("name"),
      supabase.from("suppliers").select("id, name").order("name"),
      supabase.from("product_suppliers").select("product_id, supplier_id, cost_price"),
    ]);

  const rawProducts = productsResult.data ?? [];
  const categories: Category[] = (categoriesResult.data ?? []) as Category[];
  const branches: Branch[] = (branchesResult.data ?? []) as Branch[];
  const suppliers = (suppliersResult.data ?? []) as Pick<Supplier, "id" | "name">[];

  const products: ProductWithCategory[] = rawProducts.map((p: any) => ({
    ...p,
    category_name: p.categories?.name ?? null,
    categories: undefined,
  }));

  // Map product_id → [{supplier_id, cost_price}]
  const productSuppliersMap: Record<string, Array<{ supplier_id: string; cost_price: number }>> = {};
  for (const ps of (productSuppliersResult.data ?? []) as any[]) {
    if (!productSuppliersMap[ps.product_id]) productSuppliersMap[ps.product_id] = [];
    productSuppliersMap[ps.product_id].push({ supplier_id: ps.supplier_id, cost_price: ps.cost_price });
  }

  return (
    <ProductsClient
      initialProducts={products}
      categories={categories}
      branches={branches}
      suppliers={suppliers}
      productSuppliersMap={productSuppliersMap}
    />
  );
}

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { CategoriesClient } from './categories-client'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  const supabase = getAdminClient()

  const { data: categoriesData } = await supabase
    .from('categories')
    .select('id, org_id, name, created_at')
    .order('name')

  // Also count products per category
  const { data: productCounts } = await supabase
    .from('products')
    .select('category_id')

  const countMap: Record<string, number> = {}
  for (const row of productCounts ?? []) {
    if (row.category_id) {
      countMap[row.category_id] = (countMap[row.category_id] ?? 0) + 1
    }
  }

  const categories = (categoriesData ?? []).map((c) => ({
    ...c,
    product_count: countMap[c.id] ?? 0,
  }))

  return <CategoriesClient initialCategories={categories} />
}

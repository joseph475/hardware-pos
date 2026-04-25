'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import type { Database } from '@/types/database'

const ORG_ID = '00000000-0000-0000-0000-000000000001'

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function getRangeStart(range: string): string {
  const now = new Date()
  if (range === 'today') {
    now.setHours(0, 0, 0, 0)
  } else if (range === 'week') {
    const day = now.getDay() // 0=Sun
    now.setDate(now.getDate() - day)
    now.setHours(0, 0, 0, 0)
  } else {
    // month (default)
    now.setDate(1)
    now.setHours(0, 0, 0, 0)
  }
  return now.toISOString()
}

// Returns UTC ISO timestamps that correspond to midnight→23:59:59 in the given timezone.
function getDateBoundsInTZ(dateStr: string, tz: string): { dayStart: string; dayEnd: string } {
  // Use a midday probe (safe against DST at midnight edge) to compute the offset.
  const probe = new Date(`${dateStr}T12:00:00Z`)
  const utcMs = new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()
  const tzMs = new Date(probe.toLocaleString('en-US', { timeZone: tz })).getTime()
  const offsetMs = utcMs - tzMs // positive when tz is ahead of UTC (e.g. +08:00)
  const dayStart = new Date(new Date(`${dateStr}T00:00:00Z`).getTime() + offsetMs)
  const dayEnd = new Date(new Date(`${dateStr}T23:59:59.999Z`).getTime() + offsetMs)
  return { dayStart: dayStart.toISOString(), dayEnd: dayEnd.toISOString() }
}

export type DailySalePoint = {
  date: string
  revenue: number
  transactions: number
}

export type SalesReportData = {
  revenue: number
  transactionCount: number
  avgOrderValue: number
  itemsSold: number
  dailyRevenue: DailySalePoint[]
  topProducts: { name: string; revenue: number }[]
  recentTransactions: {
    id: string
    branch: string
    cashier: string
    items: number
    total: number
    method: string
    time: string
  }[]
  branchComparison: { branch: string; revenue: number; transactions: number }[]
}

export async function getSalesReport(range: string, branchId?: string | null): Promise<SalesReportData> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const startDate = getRangeStart(range)

  // 1. Fetch all completed transactions in range
  let txnQuery = supabase
    .from('transactions')
    .select('id, total, payment_method, created_at, branch_id, cashier_id')
    .eq('status', 'completed')
    .gte('created_at', startDate)
    .order('created_at', { ascending: false })

  if (branchId) txnQuery = txnQuery.eq('branch_id', branchId)

  const { data: txns, error: txnError } = await txnQuery

  if (txnError) throw new Error(txnError.message)

  const transactions = txns ?? []

  // 2. Summary stats
  const revenue = transactions.reduce((s, t) => s + t.total, 0)
  const transactionCount = transactions.length
  const avgOrderValue = transactionCount > 0 ? revenue / transactionCount : 0

  // 3. Daily revenue grouped by calendar day
  const dailyMap = new Map<string, { revenue: number; transactions: number }>()
  for (const t of transactions) {
    const day = t.created_at.slice(0, 10) // YYYY-MM-DD
    const entry = dailyMap.get(day) ?? { revenue: 0, transactions: 0 }
    entry.revenue += t.total
    entry.transactions += 1
    dailyMap.set(day, entry)
  }
  const dailyRevenue: DailySalePoint[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
      }),
      revenue: Math.round(vals.revenue * 100) / 100,
      transactions: vals.transactions,
    }))

  // 4. Transaction items for top products and items sold
  const txnIds = transactions.map((t) => t.id)
  let itemsSold = 0
  const productRevMap = new Map<string, number>()

  if (txnIds.length > 0) {
    const { data: items } = await supabase
      .from('transaction_items')
      .select('transaction_id, product_name, quantity, total')
      .in('transaction_id', txnIds)

    for (const item of items ?? []) {
      itemsSold += item.quantity
      const cur = productRevMap.get(item.product_name) ?? 0
      productRevMap.set(item.product_name, cur + item.total)
    }
  }

  const topProducts = Array.from(productRevMap.entries())
    .map(([name, rev]) => ({ name, revenue: Math.round(rev * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  // 5. Branch names
  const branchIds = [...new Set(transactions.map((t) => t.branch_id))]
  const branchMap = new Map<string, string>()
  if (branchIds.length > 0) {
    const { data: branchRows } = await supabase
      .from('branches')
      .select('id, name')
      .in('id', branchIds)
    for (const b of branchRows ?? []) branchMap.set(b.id, b.name)
  }

  // 6. Recent 10 transactions with cashier names
  const recent = transactions.slice(0, 10)
  const cashierIds = [...new Set(recent.map((t) => t.cashier_id))]
  const cashierMap = new Map<string, string>()
  if (cashierIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', cashierIds)
    for (const p of profileRows ?? []) cashierMap.set(p.id, p.full_name)
  }

  // Item quantity counts per transaction (for "items" column)
  const recentTxnIds = recent.map((t) => t.id)
  const itemCountMap = new Map<string, number>()
  if (recentTxnIds.length > 0) {
    const { data: recentItems } = await supabase
      .from('transaction_items')
      .select('transaction_id, quantity')
      .in('transaction_id', recentTxnIds)
    for (const item of recentItems ?? []) {
      itemCountMap.set(
        item.transaction_id,
        (itemCountMap.get(item.transaction_id) ?? 0) + item.quantity
      )
    }
  }

  const recentTransactions = recent.map((t) => ({
    id: t.id.slice(0, 8).toUpperCase(),
    branch: branchMap.get(t.branch_id) ?? 'Unknown',
    cashier: cashierMap.get(t.cashier_id) ?? 'Unknown',
    items: itemCountMap.get(t.id) ?? 0,
    total: t.total,
    method: t.payment_method,
    time: new Date(t.created_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  }))

  // 7. Branch comparison
  const branchRevMap = new Map<string, { revenue: number; transactions: number }>()
  for (const t of transactions) {
    const name = branchMap.get(t.branch_id) ?? 'Unknown'
    const entry = branchRevMap.get(name) ?? { revenue: 0, transactions: 0 }
    entry.revenue += t.total
    entry.transactions += 1
    branchRevMap.set(name, entry)
  }
  const branchComparison = Array.from(branchRevMap.entries())
    .map(([branch, vals]) => ({ branch, revenue: vals.revenue, transactions: vals.transactions }))
    .sort((a, b) => b.revenue - a.revenue)

  return {
    revenue,
    transactionCount,
    avgOrderValue,
    itemsSold,
    dailyRevenue,
    topProducts,
    recentTransactions,
    branchComparison,
  }
}

// ─── Z-Report ──────────────────────────────────────────────────────────────────

export type ZReportData = {
  date: string
  salesCount: number
  totalRevenue: number
  totalDiscounts: number
  avgTransactionValue: number
  voidCount: number
  voidedTotal: number
  byPaymentMethod: { method: string; count: number; total: number }[]
  hourlyBreakdown: { hour: number; revenue: number; count: number }[]
}

export async function getZReport(date: string, branchId?: string | null): Promise<ZReportData> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  // Resolve the timezone for this branch (or any branch in the org as fallback)
  let timezone = 'UTC'
  if (branchId) {
    const { data: branch } = await supabase
      .from('branches')
      .select('timezone')
      .eq('id', branchId)
      .single()
    if (branch?.timezone) timezone = branch.timezone
  } else {
    const { data: anyBranch } = await supabase
      .from('branches')
      .select('timezone')
      .eq('org_id', ORG_ID)
      .limit(1)
      .single()
    if (anyBranch?.timezone) timezone = anyBranch.timezone
  }

  const { dayStart, dayEnd } = getDateBoundsInTZ(date, timezone)

  let zQuery = supabase
    .from('transactions')
    .select('id, total, discount_amount, payment_method, status, created_at')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)

  if (branchId) zQuery = zQuery.eq('branch_id', branchId)

  const { data: txns, error } = await zQuery

  if (error) throw new Error(error.message)

  const all = (txns ?? []) as any[]
  const completed = all.filter((t) => t.status === 'completed')
  const voided = all.filter((t) => t.status === 'voided')

  const totalRevenue = completed.reduce((s: number, t: any) => s + (t.total ?? 0), 0)
  const totalDiscounts = completed.reduce((s: number, t: any) => s + (t.discount_amount ?? 0), 0)
  const salesCount = completed.length
  const avgTransactionValue = salesCount > 0 ? totalRevenue / salesCount : 0
  const voidCount = voided.length
  const voidedTotal = voided.reduce((s: number, t: any) => s + (t.total ?? 0), 0)

  const methodMap = new Map<string, { count: number; total: number }>()
  for (const t of completed) {
    const entry = methodMap.get(t.payment_method) ?? { count: 0, total: 0 }
    entry.count += 1
    entry.total += t.total ?? 0
    methodMap.set(t.payment_method, entry)
  }
  const byPaymentMethod = Array.from(methodMap.entries())
    .map(([method, vals]) => ({ method, count: vals.count, total: vals.total }))
    .sort((a, b) => b.total - a.total)

  // Hourly breakdown — group by local hour in the branch timezone
  const hourMap = new Map<number, { revenue: number; count: number }>()
  for (const t of completed) {
    const localHour = new Date(t.created_at).toLocaleString('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    })
    const hour = parseInt(localHour, 10) % 24
    const entry = hourMap.get(hour) ?? { revenue: 0, count: 0 }
    entry.revenue += t.total ?? 0
    entry.count += 1
    hourMap.set(hour, entry)
  }
  const hourlyBreakdown = Array.from(hourMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, vals]) => ({ hour, revenue: Math.round(vals.revenue * 100) / 100, count: vals.count }))

  return {
    date,
    salesCount,
    totalRevenue,
    totalDiscounts,
    avgTransactionValue,
    voidCount,
    voidedTotal,
    byPaymentMethod,
    hourlyBreakdown,
  }
}

// ─── Product Performance Report ────────────────────────────────────────────────

export type ProductReportData = {
  topByRevenue: { name: string; sku: string; revenue: number; units: number }[]
  topByQuantity: { name: string; sku: string; revenue: number; units: number }[]
  byCategory: { category: string; revenue: number; units: number }[]
}

export async function getProductReport(
  range: string,
  branchId?: string | null
): Promise<ProductReportData> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const startDate = getRangeStart(range)

  // 1. Completed transactions in range
  let txnQuery = supabase
    .from('transactions')
    .select('id, branch_id')
    .eq('status', 'completed')
    .gte('created_at', startDate)

  if (branchId) txnQuery = txnQuery.eq('branch_id', branchId)

  const { data: txns } = await txnQuery
  const txnIds = (txns ?? []).map((t) => t.id)

  if (txnIds.length === 0) {
    return { topByRevenue: [], topByQuantity: [], byCategory: [] }
  }

  // 2. Fetch transaction items
  const { data: items } = await supabase
    .from('transaction_items')
    .select('product_id, product_name, quantity, total')
    .in('transaction_id', txnIds)

  // 3. Fetch product → sku + category mapping
  const productIds = [...new Set((items ?? []).map((i) => i.product_id))]
  const productMeta = new Map<string, { sku: string; category: string }>()
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, sku, categories(name)')
      .in('id', productIds)
    for (const p of (products ?? []) as any[]) {
      productMeta.set(p.id, {
        sku: p.sku ?? '',
        category: p.categories?.name ?? 'Uncategorized',
      })
    }
  }

  // 4. Group by product
  const productMap = new Map<string, { name: string; sku: string; revenue: number; units: number }>()
  const categoryMap = new Map<string, { revenue: number; units: number }>()

  for (const item of items ?? []) {
    const meta = productMeta.get(item.product_id) ?? { sku: '', category: 'Uncategorized' }

    const existing = productMap.get(item.product_id) ?? {
      name: item.product_name,
      sku: meta.sku,
      revenue: 0,
      units: 0,
    }
    existing.revenue += item.total ?? 0
    existing.units += item.quantity ?? 0
    productMap.set(item.product_id, existing)

    const cat = meta.category
    const catEntry = categoryMap.get(cat) ?? { revenue: 0, units: 0 }
    catEntry.revenue += item.total ?? 0
    catEntry.units += item.quantity ?? 0
    categoryMap.set(cat, catEntry)
  }

  const allProducts = Array.from(productMap.values()).map((p) => ({
    ...p,
    revenue: Math.round(p.revenue * 100) / 100,
  }))

  const topByRevenue = [...allProducts].sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  const topByQuantity = [...allProducts].sort((a, b) => b.units - a.units).slice(0, 10)
  const byCategory = Array.from(categoryMap.entries())
    .map(([category, vals]) => ({
      category,
      revenue: Math.round(vals.revenue * 100) / 100,
      units: vals.units,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  return { topByRevenue, topByQuantity, byCategory }
}

// ─── Dashboard stats ───────────────────────────────────────────────────────────

export type DashboardData = {
  todayRevenue: number
  yesterdayRevenue: number
  transactionCount: number
  yesterdayTransactionCount: number
  itemsSold: number
  yesterdayItemsSold: number
  activeProducts: number
  recentTransactions: {
    id: string
    time: string
    cashier: string
    items: number
    total: number
    method: string
  }[]
  lowStockItems: {
    id: string
    name: string
    sku: string
    stock: number
    threshold: number
    category: string
  }[]
  branchSales: { branch: string; revenue: number }[]
  weeklyRevenue: DailySalePoint[]
  paymentMethods: { method: string; total: number; count: number }[]
}

export async function getDashboardStats(branchId?: string | null): Promise<DashboardData> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const sevenDaysStart = new Date(todayStart)
  sevenDaysStart.setDate(sevenDaysStart.getDate() - 6) // 7 days including today

  // 1. Fetch last 7 days of completed transactions
  let txnQuery = supabase
    .from('transactions')
    .select('id, total, payment_method, created_at, branch_id, cashier_id')
    .eq('status', 'completed')
    .gte('created_at', sevenDaysStart.toISOString())
    .order('created_at', { ascending: false })

  if (branchId) txnQuery = txnQuery.eq('branch_id', branchId)

  const { data: txns } = await txnQuery

  const allTxns = txns ?? []
  const todayIso = todayStart.toISOString()
  const yesterdayIso = yesterdayStart.toISOString()
  const todayTxns = allTxns.filter((t) => t.created_at >= todayIso)
  const yesterdayTxns = allTxns.filter(
    (t) => t.created_at >= yesterdayIso && t.created_at < todayIso
  )

  const todayRevenue = todayTxns.reduce((s, t) => s + t.total, 0)
  const yesterdayRevenue = yesterdayTxns.reduce((s, t) => s + t.total, 0)
  const transactionCount = todayTxns.length
  const yesterdayTransactionCount = yesterdayTxns.length

  // 2. Items sold today + yesterday
  const todayTxnIds = todayTxns.map((t) => t.id)
  const yesterdayTxnIds = yesterdayTxns.map((t) => t.id)
  const allTxnIds = [...new Set(allTxns.map((t) => t.id))]
  let itemsSold = 0
  let yesterdayItemsSold = 0
  if (allTxnIds.length > 0) {
    const { data: items } = await supabase
      .from('transaction_items')
      .select('transaction_id, quantity')
      .in('transaction_id', allTxnIds)
    for (const item of items ?? []) {
      if (todayTxnIds.includes(item.transaction_id)) itemsSold += item.quantity
      else if (yesterdayTxnIds.includes(item.transaction_id)) yesterdayItemsSold += item.quantity
    }
  }

  // 3. Active products count
  const { count: activeProducts } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  // 4. Recent 10 today transactions with cashier names + item counts
  const recent = todayTxns.slice(0, 10)
  const cashierIds = [...new Set(recent.map((t) => t.cashier_id))]
  const cashierMap = new Map<string, string>()
  if (cashierIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', cashierIds)
    for (const p of profileRows ?? []) cashierMap.set(p.id, p.full_name)
  }

  const recentTxnIds = recent.map((t) => t.id)
  const itemCountMap = new Map<string, number>()
  if (recentTxnIds.length > 0) {
    const { data: recentItems } = await supabase
      .from('transaction_items')
      .select('transaction_id, quantity')
      .in('transaction_id', recentTxnIds)
    for (const item of recentItems ?? []) {
      itemCountMap.set(
        item.transaction_id,
        (itemCountMap.get(item.transaction_id) ?? 0) + item.quantity
      )
    }
  }

  const recentTransactions = recent.map((t) => ({
    id: t.id.slice(0, 8).toUpperCase(),
    time: new Date(t.created_at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    cashier: cashierMap.get(t.cashier_id) ?? 'Unknown',
    items: itemCountMap.get(t.id) ?? 0,
    total: t.total,
    method: t.payment_method,
  }))

  // 5. Branch sales today
  const branchIds = [...new Set(todayTxns.map((t) => t.branch_id))]
  const branchMap = new Map<string, string>()
  if (branchIds.length > 0) {
    const { data: branchRows } = await supabase
      .from('branches')
      .select('id, name')
      .in('id', branchIds)
    for (const b of branchRows ?? []) branchMap.set(b.id, b.name)
  }

  const branchRevMap = new Map<string, number>()
  for (const t of todayTxns) {
    const name = branchMap.get(t.branch_id) ?? 'Unknown'
    branchRevMap.set(name, (branchRevMap.get(name) ?? 0) + t.total)
  }
  const branchSales = Array.from(branchRevMap.entries())
    .map(([branch, revenue]) => ({ branch, revenue }))
    .sort((a, b) => b.revenue - a.revenue)

  // 6. Low stock items
  let lowStockQuery = supabase
    .from('inventory')
    .select('id, quantity, low_stock_threshold, products(name, sku, categories(name))')
    .not('low_stock_threshold', 'is', null)
    .order('quantity', { ascending: true })
    .limit(50)

  if (branchId) lowStockQuery = lowStockQuery.eq('branch_id', branchId)

  const { data: lowStockRows } = await lowStockQuery

  const lowStockItems = ((lowStockRows ?? []) as any[])
    .filter((inv) => inv.low_stock_threshold != null && inv.quantity <= inv.low_stock_threshold)
    .slice(0, 8)
    .map((inv) => ({
      id: inv.id as string,
      name: (inv.products?.name ?? 'Unknown') as string,
      sku: (inv.products?.sku ?? '') as string,
      stock: inv.quantity as number,
      threshold: inv.low_stock_threshold as number,
      category: (inv.products?.categories?.name ?? 'Uncategorized') as string,
    }))

  // 7. Weekly revenue (last 7 days grouped by day)
  const dailyMap = new Map<string, { revenue: number; transactions: number }>()
  for (const t of allTxns) {
    const day = t.created_at.slice(0, 10)
    const entry = dailyMap.get(day) ?? { revenue: 0, transactions: 0 }
    entry.revenue += t.total
    entry.transactions += 1
    dailyMap.set(day, entry)
  }
  // Fill all 7 days (including days with no sales)
  const weeklyRevenue: DailySalePoint[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const vals = dailyMap.get(key) ?? { revenue: 0, transactions: 0 }
    weeklyRevenue.push({
      date: d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
      revenue: Math.round(vals.revenue * 100) / 100,
      transactions: vals.transactions,
    })
  }

  // 8. Today's payment method breakdown
  const pmMap = new Map<string, { total: number; count: number }>()
  for (const t of todayTxns) {
    const entry = pmMap.get(t.payment_method) ?? { total: 0, count: 0 }
    entry.total += t.total
    entry.count += 1
    pmMap.set(t.payment_method, entry)
  }
  const paymentMethods = Array.from(pmMap.entries())
    .map(([method, vals]) => ({ method, total: Math.round(vals.total * 100) / 100, count: vals.count }))
    .sort((a, b) => b.total - a.total)

  return {
    todayRevenue,
    yesterdayRevenue,
    transactionCount,
    yesterdayTransactionCount,
    itemsSold,
    yesterdayItemsSold,
    activeProducts: activeProducts ?? 0,
    recentTransactions,
    lowStockItems,
    branchSales,
    weeklyRevenue,
    paymentMethods,
  }
}

export type SupplierProductRow = {
  supplier_id: string
  supplier_name: string
  product_id: string
  product_name: string
  sku: string
  units_sold: number
  total_cogs: number
}

export async function getSupplierFastMovingReport(params?: {
  date_from?: string
  date_to?: string
  supplier_id?: string
}): Promise<SupplierProductRow[]> {
  const supabase = getAdminClient()

  // Fetch raw allocation rows joined through transaction_items → transactions
  let query = supabase
    .from('transaction_item_supplier_costs')
    .select(`
      supplier_id,
      quantity,
      unit_cost,
      transaction_items!inner(
        product_id,
        transactions!inner(status, created_at)
      )
    `)
    .eq('transaction_items.transactions.status', 'completed')

  if (params?.date_from) {
    query = query.gte('transaction_items.transactions.created_at', params.date_from)
  }
  if (params?.date_to) {
    query = query.lte('transaction_items.transactions.created_at', params.date_to + 'T23:59:59')
  }
  if (params?.supplier_id) {
    query = query.eq('supplier_id', params.supplier_id)
  }

  const { data: allocations } = await query

  if (!allocations || allocations.length === 0) return []

  // Collect unique product_ids and supplier_ids
  const allRows = allocations as any[]
  const productIds = [...new Set(allRows.map((r) => r.transaction_items?.product_id).filter(Boolean))]
  const supplierIds = [...new Set(allRows.map((r) => r.supplier_id).filter(Boolean))]

  const [{ data: products }, { data: suppliers }] = await Promise.all([
    supabase.from('products').select('id, name, sku').in('id', productIds),
    supabase.from('suppliers').select('id, name').in('id', supplierIds),
  ])

  const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]))
  const supplierMap = Object.fromEntries((suppliers ?? []).map((s) => [s.id, s]))

  // Aggregate by supplier + product
  const aggMap = new Map<string, SupplierProductRow>()

  for (const row of allRows) {
    const supplierId: string = row.supplier_id
    const productId: string = row.transaction_items?.product_id
    if (!supplierId || !productId) continue

    const key = `${supplierId}::${productId}`
    const existing = aggMap.get(key)
    if (existing) {
      existing.units_sold += row.quantity
      existing.total_cogs += row.quantity * row.unit_cost
    } else {
      aggMap.set(key, {
        supplier_id: supplierId,
        supplier_name: supplierMap[supplierId]?.name ?? 'Unknown',
        product_id: productId,
        product_name: productMap[productId]?.name ?? 'Unknown',
        sku: productMap[productId]?.sku ?? '',
        units_sold: row.quantity,
        total_cogs: row.quantity * row.unit_cost,
      })
    }
  }

  return Array.from(aggMap.values()).sort((a, b) => {
    if (a.supplier_name !== b.supplier_name) return a.supplier_name.localeCompare(b.supplier_name)
    return b.units_sold - a.units_sold
  })
}

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

export async function getSalesReport(
  range: string,
  branchId?: string | null,
  explicitFrom?: string | null,
  explicitTo?: string | null
): Promise<SalesReportData> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  // 1. Fetch all completed transactions in range
  let txnQuery = supabase
    .from('transactions')
    .select('id, total, payment_method, created_at, branch_id, cashier_id')
    .eq('status', 'completed')

  if (range !== 'all-time') {
    if (explicitFrom) {
      txnQuery = txnQuery.gte('created_at', explicitFrom)
      if (explicitTo) txnQuery = txnQuery.lte('created_at', explicitTo)
    } else {
      txnQuery = txnQuery.gte('created_at', getRangeStart(range))
    }
  }

  if (branchId) txnQuery = txnQuery.eq('branch_id', branchId)

  const { data: txns, error: txnError } = await txnQuery.order('created_at', { ascending: false })

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

// ─── Unified X/Z Sales Reading ────────────────────────────────────────────────

export type SalesReadingTransaction = {
  ref: string
  datetime: string
  customer: string
  method: string
  items: number
  discount: number
  total: number
  status: string
}

export type SalesReadingData = {
  salesCount: number
  totalRevenue: number
  totalDiscounts: number
  avgTransactionValue: number
  voidCount: number
  voidedTotal: number
  byPaymentMethod: { method: string; count: number; total: number }[]
  hourlyBreakdown: { hour: number; revenue: number; count: number }[]
  dailyBreakdown: { date: string; revenue: number; count: number }[]
  transactions: SalesReadingTransaction[]
}

export async function getSalesReading(params: {
  mode: 'x-reading' | 'z-reading' | 'all-time'
  date?: string
  date_from?: string
  date_to?: string
  branch_id?: string | null
}): Promise<SalesReadingData> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  let timezone = 'UTC'
  if (params.branch_id) {
    const { data: branch } = await supabase.from('branches').select('timezone').eq('id', params.branch_id).single()
    if (branch?.timezone) timezone = branch.timezone
  } else {
    const { data: anyBranch } = await supabase.from('branches').select('timezone').eq('org_id', ORG_ID).limit(1).single()
    if (anyBranch?.timezone) timezone = anyBranch.timezone
  }

  let query = supabase
    .from('transactions')
    .select('id, total, discount_amount, payment_method, status, created_at, customer_id')
    .order('created_at', { ascending: false })

  if (params.branch_id) query = query.eq('branch_id', params.branch_id)

  if (params.mode === 'z-reading' && params.date) {
    const { dayStart, dayEnd } = getDateBoundsInTZ(params.date, timezone)
    query = query.gte('created_at', dayStart).lte('created_at', dayEnd)
  } else if (params.mode === 'x-reading' && params.date_from && params.date_to) {
    const { dayStart } = getDateBoundsInTZ(params.date_from, timezone)
    const { dayEnd } = getDateBoundsInTZ(params.date_to, timezone)
    query = query.gte('created_at', dayStart).lte('created_at', dayEnd)
  }
  // all-time: no date filter applied

  const { data: txns, error } = await query
  if (error) throw new Error(error.message)

  const all = (txns ?? []) as any[]
  const completed = all.filter((t) => t.status === 'completed')
  const voided = all.filter((t) => t.status === 'voided')

  // Fetch customer names and item counts for transaction list
  const allIds = all.map((t) => t.id)
  const customerIds = [...new Set(all.map((t) => t.customer_id).filter(Boolean))]
  const customerMap = new Map<string, string>()
  const itemCountMap = new Map<string, number>()

  await Promise.all([
    customerIds.length > 0
      ? supabase.from('customers').select('id, name').in('id', customerIds).then(({ data }) => {
          for (const c of data ?? []) customerMap.set(c.id, c.name)
        })
      : Promise.resolve(),
    allIds.length > 0
      ? supabase.from('transaction_items').select('transaction_id, quantity').in('transaction_id', allIds).then(({ data }) => {
          for (const item of data ?? []) {
            itemCountMap.set(item.transaction_id, (itemCountMap.get(item.transaction_id) ?? 0) + (item.quantity ?? 0))
          }
        })
      : Promise.resolve(),
  ])

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

  // Hourly breakdown for Z-reading
  const hourMap = new Map<number, { revenue: number; count: number }>()
  if (params.mode === 'z-reading') {
    for (const t of completed) {
      const localHour = new Date(t.created_at).toLocaleString('en-US', { timeZone: timezone, hour: 'numeric', hour12: false })
      const hour = parseInt(localHour, 10) % 24
      const entry = hourMap.get(hour) ?? { revenue: 0, count: 0 }
      entry.revenue += t.total ?? 0
      entry.count += 1
      hourMap.set(hour, entry)
    }
  }
  const hourlyBreakdown = Array.from(hourMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, vals]) => ({ hour, revenue: Math.round(vals.revenue * 100) / 100, count: vals.count }))

  // Daily breakdown for X-reading and all-time
  const dayMap = new Map<string, { revenue: number; count: number }>()
  if (params.mode === 'x-reading' || params.mode === 'all-time') {
    for (const t of completed) {
      const localDate = new Date(t.created_at).toLocaleDateString('en-CA', { timeZone: timezone })
      const entry = dayMap.get(localDate) ?? { revenue: 0, count: 0 }
      entry.revenue += t.total ?? 0
      entry.count += 1
      dayMap.set(localDate, entry)
    }
  }
  const dailyBreakdown = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, revenue: Math.round(vals.revenue * 100) / 100, count: vals.count }))

  const transactions: SalesReadingTransaction[] = all.map((t) => ({
    ref: (t.id as string).slice(0, 8).toUpperCase(),
    datetime: t.created_at as string,
    customer: customerMap.get(t.customer_id) ?? '—',
    method: t.payment_method as string,
    items: itemCountMap.get(t.id) ?? 0,
    discount: t.discount_amount ?? 0,
    total: t.total ?? 0,
    status: t.status as string,
  }))

  return {
    salesCount,
    totalRevenue,
    totalDiscounts,
    avgTransactionValue,
    voidCount,
    voidedTotal,
    byPaymentMethod,
    hourlyBreakdown,
    dailyBreakdown,
    transactions,
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

  // 3. Fetch product → sku + category mapping (skip bundle items where product_id is null)
  const productItems = (items ?? []).filter((i) => i.product_id != null)
  const productIds = [...new Set(productItems.map((i) => i.product_id as string))]
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

  for (const item of productItems) {
    const pid = item.product_id as string
    const meta = productMeta.get(pid) ?? { sku: '', category: 'Uncategorized' }

    const existing = productMap.get(pid) ?? {
      name: item.product_name,
      sku: meta.sku,
      revenue: 0,
      units: 0,
    }
    existing.revenue += item.total ?? 0
    existing.units += item.quantity ?? 0
    productMap.set(pid, existing)

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

// --- Sales-based supplier report (fast-moving items, COGS tracking) ---

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

  // Step 1: get transaction_item IDs for completed transactions (avoids unreliable nested filters)
  let txQuery = supabase
    .from('transactions')
    .select('id')
    .eq('status', 'completed')

  if (params?.date_from) txQuery = txQuery.gte('created_at', params.date_from)
  if (params?.date_to) txQuery = txQuery.lte('created_at', params.date_to + 'T23:59:59')

  const { data: txRows } = await txQuery
  const txIds = (txRows ?? []).map((t: any) => t.id)
  if (txIds.length === 0) return []

  const { data: txItemRows } = await supabase
    .from('transaction_items')
    .select('id, product_id')
    .in('transaction_id', txIds)

  const txItemIds = (txItemRows ?? []).map((ti: any) => ti.id)
  if (txItemIds.length === 0) return []

  // Step 2: get COGS allocations for those items
  let allocQuery = supabase
    .from('transaction_item_supplier_costs')
    .select('supplier_id, quantity, unit_cost, transaction_item_id')
    .in('transaction_item_id', txItemIds)

  if (params?.supplier_id) {
    allocQuery = allocQuery.eq('supplier_id', params.supplier_id)
  }

  const { data: allocations } = await allocQuery
  if (!allocations || allocations.length === 0) return []

  // Build product_id lookup from txItemRows
  const itemProductMap = Object.fromEntries((txItemRows ?? []).map((ti: any) => [ti.id, ti.product_id]))

  const allRows = allocations as any[]
  const productIds = [...new Set(allRows.map((r) => itemProductMap[r.transaction_item_id]).filter(Boolean))]
  const supplierIds = [...new Set(allRows.map((r) => r.supplier_id).filter(Boolean))]

  const [{ data: products }, { data: suppliers }] = await Promise.all([
    supabase.from('products').select('id, name, sku').in('id', productIds),
    supabase.from('suppliers').select('id, name').in('id', supplierIds),
  ])

  const productMap = Object.fromEntries((products ?? []).map((p) => [p.id, p]))
  const supplierMap = Object.fromEntries((suppliers ?? []).map((s) => [s.id, s]))

  const aggMap = new Map<string, SupplierProductRow>()

  for (const row of allRows) {
    const supplierId: string = row.supplier_id
    const productId: string = itemProductMap[row.transaction_item_id]
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

// --- PO-based supplier report (received goods, purchase history) ---

export type SupplierReportRow = {
  supplier_id: string
  supplier_name: string
  po_count: number
  units_received: number
  total_value: number
  top_products: { name: string; units: number }[]
}

export type SupplierReportData = {
  suppliers: SupplierReportRow[]
  totalValue: number
  totalUnits: number
  totalPOs: number
}

export async function getSupplierReport(
  range: string,
  branchId?: string | null
): Promise<SupplierReportData> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const rangeStart = getRangeStart(range)

  let query = supabase
    .from('purchase_orders')
    .select(`
      id,
      supplier_id,
      branch_id,
      status,
      suppliers!supplier_id(name),
      purchase_order_items(
        quantity_received,
        unit_cost,
        product_id,
        products!product_id(name)
      )
    `)
    .in('status', ['received', 'partial'])
    .gte('created_at', rangeStart)

  if (branchId) {
    query = query.eq('branch_id', branchId)
  }

  const { data: rawPOs, error } = await query
  if (error) throw new Error(error.message)

  const pos = (rawPOs ?? []) as any[]

  const supplierMap: Record<string, {
    supplier_id: string
    supplier_name: string
    po_ids: Set<string>
    units_received: number
    total_value: number
    product_units: Record<string, { name: string; units: number }>
  }> = {}

  for (const po of pos) {
    const supplierId = po.supplier_id as string
    const supplierName = (po.suppliers as any)?.name ?? 'Unknown'

    if (!supplierMap[supplierId]) {
      supplierMap[supplierId] = {
        supplier_id: supplierId,
        supplier_name: supplierName,
        po_ids: new Set(),
        units_received: 0,
        total_value: 0,
        product_units: {},
      }
    }

    const entry = supplierMap[supplierId]
    entry.po_ids.add(po.id)

    const items = (po.purchase_order_items ?? []) as any[]
    for (const item of items) {
      const qty = Number(item.quantity_received ?? 0)
      const cost = Number(item.unit_cost ?? 0)
      const productName = (item.products as any)?.name ?? 'Unknown'
      const productId = item.product_id as string

      entry.units_received += qty
      entry.total_value += qty * cost

      if (!entry.product_units[productId]) {
        entry.product_units[productId] = { name: productName, units: 0 }
      }
      entry.product_units[productId].units += qty
    }
  }

  const suppliers: SupplierReportRow[] = Object.values(supplierMap)
    .map((s) => ({
      supplier_id: s.supplier_id,
      supplier_name: s.supplier_name,
      po_count: s.po_ids.size,
      units_received: s.units_received,
      total_value: s.total_value,
      top_products: Object.values(s.product_units)
        .sort((a, b) => b.units - a.units)
        .slice(0, 3),
    }))
    .sort((a, b) => b.total_value - a.total_value)

  return {
    suppliers,
    totalValue: suppliers.reduce((sum, s) => sum + s.total_value, 0),
    totalUnits: suppliers.reduce((sum, s) => sum + s.units_received, 0),
    totalPOs: new Set(pos.map((po: any) => po.id)).size,
  }
}

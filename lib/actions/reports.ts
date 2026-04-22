'use server'

import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'
import type { Database } from '@/types/database'

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

export async function getSalesReport(range: string): Promise<SalesReportData> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const startDate = getRangeStart(range)

  // 1. Fetch all completed transactions in range
  const { data: txns, error: txnError } = await supabase
    .from('transactions')
    .select('id, total, payment_method, created_at, branch_id, cashier_id')
    .eq('status', 'completed')
    .gte('created_at', startDate)
    .order('created_at', { ascending: false })

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
}

export async function getZReport(date: string): Promise<ZReportData> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()

  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`

  const { data: txns, error } = await supabase
    .from('transactions')
    .select('id, total, discount_amount, payment_method, status')
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)

  if (error) throw new Error(error.message)

  const all = (txns ?? []) as any[]
  const completed = all.filter((t) => t.status === 'completed')
  const voided = all.filter((t) => t.status === 'voided')

  const totalRevenue = completed.reduce((s: number, t: any) => s + t.total, 0)
  const totalDiscounts = completed.reduce((s: number, t: any) => s + t.discount_amount, 0)
  const salesCount = completed.length
  const avgTransactionValue = salesCount > 0 ? totalRevenue / salesCount : 0
  const voidCount = voided.length
  const voidedTotal = voided.reduce((s: number, t: any) => s + t.total, 0)

  const methodMap = new Map<string, { count: number; total: number }>()
  for (const t of completed) {
    const entry = methodMap.get(t.payment_method) ?? { count: 0, total: 0 }
    entry.count += 1
    entry.total += t.total
    methodMap.set(t.payment_method, entry)
  }
  const byPaymentMethod = Array.from(methodMap.entries())
    .map(([method, vals]) => ({ method, count: vals.count, total: vals.total }))
    .sort((a, b) => b.total - a.total)

  return {
    date,
    salesCount,
    totalRevenue,
    totalDiscounts,
    avgTransactionValue,
    voidCount,
    voidedTotal,
    byPaymentMethod,
  }
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
}

export async function getDashboardStats(): Promise<DashboardData> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')

  const supabase = getAdminClient()
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  // 1. Fetch today + yesterday completed transactions
  const { data: txns } = await supabase
    .from('transactions')
    .select('id, total, payment_method, created_at, branch_id, cashier_id')
    .eq('status', 'completed')
    .gte('created_at', yesterdayStart.toISOString())
    .order('created_at', { ascending: false })

  const allTxns = txns ?? []
  const todayIso = todayStart.toISOString()
  const todayTxns = allTxns.filter((t) => t.created_at >= todayIso)
  const yesterdayTxns = allTxns.filter((t) => t.created_at < todayIso)

  const todayRevenue = todayTxns.reduce((s, t) => s + t.total, 0)
  const yesterdayRevenue = yesterdayTxns.reduce((s, t) => s + t.total, 0)
  const transactionCount = todayTxns.length
  const yesterdayTransactionCount = yesterdayTxns.length

  // 2. Items sold today + yesterday
  const todayTxnIds = todayTxns.map((t) => t.id)
  const yesterdayTxnIds = yesterdayTxns.map((t) => t.id)
  const allTxnIds = [...todayTxnIds, ...yesterdayTxnIds]
  let itemsSold = 0
  let yesterdayItemsSold = 0
  if (allTxnIds.length > 0) {
    const { data: items } = await supabase
      .from('transaction_items')
      .select('transaction_id, quantity')
      .in('transaction_id', allTxnIds)
    for (const item of items ?? []) {
      if (todayTxnIds.includes(item.transaction_id)) itemsSold += item.quantity
      else yesterdayItemsSold += item.quantity
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
  const { data: lowStockRows } = await supabase
    .from('inventory')
    .select('id, quantity, low_stock_threshold, products(name, sku, categories(name))')
    .not('low_stock_threshold', 'is', null)
    .order('quantity', { ascending: true })
    .limit(50)

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
  }
}

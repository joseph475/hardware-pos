'use client'

import * as React from 'react'
import { Briefcase, ShoppingCart, Loader2, Crown } from 'lucide-react'
import { toast } from 'sonner'
import { getDemoSignInUrl } from '@/lib/actions/demo'

type DemoRole = 'owner' | 'manager' | 'cashier'

const DEMO_ROLES: {
  role: DemoRole
  label: string
  description: string
  details: string[]
  icon: React.ElementType
  color: string
  bg: string
  border: string
}[] = [
  {
    role: 'owner',
    label: 'Owner',
    description: 'Full access — settings, all branches, all reports',
    details: ['Org settings & currency', 'User & branch management', 'GCash/Maya QR setup', 'All manager permissions'],
    icon: Crown,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 hover:bg-amber-500/20',
    border: 'border-amber-500/30',
  },
  {
    role: 'manager',
    label: 'Manager',
    description: 'Inventory, orders, reports',
    details: ['Products & categories', 'Purchase orders & suppliers', 'Stock transfers & adjustments', 'Sales reports'],
    icon: Briefcase,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 hover:bg-blue-500/20',
    border: 'border-blue-500/30',
  },
  {
    role: 'cashier',
    label: 'Cashier',
    description: 'POS sales only',
    details: ['Process transactions', 'Cash, card, GCash, Maya', 'Hold & resume orders', 'Print receipts'],
    icon: ShoppingCart,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
    border: 'border-emerald-500/30',
  },
]

export function DemoLoginButtons() {
  const [loading, setLoading] = React.useState<DemoRole | null>(null)

  async function handleDemoLogin(role: DemoRole) {
    if (loading) return
    setLoading(role)
    try {
      const url = await getDemoSignInUrl(role)
      window.location.href = url
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Demo login failed')
      setLoading(null)
    }
  }

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground font-medium px-2">Demo Accounts</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-1 gap-2">
        {DEMO_ROLES.map(({ role, label, description, details, icon: Icon, color, bg, border }) => {
          const isThisLoading = loading === role
          const isAnyLoading = loading !== null

          return (
            <div key={role} className="relative group">
              <button
                onClick={() => handleDemoLogin(role)}
                disabled={isAnyLoading}
                className={`
                  w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left
                  transition-colors disabled:cursor-not-allowed disabled:opacity-60
                  ${bg} ${border}
                `}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${border}`}>
                  {isThisLoading
                    ? <Loader2 className={`h-4 w-4 animate-spin ${color}`} />
                    : <Icon className={`h-4 w-4 ${color}`} />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{description}</p>
                </div>
              </button>

              {/* Hover tooltip */}
              <div className="
                pointer-events-none absolute left-full top-0 ml-2 z-50
                w-48 rounded-lg border border-border bg-popover p-3 shadow-lg
                opacity-0 group-hover:opacity-100
                transition-opacity duration-150
              ">
                <p className={`text-xs font-semibold mb-1.5 ${color}`}>{label}</p>
                <ul className="space-y-1">
                  {details.map((detail) => (
                    <li key={detail} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <span className={`mt-0.5 shrink-0 ${color}`}>•</span>
                      {detail}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

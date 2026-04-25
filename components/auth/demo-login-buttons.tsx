'use client'

import * as React from 'react'
import { Briefcase, ShoppingCart, Loader2, Crown } from 'lucide-react'
import { toast } from 'sonner'
import { getDemoSignInUrl, type DemoRole, type DemoBranchNames } from '@/lib/actions/demo'

type DemoAccount = {
  role: DemoRole
}

const DEMO_GROUPS: {
  groupLabel: string
  description: string
  icon: React.ElementType
  color: string
  bg: string
  border: string
  accounts: DemoAccount[]
}[] = [
  {
    groupLabel: 'Owner',
    description: 'Full access — all branches, settings, reports',
    icon: Crown,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 hover:bg-amber-500/20',
    border: 'border-amber-500/30',
    accounts: [{ role: 'owner' }],
  },
  {
    groupLabel: 'Manager',
    description: 'Inventory, orders, reports',
    icon: Briefcase,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 hover:bg-blue-500/20',
    border: 'border-blue-500/30',
    accounts: [
      { role: 'manager' },
      { role: 'manager2' },
      { role: 'manager3' },
    ],
  },
  {
    groupLabel: 'Cashier',
    description: 'POS sales only',
    icon: ShoppingCart,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
    border: 'border-emerald-500/30',
    accounts: [
      { role: 'cashier' },
      { role: 'cashier2' },
      { role: 'cashier3' },
    ],
  },
]

const FALLBACK_BRANCH: Record<DemoRole, string> = {
  owner: 'All Branches',
  manager: 'Branch 1', manager2: 'Branch 2', manager3: 'Branch 3',
  cashier: 'Branch 1', cashier2: 'Branch 2', cashier3: 'Branch 3',
}

export function DemoLoginButtons({ branchNames }: { branchNames: DemoBranchNames | null }) {
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
    <div className="w-full space-y-4">
      {DEMO_GROUPS.map(({ groupLabel, description, icon: Icon, color, bg, border, accounts }) => (
        <div key={groupLabel} className="space-y-1.5">
          <div className="flex items-center gap-2 px-0.5">
            <Icon className={`h-3.5 w-3.5 ${color}`} />
            <span className={`text-xs font-semibold ${color}`}>{groupLabel}</span>
            <span className="text-xs text-muted-foreground">— {description}</span>
          </div>
          <div className={accounts.length === 1 ? 'flex' : 'grid grid-cols-3 gap-1.5'}>
            {accounts.map(({ role }) => {
              const isThisLoading = loading === role
              const isAnyLoading = loading !== null
              const branchLabel = branchNames?.[role] ?? FALLBACK_BRANCH[role]
              return (
                <button
                  key={role}
                  onClick={() => handleDemoLogin(role)}
                  disabled={isAnyLoading}
                  className={`
                    flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-center
                    transition-colors disabled:cursor-not-allowed disabled:opacity-60
                    ${accounts.length === 1 ? 'flex-1' : 'flex-col'}
                    ${bg} ${border}
                  `}
                >
                  {isThisLoading
                    ? <Loader2 className={`h-4 w-4 animate-spin ${color}`} />
                    : <Icon className={`h-4 w-4 ${color}`} />
                  }
                  <span className="text-xs font-medium text-foreground leading-tight">{branchLabel}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

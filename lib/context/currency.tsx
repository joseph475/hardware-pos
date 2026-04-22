'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { formatCurrency as _formatCurrency } from '@/lib/utils/currency'

interface CurrencyContextValue {
  currencyCode: string
  locale: string
  taxRate: number
  formatCurrency: (amount: number) => string
  /** Currency symbol extracted from the locale, e.g. "$", "₱", "€" */
  currencySymbol: string
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currencyCode: 'USD',
  locale: 'en-US',
  taxRate: 0.12,
  formatCurrency: (amount) => _formatCurrency(amount),
  currencySymbol: '$',
})

interface CurrencyProviderProps {
  currencyCode: string
  locale: string
  taxRate: number
  children: ReactNode
}

function extractSymbol(currencyCode: string, locale: string): string {
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
  }).formatToParts(0)
  return parts.find((p) => p.type === 'currency')?.value ?? currencyCode
}

export function CurrencyProvider({ currencyCode, locale, taxRate, children }: CurrencyProviderProps) {
  const formatCurrency = (amount: number) =>
    _formatCurrency(amount, currencyCode, locale)

  const currencySymbol = extractSymbol(currencyCode, locale)

  return (
    <CurrencyContext.Provider value={{ currencyCode, locale, taxRate, formatCurrency, currencySymbol }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}

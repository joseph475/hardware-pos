'use client'

import { useEffect } from 'react'
import { useCurrency } from './currency'
import { useCartStore } from '@/lib/store/cart'

/** Bridges org taxRate from CurrencyContext into the Zustand cart store. */
export function TaxRateSync() {
  const { taxRate } = useCurrency()
  const setTaxRate = useCartStore((s) => s.setTaxRate)

  useEffect(() => {
    setTaxRate(taxRate)
  }, [taxRate, setTaxRate])

  return null
}

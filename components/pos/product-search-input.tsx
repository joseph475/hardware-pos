'use client'

import * as React from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface Product {
  id: string
  name: string
  sku: string
}

interface ProductSearchInputProps {
  products: Product[]
  onSelect: (product: Product) => void
  placeholder?: string
  disabled?: boolean
}

export function ProductSearchInput({
  products,
  onSelect,
  placeholder = 'Search by name or SKU…',
  disabled,
}: ProductSearchInputProps) {
  const [query, setQuery] = React.useState('')
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const results = React.useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 8)
  }, [query, products])

  React.useEffect(() => {
    setHighlightedIndex(0)
    setOpen(results.length > 0)
  }, [results])

  function select(product: Product) {
    onSelect(product)
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[highlightedIndex]) select(results[highlightedIndex])
    } else if (e.key === 'Escape') {
      setQuery('')
      setOpen(false)
    }
  }

  function handleBlur() {
    // Delay so mousedown on a result row fires before blur closes the list
    setTimeout(() => setOpen(false), 150)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-8"
          autoComplete="off"
        />
      </div>

      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
          {results.map((product, i) => (
            <button
              key={product.id}
              type="button"
              onMouseDown={() => select(product)}
              onMouseEnter={() => setHighlightedIndex(i)}
              className={`w-full text-left px-3 py-2 flex items-center justify-between text-sm transition-colors ${
                i === highlightedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
              }`}
            >
              <span className="font-medium truncate">{product.name}</span>
              <span className="ml-3 shrink-0 text-xs text-muted-foreground">{product.sku}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

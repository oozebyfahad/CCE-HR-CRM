import { createContext, useContext, useState, type ReactNode } from 'react'

export type CurrencyCode = 'PKR' | 'USD' | 'GBP' | 'AUD'

export interface CurrencyOption {
  code:   CurrencyCode
  label:  string
  symbol: string
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'PKR', label: 'Pakistani Rupee (Rs)',     symbol: 'Rs'  },
  { code: 'USD', label: 'US Dollar ($)',             symbol: '$'   },
  { code: 'GBP', label: 'British Pound (£)',         symbol: '£'   },
  { code: 'AUD', label: 'Australian Dollar (A$)',    symbol: 'A$'  },
]

interface CurrencyCtx {
  currency: CurrencyOption
  setCurrency: (code: CurrencyCode) => void
  fmt: (amount: number) => string
}

const Ctx = createContext<CurrencyCtx>({
  currency:    CURRENCIES[0],
  setCurrency: () => {},
  fmt:         n  => `Rs ${n.toLocaleString()}`,
})

const STORAGE_KEY = 'cce_currency'

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const saved = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) as CurrencyCode | null
  const initial = CURRENCIES.find(c => c.code === saved) ?? CURRENCIES[0]
  const [currency, setCurrencyState] = useState<CurrencyOption>(initial)

  const setCurrency = (code: CurrencyCode) => {
    const opt = CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0]
    localStorage.setItem(STORAGE_KEY, code)
    setCurrencyState(opt)
  }

  const fmt = (amount: number) =>
    `${currency.symbol} ${Math.round(amount).toLocaleString()}`

  return <Ctx.Provider value={{ currency, setCurrency, fmt }}>{children}</Ctx.Provider>
}

export function useCurrency() {
  return useContext(Ctx)
}

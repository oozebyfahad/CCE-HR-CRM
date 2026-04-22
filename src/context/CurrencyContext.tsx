import { createContext, useContext, useState, type ReactNode } from 'react'

export type CurrencyCode = 'PKR' | 'USD' | 'GBP' | 'AUD'

export interface CurrencyOption {
  code:       CurrencyCode
  label:      string
  symbol:     string
  rateFromPKR: number   // how many units of this currency = 1 PKR
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'PKR', label: 'Pakistani Rupee (Rs)',     symbol: 'Rs', rateFromPKR: 1        },
  { code: 'USD', label: 'US Dollar ($)',             symbol: '$',  rateFromPKR: 1 / 278  },
  { code: 'GBP', label: 'British Pound (£)',         symbol: '£',  rateFromPKR: 1 / 354  },
  { code: 'AUD', label: 'Australian Dollar (A$)',    symbol: 'A$', rateFromPKR: 1 / 181  },
]

interface CurrencyCtx {
  currency:    CurrencyOption
  setCurrency: (code: CurrencyCode) => void
  fmt:         (pkrAmount: number) => string
}

const Ctx = createContext<CurrencyCtx>({
  currency:    CURRENCIES[0],
  setCurrency: () => {},
  fmt:         n  => `Rs ${Math.round(n).toLocaleString()}`,
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

  const fmt = (pkrAmount: number) => {
    const converted = pkrAmount * currency.rateFromPKR
    const decimals  = currency.code === 'PKR' ? 0 : 2
    return `${currency.symbol} ${converted.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
  }

  return <Ctx.Provider value={{ currency, setCurrency, fmt }}>{children}</Ctx.Provider>
}

export function useCurrency() {
  return useContext(Ctx)
}

export type Currency = {
  code: string
  name: string
}

export type RateTable = {
  rates: Record<string, number>
  updatedAt: string
}

type OpenErApiResponse = {
  result?: string
  time_last_update_utc?: string
  rates?: Record<string, number>
}

export const currencies: Currency[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'THB', name: 'Thai Baht' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', name: 'Chinese Yuan' },
  { code: 'SGD', name: 'Singapore Dollar' },
  { code: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'IDR', name: 'Indonesian Rupiah' },
  { code: 'PHP', name: 'Philippine Peso' },
  { code: 'VND', name: 'Vietnamese Dong' },
  { code: 'KRW', name: 'South Korean Won' },
  { code: 'HKD', name: 'Hong Kong Dollar' },
  { code: 'TWD', name: 'New Taiwan Dollar' },
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'MMK', name: 'Myanmar Kyat' },
]

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'IDR', 'MMK'])

export async function fetchUsdRates(signal?: AbortSignal): Promise<RateTable> {
  const response = await fetch('https://open.er-api.com/v6/latest/USD', { signal })
  if (!response.ok) throw new Error('Could not load exchange rates')

  const data = (await response.json()) as OpenErApiResponse
  if (data.result !== 'success' || !data.rates) {
    throw new Error('Exchange rates are unavailable')
  }

  return {
    rates: data.rates,
    updatedAt: data.time_last_update_utc ?? '',
  }
}

export function convert(amount: number, from: string, to: string, rates: Record<string, number>) {
  const fromRate = rates[from]
  const toRate = rates[to]
  if (!Number.isFinite(amount) || !fromRate || !toRate) return null
  return amount * (toRate / fromRate)
}

export function formatAmount(value: number, code: string) {
  const digits = ZERO_DECIMAL.has(code) ? 0 : value < 1 ? 4 : 2
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function formatRateDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

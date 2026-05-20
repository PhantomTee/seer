export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function shortAddress(address?: string | null, size = 4) {
  if (!address) return 'Not connected'
  return `${address.slice(0, size + 2)}...${address.slice(-size)}`
}

export function formatUsdc(value: number | string | bigint | null | undefined, decimals = 2) {
  if (value === null || value === undefined || value === '') return '$0.00'
  if (typeof value === 'bigint') {
    return `$${(Number(value) / 1_000_000).toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })}`
  }
  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`
}

export function percent(value: number, decimals = 0) {
  return `${(value * 100).toFixed(decimals)}%`
}

export function toIsoInDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

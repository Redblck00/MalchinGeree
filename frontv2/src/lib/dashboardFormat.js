// Dashboard-ийн мөнгөний форматлагчид — page болон subcomponents хооронд хуваалцана.

export const formatMoney = (v) => v ? `₮${Number(v).toLocaleString('mn-MN')}` : '₮0'

export const compactMoney = (v) => {
  if (!v) return '₮0'
  const n = Number(v)
  if (n >= 1_000_000) return `₮${(n / 1_000_000).toFixed(1)}сая`
  if (n >= 1_000)     return `₮${(n / 1_000).toFixed(0)}мян`
  return `₮${n}`
}

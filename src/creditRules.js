const number = value => Number(value || 0)

function configuredTiers(tiers = []) {
  return (Array.isArray(tiers) ? tiers : [])
    .map((tier, index) => ({
      ...tier,
      id: tier?.id ?? `tier-${index + 1}`,
      sales: Math.max(0, number(tier?.sales)),
      credit: Math.max(0, number(tier?.credit)),
    }))
    .filter(tier => Number.isFinite(tier.sales) && Number.isFinite(tier.credit))
    .sort((a, b) => a.sales - b.sales)
}

export function creditProgression(tiers = [], salesValue = 0) {
  const sales = Math.max(0, number(salesValue))
  const configured = configuredTiers(tiers)
  const active = [...configured].reverse().find(tier => sales >= tier.sales) || null
  const next = configured.find(tier => sales < tier.sales) || null
  const baseSales = active?.sales || 0
  const interval = next ? next.sales - baseSales : 0
  const rawProgress = next
    ? (interval > 0 ? ((sales - baseSales) / interval) * 100 : 100)
    : (configured.length ? 100 : 0)

  return {
    sales,
    credit: active?.credit || 0,
    active,
    next,
    progress: Math.max(0, Math.min(100, rawProgress)),
    remaining: next ? Math.max(0, next.sales - sales) : 0,
    configured,
    projected: [],
  }
}

export const creditForSales = (tiers, sales) => creditProgression(tiers, sales).credit

export function visibleCreditLadder(tiers = []) {
  return configuredTiers(tiers)
}

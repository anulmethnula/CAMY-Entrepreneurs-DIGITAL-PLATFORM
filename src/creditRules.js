const number = value => Number(value || 0)

export function creditProgression(tiers = [], salesValue = 0) {
  const sales = Math.max(0, number(salesValue))
  const configured = [...tiers]
    .map(tier => ({ ...tier, sales: number(tier.sales), credit: number(tier.credit) }))
    .filter(tier => tier.sales > 0 && tier.credit >= 0)
    .sort((left, right) => left.sales - right.sales)

  if (!configured.length) {
    return { sales, credit: 0, next: null, configured, projected: [], progress: 0, remaining: 0 }
  }

  let active = [...configured].reverse().find(tier => tier.sales <= sales) || null
  let next = configured.find(tier => tier.sales > sales) || null
  const last = configured.at(-1)
  const previous = configured.at(-2)
  const salesStep = previous ? last.sales - previous.sales : last.sales
  const creditStep = previous ? last.credit - previous.credit : last.credit
  const projected = []

  // Continue the ladder using the final configured interval.
  if (!next && salesStep > 0 && creditStep > 0) {
    const completedSteps = Math.floor((sales - last.sales) / salesStep)
    active = {
      id: `projected-${completedSteps}`,
      sales: last.sales + completedSteps * salesStep,
      credit: last.credit + completedSteps * creditStep,
      projected: completedSteps > 0,
    }
    next = {
      id: `projected-${completedSteps + 1}`,
      sales: active.sales + salesStep,
      credit: active.credit + creditStep,
      projected: true,
    }
    projected.push(active, next)
  }

  const baseSales = active?.sales || 0
  const progress = next
    ? Math.min(100, Math.max(0, ((sales - baseSales) / (next.sales - baseSales || 1)) * 100))
    : 100

  return {
    sales,
    credit: active?.credit || 0,
    active,
    next,
    progress,
    remaining: next ? Math.max(0, next.sales - sales) : 0,
    configured,
    projected,
  }
}

export const creditForSales = (tiers, sales) => creditProgression(tiers, sales).credit

export function visibleCreditLadder(tiers, sales) {
  const result = creditProgression(tiers, sales)
  const rows = [...result.configured]

  for (const row of result.projected) {
    if (!rows.some(item => item.sales === row.sales)) rows.push(row)
  }

  return rows.sort((left, right) => left.sales - right.sales)
}

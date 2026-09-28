const number = value => Number(value || 0)

export const CREDIT_SALES_STEP = 100000
export const CREDIT_LIMIT_STEP = 10000

export function creditProgression(_tiers = [], salesValue = 0) {
  const sales = Math.max(0, number(salesValue))
  const completedSteps = Math.floor(sales / CREDIT_SALES_STEP)
  const credit = completedSteps * CREDIT_LIMIT_STEP
  const active = completedSteps > 0
    ? { id: `standard-${completedSteps}`, sales: completedSteps * CREDIT_SALES_STEP, credit }
    : null
  const next = {
    id: `standard-${completedSteps + 1}`,
    sales: (completedSteps + 1) * CREDIT_SALES_STEP,
    credit: (completedSteps + 1) * CREDIT_LIMIT_STEP,
  }
  const baseSales = active?.sales || 0

  return {
    sales,
    credit,
    active,
    next,
    progress: ((sales - baseSales) / CREDIT_SALES_STEP) * 100,
    remaining: next.sales - sales,
    configured: [],
    projected: [],
  }
}

export const creditForSales = (_tiers, sales) => creditProgression([], sales).credit

export function visibleCreditLadder(_tiers, salesValue = 0) {
  const sales = Math.max(0, number(salesValue))
  const completedSteps = Math.floor(sales / CREDIT_SALES_STEP)
  const rowCount = Math.max(4, completedSteps + 1)

  return Array.from({ length: rowCount }, (_, index) => {
    const step = index + 1
    return { id: `standard-${step}`, sales: step * CREDIT_SALES_STEP, credit: step * CREDIT_LIMIT_STEP }
  })
}

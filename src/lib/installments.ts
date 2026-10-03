/** Mirrors `start_installments` in the database (the database is the one that charges). */
export function installmentAmounts(total: number, count: 2 | 3): number[] {
  if (count === 2) {
    const first = Math.ceil(total * 0.5)
    return [first, total - first]
  }
  const first = Math.ceil(total * 0.4)
  const second = Math.ceil(total * 0.3)
  return [first, second, total - first - second]
}

/** Day offset of each installment from the first payment. */
export const INSTALLMENT_GAP_DAYS = 14

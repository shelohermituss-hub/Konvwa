/** Same formula as the buy_shipping_insurance() SQL function; the database is the one that decides. */
export function insuranceFeeHtg(valueUsd: number, ratePercent: number, usdToHtg: number): number {
  if (!Number.isFinite(valueUsd) || valueUsd <= 0) return 0
  return Math.ceil(valueUsd * ratePercent / 100 * usdToHtg)
}

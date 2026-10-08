const LB_PER_KG = 2.2046226

/**
 * Weight (kg) a parcel is charged for under a rate's volumetric formula: the greater of its real weight and its volumetric weight.
 * Mirror of the database function billed_weight_kg (the database is the one that decides at checkout); the volume is in m³.
 *  - 'in'   : L × W × H in inches ÷ divisor (132) = pounds
 *  - 'cm'   : L × W × H in cm ÷ divisor (2000) = pounds
 *  - 'none' : real weight only
 *  - no formula: cm³ ÷ 6000 = kg (platform default)
 */
export function billedWeightKg(divisor: number | null | undefined, unit: 'in' | 'cm' | 'none' | null | undefined, kg: number, cbm: number): number {
  if (unit === 'none') return kg
  if (divisor && divisor > 0) {
    const cm3 = cbm * 1_000_000
    const lb = unit === 'cm' ? cm3 / divisor : cm3 / 16.387064 / divisor
    return Math.max(kg, lb / LB_PER_KG)
  }
  return Math.max(kg, cbm * 166.6667)
}

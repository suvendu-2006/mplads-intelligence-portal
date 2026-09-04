/**
 * Indian Currency & Number Formatting Utilities
 * Adheres strictly to Indian numbering system (Crores & Lakhs).
 *
 * 1 Crore = 10,000,000 rupees (10^7)
 * 1 Lakh  = 100,000 rupees (10^5)
 */

export function fmtCrore(rupees: number, decimals: number = 0): string {
  if (isNaN(rupees) || rupees == null) return '0'
  const cr = rupees / 10_000_000
  return cr.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

export function fmtLakh(rupees: number, decimals: number = 2): string {
  if (isNaN(rupees) || rupees == null) return '0'
  const lakh = rupees / 100_000
  return lakh.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

export function fmtRupees(rupees: number): string {
  if (isNaN(rupees) || rupees == null) return '₹0'
  const abs = Math.abs(rupees)
  if (abs >= 10_000_000) {
    return `₹${fmtCrore(rupees, 2)} Cr`
  }
  if (abs >= 100_000) {
    return `₹${fmtLakh(rupees, 2)} Lakh`
  }
  return `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

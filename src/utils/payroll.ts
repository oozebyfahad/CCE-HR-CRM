// ── Payroll calculation engine ────────────────────────────────────────
// FBR salaried tax slabs (Tax Year 2024-25)
// Method: annualise monthly gross → apply slab → divide by 12

interface TaxSlab {
  min: number
  max: number
  base: number
  rate: number
}

const FBR_SLABS: TaxSlab[] = [
  { min: 0,         max: 600_000,   base: 0,       rate: 0.00 },
  { min: 600_000,   max: 1_200_000, base: 0,       rate: 0.05 },
  { min: 1_200_000, max: 2_200_000, base: 30_000,  rate: 0.15 },
  { min: 2_200_000, max: 3_200_000, base: 180_000, rate: 0.25 },
  { min: 3_200_000, max: 4_100_000, base: 430_000, rate: 0.30 },
  { min: 4_100_000, max: Infinity,  base: 700_000, rate: 0.35 },
]

export function calcAnnualTax(annualIncome: number): number {
  for (const slab of FBR_SLABS) {
    if (annualIncome <= slab.max)
      return slab.base + (annualIncome - slab.min) * slab.rate
  }
  return 0
}

export function calcMonthlyTax(monthlyGross: number): number {
  return Math.round(calcAnnualTax(monthlyGross * 12) / 12)
}

// ── EOBI ──────────────────────────────────────────────────────────────
export const EOBI_EMPLOYEE = 370
export const EOBI_EMPLOYER = 1_850

// ── Pay type ──────────────────────────────────────────────────────────
export type PayType = 'hourly' | 'fixed_monthly'

// ── Input ─────────────────────────────────────────────────────────────
export interface PayrollInput {
  payType:        PayType
  // Fixed monthly fields
  monthlySalary?: number
  monthlyHours?:  number    // overtime threshold (default 160)
  overtimeRate?:  number    // PKR/hr above threshold
  // Hourly fields
  hourlyRate?:    number
  // Actual hours worked this period
  hoursWorked:    number
  // Paid holiday hours (added on top of hoursWorked for hourly staff)
  paidHolidayHours: number
  // Eid double pay — extra pay for Eid days (number of Eid days)
  // We pay an extra day-equivalent per Eid day (i.e. same again on top)
  eidDays: number
  // Allowances (all PKR/month, taxable — included in gross for WHT)
  fuelAllowance:    number
  gymAllowance:     number
  qualityBonus:     number
  punctualityBonus: number
  otherAdditions:   number
  // Deductions
  eobi:              boolean
  advances:          number
  loans:             number
  securityDeduction: number   // held as security deposit
  otherDeductions:   number
}

// ── Result ────────────────────────────────────────────────────────────
export interface PayrollResult {
  // Earnings breakdown
  basicPay:         number
  overtimePay:      number
  overtimeHours:    number
  paidHolidayPay:   number
  eidPay:           number
  fuelAllowance:    number
  gymAllowance:     number
  qualityBonus:     number
  punctualityBonus: number
  otherAdditions:   number
  grossPay:         number
  // Deductions breakdown
  withholdingTax:   number
  eobiEmployee:     number
  eobiEmployer:     number   // informational
  advanceRepay:     number
  loanRepay:        number
  securityDeduction:number
  otherDeductions:  number
  totalDeductions:  number
  // Bottom line
  netPay: number
}

// ── Core calculation ──────────────────────────────────────────────────
export function calcPayroll(input: PayrollInput): PayrollResult {
  const stdHours = input.monthlyHours ?? 160

  let basicPay    = 0
  let overtimePay = 0
  let overtimeHrs = 0

  if (input.payType === 'hourly') {
    const rate       = input.hourlyRate ?? 0
    const totalHours = input.hoursWorked + (input.paidHolidayHours ?? 0)
    basicPay         = Math.round(rate * totalHours)
  } else {
    basicPay = input.monthlySalary ?? 0
    const workedHours = input.hoursWorked + (input.paidHolidayHours ?? 0)
    if (workedHours > stdHours) {
      overtimeHrs = workedHours - stdHours
      overtimePay = Math.round((input.overtimeRate ?? 0) * overtimeHrs)
    }
  }

  // Paid holiday pay (for hourly: already in basicPay; for fixed: informational 0)
  const paidHolidayPay = input.payType === 'hourly'
    ? Math.round((input.hourlyRate ?? 0) * (input.paidHolidayHours ?? 0))
    : 0

  // Eid double pay — extra equivalent of one day's pay per Eid day
  // Daily rate = monthly salary / 26 working days  OR  hourly rate × 8
  let eidPay = 0
  if ((input.eidDays ?? 0) > 0) {
    const dailyRate = input.payType === 'hourly'
      ? (input.hourlyRate ?? 0) * 8
      : (input.monthlySalary ?? 0) / 26
    eidPay = Math.round(dailyRate * input.eidDays)
  }

  const fuelAllowance    = input.fuelAllowance    ?? 0
  const gymAllowance     = input.gymAllowance     ?? 0
  const qualityBonus     = input.qualityBonus     ?? 0
  const punctualityBonus = input.punctualityBonus ?? 0
  const otherAdditions   = input.otherAdditions   ?? 0

  const grossPay =
    basicPay + overtimePay + eidPay +
    fuelAllowance + gymAllowance + qualityBonus + punctualityBonus + otherAdditions

  // WHT on full gross (allowances are taxable under Pakistani law)
  const tax          = calcMonthlyTax(grossPay)
  const eobiEmp      = input.eobi ? EOBI_EMPLOYEE : 0
  const eobiEmployer = input.eobi ? EOBI_EMPLOYER : 0

  const totalDeductions =
    tax +
    eobiEmp +
    (input.advances          ?? 0) +
    (input.loans             ?? 0) +
    (input.securityDeduction ?? 0) +
    (input.otherDeductions   ?? 0)

  return {
    basicPay,
    overtimePay,
    overtimeHours:    overtimeHrs,
    paidHolidayPay,
    eidPay,
    fuelAllowance,
    gymAllowance,
    qualityBonus,
    punctualityBonus,
    otherAdditions,
    grossPay,
    withholdingTax:   tax,
    eobiEmployee:     eobiEmp,
    eobiEmployer,
    advanceRepay:     input.advances          ?? 0,
    loanRepay:        input.loans             ?? 0,
    securityDeduction:input.securityDeduction ?? 0,
    otherDeductions:  input.otherDeductions   ?? 0,
    totalDeductions,
    netPay: Math.max(0, grossPay - totalDeductions),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────
export function fmtPKR(n: number): string {
  return `PKR ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export const PAY_TYPE_LABELS: Record<PayType, string> = {
  hourly:        'Hourly',
  fixed_monthly: 'Fixed Monthly',
}

import * as XLSX from 'xlsx'

// ── FBR salaried tax slabs 2024-25 ───────────────────────────────────
const SLABS = [
  { min: 0,         max: 600_000,   base: 0,       rate: 0.00 },
  { min: 600_000,   max: 1_200_000, base: 0,       rate: 0.05 },
  { min: 1_200_000, max: 2_200_000, base: 30_000,  rate: 0.15 },
  { min: 2_200_000, max: 3_200_000, base: 180_000, rate: 0.25 },
  { min: 3_200_000, max: 4_100_000, base: 430_000, rate: 0.30 },
  { min: 4_100_000, max: Infinity,  base: 700_000, rate: 0.35 },
]
function monthlyTax(gross) {
  const annual = gross * 12
  for (const s of SLABS)
    if (annual <= s.max) return Math.round((s.base + (annual - s.min) * s.rate) / 12)
  return 0
}

const EOBI_EMP = 370
const EOBI_EER = 1_850

// ── Employee roster ───────────────────────────────────────────────────
const employees = [
  // Hourly agents
  { name: 'Ahmed Raza',       dept: 'Dispatch',     type: 'hourly',  rate: 480,   stdHrs: 160, otRate: 0,    eobi: true,  fuel: 0,    gym: 0,    sec: 500  },
  { name: 'Sana Malik',       dept: 'Customer Svc', type: 'hourly',  rate: 520,   stdHrs: 160, otRate: 0,    eobi: true,  fuel: 0,    gym: 0,    sec: 500  },
  { name: 'Bilal Khan',       dept: 'Dispatch',     type: 'hourly',  rate: 450,   stdHrs: 160, otRate: 0,    eobi: true,  fuel: 0,    gym: 0,    sec: 500  },
  { name: 'Hira Javed',       dept: 'Customer Svc', type: 'hourly',  rate: 500,   stdHrs: 160, otRate: 0,    eobi: false, fuel: 0,    gym: 0,    sec: 500  },
  { name: 'Usman Tariq',      dept: 'Dispatch',     type: 'hourly',  rate: 470,   stdHrs: 160, otRate: 0,    eobi: true,  fuel: 0,    gym: 0,    sec: 500  },
  { name: 'Maria Aslam',      dept: 'Customer Svc', type: 'hourly',  rate: 490,   stdHrs: 160, otRate: 0,    eobi: true,  fuel: 0,    gym: 0,    sec: 500  },
  // Fixed monthly — supervisors / management
  { name: 'Fatima Noor',      dept: 'QA',           type: 'fixed',   salary: 65000, stdHrs: 176, otRate: 350,eobi: true,  fuel: 3000, gym: 0,    sec: 1000 },
  { name: 'Zubair Ahmed',     dept: 'IT',           type: 'fixed',   salary: 90000, stdHrs: 176, otRate: 480,eobi: true,  fuel: 5000, gym: 1500, sec: 1000 },
  { name: 'Ayesha Siddiqui',  dept: 'HR',           type: 'fixed',   salary: 75000, stdHrs: 176, otRate: 400,eobi: true,  fuel: 3000, gym: 1500, sec: 1000 },
  { name: 'Omar Farooq',      dept: 'Management',   type: 'fixed',   salary: 150000,stdHrs: 176, otRate: 800,eobi: true,  fuel: 8000, gym: 2000, sec: 0    },
  { name: 'Kamran Sheikh',    dept: 'Management',   type: 'fixed',   salary: 200000,stdHrs: 176, otRate: 1100,eobi:true,  fuel: 10000,gym: 2000, sec: 0    },
]

// ── Per-run variables ─────────────────────────────────────────────────
const hoursWorked    = [185, 160, 172, 168, 180, 164, 192, 180, 188, 200, 185]
const paidHolidays   = [8,   8,   8,   8,   8,   8,   0,   0,   0,   0,   0  ]  // hourly agents get paid holiday hours
const eidDays        = [0,   2,   0,   0,   2,   0,   2,   0,   2,   3,   3  ]  // Eid ul Fitr this month
const qualityBonus   = [2000,3500,1500,2000,1000,2500,5000,3000,4000,0,   0  ]
const advances       = [5000,0,   0,   3000,0,   0,   0,   10000,0,  0,   0  ]
const loans          = [0,   8000,0,   0,   5000,0,   0,   0,   12000,0,  0  ]

// ── Calculate ─────────────────────────────────────────────────────────
const rows = employees.map((e, i) => {
  const hrs    = hoursWorked[i]
  const phHrs  = paidHolidays[i]
  const eidD   = eidDays[i]
  const qBonus = qualityBonus[i]
  const adv    = advances[i]
  const loan   = loans[i]

  let basic = 0, otPay = 0, otHrs = 0, phPay = 0

  if (e.type === 'hourly') {
    const totalHrs = hrs + phHrs
    basic  = Math.round(e.rate * totalHrs)
    phPay  = Math.round(e.rate * phHrs)
  } else {
    basic = e.salary
    const totalHrs = hrs + phHrs
    if (totalHrs > e.stdHrs) {
      otHrs = totalHrs - e.stdHrs
      otPay = Math.round(e.otRate * otHrs)
    }
  }

  // Eid double pay — extra day-rate × eid days
  const dailyRate = e.type === 'hourly' ? e.rate * 8 : e.salary / 26
  const eidPay    = Math.round(dailyRate * eidD)

  const gross   = basic + otPay + eidPay + e.fuel + e.gym + qBonus
  const tax     = monthlyTax(gross)
  const eobiE   = e.eobi ? EOBI_EMP : 0
  const eobiEr  = e.eobi ? EOBI_EER : 0
  const totalD  = tax + eobiE + adv + loan + e.sec
  const net     = gross - totalD

  return {
    'Employee Name':            e.name,
    'Department':               e.dept,
    'Pay Type':                 e.type === 'hourly' ? 'Hourly' : 'Fixed Monthly',
    'Hourly Rate (PKR)':        e.type === 'hourly' ? e.rate : '',
    'Hours Worked':             hrs,
    'Paid Holiday Hours':       phHrs || '',
    'Overtime Hours':           otHrs || '',
    'Eid Days':                 eidD  || '',
    'Basic Pay (PKR)':          basic,
    'Overtime Pay (PKR)':       otPay  || '',
    'Paid Holiday Pay (PKR)':   phPay  || '',
    'Eid Double Pay (PKR)':     eidPay || '',
    'Fuel Allowance (PKR)':     e.fuel || '',
    'Gym Allowance (PKR)':      e.gym  || '',
    'Quality Bonus (PKR)':      qBonus || '',
    'Gross Pay (PKR)':          gross,
    'WHT — FBR (PKR)':          tax    || '',
    'EOBI Employee (PKR)':      eobiE  || '',
    'Advance Repayment (PKR)':  adv    || '',
    'Loan Instalment (PKR)':    loan   || '',
    'Security Deduction (PKR)': e.sec  || '',
    'Total Deductions (PKR)':   totalD,
    'Net Pay (PKR)':            net,
    'EOBI Employer (PKR)':      eobiEr || '',
  }
})

// ── Totals row ─────────────────────────────────────────────────────────
const numCols = [
  'Hours Worked','Basic Pay (PKR)','Overtime Pay (PKR)','Paid Holiday Pay (PKR)',
  'Eid Double Pay (PKR)','Fuel Allowance (PKR)','Gym Allowance (PKR)',
  'Quality Bonus (PKR)','Gross Pay (PKR)','WHT — FBR (PKR)',
  'EOBI Employee (PKR)','Advance Repayment (PKR)','Loan Instalment (PKR)',
  'Security Deduction (PKR)','Total Deductions (PKR)','Net Pay (PKR)',
  'EOBI Employer (PKR)',
]
const totals = { 'Employee Name': 'TOTAL' }
for (const col of numCols)
  totals[col] = rows.reduce((s, r) => s + (Number(r[col]) || 0), 0)

rows.push(totals)

// ── Workbook ──────────────────────────────────────────────────────────
const ws = XLSX.utils.json_to_sheet(rows)
ws['!cols'] = [
  { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
  { wch: 13 }, { wch: 18 }, { wch: 15 }, { wch: 10 },
  { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
  { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
  { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
  { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 18 },
]

const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, 'April 2026 Payroll')

const out = 'C:/Users/GD-CCE/Desktop/CCE_Payroll_Sample_April2026.xlsx'
XLSX.writeFile(wb, out)
console.log('Saved:', out)

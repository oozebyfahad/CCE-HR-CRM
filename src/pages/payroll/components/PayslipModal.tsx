import { X, Download } from 'lucide-react'
import type { PayrollEntry } from '../../../hooks/useFirebasePayroll'
import { fmtPKR } from '../../../utils/payroll'
import * as XLSX from 'xlsx'

interface Props {
  entry:   PayrollEntry
  month:   string   // 'YYYY-MM'
  onClose: () => void
}

function EarningRow({ label, value }: { label: string; value: number }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-blue-600">{fmtPKR(value)}</span>
    </div>
  )
}

function DeductRow({ label, value }: { label: string; value: number }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-red-500">{fmtPKR(value)}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{title}</div>
      {children}
    </div>
  )
}

export default function PayslipModal({ entry, month, onClose }: Props) {
  const r   = entry.result
  const d   = new Date(month + '-01')
  const lbl = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const handleExport = () => {
    const rows = [
      ['CCE EMPLOYEE PAYSLIP', '', ''],
      [lbl, '', ''],
      [],
      ['Employee',   entry.employeeName, ''],
      ['Department', entry.department,   ''],
      ['Pay Type',   entry.payType === 'hourly' ? 'Hourly' : 'Fixed Monthly', ''],
      ['Hours Worked', String(entry.hoursWorked), ''],
      [],
      ['EARNINGS', '', ''],
      ['Basic Pay',              fmtPKR(r.basicPay),         ''],
      ...(r.overtimePay    > 0 ? [['Overtime Pay',      fmtPKR(r.overtimePay),    `${r.overtimeHours} hrs`]] : []),
      ...(r.paidHolidayPay > 0 ? [['Paid Holiday Pay',  fmtPKR(r.paidHolidayPay), '']] : []),
      ...(r.eidPay         > 0 ? [['Eid Double Pay',    fmtPKR(r.eidPay),          '']] : []),
      ...(r.fuelAllowance  > 0 ? [['Fuel Allowance',    fmtPKR(r.fuelAllowance),   '']] : []),
      ...(r.gymAllowance   > 0 ? [['Gym Allowance',     fmtPKR(r.gymAllowance),    '']] : []),
      ...(r.qualityBonus   > 0 ? [['Quality Bonus',     fmtPKR(r.qualityBonus),    '']] : []),
      ...(r.otherAdditions > 0 ? [['Other Additions',   fmtPKR(r.otherAdditions),  '']] : []),
      ['Gross Pay',              fmtPKR(r.grossPay),         ''],
      [],
      ['DEDUCTIONS', '', ''],
      ...(r.withholdingTax    > 0 ? [['Withholding Tax (FBR)', fmtPKR(r.withholdingTax),    '']] : []),
      ...(r.eobiEmployee      > 0 ? [['EOBI (Employee)',        fmtPKR(r.eobiEmployee),      '']] : []),
      ...(r.advanceRepay      > 0 ? [['Advance Repayment',      fmtPKR(r.advanceRepay),      '']] : []),
      ...(r.loanRepay         > 0 ? [['Loan Instalment',        fmtPKR(r.loanRepay),         '']] : []),
      ...(r.securityDeduction > 0 ? [['Security Deduction',     fmtPKR(r.securityDeduction), '']] : []),
      ...(r.otherDeductions   > 0 ? [['Other Deductions',       fmtPKR(r.otherDeductions),   '']] : []),
      ['Total Deductions',       fmtPKR(r.totalDeductions),  ''],
      [],
      ['NET PAY', fmtPKR(r.netPay), ''],
      [],
      ['EMPLOYER CONTRIBUTION (not deducted)', '', ''],
      ['EOBI (Employer)', fmtPKR(r.eobiEmployer), ''],
    ]

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Payslip')
    XLSX.writeFile(wb, `Payslip_${entry.employeeName.replace(/\s+/g, '_')}_${month}.xlsx`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-sm font-bold text-secondary">Payslip — {lbl}</p>
            <p className="text-xs text-gray-400 mt-0.5">{entry.employeeName} · {entry.department}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition">
              <Download size={12} /> Export
            </button>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { l: 'Pay Type',     v: entry.payType === 'hourly' ? 'Hourly' : 'Fixed Monthly' },
              { l: 'Hours Worked', v: `${entry.hoursWorked} hrs` },
              ...(r.overtimeHours  > 0 ? [{ l: 'Overtime',      v: `${r.overtimeHours} hrs`         }] : []),
              ...(entry.eidDays    > 0 ? [{ l: 'Eid Days',       v: `${entry.eidDays} days`          }] : []),
              ...(entry.paidHolidayHours > 0 ? [{ l: 'Paid Holidays', v: `${entry.paidHolidayHours} hrs` }] : []),
            ].map(m => (
              <div key={m.l} className="bg-gray-50 rounded-lg px-3 py-1.5">
                <p className="text-[10px] text-gray-400">{m.l}</p>
                <p className="text-xs font-bold text-secondary">{m.v}</p>
              </div>
            ))}
          </div>

          {/* Earnings */}
          <Section title="Earnings">
            <EarningRow label="Basic Pay"                          value={r.basicPay}         />
            <EarningRow label={`Overtime (${r.overtimeHours} hrs)`} value={r.overtimePay}     />
            <EarningRow label="Paid Holiday Pay"                   value={r.paidHolidayPay}   />
            <EarningRow label="Eid Double Pay"                     value={r.eidPay}           />
            <EarningRow label="Fuel Allowance"                     value={r.fuelAllowance}    />
            <EarningRow label="Gym Allowance"                      value={r.gymAllowance}     />
            <EarningRow label="Quality Bonus"                      value={r.qualityBonus}     />
            <EarningRow label="Other Additions"                    value={r.otherAdditions}   />
            <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100">
              <span className="text-xs font-bold text-secondary">Gross Pay</span>
              <span className="text-sm font-bold text-emerald-600">{fmtPKR(r.grossPay)}</span>
            </div>
          </Section>

          {/* Deductions */}
          <Section title="Deductions">
            <DeductRow label="Withholding Tax (FBR)" value={r.withholdingTax}    />
            <DeductRow label="EOBI (Employee)"        value={r.eobiEmployee}     />
            <DeductRow label="Advance Repayment"      value={r.advanceRepay}     />
            <DeductRow label="Loan Instalment"        value={r.loanRepay}        />
            <DeductRow label="Security Deduction"     value={r.securityDeduction}/>
            <DeductRow label="Other Deductions"       value={r.otherDeductions}  />
            {r.totalDeductions === 0 && (
              <p className="text-xs text-gray-400 py-2 text-center">No deductions this month.</p>
            )}
            <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100">
              <span className="text-xs font-bold text-secondary">Total Deductions</span>
              <span className="text-sm font-bold text-red-500">{fmtPKR(r.totalDeductions)}</span>
            </div>
          </Section>

          {/* Net Pay */}
          <div className="mt-4 bg-secondary rounded-xl px-5 py-4 flex justify-between items-center">
            <span className="text-sm font-semibold text-white/70">Net Pay</span>
            <span className="text-2xl font-bold text-white">{fmtPKR(r.netPay)}</span>
          </div>

          {/* Employer side */}
          {r.eobiEmployer > 0 && (
            <Section title="Employer Contribution (not deducted from employee)">
              <div className="flex justify-between items-center py-1.5">
                <span className="text-xs text-gray-500">EOBI (Employer)</span>
                <span className="text-xs font-medium text-gray-600">{fmtPKR(r.eobiEmployer)}</span>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

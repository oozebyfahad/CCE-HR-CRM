import { useState } from 'react'
import { Plus, CreditCard, HandCoins, CheckCircle, Clock, RefreshCw, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useFirebaseAdvances, useFirebaseLoans, type Advance, type Loan } from '../../hooks/useFirebaseAdvances'
import { useAppSelector } from '../../store'
import { cn } from '../../utils/cn'

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-amber-100  text-amber-700',
  approved: 'bg-blue-100   text-blue-700',
  repaying: 'bg-purple-100 text-purple-700',
  settled:  'bg-green-100  text-green-700',
}

function formatPKR(n: number) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n)
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
      <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function Advances() {
  const user = useAppSelector(s => s.auth.user)
  const isHR = user?.role === 'admin' || user?.role === 'hr'

  const { advances, loading: advLoading, requestAdvance, approveAdvance, recordRepayment, deleteAdvance } = useFirebaseAdvances()
  const { loans, loading: loanLoading, requestLoan, approveLoan, recordInstalment, deleteLoan } = useFirebaseLoans()

  const [tab, setTab]               = useState<'advances' | 'loans'>('advances')
  const [showAdvForm, setShowAdvForm] = useState(false)
  const [showLoanForm, setShowLoanForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Advance form state
  const [advForm, setAdvForm] = useState({ employeeId: '', employeeName: '', department: '', amount: '', monthlyDeduct: '', reason: '' })
  // Loan form state
  const [loanForm, setLoanForm] = useState({ employeeId: '', employeeName: '', department: '', amount: '', monthlyInstalment: '', totalInstalments: '', purpose: '' })

  const totalAdvancePending  = advances.reduce((s, a) => s + (a.amount - a.amountRepaid), 0)
  const totalLoanPending     = loans.reduce((s, l) => s + (l.amount - l.amountRepaid), 0)
  const activeAdvances       = advances.filter(a => a.status === 'repaying').length
  const activeLoans          = loans.filter(l => l.status === 'repaying').length

  async function submitAdvance() {
    if (!advForm.employeeId || !advForm.amount) return
    await requestAdvance({
      employeeId: advForm.employeeId, employeeName: advForm.employeeName,
      department: advForm.department, amount: Number(advForm.amount),
      monthlyDeduct: Number(advForm.monthlyDeduct), reason: advForm.reason,
    })
    setAdvForm({ employeeId: '', employeeName: '', department: '', amount: '', monthlyDeduct: '', reason: '' })
    setShowAdvForm(false)
  }

  async function submitLoan() {
    if (!loanForm.employeeId || !loanForm.amount) return
    await requestLoan({
      employeeId: loanForm.employeeId, employeeName: loanForm.employeeName,
      department: loanForm.department, amount: Number(loanForm.amount),
      monthlyInstalment: Number(loanForm.monthlyInstalment),
      totalInstalments: Number(loanForm.totalInstalments), purpose: loanForm.purpose,
    })
    setLoanForm({ employeeId: '', employeeName: '', department: '', amount: '', monthlyInstalment: '', totalInstalments: '', purpose: '' })
    setShowLoanForm(false)
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'
  const loading = advLoading || loanLoading

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advances & Loans</h1>
          <p className="text-sm text-gray-500 mt-0.5">Salary advances and employee loan management</p>
        </div>
        {isHR && (
          <div className="flex gap-2">
            <button onClick={() => setShowAdvForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors">
              <Plus size={16} /> New Advance
            </button>
            <button onClick={() => setShowLoanForm(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors">
              <Plus size={16} /> New Loan
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Advances', value: activeAdvances,              icon: CreditCard,  color: 'bg-blue-50 text-blue-600' },
          { label: 'Advance Balance', value: formatPKR(totalAdvancePending), icon: HandCoins,   color: 'bg-amber-50 text-amber-600' },
          { label: 'Active Loans',   value: activeLoans,                  icon: RefreshCw,   color: 'bg-purple-50 text-purple-600' },
          { label: 'Loan Balance',   value: formatPKR(totalLoanPending),     icon: CheckCircle, color: 'bg-green-50 text-green-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
            <div className={cn('p-2 rounded-lg', color)}><Icon size={20} /></div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-lg font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(['advances', 'loans'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-5 py-1.5 rounded-md text-sm font-medium capitalize transition-all',
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
          >{t}</button>
        ))}
      </div>

      {/* Advance form */}
      {showAdvForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">New Salary Advance</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <input className={inputCls} placeholder="Employee ID" value={advForm.employeeId} onChange={e => setAdvForm(f => ({...f, employeeId: e.target.value}))} />
            <input className={inputCls} placeholder="Employee Name" value={advForm.employeeName} onChange={e => setAdvForm(f => ({...f, employeeName: e.target.value}))} />
            <input className={inputCls} placeholder="Department" value={advForm.department} onChange={e => setAdvForm(f => ({...f, department: e.target.value}))} />
            <input className={inputCls} placeholder="Amount (PKR)" type="number" value={advForm.amount} onChange={e => setAdvForm(f => ({...f, amount: e.target.value}))} />
            <input className={inputCls} placeholder="Monthly Deduction (PKR)" type="number" value={advForm.monthlyDeduct} onChange={e => setAdvForm(f => ({...f, monthlyDeduct: e.target.value}))} />
            <input className={inputCls} placeholder="Reason" value={advForm.reason} onChange={e => setAdvForm(f => ({...f, reason: e.target.value}))} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={submitAdvance} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">Submit</button>
            <button onClick={() => setShowAdvForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {/* Loan form */}
      {showLoanForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">New Employee Loan</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <input className={inputCls} placeholder="Employee ID" value={loanForm.employeeId} onChange={e => setLoanForm(f => ({...f, employeeId: e.target.value}))} />
            <input className={inputCls} placeholder="Employee Name" value={loanForm.employeeName} onChange={e => setLoanForm(f => ({...f, employeeName: e.target.value}))} />
            <input className={inputCls} placeholder="Department" value={loanForm.department} onChange={e => setLoanForm(f => ({...f, department: e.target.value}))} />
            <input className={inputCls} placeholder="Principal Amount (PKR)" type="number" value={loanForm.amount} onChange={e => setLoanForm(f => ({...f, amount: e.target.value}))} />
            <input className={inputCls} placeholder="Monthly Instalment (PKR)" type="number" value={loanForm.monthlyInstalment} onChange={e => setLoanForm(f => ({...f, monthlyInstalment: e.target.value}))} />
            <input className={inputCls} placeholder="Total Instalments" type="number" value={loanForm.totalInstalments} onChange={e => setLoanForm(f => ({...f, totalInstalments: e.target.value}))} />
            <input className={inputCls} placeholder="Purpose" value={loanForm.purpose} onChange={e => setLoanForm(f => ({...f, purpose: e.target.value}))} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={submitLoan} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">Submit</button>
            <button onClick={() => setShowLoanForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : tab === 'advances' ? (
        <AdvanceTable
          advances={advances} isHR={isHR} expandedId={expandedId}
          setExpandedId={setExpandedId} onApprove={approveAdvance}
          onRepay={recordRepayment} onDelete={deleteAdvance}
        />
      ) : (
        <LoanTable
          loans={loans} isHR={isHR} expandedId={expandedId}
          setExpandedId={setExpandedId} onApprove={approveLoan}
          onInstalment={recordInstalment} onDelete={deleteLoan}
        />
      )}
    </div>
  )
}

// ── Advance Table ─────────────────────────────────────────────────────
function AdvanceTable({ advances, isHR, expandedId, setExpandedId, onApprove, onRepay, onDelete }: {
  advances: Advance[]; isHR: boolean; expandedId: string | null
  setExpandedId: (id: string | null) => void
  onApprove: (id: string, by: string) => void
  onRepay: (id: string, amt: number, newTotal: number, orig: number) => void
  onDelete: (id: string) => void
}) {
  const [repayAmounts, setRepayAmounts] = useState<Record<string, string>>({})

  if (!advances.length) return <Empty label="No salary advances recorded yet." />

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            {['Employee','Department','Amount','Repaid','Remaining','Monthly Deduct','Status',''].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {advances.map(a => {
            const remaining = a.amount - a.amountRepaid
            const expanded  = expandedId === a.id
            return (
              <>
                <tr key={a.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.employeeName}</td>
                  <td className="px-4 py-3 text-gray-600">{a.department}</td>
                  <td className="px-4 py-3 text-gray-900">{formatPKR(a.amount)}</td>
                  <td className="px-4 py-3 text-green-600">{formatPKR(a.amountRepaid)}</td>
                  <td className="px-4 py-3">
                    <span className={remaining > 0 ? 'text-red-600 font-medium' : 'text-green-600'}>{formatPKR(remaining)}</span>
                    <ProgressBar value={a.amountRepaid} max={a.amount} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatPKR(a.monthlyDeduct)}/mo</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_STYLES[a.status])}>{a.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {isHR && a.status === 'pending' && (
                        <button onClick={() => onApprove(a.id, 'HR')} className="text-xs text-blue-600 hover:underline">Approve</button>
                      )}
                      {isHR && a.status === 'repaying' && (
                        <button onClick={() => setExpandedId(expanded ? null : a.id)} className="text-gray-400 hover:text-gray-600">
                          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                      {isHR && a.status === 'pending' && (
                        <button onClick={() => onDelete(a.id)} className="text-red-400 hover:text-red-600 ml-1"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
                {expanded && (
                  <tr key={`${a.id}-expand`}>
                    <td colSpan={8} className="px-4 py-3 bg-blue-50/40">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">Record repayment:</span>
                        <input
                          type="number" placeholder="PKR amount" value={repayAmounts[a.id] ?? ''}
                          onChange={e => setRepayAmounts(r => ({...r, [a.id]: e.target.value}))}
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-primary/40"
                        />
                        <button
                          onClick={() => {
                            const amt = Number(repayAmounts[a.id] ?? 0)
                            if (amt > 0) { onRepay(a.id, amt, a.amountRepaid + amt, a.amount); setRepayAmounts(r => ({...r, [a.id]: ''})) }
                          }}
                          className="px-3 py-1.5 bg-primary text-white text-xs rounded-lg hover:bg-primary/90"
                        >Record</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Loan Table ────────────────────────────────────────────────────────
function LoanTable({ loans, isHR, expandedId, setExpandedId, onApprove, onInstalment, onDelete }: {
  loans: Loan[]; isHR: boolean; expandedId: string | null
  setExpandedId: (id: string | null) => void
  onApprove: (id: string, by: string) => void
  onInstalment: (id: string, inst: number, newTotal: number, paid: number, total: number, principal: number) => void
  onDelete: (id: string) => void
}) {
  const [instAmounts, setInstAmounts] = useState<Record<string, string>>({})

  if (!loans.length) return <Empty label="No employee loans recorded yet." />

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            {['Employee','Purpose','Principal','Repaid','Instalments','Monthly','Status',''].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {loans.map(l => {
            const expanded = expandedId === l.id
            return (
              <>
                <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{l.employeeName}</td>
                  <td className="px-4 py-3 text-gray-600">{l.purpose ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-900">{formatPKR(l.amount)}</td>
                  <td className="px-4 py-3 text-green-600">{formatPKR(l.amountRepaid)}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{l.paidInstalments}/{l.totalInstalments}</span>
                    <ProgressBar value={l.paidInstalments} max={l.totalInstalments} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatPKR(l.monthlyInstalment)}/mo</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize', STATUS_STYLES[l.status])}>{l.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {isHR && l.status === 'pending' && (
                        <button onClick={() => onApprove(l.id, 'HR')} className="text-xs text-blue-600 hover:underline">Approve</button>
                      )}
                      {isHR && l.status === 'repaying' && (
                        <button onClick={() => setExpandedId(expanded ? null : l.id)} className="text-gray-400 hover:text-gray-600">
                          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      )}
                      {isHR && l.status === 'pending' && (
                        <button onClick={() => onDelete(l.id)} className="text-red-400 hover:text-red-600 ml-1"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
                {expanded && (
                  <tr key={`${l.id}-expand`}>
                    <td colSpan={8} className="px-4 py-3 bg-purple-50/40">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600">Record instalment ({formatPKR(l.monthlyInstalment)}):</span>
                        <input
                          type="number" placeholder={String(l.monthlyInstalment)} value={instAmounts[l.id] ?? ''}
                          onChange={e => setInstAmounts(r => ({...r, [l.id]: e.target.value}))}
                          className="border border-gray-300 rounded px-2 py-1 text-sm w-36 focus:outline-none focus:ring-1 focus:ring-purple-300"
                        />
                        <button
                          onClick={() => {
                            const amt = Number(instAmounts[l.id] ?? l.monthlyInstalment)
                            if (amt > 0) {
                              onInstalment(l.id, amt, l.amountRepaid + amt, l.paidInstalments + 1, l.totalInstalments, l.amount)
                              setInstAmounts(r => ({...r, [l.id]: ''}))
                            }
                          }}
                          className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700"
                        >Record</button>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
      <Clock size={40} className="mx-auto text-gray-200 mb-3" />
      <p className="text-gray-400 text-sm">{label}</p>
    </div>
  )
}

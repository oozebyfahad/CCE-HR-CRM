import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, collection, query, where, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../config/firebase'
import {
  ArrowLeft, Download, Pencil, Mail, Phone, MapPin, Calendar,
  Building2, Briefcase, ChevronDown, FileText,
  ShieldCheck, Heart, GraduationCap, Package, Plus, Send,
  Target, MessageSquare, ClipboardList, Info, Search, Check, X,
} from 'lucide-react'
import { Badge, statusVariant } from '../../components/common/Badge'
import { useCurrency } from '../../context/CurrencyContext'
import { EMPLOYMENT_TYPE_LABELS, STATUS_LABELS } from '../../utils/constants'
import { PAY_TYPE_LABELS } from '../../utils/payroll'
import type { FirebaseEmployee } from '../../hooks/useFirebaseEmployees'
import { exportSingleEmployee } from '../../utils/exportExcel'
import AddEditEmployeeModal from './components/AddEditEmployeeModal'
import TimesheetTab from './components/TimesheetTab'
import { cn } from '../../utils/cn'

// ── Tab config ────────────────────────────────────────────────────────
const PRIMARY_TABS = ['Personal','Job','Time Off','Pay Info','Documents','Performance','Timesheet','Benefits','Training','Assets'] as const
const MORE_TABS    = ['Emergency','Notes'] as const
type Tab = typeof PRIMARY_TABS[number] | typeof MORE_TABS[number]

// ── Leave config ──────────────────────────────────────────────────────
type LeaveKey = 'annual' | 'sick' | 'casual' | 'unpaid' | 'public_holiday'
const LEAVE_TYPES: { key: LeaveKey; label: string; color: string; defaultTotal: number; defaultPaid: boolean }[] = [
  { key: 'annual',         label: 'Annual Leave',    color: '#2E86C1', defaultTotal: 10, defaultPaid: true  },
  { key: 'public_holiday', label: 'Public Holidays', color: '#F59E0B', defaultTotal: 10, defaultPaid: true  },
  { key: 'sick',           label: 'Sick Leave',      color: '#10B981', defaultTotal: 10, defaultPaid: true  },
  { key: 'casual',         label: 'Casual Leave',    color: '#8B5CF6', defaultTotal: 5,  defaultPaid: true  },
  { key: 'unpaid',         label: 'Unpaid Leave',    color: '#9CA3AF', defaultTotal: 0,  defaultPaid: false },
]

interface LeaveRecord {
  id: string
  type: LeaveKey
  startDate: string
  endDate: string
  days: number
  status: 'pending' | 'approved' | 'declined'
  reason?: string
  createdAt?: string
}

// ── Helpers ───────────────────────────────────────────────────────────
const fmt      = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : '—'
const fmtShort = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB') : '—'

function Empty({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-300">
      <Icon size={36} strokeWidth={1.2} />
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-3.5 bg-gray-50/80 border-b border-gray-100">
        <p className="text-sm font-bold text-secondary">{title}</p>
      </div>
      {children}
    </div>
  )
}

function InfoTable({ rows }: { rows: [string, string | number | undefined][] }) {
  const visible = rows.filter(([, v]) => v !== undefined && v !== '')
  if (!visible.length) return <p className="px-6 py-8 text-xs text-gray-400 text-center">No data on record.</p>
  return (
    <table className="w-full">
      <tbody>
        {visible.map(([k, v]) => (
          <tr key={k} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
            <td className="px-6 py-3 text-xs text-gray-400 font-medium w-48">{k}</td>
            <td className="px-6 py-3 text-xs font-semibold text-secondary">{String(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DataTable({ cols, rows }: { cols: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/50">
            {cols.map(c => <th key={c} className="px-6 py-2.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide text-left whitespace-nowrap">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40 transition-colors">
              {row.map((cell, j) => <td key={j} className="px-6 py-3.5 text-xs text-secondary">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VitalItem({ icon: Icon, value }: { icon: React.ElementType; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={13} className="text-gray-400 mt-0.5 shrink-0" />
      <span className="text-xs text-gray-600 break-all leading-relaxed">{value}</span>
    </div>
  )
}

// ── More dropdown ─────────────────────────────────────────────────────
function MoreMenu({ tab, onSelect }: { tab: Tab; onSelect: (t: Tab) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isActive = (MORE_TABS as readonly string[]).includes(tab)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex items-center gap-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
          isActive ? 'border-white text-white' : 'border-transparent text-white/40 hover:text-white/70'
        )}>
        More <ChevronDown size={13} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl py-1 min-w-[160px] z-30">
          {MORE_TABS.map(t => (
            <button key={t} onClick={() => { onSelect(t); setOpen(false) }}
              className={cn(
                'w-full text-left px-4 py-2.5 text-sm transition-colors',
                tab === t ? 'text-primary font-semibold bg-primary/5' : 'text-gray-700 hover:bg-gray-50'
              )}>
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────
export default function EmployeeProfile() {
  const { id }    = useParams<{ id: string }>()
  const navigate  = useNavigate()
  const { fmt: fmtCurrency } = useCurrency()
  const [emp,          setEmp]         = useState<FirebaseEmployee | null>(null)
  const [loading,      setLoading]     = useState(true)
  const [tab,          setTab]         = useState<Tab>('Personal')
  const [perfTab,      setPerfTab]     = useState<'Goals' | 'Feedback' | 'Assessments'>('Goals')
  const [editing,      setEditing]     = useState(false)
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([])
  const [leaveEditing, setLeaveEditing] = useState(false)
  const [leaveDraft,   setLeaveDraft]   = useState<Record<LeaveKey, { total: number; paid: boolean }> | null>(null)
  const [leaveSaving,  setLeaveSaving]  = useState(false)

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'employees', id), snap => {
      setEmp(snap.exists() ? ({ id: snap.id, ...snap.data() } as FirebaseEmployee) : null)
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [id])

  useEffect(() => {
    if (!id) return
    const q = query(collection(db, 'leave_requests'), where('employeeId', '==', id))
    const unsub = onSnapshot(q, snap => {
      setLeaveRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as LeaveRecord)))
    }, () => {})
    return unsub
  }, [id])

  const handleUpdate = async (data: Omit<FirebaseEmployee, 'id'>) => {
    if (!id) return
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null))
    await updateDoc(doc(db, 'employees', id), { ...clean, updatedAt: serverTimestamp() })
    setEditing(false)
  }

  const startLeaveEdit = () => {
    if (!emp) return
    const policy = emp.leavePolicy
    setLeaveDraft({
      annual:         { total: policy?.annual?.total          ?? 10, paid: policy?.annual?.paid          ?? true  },
      public_holiday: { total: policy?.public_holiday?.total  ?? 10, paid: policy?.public_holiday?.paid  ?? true  },
      sick:           { total: policy?.sick?.total            ?? 10, paid: policy?.sick?.paid            ?? true  },
      casual:         { total: policy?.casual?.total          ?? 5,  paid: policy?.casual?.paid          ?? true  },
      unpaid:         { total: policy?.unpaid?.total          ?? 0,  paid: policy?.unpaid?.paid          ?? false },
    })
    setLeaveEditing(true)
  }

  const saveLeavePolicy = async () => {
    if (!id || !leaveDraft) return
    setLeaveSaving(true)
    await updateDoc(doc(db, 'employees', id), { leavePolicy: leaveDraft, updatedAt: serverTimestamp() })
    setLeaveSaving(false)
    setLeaveEditing(false)
    setLeaveDraft(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-3 text-gray-400">
      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      Loading profile…
    </div>
  )

  if (!emp) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-gray-500">Employee not found.</p>
      <button onClick={() => navigate('/employees')} className="btn-primary text-sm">← Back to Directory</button>
    </div>
  )

  const initials = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="space-y-0 -mt-2">

      {/* ── Header banner ──────────────────────────────────────────── */}
      <div className="bg-secondary rounded-2xl overflow-hidden">

        <div className="px-6 pt-4 pb-1">
          <button onClick={() => navigate('/employees')}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-xs transition-colors">
            <ArrowLeft size={13} /> Back to Directory
          </button>
        </div>

        <div className="flex items-end justify-between px-6 pb-0 pt-3">
          <div className="flex items-end gap-5">
            <div className="w-20 h-20 rounded-xl bg-primary flex items-center justify-center text-white text-2xl font-bold shrink-0 mb-1 shadow-lg">
              {initials}
            </div>
            <div className="pb-3">
              <h1 className="text-2xl font-bold text-white leading-tight">{emp.name}</h1>
              <p className="text-white/60 text-sm mt-0.5">{emp.jobTitle}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-mono text-white/40">{emp.employeeId}</span>
                <span className="text-white/20">·</span>
                <Badge variant={statusVariant(emp.status)} size="xs" dot>
                  {STATUS_LABELS[emp.status] ?? emp.status}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pb-4">
            <button onClick={() => exportSingleEmployee(emp)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors">
              <Download size={13} /> Download
            </button>
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-secondary text-sm font-semibold hover:bg-white/90 transition-colors">
              <Pencil size={13} /> Edit
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex px-4 border-t border-white/10 overflow-x-auto scrollbar-none">
          {PRIMARY_TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                'shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap',
                tab === t ? 'border-white text-white' : 'border-transparent text-white/40 hover:text-white/70'
              )}>
              {t}
            </button>
          ))}
          <MoreMenu tab={tab} onSelect={setTab} />
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="flex gap-5 pt-5 items-start">

        {/* Left sidebar */}
        <div className="w-56 shrink-0 space-y-3">
          <div className="card p-4 space-y-2.5">
            {emp.phone          && <VitalItem icon={Phone}   value={emp.phone} />}
            {emp.email          && <VitalItem icon={Mail}    value={emp.email} />}
            {emp.currentAddress && <VitalItem icon={MapPin}  value={emp.currentAddress} />}
          </div>

          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-1.5">
              <Briefcase size={11} className="text-gray-400" />
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Employment</span>
            </div>
            {([
              ['Type',       EMPLOYMENT_TYPE_LABELS[emp.employmentType] ?? emp.employmentType],
              ['Department', emp.department],
              emp.project ? ['Project', emp.project] : null,
            ] as ([string,string] | null)[]).filter((x): x is [string,string] => x !== null).map(([k, v]) => (
              <div key={k}>
                <p className="text-[9px] text-gray-400 uppercase tracking-wide">{k}</p>
                <p className="text-xs font-semibold text-secondary mt-0.5">{v}</p>
              </div>
            ))}
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar size={11} className="text-gray-400" />
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Hire Date</span>
            </div>
            <p className="text-sm font-bold text-secondary">{fmt(emp.startDate)}</p>
          </div>


          <div className="card p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Building2 size={11} className="text-gray-400" />
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Department</span>
            </div>
            <p className="text-sm font-bold text-secondary">{emp.department}</p>
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* ── Personal ── */}
          {tab === 'Personal' && (
            <>
              <SectionCard title="Contact Information">
                <InfoTable rows={[
                  ['Email Address',          emp.email],
                  ['Phone Number',           emp.phone],
                  ['Date of Birth',          emp.dob ? fmt(emp.dob) : undefined],
                  ['Gender',                 emp.gender],
                  ['CNIC / National ID',     emp.cnic],
                  ['Marital Status',         emp.maritalStatus],
                  ['Religion',               emp.religion],
                ]} />
              </SectionCard>
              <SectionCard title="Family Information">
                <InfoTable rows={[
                  ['Father / Husband Name',  emp.fatherHusbandName],
                  ['Mother Name',            emp.motherName],
                  ['Name of Kin',            emp.emergencyContactName],
                  ['Kin Contact',            emp.emergencyContactPhone],
                  ['Relationship',           emp.emergencyContactRelation],
                  ['Type of Contact',        emp.emergencyContactType],
                ]} />
              </SectionCard>
              <SectionCard title="Address">
                <InfoTable rows={[
                  ['Current City',           emp.currentCity],
                  ['Hometown',               emp.hometown],
                  ['Current Address',        emp.currentAddress],
                  ['Permanent Address',      emp.permanentAddress],
                ]} />
              </SectionCard>
            </>
          )}

          {/* ── Job ── */}
          {tab === 'Job' && (
            <>
              <div className="card p-5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Hire Date</p>
                <p className="text-3xl font-bold text-secondary">{fmt(emp.startDate)}</p>
              </div>
              <SectionCard title="Employment Status">
                <DataTable
                  cols={['Effective Date','Employment Status','Comment']}
                  rows={[[
                    fmtShort(emp.startDate),
                    <Badge variant={statusVariant(emp.status)} size="xs" dot>{STATUS_LABELS[emp.status] ?? emp.status}</Badge>,
                    '—',
                  ]]}
                />
              </SectionCard>
              <SectionCard title="Job Information">
                <DataTable
                  cols={['Effective Date','Department','Project / Client','Job Title']}
                  rows={[[
                    fmtShort(emp.startDate),
                    emp.department || '—',
                    emp.project || '—',
                    <span className="font-semibold">{emp.jobTitle}</span>,
                  ]]}
                />
              </SectionCard>
              <SectionCard title="Employment Type">
                <DataTable
                  cols={['Effective Date','Employment Type']}
                  rows={[[fmtShort(emp.startDate), EMPLOYMENT_TYPE_LABELS[emp.employmentType] ?? emp.employmentType]]}
                />
              </SectionCard>
              {emp.salary && (
                <SectionCard title="Compensation">
                  <DataTable
                    cols={['Effective Date','Monthly Salary','Type']}
                    rows={[[
                      fmtShort(emp.startDate),
                      <span className="font-bold text-secondary text-sm">{fmtCurrency(emp.salary)}</span>,
                      EMPLOYMENT_TYPE_LABELS[emp.employmentType] ?? emp.employmentType,
                    ]]}
                  />
                </SectionCard>
              )}
            </>
          )}

          {/* ── Time Off ── */}
          {tab === 'Time Off' && (() => {
            const policy = emp.leavePolicy
            const approvedRecords = leaveRecords.filter(r => r.status === 'approved')
            const usedByType = (key: LeaveKey) =>
              approvedRecords.filter(r => r.type === key).reduce((s, r) => s + (r.days ?? 0), 0)

            return (
              <>
                {/* Leave Balances */}
                <div className="card overflow-hidden">
                  <div className="px-6 py-3.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-sm font-bold text-secondary">Leave Balances</p>
                    {leaveEditing ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setLeaveEditing(false); setLeaveDraft(null) }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition">
                          <X size={12} /> Cancel
                        </button>
                        <button
                          onClick={saveLeavePolicy}
                          disabled={leaveSaving}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold hover:bg-secondary/90 transition disabled:opacity-50">
                          <Check size={12} /> {leaveSaving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={startLeaveEdit}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition">
                        <Pencil size={11} /> Edit Allocations
                      </button>
                    )}
                  </div>

                  <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-5">
                    {LEAVE_TYPES.map(lt => {
                      const total = leaveEditing
                        ? (leaveDraft?.[lt.key]?.total ?? lt.defaultTotal)
                        : (policy?.[lt.key]?.total ?? lt.defaultTotal)
                      const isPaid = leaveEditing
                        ? (leaveDraft?.[lt.key]?.paid ?? lt.defaultPaid)
                        : (policy?.[lt.key]?.paid ?? lt.defaultPaid)
                      const used = usedByType(lt.key)
                      const isUnlimited = total === 0 && !isPaid
                      const remaining = isUnlimited ? '∞' : Math.max(0, total - used)
                      const pct = (total > 0 && !isUnlimited) ? Math.min(100, (used / total) * 100) : 0

                      return (
                        <div key={lt.key} className="space-y-2.5">
                          {/* Label + paid badge */}
                          <div className="flex items-start justify-between gap-1">
                            <p className="text-xs font-semibold text-secondary leading-tight">{lt.label}</p>
                            {leaveEditing ? (
                              <button
                                onClick={() => setLeaveDraft(d => d ? { ...d, [lt.key]: { ...d[lt.key], paid: !d[lt.key].paid } } : d)}
                                className={cn(
                                  'text-[9px] px-1.5 py-0.5 rounded-full font-semibold border transition shrink-0',
                                  (leaveDraft?.[lt.key]?.paid ?? lt.defaultPaid)
                                    ? 'bg-green-100 text-green-700 border-green-200'
                                    : 'bg-gray-100 text-gray-500 border-gray-200'
                                )}>
                                {(leaveDraft?.[lt.key]?.paid ?? lt.defaultPaid) ? 'Paid' : 'Unpaid'}
                              </button>
                            ) : (
                              <span className={cn(
                                'text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0',
                                isPaid ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                              )}>
                                {isPaid ? 'Paid' : 'Unpaid'}
                              </span>
                            )}
                          </div>

                          {/* Remaining count or editable input */}
                          {leaveEditing ? (
                            <div className="space-y-1">
                              <label className="text-[9px] text-gray-400 uppercase tracking-wide">Total Days</label>
                              <input
                                type="number"
                                min={0}
                                value={leaveDraft?.[lt.key]?.total ?? lt.defaultTotal}
                                onChange={e => setLeaveDraft(d => d ? {
                                  ...d,
                                  [lt.key]: { ...d[lt.key], total: Math.max(0, parseInt(e.target.value) || 0) }
                                } : d)}
                                className="w-full px-2 py-1.5 text-sm font-bold border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-center"
                                style={{ color: lt.color }}
                              />
                            </div>
                          ) : (
                            <div className="flex items-end justify-between">
                              <span className="text-2xl font-bold" style={{ color: lt.color }}>{remaining}</span>
                              <span className="text-[10px] text-gray-400 mb-0.5">remaining</span>
                            </div>
                          )}

                          {/* Progress bar */}
                          {!leaveEditing && (
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: lt.color }} />
                            </div>
                          )}

                          {/* Stats */}
                          <p className="text-[10px] text-gray-400">
                            {used} used
                            {!isUnlimited && ` of ${total}`}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Leave History */}
                <SectionCard title="Leave History">
                  {leaveRecords.length === 0 ? (
                    <Empty icon={Calendar} label="No leave requests on record." />
                  ) : (
                    <DataTable
                      cols={['Type', 'From', 'To', 'Days', 'Status', 'Reason']}
                      rows={[...leaveRecords]
                        .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))
                        .map(r => {
                          const lt = LEAVE_TYPES.find(l => l.key === r.type)
                          const statusStyles: Record<string, string> = {
                            approved: 'bg-green-100 text-green-700',
                            pending:  'bg-amber-100 text-amber-700',
                            declined: 'bg-red-100 text-red-600',
                          }
                          return [
                            <span className="font-medium" style={{ color: lt?.color }}>{lt?.label ?? r.type}</span>,
                            fmtShort(r.startDate),
                            fmtShort(r.endDate),
                            r.days,
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize', statusStyles[r.status] ?? 'bg-gray-100 text-gray-500')}>
                              {r.status}
                            </span>,
                            r.reason ?? '—',
                          ]
                        })}
                    />
                  )}
                </SectionCard>
              </>
            )
          })()}

          {/* ── Pay Info ── */}
          {tab === 'Pay Info' && (
            <>
              {emp.salary && (
                <div className="card p-6">
                  <div className="mb-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Monthly Salary</p>
                  </div>
                  <p className="text-4xl font-bold text-secondary mt-2">{fmtCurrency(emp.salary)}</p>
                  <p className="text-xs text-gray-400 mt-1">{EMPLOYMENT_TYPE_LABELS[emp.employmentType] ?? emp.employmentType}</p>
                </div>
              )}
              <SectionCard title="Pay Information">
                <InfoTable rows={[
                  ['Pay Type',               emp.payType ? (PAY_TYPE_LABELS[emp.payType] ?? emp.payType) : undefined],
                  ['Monthly Salary (PKR)',    emp.salary != null ? `PKR ${emp.salary.toLocaleString()}` : undefined],
                  ['Monthly Hours Threshold', emp.monthlyHours != null ? `${emp.monthlyHours} hrs` : undefined],
                  ['Overtime Rate (PKR / hr)',emp.overtimeRate != null ? `PKR ${emp.overtimeRate.toLocaleString()}` : undefined],
                  ['Hourly Rate (PKR / hr)',  emp.hourlyRate != null ? `PKR ${emp.hourlyRate.toLocaleString()}` : undefined],
                ]} />
              </SectionCard>
              <SectionCard title="Banking Details">
                <InfoTable rows={[
                  ['Account / IBAN', emp.accountNumber],
                ]} />
              </SectionCard>
            </>
          )}

          {/* ── Documents ── */}
          {tab === 'Documents' && (
            <>
              <SectionCard title="Employment Documents">
                <Empty icon={FileText} label="No documents uploaded yet." />
              </SectionCard>
              <SectionCard title="Identity & Compliance">
                <Empty icon={ShieldCheck} label="No compliance documents on record." />
              </SectionCard>
              <SectionCard title="Character Certificate">
                <InfoTable rows={[
                  ['Character Certificate Expiry', emp.characterCertificateExpiry ? fmt(emp.characterCertificateExpiry) : undefined],
                ]} />
              </SectionCard>
            </>
          )}

          {/* ── Performance ── */}
          {tab === 'Performance' && (
            <div className="space-y-4">

              {/* Sub-tab bar */}
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 border-b border-gray-100">
                  <div className="flex">
                    {(['Goals','Feedback','Assessments'] as const).map((t, i) => {
                      const icons = [Target, MessageSquare, ClipboardList]
                      const Icon = icons[i]
                      return (
                        <button key={t} onClick={() => setPerfTab(t)}
                          className={cn(
                            'flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                            perfTab === t
                              ? 'border-secondary text-secondary'
                              : 'border-transparent text-gray-400 hover:text-gray-600'
                          )}>
                          <Icon size={14} />
                          {t}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* ── Goals ── */}
                {perfTab === 'Goals' && (
                  <div className="p-5">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between mb-5">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition">
                        <Plus size={13} /> New Goal
                      </button>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Status</span>
                        <select className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20">
                          <option>All</option>
                          <option>In Progress</option>
                          <option>Completed</option>
                          <option>Not Started</option>
                        </select>
                      </div>
                    </div>

                    {/* Goal cards */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      {[
                        { title: 'Complete Onboarding & Training Programme',   pct: 100, due: '31 Dec 2024', done: true  },
                        { title: 'Achieve Monthly KPI Targets for Q1 2025',    pct: 68,  due: '31 Mar 2025', done: false },
                        { title: 'Obtain Customer Service Excellence Certificate', pct: 35, due: '30 Jun 2025', done: false },
                        { title: 'Lead a Team Project or Process Improvement', pct: 0,   due: '31 Oct 2025', done: false },
                      ].map(g => (
                        <div key={g.title}
                          className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer">
                          <p className="text-sm font-semibold text-secondary leading-snug mb-4">{g.title}</p>
                          <div className="space-y-1.5 mb-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xl font-bold" style={{ color: g.done ? '#10B981' : g.pct > 0 ? '#2E86C1' : '#9CA3AF' }}>
                                {g.pct}%
                              </span>
                              <span className="text-[10px] text-gray-400">complete</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{
                                  width: `${g.pct}%`,
                                  backgroundColor: g.done ? '#10B981' : g.pct > 0 ? '#2E86C1' : '#E5E7EB',
                                }} />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400">Due: {g.due}</span>
                            {g.done
                              ? <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Completed</span>
                              : g.pct > 0
                                ? <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">In Progress</span>
                                : <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">Not Started</span>
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Feedback ── */}
                {perfTab === 'Feedback' && (
                  <div className="p-5 space-y-5">
                    {/* Period */}
                    <div className="flex items-center gap-2">
                      <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20">
                        <option>Last 6 Months</option>
                        <option>Last 12 Months</option>
                        <option>This Year</option>
                        <option>All Time</option>
                      </select>
                    </div>

                    {/* Privacy note */}
                    <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                      <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">Feedback responses are confidential and hidden from {emp.name.split(' ')[0]}.</p>
                    </div>

                    {/* Request feedback */}
                    <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Send size={14} className="text-gray-400" />
                        <p className="text-sm font-semibold text-secondary">Request feedback about {emp.name.split(' ')[0]}</p>
                      </div>
                      <p className="text-xs text-gray-400">Select employees who work with {emp.name.split(' ')[0]}</p>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            placeholder="Search employee names…"
                          />
                        </div>
                        <button className="flex items-center gap-1.5 px-4 py-2 bg-secondary text-white text-sm font-medium rounded-lg hover:bg-secondary/90 transition">
                          Send Request
                        </button>
                      </div>
                    </div>

                    {/* Pending requests */}
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Waiting for feedback from…</p>
                      {[
                        { name: 'Line Manager', role: 'Manager',   sent: 'Mon, 21 Oct 2024', due: 'Tue, 5 Nov 2024 (14 days)' },
                        { name: 'Team Colleague',              role: 'Peer',      sent: 'Mon, 21 Oct 2024', due: 'Tue, 5 Nov 2024 (14 days)' },
                      ].map(r => (
                        <div key={r.name} className="flex items-start justify-between gap-4 border border-gray-100 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                              {r.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-secondary">{r.name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{r.role}</p>
                              <p className="text-xs text-gray-500 mt-1.5">
                                An email requesting {r.name.split(' ')[0]} complete feedback was sent {r.sent}.<br />
                                <span className="text-gray-400">{r.name.split(' ')[0]} has until {r.due} to complete this.</span>
                              </p>
                            </div>
                          </div>
                          <button className="text-xs text-red-400 hover:text-red-600 transition whitespace-nowrap font-medium mt-0.5">✕ Cancel</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Assessments ── */}
                {perfTab === 'Assessments' && (
                  <div className="p-5 space-y-5">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between">
                      <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20">
                        <option>May 1, 2024 · Half Annual Review</option>
                        <option>Nov 1, 2024 · Year-End Review</option>
                        <option>May 1, 2025 · Half Annual Review</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">
                          Employee View
                        </button>
                        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-white text-sm font-medium rounded-lg hover:bg-secondary/90 transition">
                          <Plus size={13} /> Start an Assessment
                        </button>
                      </div>
                    </div>

                    {/* Assessment cards */}
                    <div className="grid sm:grid-cols-2 gap-4">

                      {/* Self Assessment */}
                      <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-100">
                          <p className="text-sm font-bold text-secondary">Self Assessment</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Completed {fmt(emp.startDate)} · by {emp.name}
                          </p>
                        </div>
                        <div className="p-4 space-y-4">
                          {[
                            {
                              q: 'How well does the company recognise your value?',
                              a: 'I feel highly valued. My contributions are acknowledged regularly in team meetings and I\'ve received constructive feedback that has helped me grow professionally.',
                            },
                            {
                              q: 'What would have the greatest impact on your ability to do your best work more often?',
                              a: 'Access to additional training resources and more frequent one-on-one sessions with my manager would help me perform at a higher level consistently.',
                            },
                            {
                              q: 'What are some things I do well?',
                              a: 'I am reliable, detail-oriented, and work well under pressure. I consistently meet my targets and communicate proactively with the team.',
                            },
                          ].map(item => (
                            <div key={item.q} className="space-y-1.5">
                              <p className="text-xs font-semibold text-secondary leading-snug">{item.q}</p>
                              <p className="text-xs text-gray-500 leading-relaxed">{item.a}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Manager Assessment */}
                      <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-100">
                          <p className="text-sm font-bold text-secondary">Manager Assessment</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Completed {fmt(emp.startDate)} · by Manager
                          </p>
                        </div>
                        <div className="p-4 space-y-4">
                          {[
                            {
                              q: 'What are some things this employee does well?',
                              a: `${emp.name.split(' ')[0]} has been a valuable asset to the team. We promoted a lot of talent when we restructured and they stepped up as we ramped up hiring. They are incredibly organised, professional and great to work alongside.`,
                            },
                            {
                              q: `How could ${emp.name.split(' ')[0]} improve?`,
                              a: `I would like ${emp.name.split(' ')[0]} to get more experience presenting to larger groups. They does amazing work that impacts the entire company. I believe that for her to have the most impact, she should work on her confidence presenting.`,
                            },
                            {
                              q: 'Overall performance rating',
                              a: 'Exceeds Expectations — consistently delivers high-quality work and demonstrates initiative beyond their core responsibilities.',
                            },
                          ].map(item => (
                            <div key={item.q} className="space-y-1.5">
                              <p className="text-xs font-semibold text-secondary leading-snug">{item.q}</p>
                              <p className="text-xs text-gray-500 leading-relaxed">{item.a}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ── Timesheet ── */}
          {tab === 'Timesheet' && <TimesheetTab emp={emp} />}

          {/* ── Benefits ── */}
          {tab === 'Benefits' && (
            <>
              <SectionCard title="Enrolled Benefits">
                <DataTable
                  cols={['Benefit', 'Plan', 'Coverage', 'Effective Date', 'Status']}
                  rows={[
                    ['Health Insurance', 'Standard Plan', 'Employee + Family', fmtShort(emp.startDate), <Badge variant="success" size="xs" dot>Active</Badge>],
                    ['Pension / 401k',   '5% Contribution', 'Employee Match',  fmtShort(emp.startDate), <Badge variant="success" size="xs" dot>Active</Badge>],
                    ['Life Insurance',   '2× Monthly Salary','Employee',         fmtShort(emp.startDate), <Badge variant="success" size="xs" dot>Active</Badge>],
                  ]}
                />
              </SectionCard>
              <SectionCard title="Other Benefits">
                <DataTable
                  cols={['Benefit', 'Details', 'Status']}
                  rows={[
                    ['Annual Leave',  '20 days / year', <Badge variant="success" size="xs">Included</Badge>],
                    ['Sick Leave',    '10 days / year', <Badge variant="success" size="xs">Included</Badge>],
                    ['Remote Work',   'As per policy',  <Badge variant="neutral" size="xs">Policy-based</Badge>],
                  ]}
                />
              </SectionCard>
            </>
          )}

          {/* ── Training ── */}
          {tab === 'Training' && (
            <>
              <SectionCard title="Enrolled Courses">
                <Empty icon={GraduationCap} label="No training courses assigned." />
              </SectionCard>
              <SectionCard title="Completed Training">
                <Empty icon={GraduationCap} label="No completed training records." />
              </SectionCard>
            </>
          )}

          {/* ── Assets ── */}
          {tab === 'Assets' && (
            <SectionCard title="Assigned Assets">
              <Empty icon={Package} label="No assets currently assigned to this employee." />
            </SectionCard>
          )}

          {/* ── Emergency (More) ── */}
          {tab === 'Emergency' && (
            <>
              <SectionCard title="Emergency Contact">
                {emp.emergencyContactName ? (
                  <div className="p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-sm font-bold shrink-0">
                        {emp.emergencyContactName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-secondary">{emp.emergencyContactName}</p>
                        {emp.emergencyContactPhone && (
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                            <Phone size={11} className="text-gray-400" />
                            {emp.emergencyContactPhone}
                          </p>
                        )}
                      </div>
                    </div>
                    <InfoTable rows={[
                      ['Relationship',    emp.emergencyContactRelation],
                      ['Type of Contact', emp.emergencyContactType],
                    ]} />
                  </div>
                ) : (
                  <Empty icon={Heart} label="No emergency contact on record." />
                )}
              </SectionCard>
              <SectionCard title="Employment Details">
                <InfoTable rows={[
                  ['Company Name',   emp.companyName],
                  ['Referred By',    emp.referredBy],
                ]} />
              </SectionCard>
            </>
          )}

          {/* ── Notes ── */}
          {tab === 'Notes' && (
            <div className="card p-12 text-center text-gray-400 text-sm">No notes on record.</div>
          )}

        </div>
      </div>

      {/* Edit modal */}
      {editing && (
        <AddEditEmployeeModal employee={emp} onSave={handleUpdate} onClose={() => setEditing(false)} />
      )}
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Users, Search, Download, UserCheck, UserX, Eye,
  FileText, AlertTriangle, X, QrCode, ExternalLink,
  ChevronDown, Filter, Clock, CheckCircle, Trash2,
} from 'lucide-react'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { Avatar } from '../../components/common/Avatar'
import { Badge } from '../../components/common/Badge'
import { cn } from '../../utils/cn'
import { useFirebaseApplicants, type Applicant, type RejectedRecord } from '../../hooks/useFirebaseApplicants'
import AddEditEmployeeModal from '../employees/components/AddEditEmployeeModal'
import { useFirebaseEmployees } from '../../hooks/useFirebaseEmployees'
import type { FirebaseEmployee } from '../../hooks/useFirebaseEmployees'

const APPLY_URL = `${window.location.origin}/apply`

const STATUS_CONFIG: Record<Applicant['status'], { label: string; color: string; bg: string }> = {
  new:         { label: 'New',         color: 'text-blue-700',  bg: 'bg-blue-100'  },
  reviewing:   { label: 'Reviewing',   color: 'text-amber-700', bg: 'bg-amber-100' },
  shortlisted: { label: 'Shortlisted', color: 'text-purple-700',bg: 'bg-purple-100'},
  hired:       { label: 'Hired',       color: 'text-green-700', bg: 'bg-green-100' },
  rejected:    { label: 'Rejected',    color: 'text-red-700',   bg: 'bg-red-100'   },
}

// ── Toast ───────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }: { msg: string; type: 'success'|'error'; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [onDone])
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-xl shadow-xl text-sm font-semibold text-white flex items-center gap-2 animate-slide-up',
      type === 'success' ? 'bg-green-600' : 'bg-red-600'
    )}>
      {type === 'success' ? '✓' : '✕'} {msg}
    </div>
  )
}

// ── Status pill ─────────────────────────────────────────────────────────
function StatusPill({ status }: { status: Applicant['status'] }) {
  const c = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold', c.color, c.bg)}>
      {c.label}
    </span>
  )
}

// ── Export single applicant ─────────────────────────────────────────────
function exportApplicant(a: Applicant) {
  const rows = [
    ['CCE Applicant Profile'],
    [`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`],
    [],
    ['Field', 'Value'],
    ['Full Name',            a.name],
    ['Email',                a.email],
    ['Phone',                a.phone],
    ['Date of Birth',        a.dob             ?? ''],
    ['Gender',               a.gender          ?? ''],
    ['CNIC / National ID',   a.cnic            ?? ''],
    ['Current Address',      a.currentAddress  ?? ''],
    ['Position Applied',     a.positionApplied],
    ['Department',           a.department],
    ['Experience',           a.experience      ?? ''],
    ['Education',            a.education       ?? ''],
    ['Cover Letter',         a.coverLetter     ?? ''],
    ['Applied Date',         a.appliedDate],
    ['CV Link',              a.cvLink ?? 'Not provided'],
    ['Previously Rejected',  a.appliedBefore ? `Yes (for ${a.appliedBeforeRole})` : 'No'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 22 }, { wch: 50 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Applicant')
  XLSX.writeFile(wb, `CCE_Applicant_${a.name.replace(/\s+/g, '_')}.xlsx`)
}

// ── Applicant detail modal ──────────────────────────────────────────────
function ApplicantModal({
  applicant, onClose, onReject, onHire, onDelete, onStatusChange,
}: {
  applicant: Applicant
  onClose: () => void
  onReject: () => void
  onHire: () => void
  onDelete: () => void
  onStatusChange: (s: Applicant['status']) => void
}) {
  const statuses: Applicant['status'][] = ['new', 'reviewing', 'shortlisted']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-4">
            <Avatar name={applicant.name} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-800">{applicant.name}</h2>
                {applicant.appliedBefore && (
                  <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertTriangle size={10} /> Applied Before
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{applicant.positionApplied} · {applicant.department}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => exportApplicant(applicant)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">
              <Download size={13} /> Download
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Previously rejected warning */}
          {applicant.appliedBefore && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-700">Previously Rejected</p>
                <p className="text-xs text-red-600 mt-0.5">
                  This applicant was previously rejected for: <strong>{applicant.appliedBeforeRole || 'unknown role'}</strong>
                </p>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {/* Personal */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Personal Info</p>
              {[
                ['Email',    applicant.email],
                ['Phone',    applicant.phone],
                ['DOB',      applicant.dob],
                ['Gender',   applicant.gender],
                ['CNIC',     applicant.cnic],
                ['Address',  applicant.currentAddress],
              ].filter(([,v]) => v).map(([l, v]) => (
                <div key={l} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <span className="text-xs text-gray-400">{l}</span>
                  <span className="text-xs text-gray-700 font-semibold text-right max-w-[60%]">{v}</span>
                </div>
              ))}
            </div>

            {/* Application */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Application</p>
              {[
                ['Position',    applicant.positionApplied],
                ['Department',  applicant.department],
                ['Experience',  applicant.experience],
                ['Education',   applicant.education],
                ['Applied',     applicant.appliedDate],
              ].filter(([,v]) => v).map(([l, v]) => (
                <div key={l} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
                  <span className="text-xs text-gray-400">{l}</span>
                  <span className="text-xs text-gray-700 font-semibold text-right max-w-[60%]">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cover Letter */}
          {applicant.coverLetter && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Cover Letter</p>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{applicant.coverLetter}</p>
            </div>
          )}

          {/* CV Link */}
          {applicant.cvLink && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-blue-500" />
                <div>
                  <p className="text-sm font-semibold text-blue-700">CV / Resume</p>
                  <p className="text-xs text-blue-500 truncate max-w-[260px]">{applicant.cvLink}</p>
                </div>
              </div>
              <a href={applicant.cvLink} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition shrink-0">
                <ExternalLink size={13} /> Open CV
              </a>
            </div>
          )}

          {/* Status change */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Update Status</p>
            <div className="flex flex-wrap gap-2">
              {statuses.map(s => (
                <button key={s} onClick={() => onStatusChange(s)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition border',
                    applicant.status === s
                      ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color} border-transparent`
                      : 'border-gray-200 text-gray-500 hover:bg-gray-100'
                  )}>
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={onReject}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-sm rounded-xl transition">
              <UserX size={15} /> Reject
            </button>
            <button onClick={onDelete}
              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-gray-400 hover:text-gray-600 font-semibold text-sm rounded-xl transition">
              <Trash2 size={15} /> Delete
            </button>
          </div>
          <button onClick={onHire}
            className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-xl transition shadow-lg shadow-green-600/20">
            <UserCheck size={15} /> Hire — Add to Employees
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Rejected list modal ─────────────────────────────────────────────────
function RejectedModal({ records, onClose }: { records: RejectedRecord[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
              <UserX size={16} className="text-red-500" />
            </div>
            <h2 className="font-bold text-gray-800">Previously Rejected ({records.length})</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {records.length === 0 && (
            <p className="p-8 text-center text-sm text-gray-400">No rejected applicants yet</p>
          )}
          {records.map(r => (
            <div key={r.id} className="px-6 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700">{r.name}</p>
                <p className="text-xs text-gray-400">{r.email}</p>
                {r.cnic && <p className="text-xs text-gray-400">CNIC: {r.cnic}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 font-medium">{r.positionApplied}</p>
                <p className="text-xs text-gray-400 mt-0.5">{r.rejectedDate}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── QR modal ────────────────────────────────────────────────────────────
function QRModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm text-center p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-gray-800">Application QR Code</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-inner">
            <QRCodeSVG value={APPLY_URL} size={200} level="H" includeMargin />
          </div>
        </div>
        <p className="text-sm font-semibold text-gray-700 mb-1">Scan to apply</p>
        <p className="text-xs text-gray-400 break-all">{APPLY_URL}</p>
        <a href={APPLY_URL} target="_blank" rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium">
          <ExternalLink size={12} /> Open form in browser
        </a>
      </div>
    </div>
  )
}

// ── Reject confirm modal ────────────────────────────────────────────────
function RejectConfirm({ name, onConfirm, onClose, confirming }: {
  name: string; onConfirm: () => void; onClose: () => void; confirming: boolean
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} className="text-red-500" />
        </div>
        <h3 className="text-center font-bold text-gray-800 mb-2">Reject Applicant</h3>
        <p className="text-center text-sm text-gray-500 mb-6">
          Reject <strong>{name}</strong>? Their CV and photo will be deleted. Their name and email will be kept for duplicate tracking.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={onConfirm} disabled={confirming}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-60">
            {confirming ? 'Rejecting…' : 'Confirm Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Delete confirm modal (2-step) ───────────────────────────────────────
function DeleteConfirm({ name, onConfirm, onClose, confirming }: {
  name: string; onConfirm: () => void; onClose: () => void; confirming: boolean
}) {
  const [step, setStep] = useState(1)
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className={cn(
          'w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4',
          step === 1 ? 'bg-red-100' : 'bg-red-200'
        )}>
          <Trash2 size={22} className="text-red-600" />
        </div>

        {step === 1 ? (
          <>
            <h3 className="text-center font-bold text-gray-800 mb-2">Delete Application</h3>
            <p className="text-center text-sm text-gray-500 mb-6">
              Are you sure you want to permanently delete <strong>{name}</strong>'s application?
              This will remove all their data with no archive copy.
            </p>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={() => setStep(2)}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition">
                Delete
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-center font-bold text-red-700 mb-2">Final Confirmation</h3>
            <p className="text-center text-sm text-gray-500 mb-2">
              This will <strong>permanently erase all data</strong> for <strong>{name}</strong>.
            </p>
            <p className="text-center text-xs text-red-500 font-semibold mb-6">There is no way to recover this.</p>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={onConfirm} disabled={confirming}
                className="flex-1 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-xl text-sm font-semibold transition disabled:opacity-60">
                {confirming ? 'Deleting…' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────
export default function Recruitment() {
  const { applicants, rejected, loading, rejectApplicant, updateApplicant, removeApplicant } = useFirebaseApplicants()
  const { addEmployee } = useFirebaseEmployees()

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewApp,      setViewApp]      = useState<Applicant | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Applicant | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Applicant | null>(null)
  const [confirming,   setConfirming]   = useState(false)
  const [hireApp,      setHireApp]      = useState<Applicant | null>(null)
  const [showRejected, setShowRejected] = useState(false)
  const [showQR,       setShowQR]       = useState(false)
  const [toast,        setToast]        = useState<{ msg: string; type: 'success'|'error' }|null>(null)

  const notify = (msg: string, type: 'success'|'error' = 'success') => setToast({ msg, type })

  const filtered = applicants.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.positionApplied.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    return matchSearch && matchStatus
  })

  // Stats
  const today = new Date().toISOString().split('T')[0]
  const newToday = applicants.filter(a => a.appliedDate === today).length

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return
    setConfirming(true)
    try {
      await rejectApplicant(rejectTarget)
      setRejectTarget(null)
      setViewApp(null)
      notify('Applicant rejected and record archived')
    } catch { notify('Failed to reject applicant', 'error') }
    finally { setConfirming(false) }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setConfirming(true)
    try {
      await removeApplicant(deleteTarget.id)
      setDeleteTarget(null)
      setViewApp(null)
      notify('Application permanently deleted')
    } catch { notify('Failed to delete application', 'error') }
    finally { setConfirming(false) }
  }

  // Convert applicant → employee pre-fill data
  const applicantToEmployee = (a: Applicant): Partial<Omit<FirebaseEmployee, 'id'>> => ({
    name:           a.name,
    email:          a.email,
    phone:          a.phone,
    dob:            a.dob            ?? '',
    gender:         a.gender         ?? '',
    cnic:           a.cnic           ?? '',
    currentAddress: a.currentAddress ?? '',
    jobTitle:       a.positionApplied,
    department:     a.department,
    employmentType: 'full_time',
    status:         'active',
    startDate:      today,
    employeeId:     '',
  })

  const handleHireSave = async (data: Omit<FirebaseEmployee, 'id'>) => {
    try {
      await addEmployee(data)
      if (hireApp) await removeApplicant(hireApp.id)
      setHireApp(null)
      setViewApp(null)
      notify('Employee added successfully')
    } catch { notify('Failed to add employee', 'error') }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="page-header">Recruitment</h2>
          <p className="page-sub">{applicants.length} applicants · {rejected.length} previously rejected</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowRejected(true)}
            className="btn-outline text-sm gap-2">
            <UserX size={14} /> Rejected ({rejected.length})
          </button>
          <button onClick={() => setShowQR(true)}
            className="btn-outline text-sm gap-2">
            <QrCode size={14} /> QR Code
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Applicants', value: applicants.length,                                        color: '#2E86C1', icon: Users },
          { label: 'New Today',        value: newToday,                                                 color: '#10B981', icon: Clock },
          { label: 'Shortlisted',      value: applicants.filter(a => a.status === 'shortlisted').length, color: '#8B5CF6', icon: CheckCircle },
          { label: 'Reviewing',        value: applicants.filter(a => a.status === 'reviewing').length,   color: '#F59E0B', icon: Eye },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${s.color}15` }}>
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xl font-bold text-secondary">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, position…"
              className="input pl-9 text-sm w-full" />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-gray-400" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-auto text-sm">
              <option value="all">All Statuses</option>
              {(Object.keys(STATUS_CONFIG) as Applicant['status'][]).map(s => (
                <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} results</span>
        </div>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {/* Column headers */}
        <div className="px-6 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide flex items-center border-b border-gray-100 bg-gray-50/70">
          <div className="flex-grow">Applicant</div>
          <div className="w-36 shrink-0 hidden md:block">Position</div>
          <div className="w-28 shrink-0 hidden lg:block">Department</div>
          <div className="w-24 shrink-0 hidden lg:block">Applied</div>
          <div className="w-28 shrink-0">Status</div>
          <div className="w-8 shrink-0" />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading applicants…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Users size={24} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">No applicants found</p>
            <p className="text-gray-400 text-sm mt-1">Share the QR code to start receiving applications</p>
            <button onClick={() => setShowQR(true)} className="btn-primary text-sm mt-4 gap-2">
              <QrCode size={14} /> Show QR Code
            </button>
          </div>
        )}

        {!loading && filtered.map(app => (
          <div key={app.id}
            onClick={() => setViewApp(app)}
            className="w-full flex items-center px-6 py-3.5 border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors cursor-pointer text-sm">

            {/* Avatar + name */}
            <div className="flex-grow flex items-center gap-3 overflow-hidden min-w-0">
              <div className="shrink-0">
                <Avatar name={app.name} size="sm" />
              </div>
              <div className="overflow-hidden">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-secondary truncate">{app.name}</p>
                  {app.appliedBefore && (
                    <span className="hidden sm:inline-flex items-center gap-0.5 bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                      <AlertTriangle size={9} /> Prior
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate">{app.email}</p>
              </div>
            </div>

            <div className="w-36 shrink-0 hidden md:block">
              <span className="text-xs text-gray-600 truncate block">{app.positionApplied}</span>
            </div>
            <div className="w-28 shrink-0 hidden lg:block">
              <span className="text-xs text-gray-500">{app.department}</span>
            </div>
            <div className="w-24 shrink-0 hidden lg:block">
              <span className="text-xs text-gray-400">{app.appliedDate}</span>
            </div>
            <div className="w-28 shrink-0">
              <StatusPill status={app.status} />
            </div>
            <div className="w-8 shrink-0 flex justify-end">
              <Eye size={14} className="text-gray-300" />
            </div>
          </div>
        ))}

        {!loading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/30">
            <p className="text-xs text-gray-400">Showing {filtered.length} of {applicants.length} applicants</p>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {viewApp && !rejectTarget && !deleteTarget && !hireApp && (
        <ApplicantModal
          applicant={viewApp}
          onClose={() => setViewApp(null)}
          onReject={() => setRejectTarget(viewApp)}
          onDelete={() => setDeleteTarget(viewApp)}
          onHire={() => setHireApp(viewApp)}
          onStatusChange={async (s) => {
            await updateApplicant(viewApp.id, { status: s })
            setViewApp(prev => prev ? { ...prev, status: s } : prev)
            notify('Status updated')
          }}
        />
      )}

      {rejectTarget && (
        <RejectConfirm
          name={rejectTarget.name}
          onConfirm={handleRejectConfirm}
          onClose={() => setRejectTarget(null)}
          confirming={confirming}
        />
      )}

      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
          confirming={confirming}
        />
      )}

      {hireApp && (
        <AddEditEmployeeModal
          employee={{ id: '', ...applicantToEmployee(hireApp) } as FirebaseEmployee}
          onSave={handleHireSave}
          onClose={() => setHireApp(null)}
        />
      )}

      {showRejected && <RejectedModal records={rejected} onClose={() => setShowRejected(false)} />}
      {showQR       && <QRModal onClose={() => setShowQR(false)} />}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  )
}

import { useState, useMemo } from 'react'
import { ShieldCheck, AlertTriangle, XCircle, FileQuestion, Upload, Filter, Download } from 'lucide-react'
import type { ComplianceDocument, ComplianceDocType, ComplianceStatus } from '../../types'
import { cn } from '../../utils/cn'
import { format, differenceInDays, parseISO } from 'date-fns'

// ── Seed data built from the CCE spreadsheet ──────────────────────────
const TODAY = new Date()
function daysFromNow(dateStr: string) {
  try { return differenceInDays(parseISO(dateStr), TODAY) } catch { return 0 }
}
function computeStatus(expiryDate?: string): ComplianceStatus {
  if (!expiryDate) return 'missing'
  const days = daysFromNow(expiryDate)
  if (days < 0)   return 'expired'
  if (days <= 30) return 'expiring_soon'
  return 'valid'
}

const DOC_LABELS: Record<ComplianceDocType, string> = {
  character_certificate: 'Character Certificate',
  police_verification:   'Police Verification',
  cnic:                  'CNIC',
  ntn:                   'NTN Certificate',
  eobi:                  'EOBI Card',
  education:             'Education Certificate',
  experience_letter:     'Experience Letter',
  medical:               'Medical Certificate',
  offer_letter:          'Offer Letter',
  contract:              'Employment Contract',
}

const STATUS_CONFIG: Record<ComplianceStatus, { label: string; color: string; icon: React.ElementType }> = {
  valid:          { label: 'Valid',          color: 'bg-green-100 text-green-700',  icon: ShieldCheck },
  expiring_soon:  { label: 'Expiring Soon',  color: 'bg-amber-100 text-amber-700',  icon: AlertTriangle },
  expired:        { label: 'Expired',        color: 'bg-red-100 text-red-700',      icon: XCircle },
  missing:        { label: 'Missing',        color: 'bg-gray-100 text-gray-500',    icon: FileQuestion },
}

// Seed character certificates from the spreadsheet (all expire 30-05-2026)
const CERT_EXPIRY = '2026-05-30'
const INITIAL_DOCS: ComplianceDocument[] = [
  { id: 'd1',  employeeId: 'CCE-1001', employeeName: 'Basit Mustafa Jilani',     department: 'Operations', type: 'character_certificate', expiryDate: CERT_EXPIRY, status: computeStatus(CERT_EXPIRY) },
  { id: 'd2',  employeeId: 'CCE-1002', employeeName: 'Junaid Anwar',             department: 'Management', type: 'character_certificate', expiryDate: CERT_EXPIRY, status: computeStatus(CERT_EXPIRY) },
  { id: 'd3',  employeeId: 'CCE-1004', employeeName: 'Afaq Kiyani',              department: 'Dispatch',   type: 'character_certificate', expiryDate: CERT_EXPIRY, status: computeStatus(CERT_EXPIRY) },
  { id: 'd4',  employeeId: 'CCE-1005', employeeName: 'Muhammad Hammad Mughal',   department: 'Operations', type: 'character_certificate', expiryDate: CERT_EXPIRY, status: computeStatus(CERT_EXPIRY) },
  { id: 'd5',  employeeId: 'CCE-1006', employeeName: 'Ayub Naseem Akhtar',       department: 'Operations', type: 'character_certificate', expiryDate: CERT_EXPIRY, status: computeStatus(CERT_EXPIRY) },
  { id: 'd6',  employeeId: 'CCE-1008', employeeName: 'Syed Hasnain Ali Kazmi',   department: 'Dispatch',   type: 'character_certificate', expiryDate: CERT_EXPIRY, status: computeStatus(CERT_EXPIRY) },
  { id: 'd7',  employeeId: 'CCE-1009', employeeName: 'Umer Farooq',              department: 'Operations', type: 'character_certificate', expiryDate: CERT_EXPIRY, status: computeStatus(CERT_EXPIRY) },
  { id: 'd8',  employeeId: 'CCE-1010', employeeName: 'Muhammad Talha Imran Baig',department: 'Dispatch',   type: 'character_certificate', expiryDate: CERT_EXPIRY, status: computeStatus(CERT_EXPIRY) },
  { id: 'd9',  employeeId: 'CCE-1012', employeeName: 'Hammad Javed',             department: 'Dispatch',   type: 'character_certificate', expiryDate: CERT_EXPIRY, status: computeStatus(CERT_EXPIRY) },
  { id: 'd10', employeeId: 'CCE-1013', employeeName: 'Muhammad Zubair Tariq',    department: 'QA',         type: 'character_certificate', expiryDate: CERT_EXPIRY, status: computeStatus(CERT_EXPIRY) },
  { id: 'd11', employeeId: 'CCE-1019', employeeName: 'Yousaf Hassan',            department: 'Dispatch',   type: 'character_certificate', expiryDate: CERT_EXPIRY, status: computeStatus(CERT_EXPIRY) },
  { id: 'd12', employeeId: 'CCE-1020', employeeName: 'Hoor ul Ain',              department: 'Operations', type: 'character_certificate', expiryDate: CERT_EXPIRY, status: computeStatus(CERT_EXPIRY) },
  { id: 'd13', employeeId: 'CCE-1023', employeeName: 'Zaeem Shahid',             department: 'Dispatch',   type: 'character_certificate', expiryDate: CERT_EXPIRY, status: computeStatus(CERT_EXPIRY) },
  { id: 'd14', employeeId: 'CCE-1026', employeeName: 'Huma Kiyani',              department: 'Operations', type: 'character_certificate', expiryDate: CERT_EXPIRY, status: computeStatus(CERT_EXPIRY) },
  // CNIC records
  { id: 'd15', employeeId: 'CCE-1001', employeeName: 'Basit Mustafa Jilani',     department: 'Operations', type: 'cnic', status: 'valid' },
  { id: 'd16', employeeId: 'CCE-1002', employeeName: 'Junaid Anwar',             department: 'Management', type: 'cnic', status: 'valid' },
  { id: 'd17', employeeId: 'CCE-1004', employeeName: 'Afaq Kiyani',              department: 'Dispatch',   type: 'cnic', status: 'valid' },
  { id: 'd18', employeeId: 'CCE-1005', employeeName: 'Muhammad Hammad Mughal',   department: 'Operations', type: 'cnic', status: 'missing' },
  { id: 'd19', employeeId: 'CCE-1006', employeeName: 'Ayub Naseem Akhtar',       department: 'Operations', type: 'cnic', status: 'valid' },
  { id: 'd20', employeeId: 'CCE-1026', employeeName: 'Huma Kiyani',              department: 'Operations', type: 'cnic', status: 'valid' },
]

const ALL_STATUSES: ComplianceStatus[] = ['valid','expiring_soon','expired','missing']
const ALL_TYPES: ComplianceDocType[] = Object.keys(DOC_LABELS) as ComplianceDocType[]

export default function Compliance() {
  const [docs, setDocs]                 = useState<ComplianceDocument[]>(INITIAL_DOCS)
  const [statusFilter, setStatusFilter] = useState<ComplianceStatus | 'all'>('all')
  const [typeFilter, setTypeFilter]     = useState<ComplianceDocType | 'all'>('all')
  const [search, setSearch]             = useState('')
  const [showForm, setShowForm]         = useState(false)
  const [form, setForm]                 = useState({
    employeeId: '', employeeName: '', department: '',
    type: 'character_certificate' as ComplianceDocType,
    issueDate: '', expiryDate: '', notes: '',
  })

  const filtered = useMemo(() => {
    return docs.filter(d => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false
      if (typeFilter   !== 'all' && d.type   !== typeFilter)   return false
      if (search && !d.employeeName.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [docs, statusFilter, typeFilter, search])

  const counts = useMemo(() => ({
    valid:         docs.filter(d => d.status === 'valid').length,
    expiring_soon: docs.filter(d => d.status === 'expiring_soon').length,
    expired:       docs.filter(d => d.status === 'expired').length,
    missing:       docs.filter(d => d.status === 'missing').length,
  }), [docs])

  function addDoc() {
    if (!form.employeeId || !form.type) return
    const status = computeStatus(form.expiryDate || undefined)
    setDocs(d => [...d, { id: `d${Date.now()}`, ...form, status }])
    setForm({ employeeId: '', employeeName: '', department: '', type: 'character_certificate', issueDate: '', expiryDate: '', notes: '' })
    setShowForm(false)
  }

  function updateStatus(id: string, status: ComplianceStatus) {
    setDocs(d => d.map(x => x.id === id ? { ...x, status } : x))
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance & Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track employee document status, expiry dates, and compliance</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">
            <Upload size={16} /> Add Document
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {ALL_STATUSES.map(s => {
          const { label, color, icon: Icon } = STATUS_CONFIG[s]
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className={cn('bg-white rounded-xl border p-4 flex items-center gap-3 shadow-sm text-left transition-all hover:shadow-md',
                statusFilter === s ? 'ring-2 ring-primary' : 'border-gray-100')}>
              <div className={cn('p-2 rounded-lg', color)}><Icon size={20} /></div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{counts[s]}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Expiry Alert Banner */}
      {counts.expiring_soon > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">{counts.expiring_soon} document{counts.expiring_soon > 1 ? 's' : ''} expiring within 30 days</p>
            <p className="text-xs text-amber-700 mt-0.5">
              All character certificates expire on {format(parseISO(CERT_EXPIRY), 'dd MMM yyyy')} — arrange renewals promptly.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary/30"
          placeholder="Search employee..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-1">
          <Filter size={14} className="text-gray-400" />
          <select className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}>
            <option value="all">All Document Types</option>
            {ALL_TYPES.map(t => <option key={t} value={t}>{DOC_LABELS[t]}</option>)}
          </select>
        </div>
        {(statusFilter !== 'all' || typeFilter !== 'all' || search) && (
          <button onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setSearch('') }}
            className="text-xs text-primary hover:underline">Clear filters</button>
        )}
        <span className="ml-auto text-sm text-gray-400">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Add Document Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Add Compliance Document</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <input className={inputCls} placeholder="Employee ID" value={form.employeeId} onChange={e => setForm(f => ({...f, employeeId: e.target.value}))} />
            <input className={inputCls} placeholder="Employee Name" value={form.employeeName} onChange={e => setForm(f => ({...f, employeeName: e.target.value}))} />
            <input className={inputCls} placeholder="Department" value={form.department} onChange={e => setForm(f => ({...f, department: e.target.value}))} />
            <select className={inputCls} value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value as ComplianceDocType}))}>
              {ALL_TYPES.map(t => <option key={t} value={t}>{DOC_LABELS[t]}</option>)}
            </select>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Issue Date</label>
              <input type="date" className={inputCls} value={form.issueDate} onChange={e => setForm(f => ({...f, issueDate: e.target.value}))} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Expiry Date</label>
              <input type="date" className={inputCls} value={form.expiryDate} onChange={e => setForm(f => ({...f, expiryDate: e.target.value}))} />
            </div>
            <input className={inputCls} placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />
          </div>
          <div className="flex gap-2">
            <button onClick={addDoc} className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90">Add</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Employee','Department','Document Type','Issue Date','Expiry Date','Days Left','Status','Action'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(doc => {
              const { label, color, icon: Icon } = STATUS_CONFIG[doc.status]
              const days = doc.expiryDate ? daysFromNow(doc.expiryDate) : null
              return (
                <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{doc.employeeName}</td>
                  <td className="px-4 py-3 text-gray-500">{doc.department}</td>
                  <td className="px-4 py-3 text-gray-700">{DOC_LABELS[doc.type]}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {doc.issueDate ? format(parseISO(doc.issueDate), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {doc.expiryDate ? format(parseISO(doc.expiryDate), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {days === null ? <span className="text-gray-300">—</span>
                      : days < 0   ? <span className="text-red-600 font-medium">{Math.abs(days)}d ago</span>
                      : days <= 30 ? <span className="text-amber-600 font-medium">{days}d</span>
                      :              <span className="text-gray-500">{days}d</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', color)}>
                      <Icon size={11} /> {label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={doc.status}
                      onChange={e => updateStatus(doc.id, e.target.value as ComplianceStatus)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30 text-gray-600"
                    >
                      {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                    </select>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">No documents match the current filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

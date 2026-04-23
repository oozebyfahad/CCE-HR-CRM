import { useState, useEffect, type FormEvent } from 'react'
import { X, ChevronRight } from 'lucide-react'
import { cn } from '../../../utils/cn'
import { DEPARTMENTS } from '../../../utils/constants'
import type { FirebaseEmployee } from '../../../hooks/useFirebaseEmployees'

const TABS = ['Personal', 'Employment', 'Address & Kin', 'Financial', 'Payroll'] as const
type Tab = typeof TABS[number]

const PROJECTS     = ['TakeMe', 'TC Cars', 'A1 Ace Taxis', 'Value Cars', 'Tower Cabs', 'Intercity', 'ADT', 'VGT', '1AB', 'Bounds', 'Birmingham', 'Other']
const EMP_TYPES    = [{ v: 'full_time', l: 'Full-Time' }, { v: 'part_time', l: 'Part-Time' }, { v: 'contract', l: 'Contract' }, { v: 'agency', l: 'Agency' }]
const STATUSES     = [{ v: 'active', l: 'Active' }, { v: 'on_leave', l: 'On Leave' }, { v: 'suspended', l: 'Suspended' }, { v: 'resigned', l: 'Resigned' }, { v: 'terminated', l: 'Terminated' }]
const GENDERS      = ['Male', 'Female', 'Other', 'Prefer not to say']
const MARITAL      = ['Single', 'Married', 'Divorced', 'Widowed']
const RELIGIONS    = ['Islam', 'Christianity', 'Hinduism', 'Other']

const EMPTY: Omit<FirebaseEmployee, 'id'> = {
  employeeId: '', name: '', cnic: '', dob: '', gender: '', maritalStatus: '', religion: '',
  fatherHusbandName: '', motherName: '',
  phone: '', email: '', currentAddress: '', permanentAddress: '', currentCity: '', hometown: '',
  jobTitle: '', department: '', project: '', employmentType: 'full_time', status: 'active',
  startDate: '', companyName: '', referredBy: '',
  emergencyContactName: '', emergencyContactRelation: '', emergencyContactPhone: '', emergencyContactType: '',
  accountNumber: '', characterCertificateExpiry: '',
  payType: 'fixed_monthly', salary: undefined, hourlyRate: undefined,
  monthlyHours: 160, overtimeRate: undefined, eobi: false,
  fuelAllowance: undefined, gymAllowance: undefined, securityDeduction: undefined,
}

interface Props {
  employee?: FirebaseEmployee | null
  onSave: (data: Omit<FirebaseEmployee, 'id'>) => Promise<void>
  onClose: () => void
  tableLabel?: string
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-gray-800 placeholder-gray-400 transition'

export default function AddEditEmployeeModal({ employee, onSave, onClose, tableLabel }: Props) {
  const [tab,       setTab]      = useState<Tab>('Personal')
  const [form,      setForm]     = useState<Omit<FirebaseEmployee, 'id'>>(EMPTY)
  const [saving,    setSaving]   = useState(false)
  const [saveError, setSaveError] = useState('')
  const [errors,    setErrors]   = useState<Record<string, string>>({})

  useEffect(() => {
    if (employee) {
      const { id, ...rest } = employee
      setForm({ ...EMPTY, ...rest })
    } else {
      setForm(EMPTY)
    }
  }, [employee])

  const set = (field: keyof typeof EMPTY, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim())       e.name       = 'Required'
    if (!form.employeeId.trim()) e.employeeId = 'Required'
    if (!form.jobTitle.trim())   e.jobTitle   = 'Required'
    if (!form.startDate)         e.startDate  = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaveError('')
    if (!validate()) { setTab('Personal'); return }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const err = (f: string) => errors[f] ? <p className="text-red-500 text-xs mt-1">{errors[f]}</p> : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-secondary">
              {employee?.id ? 'Edit' : 'Add'} {tableLabel ?? 'Employee'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Fill in the details below</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 shrink-0">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition -mb-px',
                tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-gray-600'
              )}>
              <span className={cn('w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center',
                tab === t ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400')}>
                {i + 1}
              </span>
              {t}
            </button>
          ))}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">

            {/* ── 1. Personal ── */}
            {tab === 'Personal' && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Full Name" required>
                    <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ahmed Raza" />
                    {err('name')}
                  </Field>
                  <Field label="CNIC Number">
                    <input className={inp} value={form.cnic ?? ''} onChange={e => set('cnic', e.target.value)} placeholder="42201-1234567-8" />
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Date of Birth">
                    <input className={inp} type="date" value={form.dob ?? ''} onChange={e => set('dob', e.target.value)} />
                  </Field>
                  <Field label="Gender">
                    <select className={inp} value={form.gender ?? ''} onChange={e => set('gender', e.target.value)}>
                      <option value="">Select…</option>
                      {GENDERS.map(g => <option key={g}>{g}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Marital Status">
                    <select className={inp} value={form.maritalStatus ?? ''} onChange={e => set('maritalStatus', e.target.value)}>
                      <option value="">Select…</option>
                      {MARITAL.map(m => <option key={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Religion">
                    <select className={inp} value={form.religion ?? ''} onChange={e => set('religion', e.target.value)}>
                      <option value="">Select…</option>
                      {RELIGIONS.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Family (Father / Husband Name)">
                    <input className={inp} value={form.fatherHusbandName ?? ''} onChange={e => set('fatherHusbandName', e.target.value)} placeholder="Father or husband's name" />
                  </Field>
                  <Field label="Mother Name">
                    <input className={inp} value={form.motherName ?? ''} onChange={e => set('motherName', e.target.value)} placeholder="Mother's full name" />
                  </Field>
                </div>
              </>
            )}

            {/* ── 2. Employment ── */}
            {tab === 'Employment' && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Employee ID" required>
                    <input className={inp} value={form.employeeId} onChange={e => set('employeeId', e.target.value)} placeholder="CCE-1001" />
                    {err('employeeId')}
                  </Field>
                  <Field label="Job Title" required>
                    <input className={inp} value={form.jobTitle} onChange={e => set('jobTitle', e.target.value)} placeholder="Dispatch Agent" />
                    {err('jobTitle')}
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Date of Joining" required>
                    <input className={inp} type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} />
                    {err('startDate')}
                  </Field>
                  <Field label="Project / Client">
                    <select className={inp} value={form.project ?? ''} onChange={e => set('project', e.target.value)}>
                      <option value="">Select…</option>
                      {PROJECTS.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Department">
                    <select className={inp} value={form.department ?? ''} onChange={e => set('department', e.target.value)}>
                      <option value="">Select…</option>
                      {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </Field>
                  <Field label="Employment Type">
                    <select className={inp} value={form.employmentType} onChange={e => set('employmentType', e.target.value)}>
                      {EMP_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select className={inp} value={form.status} onChange={e => set('status', e.target.value)}>
                      {STATUSES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Email">
                    <input className={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="ahmed@cabcallexperts.com" />
                  </Field>
                  <Field label="Number (Phone)">
                    <input className={inp} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="03001234567" />
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Company Name">
                    <input className={inp} value={form.companyName ?? ''} onChange={e => set('companyName', e.target.value)} placeholder="CabCall Experts" />
                  </Field>
                  <Field label="Referred By">
                    <input className={inp} value={form.referredBy ?? ''} onChange={e => set('referredBy', e.target.value)} placeholder="Who referred this employee" />
                  </Field>
                </div>
                <Field label="Character Certificate Expiry Date">
                  <input className={cn(inp, 'sm:w-1/2')} type="date" value={form.characterCertificateExpiry ?? ''} onChange={e => set('characterCertificateExpiry', e.target.value)} />
                </Field>

                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Integrations</p>
                  <Field label="RotaCloud User ID">
                    <input
                      className={cn(inp, 'sm:w-1/2')}
                      type="number"
                      min={1}
                      value={form.rotacloudId ?? ''}
                      onChange={e => set('rotacloudId', e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="e.g. 12345"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Found in RotaCloud → Staff → user profile URL. Links this employee to RotaCloud for shifts &amp; attendance.</p>
                  </Field>
                </div>
              </>
            )}

            {/* ── 3. Address & Kin ── */}
            {tab === 'Address & Kin' && (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Current City">
                    <input className={inp} value={form.currentCity ?? ''} onChange={e => set('currentCity', e.target.value)} placeholder="Rawalpindi" />
                  </Field>
                  <Field label="Hometown">
                    <input className={inp} value={form.hometown ?? ''} onChange={e => set('hometown', e.target.value)} placeholder="Karachi" />
                  </Field>
                </div>
                <Field label="Temp. Address">
                  <textarea className={cn(inp, 'resize-none')} rows={2} value={form.currentAddress ?? ''} onChange={e => set('currentAddress', e.target.value)} placeholder="H# 12, Street 5, Satellite Town, Rawalpindi" />
                </Field>
                <Field label="Permanent Address">
                  <textarea className={cn(inp, 'resize-none')} rows={2} value={form.permanentAddress ?? ''} onChange={e => set('permanentAddress', e.target.value)} placeholder="Permanent home address" />
                </Field>

                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Next of Kin / Emergency Contact</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Name of Kin">
                    <input className={inp} value={form.emergencyContactName ?? ''} onChange={e => set('emergencyContactName', e.target.value)} placeholder="Full name" />
                  </Field>
                  <Field label="Relationship">
                    <input className={inp} value={form.emergencyContactRelation ?? ''} onChange={e => set('emergencyContactRelation', e.target.value)} placeholder="e.g. Brother, Mother" />
                  </Field>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Kin Contact">
                    <input className={inp} value={form.emergencyContactPhone ?? ''} onChange={e => set('emergencyContactPhone', e.target.value)} placeholder="03009876543" />
                  </Field>
                  <Field label="Type of Contact">
                    <input className={inp} value={form.emergencyContactType ?? ''} onChange={e => set('emergencyContactType', e.target.value)} placeholder="Mobile / Landline" />
                  </Field>
                </div>
              </>
            )}

            {/* ── 4. Financial ── */}
            {tab === 'Financial' && (
              <>
                <Field label="Bank Account No.">
                  <input className={inp} value={form.accountNumber ?? ''} onChange={e => set('accountNumber', e.target.value)} placeholder="02480320002393" />
                </Field>
              </>
            )}

            {/* ── 5. Payroll ── */}
            {tab === 'Payroll' && (
              <>
                <div className="p-3 mb-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                  Payroll settings control how this employee is paid each month. FBR withholding tax and EOBI are calculated automatically.
                </div>

                <Field label="Pay Type">
                  <select className={inp} value={form.payType ?? 'fixed_monthly'}
                    onChange={e => set('payType', e.target.value)}>
                    <option value="fixed_monthly">Fixed Monthly Salary</option>
                    <option value="hourly">Hourly Rate</option>
                  </select>
                </Field>

                {form.payType === 'hourly' ? (
                  <Field label="Hourly Rate (PKR)">
                    <input className={inp} type="number" min={0}
                      value={form.hourlyRate ?? ''}
                      onChange={e => set('hourlyRate', e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="e.g. 500" />
                  </Field>
                ) : (
                  <>
                    <Field label="Monthly Salary (PKR)">
                      <input className={inp} type="number" min={0}
                        value={form.salary ?? ''}
                        onChange={e => set('salary', e.target.value ? Number(e.target.value) : undefined)}
                        placeholder="e.g. 60000" />
                    </Field>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Field label="Monthly Hours Threshold">
                        <input className={inp} type="number" min={1}
                          value={form.monthlyHours ?? 160}
                          onChange={e => set('monthlyHours', Number(e.target.value))}
                          placeholder="160" />
                      </Field>
                      <Field label="Overtime Rate (PKR / hr)">
                        <input className={inp} type="number" min={0}
                          value={form.overtimeRate ?? ''}
                          onChange={e => set('overtimeRate', e.target.value ? Number(e.target.value) : undefined)}
                          placeholder="e.g. 400" />
                      </Field>
                    </div>
                  </>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <input
                    id="eobi"
                    type="checkbox"
                    checked={!!form.eobi}
                    onChange={e => setForm(prev => ({ ...prev, eobi: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 accent-primary"
                  />
                  <label htmlFor="eobi" className="text-sm text-gray-700">
                    Enrolled in EOBI
                    <span className="text-gray-400 text-xs ml-1">(Employee: PKR 370 / Employer: PKR 1,850 per month)</span>
                  </label>
                </div>

                <div className="border-t border-gray-100 pt-4 space-y-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fixed Monthly Allowances</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Fuel Allowance (PKR / month)">
                      <input className={inp} type="number" min={0}
                        value={form.fuelAllowance ?? ''}
                        onChange={e => set('fuelAllowance', e.target.value ? Number(e.target.value) : undefined)}
                        placeholder="e.g. 3000" />
                    </Field>
                    <Field label="Gym Allowance (PKR / month)">
                      <input className={inp} type="number" min={0}
                        value={form.gymAllowance ?? ''}
                        onChange={e => set('gymAllowance', e.target.value ? Number(e.target.value) : undefined)}
                        placeholder="e.g. 1500" />
                    </Field>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 space-y-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fixed Monthly Deductions</p>
                  <Field label="Security Deduction (PKR / month)">
                    <input className={inp} type="number" min={0}
                      value={form.securityDeduction ?? ''}
                      onChange={e => set('securityDeduction', e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="e.g. 2000" />
                  </Field>
                  <p className="text-[11px] text-gray-400">Security amounts are held as a deposit and refunded when the employee leaves.</p>
                </div>

                <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
                  <strong>Quality bonus, Eid double pay, and paid holidays</strong> are set per payroll run — they vary month to month and are entered when creating a run.
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {saveError && (
            <div className="mx-6 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 shrink-0">{saveError}</div>
          )}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
            <div className="flex gap-2">
              {TABS.indexOf(tab) > 0 && (
                <button type="button" onClick={() => setTab(TABS[TABS.indexOf(tab) - 1])}
                  className="btn-outline text-sm px-4 py-2">← Back</button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-outline text-sm px-4 py-2">Cancel</button>
              {TABS.indexOf(tab) < TABS.length - 1 ? (
                <button type="button" onClick={() => setTab(TABS[TABS.indexOf(tab) + 1])}
                  className="btn-primary text-sm px-4 py-2">
                  Next <ChevronRight size={14} />
                </button>
              ) : (
                <button type="submit" disabled={saving} className="btn-primary text-sm px-6 py-2">
                  {saving ? 'Saving…' : employee ? 'Save Changes' : 'Add Employee'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { User, Briefcase, FileText, CheckCircle, AlertCircle, Link } from 'lucide-react'
import { cn } from '../../utils/cn'
import { checkPreviouslyRejected } from '../../hooks/useFirebaseApplicants'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '../../config/firebase'

const DEPARTMENTS = ['Admin', 'Management', 'Operations', 'Marketing']
const POSITIONS   = [
  'Dispatcher', 'Senior Dispatcher', 'Night Shift Dispatcher',
  'Customer Service Agent', 'Customer Service Team Lead',
  'Operations Manager', 'HR Manager', 'Admin Assistant',
  'IT Administrator', 'Payroll Officer', 'General Manager', 'Other',
]
const GENDERS     = ['Male', 'Female', 'Other', 'Prefer not to say']
const EXP_OPTIONS = ['No Experience', 'Less than 1 year', '1–2 years', '3–5 years', '5–10 years', '10+ years']

const inp = 'w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white text-gray-800 placeholder-gray-400 transition'

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
        <Icon size={16} className="text-blue-600" />
      </div>
      <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{title}</h3>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  )
}

export default function ApplyForm() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', dob: '', gender: '', cnic: '', currentAddress: '',
    positionApplied: '', department: '', experience: '', education: '', coverLetter: '',
    cvLink: '',
  })
  const [errors,     setErrors]     = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [submitError, setSubmitError] = useState('')

  const set = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }))

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim())         e.name            = 'Required'
    if (!form.email.trim())        e.email           = 'Required'
    if (!form.phone.trim())        e.phone           = 'Required'
    if (!form.positionApplied)     e.positionApplied = 'Required'
    if (!form.department)          e.department      = 'Required'
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const prev = await checkPreviouslyRejected(form.email, form.cnic)
      await addDoc(collection(db, 'applicants'), {
        ...form,
        email:             form.email.toLowerCase().trim(),
        status:            'new',
        appliedDate:       new Date().toISOString().split('T')[0],
        appliedBefore:     !!prev,
        appliedBeforeRole: prev?.positionApplied ?? '',
        createdAt:         serverTimestamp(),
      })
      setSubmitted(true)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Application Submitted!</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            Thank you, <strong>{form.name}</strong>. Your application for <strong>{form.positionApplied}</strong> has been received.
            Our HR team will be in touch shortly.
          </p>
          <p className="text-xs text-gray-400 mt-6">Cab Call Experts Ltd · Manchester, UK</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 py-10 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white text-xs font-semibold px-4 py-2 rounded-full mb-4">
            Cab Call Experts Ltd · Job Application
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Apply for a Position</h1>
          <p className="text-blue-200 text-sm">Fill in the form below and we'll review your application</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="p-8 space-y-6">

            {/* ── Personal Info ── */}
            <SectionHeader icon={User} title="Personal Information" />

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <input className={cn(inp, errors.name && 'border-red-400')} value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Smith" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </Field>
              <Field label="Email Address" required>
                <input className={cn(inp, errors.email && 'border-red-400')} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@email.com" />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Phone Number" required>
                <input className={cn(inp, errors.phone && 'border-red-400')} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+44 7700 000000" />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </Field>
              <Field label="Date of Birth">
                <input className={inp} type="date" value={form.dob} onChange={e => set('dob', e.target.value)} />
              </Field>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Gender">
                <select className={inp} value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">Select…</option>
                  {GENDERS.map(g => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="CNIC / National ID">
                <input className={inp} value={form.cnic} onChange={e => set('cnic', e.target.value)} placeholder="XXXXX-XXXXXXX-X" />
              </Field>
              <Field label="Current Address">
                <input className={inp} value={form.currentAddress} onChange={e => set('currentAddress', e.target.value)} placeholder="City, Country" />
              </Field>
            </div>

            {/* ── Application Details ── */}
            <SectionHeader icon={Briefcase} title="Application Details" />

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Position Applying For" required>
                <select className={cn(inp, errors.positionApplied && 'border-red-400')} value={form.positionApplied} onChange={e => set('positionApplied', e.target.value)}>
                  <option value="">Select role…</option>
                  {POSITIONS.map(p => <option key={p}>{p}</option>)}
                </select>
                {errors.positionApplied && <p className="text-red-500 text-xs mt-1">{errors.positionApplied}</p>}
              </Field>
              <Field label="Department" required>
                <select className={cn(inp, errors.department && 'border-red-400')} value={form.department} onChange={e => set('department', e.target.value)}>
                  <option value="">Select department…</option>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
                {errors.department && <p className="text-red-500 text-xs mt-1">{errors.department}</p>}
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Years of Experience">
                <select className={inp} value={form.experience} onChange={e => set('experience', e.target.value)}>
                  <option value="">Select…</option>
                  {EXP_OPTIONS.map(x => <option key={x}>{x}</option>)}
                </select>
              </Field>
              <Field label="Highest Education">
                <input className={inp} value={form.education} onChange={e => set('education', e.target.value)} placeholder="e.g. BSc Computer Science" />
              </Field>
            </div>

            <Field label="Cover Letter / Why should we hire you?">
              <textarea className={cn(inp, 'resize-none')} rows={4} value={form.coverLetter} onChange={e => set('coverLetter', e.target.value)} placeholder="Tell us why you'd be a great fit…" />
            </Field>

            {/* ── CV Link ── */}
            <SectionHeader icon={FileText} title="CV / Resume" />

            <Field
              label="CV Link"
              hint="Upload your CV to Google Drive or Dropbox, set it to 'Anyone with the link can view', then paste the link here.">
              <div className="relative">
                <Link size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className={cn(inp, 'pl-10')}
                  value={form.cvLink}
                  onChange={e => set('cvLink', e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  type="url"
                />
              </div>
            </Field>

          </div>

          {/* Footer */}
          {submitError && (
            <div className="mx-8 mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-red-600">
              <AlertCircle size={16} /> {submitError}
            </div>
          )}
          <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">Your data is handled securely and only shared with HR.</p>
            <button type="submit" disabled={submitting}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition shadow-lg shadow-blue-600/20">
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
          </div>
        </form>

        <p className="text-center text-blue-300/50 text-xs mt-6">© Cab Call Experts Ltd · Manchester, UK</p>
      </div>
    </div>
  )
}

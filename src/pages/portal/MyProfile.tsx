import { useState, useEffect, useRef } from 'react'
import {
  User, Briefcase, Shield, Edit3, Save, X,
  Camera, Upload, AlertTriangle, CheckCircle2, FileText,
} from 'lucide-react'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAppSelector } from '../../store'
import { useMyEmployee } from '../../hooks/useMyEmployee'
import { storage } from '../../config/firebase'

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white text-gray-800'

function InfoRow({ label, value }: { label: string; value?: string | boolean | number | null }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div>
      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
      <p className="text-sm text-secondary font-medium mt-0.5">{String(value)}</p>
    </div>
  )
}

function resizeImage(file: File, maxPx = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(maxPx / img.width, maxPx / img.height, 1)
        const canvas = document.createElement('canvas')
        canvas.width  = Math.round(img.width  * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function MyProfile() {
  const currentUser = useAppSelector(s => s.auth.user)
  const { employee: myEmployee, loading, updateEmployee: updateMyEmployee } = useMyEmployee()
  const updateEmployee = (_id: string, data: Parameters<typeof updateMyEmployee>[0]) => updateMyEmployee(data)

  const photoInputRef = useRef<HTMLInputElement>(null)
  const certInputRef  = useRef<HTMLInputElement>(null)

  const [editing,       setEditing]       = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingCert,  setUploadingCert]  = useState(false)
  const [form, setForm] = useState({ phone: '', currentAddress: '', permanentAddress: '' })

  useEffect(() => {
    if (myEmployee) setForm({
      phone:            myEmployee.phone            ?? '',
      currentAddress:   myEmployee.currentAddress   ?? '',
      permanentAddress: myEmployee.permanentAddress ?? '',
    })
  }, [myEmployee?.id])

  const save = async () => {
    if (!myEmployee) return
    setSaving(true)
    try {
      await updateEmployee(myEmployee.id, form)
      setEditing(false)
    } finally { setSaving(false) }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !myEmployee) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB'); return }
    setUploadingPhoto(true)
    try {
      const dataUrl = await resizeImage(file, 200)
      await updateEmployee(myEmployee.id, { photoUrl: dataUrl, photoApproved: false })
    } finally {
      setUploadingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !myEmployee) return
    if (file.size > 10 * 1024 * 1024) { alert('File must be under 10 MB'); return }
    setUploadingCert(true)
    try {
      const sRef = storageRef(storage, `character-certs/${myEmployee.id}/${Date.now()}-${file.name}`)
      await uploadBytes(sRef, file)
      const url = await getDownloadURL(sRef)
      const expiry = new Date()
      expiry.setMonth(expiry.getMonth() + 6)
      await updateEmployee(myEmployee.id, {
        characterCertificate:       url,
        characterCertificateExpiry: expiry.toISOString().split('T')[0],
      })
    } finally {
      setUploadingCert(false)
      if (certInputRef.current) certInputRef.current.value = ''
    }
  }

  // Cert expiry logic
  const certUrl    = myEmployee?.characterCertificate
  const certExpiry = myEmployee?.characterCertificateExpiry
  const today      = new Date()
  const certDate   = certExpiry ? new Date(certExpiry) : null
  const daysLeft   = certDate ? Math.ceil((certDate.getTime() - today.getTime()) / 86_400_000) : null
  const certExpired     = daysLeft !== null && daysLeft <= 0
  const certExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 30
  const certMissing     = !certUrl

  const photoUrl      = myEmployee?.photoUrl
  const photoApproved = myEmployee?.photoApproved

  const initials = (currentUser?.name ?? 'U')
    .split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="space-y-5 max-w-3xl">

      <div>
        <h1 className="text-xl font-bold text-secondary">My Profile</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your personal and employment information</p>
      </div>

      {/* Cert notification banner */}
      {(certMissing || certExpired || certExpiringSoon) && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${
          certExpired      ? 'bg-red-50 border-red-200 text-red-800'
          : certExpiringSoon ? 'bg-amber-50 border-amber-200 text-amber-800'
          : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              {certExpired       ? 'Character Certificate Expired'
               : certExpiringSoon ? `Certificate Expiring in ${daysLeft} days`
               : 'Character Certificate Required'}
            </p>
            <p className="text-xs mt-0.5 opacity-80">
              {certExpired       ? `Expired on ${certExpiry}. Please upload a new certificate immediately.`
               : certExpiringSoon ? `Expires on ${certExpiry}. Upload a renewed certificate soon.`
               : 'Please upload your character certificate. It is valid for 6 months from upload date.'}
            </p>
          </div>
        </div>
      )}

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-[#12121E] text-white p-7">
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(46,134,193,0.4), transparent 65%)' }} />
        <div className="absolute -bottom-12 left-16 w-36 h-36 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.3), transparent 65%)' }} />
        <div className="relative flex items-center gap-5">

          {/* Avatar with photo upload */}
          <div className="relative group shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-primary flex items-center justify-center">
              {photoUrl
                ? <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
                : <span className="text-2xl font-bold">{initials}</span>}
            </div>
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {uploadingPhoto
                ? <span className="text-[10px] text-white font-medium">Uploading…</span>
                : <Camera size={18} className="text-white" />}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*"
              onChange={handlePhotoUpload} className="hidden" />
            {/* Approval badge */}
            {photoUrl && (
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#12121E]
                ${photoApproved ? 'bg-green-500' : 'bg-amber-500'}`}>
                {photoApproved
                  ? <CheckCircle2 size={10} className="text-white" />
                  : <span className="text-[8px] text-white font-bold">!</span>}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold">{currentUser?.name ?? '—'}</h2>
            <p className="text-white/60 text-sm mt-1">{myEmployee?.jobTitle ?? '—'}</p>
            {photoUrl && !photoApproved && (
              <p className="text-amber-400 text-[11px] mt-1">Photo pending admin approval</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs bg-white/10 px-2.5 py-0.5 rounded-full">
                {myEmployee?.department ?? '—'}
              </span>
              <span className="text-xs bg-white/10 px-2.5 py-0.5 rounded-full capitalize">
                {currentUser?.role?.replace('_', ' ')}
              </span>
              {myEmployee?.status && (
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold
                  ${myEmployee.status === 'active' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                  {myEmployee.status}
                </span>
              )}
              {myEmployee?.employeeId && (
                <span className="text-xs bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full text-white/50">
                  #{myEmployee.employeeId}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-sm text-gray-400">Loading profile…</div>
      ) : !myEmployee ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-gray-400">Profile not found. Contact HR to set up your employee record.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Personal info — editable fields */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <User size={15} className="text-primary" />
                <p className="text-sm font-bold text-secondary">Personal Information</p>
              </div>
              {!editing ? (
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold">
                  <Edit3 size={12} /> Edit
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                  <button onClick={save} disabled={saving}
                    className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline disabled:opacity-50">
                    <Save size={12} /> {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <InfoRow label="Full Name"       value={myEmployee.name} />
              <InfoRow label="Email"           value={myEmployee.email} />

              <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Phone</p>
                {editing ? (
                  <input type="tel" value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className={inp} placeholder="Phone number" />
                ) : (
                  <p className="text-sm text-secondary font-medium">{myEmployee.phone || '—'}</p>
                )}
              </div>

              <InfoRow label="Date of Birth"    value={myEmployee.dob} />
              <InfoRow label="Gender"           value={myEmployee.gender} />
              <InfoRow label="Marital Status"   value={myEmployee.maritalStatus} />
              <InfoRow label="Religion"         value={myEmployee.religion} />
              <InfoRow label="Hometown"         value={myEmployee.hometown} />
              <InfoRow label="Current City"     value={myEmployee.currentCity} />
              <InfoRow label="Father / Husband" value={myEmployee.fatherHusbandName} />
              <InfoRow label="Mother Name"      value={myEmployee.motherName} />
              <InfoRow label="CNIC"             value={myEmployee.cnic} />
              <InfoRow label="Referred By"      value={myEmployee.referredBy} />

              <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Permanent Address</p>
                {editing ? (
                  <textarea value={form.permanentAddress}
                    onChange={e => setForm(f => ({ ...f, permanentAddress: e.target.value }))}
                    rows={2} className={`${inp} resize-none`} placeholder="Permanent address" />
                ) : (
                  <p className="text-sm text-secondary font-medium">{myEmployee.permanentAddress || '—'}</p>
                )}
              </div>

              <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Current Address</p>
                {editing ? (
                  <textarea value={form.currentAddress}
                    onChange={e => setForm(f => ({ ...f, currentAddress: e.target.value }))}
                    rows={2} className={`${inp} resize-none`} placeholder="Current / temporary address" />
                ) : (
                  <p className="text-sm text-secondary font-medium">{myEmployee.currentAddress || '—'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">

            {/* Employment */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Briefcase size={15} className="text-primary" />
                <p className="text-sm font-bold text-secondary">Employment</p>
              </div>
              <div className="space-y-3">
                <InfoRow label="Employee ID"      value={myEmployee.employeeId} />
                <InfoRow label="Job Title"        value={myEmployee.jobTitle} />
                <InfoRow label="Department"       value={myEmployee.department} />
                <InfoRow label="Project"          value={myEmployee.project} />
                <InfoRow label="Employment Type"  value={myEmployee.employmentType?.replace('_', ' ')} />
                <InfoRow label="Start Date"       value={myEmployee.startDate} />
                <InfoRow label="Manager"          value={myEmployee.manager} />
                <InfoRow label="Work Location"    value={myEmployee.workLocation} />
                <InfoRow label="Company"          value={myEmployee.companyName} />
                <InfoRow label="Skills"           value={myEmployee.skills} />
              </div>
            </div>

            {/* Emergency contact */}
            {(myEmployee.emergencyContactName || myEmployee.emergencyContactPhone) && (
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <User size={15} className="text-primary" />
                  <p className="text-sm font-bold text-secondary">Emergency Contact</p>
                </div>
                <div className="space-y-3">
                  <InfoRow label="Name"         value={myEmployee.emergencyContactName} />
                  <InfoRow label="Relationship" value={myEmployee.emergencyContactRelation} />
                  <InfoRow label="Phone"        value={myEmployee.emergencyContactPhone} />
                  <InfoRow label="Type"         value={myEmployee.emergencyContactType} />
                </div>
              </div>
            )}

            {/* Documents & Financial */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Shield size={15} className="text-primary" />
                <p className="text-sm font-bold text-secondary">Documents & Financial</p>
              </div>
              <div className="space-y-2">
                {[
                  { l: 'NTN / Tax No', v: myEmployee.taxNumber     },
                  { l: 'Bank Name',    v: myEmployee.bankName       },
                  { l: 'Account No.',  v: myEmployee.accountNumber  },
                  { l: 'EOBI',         v: myEmployee.eobi ? 'Enrolled' : undefined },
                ].filter(x => x.v).map(x => (
                  <div key={x.l} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-500">{x.l}</span>
                    <span className="text-xs font-semibold text-secondary tabular-nums">{x.v}</span>
                  </div>
                ))}
                {![myEmployee.taxNumber, myEmployee.accountNumber].some(Boolean) && (
                  <p className="text-xs text-gray-400">No financial records on file. Contact HR.</p>
                )}
              </div>
            </div>

            {/* Character Certificate */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-primary" />
                  <p className="text-sm font-bold text-secondary">Character Certificate</p>
                </div>
                {certUrl && (
                  <a href={certUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline font-semibold">
                    View →
                  </a>
                )}
              </div>

              {certUrl ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Status</span>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      certExpired      ? 'bg-red-100 text-red-700'
                      : certExpiringSoon ? 'bg-amber-100 text-amber-700'
                      : 'bg-green-100 text-green-700'
                    }`}>
                      {certExpired ? 'Expired' : certExpiringSoon ? 'Expiring Soon' : 'Valid'}
                    </span>
                  </div>
                  {certExpiry && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Expires</span>
                      <span className="text-xs font-semibold text-secondary">{certExpiry}</span>
                    </div>
                  )}
                  <button
                    onClick={() => certInputRef.current?.click()}
                    disabled={uploadingCert}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-xs text-gray-500 hover:border-primary hover:text-primary transition-colors">
                    <Upload size={12} />
                    {uploadingCert ? 'Uploading…' : 'Upload New Certificate'}
                  </button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <FileText size={18} className="text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    No certificate on file.<br />Upload your character certificate.
                  </p>
                  <button
                    onClick={() => certInputRef.current?.click()}
                    disabled={uploadingCert}
                    className="btn-primary text-xs px-4 flex items-center gap-1.5 mx-auto">
                    <Upload size={12} />
                    {uploadingCert ? 'Uploading…' : 'Upload Certificate'}
                  </button>
                </div>
              )}

              <input ref={certInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleCertUpload} className="hidden" />
              <p className="text-[10px] text-gray-400 mt-3 text-center">
                Certificate is valid for 6 months from upload date.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { X, Download, MapPin, Briefcase, CreditCard, User, Phone } from 'lucide-react'
import { Avatar } from '../../../components/common/Avatar'
import { Badge, statusVariant } from '../../../components/common/Badge'
import { useCurrency } from '../../../context/CurrencyContext'
import { EMPLOYMENT_TYPE_LABELS, STATUS_LABELS, getEffectiveStatus } from '../../../utils/constants'
import type { FirebaseEmployee } from '../../../hooks/useFirebaseEmployees'
import { exportSingleEmployee } from '../../../utils/exportExcel'

interface Props {
  employee: FirebaseEmployee
  onClose: () => void
  onEdit: () => void
}

function Row({ label, value }: { label: string; value?: string | number }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className="text-xs text-gray-700 font-semibold text-right max-w-[60%]">{value}</span>
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50/60 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
          <Icon size={14} className="text-primary" />
        </div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
      </div>
      <div className="space-y-0">{children}</div>
    </div>
  )
}

export default function ViewEmployeeModal({ employee: e, onClose, onEdit }: Props) {
  const { fmt } = useCurrency()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-4">
            <Avatar name={e.name} size="lg" />
            <div>
              <h2 className="text-lg font-bold text-secondary">{e.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400 font-mono">{e.employeeId}</span>
                <span className="text-gray-200">·</span>
                <Badge variant={statusVariant(getEffectiveStatus(e))} size="xs" dot>
                  {STATUS_LABELS[getEffectiveStatus(e)] ?? getEffectiveStatus(e)}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportSingleEmployee(e)}
              className="btn-outline text-xs px-3 py-1.5 gap-1.5">
              <Download size={13} /> Download
            </button>
            <button onClick={onEdit} className="btn-primary text-xs px-3 py-1.5">Edit</button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition">
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">

            <Section icon={User} title="Personal Info">
              <Row label="Email"          value={e.email} />
              <Row label="Phone"          value={e.phone} />
              <Row label="Date of Birth"  value={e.dob} />
              <Row label="Gender"         value={e.gender} />
              <Row label="CNIC"           value={e.cnic} />
              <Row label="Marital Status" value={e.maritalStatus} />
              <Row label="Religion"       value={e.religion} />
              <Row label="Family"         value={e.fatherHusbandName} />
              <Row label="Mother Name"    value={e.motherName} />
            </Section>

            <Section icon={Briefcase} title="Employment">
              <Row label="Job Title"       value={e.jobTitle} />
              <Row label="Project"         value={e.project} />
              <Row label="Type"            value={EMPLOYMENT_TYPE_LABELS[e.employmentType] ?? e.employmentType} />
              <Row label="Date of Joining" value={e.startDate} />
              <Row label="Company"         value={e.companyName} />
              <Row label="Referred By"     value={e.referredBy} />
              <Row label="Salary"          value={e.salary ? fmt(e.salary) : undefined} />
            </Section>

            <Section icon={MapPin} title="Address & Kin">
              <Row label="Current City"      value={e.currentCity} />
              <Row label="Hometown"          value={e.hometown} />
              <Row label="Temp. Address"     value={e.currentAddress} />
              <Row label="Permanent Address" value={e.permanentAddress} />
              <Row label="Name of Kin"       value={e.emergencyContactName} />
              <Row label="Kin Contact"       value={e.emergencyContactPhone} />
              <Row label="Relationship"      value={e.emergencyContactRelation} />
            </Section>

            <Section icon={CreditCard} title="Financial">
              <Row label="Bank Account No." value={e.accountNumber} />
              <Row label="Cert. Expiry"     value={e.characterCertificateExpiry} />
            </Section>

          </div>
        </div>
      </div>
    </div>
  )
}

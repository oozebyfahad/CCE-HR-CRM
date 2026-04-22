import * as XLSX from 'xlsx'
import type { FirebaseEmployee } from '../hooks/useFirebaseEmployees'
import { EMPLOYMENT_TYPE_LABELS, STATUS_LABELS } from './constants'
import { format } from 'date-fns'

// ── Column map: field → display header ─────────────────────────────────
function toRow(e: FirebaseEmployee) {
  return {
    'Employee ID':                   e.employeeId,
    'Full Name':                     e.name,
    'Pseudonym':                     e.pseudonym                 ?? '',
    'Email':                         e.email,
    'Phone':                         e.phone,
    'Date of Birth':                 e.dob                       ?? '',
    'Gender':                        e.gender                    ?? '',
    'CNIC / National ID':            e.cnic                      ?? '',
    'Marital Status':                e.maritalStatus             ?? '',
    'Religion':                      e.religion                  ?? '',
    'Father / Husband Name':         e.fatherHusbandName         ?? '',
    'Mother Name':                   e.motherName                ?? '',
    'Current City':                  e.currentCity               ?? '',
    'Hometown':                      e.hometown                  ?? '',
    'Current Address':               e.currentAddress            ?? '',
    'Permanent Address':             e.permanentAddress          ?? '',
    'Company Name':                  e.companyName               ?? '',
    'Job Title':                     e.jobTitle,
    'Department':                    e.department,
    'Project / Client':              e.project                   ?? '',
    'Employment Type':               EMPLOYMENT_TYPE_LABELS[e.employmentType] ?? e.employmentType,
    'Status':                        STATUS_LABELS[e.status] ?? e.status,
    'Date of Joining':               e.startDate,
    'Work Location':                 e.workLocation              ?? '',
    'Reporting Manager':             e.manager                   ?? '',
    'Salary (PKR)':                  e.salary                    ?? '',
    'Referred By':                   e.referredBy                ?? '',
    'Emergency Contact Name':        e.emergencyContactName      ?? '',
    'Emergency Contact Phone':       e.emergencyContactPhone     ?? '',
    'Emergency Contact Relation':    e.emergencyContactRelation  ?? '',
    'Type of Contact':               e.emergencyContactType      ?? '',
    'Bank Name':                     e.bankName                  ?? '',
    'Account / IBAN':                e.accountNumber             ?? '',
    'Tax Number':                    e.taxNumber                 ?? '',
    'Character Certificate':         e.characterCertificate      ?? '',
    'Character Certificate Expiry':  e.characterCertificateExpiry ?? '',
    'Skills':                        e.skills                    ?? '',
    'Notes':                         e.notes                     ?? '',
    'LinkedIn URL':                  e.linkedinUrl               ?? '',
  }
}

function writeAndDownload(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename)
}

// ── Export ALL employees ────────────────────────────────────────────────
export function exportAllEmployees(employees: FirebaseEmployee[]) {
  const rows = employees.map(toRow)
  const ws   = XLSX.utils.json_to_sheet(rows)

  // Column widths (39 columns)
  ws['!cols'] = Array(39).fill({ wch: 22 })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Employees')

  const date = format(new Date(), 'yyyy-MM-dd')
  writeAndDownload(wb, `CCE_Employees_${date}.xlsx`)
}

// ── Export ONE employee ─────────────────────────────────────────────────
export function exportSingleEmployee(e: FirebaseEmployee) {
  // Build a vertical key-value layout (looks better for a single record)
  const sections: { section: string; field: string; value: string | number }[] = [
    // Personal
    { section: 'Personal Info', field: 'Full Name',                   value: e.name },
    { section: '',              field: 'Pseudonym',                   value: e.pseudonym              ?? '' },
    { section: '',              field: 'Email',                       value: e.email },
    { section: '',              field: 'Phone',                       value: e.phone },
    { section: '',              field: 'Date of Birth',               value: e.dob                    ?? '' },
    { section: '',              field: 'Gender',                      value: e.gender                 ?? '' },
    { section: '',              field: 'CNIC / National ID',          value: e.cnic                   ?? '' },
    { section: '',              field: 'Marital Status',              value: e.maritalStatus          ?? '' },
    { section: '',              field: 'Religion',                    value: e.religion               ?? '' },
    { section: '',              field: 'Father / Husband Name',       value: e.fatherHusbandName      ?? '' },
    { section: '',              field: 'Mother Name',                 value: e.motherName             ?? '' },
    { section: '',              field: 'Current City',                value: e.currentCity            ?? '' },
    { section: '',              field: 'Hometown',                    value: e.hometown               ?? '' },
    { section: '',              field: 'Current Address',             value: e.currentAddress         ?? '' },
    { section: '',              field: 'Permanent Address',           value: e.permanentAddress       ?? '' },
    // Employment
    { section: 'Employment',    field: 'Employee ID',                 value: e.employeeId },
    { section: '',              field: 'Company Name',                value: e.companyName            ?? '' },
    { section: '',              field: 'Job Title',                   value: e.jobTitle },
    { section: '',              field: 'Department',                  value: e.department },
    { section: '',              field: 'Employment Type',             value: EMPLOYMENT_TYPE_LABELS[e.employmentType] ?? e.employmentType },
    { section: '',              field: 'Status',                      value: STATUS_LABELS[e.status] ?? e.status },
    { section: '',              field: 'Date of Joining',             value: e.startDate },
    { section: '',              field: 'Work Location',               value: e.workLocation           ?? '' },
    { section: '',              field: 'Reporting Manager',           value: e.manager                ?? '' },
    { section: '',              field: 'Salary (PKR)',                value: e.salary                 ?? '' },
    { section: '',              field: 'Referred By',                 value: e.referredBy             ?? '' },
    // Emergency
    { section: 'Emergency',     field: 'Contact Name',                value: e.emergencyContactName   ?? '' },
    { section: '',              field: 'Contact Phone',               value: e.emergencyContactPhone  ?? '' },
    { section: '',              field: 'Relationship',                value: e.emergencyContactRelation ?? '' },
    { section: '',              field: 'Type of Contact',             value: e.emergencyContactType   ?? '' },
    // Financial
    { section: 'Financial',     field: 'Bank Name',                   value: e.bankName               ?? '' },
    { section: '',              field: 'Account / IBAN',              value: e.accountNumber          ?? '' },
    { section: '',              field: 'Tax Number',                  value: e.taxNumber              ?? '' },
    { section: '',              field: 'Character Certificate',       value: e.characterCertificate   ?? '' },
    { section: '',              field: 'Certificate Expiry',          value: e.characterCertificateExpiry ?? '' },
    // Notes
    { section: 'Notes & Skills', field: 'Skills',                     value: e.skills                 ?? '' },
    { section: '',               field: 'Notes',                      value: e.notes                  ?? '' },
    { section: '',               field: 'LinkedIn URL',               value: e.linkedinUrl            ?? '' },
  ]

  const ws = XLSX.utils.aoa_to_sheet([
    ['CCE Employee Profile'],
    [`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`],
    [],
    ['Section', 'Field', 'Value'],
    ...sections.map(r => [r.section, r.field, r.value]),
  ])

  ws['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 40 }]
  ws['!rows'] = [{ hpt: 20 }, { hpt: 14 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Employee Profile')

  const safeName = e.name.replace(/\s+/g, '_')
  writeAndDownload(wb, `CCE_${e.employeeId}_${safeName}.xlsx`)
}

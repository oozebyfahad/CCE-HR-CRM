import * as XLSX from 'xlsx'
import type { FirebaseEmployee } from '../hooks/useFirebaseEmployees'
import { EMPLOYMENT_TYPE_LABELS, STATUS_LABELS } from './constants'
import { format } from 'date-fns'

// ── Column map: field → display header ─────────────────────────────────
function toRow(e: FirebaseEmployee) {
  return {
    'Employee ID':          e.employeeId,
    'Full Name':            e.name,
    'Email':                e.email,
    'Phone':                e.phone,
    'Date of Birth':        e.dob       ?? '',
    'Gender':               e.gender    ?? '',
    'CNIC / National ID':   e.cnic      ?? '',
    'Marital Status':       e.maritalStatus  ?? '',
    'Current Address':      e.currentAddress ?? '',
    'Job Title':            e.jobTitle,
    'Department':           e.department,
    'Employment Type':      EMPLOYMENT_TYPE_LABELS[e.employmentType] ?? e.employmentType,
    'Status':               STATUS_LABELS[e.status] ?? e.status,
    'Date of Joining':      e.startDate,
    'Work Location':        e.workLocation ?? '',
    'Reporting Manager':    e.manager    ?? '',
    'Salary (£)':           e.salary     ?? '',
    'Permanent Address':    e.permanentAddress        ?? '',
    'Emergency Contact':    e.emergencyContactName    ?? '',
    'Emergency Phone':      e.emergencyContactPhone   ?? '',
    'Emergency Relation':   e.emergencyContactRelation ?? '',
    'Bank Name':            e.bankName     ?? '',
    'Account / IBAN':       e.accountNumber ?? '',
    'Tax Number':           e.taxNumber    ?? '',
    'Skills':               e.skills ?? '',
    'Notes':                e.notes  ?? '',
  }
}

function writeAndDownload(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename)
}

// ── Export ALL employees ────────────────────────────────────────────────
export function exportAllEmployees(employees: FirebaseEmployee[]) {
  const rows = employees.map(toRow)
  const ws   = XLSX.utils.json_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, { wch: 22 }, { wch: 30 }, { wch: 18 }, { wch: 14 },
    { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 30 }, { wch: 24 },
    { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
    { wch: 20 }, { wch: 12 }, { wch: 30 }, { wch: 20 }, { wch: 18 },
    { wch: 16 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 28 },
    { wch: 30 },
  ]

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
    { section: 'Personal Info', field: 'Full Name',          value: e.name },
    { section: '',              field: 'Email',              value: e.email },
    { section: '',              field: 'Phone',              value: e.phone },
    { section: '',              field: 'Date of Birth',      value: e.dob             ?? '' },
    { section: '',              field: 'Gender',             value: e.gender          ?? '' },
    { section: '',              field: 'CNIC / National ID', value: e.cnic            ?? '' },
    { section: '',              field: 'Marital Status',     value: e.maritalStatus   ?? '' },
    { section: '',              field: 'Current Address',    value: e.currentAddress  ?? '' },
    // Employment
    { section: 'Employment',   field: 'Employee ID',        value: e.employeeId },
    { section: '',             field: 'Job Title',           value: e.jobTitle },
    { section: '',             field: 'Department',          value: e.department },
    { section: '',             field: 'Employment Type',     value: EMPLOYMENT_TYPE_LABELS[e.employmentType] ?? e.employmentType },
    { section: '',             field: 'Status',              value: STATUS_LABELS[e.status] ?? e.status },
    { section: '',             field: 'Date of Joining',     value: e.startDate },
    { section: '',             field: 'Work Location',       value: e.workLocation ?? '' },
    { section: '',             field: 'Reporting Manager',   value: e.manager      ?? '' },
    { section: '',             field: 'Salary (£)',          value: e.salary       ?? '' },
    // Additional
    { section: 'Additional',   field: 'Permanent Address',   value: e.permanentAddress        ?? '' },
    { section: '',             field: 'Emergency Contact',   value: e.emergencyContactName    ?? '' },
    { section: '',             field: 'Emergency Phone',     value: e.emergencyContactPhone   ?? '' },
    { section: '',             field: 'Emergency Relation',  value: e.emergencyContactRelation ?? '' },
    // Financial
    { section: 'Financial',    field: 'Bank Name',           value: e.bankName      ?? '' },
    { section: '',             field: 'Account / IBAN',      value: e.accountNumber ?? '' },
    { section: '',             field: 'Tax Number',          value: e.taxNumber     ?? '' },
    // Notes
    { section: 'Notes & Skills', field: 'Skills',            value: e.skills ?? '' },
    { section: '',               field: 'Notes',             value: e.notes  ?? '' },
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

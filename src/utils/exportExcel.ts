import * as XLSX from 'xlsx'
import type { FirebaseEmployee } from '../hooks/useFirebaseEmployees'
import { EMPLOYMENT_TYPE_LABELS, STATUS_LABELS } from './constants'
import { format } from 'date-fns'

// ── Column map matching Database.xlsx fields ───────────────────────────
function toRow(e: FirebaseEmployee) {
  return {
    'Employee ID':                   e.employeeId,
    'Full Name':                     e.name,
    'CNIC Number':                   e.cnic                       ?? '',
    'Date of Birth':                 e.dob                        ?? '',
    'Date of Joining':               e.startDate,
    'Number':                        e.phone,
    'Email':                         e.email,
    'Job Title':                     e.jobTitle,
    'Project':                       e.project                    ?? '',
    'EMP. TYPE':                     EMPLOYMENT_TYPE_LABELS[e.employmentType] ?? e.employmentType,
    'Status':                        STATUS_LABELS[e.status]      ?? e.status,
    'Gender':                        e.gender                     ?? '',
    'Marital Status':                e.maritalStatus              ?? '',
    'Bank Account No.':              e.accountNumber              ?? '',
    'Hometown':                      e.hometown                   ?? '',
    'Current City':                  e.currentCity                ?? '',
    'Temp. Address':                 e.currentAddress             ?? '',
    'Permanent Address':             e.permanentAddress           ?? '',
    'Company Name':                  e.companyName                ?? '',
    'Name of Kin':                   e.emergencyContactName       ?? '',
    'Relationship':                  e.emergencyContactRelation   ?? '',
    'Kin Contact':                   e.emergencyContactPhone      ?? '',
    'Type of Contact':               e.emergencyContactType       ?? '',
    'Religion':                      e.religion                   ?? '',
    'Family':                        e.fatherHusbandName          ?? '',
    'Mother Name':                   e.motherName                 ?? '',
    'Reffered By':                   e.referredBy                 ?? '',
    'Character Certificate Expiry':  e.characterCertificateExpiry ?? '',
  }
}

function writeAndDownload(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename)
}

// ── Export ALL employees ────────────────────────────────────────────────
export function exportAllEmployees(employees: FirebaseEmployee[]) {
  const rows = employees.map(toRow)
  const ws   = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = Array(29).fill({ wch: 22 })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Employees')

  const date = format(new Date(), 'yyyy-MM-dd')
  writeAndDownload(wb, `CCE_Employees_${date}.xlsx`)
}

// ── Export ONE employee ─────────────────────────────────────────────────
export function exportSingleEmployee(e: FirebaseEmployee) {
  const sections: { section: string; field: string; value: string | number }[] = [
    { section: 'Personal',    field: 'Full Name',                    value: e.name },
    { section: '',            field: 'CNIC Number',                  value: e.cnic                       ?? '' },
    { section: '',            field: 'Date of Birth',                value: e.dob                        ?? '' },
    { section: '',            field: 'Gender',                       value: e.gender                     ?? '' },
    { section: '',            field: 'Marital Status',               value: e.maritalStatus              ?? '' },
    { section: '',            field: 'Religion',                     value: e.religion                   ?? '' },
    { section: '',            field: 'Family (F/H Name)',            value: e.fatherHusbandName          ?? '' },
    { section: '',            field: 'Mother Name',                  value: e.motherName                 ?? '' },
    { section: 'Employment',  field: 'Employee ID',                  value: e.employeeId },
    { section: '',            field: 'Job Title',                    value: e.jobTitle },
    { section: '',            field: 'Date of Joining',              value: e.startDate },
    { section: '',            field: 'Project / Client',             value: e.project                    ?? '' },
    { section: '',            field: 'Employment Type',              value: EMPLOYMENT_TYPE_LABELS[e.employmentType] ?? e.employmentType },
    { section: '',            field: 'Status',                       value: STATUS_LABELS[e.status]      ?? e.status },
    { section: '',            field: 'Company Name',                 value: e.companyName                ?? '' },
    { section: '',            field: 'Referred By',                  value: e.referredBy                 ?? '' },
    { section: 'Contact',     field: 'Number (Phone)',               value: e.phone },
    { section: '',            field: 'Email',                        value: e.email },
    { section: '',            field: 'Current City',                 value: e.currentCity                ?? '' },
    { section: '',            field: 'Hometown',                     value: e.hometown                   ?? '' },
    { section: '',            field: 'Temp. Address',                value: e.currentAddress             ?? '' },
    { section: '',            field: 'Permanent Address',            value: e.permanentAddress           ?? '' },
    { section: 'Next of Kin', field: 'Name of Kin',                  value: e.emergencyContactName       ?? '' },
    { section: '',            field: 'Relationship',                 value: e.emergencyContactRelation   ?? '' },
    { section: '',            field: 'Kin Contact',                  value: e.emergencyContactPhone      ?? '' },
    { section: '',            field: 'Type of Contact',              value: e.emergencyContactType       ?? '' },
    { section: 'Financial',   field: 'Bank Account No.',             value: e.accountNumber              ?? '' },
    { section: '',            field: 'Char. Certificate Expiry',     value: e.characterCertificateExpiry ?? '' },
    { section: 'Payroll',     field: 'Pay Type',                     value: e.payType === 'hourly' ? 'Hourly Rate' : 'Fixed Monthly Salary' },
    { section: '',            field: 'Monthly Salary (PKR)',         value: e.salary                     ?? '' },
    { section: '',            field: 'Hourly Rate (PKR)',            value: e.hourlyRate                 ?? '' },
    { section: '',            field: 'Monthly Hours Threshold',      value: e.monthlyHours               ?? '' },
    { section: '',            field: 'Overtime Rate (PKR / hr)',     value: e.overtimeRate               ?? '' },
    { section: '',            field: 'EOBI Enrolled',                value: e.eobi ? 'Yes' : 'No' },
    { section: '',            field: 'Fuel Allowance (PKR / mo)',    value: e.fuelAllowance              ?? '' },
    { section: '',            field: 'Gym Allowance (PKR / mo)',     value: e.gymAllowance               ?? '' },
    { section: '',            field: 'Security Deduction (PKR / mo)',value: e.securityDeduction          ?? '' },
  ]

  const ws = XLSX.utils.aoa_to_sheet([
    ['CCE Employee Profile'],
    [`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`],
    [],
    ['Section', 'Field', 'Value'],
    ...sections.map(r => [r.section, r.field, r.value]),
  ])

  ws['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 40 }]
  ws['!rows'] = [{ hpt: 20 }, { hpt: 14 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Employee Profile')

  const safeName = e.name.replace(/\s+/g, '_')
  writeAndDownload(wb, `CCE_${e.employeeId}_${safeName}.xlsx`)
}

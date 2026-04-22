import * as XLSX from 'xlsx'
import type { FirebaseEmployee } from '../hooks/useFirebaseEmployees'

// ── Fields derived from Database.xlsx ─────────────────────────────────
export interface ImportField {
  key:      keyof Omit<FirebaseEmployee, 'id'>
  label:    string
  required: boolean
}

export const IMPORT_FIELDS: ImportField[] = [
  { key: 'employeeId',                label: 'Employee ID',                     required: true  },
  { key: 'name',                      label: 'Full Name',                       required: true  },
  { key: 'jobTitle',                  label: 'Job Title',                       required: true  },
  { key: 'startDate',                 label: 'Date of Joining',                 required: true  },
  { key: 'cnic',                      label: 'CNIC Number',                     required: false },
  { key: 'dob',                       label: 'Date of Birth',                   required: false },
  { key: 'phone',                     label: 'Number',                          required: false },
  { key: 'email',                     label: 'Email',                           required: false },
  { key: 'project',                   label: 'Project',                         required: false },
  { key: 'employmentType',            label: 'Employment Type',                 required: false },
  { key: 'gender',                    label: 'Gender',                          required: false },
  { key: 'maritalStatus',             label: 'Marital Status',                  required: false },
  { key: 'accountNumber',             label: 'Bank Account No.',                required: false },
  { key: 'hometown',                  label: 'Hometown',                        required: false },
  { key: 'currentCity',               label: 'Current City',                    required: false },
  { key: 'currentAddress',            label: 'Temp. Address',                   required: false },
  { key: 'permanentAddress',          label: 'Permanent Address',               required: false },
  { key: 'companyName',               label: 'Company Name',                    required: false },
  { key: 'emergencyContactName',      label: 'Name of Kin',                     required: false },
  { key: 'emergencyContactRelation',  label: 'Relationship',                    required: false },
  { key: 'emergencyContactPhone',     label: 'Kin Contact',                     required: false },
  { key: 'emergencyContactType',      label: 'Type of Contact',                 required: false },
  { key: 'religion',                  label: 'Religion',                        required: false },
  { key: 'fatherHusbandName',         label: 'Family',                          required: false },
  { key: 'motherName',                label: 'Mother Name',                     required: false },
  { key: 'referredBy',                label: 'Referred By',                     required: false },
  { key: 'characterCertificateExpiry',label: 'Character Certificate Expiry',    required: false },
]

// ── Auto-detect which Excel column maps to which field ─────────────────
const AUTO_HINTS: Record<string, string[]> = {
  employeeId:                ['employee id', 'emp id', 'emp. id', 'staff id', 'emp no', 'employee no', 'sr no'],
  name:                      ['full name', 'name', 'employee name'],
  jobTitle:                  ['job title', 'designation', 'position', 'title', 'role'],
  startDate:                 ['date of joining', 'joining date', 'doj', 'start date', 'hire date'],
  cnic:                      ['cnic number', 'cnic', 'national id', 'nic', 'id card'],
  dob:                       ['date of birth', 'dob', 'birth date'],
  phone:                     ['number', 'phone', 'mobile', 'phone number', 'mobile no'],
  email:                     ['email', 'e-mail', 'email address'],
  project:                   ['project', 'client', 'account'],
  employmentType:            ['emp. type', 'emp type', 'employment type', 'type', 'contract type'],
  gender:                    ['gender', 'sex'],
  maritalStatus:             ['marital status', 'marital'],
  accountNumber:             ['bank account no.', 'bank account no', 'bank account', 'account number', 'account', 'iban'],
  hometown:                  ['hometown', 'home town', 'native city'],
  currentCity:               ['current city', 'city'],
  currentAddress:            ['temp. address', 'temp address', 'current address', 'temporary address'],
  permanentAddress:          ['permanent address', 'home address'],
  companyName:               ['company name', 'company', 'employer'],
  emergencyContactName:      ['name of kin', 'kin name', 'emergency contact name', 'next of kin'],
  emergencyContactRelation:  ['relationship', 'relation'],
  emergencyContactPhone:     ['kin contact', 'kin phone', 'kin number', 'emergency contact phone'],
  emergencyContactType:      ['type of contact', 'contact type'],
  religion:                  ['religion', 'faith'],
  fatherHusbandName:         ['family', 'father husband name', 'father name', 'husband name'],
  motherName:                ['mother name', 'mother'],
  referredBy:                ['reffered by', 'referred by', 'referral', 'reference'],
  characterCertificateExpiry:['character certificate expiry date', 'character certificate expiry', 'certificate expiry', 'pcc expiry'],
}

function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const claimed = new Set<string>()

  for (const [field, hints] of Object.entries(AUTO_HINTS)) {
    const normHeaders = headers.map(h => ({ raw: h, norm: normalise(h) }))
    const match =
      normHeaders.find(h => !claimed.has(h.raw) && hints.some(hint => h.norm === hint))?.raw ??
      normHeaders.find(h => !claimed.has(h.raw) && hints.some(hint => h.norm.includes(hint)))?.raw
    if (match) {
      mapping[field] = match
      claimed.add(match)
    }
  }
  return mapping
}

// ── Read Excel/CSV file → headers + raw rows ───────────────────────────
export interface ParsedSheet {
  headers: string[]
  rows:    Record<string, string>[]
}

export function parseExcelFile(file: File): Promise<ParsedSheet> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb   = XLSX.read(data, { type: 'array', cellDates: false })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: true })
        if (!json.length) { reject(new Error('File appears to be empty.')); return }
        const headers = Object.keys(json[0])
        const rows    = json.map(r => {
          const out: Record<string, string> = {}
          headers.forEach(h => { out[h] = String(r[h] ?? '').trim() })
          return out
        })
        resolve({ headers, rows })
      } catch {
        reject(new Error('Could not read file. Make sure it is a valid .xlsx, .xls or .csv file.'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file.'))
    reader.readAsArrayBuffer(file)
  })
}

// ── Normalise raw cell values into FirebaseEmployee fields ─────────────
const MONTH_MAP: Record<string, string> = {
  jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06',
  jul:'07', aug:'08', sep:'09', sept:'09', set:'09', oct:'10', okt:'10', nov:'11', dec:'12',
}

function normaliseDate(v: string): string {
  if (!v || v === 'undefined' || v === 'null') return ''
  const s = v.trim()

  // Excel serial number (pure integer like "33751")
  if (/^\d{4,5}$/.test(s)) {
    const serial = parseInt(s, 10)
    const ms = (serial - (serial >= 60 ? 1 : 0) - 1) * 86400000
    const d  = new Date(Date.UTC(1900, 0, 1) + ms)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }

  // Already ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD-Mon-YYYY  e.g. "16-Nov-2018"
  const monMatch = s.match(/^(\d{1,2})[- ]([A-Za-z]{3,4})[- ,](\d{4})$/)
  if (monMatch) {
    const [, d, mon, y] = monMatch
    const mm = MONTH_MAP[mon.toLowerCase()]
    if (mm) return `${y}-${mm}-${d.padStart(2, '0')}`
  }

  // Ordinal e.g. "23rd Sep,2022"
  const ordMatch = s.match(/^(\d{1,2})(?:st|nd|rd|th)[^\w]*([A-Za-z]{3,4})[^\w]*(\d{4})$/)
  if (ordMatch) {
    const [, d, mon, y] = ordMatch
    const mm = MONTH_MAP[mon.toLowerCase()]
    if (mm) return `${y}-${mm}-${d.padStart(2, '0')}`
  }

  // dd/mm/yyyy or dd-mm-yyyy
  const dmMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (dmMatch) {
    const [, d, m, y] = dmMatch
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // e.g. "30-05-2026"
  const ddmmyyy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (ddmmyyy) {
    const [, d, m, y] = ddmmyyy
    return `${y}-${m}-${d}`
  }

  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return s
}

function normaliseEmploymentType(v: string): FirebaseEmployee['employmentType'] {
  const s = v.toLowerCase()
  if (s.includes('part'))                    return 'part_time'
  if (s.includes('contract'))               return 'contract'
  if (s.includes('agency'))                 return 'agency'
  if (s.includes('perm') || s.includes('full')) return 'full_time'
  return 'full_time'
}

// mapping: { fieldKey -> excelColumnHeader }
export function mapRowToEmployee(
  row: Record<string, string>,
  mapping: Record<string, string>,
): Omit<FirebaseEmployee, 'id'> {
  const get = (field: string) => (mapping[field] ? (row[mapping[field]] ?? '') : '')

  return {
    name:                      get('name'),
    email:                     get('email').toLowerCase(),
    employeeId:                get('employeeId'),
    jobTitle:                  get('jobTitle'),
    department:                '',
    startDate:                 normaliseDate(get('startDate')),
    employmentType:            get('employmentType') ? normaliseEmploymentType(get('employmentType')) : 'full_time',
    status:                    'active',
    phone:                     get('phone'),
    dob:                       normaliseDate(get('dob')),
    gender:                    get('gender'),
    cnic:                      get('cnic'),
    maritalStatus:             get('maritalStatus'),
    religion:                  get('religion'),
    fatherHusbandName:         get('fatherHusbandName'),
    motherName:                get('motherName'),
    currentAddress:            get('currentAddress'),
    permanentAddress:          get('permanentAddress'),
    currentCity:               get('currentCity'),
    hometown:                  get('hometown'),
    companyName:               get('companyName'),
    project:                   get('project'),
    referredBy:                get('referredBy'),
    emergencyContactName:      get('emergencyContactName'),
    emergencyContactPhone:     get('emergencyContactPhone'),
    emergencyContactRelation:  get('emergencyContactRelation'),
    emergencyContactType:      get('emergencyContactType'),
    accountNumber:             get('accountNumber'),
    characterCertificateExpiry:normaliseDate(get('characterCertificateExpiry')),
  }
}

// ── Download a blank template matching Database.xlsx layout ────────────
export function downloadImportTemplate() {
  const headers = IMPORT_FIELDS.map(f => f.label)
  const example = [
    'CCE-1001',           // Employee ID
    'Ahmed Khan',         // Full Name
    'Dispatch Agent',     // Job Title
    '16-Nov-2018',        // Date of Joining
    '42201-1234567-8',    // CNIC Number
    '15-Apr-1992',        // Date of Birth
    '03001234567',        // Number
    'ahmed@example.com',  // Email
    'CCE',                // Project
    'Permanent',          // Employment Type
    'Male',               // Gender
    'Single',             // Marital Status
    '02480000000000',     // Bank Account No.
    'Lahore',             // Hometown
    'Rawalpindi',         // Current City
    'H# 12, Street 5, Rawalpindi',  // Temp. Address
    'H# 1, Gulberg, Lahore',        // Permanent Address
    'CabCall Experts',    // Company Name
    'Muhammad Raza',      // Name of Kin
    'Brother',            // Relationship
    '03009876543',        // Kin Contact
    'Mobile',             // Type of Contact
    'Islam',              // Religion
    'Khalid Khan',        // Family
    'Fatima Bibi',        // Mother Name
    'Ali Raza',           // Referred By
    '30-05-2026',         // Character Certificate Expiry
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, example])
  ws['!cols'] = headers.map(() => ({ wch: 28 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Employees')
  XLSX.writeFile(wb, 'CCE_Employee_Import_Template.xlsx')
}

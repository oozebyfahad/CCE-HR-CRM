import * as XLSX from 'xlsx'
import type { FirebaseEmployee } from '../hooks/useFirebaseEmployees'

// ── Fields we accept from Excel ────────────────────────────────────────
export interface ImportField {
  key:      keyof Omit<FirebaseEmployee, 'id'>
  label:    string
  required: boolean
}

export const IMPORT_FIELDS: ImportField[] = [
  // Core required
  { key: 'name',                      label: 'Full Name',                       required: true  },
  { key: 'employeeId',                label: 'Employee ID',                     required: true  },
  { key: 'jobTitle',                  label: 'Designation',                     required: true  },
  { key: 'department',                label: 'Department',                      required: true  },
  { key: 'startDate',                 label: 'Date of Joining',                 required: true  },
  // Basic personal
  { key: 'pseudonym',                 label: 'Pseudonym',                       required: false },
  { key: 'dob',                       label: 'Date of Birth',                   required: false },
  { key: 'gender',                    label: 'Gender',                          required: false },
  { key: 'cnic',                      label: 'CNIC',                            required: false },
  { key: 'maritalStatus',             label: 'Marital Status',                  required: false },
  { key: 'religion',                  label: 'Religion',                        required: false },
  { key: 'fatherHusbandName',         label: 'Father / Husband Name',           required: false },
  { key: 'motherName',                label: 'Mother Name',                     required: false },
  // Contact
  { key: 'phone',                     label: 'Phone',                           required: false },
  { key: 'email',                     label: 'Email',                           required: false },
  { key: 'currentAddress',            label: 'Current Address',                 required: false },
  { key: 'permanentAddress',          label: 'Permanent Address',               required: false },
  { key: 'currentCity',               label: 'Current City',                    required: false },
  { key: 'hometown',                  label: 'Hometown',                        required: false },
  // Employment
  { key: 'companyName',               label: 'Company Name',                    required: false },
  { key: 'employmentType',            label: 'Employment Type',                 required: false },
  { key: 'status',                    label: 'Status',                          required: false },
  { key: 'salary',                    label: 'Salary',                          required: false },
  { key: 'manager',                   label: 'Reporting Manager',               required: false },
  { key: 'workLocation',              label: 'Work Location',                   required: false },
  { key: 'referredBy',                label: 'Referred By',                     required: false },
  // Emergency contact
  { key: 'emergencyContactName',      label: 'Emergency Contact Name',          required: false },
  { key: 'emergencyContactPhone',     label: 'Emergency Contact Phone',         required: false },
  { key: 'emergencyContactRelation',  label: 'Emergency Contact Relation',      required: false },
  { key: 'emergencyContactType',      label: 'Type of Contact',                 required: false },
  // Financial / Documents
  { key: 'bankName',                  label: 'Bank Name',                       required: false },
  { key: 'accountNumber',             label: 'Account Number',                  required: false },
  { key: 'taxNumber',                 label: 'Tax Number',                      required: false },
  { key: 'characterCertificate',      label: 'Character Certificate',           required: false },
  { key: 'characterCertificateExpiry',label: 'Character Certificate Expiry',    required: false },
  // Misc
  { key: 'skills',                    label: 'Skills',                          required: false },
  { key: 'notes',                     label: 'Notes',                           required: false },
  { key: 'linkedinUrl',               label: 'LinkedIn URL',                    required: false },
]

// ── Auto-detect which Excel column maps to which field ─────────────────
const AUTO_HINTS: Record<string, string[]> = {
  name:                      ['full name','name','employee name','staff name'],
  employeeId:                ['employee id','emp id','staff id','emp no','employee no','staff no','sr no','serial no','no.','no'],
  jobTitle:                  ['job title','designation','position','title','role','post'],
  department:                ['department','dept','division','team','project'],
  startDate:                 ['start date','date of joining','joining date','doj','hire date','joined'],
  pseudonym:                 ['pseudonym','alias','nick name','nickname'],
  dob:                       ['date of birth','dob','birth date','birthday'],
  gender:                    ['gender','sex'],
  cnic:                      ['cnic number','cnic','national id','nic','id number','id card'],
  maritalStatus:             ['marital status','marital','civil status'],
  religion:                  ['religion','faith'],
  fatherHusbandName:         ['father husband name','father name','husband name','father / husband name','f/h name'],
  motherName:                ['mother name','mother'],
  phone:                     ['official number','phone','mobile','contact','phone number','mobile no','contact number'],
  email:                     ['official email','email','email address','e-mail','mail'],
  currentAddress:            ['temp. address','temp address','current address','address','residential address'],
  permanentAddress:          ['permanent address','home address'],
  currentCity:               ['current city','city'],
  hometown:                  ['hometown','home town','home city','native city'],
  companyName:               ['company name','company','employer','organisation'],
  employmentType:            ['emp. type','employment type','type','contract type','emp type','work type'],
  status:                    ['status','employment status','emp status'],
  salary:                    ['salary','pay','wages','ctc','annual salary','gross salary','package'],
  manager:                   ['manager','reporting manager','line manager','supervisor','reports to'],
  workLocation:              ['work location','location','office','site','branch'],
  referredBy:                ['referred by','referral','reference','referred'],
  emergencyContactName:      ['name of kin','kin name','emergency contact name','emergency contact','emergency name','next of kin'],
  emergencyContactPhone:     ['kin contact','kin phone','kin number','emergency contact phone','emergency phone','emergency number','nok phone'],
  emergencyContactRelation:  ['relationship','emergency contact relation','relation'],
  emergencyContactType:      ['type of contact','contact type','emergency type'],
  accountNumber:             ['bank account no.','bank account no','bank account','account number','account','iban'],
  bankName:                  ['bank name'],
  taxNumber:                 ['tax number','ntn','tax id','tin'],
  characterCertificate:      ['character certificate','police certificate','pcc'],
  characterCertificateExpiry:['character certificate expiry date','character certificate expiry','certificate expiry','pcc expiry'],
  skills:                    ['skills','skill set','competencies'],
  notes:                     ['notes','remarks','comments'],
  linkedinUrl:               ['linkedin','linkedin url','linkedin profile'],
}

function normalise(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

export function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const claimed = new Set<string>()  // prevent two fields grabbing the same column

  for (const [field, hints] of Object.entries(AUTO_HINTS)) {
    // Prefer exact matches first, then substring matches
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
    // Excel epoch: Jan 1 1900 = serial 1; serial 60 is the fake Feb 29 1900
    const ms = (serial - (serial >= 60 ? 1 : 0) - 1) * 86400000
    const d  = new Date(Date.UTC(1900, 0, 1) + ms)
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  }

  // Already ISO yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD-Mon-YYYY  e.g. "16-Nov-2018" or "19-Sept-1999"
  const monMatch = s.match(/^(\d{1,2})[- ]([A-Za-z]{3,4})[- ,](\d{4})$/)
  if (monMatch) {
    const [, d, mon, y] = monMatch
    const mm = MONTH_MAP[mon.toLowerCase()]
    if (mm) return `${y}-${mm}-${d.padStart(2, '0')}`
  }

  // Ordinal DD e.g. "23rd Sep,2022" or "1st Jan, 2023" or "19th Sept 1999"
  const ordMatch = s.match(/^(\d{1,2})(?:st|nd|rd|th)[^\w]*([A-Za-z]{3,4})[^\w]*(\d{4})$/)
  if (ordMatch) {
    const [, d, mon, y] = ordMatch
    const mm = MONTH_MAP[mon.toLowerCase()]
    if (mm) return `${y}-${mm}-${d.padStart(2, '0')}`
  }

  // dd/mm/yyyy or dd-mm-yyyy (all numeric)
  const dmMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (dmMatch) {
    const [, d, m, y] = dmMatch
    const year = y.length === 2 ? `20${y}` : y
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  // Native parse fallback
  const parsed = new Date(s)
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return s
}

function normaliseEmploymentType(v: string): FirebaseEmployee['employmentType'] {
  const s = v.toLowerCase()
  if (s.includes('part'))              return 'part_time'
  if (s.includes('contract'))         return 'contract'
  if (s.includes('agency'))           return 'agency'
  if (s.includes('perm') || s.includes('full')) return 'full_time'
  return 'full_time'
}

function normaliseStatus(v: string): FirebaseEmployee['status'] {
  const s = v.toLowerCase()
  if (s.includes('leave'))    return 'on_leave'
  if (s.includes('suspend'))  return 'suspended'
  if (s.includes('resign'))   return 'resigned'
  if (s.includes('terminat')) return 'terminated'
  return 'active'
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
    department:                get('department'),
    startDate:                 normaliseDate(get('startDate')),
    employmentType:            get('employmentType') ? normaliseEmploymentType(get('employmentType')) : 'full_time',
    status:                    get('status') ? normaliseStatus(get('status')) : 'active',
    phone:                     get('phone'),
    dob:                       normaliseDate(get('dob')),
    gender:                    get('gender'),
    cnic:                      get('cnic'),
    maritalStatus:             get('maritalStatus'),
    religion:                  get('religion'),
    pseudonym:                 get('pseudonym'),
    fatherHusbandName:         get('fatherHusbandName'),
    motherName:                get('motherName'),
    currentAddress:            get('currentAddress'),
    permanentAddress:          get('permanentAddress'),
    currentCity:               get('currentCity'),
    hometown:                  get('hometown'),
    companyName:               get('companyName'),
    salary:                    get('salary') ? Number(get('salary').replace(/[^0-9.]/g, '')) || undefined : undefined,
    manager:                   get('manager'),
    workLocation:              get('workLocation'),
    referredBy:                get('referredBy'),
    emergencyContactName:      get('emergencyContactName'),
    emergencyContactPhone:     get('emergencyContactPhone'),
    emergencyContactRelation:  get('emergencyContactRelation'),
    emergencyContactType:      get('emergencyContactType'),
    bankName:                  get('bankName'),
    accountNumber:             get('accountNumber'),
    taxNumber:                 get('taxNumber'),
    characterCertificate:      get('characterCertificate'),
    characterCertificateExpiry:normaliseDate(get('characterCertificateExpiry')),
    skills:                    get('skills'),
    notes:                     get('notes'),
    linkedinUrl:               get('linkedinUrl'),
  }
}

// ── Download a blank template ──────────────────────────────────────────
export function downloadImportTemplate() {
  const headers = IMPORT_FIELDS.map(f => f.label)
  const example = [
    'Ahmed Khan',           // Full Name
    'CCE001',               // Employee ID
    'Dispatch Coordinator', // Designation
    'Operations',           // Department
    '2024-01-15',           // Date of Joining
    'AK',                   // Pseudonym
    '1990-05-20',           // Date of Birth
    'Male',                 // Gender
    '12345-6789012-3',      // CNIC
    'Single',               // Marital Status
    'Islam',                // Religion
    'Muhammad Khan',        // Father / Husband Name
    'Fatima Bibi',          // Mother Name
    '+92 300 0000000',      // Phone
    'ahmed@example.com',    // Email
    '123 Main St, Lahore',  // Current Address
    '456 Old St, Lahore',   // Permanent Address
    'Lahore',               // Current City
    'Faisalabad',           // Hometown
    'CCE Pvt Ltd',          // Company Name
    'Permanent',            // Employment Type
    'Active',               // Status
    '60000',                // Salary
    'Jane Doe',             // Reporting Manager
    'Head Office',          // Work Location
    'Ali Raza',             // Referred By
    'Sara Khan',            // Emergency Contact Name
    '+92 300 1111111',      // Emergency Contact Phone
    'Sister',               // Emergency Contact Relation
    'Family',               // Type of Contact
    'HBL',                  // Bank Name
    'PK00HBL0000000000',    // Account Number
    '',                     // Tax Number
    'Yes',                  // Character Certificate
    '2026-12-31',           // Character Certificate Expiry
    'Excel, Communication', // Skills
    '',                     // Notes
    '',                     // LinkedIn URL
  ]
  const ws = XLSX.utils.aoa_to_sheet([headers, example])
  ws['!cols'] = headers.map(() => ({ wch: 26 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Employees')
  XLSX.writeFile(wb, 'CCE_Employee_Import_Template.xlsx')
}

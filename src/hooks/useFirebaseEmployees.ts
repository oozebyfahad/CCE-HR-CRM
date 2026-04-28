import { useState, useEffect } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'

export interface FirebaseEmployee {
  id: string
  // Identity
  employeeId: string
  name: string
  cnic?: string
  dob?: string
  gender?: string
  maritalStatus?: string
  religion?: string
  fatherHusbandName?: string
  motherName?: string
  // Contact
  phone: string
  email: string
  currentAddress?: string   // Temp. Address
  permanentAddress?: string
  currentCity?: string
  hometown?: string
  // Employment
  jobTitle: string
  department?: string
  project?: string
  employmentType: string
  status: string
  startDate: string
  companyName?: string
  referredBy?: string
  // Emergency / Next of Kin
  emergencyContactName?: string
  emergencyContactRelation?: string
  emergencyContactPhone?: string
  emergencyContactType?: string
  // Financial / Documents
  accountNumber?: string
  characterCertificateExpiry?: string
  // Payroll (system fields)
  payType?: 'hourly' | 'fixed_monthly'
  salary?: number
  hourlyRate?: number
  monthlyHours?: number        // overtime threshold for fixed_monthly (default 160)
  overtimeRate?: number        // PKR/hr above threshold
  eobi?: boolean               // enrolled in EOBI
  // Fixed monthly allowances / deductions (applied every payroll run)
  fuelAllowance?: number       // PKR/month
  gymAllowance?: number        // PKR/month
  securityDeduction?: number   // PKR/month held as security deposit
  // Leave policy (allocations per employee)
  leavePolicy?: {
    annual:          { total: number; paid: boolean }
    sick:            { total: number; paid: boolean }
    casual:          { total: number; paid: boolean }
    unpaid:          { total: number; paid: boolean }
    public_holiday:  { total: number; paid: boolean }
  }
  // Employment details
  manager?: string
  workLocation?: string
  // Financial
  taxNumber?: string       // NTN
  bankName?: string
  // Documents (portal upload reference)
  characterCertificate?: string
  // Optional profile fields
  skills?: string
  notes?: string
  linkedinUrl?: string
  // Profile photo (stored as resized base64 data URL)
  photoUrl?: string
  photoApproved?: boolean
  // Status details
  statusReason?: string
  statusChangedDate?: string
  statusManuallySet?: boolean
  // RotaCloud integration
  rotacloudId?: number
}

export function useFirebaseEmployees() {
  const [employees, setEmployees] = useState<FirebaseEmployee[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  useEffect(() => {
    const q = query(collection(db, 'employees'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() } as FirebaseEmployee)))
      setLoading(false)
    }, err => {
      setError(err.message)
      setLoading(false)
    })
    return unsub
  }, [])

  const addEmployee = async (data: Omit<FirebaseEmployee, 'id'>) => {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null))
    await addDoc(collection(db, 'employees'), {
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  const updateEmployee = async (id: string, data: Partial<FirebaseEmployee>) => {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null))
    await updateDoc(doc(db, 'employees', id), {
      ...clean,
      updatedAt: serverTimestamp(),
    })
  }

  const deleteEmployee = async (id: string) => {
    await deleteDoc(doc(db, 'employees', id))
  }

  return { employees, loading, error, addEmployee, updateEmployee, deleteEmployee }
}

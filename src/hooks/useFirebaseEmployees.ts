import { useState, useEffect } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'

export interface FirebaseEmployee {
  id: string
  // Basic
  name: string
  email: string
  phone: string
  dob?: string
  gender?: string
  cnic?: string
  maritalStatus?: string
  currentAddress?: string
  pseudonym?: string
  religion?: string
  // Employment
  employeeId: string
  jobTitle: string
  department: string
  project?: string        // client / taxi company they're assigned to
  employmentType: string
  status: string
  startDate: string
  workLocation?: string
  manager?: string
  salary?: number
  companyName?: string
  // Personal
  hometown?: string
  currentCity?: string
  permanentAddress?: string
  fatherHusbandName?: string
  motherName?: string
  referredBy?: string
  // Emergency contact
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelation?: string
  emergencyContactType?: string
  // Financial / Documents
  bankName?: string
  accountNumber?: string
  taxNumber?: string
  characterCertificate?: string
  characterCertificateExpiry?: string
  // Payroll
  payType?: 'hourly' | 'fixed_monthly'
  hourlyRate?: number
  monthlyHours?: number        // overtime threshold for fixed_monthly (default 160)
  overtimeRate?: number        // PKR/hr above threshold
  eobi?: boolean               // enrolled in EOBI
  // Fixed monthly allowances / deductions (applied every payroll run)
  fuelAllowance?: number       // PKR/month
  gymAllowance?: number        // PKR/month
  securityDeduction?: number   // PKR/month held as security deposit
  // Optional
  skills?: string
  notes?: string
  linkedinUrl?: string
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

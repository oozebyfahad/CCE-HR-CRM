import { useState, useEffect } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, onSnapshot, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import type { UserRole } from '../types'

// All three collections share the same record shape
export interface FirebaseStaffMember {
  id: string
  name: string
  email: string
  phone: string
  dob?: string
  gender?: string
  cnic?: string
  maritalStatus?: string
  currentAddress?: string
  employeeId: string
  jobTitle: string
  department?: string
  employmentType: string
  status: string
  startDate: string
  workLocation?: string
  manager?: string
  salary?: number
  permanentAddress?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelation?: string
  bankName?: string
  accountNumber?: string
  taxNumber?: string
  skills?: string
  notes?: string
  linkedinUrl?: string
  // which collection this record lives in
  _collection?: StaffCollection
}

export type StaffCollection = 'employees' | 'team_leads' | 'hr'

// Map a login role → Firestore collection name
export function roleToCollection(role: UserRole): StaffCollection | null {
  if (role === 'employee')  return 'employees'
  if (role === 'team_lead') return 'team_leads'
  if (role === 'hr')        return 'hr'
  return null // admin — no separate staff table
}

export const COLLECTION_LABELS: Record<StaffCollection, string> = {
  employees:  'Employee',
  team_leads: 'Team Lead',
  hr:         'HR Staff',
}

// ── Hook for a single collection ────────────────────────────────────────
export function useFirebaseStaff(col: StaffCollection) {
  const [staff,   setStaff]   = useState<FirebaseStaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    const q = query(collection(db, col), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setStaff(snap.docs.map(d => ({ id: d.id, _collection: col, ...d.data() } as FirebaseStaffMember)))
      setLoading(false)
    }, err => {
      setError(err.message)
      setLoading(false)
    })
    return unsub
  }, [col])

  const addStaff = async (data: Omit<FirebaseStaffMember, 'id' | '_collection'>) => {
    await addDoc(collection(db, col), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  const updateStaff = async (id: string, data: Partial<FirebaseStaffMember>) => {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null))
    await updateDoc(doc(db, col, id), { ...clean, updatedAt: serverTimestamp() })
  }

  const deleteStaff = async (id: string) => {
    await deleteDoc(doc(db, col, id))
  }

  return { staff, loading, error, addStaff, updateStaff, deleteStaff }
}

// ── Helper: add to correct collection by role ───────────────────────────
export async function addStaffByRole(
  role: UserRole,
  data: Omit<FirebaseStaffMember, 'id' | '_collection'>,
): Promise<StaffCollection | null> {
  const col = roleToCollection(role)
  if (!col) return null
  await addDoc(collection(db, col), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return col
}

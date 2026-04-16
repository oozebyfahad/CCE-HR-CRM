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
  // Employment
  employeeId: string
  jobTitle: string
  department: string
  employmentType: string
  status: string
  startDate: string
  workLocation?: string
  manager?: string
  salary?: number
  // Additional
  permanentAddress?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelation?: string
  // Financial
  bankName?: string
  accountNumber?: string
  taxNumber?: string
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
    await addDoc(collection(db, 'employees'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  }

  const updateEmployee = async (id: string, data: Partial<FirebaseEmployee>) => {
    await updateDoc(doc(db, 'employees', id), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  const deleteEmployee = async (id: string) => {
    await deleteDoc(doc(db, 'employees', id))
  }

  return { employees, loading, error, addEmployee, updateEmployee, deleteEmployee }
}

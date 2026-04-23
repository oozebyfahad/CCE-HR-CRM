import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import { useAppSelector } from '../store'
import type { FirebaseEmployee } from './useFirebaseEmployees'

export function useMyEmployee() {
  const currentUser = useAppSelector(s => s.auth.user)
  const [employee, setEmployee] = useState<FirebaseEmployee | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!currentUser?.email) {
      setLoading(false)
      return
    }
    const q = query(collection(db, 'employees'), where('email', '==', currentUser.email))
    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        const d = snap.docs[0]
        setEmployee({ id: d.id, ...d.data() } as FirebaseEmployee)
      } else {
        setEmployee(null)
      }
      setLoading(false)
    }, err => {
      setError(err.message)
      setLoading(false)
    })
    return unsub
  }, [currentUser?.email])

  const updateEmployee = async (data: Partial<FirebaseEmployee>) => {
    if (!employee) return
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null))
    await updateDoc(doc(db, 'employees', employee.id), { ...clean, updatedAt: serverTimestamp() })
  }

  return { employee, loading, error, updateEmployee }
}

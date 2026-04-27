import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, limit, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../config/firebase'
import type { FirebaseEmployee } from './useFirebaseEmployees'

// Queries only the current user's own employee record using an email filter.
// This works reliably for employee-role users without requiring access to the
// full employees collection (which they are not permitted to list).
export function useMyEmployee(email: string | undefined) {
  const [employee, setEmployee] = useState<FirebaseEmployee | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!email) { setLoading(false); return }
    const q = query(
      collection(db, 'employees'),
      where('email', '==', email),
      limit(1),
    )
    return onSnapshot(q, snap => {
      setEmployee(snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as FirebaseEmployee))
      setLoading(false)
    }, () => setLoading(false))
  }, [email])

  const updateEmployee = async (id: string, data: Partial<FirebaseEmployee>) => {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null))
    await updateDoc(doc(db, 'employees', id), { ...clean, updatedAt: serverTimestamp() })
  }

  return { employee, loading, updateEmployee }
}

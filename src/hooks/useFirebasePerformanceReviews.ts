import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, query, orderBy,
  addDoc, updateDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import type { PerformanceReview } from '../types'

export function useFirebasePerformanceReviews() {
  const [reviews,  setReviews]  = useState<PerformanceReview[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'performance'), orderBy('reviewDate', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as PerformanceReview)))
      setLoading(false)
    }, err => {
      console.error('Performance reviews listener:', err)
      setLoading(false)
    })
    return unsub
  }, [])

  const addReview = (data: Omit<PerformanceReview, 'id'>) =>
    addDoc(collection(db, 'performance'), { ...data, createdAt: serverTimestamp() })

  const updateReview = (id: string, data: Partial<PerformanceReview>) =>
    updateDoc(doc(db, 'performance', id), data)

  return { reviews, loading, addReview, updateReview }
}

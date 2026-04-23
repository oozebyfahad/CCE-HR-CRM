import { useState, useEffect } from 'react'
import {
  collection, query, onSnapshot, updateDoc, doc, orderBy, deleteDoc,
} from 'firebase/firestore'
import { db } from '../config/firebase'
import type { UserRole } from '../types'

export interface FirebaseUser {
  id: string
  name: string
  email: string
  role: UserRole
  designation?: string
  department?: string
  notification?: {
    message: string
    read: boolean
  }
}

export function useFirebaseUsers() {
  const [users,   setUsers]   = useState<FirebaseUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('name'))
    const unsub = onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as FirebaseUser)))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [])

  const updateUserRole = async (uid: string, role: UserRole) => {
    await updateDoc(doc(db, 'users', uid), { role })
  }

  const sendNotification = async (uid: string, message: string) => {
    await updateDoc(doc(db, 'users', uid), {
      notification: { message, read: false },
    })
  }

  const markNotificationRead = async (uid: string) => {
    await updateDoc(doc(db, 'users', uid), {
      'notification.read': true,
    })
  }

  const deleteUserRecord = async (uid: string) => {
    await deleteDoc(doc(db, 'users', uid))
  }

  return { users, loading, updateUserRole, sendNotification, markNotificationRead, deleteUserRecord }
}

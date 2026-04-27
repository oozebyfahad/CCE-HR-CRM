import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { db } from '../config/firebase'
import type { Org } from '../store/slices/orgSlice'

export function useFirebaseOrgs() {
  const [orgs,    setOrgs]    = useState<Org[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'organizations'), orderBy('name'))
    return onSnapshot(q, snap => {
      setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Org)))
      setLoading(false)
    }, () => setLoading(false))
  }, [])

  const addOrg = (name: string, rotaApiKey: string) =>
    addDoc(collection(db, 'organizations'), { name, rotaApiKey, createdAt: serverTimestamp() })

  const updateOrg = (id: string, data: Partial<Pick<Org, 'name' | 'rotaApiKey'>>) =>
    updateDoc(doc(db, 'organizations', id), data)

  const deleteOrg = (id: string) =>
    deleteDoc(doc(db, 'organizations', id))

  return { orgs, loading, addOrg, updateOrg, deleteOrg }
}

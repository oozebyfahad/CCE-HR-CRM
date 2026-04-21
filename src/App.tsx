import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './config/firebase'
import { AppRouter } from './router'
import { useAppDispatch } from './store'
import { loginSuccess, logout } from './store/slices/authSlice'
import type { UserRole } from './types'
import { CurrencyProvider } from './context/CurrencyContext'

function AuthSync() {
  const dispatch = useAppDispatch()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (snap.exists()) {
          const profile = snap.data()
          dispatch(loginSuccess({
            id:         firebaseUser.uid,
            name:       profile.name       ?? firebaseUser.displayName ?? 'User',
            email:      firebaseUser.email ?? '',
            role:       profile.role as UserRole,
            department: profile.department ?? '',
            avatar:     profile.avatar,
          }))
        }
      } else {
        dispatch(logout())
      }
    })
    return unsub
  }, [dispatch])

  return null
}

export default function App() {
  return (
    <CurrencyProvider>
      <BrowserRouter>
        <AuthSync />
        <AppRouter />
      </BrowserRouter>
    </CurrencyProvider>
  )
}

import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { User } from '../../types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
  error: string | null
}

const stored = localStorage.getItem('cce_hr_user')
const initialState: AuthState = stored
  ? { user: JSON.parse(stored), isAuthenticated: true, loading: false, error: null }
  : { user: null, isAuthenticated: false, loading: false, error: null }

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart(state) {
      state.loading = true
      state.error = null
    },
    loginSuccess(state, action: PayloadAction<User>) {
      state.user = action.payload
      state.isAuthenticated = true
      state.loading = false
      state.error = null
      localStorage.setItem('cce_hr_user', JSON.stringify(action.payload))
    },
    loginFailure(state, action: PayloadAction<string>) {
      state.loading = false
      state.error = action.payload
    },
    logout(state) {
      state.user = null
      state.isAuthenticated = false
      state.loading = false
      state.error = null
      localStorage.removeItem('cce_hr_user')
    },
  },
})

export const { loginStart, loginSuccess, loginFailure, logout } = authSlice.actions
export default authSlice.reducer

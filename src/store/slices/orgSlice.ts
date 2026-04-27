import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface Org {
  id: string
  name: string
  rotaApiKey: string
}

interface OrgState {
  currentOrg: Org | null  // null = default org (uses Vercel env var)
}

const stored = localStorage.getItem('cce_hr_org')
const initialState: OrgState = {
  currentOrg: stored ? JSON.parse(stored) : null,
}

const orgSlice = createSlice({
  name: 'org',
  initialState,
  reducers: {
    setCurrentOrg(state, action: PayloadAction<Org | null>) {
      state.currentOrg = action.payload
      if (action.payload) {
        localStorage.setItem('cce_hr_org', JSON.stringify(action.payload))
      } else {
        localStorage.removeItem('cce_hr_org')
      }
    },
  },
})

export const { setCurrentOrg } = orgSlice.actions
export default orgSlice.reducer

import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

interface UIState {
  sidebarCollapsed: boolean
  notificationCount: number
}

const uiSlice = createSlice({
  name: 'ui',
  initialState: { sidebarCollapsed: false, notificationCount: 14 } as UIState,
  reducers: {
    toggleSidebar(state) { state.sidebarCollapsed = !state.sidebarCollapsed },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) { state.sidebarCollapsed = action.payload },
    setNotificationCount(state, action: PayloadAction<number>) { state.notificationCount = action.payload },
  },
})

export const { toggleSidebar, setSidebarCollapsed, setNotificationCount } = uiSlice.actions
export default uiSlice.reducer

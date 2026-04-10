import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Employee } from '../../types'
import { mockEmployees } from '../../utils/mockData'

interface EmployeeState {
  employees: Employee[]
  selected: Employee | null
  loading: boolean
}

const employeeSlice = createSlice({
  name: 'employees',
  initialState: { employees: mockEmployees, selected: null, loading: false } as EmployeeState,
  reducers: {
    setEmployees(state, action: PayloadAction<Employee[]>) { state.employees = action.payload },
    selectEmployee(state, action: PayloadAction<Employee | null>) { state.selected = action.payload },
    addEmployee(state, action: PayloadAction<Employee>) { state.employees.push(action.payload) },
    updateEmployee(state, action: PayloadAction<Employee>) {
      const i = state.employees.findIndex(e => e.id === action.payload.id)
      if (i !== -1) state.employees[i] = action.payload
    },
    removeEmployee(state, action: PayloadAction<string>) {
      state.employees = state.employees.filter(e => e.id !== action.payload)
    },
  },
})

export const { setEmployees, selectEmployee, addEmployee, updateEmployee, removeEmployee } = employeeSlice.actions
export default employeeSlice.reducer

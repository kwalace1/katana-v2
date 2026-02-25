import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import * as hrApi from '@/lib/hr-api'
import type { Employee } from '@/lib/hr-api'
import { useAuth } from '@/contexts/AuthContext'

const EMPLOYEE_PORTAL_STORAGE_KEY = 'employeePortal_employeeId'

interface EmployeePortalContextType {
  employeeId: string | null
  employee: Employee | null
  setEmployeeId: (id: string | null) => void
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  /** HR employee id for the currently logged-in user (matched by email), if any */
  currentUserEmployeeId: string | null
  /** True when the selected employee is the logged-in user's HR record */
  isViewingSelf: boolean
}

const EmployeePortalContext = createContext<EmployeePortalContextType | undefined>(undefined)

export function EmployeePortalProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth()
  const loginEmail = (profile?.email ?? user?.email ?? '').trim().toLowerCase()

  const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState<string | null>(null)
  const [employeeId, setEmployeeIdState] = useState<string | null>(null)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Portal only shows the logged-in user's own HR record; no switching to other employees
  const setEmployeeId = useCallback((_id: string | null) => {
    // No-op: we never allow viewing as another employee
  }, [])

  const loadEmployee = useCallback(async (id: string | null) => {
    if (!id) {
      setEmployee(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    let skipFinally = false
    try {
      const emp = await hrApi.getEmployeeById(id)
      if (!emp) {
        // Stale or invalid id in storage: clear it so the effect runs init and picks the first available employee
        setEmployeeIdState(null)
        if (typeof window !== 'undefined') localStorage.removeItem(EMPLOYEE_PORTAL_STORAGE_KEY)
        setEmployee(null)
        skipFinally = true // Keep loading true; init will run and manage loading
        return
      }
      setEmployee(emp)
    } catch (e) {
      console.error('Failed to load employee:', e)
      setError(e instanceof Error ? e.message : 'Failed to load employee')
      setEmployee(null)
    } finally {
      if (!skipFinally) setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    if (employeeId) await loadEmployee(employeeId)
  }, [employeeId, loadEmployee])

  // Resolve current user's HR employee by email; portal only shows that user's own data
  useEffect(() => {
    if (!loginEmail) {
      setCurrentUserEmployeeId(null)
      setEmployeeIdState(null)
      setEmployee(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    hrApi.getAllEmployees()
      .then((all) => {
        if (cancelled) return
        const match = all.find((e) => (e.email ?? '').trim().toLowerCase() === loginEmail)
        const id = match?.id ?? null
        setCurrentUserEmployeeId(id)
        setEmployeeIdState(id)
        if (id) {
          loadEmployee(id)
        } else {
          setEmployee(null)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load employees')
          setEmployee(null)
          setCurrentUserEmployeeId(null)
          setEmployeeIdState(null)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [loginEmail, loadEmployee])

  const isViewingSelf = Boolean(
    currentUserEmployeeId && employeeId === currentUserEmployeeId
  )

  const value: EmployeePortalContextType = {
    employeeId,
    employee,
    setEmployeeId,
    loading,
    error,
    refresh,
    currentUserEmployeeId,
    isViewingSelf,
  }

  return (
    <EmployeePortalContext.Provider value={value}>
      {children}
    </EmployeePortalContext.Provider>
  )
}

export function useEmployeePortal() {
  const ctx = useContext(EmployeePortalContext)
  if (ctx === undefined) {
    throw new Error('useEmployeePortal must be used within EmployeePortalProvider')
  }
  return ctx
}

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import * as hrApi from '@/lib/hr-api'
import { MODULES, type ModuleId } from '@/lib/module-access'

const ALL_MODULE_IDS = MODULES.map((m) => m.id)

/** When we can't find an HR employee for the logged-in user, show only these (never full access). */
const DEFAULT_MODULES_WHEN_NO_EMPLOYEE: ModuleId[] = ['employee', 'careers']

interface ModuleAccessContextType {
  /** Module IDs the current user is allowed to access. Admins/owners get all; others get their HR employee module_access. */
  allowedModules: ModuleId[]
  loading: boolean
  /** True if the user has access to the given module (by id or path). */
  hasModuleAccess: (moduleIdOrPath: ModuleId | string) => boolean
}

const ModuleAccessContext = createContext<ModuleAccessContextType | undefined>(undefined)

export function ModuleAccessProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, loading: authLoading, hasRole } = useAuth()
  const [employee, setEmployee] = useState<hrApi.Employee | null>(null)
  const [employeeLoading, setEmployeeLoading] = useState(true)

  const isAdmin = hasRole(['owner', 'admin'])
  const profileEmail = (profile?.email ?? '').trim().toLowerCase()
  const userEmail = (user?.email ?? '').trim().toLowerCase()
  const emailCandidates = useMemo(() => {
    const set = new Set<string>()
    if (profileEmail) set.add(profileEmail)
    if (userEmail) set.add(userEmail)
    return Array.from(set)
  }, [profileEmail, userEmail])

  useEffect(() => {
    if (!user || authLoading) {
      setEmployee(null)
      setEmployeeLoading(false)
      return
    }
    if (isAdmin) {
      setEmployee(null)
      setEmployeeLoading(false)
      return
    }
    if (emailCandidates.length === 0) {
      setEmployee(null)
      setEmployeeLoading(false)
      return
    }
    let cancelled = false
    setEmployeeLoading(true)
    const findEmployee = async () => {
      for (const email of emailCandidates) {
        if (cancelled) return
        const emp = await hrApi.getEmployeeByEmail(email)
        if (emp && !cancelled) {
          setEmployee(emp)
          setEmployeeLoading(false)
          return
        }
      }
      if (!cancelled) setEmployee(null)
    }
    findEmployee().finally(() => {
      if (!cancelled) setEmployeeLoading(false)
    })
    return () => { cancelled = true }
  }, [user, authLoading, isAdmin, emailCandidates])

  const allowedModules = useMemo((): ModuleId[] => {
    // While loading, show all modules so sidebar isn't empty and Hub/etc. are clickable
    if (authLoading || (employeeLoading && !isAdmin)) return [...ALL_MODULE_IDS]
    // Owner/admin always get full access (Hub, HR, all modules) so they can manage the app
    if (isAdmin) return [...ALL_MODULE_IDS]
    // Non-admin: use HR employee record if present (permissions you set in HR for this person)
    if (employee) {
      let list = employee.module_access
      if (typeof list === 'string') {
        try {
          list = JSON.parse(list) as string[]
        } catch {
          list = []
        }
      }
      if (!Array.isArray(list)) list = []
      if (list.length > 0) {
        return list.filter((id): id is ModuleId => ALL_MODULE_IDS.includes(id as ModuleId))
      }
      return [...DEFAULT_MODULES_WHEN_NO_EMPLOYEE]
    }
    // No profile or not in HR and not admin: minimal access only
    if (!profile && user) return [...DEFAULT_MODULES_WHEN_NO_EMPLOYEE]
    return [...DEFAULT_MODULES_WHEN_NO_EMPLOYEE]
  }, [authLoading, employeeLoading, isAdmin, profile, user, employee])

  const value: ModuleAccessContextType = {
    allowedModules,
    loading: authLoading || (employeeLoading && !!user && !isAdmin),
    hasModuleAccess: (moduleIdOrPath: ModuleId | string) => {
      const path = String(moduleIdOrPath)
      if (path.startsWith('/')) {
        const match = MODULES.find((m) => path === `/${m.id}` || path.startsWith(`/${m.id}/`))
        return match ? allowedModules.includes(match.id) : false
      }
      return allowedModules.includes(path as ModuleId)
    },
  }

  return (
    <ModuleAccessContext.Provider value={value}>
      {children}
    </ModuleAccessContext.Provider>
  )
}

export function useModuleAccess() {
  const ctx = useContext(ModuleAccessContext)
  if (ctx === undefined) {
    throw new Error('useModuleAccess must be used within ModuleAccessProvider')
  }
  return ctx
}

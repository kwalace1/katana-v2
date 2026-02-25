import { EmployeePortalNav } from './EmployeePortalNav'

interface EmployeePortalLayoutProps {
  children: React.ReactNode
}

/**
 * Wraps employee portal pages with a shared sub-nav so users can move between
 * Dashboard, Directory, Performance, Goals, etc. without using browser back/forward.
 */
export function EmployeePortalLayout({ children }: EmployeePortalLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <EmployeePortalNav />
      <div>{children}</div>
    </div>
  )
}

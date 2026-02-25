import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { Toaster as ShadcnToaster } from '@/components/ui/toaster'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { ModuleRouteGuard } from './components/ModuleRouteGuard'
import { AuthGuard } from './components/AuthGuard'
import { useAuth } from './contexts/AuthContext'
import { ModuleAccessProvider } from './contexts/ModuleAccessContext'
import HomePage from './pages/HomePage'
import HubPage from './pages/HubPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import MigratePage from './pages/MigratePage'
import InventoryPage from './pages/InventoryPage'
import InventoryCheckOutPage from './pages/InventoryCheckOutPage'
import InventoryScanInPage from './pages/InventoryScanInPage'
import InventoryPurchaseOrdersPage from './pages/InventoryPurchaseOrdersPage'
import InventorySuppliersPage from './pages/InventorySuppliersPage'
import InventoryTransactionsPage from './pages/InventoryTransactionsPage'
import InventoryItemDetailPage from './pages/InventoryItemDetailPage'
import InventoryPurchaseOrderDetailPage from './pages/InventoryPurchaseOrderDetailPage'
import CustomerSuccessPage from './pages/CustomerSuccessPage'
import MigrateCustomerSuccessPage from './pages/MigrateCustomerSuccessPage'
import WorkforcePage from './pages/WorkforcePage'
import HRPage from './pages/HRPage'
import ManufacturingPage from './pages/ManufacturingPage'
import AutomationPage from './pages/AutomationPage'
import KYIPage from './pages/KYIPage'
import KYICompanyPage from './pages/KYICompanyPage'
import KYIInvestorPage from './pages/KYIInvestorPage'
import KYICrossReferencePage from './pages/KYICrossReferencePage'
import CareersPage from './pages/CareersPage'
import { EmployeePortalProvider } from './contexts/EmployeePortalContext'
import { EmployeePortalLayout } from './components/employee/EmployeePortalLayout'
import EmployeePortalPage from './pages/employee/EmployeePortalPage'
import EmployeeDirectoryPage from './pages/employee/EmployeeDirectoryPage'
import EmployeePerformancePage from './pages/employee/EmployeePerformancePage'
import EmployeeGoalsPage from './pages/employee/EmployeeGoalsPage'
import EmployeeDevelopmentPage from './pages/employee/EmployeeDevelopmentPage'
import EmployeeProfilePage from './pages/employee/EmployeeProfilePage'
import JobApplicationsPage from './pages/employee/JobApplicationsPage'
import OnboardingPage from './pages/OnboardingPage'
import OrganizationSettingsPage from './pages/OrganizationSettingsPage'
import AcceptInvitePage from './pages/AcceptInvitePage'

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { loading } = useAuth()
  const [showLoading, setShowLoading] = useState(true)
  
  // Only show sidebar and header when not on landing page and not in employee portal
  const isLandingPage = location.pathname === '/'
  const isEmployeePortal = location.pathname.startsWith('/employee')

  // Handle OAuth callback errors (e.g. "Unable to exchange external code")
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const error = params.get('error')
    const description = params.get('error_description') ?? ''
    if (error === 'server_error' && description.includes('exchange')) {
      toast.error('Sign-in failed', {
        description: 'Microsoft sign-in could not be completed. Check that the Azure client secret in Supabase is correct and not expired, and that the redirect URI in Azure matches exactly.',
      })
      navigate(location.pathname, { replace: true })
    } else if (error) {
      toast.error('Sign-in failed', { description: description || 'Something went wrong. Please try again.' })
      navigate(location.pathname, { replace: true })
    }
  }, [location.search, location.pathname, navigate])

  // Hide loading screen after auth initializes or after 2 seconds max
  useEffect(() => {
    if (!loading) {
      setShowLoading(false)
    } else {
      const timer = setTimeout(() => {
        setShowLoading(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [loading])

  // Show loading screen during initial auth
  if (showLoading && !isLandingPage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Loading...</p>
          <p className="text-sm text-muted-foreground mt-2">Initializing authentication</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster />
      <ShadcnToaster />
      <ModuleAccessProvider>
        {!isLandingPage && !isEmployeePortal && (
          <Sidebar 
            isCollapsed={isSidebarCollapsed} 
            setIsCollapsed={setIsSidebarCollapsed} 
          />
        )}
        <div className={`transition-all duration-300 ${!isLandingPage && !isEmployeePortal ? (isSidebarCollapsed ? 'lg:ml-16' : 'lg:ml-72') : ''}`}>
          {!isLandingPage && !isEmployeePortal && <Header />}
          <AuthGuard />
          <ModuleRouteGuard />
          <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/hub" element={<HubPage />} />
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/settings/organization" element={<OrganizationSettingsPage />} />
          
          {/* Projects Routes */}
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          
          {/* Database Migration */}
          <Route path="/migrate" element={<MigratePage />} />
          <Route path="/migrate-customer-success" element={<MigrateCustomerSuccessPage />} />
          
          {/* Inventory Routes */}
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/inventory/check-out" element={<InventoryCheckOutPage />} />
          <Route path="/inventory/scan-in" element={<InventoryScanInPage />} />
          <Route path="/inventory/purchase-orders" element={<InventoryPurchaseOrdersPage />} />
          <Route path="/inventory/purchase-orders/:id" element={<InventoryPurchaseOrderDetailPage />} />
          <Route path="/inventory/suppliers" element={<InventorySuppliersPage />} />
          <Route path="/inventory/transactions" element={<InventoryTransactionsPage />} />
          <Route path="/inventory/items/:id" element={<InventoryItemDetailPage />} />
          
          {/* Other Module Routes */}
          <Route path="/customer-success" element={<CustomerSuccessPage />} />
          <Route path="/workforce" element={<WorkforcePage />} />
          <Route path="/hr" element={<HRPage />} />
          <Route path="/manufacturing" element={<ManufacturingPage />} />
          <Route path="/automation" element={<AutomationPage />} />
          <Route path="/kyi" element={<KYIPage />} />
          <Route path="/kyi/companies/:id" element={<KYICompanyPage />} />
          <Route path="/kyi/investors/:id" element={<KYIInvestorPage />} />
          <Route path="/kyi/cross-reference" element={<KYICrossReferencePage />} />
          
          {/* Employee Portal Routes - provider + layout with in-portal nav */}
          <Route path="/employee" element={<EmployeePortalProvider><EmployeePortalLayout><EmployeePortalPage /></EmployeePortalLayout></EmployeePortalProvider>} />
          <Route path="/employee/directory" element={<EmployeePortalProvider><EmployeePortalLayout><EmployeeDirectoryPage /></EmployeePortalLayout></EmployeePortalProvider>} />
          <Route path="/employee/performance" element={<EmployeePortalProvider><EmployeePortalLayout><EmployeePerformancePage /></EmployeePortalLayout></EmployeePortalProvider>} />
          <Route path="/employee/goals" element={<EmployeePortalProvider><EmployeePortalLayout><EmployeeGoalsPage /></EmployeePortalLayout></EmployeePortalProvider>} />
          <Route path="/employee/development" element={<EmployeePortalProvider><EmployeePortalLayout><EmployeeDevelopmentPage /></EmployeePortalLayout></EmployeePortalProvider>} />
          <Route path="/employee/profile" element={<EmployeePortalProvider><EmployeePortalLayout><EmployeeProfilePage /></EmployeePortalLayout></EmployeePortalProvider>} />
          <Route path="/employee/jobs" element={<EmployeePortalProvider><EmployeePortalLayout><JobApplicationsPage /></EmployeePortalLayout></EmployeePortalProvider>} />
        </Routes>
        </div>
      </ModuleAccessProvider>
    </div>
  )
}

export default App

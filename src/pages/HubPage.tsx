import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  FolderKanban,
  Package,
  Users,
  Briefcase,
  UserCheck,
  Factory,
  Bot,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Settings,
  ChevronDown,
  ChevronUp,
  BarChart3,
  GripVertical,
  Edit,
  Check,
  X,
} from 'lucide-react'
import * as ProjectData from '@/lib/project-data-supabase'
import type { Project } from '@/lib/project-data'
import * as CSApi from '@/lib/customer-success-api'
import * as HRApi from '@/lib/hr-api'
import { getRecentProjectActivities } from '@/lib/supabase-api'
import { getAllJobs, getAllApplications } from '@/lib/recruitment-db'
import { useAuth } from '@/contexts/AuthContext'
import { useModuleAccess } from '@/contexts/ModuleAccessContext'

const HUB_SETTINGS_KEY = 'zenith_hub_settings'

function loadHubSettings() {
  try {
    const raw = localStorage.getItem(HUB_SETTINGS_KEY)
    if (raw) {
      const s = JSON.parse(raw) as Record<string, string>
      return {
        dashboardLayout: s.dashboardLayout === 'compact' || s.dashboardLayout === 'detailed' ? s.dashboardLayout : 'default',
        defaultTimeRange: s.defaultTimeRange === '24h' || s.defaultTimeRange === '30d' ? s.defaultTimeRange : '7d',
        refreshInterval: s.refreshInterval === '1min' || s.refreshInterval === '5min' || s.refreshInterval === 'manual' ? s.refreshInterval : '2min',
      }
    }
  } catch {
    /* ignore */
  }
  return { dashboardLayout: 'default' as const, defaultTimeRange: '7d' as const, refreshInterval: '2min' as const }
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffM = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  if (diffM < 1) return 'Just now'
  if (diffM < 60) return `${diffM} min ago`
  if (diffH < 24) return `${diffH} hour${diffH !== 1 ? 's' : ''} ago`
  if (diffD < 7) return `${diffD} day${diffD !== 1 ? 's' : ''} ago`
  return d.toLocaleDateString()
}

export default function HubPage() {
  const { loading: authLoading, user } = useAuth()
  const { hasModuleAccess } = useModuleAccess()
  const [hubSettings, setHubSettings] = useState(() => loadHubSettings())
  const [timeRange, setTimeRange] = useState(() => loadHubSettings().defaultTimeRange)
  const [refreshTrigger, setRefreshTrigger] = useState<number | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [createType, setCreateType] = useState('')
  const [createTitle, setCreateTitle] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [csClients, setCSClients] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [performanceReviews, setPerformanceReviews] = useState<any[]>([])
  const [goals, setGoals] = useState<any[]>([])
  const [jobPostings, setJobPostings] = useState<any[]>([])
  const [jobApplications, setJobApplications] = useState<any[]>([])
  const [feedActivities, setFeedActivities] = useState<Array<{ type: 'success' | 'warning' | 'info'; module: string; message: string; time: string }>>([])
  const [loading, setLoading] = useState(true)
  const [isKpisExpanded, setIsKpisExpanded] = useState(false)
  const [isPerformanceExpanded, setIsPerformanceExpanded] = useState(true) // Default to expanded
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set())
  const [isModuleEditMode, setIsModuleEditMode] = useState(false)
  const [moduleOrder, setModuleOrder] = useState<number[]>(() => {
    // Load saved order from localStorage
    const saved = localStorage.getItem('zenith_hub_module_order')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  })
  const [draggedModuleIndex, setDraggedModuleIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Constants for performance calculations
  const PERFORMANCE_THRESHOLDS = {
    EXCELLENT: 90,
    GOOD: 75,
    MIN_HEALTH: 85,
    MAX_HEALTH: 98,
    HEALTH_BOOST: 5, // Add 5% to completion rate for health score
  }

  // Handle drag and drop for modules
  const handleModuleDragStart = (index: number) => {
    if (!isModuleEditMode) return
    setDraggedModuleIndex(index)
  }

  const handleModuleDragEnter = (index: number) => {
    if (!isModuleEditMode || draggedModuleIndex === null || draggedModuleIndex === index) {
      setDragOverIndex(index)
      return
    }
    
    setDragOverIndex(index)
    const newOrder = [...moduleOrder]
    const draggedItem = newOrder[draggedModuleIndex]
    newOrder.splice(draggedModuleIndex, 1)
    newOrder.splice(index, 0, draggedItem)
    setModuleOrder(newOrder)
    setDraggedModuleIndex(index)
  }

  const handleModuleDragEnd = () => {
    setDraggedModuleIndex(null)
    setDragOverIndex(null)
  }

  // Keyboard navigation for module reordering
  const handleModuleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    if (!isModuleEditMode) return
    
    if (e.key === 'ArrowUp' && currentIndex > 0) {
      e.preventDefault()
      const newOrder = [...moduleOrder]
      const temp = newOrder[currentIndex]
      newOrder[currentIndex] = newOrder[currentIndex - 1]
      newOrder[currentIndex - 1] = temp
      setModuleOrder(newOrder)
      toast.info(`Moved ${orderedModules[currentIndex]?.name} up`)
    } else if (e.key === 'ArrowDown' && currentIndex < orderedModules.length - 1) {
      e.preventDefault()
      const newOrder = [...moduleOrder]
      const temp = newOrder[currentIndex]
      newOrder[currentIndex] = newOrder[currentIndex + 1]
      newOrder[currentIndex + 1] = temp
      setModuleOrder(newOrder)
      toast.info(`Moved ${orderedModules[currentIndex]?.name} down`)
    }
  }

  // Load all data from Supabase - but only after auth is ready
  useEffect(() => {
    // Don't load data while auth is still loading
    if (authLoading) {
      return
    }

    const loadAllData = async () => {
      try {
        setLoading(true)
        
        // Use Promise.allSettled to prevent one failure from blocking others
        // Also add timeouts to prevent hanging
        const timeout = (ms: number) => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), ms)
        )
        
        const withTimeout = <T,>(promise: Promise<T>, ms: number = 5000): Promise<T> => 
          Promise.race([promise, timeout(ms)]) as Promise<T>
        
        // Load all data in parallel with timeouts
        const [
          projectsResult,
          clientsResult,
          employeesResult,
          reviewsResult,
          goalsResult,
          jobsResult,
          appsResult,
          hrActivitiesResult,
          projectActivitiesResult,
        ] = await Promise.allSettled([
          withTimeout(ProjectData.getAllProjects()),
          withTimeout(CSApi.getAllClients()),
          withTimeout(HRApi.getAllEmployees()),
          withTimeout(HRApi.getAllPerformanceReviews()),
          withTimeout(HRApi.getAllGoals()),
          withTimeout(getAllJobs()),
          withTimeout(getAllApplications()),
          withTimeout(HRApi.getRecentActivities(25)),
          withTimeout(getRecentProjectActivities(25)),
        ])

        // Set data for successful fetches, use empty arrays for failures
        if (projectsResult.status === 'fulfilled') setProjects(projectsResult.value)
        if (clientsResult.status === 'fulfilled') setCSClients(clientsResult.value)
        if (employeesResult.status === 'fulfilled') setEmployees(employeesResult.value)
        if (reviewsResult.status === 'fulfilled') setPerformanceReviews(reviewsResult.value)
        if (goalsResult.status === 'fulfilled') setGoals(goalsResult.value)
        if (jobsResult.status === 'fulfilled') setJobPostings(jobsResult.value)
        if (appsResult.status === 'fulfilled') setJobApplications(appsResult.value)

        // Build activity feed from HR + project activities (real data)
        const hrActivities = hrActivitiesResult.status === 'fulfilled' ? hrActivitiesResult.value : []
        const projectActivities = projectActivitiesResult.status === 'fulfilled' ? projectActivitiesResult.value : []
        const hrFeedItems = hrActivities.map((a) => {
          const successTypes = ['goal_completed', 'review_completed', 'recognition_given']
          const type: 'success' | 'warning' | 'info' = successTypes.includes(a.type) ? 'success' : 'info'
          return { type, module: 'HR', message: a.description, time: formatRelativeTime(a.created_at), sortAt: new Date(a.created_at).getTime() }
        })
        const projectFeedItems = projectActivities.map((a) => ({
          type: 'info' as const,
          module: 'PM',
          message: a.description,
          time: formatRelativeTime(a.created_at),
          sortAt: new Date(a.created_at).getTime(),
        }))
        const merged = [...hrFeedItems, ...projectFeedItems]
          .sort((a, b) => b.sortAt - a.sortAt)
          .slice(0, 20)
          .map(({ type, module, message, time }) => ({ type, module, message, time }))
        setFeedActivities(merged)

        // Log any failures for debugging
        const failures = [projectsResult, clientsResult, employeesResult, reviewsResult, goalsResult, jobsResult, appsResult, hrActivitiesResult, projectActivitiesResult]
          .filter(r => r.status === 'rejected')
        if (failures.length > 0) {
          console.warn('Some data failed to load:', failures)
        }
      } catch (err) {
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAllData()

    // Listen for updates
    const handleProjectUpdate = () => loadAllData()
    const handleAppUpdate = () => loadAllData()
    
    window.addEventListener('projectDataUpdated', handleProjectUpdate)
    window.addEventListener('applicationSubmitted', handleAppUpdate)
    window.addEventListener('applicationUpdated', handleAppUpdate)
    
    return () => {
      window.removeEventListener('projectDataUpdated', handleProjectUpdate)
      window.removeEventListener('applicationSubmitted', handleAppUpdate)
      window.removeEventListener('applicationUpdated', handleAppUpdate)
    }
  }, [authLoading, user, refreshTrigger])

  // Auto-refresh when refresh interval is not manual
  useEffect(() => {
    if (hubSettings.refreshInterval === 'manual') return
    const ms = hubSettings.refreshInterval === '1min' ? 60_000 : hubSettings.refreshInterval === '5min' ? 300_000 : 120_000
    const id = setInterval(() => setRefreshTrigger(Date.now()), ms)
    return () => clearInterval(id)
  }, [hubSettings.refreshInterval])

  // Calculate real project metrics
  const projectMetrics = useMemo(() => {
    if (projects.length === 0) {
      return {
        completionRate: 0,
        overdueTasks: 0,
        totalTasks: 0,
        completedTasks: 0,
      }
    }

    const totalTasks = projects.reduce((sum, p) => sum + p.totalTasks, 0)
    const completedTasks = projects.reduce((sum, p) => sum + p.completedTasks, 0)
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    // Calculate overdue tasks
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const overdueTasks = projects.reduce((count, project) => {
      return count + project.tasks.filter(task => {
        if (!task.deadline || task.status === 'done') return false
        const taskDeadline = new Date(task.deadline)
        taskDeadline.setHours(0, 0, 0, 0)
        return taskDeadline < today
      }).length
    }, 0)

    return {
      completionRate,
      overdueTasks,
      totalTasks,
      completedTasks,
    }
  }, [projects])

  // Calculate Katana Customers metrics
  const csMetrics = useMemo(() => {
    if (csClients.length === 0) {
      return {
        avgHealthScore: 0,
        atRiskClients: 0,
        upcomingRenewals: 0,
        avgNPS: 0,
      }
    }

    const totalHealth = csClients.reduce((sum, c) => sum + (c.health_score || 0), 0)
    const avgHealthScore = Math.round(totalHealth / csClients.length)
    
    const atRiskClients = csClients.filter(c => c.status === 'at-risk').length
    
    // Count renewals in next 60 days
    const today = new Date()
    const sixtyDaysLater = new Date(today)
    sixtyDaysLater.setDate(today.getDate() + 60)
    const upcomingRenewals = csClients.filter(c => {
      if (!c.renewal_date) return false
      const renewalDate = new Date(c.renewal_date)
      return renewalDate >= today && renewalDate <= sixtyDaysLater
    }).length
    
    const totalNPS = csClients.reduce((sum, c) => sum + (c.nps_score || 0), 0)
    const avgNPS = Math.round(totalNPS / csClients.length)

    return {
      avgHealthScore,
      atRiskClients,
      upcomingRenewals,
      avgNPS,
    }
  }, [csClients])

  // Calculate HR metrics
  const hrMetrics = useMemo(() => {
    // Case-insensitive status check
    const activeEmployees = employees.filter(e => e.status?.toLowerCase() === 'active').length
    
    // Reviews due in next 30 days
    const today = new Date()
    const thirtyDaysLater = new Date(today)
    thirtyDaysLater.setDate(today.getDate() + 30)
    const reviewsDue = employees.filter(e => {
      if (!e.next_review_date) return false
      const reviewDate = new Date(e.next_review_date)
      return reviewDate >= today && reviewDate <= thirtyDaysLater
    }).length
    
    // Open job positions (handle TRUE as string from database)
    const openPositions = jobPostings.filter(j => 
      j.is_active === true || j.is_active === 'TRUE' || j.is_active === 'true'
    ).length
    
    // New applications (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(today.getDate() - 7)
    const newApplications = jobApplications.filter(a => {
      const appliedDate = new Date(a.applied_date)
      return appliedDate >= sevenDaysAgo
    }).length
    
    // Calculate average performance score
    const employeesWithScore = employees.filter(e => e.performance_score)
    const avgPerformance = employeesWithScore.length > 0
      ? employeesWithScore.reduce((sum, e) => sum + (e.performance_score || 0), 0) / employeesWithScore.length
      : 0

    return {
      activeEmployees,
      reviewsDue,
      openPositions,
      newApplications,
      avgPerformance: Math.round(avgPerformance * 10) / 10,
    }
  }, [employees, performanceReviews, jobPostings, jobApplications])

  const kpis = [
    {
      title: 'Active Projects',
      value: projects.filter(p => p.status === 'active').length.toString(),
      trend: '+12%',
      trendUp: true,
      icon: FolderKanban,
      color: 'text-blue-500',
    },
    {
      title: 'Open Tasks',
      value: (projectMetrics.totalTasks - projectMetrics.completedTasks).toString(),
      trend: '-8%',
      trendUp: false,
      icon: CheckCircle2,
      color: 'text-green-500',
    },
    {
      title: 'Active Clients',
      value: csClients.filter(c => c.status !== 'at-risk').length.toString(),
      trend: csMetrics.atRiskClients > 0 ? `-${csMetrics.atRiskClients}` : '+5%',
      trendUp: csMetrics.atRiskClients === 0,
      icon: Users,
      color: 'text-purple-500',
    },
    {
      title: 'Team Members',
      value: hrMetrics.activeEmployees.toString(),
      trend: '+0',
      trendUp: true,
      icon: UserCheck,
      color: 'text-orange-500',
    },
    {
      title: 'Katana Inventory Value',
      value: '$2.4M',
      trend: '+15%',
      trendUp: true,
      icon: Package,
      color: 'text-emerald-500',
    },
    {
      title: 'Manufacturing OEE',
      value: '87%',
      trend: '+3%',
      trendUp: true,
      icon: Factory,
      color: 'text-cyan-500',
    },
    {
      title: 'Job Applications',
      value: hrMetrics.newApplications.toString(),
      trend: '+28%',
      trendUp: true,
      icon: Bot,
      color: 'text-pink-500',
    },
  ]

  const modules = [
    {
      moduleId: 'projects' as const,
      name: 'Katana Projects',
      shortName: 'PM',
      icon: FolderKanban,
      color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      metrics: [
        { label: 'Completion', value: `${projectMetrics.completionRate}%`, progress: projectMetrics.completionRate },
        { label: 'Overdue Tasks', value: projectMetrics.overdueTasks.toString(), status: projectMetrics.overdueTasks > 0 ? 'warning' : 'success' },
        { label: 'Active Projects', value: projects.filter(p => p.status === 'active').length.toString(), status: 'info' },
      ],
      href: '/projects',
    },
    {
      moduleId: 'inventory' as const,
      name: 'Katana Inventory',
      shortName: 'INV',
      icon: Package,
      color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      metrics: [
        { label: 'Stock Level', value: 'Good', status: 'success' },
        { label: 'Low Stock Alerts', value: '3', status: 'warning' },
        { label: 'PO Status', value: '8 pending', status: 'info' },
      ],
      href: '/inventory',
    },
    {
      moduleId: 'customer-success' as const,
      name: 'Katana Customers',
      shortName: 'CSP',
      icon: Users,
      color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      metrics: [
        { label: 'Avg Health Score', value: `${csMetrics.avgHealthScore}%`, progress: csMetrics.avgHealthScore },
        { label: 'At-Risk Clients', value: csMetrics.atRiskClients.toString(), status: csMetrics.atRiskClients > 0 ? 'warning' : 'success' },
        { label: 'Renewals (60d)', value: csMetrics.upcomingRenewals.toString(), status: 'info' },
      ],
      href: '/customer-success',
    },
    {
      moduleId: 'workforce' as const,
      name: 'Katana Workforce',
      shortName: 'WFM',
      icon: Briefcase,
      color: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      metrics: [
        { label: 'Active Jobs', value: '28', status: 'success' },
        { label: 'Technicians Online', value: '18/22', progress: 82 },
        { label: 'Schedule Adherence', value: '94%', progress: 94 },
      ],
      href: '/workforce',
    },
    {
      moduleId: 'hr' as const,
      name: 'Katana HR',
      shortName: 'Katana HR',
      icon: UserCheck,
      color: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
      metrics: [
        { label: 'Active Employees', value: hrMetrics.activeEmployees.toString(), status: 'success' },
        { label: 'Reviews Due (30d)', value: hrMetrics.reviewsDue.toString(), status: hrMetrics.reviewsDue > 0 ? 'warning' : 'success' },
        { label: 'Open Positions', value: hrMetrics.openPositions.toString(), status: 'info' },
      ],
      href: '/hr',
    },
    {
      moduleId: 'employee' as const,
      name: 'Employee Portal',
      shortName: 'Portal',
      icon: Users,
      color: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
      metrics: [
        { label: 'My Profile', value: 'View', status: 'info' },
        { label: 'Directory', value: 'Browse', status: 'info' },
        { label: 'Goals & Performance', value: 'Track', status: 'info' },
      ],
      href: '/employee',
    },
    {
      moduleId: 'careers' as const,
      name: 'Careers',
      shortName: 'Careers',
      icon: Briefcase,
      color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      metrics: [
        { label: 'Open Roles', value: jobPostings.filter(j => j.is_active).length.toString(), status: 'info' },
        { label: 'Applications', value: jobApplications.length.toString(), status: 'info' },
        { label: 'Browse jobs', value: 'Go', status: 'info' },
      ],
      href: '/careers',
    },
    {
      moduleId: 'manufacturing' as const,
      name: 'Manufacturing Ops',
      shortName: 'Z-MO',
      icon: Factory,
      color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
      metrics: [
        { label: 'Machine Status', value: '12/14 running', progress: 86 },
        { label: 'Production Rate', value: '245/hr', status: 'success' },
        { label: 'Downtime', value: '2.3%', status: 'success' },
      ],
      href: '/manufacturing',
    },
    {
      moduleId: 'automation' as const,
      name: 'Automation',
      shortName: 'AUTO',
      icon: Bot,
      color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      metrics: [
        { label: 'Bot Activity', value: '342 jobs', status: 'success' },
        { label: 'Success Rate', value: '98.5%', progress: 98.5 },
        { label: 'Processing', value: '1.2k docs/day', status: 'info' },
      ],
      href: '/automation',
    },
  ]

  // Initialize module order after modules are defined with validation
  useEffect(() => {
    if (modules.length > 0) {
      if (moduleOrder.length === 0) {
        // First time - create default order
        const defaultOrder = modules.map((_, index) => index)
        setModuleOrder(defaultOrder)
      } else {
        // Validate saved order - ensure all indices are valid
        const validOrder = moduleOrder.filter(index => index >= 0 && index < modules.length)
        if (validOrder.length !== modules.length) {
          // Order is invalid or incomplete - reset to default
          const defaultOrder = modules.map((_, index) => index)
          setModuleOrder(defaultOrder)
        } else if (validOrder.length !== moduleOrder.length) {
          // Some indices were invalid - use cleaned version
          setModuleOrder(validOrder)
        }
      }
    }
  }, [modules.length])

  // Save module order to localStorage whenever it changes
  useEffect(() => {
    if (moduleOrder.length > 0) {
      localStorage.setItem('zenith_hub_module_order', JSON.stringify(moduleOrder))
    }
  }, [moduleOrder])

  // Get ordered modules based on saved order, then filter to only modules the user has access to (HR-assigned)
  const orderedModules = useMemo(() => {
    const list = moduleOrder.length === modules.length
      ? moduleOrder.map(i => modules[i]).filter(Boolean)
      : modules
    return list.filter((m) => hasModuleAccess(m.moduleId))
  }, [moduleOrder, modules, hasModuleAccess])

  // Show loading state while auth is loading or data is loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Loading Hub data...</p>
        </div>
      </div>
    )
  }

  const layoutClass = hubSettings.dashboardLayout === 'compact' ? 'p-4' : hubSettings.dashboardLayout === 'detailed' ? 'p-6' : 'p-6'
  const sectionGap = hubSettings.dashboardLayout === 'compact' ? 'gap-4 mb-6' : 'gap-6 mb-8'

  return (
    <div className={`min-h-screen bg-background ${layoutClass}`} data-layout={hubSettings.dashboardLayout}>
      <div className={sectionGap}>
        <div className={`flex items-center justify-between ${hubSettings.dashboardLayout === 'compact' ? 'mb-3' : 'mb-4'}`}>
          <div>
            <h1 className={`font-bold mb-2 ${hubSettings.dashboardLayout === 'compact' ? 'text-2xl' : 'text-4xl'}`}>Katana Hub</h1>
            <p className="text-muted-foreground">BusinessOps Platform - Central Command Center</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-2">
              <Activity className="h-3 w-3" />
              System Healthy
            </Badge>
            <Badge variant="secondary">Last sync: 2 min ago</Badge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Search className="h-4 w-4" />
                Quick Search
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Quick Search</DialogTitle>
                <DialogDescription>Search across all modules and data</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="search-query">Search Query</Label>
                  <Input 
                    id="search-query"
                    placeholder="Search projects, tasks, clients, inventory..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    className="flex-1"
                    onClick={() => {
                      if (searchQuery.trim()) {
                        toast.info(`Searching for: "${searchQuery}"`)
                        setSearchQuery('')
                        setIsSearchOpen(false)
                      } else {
                        toast.error('Please enter a search query')
                      }
                    }}
                  >
                    Search
                  </Button>
                  <Button variant="outline" onClick={() => setIsSearchOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Quick Create
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Quick Create</DialogTitle>
                <DialogDescription>Create a new item in any module</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="create-type">Type</Label>
                  <Select value={createType} onValueChange={setCreateType}>
                    <SelectTrigger id="create-type">
                      <SelectValue placeholder="Select what to create" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="inventory">Inventory Item</SelectItem>
                      <SelectItem value="job">Workforce Job</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="create-title">Title/Name</Label>
                  <Input 
                    id="create-title"
                    placeholder="Enter title or name"
                    value={createTitle}
                    onChange={(e) => setCreateTitle(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    className="flex-1"
                    onClick={() => {
                      if (createType && createTitle.trim()) {
                        toast.success(`Creating ${createType}: "${createTitle}"`)
                        setCreateType('')
                        setCreateTitle('')
                        setIsCreateOpen(false)
                      } else {
                        toast.error('Please select a type and enter a title')
                      }
                    }}
                  >
                    Create
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Hub Settings</DialogTitle>
                <DialogDescription>Configure your hub preferences. Changes are saved and applied immediately.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Dashboard Layout</Label>
                  <Select
                    value={hubSettings.dashboardLayout}
                    onValueChange={(v) => {
                      const next = { ...hubSettings, dashboardLayout: v as 'default' | 'compact' | 'detailed' }
                      setHubSettings(next)
                      localStorage.setItem(HUB_SETTINGS_KEY, JSON.stringify(next))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default Layout</SelectItem>
                      <SelectItem value="compact">Compact View</SelectItem>
                      <SelectItem value="detailed">Detailed View</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Default Time Range</Label>
                  <Select
                    value={hubSettings.defaultTimeRange}
                    onValueChange={(v) => {
                      const next = { ...hubSettings, defaultTimeRange: v as '24h' | '7d' | '30d' }
                      setHubSettings(next)
                      setTimeRange(next.defaultTimeRange)
                      localStorage.setItem(HUB_SETTINGS_KEY, JSON.stringify(next))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24h">24 Hours</SelectItem>
                      <SelectItem value="7d">7 Days</SelectItem>
                      <SelectItem value="30d">30 Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Refresh Interval</Label>
                  <Select
                    value={hubSettings.refreshInterval}
                    onValueChange={(v) => {
                      const next = { ...hubSettings, refreshInterval: v as '1min' | '2min' | '5min' | 'manual' }
                      setHubSettings(next)
                      localStorage.setItem(HUB_SETTINGS_KEY, JSON.stringify(next))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1min">1 minute</SelectItem>
                      <SelectItem value="2min">2 minutes</SelectItem>
                      <SelectItem value="5min">5 minutes</SelectItem>
                      <SelectItem value="manual">Manual only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      localStorage.setItem(HUB_SETTINGS_KEY, JSON.stringify(hubSettings))
                      setTimeRange(hubSettings.defaultTimeRange)
                      toast.success('Settings saved')
                      setIsSettingsOpen(false)
                    }}
                  >
                    Save Settings
                  </Button>
                  <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <div className="flex-1" />
          <div className="flex gap-2">
            <Button variant={timeRange === '24h' ? 'default' : 'outline'} size="sm" onClick={() => setTimeRange('24h')}>
              24h
            </Button>
            <Button variant={timeRange === '7d' ? 'default' : 'outline'} size="sm" onClick={() => setTimeRange('7d')}>
              7d
            </Button>
            <Button variant={timeRange === '30d' ? 'default' : 'outline'} size="sm" onClick={() => setTimeRange('30d')}>
              30d
            </Button>
          </div>
        </div>
      </div>

      {/* Top Section: Performance Overview and KPIs */}
      <div className={`grid grid-cols-1 lg:grid-cols-2 ${hubSettings.dashboardLayout === 'compact' ? 'gap-4 mb-6' : 'gap-6 mb-8'}`}>
        {/* Performance Overview - Top Left */}
        <Collapsible open={isPerformanceExpanded} onOpenChange={setIsPerformanceExpanded}>
          <Card className="hover:shadow-lg transition-shadow">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Performance Overview
                  </CardTitle>
                  {isPerformanceExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {isPerformanceExpanded ? 'Click to collapse' : 'Click to view performance metrics'}
                </p>
                {!isPerformanceExpanded && (
                  <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground">Overall Health</div>
                      <div className="text-lg font-semibold text-green-600">
                        {projectMetrics.totalTasks > 0 
                          ? Math.max(PERFORMANCE_THRESHOLDS.MIN_HEALTH, Math.min(PERFORMANCE_THRESHOLDS.MAX_HEALTH, Math.round((projectMetrics.completedTasks / projectMetrics.totalTasks) * 100) + PERFORMANCE_THRESHOLDS.HEALTH_BOOST))
                          : PERFORMANCE_THRESHOLDS.MAX_HEALTH - 4}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Active Projects</div>
                      <div className="text-lg font-semibold">{projects.filter(p => p.status === 'active').length}</div>
                    </div>
                  </div>
                )}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Overall Health</div>
                    <div className="text-3xl font-bold text-green-600">
                      {projectMetrics.totalTasks > 0 
                        ? Math.max(PERFORMANCE_THRESHOLDS.MIN_HEALTH, Math.min(PERFORMANCE_THRESHOLDS.MAX_HEALTH, Math.round((projectMetrics.completedTasks / projectMetrics.totalTasks) * 100) + PERFORMANCE_THRESHOLDS.HEALTH_BOOST))
                        : PERFORMANCE_THRESHOLDS.MAX_HEALTH - 4}%
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <TrendingUp className="h-3 w-3" />
                      <span>+2% from last week</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Active Work</div>
                    <div className="text-3xl font-bold">{projects.filter(p => p.status === 'active').length}</div>
                    <div className="text-xs text-muted-foreground">Projects in progress</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Task Completion</div>
                    <div className="text-3xl font-bold">
                      {projectMetrics.totalTasks > 0 
                        ? Math.round((projectMetrics.completedTasks / projectMetrics.totalTasks) * 100)
                        : 0}%
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {projectMetrics.completedTasks} of {projectMetrics.totalTasks} tasks
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-muted-foreground">Client Satisfaction</div>
                    <div className="text-3xl font-bold">
                      {csMetrics.atRiskClients === 0 ? '98%' : `${Math.round(100 - (csMetrics.atRiskClients / Math.max(csClients.length, 1) * 100))}%`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {csMetrics.atRiskClients === 0 ? 'All clients healthy' : `${csMetrics.atRiskClients} at risk`}
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">System Performance</span>
                    <span className="font-medium">Excellent</span>
                  </div>
                  <Progress value={94} className="h-2" />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* KPIs Expandable Box - Top Right */}
        <Collapsible open={isKpisExpanded} onOpenChange={setIsKpisExpanded}>
          <Card className="hover:shadow-lg transition-shadow">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Key Metrics
                  </CardTitle>
                  {isKpisExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {isKpisExpanded ? 'Click to collapse' : 'Click to view all metrics'}
                </p>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {kpis.map((kpi, index) => {
                    const Icon = kpi.icon
                    return (
                      <Card key={index} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <Icon className={`h-5 w-5 ${kpi.color}`} />
                            <div className="flex items-center gap-1 text-sm">
                              {kpi.trendUp ? (
                                <TrendingUp className="h-3 w-3 text-green-500" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-red-500" />
                              )}
                              <span className={kpi.trendUp ? 'text-green-500' : 'text-red-500'}>{kpi.trend}</span>
                            </div>
                          </div>
                          <div className="text-2xl font-bold mb-1">{kpi.value}</div>
                          <div className="text-xs text-muted-foreground">{kpi.title}</div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Your Tools</h2>
            {isModuleEditMode ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsModuleEditMode(false)
                    toast.success('Module order saved')
                  }}
                  className="gap-2"
                  aria-label="Save module order"
                >
                  <Check className="h-4 w-4" />
                  Done
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsModuleEditMode(true)
                  toast.info('Drag modules to reorder them')
                }}
                className="gap-2"
                aria-label="Edit module order"
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
          {orderedModules.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No modules available</h3>
                <p className="text-sm text-muted-foreground">Modules will appear here once data is loaded.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {orderedModules.map((module, displayIndex) => {
              const Icon = module.icon
              // Find the original index in the modules array
              const originalIndex = modules.findIndex(m => m.name === module.name)
              const isExpanded = expandedModules.has(originalIndex)
              const toggleModule = () => {
                const newExpanded = new Set(expandedModules)
                if (isExpanded) {
                  newExpanded.delete(originalIndex)
                } else {
                  newExpanded.add(originalIndex)
                }
                setExpandedModules(newExpanded)
              }
              const isDragging = draggedModuleIndex === displayIndex
              
              return (
                <div
                  key={`${module.name}-${displayIndex}`}
                  className={`relative ${isDragging ? 'opacity-50 scale-95' : ''} ${isModuleEditMode ? 'cursor-move' : ''} transition-all`}
                  draggable={isModuleEditMode}
                  onDragStart={(e) => {
                    if (!isModuleEditMode) return
                    e.dataTransfer.effectAllowed = "move"
                    e.dataTransfer.setData("text/plain", displayIndex.toString())
                    handleModuleDragStart(displayIndex)
                  }}
                  onDragEnter={(e) => {
                    if (!isModuleEditMode) return
                    e.preventDefault()
                    handleModuleDragEnter(displayIndex)
                  }}
                  onDragLeave={(e) => {
                    if (!isModuleEditMode) return
                    // Only clear drag over if we're actually leaving the element
                    const rect = e.currentTarget.getBoundingClientRect()
                    const x = e.clientX
                    const y = e.clientY
                    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                      setDragOverIndex(null)
                    }
                  }}
                  onDragOver={(e) => {
                    if (!isModuleEditMode) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                  }}
                  onDragEnd={handleModuleDragEnd}
                  onKeyDown={(e) => handleModuleKeyDown(e, displayIndex)}
                  tabIndex={isModuleEditMode ? 0 : -1}
                  role={isModuleEditMode ? "button" : undefined}
                  aria-label={isModuleEditMode ? `${module.name}. Press arrow keys to reorder, or drag to move.` : module.name}
                  aria-describedby={isModuleEditMode ? `module-${displayIndex}-desc` : undefined}
                >
                  {isModuleEditMode && (
                    <span id={`module-${displayIndex}-desc`} className="sr-only">
                      Use arrow keys to move up or down, or drag to reorder
                    </span>
                  )}
                  <Collapsible open={isExpanded} onOpenChange={toggleModule}>
                    <Card className={`border-2 ${module.color} hover:shadow-lg transition-all ${isModuleEditMode ? 'ring-2 ring-primary ring-offset-2' : ''} ${isDragging ? 'border-primary' : ''}`}>
                      <div className="flex items-center justify-between p-4 relative">
                        {isModuleEditMode && (
                          <div className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg hover:scale-110 transition-transform touch-none" aria-label="Drag handle">
                            <GripVertical className="h-4 w-4" />
                          </div>
                        )}
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-3 flex-1 cursor-pointer hover:opacity-80 transition-opacity">
                            <div className={`p-2 rounded-lg ${module.color}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <CardTitle className="text-base font-semibold">{module.name}</CardTitle>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <Link to={module.href} onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="ml-2">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                      <CollapsibleContent>
                        <CardContent className="pt-0 pb-4 px-4 space-y-3 border-t mt-2">
                          {module.metrics.map((metric, idx) => (
                            <div key={idx}>
                              <div className="flex items-center justify-between text-sm mb-1">
                                <span className="text-muted-foreground">{metric.label}</span>
                                <span className="font-medium">{metric.value}</span>
                              </div>
                              {'progress' in metric && metric.progress !== undefined ? <Progress value={metric.progress} className="h-1" /> : null}
                            </div>
                          ))}
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                </div>
              )
            })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">Activity Feed</h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {feedActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No recent activity. Actions in HR (e.g. adding employees, completing reviews, goals) and in Projects (task updates, comments) will appear here.</p>
              ) : (
                feedActivities.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-0">
                    <div
                      className={`p-2 rounded-lg ${
                        activity.type === 'success'
                          ? 'bg-green-500/10 text-green-500'
                          : activity.type === 'warning'
                            ? 'bg-yellow-500/10 text-yellow-500'
                            : 'bg-blue-500/10 text-blue-500'
                      }`}
                    >
                      {activity.type === 'success' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : activity.type === 'warning' ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <Activity className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {activity.module}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {activity.time}
                        </span>
                      </div>
                      <p className="text-sm">{activity.message}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}

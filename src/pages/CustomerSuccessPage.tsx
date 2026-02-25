import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users,
  TrendingUp,
  Search,
  Plus,
  Mail,
  Download,
  Brain,
  DollarSign,
  Award,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Circle,
  Edit,
  Trash2,
  Eye,
  Calendar,
  Phone,
  Building,
  BarChart3,
  Target,
  Sparkles,
  Clock,
  Settings,
} from "lucide-react"
import * as api from '@/lib/customer-success-api'
import type { Client, ClientTask, ClientMilestone, ClientInteraction } from '@/lib/customer-success-api'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { WidgetSettingsDialog } from "@/components/projects/widgets/WidgetSettingsDialog"
import { useWidgetLayout } from "@/hooks/useWidgetLayout"
import { useToast } from "@/hooks/use-toast"

export default function CustomerSuccessPage() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [filterStatus, setFilterStatus] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  
  // Client management state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [clientsSearchQuery, setClientsSearchQuery] = useState("")
  const [clientsFilterStatus, setClientsFilterStatus] = useState("all")
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Task management state
  const [selectedTask, setSelectedTask] = useState<ClientTask | null>(null)
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState(false)
  const [isEditTaskDialogOpen, setIsEditTaskDialogOpen] = useState(false)
  const [tasksSearchQuery, setTasksSearchQuery] = useState("")
  const [tasksFilterStatus, setTasksFilterStatus] = useState("all")
  
  // CSM user management state
  const [isAddCSMDialogOpen, setIsAddCSMDialogOpen] = useState(false)
  const [csmUsers, setCsmUsers] = useState<api.CSMUser[]>([])
  const [newCSMUser, setNewCSMUser] = useState({
    name: "",
    email: "",
    avatar: "",
  })
  
  // Add client form state
  const [newClient, setNewClient] = useState({
    name: "",
    industry: "",
    arr: 0,
    renewalDate: "",
    npsScore: 7,
    engagementScore: 50,
    featureUsage: "Medium" as "Low" | "Medium" | "High",
    csmId: "",
  })
  
  // Edit client form state
  const [editClientData, setEditClientData] = useState({
    name: "",
    industry: "",
    arr: "",
    renewalDate: "",
    healthScore: "",
    npsScore: "",
    engagementScore: "",
    featureUsage: "Medium" as "Low" | "Medium" | "High",
    csmId: "",
    portalLogins: "",
    supportTickets: "",
  })
  
  // Add task form state
  const [newTask, setNewTask] = useState({
    clientId: "",
    title: "",
    status: "active" as "active" | "completed" | "overdue",
    dueDate: "",
    priority: "medium" as "low" | "medium" | "high",
    assignedTo: "",
  })
  
  // Edit task form state
  const [editTaskData, setEditTaskData] = useState({
    clientId: "",
    title: "",
    status: "active" as "active" | "completed" | "overdue",
    dueDate: "",
    priority: "medium" as "low" | "medium" | "high",
    assignedTo: "",
  })

  // Milestone management state
  const [selectedMilestone, setSelectedMilestone] = useState<ClientMilestone | null>(null)
  const [isAddMilestoneDialogOpen, setIsAddMilestoneDialogOpen] = useState(false)
  const [isEditMilestoneDialogOpen, setIsEditMilestoneDialogOpen] = useState(false)
  const [milestonesSearchQuery, setMilestonesSearchQuery] = useState("")
  const [milestonesFilterStatus, setMilestonesFilterStatus] = useState<"all" | "completed" | "in-progress" | "upcoming">("all")

  // Add milestone form state
  const [newMilestone, setNewMilestone] = useState({
    clientId: "",
    title: "",
    description: "",
    status: "upcoming" as "completed" | "in-progress" | "upcoming",
    targetDate: "",
    completedDate: "",
  })

  // Edit milestone form state
  const [editMilestoneData, setEditMilestoneData] = useState({
    title: "",
    description: "",
    status: "upcoming" as "completed" | "in-progress" | "upcoming",
    targetDate: "",
    completedDate: "",
  })

  // Interaction management state
  const [selectedInteraction, setSelectedInteraction] = useState<ClientInteraction | null>(null)
  const [isAddInteractionDialogOpen, setIsAddInteractionDialogOpen] = useState(false)
  const [isEditInteractionDialogOpen, setIsEditInteractionDialogOpen] = useState(false)
  const [interactionsSearchQuery, setInteractionsSearchQuery] = useState("")
  const [interactionsFilterType, setInteractionsFilterType] = useState<"all" | "email" | "call" | "meeting">("all")

  // Add interaction form state
  const [newInteraction, setNewInteraction] = useState({
    clientId: "",
    type: "email" as "email" | "call" | "meeting",
    subject: "",
    description: "",
    csmId: "",
    interactionDate: new Date().toISOString().split('T')[0],
  })

  // Edit interaction form state
  const [editInteractionData, setEditInteractionData] = useState({
    type: "email" as "email" | "call" | "meeting",
    subject: "",
    description: "",
    csmId: "",
    interactionDate: "",
  })
  
  // Analytics widget settings state
  const [analyticsSettingsDialogOpen, setAnalyticsSettingsDialogOpen] = useState(false)
  const { toast } = useToast()

  // Analytics widget layout management
  const {
    layout: analyticsLayout,
    visibleWidgets: visibleAnalyticsWidgets,
    toggleWidget: toggleAnalyticsWidget,
    resetLayout: resetAnalyticsLayout,
  } = useWidgetLayout({
    defaultLayout: [
      { id: 'key-metrics-overview', type: 'KeyMetricsOverview', visible: true },
      { id: 'client-health-distribution', type: 'ClientHealthDistribution', visible: true },
      { id: 'revenue-analytics', type: 'RevenueAnalytics', visible: false },
      { id: 'interaction-activity', type: 'InteractionActivity', visible: true },
      { id: 'task-performance', type: 'TaskPerformance', visible: true },
      { id: 'health-score-trends', type: 'HealthScoreTrends', visible: true },
      { id: 'arr-growth-trend', type: 'ARRGrowthTrend', visible: false },
      { id: 'top-clients-arr', type: 'TopClientsARR', visible: false },
      { id: 'csm-performance', type: 'CSMPerformance', visible: true },
      { id: 'upcoming-milestones', type: 'UpcomingMilestones', visible: true },
    ],
    storageKey: 'customer-success-analytics-layout',
  })

  // Data state
  const [clients, setClients] = useState<Client[]>([])
  const [tasks, setTasks] = useState<ClientTask[]>([])
  const [milestones, setMilestones] = useState<ClientMilestone[]>([])
  const [interactions, setInteractions] = useState<ClientInteraction[]>([])
  const [stats, setStats] = useState({
    totalClients: 0,
    atRiskCount: 0,
    avgHealthScore: 0,
    totalARR: 0,
    avgNPS: 0,
    highChurnRiskCount: 0,
    completedTasks: 0,
    totalTasks: 0,
    overdueTasks: 0,
  })
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true)

  // Load all data
  useEffect(() => {
    console.log('🔄 CustomerSuccessPage: Starting data load...')
    loadData()
    
    // Emergency timeout to prevent hanging
    const emergencyTimeout = setTimeout(() => {
      console.error('🚨 CustomerSuccessPage: EMERGENCY TIMEOUT - forcing loading to false')
      setIsLoading(false)
    }, 3000)
    
    return () => clearTimeout(emergencyTimeout)
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      console.log('⏱️ CustomerSuccessPage: Fetching data...')
      
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Data fetch timeout')), 2000)
      )
      
      // Fetch all data in parallel with timeout
      const dataPromise = Promise.all([
        api.getAllClients(),
        api.getAllTasks(),
        api.getAllMilestones(),
        api.getAllInteractions(),
        api.getClientStats(),
        api.getAllCSMUsers(),
      ])
      
      const [
        clientsData,
        tasksData,
        milestonesData,
        interactionsData,
        statsData,
        csmUsersData,
      ] = await Promise.race([dataPromise, timeoutPromise]) as any

      console.log('✅ CustomerSuccessPage: Data loaded successfully')
      setClients(clientsData)
      setTasks(tasksData)
      setMilestones(milestonesData)
      setInteractions(interactionsData)
      setStats(statsData)
      setCsmUsers(csmUsersData)
    } catch (error) {
      console.error('❌ CustomerSuccessPage: Error loading data:', error)
      // Set empty arrays so page can render
      setClients([])
      setTasks([])
      setMilestones([])
      setInteractions([])
      setCsmUsers([])
    } finally {
      console.log('✅ CustomerSuccessPage: Loading complete')
      setIsLoading(false)
    }
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-green-500"
    if (score >= 50) return "text-yellow-500"
    return "text-red-500"
  }

  const getHealthBadge = (status: string) => {
    if (status === "healthy")
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Healthy</Badge>
    if (status === "moderate")
      return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Moderate</Badge>
    return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">At Risk</Badge>
  }

  const getChurnRiskBadge = (risk: number) => {
    if (risk < 25)
      return (
        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
          <TrendingDown className="w-3 h-3 mr-1" />
          Low Risk
        </Badge>
      )
    if (risk < 60)
      return (
        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
          <Activity className="w-3 h-3 mr-1" />
          Medium Risk
        </Badge>
      )
    return (
      <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
        <TrendingUp className="w-3 h-3 mr-1" />
        High Risk
      </Badge>
    )
  }

  const getTimeSince = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return "today"
    if (diffDays === 1) return "1 day"
    return `${diffDays} days`
  }

  const getClientTaskCounts = (clientId: string) => {
    const clientTasks = tasks.filter(t => t.client_id === clientId)
    const completed = clientTasks.filter(t => t.status === 'completed').length
    return { completed, total: clientTasks.length }
  }

  const getClientMilestoneCounts = (clientId: string) => {
    const clientMilestones = milestones.filter(m => m.client_id === clientId)
    const completed = clientMilestones.filter(m => m.status === 'completed').length
    return { completed, total: clientMilestones.length }
  }

  const getHealthTrend = (clientId: string) => {
    // For now, return a simple trend based on current health score
    // In a real app, you'd fetch health history from the database
    const client = clients.find(c => c.id === clientId)
    if (!client) return [70, 70, 70, 70, 70]
    
    // Generate a simple trend around the current score
    const current = client.health_score
    const variation = 5
    return [
      Math.max(0, Math.min(100, current - variation * 2)),
      Math.max(0, Math.min(100, current - variation)),
      Math.max(0, Math.min(100, current)),
      Math.max(0, Math.min(100, current + variation)),
      Math.max(0, Math.min(100, current)),
    ]
  }

  // Filtered clients for dashboard tab
  const dashboardFilteredClients = clients.filter((client) => {
    const statusMatch = filterStatus === "all" || client.status === filterStatus
    const searchMatch = searchQuery === "" || 
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.csm?.name.toLowerCase().includes(searchQuery.toLowerCase())
    return statusMatch && searchMatch
  })

  const handleExportClients = () => {
    try {
      const headers = ['Customer ID', 'Name', 'Industry', 'Engagement Score', 'Status', 'Assigned to', 'Next Follow-up', 'Last Contact']
      const csvData = [
        headers.join(','),
        ...clients.map(client => [
          client.id,
          `"${client.name}"`,
          `"${client.industry}"`,
          client.health_score,
          client.status,
          `"${client.csm?.name || 'Unassigned'}"`,
          client.renewal_date,
          `"${getTimeSince(client.last_contact_date)} ago"`
        ].join(','))
      ].join('\n')

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `clients_export_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error exporting clients:', error)
      alert('Failed to export client data. Please try again.')
    }
  }

  const handleViewClient = (client: Client) => {
    setSelectedClient(client)
    setIsViewDialogOpen(true)
  }

  const handleEditClient = (client: Client) => {
    setSelectedClient(client)
    // Pre-populate the edit form with current client data
    setEditClientData({
      name: client.name,
      industry: client.industry,
      arr: client.arr.toString(),
      renewalDate: client.renewal_date,
      healthScore: client.health_score.toString(),
      npsScore: client.nps_score.toString(),
      engagementScore: client.engagement_score.toString(),
      featureUsage: client.feature_usage as "Medium" | "Low" | "High",
      csmId: client.csm_id || "",
      portalLogins: client.portal_logins.toString(),
      supportTickets: client.support_tickets.toString(),
    })
    setIsEditDialogOpen(true)
  }

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
      return
    }
    
    try {
      await api.deleteClient(clientId)
      // Reload all data to refresh stats
      await loadData()
      // Close any open dialogs
      setIsViewDialogOpen(false)
      setIsEditDialogOpen(false)
      setSelectedClient(null)
      alert('Customer deleted successfully')
    } catch (error) {
      console.error('Error deleting client:', error)
      alert('Failed to delete client. Please try again.')
    }
  }

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const name = newClient.name?.trim()
    if (!name) {
      alert('Please enter the customer name.')
      return
    }

    const nextYear = new Date()
    nextYear.setFullYear(nextYear.getFullYear() + 1)
    const defaultRenewal = nextYear.toISOString().slice(0, 10)
    
    setIsSubmitting(true)
    
    try {
      await api.createClient({
        name,
        industry: newClient.industry?.trim() ?? '',
        arr: newClient.arr ?? 0,
        renewal_date: (newClient.renewalDate?.trim() || defaultRenewal),
        last_contact_date: new Date().toISOString(),
        nps_score: newClient.npsScore,
        engagement_score: newClient.engagementScore,
        feature_usage: newClient.featureUsage,
        csm_id: newClient.csmId || null,
        portal_logins: 0,
        support_tickets: 0,
        health_score: 0,
        status: 'healthy',
        churn_risk: 0,
        churn_trend: 'stable',
      })
      
      // Reset form
      setNewClient({
        name: "",
        industry: "",
        arr: 0,
        renewalDate: "",
        npsScore: 7,
        engagementScore: 50,
        featureUsage: "Medium",
        csmId: "",
      })
      
      // Close dialog and reload data
      setIsAddDialogOpen(false)
      await loadData()
      alert('Customer added successfully!')
    } catch (error) {
      console.error('Error adding client:', error)
      alert('Failed to add customer. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddCSMUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!newCSMUser.name || !newCSMUser.email) {
      alert('Please fill in all required fields (Name and Email)')
      return
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newCSMUser.email)) {
      alert('Please enter a valid email address')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      await api.createCSMUser({
        name: newCSMUser.name,
        email: newCSMUser.email,
        avatar: newCSMUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newCSMUser.name)}`,
      })
      
      // Reset form
      setNewCSMUser({
        name: "",
        email: "",
        avatar: "",
      })
      
      // Close dialog and reload data
      setIsAddCSMDialogOpen(false)
      await loadData()
      alert('Team member added successfully!')
    } catch (error) {
      console.error('Error adding CSM user:', error)
      alert('Failed to add CSM user. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveClientChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedClient) return
    
    const name = editClientData.name?.trim()
    if (!name) {
      alert('Please enter the customer name.')
      return
    }

    const nextYear = new Date()
    nextYear.setFullYear(nextYear.getFullYear() + 1)
    const defaultRenewal = nextYear.toISOString().slice(0, 10)
    
    setIsSubmitting(true)
    
    try {
      await api.updateClient(selectedClient.id, {
        name,
        industry: editClientData.industry?.trim() ?? '',
        arr: parseInt(editClientData.arr, 10) || 0,
        renewal_date: editClientData.renewalDate?.trim() || defaultRenewal,
        nps_score: parseInt(editClientData.npsScore) || 0,
        engagement_score: parseInt(editClientData.engagementScore) || 0,
        feature_usage: editClientData.featureUsage,
        csm_id: editClientData.csmId || null,
        portal_logins: parseInt(editClientData.portalLogins) || 0,
        support_tickets: parseInt(editClientData.supportTickets) || 0,
      })
      
      // Close dialog and reload data
      setIsEditDialogOpen(false)
      setSelectedClient(null)
      await loadData()
      alert('Customer updated successfully!')
    } catch (error) {
      console.error('Error updating client:', error)
      alert('Failed to update customer. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newTask.clientId || !newTask.title || !newTask.dueDate) {
      alert('Please fill in all required fields')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      await api.createTask({
        client_id: newTask.clientId,
        title: newTask.title,
        status: newTask.status,
        due_date: newTask.dueDate,
        priority: newTask.priority,
        assigned_to: newTask.assignedTo || null,
      })
      
      setNewTask({
        clientId: "",
        title: "",
        status: "active",
        dueDate: "",
        priority: "medium",
        assignedTo: "",
      })
      
      setIsAddTaskDialogOpen(false)
      await loadData()
      alert('Task created successfully!')
    } catch (error) {
      console.error('Error creating task:', error)
      alert('Failed to create task. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditTask = (task: ClientTask) => {
    setSelectedTask(task)
    setEditTaskData({
      clientId: task.client_id,
      title: task.title,
      status: task.status,
      dueDate: task.due_date,
      priority: task.priority,
      assignedTo: task.assigned_to || "",
    })
    setIsEditTaskDialogOpen(true)
  }

  const handleSaveTaskChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedTask) return
    
    if (!editTaskData.title || !editTaskData.dueDate) {
      alert('Please fill in all required fields')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      await api.updateTask(selectedTask.id, {
        title: editTaskData.title,
        status: editTaskData.status,
        due_date: editTaskData.dueDate,
        priority: editTaskData.priority,
        assigned_to: editTaskData.assignedTo || null,
      })
      
      setIsEditTaskDialogOpen(false)
      setSelectedTask(null)
      await loadData()
      alert('Task updated successfully!')
    } catch (error) {
      console.error('Error updating task:', error)
      alert('Failed to update task. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return
    }
    
    try {
      await api.deleteTask(taskId)
      await loadData()
      alert('Task deleted successfully')
    } catch (error) {
      console.error('Error deleting task:', error)
      alert('Failed to delete task. Please try again.')
    }
  }

  // ==================== MILESTONE HANDLERS ====================

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMilestone.clientId || !newMilestone.title || !newMilestone.targetDate) {
      alert('Please fill in all required fields (Client, Title, Target Date)')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const milestoneData = {
        client_id: newMilestone.clientId,
        title: newMilestone.title,
        description: newMilestone.description || undefined,
        status: newMilestone.status,
        target_date: newMilestone.targetDate,
        completed_date: newMilestone.completedDate || undefined,
      }
      
      await api.createMilestone(milestoneData)
      
      setIsAddMilestoneDialogOpen(false)
      setNewMilestone({
        clientId: "",
        title: "",
        description: "",
        status: "upcoming",
        targetDate: "",
        completedDate: "",
      })
      await loadData()
      alert('Milestone created successfully!')
    } catch (error) {
      console.error('Error creating milestone:', error)
      alert('Failed to create milestone. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditMilestone = (milestone: ClientMilestone) => {
    setSelectedMilestone(milestone)
    setEditMilestoneData({
      title: milestone.title,
      description: milestone.description || "",
      status: milestone.status,
      targetDate: milestone.target_date,
      completedDate: milestone.completed_date || "",
    })
    setIsEditMilestoneDialogOpen(true)
  }

  const handleSaveMilestoneChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedMilestone) return
    
    if (!editMilestoneData.title || !editMilestoneData.targetDate) {
      alert('Please fill in all required fields (Title, Target Date)')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      await api.updateMilestone(selectedMilestone.id, {
        title: editMilestoneData.title,
        description: editMilestoneData.description || undefined,
        status: editMilestoneData.status,
        target_date: editMilestoneData.targetDate,
        completed_date: editMilestoneData.completedDate || undefined,
      })
      
      setIsEditMilestoneDialogOpen(false)
      setSelectedMilestone(null)
      await loadData()
      alert('Milestone updated successfully!')
    } catch (error) {
      console.error('Error updating milestone:', error)
      alert('Failed to update milestone. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteMilestone = async (milestoneId: string) => {
    if (!confirm('Are you sure you want to delete this milestone?')) {
      return
    }
    
    try {
      await api.deleteMilestone(milestoneId)
      await loadData()
      alert('Milestone deleted successfully')
    } catch (error) {
      console.error('Error deleting milestone:', error)
      alert('Failed to delete milestone. Please try again.')
    }
  }

  // ==================== INTERACTION HANDLERS ====================

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newInteraction.clientId || !newInteraction.subject || !newInteraction.interactionDate) {
      alert('Please fill in all required fields (Client, Subject, Date)')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const interactionData = {
        client_id: newInteraction.clientId,
        type: newInteraction.type,
        subject: newInteraction.subject,
        description: newInteraction.description,
        csm_id: newInteraction.csmId || null,
        interaction_date: newInteraction.interactionDate,
      }
      
      await api.createInteraction(interactionData)
      
      setIsAddInteractionDialogOpen(false)
      setNewInteraction({
        clientId: "",
        type: "email",
        subject: "",
        description: "",
        csmId: "",
        interactionDate: new Date().toISOString().split('T')[0],
      })
      await loadData()
      alert('Interaction logged successfully!')
    } catch (error) {
      console.error('Error creating interaction:', error)
      alert('Failed to log interaction. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditInteraction = (interaction: ClientInteraction) => {
    setSelectedInteraction(interaction)
    setEditInteractionData({
      type: interaction.type,
      subject: interaction.subject,
      description: interaction.description,
      csmId: interaction.csm_id || "",
      interactionDate: interaction.interaction_date,
    })
    setIsEditInteractionDialogOpen(true)
  }

  const handleSaveInteractionChanges = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedInteraction) return
    
    if (!editInteractionData.subject || !editInteractionData.interactionDate) {
      alert('Please fill in all required fields (Subject, Date)')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      await api.updateInteraction(selectedInteraction.id, {
        type: editInteractionData.type,
        subject: editInteractionData.subject,
        description: editInteractionData.description,
        csm_id: editInteractionData.csmId || null,
        interaction_date: editInteractionData.interactionDate,
      })
      
      setIsEditInteractionDialogOpen(false)
      setSelectedInteraction(null)
      await loadData()
      alert('Interaction updated successfully!')
    } catch (error) {
      console.error('Error updating interaction:', error)
      alert('Failed to update interaction. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteInteraction = async (interactionId: string) => {
    if (!confirm('Are you sure you want to delete this interaction?')) {
      return
    }
    
    try {
      await api.deleteInteraction(interactionId)
      await loadData()
      alert('Interaction deleted successfully')
    } catch (error) {
      console.error('Error deleting interaction:', error)
      alert('Failed to delete interaction. Please try again.')
    }
  }

  // Filtered clients for the Clients tab
  const filteredClientsTab = clients.filter((client) => {
    const statusMatch = clientsFilterStatus === "all" || client.status === clientsFilterStatus
    const searchMatch = clientsSearchQuery === "" || 
      client.name.toLowerCase().includes(clientsSearchQuery.toLowerCase()) ||
      client.industry.toLowerCase().includes(clientsSearchQuery.toLowerCase()) ||
      client.csm?.name.toLowerCase().includes(clientsSearchQuery.toLowerCase())
    return statusMatch && searchMatch
  })

  // Filtered tasks for the Tasks tab
  const filteredTasksTab = tasks.filter((task) => {
    const statusMatch = tasksFilterStatus === "all" || task.status === tasksFilterStatus
    const searchMatch = tasksSearchQuery === "" || 
      task.title.toLowerCase().includes(tasksSearchQuery.toLowerCase()) ||
      task.client?.name.toLowerCase().includes(tasksSearchQuery.toLowerCase()) ||
      task.csm?.name.toLowerCase().includes(tasksSearchQuery.toLowerCase())
    return statusMatch && searchMatch
  })

  // Filtered milestones for the Milestones tab
  const filteredMilestonesTab = milestones.filter((milestone) => {
    const statusMatch = milestonesFilterStatus === "all" || milestone.status === milestonesFilterStatus
    const searchMatch = milestonesSearchQuery === "" || 
      milestone.title.toLowerCase().includes(milestonesSearchQuery.toLowerCase()) ||
      milestone.client?.name.toLowerCase().includes(milestonesSearchQuery.toLowerCase())
    return statusMatch && searchMatch
  })

  // Filtered interactions for the Interactions tab
  const filteredInteractionsTab = interactions.filter((interaction) => {
    const typeMatch = interactionsFilterType === "all" || interaction.type === interactionsFilterType
    const searchMatch = interactionsSearchQuery === "" || 
      interaction.subject.toLowerCase().includes(interactionsSearchQuery.toLowerCase()) ||
      interaction.client?.name.toLowerCase().includes(interactionsSearchQuery.toLowerCase()) ||
      interaction.csm?.name.toLowerCase().includes(interactionsSearchQuery.toLowerCase())
    return typeMatch && searchMatch
  })

  const getTaskStatusBadge = (status: string) => {
    if (status === "completed")
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Completed</Badge>
    if (status === "overdue")
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Overdue</Badge>
    return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Active</Badge>
  }

  const getMilestoneStatusBadge = (status: string) => {
    if (status === "completed")
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Completed</Badge>
    if (status === "in-progress")
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">In Progress</Badge>
    return <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">Upcoming</Badge>
  }

  const getInteractionTypeBadge = (type: string) => {
    if (type === "email")
      return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Mail className="w-3 h-3 mr-1" />Email</Badge>
    if (type === "call")
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><Phone className="w-3 h-3 mr-1" />Call</Badge>
    return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20"><Users className="w-3 h-3 mr-1" />Visit</Badge>
  }

  const getPriorityBadge = (priority: string) => {
    if (priority === "high")
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">High</Badge>
    if (priority === "low")
      return <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">Low</Badge>
    return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Medium</Badge>
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Katana Customers data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 px-6 mb-6">
        <div className="py-6">
          <div className="flex items-center justify-between">
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <span className="hover:text-foreground cursor-pointer transition-colors">Home</span>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground">Katana Customers</span>
              </div>
              
              {/* Title with Icon */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">Katana Customers</h1>
              </div>
              
              <p className="text-muted-foreground mt-2">Know your customer — tracking and engagement</p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isAddCSMDialogOpen} onOpenChange={setIsAddCSMDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Add team member
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add team member</DialogTitle>
                    <DialogDescription>
                      Add a team member who can be assigned to customers
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddCSMUser} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="csmName">Full Name *</Label>
                      <Input 
                        id="csmName"
                        placeholder="Sarah Johnson"
                        value={newCSMUser.name}
                        onChange={(e) => setNewCSMUser({...newCSMUser, name: e.target.value})}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="csmEmail">Email Address *</Label>
                      <Input 
                        id="csmEmail"
                        type="email"
                        placeholder="sarah.johnson@company.com"
                        value={newCSMUser.email}
                        onChange={(e) => setNewCSMUser({...newCSMUser, email: e.target.value})}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="csmAvatar">Avatar URL (Optional)</Label>
                      <Input 
                        id="csmAvatar"
                        type="url"
                        placeholder="https://example.com/avatar.jpg"
                        value={newCSMUser.avatar}
                        onChange={(e) => setNewCSMUser({...newCSMUser, avatar: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave blank to auto-generate an avatar based on the name
                      </p>
                    </div>

                    <DialogFooter>
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={() => {
                          setIsAddCSMDialogOpen(false)
                          setNewCSMUser({ name: "", email: "", avatar: "" })
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <span className="animate-spin mr-2">⏳</span>
                            Adding...
                          </>
                        ) : (
                          'Add team member'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              
              <Button variant="outline" onClick={handleExportClients}>
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats – one rectangular bar */}
      <Card className="overflow-hidden border-border bg-card/50 mb-6">
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
          <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Total Customers</p>
              <p className="text-2xl font-bold tabular-nums">{stats.totalClients}</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Brain className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Needs attention</p>
              <p className="text-2xl font-bold tabular-nums text-amber-600">{stats.atRiskCount}</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Avg engagement</p>
              <p className="text-2xl font-bold tabular-nums">{stats.avgHealthScore}%</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Overdue tasks</p>
              <p className="text-2xl font-bold tabular-nums">{stats.overdueTasks}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="clients">Customers</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="interactions">Interactions</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Client List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Customers</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        variant={filterStatus === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilterStatus("all")}
                      >
                        All
                      </Button>
                      <Button
                        variant={filterStatus === "at-risk" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilterStatus("at-risk")}
                      >
                        Needs attention
                      </Button>
                      <Button
                        variant={filterStatus === "moderate" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilterStatus("moderate")}
                      >
                        Moderate
                      </Button>
                      <Button
                        variant={filterStatus === "healthy" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilterStatus("healthy")}
                      >
                        Healthy
                      </Button>
                    </div>
                  </div>
                  <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search by name or industry..." 
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboardFilteredClients.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No clients found matching your search.</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => {
                            setSearchQuery("")
                            setFilterStatus("all")
                          }}
                        >
                          Clear Filters
                        </Button>
                      </div>
                    ) : (
                      dashboardFilteredClients.map((client) => {
                        const taskCounts = getClientTaskCounts(client.id)
                        const milestoneCounts = getClientMilestoneCounts(client.id)
                        const healthTrend = getHealthTrend(client.id)
                        
                        return (
                        <div
                          key={client.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold">{client.name}</h3>
                              {getHealthBadge(client.status)}
                              {getChurnRiskBadge(client.churn_risk)}
                            </div>
                            <p className="text-sm text-muted-foreground">{client.industry}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>Last contact: {getTimeSince(client.last_contact_date)} ago</span>
                              <span>Tasks: {taskCounts.completed}/{taskCounts.total}</span>
                              <span>Milestones: {milestoneCounts.completed}/{milestoneCounts.total}</span>
                              <span>Value: ${(client.arr / 1000).toFixed(0)}K</span>
                              <span>Renewal / next: {new Date(client.renewal_date).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-muted-foreground">Health Trend:</span>
                              <div className="flex items-end gap-0.5 h-6">
                                {healthTrend.map((score, idx) => (
                                  <div
                                    key={idx}
                                    className={`w-2 rounded-t ${
                                      score >= 80 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500"
                                    }`}
                                    style={{ height: `${(score / 100) * 100}%` }}
                                  />
                                ))}
                              </div>
                              {client.churn_trend === "up" && <ArrowUpRight className="w-4 h-4 text-red-500" />}
                              {client.churn_trend === "down" && <ArrowDownRight className="w-4 h-4 text-green-500" />}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Engagement</p>
                              <p className={`text-2xl font-bold ${getHealthColor(client.health_score)}`}>
                                {client.health_score}%
                              </p>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleViewClient(client)}
                            >
                              View
                            </Button>
                          </div>
                        </div>
                        )
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Stats & Activity */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Task Progress</span>
                      <span className="text-sm font-semibold">
                        {stats.totalTasks > 0 
                          ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
                          : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ 
                          width: `${stats.totalTasks > 0 
                            ? (stats.completedTasks / stats.totalTasks) * 100 
                            : 0}%` 
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.completedTasks}/{stats.totalTasks} completed
                    </p>
                  </div>

                  <div className="pt-4 border-t space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm">{stats.overdueTasks} tasks overdue</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm">{stats.atRiskCount} customers needing follow-up</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {interactions.slice(0, 4).map((interaction) => (
                      <div key={interaction.id} className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm">{interaction.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {getTimeSince(interaction.interaction_date)} ago
                          </p>
                        </div>
                      </div>
                    ))}
                    {interactions.length === 0 && (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground">No recent activity</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="clients">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Customer directory</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Manage all your customer accounts and relationships
                  </p>
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Customer
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add Customer</DialogTitle>
                      <DialogDescription>
                        Add a customer to track visits, engagement, calls, and interactions.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddClient} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input 
                          id="name"
                          placeholder="Customer or business name"
                          value={newClient.name}
                          onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                          required
                        />
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Optional: add industry, value, or next visit date. You can log calls, emails, and visits in their profile after adding.
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="industry">Industry (optional)</Label>
                          <Input 
                            id="industry"
                            placeholder="e.g. Retail, Auto, Services"
                            value={newClient.industry}
                            onChange={(e) => setNewClient({...newClient, industry: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="arr">Annual value / ARR (optional)</Label>
                          <Input 
                            id="arr"
                            type="number"
                            min="0"
                            step="1000"
                            placeholder="0"
                            value={newClient.arr === 0 ? '' : newClient.arr}
                            onChange={(e) => setNewClient({...newClient, arr: parseInt(e.target.value, 10) || 0})}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="renewalDate">Next follow-up (optional)</Label>
                          <Input 
                            id="renewalDate"
                            type="date"
                            value={newClient.renewalDate}
                            onChange={(e) => setNewClient({...newClient, renewalDate: e.target.value})}
                          />
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Engagement is calculated from contact recency, support tickets, and activity.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="engagementScore">Engagement score (0-100)</Label>
                          <Input 
                            id="engagementScore"
                            type="number"
                            min="0"
                            max="100"
                            placeholder="50"
                            value={newClient.engagementScore}
                            onChange={(e) => setNewClient({...newClient, engagementScore: parseInt(e.target.value) || 0})}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="featureUsage">Feature Usage</Label>
                          <select 
                            id="featureUsage"
                            className="w-full px-3 py-2 border rounded-md bg-background"
                            value={newClient.featureUsage}
                            onChange={(e) => setNewClient({...newClient, featureUsage: e.target.value as "Low" | "Medium" | "High"})}
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="csmId">Assigned to (optional)</Label>
                        <select 
                          id="csmId"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={newClient.csmId}
                          onChange={(e) => setNewClient({...newClient, csmId: e.target.value})}
                        >
                          <option value="">Unassigned</option>
                          {csmUsers.map((csm) => (
                            <option key={csm.id} value={csm.id}>
                              {csm.name} ({csm.email})
                            </option>
                          ))}
                        </select>
                        {csmUsers.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            No team members yet. Add one using the "Add team member" button in the header.
                          </p>
                        )}
                      </div>

                      <DialogFooter>
                        <Button 
                          type="button"
                          variant="outline" 
                          onClick={() => {
                            setIsAddDialogOpen(false)
                            // Reset form
                            setNewClient({
                              name: "",
                              industry: "",
                              arr: 0,
                              renewalDate: "",
                              npsScore: 7,
                              engagementScore: 50,
                              featureUsage: "Medium",
                              csmId: "",
                            })
                          }}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <span className="animate-spin mr-2">⏳</span>
                              Adding...
                            </>
                          ) : (
                            'Add Client'
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Search and Filters */}
              <div className="flex items-center gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by name or industry..." 
                    className="pl-10"
                    value={clientsSearchQuery}
                    onChange={(e) => setClientsSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={clientsFilterStatus === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setClientsFilterStatus("all")}
                  >
                    All ({clients.length})
                  </Button>
                  <Button
                    variant={clientsFilterStatus === "healthy" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setClientsFilterStatus("healthy")}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Healthy
                  </Button>
                  <Button
                    variant={clientsFilterStatus === "moderate" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setClientsFilterStatus("moderate")}
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Moderate
                  </Button>
                  <Button
                    variant={clientsFilterStatus === "at-risk" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setClientsFilterStatus("at-risk")}
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    At Risk
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredClientsTab.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No clients found</h3>
                  <p className="text-muted-foreground mb-4">
                    {clientsSearchQuery || clientsFilterStatus !== "all" 
                      ? "Try adjusting your search or filters"
                      : "Get started by adding your first client"}
                  </p>
                  {clientsSearchQuery || clientsFilterStatus !== "all" ? (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setClientsSearchQuery("")
                        setClientsFilterStatus("all")
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add your first customer
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Engagement</TableHead>
                        <TableHead>Assigned to</TableHead>
                        <TableHead>Next follow-up</TableHead>
                        <TableHead>Last Contact</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClientsTab.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{client.name}</div>
                              <div className="text-sm text-muted-foreground">{client.industry}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getHealthBadge(client.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-full bg-muted rounded-full h-2 max-w-[60px]">
                                <div 
                                  className={`h-2 rounded-full ${
                                    client.health_score >= 80 ? "bg-green-500" : 
                                    client.health_score >= 50 ? "bg-yellow-500" : 
                                    "bg-red-500"
                                  }`}
                                  style={{ width: `${client.health_score}%` }}
                                ></div>
                              </div>
                              <span className={`text-sm font-semibold ${getHealthColor(client.health_score)}`}>
                                {client.health_score}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {client.csm ? (
                                <>
                                  {client.csm.avatar && (
                                    <img 
                                      src={client.csm.avatar} 
                                      alt={client.csm.name}
                                      className="w-6 h-6 rounded-full"
                                    />
                                  )}
                                  <span className="text-sm">{client.csm.name}</span>
                                </>
                              ) : (
                                <span className="text-sm text-muted-foreground">Unassigned</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="w-3 h-3" />
                              {new Date(client.renewal_date).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {getTimeSince(client.last_contact_date)} ago
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleViewClient(client)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditClient(client)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteClient(client.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* View Client Dialog */}
          <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              {selectedClient && (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-2xl">{selectedClient.name}</DialogTitle>
                    <DialogDescription className="text-sm">
                      {selectedClient.industry} • ID: {selectedClient.id.substring(0, 8)}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-6 py-4">
                    {/* Status Overview */}
                    <div className="grid grid-cols-4 gap-3">
                      <Card className="bg-card">
                        <CardContent className="pt-4 pb-4 px-3">
                          <div className="text-center space-y-2">
                            <p className="text-xs text-muted-foreground">Health Score</p>
                            <p className={`text-2xl font-bold ${getHealthColor(selectedClient.health_score)}`}>
                              {selectedClient.health_score}%
                            </p>
                            <div className="flex justify-center">
                              {getHealthBadge(selectedClient.status)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-card">
                        <CardContent className="pt-4 pb-4 px-3">
                          <div className="text-center space-y-2">
                            <p className="text-xs text-muted-foreground">Churn Risk</p>
                            <p className="text-2xl font-bold">{selectedClient.churn_risk}%</p>
                            <div className="flex justify-center">
                              {getChurnRiskBadge(selectedClient.churn_risk)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                    </div>

                    {/* Detailed Information */}
                    <div className="grid grid-cols-2 gap-6">
                      <Card className="bg-card">
                        <CardContent className="pt-6 pb-6 space-y-6">
                          <div>
                            <h4 className="font-semibold mb-4 flex items-center gap-2 text-base">
                              <Building className="w-4 h-4" />
                              Company Information
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground whitespace-nowrap">Industry:</span>
                                <span className="font-medium text-right">{selectedClient.industry}</span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground whitespace-nowrap">Next follow-up:</span>
                                <span className="font-medium text-right">
                                  {new Date(selectedClient.renewal_date).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-muted-foreground whitespace-nowrap">Last Contact:</span>
                                <span className="font-medium text-right">
                                  {getTimeSince(selectedClient.last_contact_date)} ago
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="border-t pt-4">
                            <h4 className="font-semibold mb-4 flex items-center gap-2 text-base">
                              <Users className="w-4 h-4" />
                              Account Management
                            </h4>
                            <div className="space-y-3 text-sm">
                              <div className="flex justify-between items-center gap-4">
                                <span className="text-muted-foreground whitespace-nowrap">CSM:</span>
                                {selectedClient.csm ? (
                                  <div className="flex items-center gap-2">
                                    {selectedClient.csm.avatar && (
                                      <img 
                                        src={selectedClient.csm.avatar} 
                                        alt={selectedClient.csm.name}
                                        className="w-5 h-5 rounded-full"
                                      />
                                    )}
                                    <span className="font-medium">{selectedClient.csm.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Unassigned</span>
                                )}
                              </div>
                              {selectedClient.csm?.email && (
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground whitespace-nowrap">Email:</span>
                                  <span className="font-medium text-right break-all">{selectedClient.csm.email}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-card">
                        <CardContent className="pt-6 pb-6">
                          <div>
                            <h4 className="font-semibold mb-4 flex items-center gap-2 text-base">
                              <BarChart3 className="w-4 h-4" />
                              Engagement Metrics
                            </h4>
                            <div className="space-y-4">
                              <div>
                                <div className="flex justify-between text-sm mb-2">
                                  <span className="text-muted-foreground">Engagement Score</span>
                                  <span className="font-semibold">{selectedClient.engagement_score}%</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2.5">
                                  <div 
                                    className="bg-blue-500 h-2.5 rounded-full transition-all" 
                                    style={{ width: `${selectedClient.engagement_score}%` }}
                                  ></div>
                                </div>
                              </div>
                              <div className="flex justify-between text-sm pt-2">
                                <span className="text-muted-foreground">Portal Logins:</span>
                                <span className="font-medium">{selectedClient.portal_logins}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Feature Usage:</span>
                                <Badge variant="outline" className="text-xs">{selectedClient.feature_usage}</Badge>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Support Tickets:</span>
                                <span className="font-medium">{selectedClient.support_tickets}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Quick Stats */}
                    <div>
                      <h4 className="font-semibold mb-4 flex items-center gap-2 text-base">
                        <Target className="w-4 h-4" />
                        Activity Overview
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <Card className="bg-card">
                          <CardContent className="pt-4 pb-4 text-center">
                            <p className="text-xs text-muted-foreground mb-1">Tasks</p>
                            <p className="text-2xl font-bold">
                              {getClientTaskCounts(selectedClient.id).completed}/
                              {getClientTaskCounts(selectedClient.id).total}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-card">
                          <CardContent className="pt-4 pb-4 text-center">
                            <p className="text-xs text-muted-foreground mb-1">Milestones</p>
                            <p className="text-2xl font-bold">
                              {getClientMilestoneCounts(selectedClient.id).completed}/
                              {getClientMilestoneCounts(selectedClient.id).total}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="bg-card">
                          <CardContent className="pt-4 pb-4 text-center">
                            <p className="text-xs text-muted-foreground mb-1">Interactions</p>
                            <p className="text-2xl font-bold">
                              {interactions.filter(i => i.client_id === selectedClient.id).length}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                      Close
                    </Button>
                    <Button onClick={() => {
                      setIsViewDialogOpen(false)
                      handleEditClient(selectedClient)
                    }}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Client
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Edit Client Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              {selectedClient && (
                <>
                  <DialogHeader>
                    <DialogTitle>Edit Client: {selectedClient.name}</DialogTitle>
                    <DialogDescription>
                      Update client information and account details
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSaveClientChanges} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editName">Company Name *</Label>
                        <Input 
                          id="editName"
                          value={editClientData.name}
                          onChange={(e) => setEditClientData({...editClientData, name: e.target.value})}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editIndustry">Industry *</Label>
                        <Input 
                          id="editIndustry"
                          value={editClientData.industry}
                          onChange={(e) => setEditClientData({...editClientData, industry: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editRenewalDate">Next follow-up *</Label>
                        <Input 
                          id="editRenewalDate"
                          type="date"
                          value={editClientData.renewalDate}
                          onChange={(e) => setEditClientData({...editClientData, renewalDate: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Engagement and status are recalculated from contact recency, feature usage, support tickets, and activity.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Engagement score (auto)</Label>
                        <p className="text-lg font-semibold">{editClientData.healthScore !== "" ? editClientData.healthScore : selectedClient?.health_score ?? "—"}%</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editEngagement">Engagement level (0-100)</Label>
                        <Input 
                          id="editEngagement"
                          type="number"
                          min="0"
                          max="100"
                          placeholder="50"
                          value={editClientData.engagementScore}
                          onChange={(e) => setEditClientData({...editClientData, engagementScore: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editFeatureUsage">Feature Usage</Label>
                        <select 
                          id="editFeatureUsage"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={editClientData.featureUsage}
                          onChange={(e) => setEditClientData({...editClientData, featureUsage: e.target.value as "Low" | "Medium" | "High"})}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editCsmId">Assigned to</Label>
                        <select 
                          id="editCsmId"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={editClientData.csmId}
                          onChange={(e) => setEditClientData({...editClientData, csmId: e.target.value})}
                        >
                          <option value="">Unassigned</option>
                          {csmUsers.map((csm) => (
                            <option key={csm.id} value={csm.id}>
                              {csm.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editPortalLogins">Portal Logins</Label>
                        <Input 
                          id="editPortalLogins"
                          type="number"
                          min="0"
                          placeholder="0"
                          value={editClientData.portalLogins}
                          onChange={(e) => setEditClientData({...editClientData, portalLogins: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editSupportTickets">Support Tickets</Label>
                        <Input 
                          id="editSupportTickets"
                          type="number"
                          min="0"
                          placeholder="0"
                          value={editClientData.supportTickets}
                          onChange={(e) => setEditClientData({...editClientData, supportTickets: e.target.value})}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={() => {
                          setIsEditDialogOpen(false)
                          setSelectedClient(null)
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <span className="animate-spin mr-2">⏳</span>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Task Management</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Manage tasks and action items for your clients
                  </p>
                </div>
                <Dialog open={isAddTaskDialogOpen} onOpenChange={setIsAddTaskDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New Task</DialogTitle>
                      <DialogDescription>
                        Add a new task for a client
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddTask} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="taskClient">Client *</Label>
                        <select 
                          id="taskClient"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={newTask.clientId}
                          onChange={(e) => setNewTask({...newTask, clientId: e.target.value})}
                          required
                        >
                          <option value="">Select a client...</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="taskTitle">Task Title *</Label>
                        <Input 
                          id="taskTitle"
                          placeholder="Follow up on product feedback"
                          value={newTask.title}
                          onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="taskStatus">Status</Label>
                          <select 
                            id="taskStatus"
                            className="w-full px-3 py-2 border rounded-md bg-background"
                            value={newTask.status}
                            onChange={(e) => setNewTask({...newTask, status: e.target.value as "active" | "completed" | "overdue"})}
                          >
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="overdue">Overdue</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="taskPriority">Priority</Label>
                          <select 
                            id="taskPriority"
                            className="w-full px-3 py-2 border rounded-md bg-background"
                            value={newTask.priority}
                            onChange={(e) => setNewTask({...newTask, priority: e.target.value as "low" | "medium" | "high"})}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="taskDueDate">Due Date *</Label>
                        <Input 
                          id="taskDueDate"
                          type="date"
                          value={newTask.dueDate}
                          onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="taskAssignedTo">Assign To</Label>
                        <select 
                          id="taskAssignedTo"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={newTask.assignedTo}
                          onChange={(e) => setNewTask({...newTask, assignedTo: e.target.value})}
                        >
                          <option value="">Unassigned</option>
                          {csmUsers.map((csm) => (
                            <option key={csm.id} value={csm.id}>
                              {csm.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <DialogFooter>
                        <Button 
                          type="button"
                          variant="outline" 
                          onClick={() => {
                            setIsAddTaskDialogOpen(false)
                            setNewTask({
                              clientId: "",
                              title: "",
                              status: "active",
                              dueDate: "",
                              priority: "medium",
                              assignedTo: "",
                            })
                          }}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <span className="animate-spin mr-2">⏳</span>
                              Creating...
                            </>
                          ) : (
                            'Create Task'
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Search and Filters */}
              <div className="flex items-center gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search tasks by title, client, or assignee..." 
                    className="pl-10"
                    value={tasksSearchQuery}
                    onChange={(e) => setTasksSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={tasksFilterStatus === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTasksFilterStatus("all")}
                  >
                    All ({tasks.length})
                  </Button>
                  <Button
                    variant={tasksFilterStatus === "active" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTasksFilterStatus("active")}
                  >
                    Active
                  </Button>
                  <Button
                    variant={tasksFilterStatus === "completed" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTasksFilterStatus("completed")}
                  >
                    Completed
                  </Button>
                  <Button
                    variant={tasksFilterStatus === "overdue" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTasksFilterStatus("overdue")}
                  >
                    Overdue
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredTasksTab.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
                  <p className="text-muted-foreground mb-4">
                    {tasksSearchQuery || tasksFilterStatus !== "all" 
                      ? "Try adjusting your search or filters"
                      : "Get started by creating your first task"}
                  </p>
                  {tasksSearchQuery || tasksFilterStatus !== "all" ? (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setTasksSearchQuery("")
                        setTasksFilterStatus("all")
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Button onClick={() => setIsAddTaskDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Task
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasksTab.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">{task.title}</TableCell>
                          <TableCell>
                            {task.client ? task.client.name : 'Unknown Client'}
                          </TableCell>
                          <TableCell>
                            {getTaskStatusBadge(task.status)}
                          </TableCell>
                          <TableCell>
                            {getPriorityBadge(task.priority)}
                          </TableCell>
                          <TableCell>
                            {task.csm ? (
                              <div className="flex items-center gap-2">
                                {task.csm.avatar && (
                                  <img 
                                    src={task.csm.avatar} 
                                    alt={task.csm.name}
                                    className="w-6 h-6 rounded-full"
                                  />
                                )}
                                <span className="text-sm">{task.csm.name}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(task.due_date).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleEditTask(task)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleDeleteTask(task.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Task Dialog */}
          <Dialog open={isEditTaskDialogOpen} onOpenChange={setIsEditTaskDialogOpen}>
            <DialogContent className="max-w-md">
              {selectedTask && (
                <>
                  <DialogHeader>
                    <DialogTitle>Edit Task</DialogTitle>
                    <DialogDescription>
                      Update task details
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSaveTaskChanges} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="editTaskTitle">Task Title *</Label>
                      <Input 
                        id="editTaskTitle"
                        value={editTaskData.title}
                        onChange={(e) => setEditTaskData({...editTaskData, title: e.target.value})}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editTaskStatus">Status</Label>
                        <select 
                          id="editTaskStatus"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={editTaskData.status}
                          onChange={(e) => setEditTaskData({...editTaskData, status: e.target.value as "active" | "completed" | "overdue"})}
                        >
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="overdue">Overdue</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editTaskPriority">Priority</Label>
                        <select 
                          id="editTaskPriority"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={editTaskData.priority}
                          onChange={(e) => setEditTaskData({...editTaskData, priority: e.target.value as "low" | "medium" | "high"})}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editTaskDueDate">Due Date *</Label>
                      <Input 
                        id="editTaskDueDate"
                        type="date"
                        value={editTaskData.dueDate}
                        onChange={(e) => setEditTaskData({...editTaskData, dueDate: e.target.value})}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editTaskAssignedTo">Assign To</Label>
                      <select 
                        id="editTaskAssignedTo"
                        className="w-full px-3 py-2 border rounded-md bg-background"
                        value={editTaskData.assignedTo}
                        onChange={(e) => setEditTaskData({...editTaskData, assignedTo: e.target.value})}
                      >
                        <option value="">Unassigned</option>
                        {csmUsers.map((csm) => (
                          <option key={csm.id} value={csm.id}>
                            {csm.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <DialogFooter>
                      <Button 
                        type="button"
                        variant="outline" 
                        onClick={() => {
                          setIsEditTaskDialogOpen(false)
                          setSelectedTask(null)
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <span className="animate-spin mr-2">⏳</span>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="milestones">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Milestone Tracking</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Track key milestones and achievements for your clients
                  </p>
                </div>
                <Dialog open={isAddMilestoneDialogOpen} onOpenChange={setIsAddMilestoneDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Milestone
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Create New Milestone</DialogTitle>
                      <DialogDescription>
                        Add a new milestone for a client
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddMilestone} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="milestoneClient">Client *</Label>
                        <select
                          id="milestoneClient"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={newMilestone.clientId}
                          onChange={(e) => setNewMilestone({...newMilestone, clientId: e.target.value})}
                          required
                        >
                          <option value="">Select a client</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="milestoneTitle">Milestone Title *</Label>
                        <Input
                          id="milestoneTitle"
                          value={newMilestone.title}
                          onChange={(e) => setNewMilestone({...newMilestone, title: e.target.value})}
                          placeholder="e.g., Complete onboarding"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="milestoneDescription">Description</Label>
                        <Textarea
                          id="milestoneDescription"
                          value={newMilestone.description}
                          onChange={(e) => setNewMilestone({...newMilestone, description: e.target.value})}
                          placeholder="Optional description"
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="milestoneStatus">Status</Label>
                          <select
                            id="milestoneStatus"
                            className="w-full px-3 py-2 border rounded-md bg-background"
                            value={newMilestone.status}
                            onChange={(e) => setNewMilestone({...newMilestone, status: e.target.value as "completed" | "in-progress" | "upcoming"})}
                          >
                            <option value="upcoming">Upcoming</option>
                            <option value="in-progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="milestoneTargetDate">Target Date *</Label>
                          <Input
                            id="milestoneTargetDate"
                            type="date"
                            value={newMilestone.targetDate}
                            onChange={(e) => setNewMilestone({...newMilestone, targetDate: e.target.value})}
                            required
                          />
                        </div>
                      </div>

                      {newMilestone.status === "completed" && (
                        <div className="space-y-2">
                          <Label htmlFor="milestoneCompletedDate">Completed Date</Label>
                          <Input
                            id="milestoneCompletedDate"
                            type="date"
                            value={newMilestone.completedDate}
                            onChange={(e) => setNewMilestone({...newMilestone, completedDate: e.target.value})}
                          />
                        </div>
                      )}

                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsAddMilestoneDialogOpen(false)
                            setNewMilestone({
                              clientId: "",
                              title: "",
                              description: "",
                              status: "upcoming",
                              targetDate: "",
                              completedDate: "",
                            })
                          }}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <span className="animate-spin mr-2">⏳</span>
                              Creating...
                            </>
                          ) : (
                            'Create Milestone'
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Search and Filters for Milestones */}
              <div className="flex items-center gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search milestones by title or client..."
                    className="pl-10"
                    value={milestonesSearchQuery}
                    onChange={(e) => setMilestonesSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={milestonesFilterStatus === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMilestonesFilterStatus("all")}
                  >
                    All ({milestones.length})
                  </Button>
                  <Button
                    variant={milestonesFilterStatus === "upcoming" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMilestonesFilterStatus("upcoming")}
                  >
                    Upcoming
                  </Button>
                  <Button
                    variant={milestonesFilterStatus === "in-progress" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMilestonesFilterStatus("in-progress")}
                  >
                    In Progress
                  </Button>
                  <Button
                    variant={milestonesFilterStatus === "completed" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMilestonesFilterStatus("completed")}
                  >
                    Completed
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredMilestonesTab.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No milestones found</h3>
                  <p className="text-muted-foreground mb-4">
                    {milestonesSearchQuery || milestonesFilterStatus !== "all"
                      ? "Try adjusting your search or filters"
                      : "Get started by creating your first milestone"}
                  </p>
                  {milestonesSearchQuery || milestonesFilterStatus !== "all" ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMilestonesSearchQuery("")
                        setMilestonesFilterStatus("all")
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Button onClick={() => setIsAddMilestoneDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Milestone
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Milestone</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Target Date</TableHead>
                        <TableHead>Completed Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMilestonesTab.map((milestone) => (
                        <TableRow key={milestone.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{milestone.title}</div>
                              {milestone.description && (
                                <div className="text-sm text-muted-foreground mt-1">
                                  {milestone.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {milestone.client ? milestone.client.name : 'Unknown Client'}
                          </TableCell>
                          <TableCell>
                            {getMilestoneStatusBadge(milestone.status)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(milestone.target_date).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            {milestone.completed_date ? (
                              <div className="text-sm">
                                {new Date(milestone.completed_date).toLocaleDateString()}
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditMilestone(milestone)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteMilestone(milestone.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Milestone Dialog */}
          <Dialog open={isEditMilestoneDialogOpen} onOpenChange={setIsEditMilestoneDialogOpen}>
            <DialogContent className="max-w-md">
              {selectedMilestone && (
                <>
                  <DialogHeader>
                    <DialogTitle>Edit Milestone</DialogTitle>
                    <DialogDescription>
                      Update milestone details
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSaveMilestoneChanges} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="editMilestoneTitle">Milestone Title *</Label>
                      <Input
                        id="editMilestoneTitle"
                        value={editMilestoneData.title}
                        onChange={(e) => setEditMilestoneData({...editMilestoneData, title: e.target.value})}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editMilestoneDescription">Description</Label>
                      <Textarea
                        id="editMilestoneDescription"
                        value={editMilestoneData.description}
                        onChange={(e) => setEditMilestoneData({...editMilestoneData, description: e.target.value})}
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editMilestoneStatus">Status</Label>
                        <select
                          id="editMilestoneStatus"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={editMilestoneData.status}
                          onChange={(e) => setEditMilestoneData({...editMilestoneData, status: e.target.value as "completed" | "in-progress" | "upcoming"})}
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="in-progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editMilestoneTargetDate">Target Date *</Label>
                        <Input
                          id="editMilestoneTargetDate"
                          type="date"
                          value={editMilestoneData.targetDate}
                          onChange={(e) => setEditMilestoneData({...editMilestoneData, targetDate: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    {editMilestoneData.status === "completed" && (
                      <div className="space-y-2">
                        <Label htmlFor="editMilestoneCompletedDate">Completed Date</Label>
                        <Input
                          id="editMilestoneCompletedDate"
                          type="date"
                          value={editMilestoneData.completedDate}
                          onChange={(e) => setEditMilestoneData({...editMilestoneData, completedDate: e.target.value})}
                        />
                      </div>
                    )}

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditMilestoneDialogOpen(false)
                          setSelectedMilestone(null)
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <span className="animate-spin mr-2">⏳</span>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="interactions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Communication History</CardTitle>
                  <p className="text-sm text-muted-foreground mt-2">
                    Track all client interactions and communications
                  </p>
                </div>
                <Dialog open={isAddInteractionDialogOpen} onOpenChange={setIsAddInteractionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Log Interaction
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Log New Interaction</DialogTitle>
                      <DialogDescription>
                        Record a call, email, or visit
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddInteraction} className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="interactionClient">Customer *</Label>
                        <select
                          id="interactionClient"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={newInteraction.clientId}
                          onChange={(e) => setNewInteraction({...newInteraction, clientId: e.target.value})}
                          required
                        >
                          <option value="">Select a customer</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="interactionType">Type</Label>
                          <select
                            id="interactionType"
                            className="w-full px-3 py-2 border rounded-md bg-background"
                            value={newInteraction.type}
                            onChange={(e) => setNewInteraction({...newInteraction, type: e.target.value as "email" | "call" | "meeting"})}
                          >
                            <option value="email">Email</option>
                            <option value="call">Call</option>
                            <option value="meeting">Visit</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="interactionDate">Date *</Label>
                          <Input
                            id="interactionDate"
                            type="date"
                            value={newInteraction.interactionDate}
                            onChange={(e) => setNewInteraction({...newInteraction, interactionDate: e.target.value})}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="interactionSubject">Subject *</Label>
                        <Input
                          id="interactionSubject"
                          value={newInteraction.subject}
                          onChange={(e) => setNewInteraction({...newInteraction, subject: e.target.value})}
                          placeholder="e.g., Appointment, follow-up call, quote"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="interactionDescription">Notes</Label>
                        <Textarea
                          id="interactionDescription"
                          value={newInteraction.description}
                          onChange={(e) => setNewInteraction({...newInteraction, description: e.target.value})}
                          placeholder="Add details about the interaction..."
                          rows={4}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="interactionCSM">CSM</Label>
                        <select
                          id="interactionCSM"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={newInteraction.csmId}
                          onChange={(e) => setNewInteraction({...newInteraction, csmId: e.target.value})}
                        >
                          <option value="">Not assigned</option>
                          {csmUsers.map((csm) => (
                            <option key={csm.id} value={csm.id}>
                              {csm.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsAddInteractionDialogOpen(false)
                            setNewInteraction({
                              clientId: "",
                              type: "email",
                              subject: "",
                              description: "",
                              csmId: "",
                              interactionDate: new Date().toISOString().split('T')[0],
                            })
                          }}
                          disabled={isSubmitting}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? (
                            <>
                              <span className="animate-spin mr-2">⏳</span>
                              Logging...
                            </>
                          ) : (
                            'Log Interaction'
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Search and Filters for Interactions */}
              <div className="flex items-center gap-4 mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search interactions by subject, client, or CSM..."
                    className="pl-10"
                    value={interactionsSearchQuery}
                    onChange={(e) => setInteractionsSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={interactionsFilterType === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInteractionsFilterType("all")}
                  >
                    All ({interactions.length})
                  </Button>
                  <Button
                    variant={interactionsFilterType === "email" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInteractionsFilterType("email")}
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    Email
                  </Button>
                  <Button
                    variant={interactionsFilterType === "call" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInteractionsFilterType("call")}
                  >
                    <Phone className="w-4 h-4 mr-1" />
                    Call
                  </Button>
                  <Button
                    variant={interactionsFilterType === "meeting" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setInteractionsFilterType("meeting")}
                  >
                    <Users className="w-4 h-4 mr-1" />
                    Visit
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredInteractionsTab.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No interactions found</h3>
                  <p className="text-muted-foreground mb-4">
                    {interactionsSearchQuery || interactionsFilterType !== "all"
                      ? "Try adjusting your search or filters"
                      : "Get started by logging your first interaction"}
                  </p>
                  {interactionsSearchQuery || interactionsFilterType !== "all" ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setInteractionsSearchQuery("")
                        setInteractionsFilterType("all")
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : (
                    <Button onClick={() => setIsAddInteractionDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Log Your First Interaction
                    </Button>
                  )}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Assigned to</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInteractionsTab.map((interaction) => (
                        <TableRow key={interaction.id}>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(interaction.interaction_date).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getInteractionTypeBadge(interaction.type)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{interaction.subject}</div>
                              {interaction.description && (
                                <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {interaction.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {interaction.client ? interaction.client.name : 'Unknown Client'}
                          </TableCell>
                          <TableCell>
                            {interaction.csm ? (
                              <div className="flex items-center gap-2">
                                {interaction.csm.avatar && (
                                  <img
                                    src={interaction.csm.avatar}
                                    alt={interaction.csm.name}
                                    className="w-6 h-6 rounded-full"
                                  />
                                )}
                                <span className="text-sm">{interaction.csm.name}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditInteraction(interaction)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteInteraction(interaction.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Interaction Dialog */}
          <Dialog open={isEditInteractionDialogOpen} onOpenChange={setIsEditInteractionDialogOpen}>
            <DialogContent className="max-w-md">
              {selectedInteraction && (
                <>
                  <DialogHeader>
                    <DialogTitle>Edit Interaction</DialogTitle>
                    <DialogDescription>
                      Update interaction details
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSaveInteractionChanges} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="editInteractionType">Type</Label>
                        <select
                          id="editInteractionType"
                          className="w-full px-3 py-2 border rounded-md bg-background"
                          value={editInteractionData.type}
                          onChange={(e) => setEditInteractionData({...editInteractionData, type: e.target.value as "email" | "call" | "meeting"})}
                        >
                          <option value="email">Email</option>
                          <option value="call">Call</option>
                          <option value="meeting">Visit</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="editInteractionDate">Date *</Label>
                        <Input
                          id="editInteractionDate"
                          type="date"
                          value={editInteractionData.interactionDate}
                          onChange={(e) => setEditInteractionData({...editInteractionData, interactionDate: e.target.value})}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editInteractionSubject">Subject *</Label>
                      <Input
                        id="editInteractionSubject"
                        value={editInteractionData.subject}
                        onChange={(e) => setEditInteractionData({...editInteractionData, subject: e.target.value})}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editInteractionDescription">Notes</Label>
                      <Textarea
                        id="editInteractionDescription"
                        value={editInteractionData.description}
                        onChange={(e) => setEditInteractionData({...editInteractionData, description: e.target.value})}
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editInteractionCSM">CSM</Label>
                      <select
                        id="editInteractionCSM"
                        className="w-full px-3 py-2 border rounded-md bg-background"
                        value={editInteractionData.csmId}
                        onChange={(e) => setEditInteractionData({...editInteractionData, csmId: e.target.value})}
                      >
                        <option value="">Not assigned</option>
                        {csmUsers.map((csm) => (
                          <option key={csm.id} value={csm.id}>
                            {csm.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsEditInteractionDialogOpen(false)
                          setSelectedInteraction(null)
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <span className="animate-spin mr-2">⏳</span>
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {/* Analytics Section Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h2>
              <p className="text-muted-foreground">Comprehensive insights into your customer metrics</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnalyticsSettingsDialogOpen(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Widget Settings
            </Button>
          </div>

          {/* Key Metrics Overview – one rectangular bar */}
          {visibleAnalyticsWidgets.some(w => w.id === 'key-metrics-overview') && (
            <Card className="overflow-hidden border-border bg-card/50">
              <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
                <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">Client Growth</p>
                    <p className="text-2xl font-bold tabular-nums">{clients.length}</p>
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Target className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">Avg Health Score</p>
                    <p className="text-2xl font-bold tabular-nums">{stats.avgHealthScore}%</p>
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">Task Completion Rate</p>
                    <p className="text-2xl font-bold tabular-nums">
                      {stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%
                    </p>
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">Interactions This Month</p>
                    <p className="text-2xl font-bold tabular-nums">{interactions.length}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Client Health Distribution */}
          {visibleAnalyticsWidgets.some(w => w.id === 'client-health-distribution') && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Client Health Distribution</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Breakdown of clients by health status
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        {
                          name: 'Healthy (80-100)',
                          value: clients.filter(c => c.health_score >= 80).length,
                          fill: '#22c55e'
                        },
                        {
                          name: 'Moderate (60-79)',
                          value: clients.filter(c => c.health_score >= 60 && c.health_score < 80).length,
                          fill: '#eab308'
                        },
                        {
                          name: 'At Risk (<60)',
                          value: clients.filter(c => c.health_score < 60).length,
                          fill: '#ef4444'
                        }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name?.split(' ')[0] || ''}: ${((percent || 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {[
                        { fill: '#22c55e' },
                        { fill: '#eab308' },
                        { fill: '#ef4444' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>

                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <div className="flex items-start gap-3">
                    <Target className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Goal: 80% healthy customers</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Current: {clients.length > 0 ? Math.round((clients.filter(c => c.health_score >= 80).length / clients.length) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Revenue Analytics */}
            {visibleAnalyticsWidgets.some(w => w.id === 'revenue-analytics') && (
            <Card>
              <CardHeader>
                <CardTitle>Revenue Analytics</CardTitle>
                <p className="text-sm text-muted-foreground">
                  ARR breakdown and insights
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      {
                        name: 'Healthy',
                        arr: clients.filter(c => c.health_score >= 80).reduce((sum, c) => sum + c.arr, 0) / 1000,
                        fill: '#22c55e'
                      },
                      {
                        name: 'Moderate',
                        arr: clients.filter(c => c.health_score >= 60 && c.health_score < 80).reduce((sum, c) => sum + c.arr, 0) / 1000,
                        fill: '#eab308'
                      },
                      {
                        name: 'At Risk',
                        arr: clients.filter(c => c.health_score < 60).reduce((sum, c) => sum + c.arr, 0) / 1000,
                        fill: '#ef4444'
                      }
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" />
                    <YAxis label={{ value: 'ARR ($K)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip 
                      formatter={(value: any) => [`$${(Number(value) || 0).toFixed(0)}K`, 'ARR']}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="arr" fill="#8884d8" radius={[8, 8, 0, 0]}>
                      {[
                        { fill: '#22c55e' },
                        { fill: '#eab308' },
                        { fill: '#ef4444' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="mt-4 pt-4 border-t space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total ARR</span>
                    <span className="text-sm font-bold">${(stats.totalARR / 1000).toFixed(0)}K</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Average value per customer</span>
                    <span className="text-sm font-bold">
                      ${clients.length > 0 ? Math.round(stats.totalARR / clients.length / 1000) : 0}K
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Renewals Next 90 Days</span>
                    <span className="text-sm font-bold">
                      {clients.filter(c => {
                        const renewalDate = new Date(c.renewal_date)
                        const ninetyDaysFromNow = new Date()
                        ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)
                        return renewalDate <= ninetyDaysFromNow && renewalDate >= new Date()
                      }).length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            )}
          </div>
          )}

          {/* Activity & Engagement */}
          {visibleAnalyticsWidgets.some(w => w.id === 'interaction-activity' || w.id === 'task-performance') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visibleAnalyticsWidgets.some(w => w.id === 'interaction-activity') && (
            <Card>
              <CardHeader>
                <CardTitle>Interaction Activity</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Communication breakdown by type
                </p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      {
                        name: 'Email',
                        count: interactions.filter(i => i.type === 'email').length,
                        fill: '#3b82f6'
                      },
                      {
                        name: 'Call',
                        count: interactions.filter(i => i.type === 'call').length,
                        fill: '#22c55e'
                      },
                      {
                        name: 'Visit',
                        count: interactions.filter(i => i.type === 'meeting').length,
                        fill: '#a855f7'
                      }
                    ]}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" />
                    <Tooltip 
                      formatter={(value: any) => [(Number(value) || 0), 'Interactions']}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Bar dataKey="count" fill="#8884d8" radius={[0, 8, 8, 0]}>
                      {[
                        { fill: '#3b82f6' },
                        { fill: '#22c55e' },
                        { fill: '#a855f7' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            )}

            {visibleAnalyticsWidgets.some(w => w.id === 'task-performance') && (
            <Card>
              <CardHeader>
                <CardTitle>Task Performance</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Task status and priority breakdown
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Completed', value: stats.completedTasks, fill: '#22c55e' },
                          { name: 'Active', value: stats.totalTasks - stats.completedTasks - stats.overdueTasks, fill: '#3b82f6' },
                          { name: 'Overdue', value: stats.overdueTasks, fill: '#ef4444' }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {[
                          { fill: '#22c55e' },
                          { fill: '#3b82f6' },
                          { fill: '#ef4444' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-3">By Priority</p>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart
                        data={[
                          { priority: 'High', count: tasks.filter(t => t.priority === 'high').length, fill: '#ef4444' },
                          { priority: 'Medium', count: tasks.filter(t => t.priority === 'medium').length, fill: '#eab308' },
                          { priority: 'Low', count: tasks.filter(t => t.priority === 'low').length, fill: '#3b82f6' }
                        ]}
                      >
                        <XAxis dataKey="priority" />
                        <YAxis />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Bar dataKey="count" fill="#8884d8" radius={[8, 8, 0, 0]}>
                          {[
                            { fill: '#ef4444' },
                            { fill: '#eab308' },
                            { fill: '#3b82f6' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
            )}
          </div>
          )}

          {/* Health Score Trends */}
          {visibleAnalyticsWidgets.some(w => w.id === 'health-score-trends') && (
          <Card>
            <CardHeader>
              <CardTitle>Client Health Score Trends</CardTitle>
              <p className="text-sm text-muted-foreground">
                Historical health scores over the last 6 months
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={[
                    { month: 'Jun', healthy: 65, moderate: 25, atRisk: 10 },
                    { month: 'Jul', healthy: 68, moderate: 23, atRisk: 9 },
                    { month: 'Aug', healthy: 70, moderate: 22, atRisk: 8 },
                    { month: 'Sep', healthy: 72, moderate: 20, atRisk: 8 },
                    { month: 'Oct', healthy: 75, moderate: 18, atRisk: 7 },
                    { month: 'Nov', healthy: clients.length > 0 ? Math.round((clients.filter(c => c.health_score >= 80).length / clients.length) * 100) : 0,
                      moderate: clients.length > 0 ? Math.round((clients.filter(c => c.health_score >= 60 && c.health_score < 80).length / clients.length) * 100) : 0,
                      atRisk: clients.length > 0 ? Math.round((clients.filter(c => c.health_score < 60).length / clients.length) * 100) : 0 }
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" />
                  <YAxis label={{ value: 'Percentage (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    formatter={(value: any) => [`${(Number(value) || 0)}%`, '']}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="healthy" stroke="#22c55e" strokeWidth={2} name="Healthy" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="moderate" stroke="#eab308" strokeWidth={2} name="Moderate" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="atRisk" stroke="#ef4444" strokeWidth={2} name="At Risk" dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          )}

          {/* ARR Growth Trend */}
          {visibleAnalyticsWidgets.some(w => w.id === 'arr-growth-trend') && (
          <Card>
            <CardHeader>
              <CardTitle>ARR Growth Trend</CardTitle>
              <p className="text-sm text-muted-foreground">
                Monthly recurring revenue progression
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={[
                    { month: 'Jun', arr: stats.totalARR * 0.82 / 1000, expansion: 10, churn: 5 },
                    { month: 'Jul', arr: stats.totalARR * 0.87 / 1000, expansion: 12, churn: 4 },
                    { month: 'Aug', arr: stats.totalARR * 0.90 / 1000, expansion: 15, churn: 3 },
                    { month: 'Sep', arr: stats.totalARR * 0.94 / 1000, expansion: 18, churn: 4 },
                    { month: 'Oct', arr: stats.totalARR * 0.97 / 1000, expansion: 20, churn: 3 },
                    { month: 'Nov', arr: stats.totalARR / 1000, expansion: 25, churn: 2 }
                  ]}
                >
                  <defs>
                    <linearGradient id="colorARR" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" />
                  <YAxis label={{ value: 'ARR ($K)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    formatter={(value: any, name?: any) => {
                      const val = Number(value) || 0
                      if (name === 'arr') return [`$${val.toFixed(0)}K`, 'Total ARR']
                      if (name === 'expansion') return [`$${val}K`, 'Expansion']
                      if (name === 'churn') return [`$${val}K`, 'Churn']
                      return [val, String(name || '')]
                    }}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="arr" stroke="#22c55e" fillOpacity={1} fill="url(#colorARR)" name="Total ARR" />
                  <Line type="monotone" dataKey="expansion" stroke="#3b82f6" strokeWidth={2} name="Expansion" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="churn" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" name="Churn" dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <p className="text-sm text-muted-foreground">Current MRR</p>
                  <p className="text-xl font-bold text-green-500">${(stats.totalARR / 1000 / 12).toFixed(1)}K</p>
                </div>
                <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-sm text-muted-foreground">Growth Rate</p>
                  <p className="text-xl font-bold text-blue-500">+18%</p>
                </div>
                <div className="text-center p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <p className="text-sm text-muted-foreground">Net Retention</p>
                  <p className="text-xl font-bold text-purple-500">112%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Top Clients by ARR */}
          {visibleAnalyticsWidgets.some(w => w.id === 'top-clients-arr') && (
          <Card>
            <CardHeader>
              <CardTitle>Top Clients by ARR</CardTitle>
              <p className="text-sm text-muted-foreground">
                Highest value client accounts
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={clients
                    .sort((a, b) => b.arr - a.arr)
                    .slice(0, 5)
                    .map(client => ({
                      name: client.name.length > 15 ? client.name.substring(0, 15) + '...' : client.name,
                      arr: client.arr / 1000,
                      health: client.health_score
                    }))}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" label={{ value: 'ARR ($K)', position: 'bottom' }} />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip 
                    formatter={(value: any, name?: any) => {
                      const val = Number(value) || 0
                      if (name === 'arr') return [`$${val.toFixed(0)}K`, 'ARR']
                      if (name === 'health') return [`${val}%`, 'Health Score']
                      return [val, String(name || '')]
                    }}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="arr" fill="#3b82f6" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          )}

          {/* CSM Performance & Milestones */}
          {visibleAnalyticsWidgets.some(w => w.id === 'csm-performance' || w.id === 'upcoming-milestones') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visibleAnalyticsWidgets.some(w => w.id === 'csm-performance') && (
            <Card>
              <CardHeader>
                <CardTitle>CSM Performance</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Team member workload and metrics
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {csmUsers.map((csm) => {
                    const csmClients = clients.filter(c => c.csm_id === csm.id)
                    const csmTasks = tasks.filter(t => t.assigned_to === csm.id)
                    const avgHealthScore = csmClients.length > 0
                      ? Math.round(csmClients.reduce((sum, c) => sum + c.health_score, 0) / csmClients.length)
                      : 0

                    return (
                      <div key={csm.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {csm.avatar && (
                              <img
                                src={csm.avatar}
                                alt={csm.name}
                                className="w-8 h-8 rounded-full"
                              />
                            )}
                            <div>
                              <p className="text-sm font-medium">{csm.name}</p>
                              <p className="text-xs text-muted-foreground">{csm.email}</p>
                            </div>
                          </div>
                          <Badge variant="outline">{csmClients.length} clients</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Avg Health</p>
                            <p className="font-medium">{avgHealthScore}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Tasks</p>
                            <p className="font-medium">{csmTasks.length}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">ARR</p>
                            <p className="font-medium">
                              ${(csmClients.reduce((sum, c) => sum + c.arr, 0) / 1000).toFixed(0)}K
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
            )}

            {visibleAnalyticsWidgets.some(w => w.id === 'upcoming-milestones') && (
            <Card>
              <CardHeader>
                <CardTitle>Milestone Progress</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Client milestone tracking
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold">
                        {milestones.filter(m => m.status === 'completed').length}
                      </p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                    <div className="text-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <Activity className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold">
                        {milestones.filter(m => m.status === 'in-progress').length}
                      </p>
                      <p className="text-xs text-muted-foreground">In Progress</p>
                    </div>
                    <div className="text-center p-3 bg-gray-500/10 rounded-lg border border-gray-500/20">
                      <Clock className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                      <p className="text-2xl font-bold">
                        {milestones.filter(m => m.status === 'upcoming').length}
                      </p>
                      <p className="text-xs text-muted-foreground">Upcoming</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium">Completion Rate</span>
                      <span className="text-sm font-bold">
                        {milestones.length > 0
                          ? Math.round((milestones.filter(m => m.status === 'completed').length / milestones.length) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{
                          width: `${milestones.length > 0 ? (milestones.filter(m => m.status === 'completed').length / milestones.length) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <p className="text-sm">
                        <span className="font-medium">
                          {milestones.filter(m => {
                            const targetDate = new Date(m.target_date)
                            const thirtyDaysFromNow = new Date()
                            thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
                            return targetDate <= thirtyDaysFromNow && targetDate >= new Date() && m.status !== 'completed'
                          }).length}
                        </span>
                        <span className="text-muted-foreground"> milestones due in next 30 days</span>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            )}
          </div>
          )}

          {/* Top Clients by ARR */}
          {visibleAnalyticsWidgets.some(w => w.id === 'top-clients-arr') && (
          <Card>
            <CardHeader>
              <CardTitle>Top Clients by ARR</CardTitle>
              <p className="text-sm text-muted-foreground">
                Highest value client accounts
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {clients
                  .sort((a, b) => b.arr - a.arr)
                  .slice(0, 5)
                  .map((client, index) => (
                    <div key={client.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{client.name}</p>
                          <p className="text-xs text-muted-foreground">{client.industry}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">${(client.arr / 1000).toFixed(0)}K</p>
                        <div className="flex items-center gap-1 mt-1">
                          {getHealthBadge(client.status)}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Analytics Widget Settings Dialog */}
      <WidgetSettingsDialog
        open={analyticsSettingsDialogOpen}
        onOpenChange={setAnalyticsSettingsDialogOpen}
        layout={analyticsLayout}
        onToggleWidget={toggleAnalyticsWidget}
        onReset={() => {
          resetAnalyticsLayout()
          toast({
            title: "Layout reset",
            description: "Analytics widget layout has been reset to default.",
          })
        }}
      />

      {/* Global View Client Dialog - Available from any tab */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selectedClient && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedClient.name}</DialogTitle>
                <DialogDescription className="text-sm">
                  {selectedClient.industry} • ID: {selectedClient.id.substring(0, 8)}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* Status Overview */}
                <div className="grid grid-cols-4 gap-3">
                  <Card className="bg-card">
                    <CardContent className="pt-4 pb-4 px-3">
                      <div className="text-center space-y-2">
                        <p className="text-xs text-muted-foreground">Engagement</p>
                        <p className={`text-2xl font-bold ${getHealthColor(selectedClient.health_score)}`}>
                          {selectedClient.health_score}%
                        </p>
                        <div className="flex justify-center">
                          {getHealthBadge(selectedClient.status)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card">
                    <CardContent className="pt-4 pb-4 px-3">
                      <div className="text-center space-y-2">
                        <p className="text-xs text-muted-foreground">Engagement level</p>
                        <p className="text-2xl font-bold">{selectedClient.engagement_score}%</p>
                        <p className="text-xs text-muted-foreground">Activity & usage</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card">
                    <CardContent className="pt-4 pb-4 px-3">
                      <div className="text-center space-y-2">
                        <p className="text-xs text-muted-foreground">Last contact</p>
                        <p className="text-2xl font-bold">{getTimeSince(selectedClient.last_contact_date)}</p>
                        <p className="text-xs text-muted-foreground">ago</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-card">
                    <CardContent className="pt-4 pb-4 px-3">
                      <div className="text-center space-y-2">
                        <p className="text-xs text-muted-foreground">Next follow-up</p>
                        <p className="text-2xl font-bold">
                          {new Date(selectedClient.renewal_date).toLocaleDateString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Information */}
                <div className="grid grid-cols-2 gap-6">
                  <Card className="bg-card">
                    <CardContent className="pt-6 pb-6 space-y-6">
                      <div>
                        <h4 className="font-semibold mb-4 flex items-center gap-2 text-base">
                          <Building className="w-4 h-4" />
                          Company Information
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground whitespace-nowrap">Industry:</span>
                            <span className="font-medium text-right">{selectedClient.industry}</span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground whitespace-nowrap">Next follow-up:</span>
                            <span className="font-medium text-right">
                              {new Date(selectedClient.renewal_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground whitespace-nowrap">Last Contact:</span>
                            <span className="font-medium text-right">
                              {getTimeSince(selectedClient.last_contact_date)} ago
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t pt-4">
                        <h4 className="font-semibold mb-4 flex items-center gap-2 text-base">
                          <Users className="w-4 h-4" />
                          Account Management
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between items-center gap-4">
                            <span className="text-muted-foreground whitespace-nowrap">CSM:</span>
                            {selectedClient.csm ? (
                              <div className="flex items-center gap-2">
                                {selectedClient.csm.avatar && (
                                  <img 
                                    src={selectedClient.csm.avatar} 
                                    alt={selectedClient.csm.name}
                                    className="w-5 h-5 rounded-full"
                                  />
                                )}
                                <span className="font-medium">{selectedClient.csm.name}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </div>
                          {selectedClient.csm?.email && (
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground whitespace-nowrap">Email:</span>
                              <span className="font-medium text-right break-all">{selectedClient.csm.email}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-card">
                    <CardContent className="pt-6 pb-6">
                      <div>
                        <h4 className="font-semibold mb-4 flex items-center gap-2 text-base">
                          <BarChart3 className="w-4 h-4" />
                          Engagement Metrics
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-muted-foreground">Engagement Score</span>
                              <span className="font-semibold">{selectedClient.engagement_score}%</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2.5">
                              <div 
                                className="bg-blue-500 h-2.5 rounded-full transition-all" 
                                style={{ width: `${selectedClient.engagement_score}%` }}
                              ></div>
                            </div>
                          </div>
                          <div className="flex justify-between text-sm pt-2">
                            <span className="text-muted-foreground">Portal Logins:</span>
                            <span className="font-medium">{selectedClient.portal_logins}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Feature Usage:</span>
                            <Badge variant="outline" className="text-xs">{selectedClient.feature_usage}</Badge>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Support Tickets:</span>
                            <span className="font-medium">{selectedClient.support_tickets}</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Stats */}
                <div>
                  <h4 className="font-semibold mb-4 flex items-center gap-2 text-base">
                    <Target className="w-4 h-4" />
                    Activity Overview
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="bg-card">
                      <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Tasks</p>
                        <p className="text-2xl font-bold">
                          {getClientTaskCounts(selectedClient.id).completed}/
                          {getClientTaskCounts(selectedClient.id).total}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-card">
                      <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Milestones</p>
                        <p className="text-2xl font-bold">
                          {getClientMilestoneCounts(selectedClient.id).completed}/
                          {getClientMilestoneCounts(selectedClient.id).total}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-card">
                      <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Interactions</p>
                        <p className="text-2xl font-bold">
                          {interactions.filter(i => i.client_id === selectedClient.id).length}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  setIsViewDialogOpen(false)
                  handleEditClient(selectedClient)
                }}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Client
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

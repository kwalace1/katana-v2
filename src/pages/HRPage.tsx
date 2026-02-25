import { useState, useEffect, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { calculateZenithMatchScore, defaultJobRequirements } from "@/lib/zenith-matching"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import * as hrApi from '@/lib/hr-api'
import type { Employee, PerformanceReview, Goal, Feedback360, Mentorship, Recognition, LearningPath, CareerPath } from '@/lib/hr-api'
import { getAllCSMUsers, type CSMUser } from '@/lib/customer-success-api'
import { useToast } from "@/hooks/use-toast"
import { toast as sonnerToast } from "sonner"
import {
  Users,
  Star,
  Briefcase,
  Search,
  Plus,
  BarChart3,
  Calendar,
  FileText,
  Target,
  Download,
  X,
  ArrowRight,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertCircle,
  Brain,
  Award,
  UserPlus,
  MessageSquare,
  Sparkles,
  Shield,
  Heart,
  BookOpen,
  Filter,
  FileCheck,
  AlertTriangle,
  ThumbsUp,
  Lightbulb,
  Rocket,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  UserCog,
  Mail,
  Phone,
  Building,
  User,
  Activity,
  Eye,
  Trash2,
  ExternalLink,
  Ticket,
  Copy,
  Check,
} from "lucide-react"
import { AddEmployeeDialog } from "@/components/hr/add-employee-dialog"
import { AddReviewDialog } from "@/components/hr/add-review-dialog"
import { AddGoalDialog } from "@/components/hr/add-goal-dialog"
import { AddCandidateDialog } from "@/components/hr/add-candidate-dialog"
import { AddLearningPathDialog } from "@/components/hr/add-learning-path-dialog"
import { AddCareerPathDialog } from "@/components/hr/add-career-path-dialog"
import { RecruitmentDashboard } from "@/components/hr/recruitment-dashboard"
import { getAllApplications, scheduleInterview, getAllJobs } from "@/lib/recruitment-db"
import { getOrCreateInviteForEmployee } from "@/lib/tenant-context"
import { MODULES } from "@/lib/module-access"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function HRPage() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("dashboard")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [riskFilter, setRiskFilter] = useState("all")
  const [candidateStageFilter, setCandidateStageFilter] = useState("All")
  const [pipelineJobFilter, setPipelineJobFilter] = useState("all")
  const [pipelineDepartmentFilter, setPipelineDepartmentFilter] = useState("all")
  const [editingGoal, setEditingGoal] = useState<string | null>(null)
  const [goalProgress, setGoalProgress] = useState<number>(0)
  
  // Performance tab filters
  const [performanceSort, setPerformanceSort] = useState<"rating" | "date" | "name">("date")
  const [performanceDeptFilter, setPerformanceDeptFilter] = useState("all")
  const [performanceTypeFilter, setPerformanceTypeFilter] = useState("all")
  const [performanceStatusFilter, setPerformanceStatusFilter] = useState("all")
  const [performanceSearchQuery, setPerformanceSearchQuery] = useState("")
  
  // Goals tab filters
  const [goalStatusFilter, setGoalStatusFilter] = useState("all")
  const [goalDeptFilter, setGoalDeptFilter] = useState("all")
  const [goalSort, setGoalSort] = useState<"progress" | "dueDate" | "name">("dueDate")
  const [goalCategoryFilter, setGoalCategoryFilter] = useState("all")
  const [goalSearchQuery, setGoalSearchQuery] = useState("")
  
  // Analytics date range
  const [analyticsDateRange, setAnalyticsDateRange] = useState("all")
  // Development tab section
  const [developmentSection, setDevelopmentSection] = useState<"career" | "mentorship" | "learning" | "recognition">("career")
  
  // Data state
  const [employees, setEmployees] = useState<Employee[]>([])
  const [performanceReviews, setPerformanceReviews] = useState<PerformanceReview[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [feedback360, setFeedback360] = useState<Feedback360[]>([])
  const [mentorships, setMentorships] = useState<Mentorship[]>([])
  const [recognitions, setRecognitions] = useState<Recognition[]>([])
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([])
  const [careerPaths, setCareerPaths] = useState<CareerPath[]>([])
  const [csmUsers, setCSMUsers] = useState<CSMUser[]>([])
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    avgPerformanceScore: 0,
    totalGoals: 0,
    onTrackGoals: 0,
    behindGoals: 0,
    completeGoals: 0,
    upcomingReviews: 0,
    overdueReviews: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  
  // Recruitment data
  const [applications, setApplications] = useState<any[]>([])
  const [openPositions, setOpenPositions] = useState<number>(0)
  const [applicationStats, setApplicationStats] = useState({
    total: 0,
    new: 0,
    reviewing: 0,
    interviewed: 0,
    offers: 0
  })
  
  // Employee management state
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false)
  const [isGoalsDialogOpen, setIsGoalsDialogOpen] = useState(false)
  
  // Performance review dialogs state
  const [selectedReview, setSelectedReview] = useState<PerformanceReview | null>(null)
  const [isReviewDetailsOpen, setIsReviewDetailsOpen] = useState(false)
  const [isAddReviewDialogOpen, setIsAddReviewDialogOpen] = useState(false)
  const [isReviewHistoryOpen, setIsReviewHistoryOpen] = useState(false)
  
  // Goal dialogs state
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [isGoalDetailsOpen, setIsGoalDetailsOpen] = useState(false)
  const [isAddGoalDialogOpen, setIsAddGoalDialogOpen] = useState(false)
  const [isAddCommentOpen, setIsAddCommentOpen] = useState(false)
  const [goalComment, setGoalComment] = useState('')
  
  // Development tab state
  const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false)
  const [isGiveRecognitionOpen, setIsGiveRecognitionOpen] = useState(false)
  const [isAddLearningPathDialogOpen, setIsAddLearningPathDialogOpen] = useState(false)
  const [isAddCareerPathDialogOpen, setIsAddCareerPathDialogOpen] = useState(false)
  
  // Selection state for deletion
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set())
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set())
  const [selectedMentorships, setSelectedMentorships] = useState<Set<string>>(new Set())
  const [selectedRecognitions, setSelectedRecognitions] = useState<Set<string>>(new Set())
  const [selectedLearningPaths, setSelectedLearningPaths] = useState<Set<string>>(new Set())
  const [selectedCareerPaths, setSelectedCareerPaths] = useState<Set<string>>(new Set())
  const [mentorshipForm, setMentorshipForm] = useState({
    mentor_id: "",
    mentee_id: "",
    focus: "",
    match_score: 85,
    start_date: new Date().toISOString().split('T')[0],
    status: "active" as "active" | "completed" | "cancelled",
  })
  const [recognitionForm, setRecognitionForm] = useState({
    from_id: "",
    to_id: "",
    type: "peer" as "peer" | "manager",
    category: "",
    message: "",
    recognition_date: new Date().toISOString().split('T')[0],
  })
  const [isSubmittingMentorship, setIsSubmittingMentorship] = useState(false)
  const [isSubmittingRecognition, setIsSubmittingRecognition] = useState(false)
  
  // Quick Actions state
  const [isScheduleInterviewOpen, setIsScheduleInterviewOpen] = useState(false)
  const [isSend360FeedbackOpen, setIsSend360FeedbackOpen] = useState(false)
  const [isApproveTimeOffOpen, setIsApproveTimeOffOpen] = useState(false)
  const [isAssignTrainingOpen, setIsAssignTrainingOpen] = useState(false)
  
  // Employee selection and deletion state
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Invite code for selected employee (HR "Generate invite code")
  const [employeeInviteCode, setEmployeeInviteCode] = useState<{ email: string; code: string; inviteLink: string } | null>(null)
  const [inviteCodeLoading, setInviteCodeLoading] = useState(false)
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false)

  // Module access editing in employee dialog (synced from selectedEmployee when dialog opens)
  const [editableModuleAccess, setEditableModuleAccess] = useState<string[]>([])
  const [moduleAccessSaving, setModuleAccessSaving] = useState(false)

  useEffect(() => {
    if (isProfileDialogOpen && selectedEmployee) {
      const list = selectedEmployee.module_access
      setEditableModuleAccess(Array.isArray(list) ? [...list] : [])
    }
  }, [isProfileDialogOpen, selectedEmployee?.id])

  // Interview scheduling state
  const [interviewCandidate, setInterviewCandidate] = useState<string>('')
  const [interviewDate, setInterviewDate] = useState<string>('')
  const [interviewTime, setInterviewTime] = useState<string>('')
  const [interviewType, setInterviewType] = useState<string>('')
  const [interviewNotes, setInterviewNotes] = useState<string>('')
  
  // Candidate details state
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null)
  const [isCandidateDetailsOpen, setIsCandidateDetailsOpen] = useState(false)

  // Load all data from Supabase
  useEffect(() => {
    loadData()
    
    // Listen for employee added events
    const handleEmployeeAdded = () => {
      loadData()
    }
    
    const handleApplicationUpdated = async () => {
      // Refresh recruitment data when applications change
      const recruitmentApps = await getAllApplications()
      setApplications(recruitmentApps)
      
      // Calculate application stats
      const recruitmentStats = {
        total: recruitmentApps.length,
        new: recruitmentApps.filter(app => app.status === 'new').length,
        reviewing: recruitmentApps.filter(app => app.status === 'reviewing').length,
        interviewed: recruitmentApps.filter(app => app.status === 'interviewed' || app.status === 'interview-scheduled').length,
        offers: recruitmentApps.filter(app => app.status === 'offer').length,
      }
      setApplicationStats(recruitmentStats)
    }
    
    window.addEventListener('employeeAdded', handleEmployeeAdded)
    window.addEventListener('applicationSubmitted', handleApplicationUpdated)
    window.addEventListener('applicationUpdated', handleApplicationUpdated)
    
    return () => {
      window.removeEventListener('employeeAdded', handleEmployeeAdded)
      window.removeEventListener('applicationSubmitted', handleApplicationUpdated)
      window.removeEventListener('applicationUpdated', handleApplicationUpdated)
    }
  }, [])

  const loadData = async () => {
    try {
      setIsLoading(true)
      
      // Fetch all data in parallel
      const [
        employeesData,
        reviewsData,
        goalsData,
        feedback360Data,
        mentorshipsData,
        recognitionsData,
        learningPathsData,
        careerPathsData,
        statsData,
        csmUsersData,
      ] = await Promise.all([
        hrApi.getAllEmployees(),
        hrApi.getAllPerformanceReviews(),
        hrApi.getAllGoals(),
        hrApi.getAll360Feedback(),
        hrApi.getAllMentorships(),
        hrApi.getAllRecognitions(),
        hrApi.getAllLearningPaths(),
        hrApi.getAllCareerPaths(),
        hrApi.getHRStats(),
        getAllCSMUsers(),
      ])

      setEmployees(employeesData)
      setPerformanceReviews(reviewsData)
      setGoals(goalsData)
      setFeedback360(feedback360Data)
      setMentorships(mentorshipsData)
      setRecognitions(recognitionsData)
      setLearningPaths(learningPathsData)
      setCareerPaths(careerPathsData)
      setStats(statsData)
      setCSMUsers(csmUsersData)
      
      // Load recruitment data from database
      const recruitmentApps = await getAllApplications()
      setApplications(recruitmentApps)
      
      // Load open positions (only count active ones)
      const jobPostings = await getAllJobs()
      // Handle TRUE as string from database
      const activeJobsCount = jobPostings.filter(j => 
        j.is_active === true || j.is_active === 'TRUE' || j.is_active === 'true'
      ).length
      setOpenPositions(activeJobsCount)
      
      // Calculate application stats
      const recruitmentStats = {
        total: recruitmentApps.length,
        new: recruitmentApps.filter(app => app.status === 'new').length,
        reviewing: recruitmentApps.filter(app => app.status === 'reviewing').length,
        interviewed: recruitmentApps.filter(app => app.status === 'interviewed' || app.status === 'interview-scheduled').length,
        offers: recruitmentApps.filter(app => app.status === 'offer').length,
      }
      setApplicationStats(recruitmentStats)
    } catch (error) {
      console.error('Error loading HR data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate days until/since review
  const getDaysUntilReview = (reviewDate: string | null | undefined) => {
    if (!reviewDate) return "Not scheduled"
    const today = new Date()
    const review = new Date(reviewDate)
    const diffTime = review.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays > 0) {
      return `In ${diffDays} days`
    } else if (diffDays === 0) {
      return "Today"
    } else {
      return `${Math.abs(diffDays)} days overdue`
    }
  }

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Active":
        return "default"
      case "Inactive":
        return "outline"
      default:
        return "default"
    }
  }

  // Get stage badge variant
  const getStageVariant = (stage: string) => {
    switch (stage) {
      case "Applied":
        return "secondary"
      case "Reviewed":
        return "default"
      case "Interviewed":
        return "outline"
      case "Offered":
        return "default"
      default:
        return "secondary"
    }
  }

  // Get stage color
  const getStageColor = (stage: string) => {
    switch (stage) {
      case "Applied":
        return "text-blue-500"
      case "Reviewed":
        return "text-yellow-500"
      case "Interviewed":
        return "text-orange-500"
      case "Offered":
        return "text-green-500"
      default:
        return "text-gray-500"
    }
  }

  // Filter employees based on search
  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Handler for selecting/deselecting individual employees
  const handleToggleEmployee = (employeeId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    )
  }

  // Handler for select all/deselect all
  const handleToggleAll = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      setSelectedEmployees([])
    } else {
      setSelectedEmployees(filteredEmployees.map((emp) => emp.id))
    }
  }

  // Handler for deleting selected employees
  // Delete handlers for different tabs
  const handleDeleteSelectedReviews = async () => {
    try {
      for (const reviewId of selectedReviews) {
        await hrApi.deletePerformanceReview(reviewId)
      }
      setSelectedReviews(new Set())
      await loadData()
      toast({
        title: "Success",
        description: `Deleted ${selectedReviews.size} review(s)`,
      })
    } catch (error) {
      console.error('Error deleting reviews:', error)
      toast({
        title: "Error",
        description: "Failed to delete reviews",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSelectedGoals = async () => {
    try {
      for (const goalId of selectedGoals) {
        await hrApi.deleteGoal(goalId)
      }
      setSelectedGoals(new Set())
      await loadData()
      toast({
        title: "Success",
        description: `Deleted ${selectedGoals.size} goal(s)`,
      })
    } catch (error) {
      console.error('Error deleting goals:', error)
      toast({
        title: "Error",
        description: "Failed to delete goals",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSelectedMentorships = async () => {
    try {
      for (const mentorshipId of selectedMentorships) {
        await hrApi.deleteMentorship(mentorshipId)
      }
      setSelectedMentorships(new Set())
      await loadData()
      toast({
        title: "Success",
        description: `Deleted ${selectedMentorships.size} mentorship(s)`,
      })
    } catch (error) {
      console.error('Error deleting mentorships:', error)
      toast({
        title: "Error",
        description: "Failed to delete mentorships",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSelectedRecognitions = async () => {
    try {
      for (const recognitionId of selectedRecognitions) {
        await hrApi.deleteRecognition(recognitionId)
      }
      setSelectedRecognitions(new Set())
      await loadData()
      toast({
        title: "Success",
        description: `Deleted ${selectedRecognitions.size} recognition(s)`,
      })
    } catch (error) {
      console.error('Error deleting recognitions:', error)
      toast({
        title: "Error",
        description: "Failed to delete recognitions",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSelectedLearningPaths = async () => {
    try {
      for (const learningPathId of selectedLearningPaths) {
        await hrApi.deleteLearningPath(learningPathId)
      }
      setSelectedLearningPaths(new Set())
      await loadData()
      toast({
        title: "Success",
        description: `Deleted ${selectedLearningPaths.size} learning path(s)`,
      })
    } catch (error) {
      console.error('Error deleting learning paths:', error)
      toast({
        title: "Error",
        description: "Failed to delete learning paths",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSelectedCareerPaths = async () => {
    try {
      for (const careerPathId of selectedCareerPaths) {
        await hrApi.deleteCareerPath(careerPathId)
      }
      setSelectedCareerPaths(new Set())
      await loadData()
      toast({
        title: "Success",
        description: `Deleted ${selectedCareerPaths.size} career path(s)`,
      })
    } catch (error) {
      console.error('Error deleting career paths:', error)
      toast({
        title: "Error",
        description: "Failed to delete career paths",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSelected = async () => {
    try {
      // Delete employees from database
      for (const employeeId of selectedEmployees) {
        await hrApi.deleteEmployee(employeeId)
      }
      // Refresh data
      await loadData()
      setSelectedEmployees([])
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Error deleting employees:', error)
      alert('Failed to delete employees. Please try again.')
    }
  }

  // Helper function to calculate overall rating
  const calculateOverallRating = (review: PerformanceReview) => {
    return ((review.collaboration + review.accountability + review.trustworthy + review.leadership) / 4).toFixed(1)
  }

  // Helper function to get rating color
  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-green-500"
    if (rating >= 3) return "text-yellow-500"
    return "text-red-500"
  }

  // Helper function to get trend icon
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  // Helper function to get review status badge
  const getReviewStatusBadge = (status: string) => {
    switch (status) {
      case "on-time":
        return <Badge variant="default">On Time</Badge>
      case "overdue":
        return <Badge variant="destructive">Overdue</Badge>
      case "upcoming":
        return <Badge variant="secondary">Upcoming</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Helper function to get date threshold based on analytics date range
  const getDateThreshold = () => {
    if (analyticsDateRange === "all") return null
    const days = parseInt(analyticsDateRange)
    const threshold = new Date()
    threshold.setDate(threshold.getDate() - days)
    return threshold
  }

  // Filter data based on analytics date range
  const getFilteredReviews = () => {
    const threshold = getDateThreshold()
    if (!threshold) return performanceReviews
    return performanceReviews.filter(review => {
      const reviewDate = new Date(review.review_date)
      return reviewDate >= threshold
    })
  }

  const getFilteredGoals = () => {
    const threshold = getDateThreshold()
    if (!threshold) return goals
    return goals.filter(goal => {
      const createdDate = new Date(goal.created_date)
      return createdDate >= threshold
    })
  }

  const getFilteredApplications = () => {
    const threshold = getDateThreshold()
    if (!threshold) return applications
    return applications.filter(app => {
      const createdDate = app.created_at ? new Date(app.created_at) : new Date(app.applied_date || 0)
      return createdDate >= threshold
    })
  }

  // Pipeline view: filter by stage + job + department
  const getPipelineFilteredApplications = () => {
    return applications.filter(app => {
      const stageMatch = candidateStageFilter === "All" ||
        (candidateStageFilter === "Applied" && app.status === 'new') ||
        (candidateStageFilter === "Reviewed" && app.status === 'reviewing') ||
        (candidateStageFilter === "Interviewed" && (app.status === 'interviewed' || app.status === 'interview-scheduled')) ||
        (candidateStageFilter === "Offered" && app.status === 'offer')
      const jobMatch = pipelineJobFilter === "all" || (app.jobTitle && app.jobTitle === pipelineJobFilter)
      const deptMatch = pipelineDepartmentFilter === "all" || (app.department && app.department === pipelineDepartmentFilter)
      return stageMatch && jobMatch && deptMatch
    })
  }

  const handleExportPipelineCsv = () => {
    const rows = getPipelineFilteredApplications()
    const headers = ['Anonymous ID', 'Status', 'Job Title', 'Department', 'Applied Date', 'Rating']
    const csvData = [
      headers.join(','),
      ...rows.map(app => [
        `"${(app.anonymousId || app.id || '').toString().replace(/"/g, '""')}"`,
        `"${(app.status || '').replace(/"/g, '""')}"`,
        `"${(app.jobTitle || '').replace(/"/g, '""')}"`,
        `"${(app.department || '').replace(/"/g, '""')}"`,
        app.appliedDate ? new Date(app.appliedDate).toLocaleDateString() : '',
        app.rating != null ? app.rating : ''
      ].join(','))
    ].join('\n')
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `recruitment-pipeline-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    toast({ title: 'Exported', description: `${rows.length} candidate(s) exported to CSV.` })
  }

  const getFilteredEmployees = () => {
    const threshold = getDateThreshold()
    if (!threshold) return employees
    // Filter by hire_date for new hires in the period
    return employees.filter(emp => {
      const hireDate = new Date(emp.hire_date)
      return hireDate >= threshold
    })
  }

  // Memoized analytics data (avoids recalculating in every Analytics card)
  const analyticsFiltered = useMemo(() => {
    const threshold = getDateThreshold()
    const filteredReviews = !threshold
      ? performanceReviews
      : performanceReviews.filter(r => new Date(r.review_date) >= threshold)
    const filteredGoals = !threshold
      ? goals
      : goals.filter(g => new Date(g.created_date) >= threshold)
    const filteredApplications = !threshold
      ? applications
      : applications.filter(app => {
          const d = app.created_at ? new Date(app.created_at) : new Date(app.applied_date || 0)
          return d >= threshold
        })
    const filteredEmployees = !threshold
      ? employees
      : employees.filter(emp => new Date(emp.hire_date) >= threshold)
    return {
      filteredReviews,
      filteredGoals,
      filteredApplications,
      filteredEmployees,
      employeesToUse: analyticsDateRange === "all" ? employees : filteredEmployees,
    }
  }, [analyticsDateRange, performanceReviews, goals, applications, employees])

  // Handler for creating mentorship match
  const handleCreateMentorship = async () => {
    if (!mentorshipForm.mentor_id || !mentorshipForm.mentee_id) {
      toast({
        title: "Error",
        description: "Please select both mentor and mentee",
        variant: "destructive",
      })
      return
    }

    if (!mentorshipForm.focus) {
      toast({
        title: "Error",
        description: "Please select a focus area",
        variant: "destructive",
      })
      return
    }

    if (mentorshipForm.mentor_id === mentorshipForm.mentee_id) {
      toast({
        title: "Error",
        description: "Mentor and mentee cannot be the same person",
        variant: "destructive",
      })
      return
    }

    setIsSubmittingMentorship(true)

    try {
      const result = await hrApi.createMentorship({
        mentor_id: mentorshipForm.mentor_id,
        mentee_id: mentorshipForm.mentee_id,
        focus: mentorshipForm.focus,
        match_score: mentorshipForm.match_score,
        start_date: mentorshipForm.start_date,
        status: mentorshipForm.status,
      })

      if (result) {
        toast({
          title: "Success",
          description: "Mentorship match created successfully!",
        })
        setIsCreateMatchOpen(false)
        // Reset form
        setMentorshipForm({
          mentor_id: "",
          mentee_id: "",
          focus: "",
          match_score: 85,
          start_date: new Date().toISOString().split('T')[0],
          status: "active",
        })
        // Refresh data
        await loadData()
      } else {
        toast({
          title: "Error",
          description: "Failed to create mentorship match",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating mentorship:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingMentorship(false)
    }
  }

  // Handler for creating recognition
  const handleCreateRecognition = async () => {
    if (!recognitionForm.from_id || !recognitionForm.to_id) {
      toast({
        title: "Error",
        description: "Please select both sender and recipient",
        variant: "destructive",
      })
      return
    }

    if (!recognitionForm.category || !recognitionForm.message) {
      toast({
        title: "Error",
        description: "Please fill in category and message",
        variant: "destructive",
      })
      return
    }

    // Get names from employees/users
    const fromEmployee = employees.find(e => e.id === recognitionForm.from_id)
    const toEmployee = employees.find(e => e.id === recognitionForm.to_id)
    const fromName = fromEmployee?.name || csmUsers.find(u => u.id === recognitionForm.from_id)?.name || "Unknown"
    const toName = toEmployee?.name || "Unknown"

    if (!toEmployee) {
      toast({
        title: "Error",
        description: "Recipient not found",
        variant: "destructive",
      })
      return
    }

    setIsSubmittingRecognition(true)

    try {
      const result = await hrApi.createRecognition({
        from_id: recognitionForm.from_id || null,
        from_name: fromName,
        to_id: recognitionForm.to_id,
        to_name: toName,
        type: recognitionForm.type === "peer" ? "Peer Recognition" : "Manager Recognition",
        category: recognitionForm.category,
        message: recognitionForm.message,
        recognition_date: recognitionForm.recognition_date,
      })

      if (result) {
        toast({
          title: "Success",
          description: "Recognition sent successfully!",
        })
        setIsGiveRecognitionOpen(false)
        // Reset form
        setRecognitionForm({
          from_id: "",
          to_id: "",
          type: "peer",
          category: "",
          message: "",
          recognition_date: new Date().toISOString().split('T')[0],
        })
        // Refresh data
        await loadData()
      } else {
        toast({
          title: "Error",
          description: "Failed to send recognition",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating recognition:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingRecognition(false)
    }
  }

  // Helper function to get goal status color
  const getGoalStatusColor = (status: string) => {
    switch (status) {
      case "On Track":
        return "bg-green-500/10 text-green-600 border-green-500/20"
      case "Behind":
        return "bg-red-500/10 text-red-600 border-red-500/20"
      case "Complete":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20"
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20"
    }
  }

  // Helper function to get goal status icon
  const getGoalStatusIcon = (status: string) => {
    switch (status) {
      case "On Track":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "Behind":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "Complete":
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />
      default:
        return null
    }
  }

  // Helper function to calculate days until due date
  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = due.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays > 0) {
      return `${diffDays} days left`
    } else if (diffDays === 0) {
      return "Due today"
    } else {
      return `${Math.abs(diffDays)} days overdue`
    }
  }

  // Goal statistics calculations
  const totalGoals = stats.totalGoals
  const onTrackGoals = stats.onTrackGoals
  const behindGoals = stats.behindGoals
  const completeGoals = stats.completeGoals

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
                <span className="text-foreground">Katana HR</span>
              </div>
              
              {/* Title with Icon */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg">
                  <UserCog className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">Katana HR</h1>
              </div>
              
              <p className="text-muted-foreground mt-2">Human capital management</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="border-none border-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="recruitment">Recruitment</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="development">Development</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <Card className="mb-8">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-6 border-b">
                  <div className="flex items-center gap-4">
                    <Users className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Employees</p>
                      <p className="text-2xl font-bold">{stats.activeEmployees}</p>
                      <p className="text-xs text-muted-foreground">Total active staff</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <AlertTriangle className="h-8 w-8 text-yellow-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Retention Risk</p>
                      <p className="text-2xl font-bold text-yellow-500">{stats.overdueReviews}</p>
                      <p className="text-xs text-muted-foreground">Reviews overdue</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Star className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Performance</p>
                      <p className="text-2xl font-bold">{stats.avgPerformanceScore.toFixed(2)}/5</p>
                      <p className="text-xs text-muted-foreground">Across {stats.totalEmployees} employees</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Briefcase className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Open Positions</p>
                      <p className="text-2xl font-bold">{openPositions}</p>
                      <p className="text-xs text-muted-foreground">
                        {applicationStats.total > 0 ? `${applicationStats.total} applications` : 'Actively hiring'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="pt-6">
                  <p className="text-sm font-semibold mb-2">Quick Actions</p>
                  <p className="text-xs text-muted-foreground mb-4">Common HR tasks</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                    <Button className="w-full justify-start bg-transparent" variant="outline" onClick={() => setIsScheduleInterviewOpen(true)}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Schedule Interview
                    </Button>
                    <Button className="w-full justify-start bg-transparent" variant="outline" onClick={() => setIsSend360FeedbackOpen(true)}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Send 360° Feedback
                    </Button>
                    <Button className="w-full justify-start bg-transparent" variant="outline" onClick={() => setIsGiveRecognitionOpen(true)}>
                      <Award className="mr-2 h-4 w-4" />
                      Give Recognition
                    </Button>
                    <Button className="w-full justify-start bg-transparent" variant="outline" onClick={() => setIsApproveTimeOffOpen(true)}>
                      <FileCheck className="mr-2 h-4 w-4" />
                      Approve Time Off
                    </Button>
                    <Button className="w-full justify-start bg-transparent" variant="outline" onClick={() => setIsAssignTrainingOpen(true)}>
                      <BookOpen className="mr-2 h-4 w-4" />
                      Assign Training
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Employee Directory */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Employee Directory</CardTitle>
                      <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search employees..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {filteredEmployees.map((employee) => (
                        <div
                          key={employee.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setSelectedEmployee(employee)
                            setIsProfileDialogOpen(true)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              setSelectedEmployee(employee)
                              setIsProfileDialogOpen(true)
                            }
                          }}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold">{employee.name}</h3>
                              <Badge variant={getStatusVariant(employee.status)}>{employee.status}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {employee.position} • {employee.department}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              <Calendar className="inline h-3 w-3 mr-1" />
                              Next Review: {getDaysUntilReview(employee.next_review_date)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {isLoading ? (
                        <div className="text-center py-4 text-muted-foreground">Loading activity...</div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No recent activity</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="recruitment">
            {/* Sub-tabs for different recruitment views */}
            <Tabs defaultValue="pipeline" className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Recruitment Management</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage candidates from applications to offers
                  </p>
                </div>
              </div>

              <TabsList>
                <TabsTrigger value="pipeline">Candidate Pipeline</TabsTrigger>
                <TabsTrigger value="applications">Job Applications</TabsTrigger>
              </TabsList>

              {/* Original Recruitment Pipeline */}
              <TabsContent value="pipeline">
                {/* Quick Action Bar */}
                <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Recruitment Pipeline</h3>
                    <p className="text-sm text-muted-foreground">
                      Anonymous, bias-free hiring with Katana-powered matching
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Filter className="mr-2 h-4 w-4" />
                      Filter
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                    <AddCandidateDialog />
                  </div>
                </div>

                {/* Anonymous Info Badge - Compact */}
                <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                  <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Anonymous Mode:</strong> All candidates identified by ID only. No personal information displayed.
                  </p>
                </div>

                {/* Job board integrations */}
                <Card className="mb-6">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Link to job boards
                    </CardTitle>
                    <CardDescription>
                      Connect your job postings to Indeed, LinkedIn, and other boards so candidates can apply in one place.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <a href="https://employers.indeed.com/hire" target="_blank" rel="noopener noreferrer">
                          Indeed <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href="https://www.linkedin.com/talent/post-a-job" target="_blank" rel="noopener noreferrer">
                          LinkedIn Jobs <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href="https://www.glassdoor.com/employers/" target="_blank" rel="noopener noreferrer">
                          Glassdoor <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Post your roles on these sites and set your application URL to your careers page so all applications flow into this pipeline.
                    </p>
                  </CardContent>
                </Card>

                <Card className="mb-6">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 border-b">
                      <div className="flex items-center gap-4">
                        <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Applications</p>
                          <p className="text-2xl font-bold">{applicationStats.total}</p>
                          <p className="text-xs text-muted-foreground">
                            {applicationStats.new > 0 && (
                              <>
                                <TrendingUp className="inline h-3 w-3 mr-1 text-green-500" />
                                {applicationStats.new} new
                              </>
                            )}
                            {applicationStats.new === 0 && 'No new applications'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Calendar className="h-8 w-8 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Interviews Scheduled</p>
                          <p className="text-2xl font-bold">{applicationStats.interviewed}</p>
                          <p className="text-xs text-muted-foreground">
                            {applicationStats.interviewed > 0 ? 'Candidates interviewed' : 'No interviews yet'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="pt-6">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold">All Candidates by Stage</h3>
                        <p className="text-sm text-muted-foreground">View and manage candidates at each hiring stage</p>
                      </div>
                    {/* Stage Tabs/Filters */}
                    <div className="flex gap-2 mb-6 flex-wrap">
                      <Button 
                        variant={candidateStageFilter === "All" ? "default" : "outline"} 
                        size="sm" 
                        className="flex items-center gap-2"
                        onClick={() => setCandidateStageFilter("All")}
                      >
                        All Candidates
                        <Badge variant="secondary" className="ml-1">{applicationStats.total}</Badge>
                      </Button>
                      <Button 
                        variant={candidateStageFilter === "Applied" ? "default" : "outline"} 
                        size="sm" 
                        className="flex items-center gap-2"
                        onClick={() => setCandidateStageFilter("Applied")}
                      >
                        Applied
                        <Badge variant="secondary" className="ml-1">{applicationStats.new}</Badge>
                      </Button>
                      <Button 
                        variant={candidateStageFilter === "Reviewed" ? "default" : "outline"} 
                        size="sm" 
                        className="flex items-center gap-2"
                        onClick={() => setCandidateStageFilter("Reviewed")}
                      >
                        Reviewed
                        <Badge variant="secondary" className="ml-1">{applicationStats.reviewing}</Badge>
                      </Button>
                      <Button 
                        variant={candidateStageFilter === "Interviewed" ? "default" : "outline"} 
                        size="sm" 
                        className="flex items-center gap-2"
                        onClick={() => setCandidateStageFilter("Interviewed")}
                      >
                        Interviewed
                        <Badge variant="secondary" className="ml-1">{applicationStats.interviewed}</Badge>
                      </Button>
                      <Button 
                        variant={candidateStageFilter === "Offered" ? "default" : "outline"} 
                        size="sm" 
                        className="flex items-center gap-2"
                        onClick={() => setCandidateStageFilter("Offered")}
                      >
                        Offered
                        <Badge variant="secondary" className="ml-1">{applicationStats.offers}</Badge>
                      </Button>
                    </div>

                    {/* Candidate List */}
                    <div className="space-y-3">
                      {getPipelineFilteredApplications().length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                          <p className="text-lg font-medium mb-1">No candidates in this stage</p>
                          <p className="text-sm">
                            {applications.length === 0 
                              ? 'Candidates will appear here once applications are received'
                              : 'Try selecting a different stage or filter'}
                          </p>
                        </div>
                      ) : (
                        getPipelineFilteredApplications()
                          .map((app) => (
                            <div key={app.id} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h3 className="font-semibold">{app.anonymousId}</h3>
                                    <Badge variant={
                                      app.status === 'new' ? 'secondary' :
                                      app.status === 'reviewing' ? 'default' :
                                      app.status === 'interviewed' ? 'outline' :
                                      app.status === 'offer' ? 'default' :
                                      'secondary'
                                    }>
                                      {app.status.replace('-', ' ')}
                                    </Badge>
                                    {app.rating && (
                                      <div className="flex items-center gap-1">
                                        {Array.from({ length: app.rating }).map((_, i) => (
                                          <Star key={i} className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {app.jobTitle} • {app.department}
                                  </p>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    <span>
                                      <Calendar className="inline h-3 w-3 mr-1" />
                                      Applied: {new Date(app.appliedDate).toLocaleDateString()}
                                    </span>
                                    {app.isRevealed && (
                                      <Badge variant="outline" className="text-xs">
                                        <Eye className="w-3 h-3 mr-1" />
                                        Revealed
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => {
                                      setSelectedCandidate(app)
                                      setIsCandidateDetailsOpen(true)
                                    }}
                                  >
                                    View Details
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* New Job Applications System */}
              <TabsContent value="applications">
                <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                  <Shield className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-700 dark:text-green-300">
                    <strong>External Applications:</strong> Applications from public careers page. Personal info hidden until revealed.
                  </p>
                </div>
                <RecruitmentDashboard />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="employees">
            <div className="mb-6 flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
              <AddEmployeeDialog />
            </div>

            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-6 border-b">
                  <div className="flex items-center gap-4">
                    <Users className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
                      <p className="text-2xl font-bold">{stats.totalEmployees}</p>
                      <p className="text-xs text-muted-foreground">Across {new Set(employees.map(e => e.department)).size} departments</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <UserPlus className="h-8 w-8 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Staff</p>
                      <p className="text-2xl font-bold">{stats.activeEmployees}</p>
                      <p className="text-xs text-muted-foreground">Currently employed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Clock className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Tenure</p>
                      <p className="text-2xl font-bold">
                        {employees.length > 0 
                          ? `${(employees.reduce((acc, emp) => {
                              const years = new Date().getFullYear() - new Date(emp.hire_date).getFullYear();
                              return acc + years;
                            }, 0) / employees.length).toFixed(1)} yrs`
                          : '0 yrs'
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">Company average</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Heart className="h-8 w-8 text-red-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Engagement</p>
                      <p className="text-2xl font-bold">
                        {employees.length > 0 && stats.avgPerformanceScore > 0 
                          ? `${stats.avgPerformanceScore.toFixed(1)}/5`
                          : 'N/A'
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">Avg performance score</p>
                    </div>
                  </div>
                </div>
                <div className="pt-6">
                  <div className="flex flex-col gap-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">Employee Directory</h3>
                        <p className="text-sm text-muted-foreground">Comprehensive employee information and management</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {filteredEmployees.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                              onCheckedChange={handleToggleAll}
                            />
                            <span className="text-sm text-muted-foreground">
                              Select All ({selectedEmployees.length} selected)
                            </span>
                          </div>
                        )}
                        {selectedEmployees.length > 0 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowDeleteDialog(true)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Selected ({selectedEmployees.length})
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                <div className="space-y-4">
                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedEmployee(employee)
                        setIsProfileDialogOpen(true)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedEmployee(employee)
                          setIsProfileDialogOpen(true)
                        }
                      }}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedEmployees.includes(employee.id)}
                          onCheckedChange={() => handleToggleEmployee(employee.id)}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{employee.name}</h3>
                          <Badge variant={getStatusVariant(employee.status)}>{employee.status}</Badge>
                          {employee.performance_score && employee.performance_score >= 4.5 && (
                            <Badge variant="outline" className="gap-1 text-yellow-500 border-yellow-500">
                              <Star className="h-3 w-3 fill-yellow-500" />
                              Top Performer
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {employee.position} • {employee.department}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>
                            <Calendar className="inline h-3 w-3 mr-1" />
                            Next Review: {getDaysUntilReview(employee.next_review_date)}
                          </span>
                          {employee.performance_score && (
                            <span>
                              <Star className="inline h-3 w-3 mr-1" />
                              Score: {employee.performance_score.toFixed(1)}/5.0
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedEmployee(employee)
                            setIsFeedbackDialogOpen(true)
                          }}
                        >
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Feedback
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedEmployee(employee)
                            setIsGoalsDialogOpen(true)
                          }}
                        >
                          <Target className="mr-2 h-4 w-4" />
                          Goals
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedEmployee(employee)
                            setIsProfileDialogOpen(true)
                          }}
                        >
                          View Profile
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance">
            {/* Performance KPIs - one rectangle, no inner bubbles */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center gap-4">
                    <Star className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Average Review Score</p>
                      <p className="text-2xl font-bold">{stats.avgPerformanceScore.toFixed(1)}/5</p>
                      <p className="text-xs text-muted-foreground">Across all employees</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Completed Reviews</p>
                      <p className="text-2xl font-bold">{performanceReviews.length}</p>
                      <p className="text-xs text-muted-foreground">This period</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Calendar className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Reviews Overdue</p>
                      <p className="text-2xl font-bold">{stats.overdueReviews}</p>
                      <p className="text-xs text-muted-foreground">Need attention</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Clock className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Upcoming Reviews</p>
                      <p className="text-2xl font-bold">{stats.upcomingReviews}</p>
                      <p className="text-xs text-muted-foreground">Next 30 days</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Distribution Charts - one rectangle */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4">
                    <h3 className="text-base font-semibold mb-1">Rating Distribution</h3>
                    <p className="text-xs text-muted-foreground mb-4">Performance scores across all reviews</p>
                    <div className="space-y-3">
                      {[5, 4, 3, 2, 1].map((rating) => {
                        const count = performanceReviews.filter(r => {
                          const overall = Number(calculateOverallRating(r))
                          return overall >= rating && overall < rating + 1
                        }).length
                        const percentage = performanceReviews.length > 0 
                          ? (count / performanceReviews.length) * 100 
                          : 0
                        return (
                          <div key={rating} className="flex items-center gap-3">
                            <div className="flex items-center gap-1 w-16">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium">{rating}</span>
                            </div>
                            <Progress value={percentage} className="flex-1 h-2" />
                            <span className="text-sm text-muted-foreground w-12 text-right">
                              {count} ({Math.round(percentage)}%)
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-base font-semibold mb-1">Department Performance</h3>
                    <p className="text-xs text-muted-foreground mb-4">Average scores by department</p>
                    <div className="space-y-3">
                      {(() => {
                        const deptScores = performanceReviews.reduce((acc, review) => {
                          const dept = review.employee?.department || 'Unknown'
                          if (!acc[dept]) {
                            acc[dept] = { total: 0, count: 0 }
                          }
                          acc[dept].total += Number(calculateOverallRating(review))
                          acc[dept].count += 1
                          return acc
                        }, {} as Record<string, { total: number; count: number }>)
                        
                        return Object.entries(deptScores)
                          .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))
                          .slice(0, 5)
                          .map(([dept, { total, count }]) => {
                            const avg = total / count
                            const percentage = (avg / 5) * 100
                            return (
                              <div key={dept} className="flex items-center gap-3">
                                <div className="w-32 text-sm font-medium truncate" title={dept}>
                                  {dept}
                                </div>
                                <Progress value={percentage} className="flex-1 h-2" />
                                <span className={`text-sm font-semibold w-12 text-right ${getRatingColor(avg)}`}>
                                  {avg.toFixed(1)}
                                </span>
                              </div>
                            )
                          })
                      })()}
                      {performanceReviews.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No reviews available
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Reviews Table with Filters */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Employee Performance Reviews</CardTitle>
                      <CardDescription>Track and manage employee performance ratings</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {selectedReviews.size > 0 && (
                        <Button 
                          variant="destructive" 
                          onClick={handleDeleteSelectedReviews}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete ({selectedReviews.size})
                        </Button>
                      )}
                      <Button onClick={() => setIsAddReviewDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Review
                      </Button>
                    </div>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by employee name..."
                        value={performanceSearchQuery}
                        onChange={(e) => setPerformanceSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={performanceDeptFilter} onValueChange={setPerformanceDeptFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {Array.from(new Set(employees.map(e => e.department))).map(dept => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={performanceTypeFilter} onValueChange={setPerformanceTypeFilter}>
                      <SelectTrigger className="w-full sm:w-[160px]">
                        <SelectValue placeholder="Review Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                        <SelectItem value="probation">Probation</SelectItem>
                        <SelectItem value="promotion">Promotion</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={performanceStatusFilter} onValueChange={setPerformanceStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[150px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="on-time">On Time</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={performanceSort} onValueChange={(value: any) => setPerformanceSort(value)}>
                      <SelectTrigger className="w-full sm:w-[150px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Sort by Date</SelectItem>
                        <SelectItem value="rating">Sort by Rating</SelectItem>
                        <SelectItem value="name">Sort by Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    // Apply filters
                    let filteredReviews = performanceReviews.filter(review => {
                      const matchesSearch = !performanceSearchQuery || 
                        review.employee?.name?.toLowerCase().includes(performanceSearchQuery.toLowerCase())
                      const matchesDept = performanceDeptFilter === "all" || 
                        review.employee?.department === performanceDeptFilter
                      const matchesType = performanceTypeFilter === "all" || 
                        review.review_type === performanceTypeFilter
                      const matchesStatus = performanceStatusFilter === "all" || 
                        review.status === performanceStatusFilter
                      
                      return matchesSearch && matchesDept && matchesType && matchesStatus
                    })

                    // Apply sorting
                    filteredReviews = filteredReviews.sort((a, b) => {
                      if (performanceSort === "rating") {
                        return Number(calculateOverallRating(b)) - Number(calculateOverallRating(a))
                      } else if (performanceSort === "name") {
                        return (a.employee?.name || '').localeCompare(b.employee?.name || '')
                      } else {
                        return new Date(b.review_date).getTime() - new Date(a.review_date).getTime()
                      }
                    })

                    if (filteredReviews.length === 0) {
                      return (
                        <div className="text-center py-12">
                          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                          <p className="text-lg font-medium mb-1">No reviews found</p>
                          <p className="text-sm text-muted-foreground">
                            {performanceSearchQuery || performanceDeptFilter !== "all" || performanceTypeFilter !== "all" || performanceStatusFilter !== "all"
                              ? "Try adjusting your filters"
                              : "Get started by adding a performance review"}
                          </p>
                        </div>
                      )
                    }

                    return filteredReviews.map((review) => {
                      const overallRating = calculateOverallRating(review)
                      const isSelected = selectedReviews.has(review.id)
                      return (
                        <div key={review.id} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                          <div className="flex items-start justify-between mb-4">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedReviews)
                                if (checked) {
                                  newSelected.add(review.id)
                                } else {
                                  newSelected.delete(review.id)
                                }
                                setSelectedReviews(newSelected)
                              }}
                              className="mr-3 mt-1"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <h3 className="font-semibold">{review.employee?.name || 'Unknown Employee'}</h3>
                                {getReviewStatusBadge(review.status)}
                                {getTrendIcon(review.trend)}
                                <Badge variant="outline" className="capitalize">{review.review_type}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{review.employee?.department || 'N/A'} • {review.employee?.position || 'N/A'}</p>
                            </div>
                            <div className="text-right">
                              <div className={`text-2xl font-bold ${getRatingColor(Number(overallRating))}`}>
                                {overallRating}
                              </div>
                              <p className="text-xs text-muted-foreground">Overall Rating</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Collaboration</p>
                              <div className="flex items-center gap-2">
                                <div className={`text-lg font-semibold ${getRatingColor(review.collaboration)}`}>
                                  {review.collaboration}
                                </div>
                                <div className="text-xs text-muted-foreground">/5</div>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Accountability</p>
                              <div className="flex items-center gap-2">
                                <div className={`text-lg font-semibold ${getRatingColor(review.accountability)}`}>
                                  {review.accountability}
                                </div>
                                <div className="text-xs text-muted-foreground">/5</div>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Trustworthy</p>
                              <div className="flex items-center gap-2">
                                <div className={`text-lg font-semibold ${getRatingColor(review.trustworthy)}`}>
                                  {review.trustworthy}
                                </div>
                                <div className="text-xs text-muted-foreground">/5</div>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Leadership</p>
                              <div className="flex items-center gap-2">
                                <div className={`text-lg font-semibold ${getRatingColor(review.leadership)}`}>
                                  {review.leadership}
                                </div>
                                <div className="text-xs text-muted-foreground">/5</div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                            <span>Review Date: {new Date(review.review_date).toLocaleDateString()}</span>
                            <span>Period: {review.review_period}</span>
                            {review.reviewer && <span>Reviewer: {review.reviewer.name}</span>}
                          </div>

                          {(review.strengths || review.improvements || review.goals) && (
                            <div className="mb-4 p-3 bg-muted/50 rounded-md space-y-2">
                              {review.strengths && (
                                <div>
                                  <p className="text-xs font-medium mb-1 flex items-center gap-1">
                                    <ThumbsUp className="h-3 w-3" /> Strengths
                                  </p>
                                  <p className="text-xs text-muted-foreground line-clamp-2">{review.strengths}</p>
                                </div>
                              )}
                              {review.improvements && (
                                <div>
                                  <p className="text-xs font-medium mb-1 flex items-center gap-1">
                                    <Target className="h-3 w-3" /> Areas for Improvement
                                  </p>
                                  <p className="text-xs text-muted-foreground line-clamp-2">{review.improvements}</p>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex gap-2 flex-wrap">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedReview(review)
                                setIsReviewDetailsOpen(true)
                              }}
                            >
                              <Eye className="mr-1 h-3 w-3" />
                              View Details
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedReview(review)
                                setIsAddReviewDialogOpen(true)
                              }}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              Add Review
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedReview(review)
                                setIsReviewHistoryOpen(true)
                              }}
                            >
                              <Clock className="mr-1 h-3 w-3" />
                              View History
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="goals">
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-6 border-b">
                  <div className="flex items-center gap-4">
                    <Target className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Goals</p>
                      <p className="text-2xl font-bold">{totalGoals}</p>
                      <p className="text-xs text-muted-foreground">Active employee goals</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">On Track</p>
                      <p className="text-2xl font-bold text-green-500">
                        {onTrackGoals} ({totalGoals > 0 ? Math.round((onTrackGoals / totalGoals) * 100) : 0}%)
                      </p>
                      <p className="text-xs text-muted-foreground">Progressing well</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <AlertCircle className="h-8 w-8 text-red-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Behind</p>
                      <p className="text-2xl font-bold text-red-500">
                        {behindGoals} ({totalGoals > 0 ? Math.round((behindGoals / totalGoals) * 100) : 0}%)
                      </p>
                      <p className="text-xs text-muted-foreground">Need attention</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <CheckCircle2 className="h-8 w-8 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Complete</p>
                      <p className="text-2xl font-bold text-blue-500">
                        {completeGoals} ({totalGoals > 0 ? Math.round((completeGoals / totalGoals) * 100) : 0}%)
                      </p>
                      <p className="text-xs text-muted-foreground">Achieved goals</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                  <div className="p-4">
                    <h3 className="text-base font-semibold mb-1">Progress by Category</h3>
                    <p className="text-xs text-muted-foreground mb-4">Average completion rate by goal category</p>
                    <div className="space-y-3">
                      {(() => {
                        const categoryProgress = goals.reduce((acc, goal) => {
                          if (!acc[goal.category]) {
                            acc[goal.category] = { total: 0, count: 0 }
                          }
                          acc[goal.category].total += goal.progress
                          acc[goal.category].count += 1
                          return acc
                        }, {} as Record<string, { total: number; count: number }>)
                        
                        return Object.entries(categoryProgress)
                          .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))
                          .map(([category, { total, count }]) => {
                            const avg = Math.round(total / count)
                            return (
                              <div key={category} className="flex items-center gap-3">
                                <div className="w-36 text-sm font-medium truncate" title={category}>
                                  {category}
                                </div>
                                <Progress value={avg} className="flex-1 h-2" />
                                <span className="text-sm font-semibold w-12 text-right">
                                  {avg}%
                                </span>
                              </div>
                            )
                          })
                      })()}
                      {goals.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No goals available
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-base font-semibold mb-1">Goal Status Distribution</h3>
                    <p className="text-xs text-muted-foreground mb-4">Breakdown of goals by status</p>
                    <div className="space-y-3">
                      {['On Track', 'Behind', 'Complete', 'Cancelled'].map((status) => {
                        const count = goals.filter(g => g.status === status).length
                        const percentage = goals.length > 0 ? (count / goals.length) * 100 : 0
                        const colors = {
                          'On Track': 'bg-green-500',
                          'Behind': 'bg-red-500',
                          'Complete': 'bg-blue-500',
                          'Cancelled': 'bg-gray-500',
                      }
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <div className="flex items-center gap-2 w-28">
                            <div className={`h-3 w-3 rounded-full ${colors[status as keyof typeof colors]}`} />
                            <span className="text-sm font-medium">{status}</span>
                          </div>
                          <Progress value={percentage} className="flex-1 h-2" />
                          <span className="text-sm text-muted-foreground w-16 text-right">
                            {count} ({Math.round(percentage)}%)
                          </span>
                        </div>
                      )
                    })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Goals List with Filters */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Employee Goals</CardTitle>
                      <CardDescription>Track and manage employee goals and progress</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {selectedGoals.size > 0 && (
                        <Button 
                          variant="destructive" 
                          onClick={handleDeleteSelectedGoals}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete ({selectedGoals.size})
                        </Button>
                      )}
                      <Button onClick={() => setIsAddGoalDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Goal
                      </Button>
                    </div>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search goals or employees..."
                        value={goalSearchQuery}
                        onChange={(e) => setGoalSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select value={goalDeptFilter} onValueChange={setGoalDeptFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {Array.from(new Set(employees.map(e => e.department))).map(dept => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={goalCategoryFilter} onValueChange={setGoalCategoryFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {Array.from(new Set(goals.map(g => g.category))).map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={goalStatusFilter} onValueChange={setGoalStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[150px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="On Track">On Track</SelectItem>
                        <SelectItem value="Behind">Behind</SelectItem>
                        <SelectItem value="Complete">Complete</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={goalSort} onValueChange={(value: any) => setGoalSort(value)}>
                      <SelectTrigger className="w-full sm:w-[150px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dueDate">Sort by Due Date</SelectItem>
                        <SelectItem value="progress">Sort by Progress</SelectItem>
                        <SelectItem value="name">Sort by Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    // Apply filters
                    let filteredGoals = goals.filter(goal => {
                      const matchesSearch = !goalSearchQuery || 
                        goal.goal?.toLowerCase().includes(goalSearchQuery.toLowerCase()) ||
                        goal.employee?.name?.toLowerCase().includes(goalSearchQuery.toLowerCase())
                      const matchesDept = goalDeptFilter === "all" || 
                        goal.employee?.department === goalDeptFilter
                      const matchesCategory = goalCategoryFilter === "all" || 
                        goal.category === goalCategoryFilter
                      const matchesStatus = goalStatusFilter === "all" || 
                        goal.status === goalStatusFilter
                      
                      return matchesSearch && matchesDept && matchesCategory && matchesStatus
                    })

                    // Apply sorting
                    filteredGoals = filteredGoals.sort((a, b) => {
                      if (goalSort === "progress") {
                        return b.progress - a.progress
                      } else if (goalSort === "name") {
                        return (a.employee?.name || '').localeCompare(b.employee?.name || '')
                      } else {
                        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
                      }
                    })

                    if (filteredGoals.length === 0) {
                      return (
                        <div className="text-center py-12">
                          <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                          <p className="text-lg font-medium mb-1">No goals found</p>
                          <p className="text-sm text-muted-foreground">
                            {goalSearchQuery || goalDeptFilter !== "all" || goalCategoryFilter !== "all" || goalStatusFilter !== "all"
                              ? "Try adjusting your filters"
                              : "Get started by adding an employee goal"}
                          </p>
                        </div>
                      )
                    }

                    return filteredGoals.map((goal) => {
                      const isSelected = selectedGoals.has(goal.id)
                      return (
                      <div key={goal.id} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedGoals)
                              if (checked) {
                                newSelected.add(goal.id)
                              } else {
                                newSelected.delete(goal.id)
                              }
                              setSelectedGoals(newSelected)
                            }}
                            className="mr-3 mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="font-semibold">{goal.goal}</h3>
                              <Badge className={getGoalStatusColor(goal.status)}>
                                {getGoalStatusIcon(goal.status)}
                                <span className="ml-1">{goal.status}</span>
                              </Badge>
                              <Badge variant="outline" className="capitalize">
                                {goal.category}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                              <span className="font-medium">{goal.employee?.name || 'Unknown'}</span>
                              <span>•</span>
                              <span>{goal.employee?.department || 'N/A'}</span>
                              <span>•</span>
                              <span>{goal.employee?.position || 'N/A'}</span>
                            </div>
                            {goal.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                                {goal.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-2xl font-bold">{goal.progress}%</div>
                            <p className="text-xs text-muted-foreground">Progress</p>
                          </div>
                        </div>

                        <div className="mb-3">
                          <Progress value={goal.progress} className="h-2" />
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                          <span className={`flex items-center gap-1 ${
                            new Date(goal.due_date) < new Date() && goal.status !== 'Complete' 
                              ? 'text-red-500 font-medium' 
                              : ''
                          }`}>
                            <Calendar className="h-3 w-3" />
                            Due: {new Date(goal.due_date).toLocaleDateString()} ({getDaysUntilDue(goal.due_date)})
                          </span>
                          <span>Created: {new Date(goal.created_date).toLocaleDateString()}</span>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setEditingGoal(goal.id)
                              setGoalProgress(goal.progress)
                            }}
                          >
                            <Activity className="mr-1 h-3 w-3" />
                            Update Progress
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedGoal(goal)
                              setGoalComment('')
                              setIsAddCommentOpen(true)
                            }}
                          >
                            <MessageSquare className="mr-1 h-3 w-3" />
                            Add Comment
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedGoal(goal)
                              setIsGoalDetailsOpen(true)
                            }}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            View Details
                          </Button>
                        </div>
                      </div>
                      )
                    })
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Update Progress Dialog */}
            <Dialog open={editingGoal !== null} onOpenChange={(open) => !open && setEditingGoal(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update Goal Progress</DialogTitle>
                  <DialogDescription>
                    {editingGoal && goals.find(g => g.id === editingGoal)?.goal}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="progress">Progress</Label>
                      <span className="text-2xl font-bold text-primary">{goalProgress}%</span>
                    </div>
                    <Slider
                      id="progress"
                      value={[goalProgress]}
                      onValueChange={(value) => setGoalProgress(value[0])}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span>25%</span>
                      <span>50%</span>
                      <span>75%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Progress Bar Preview */}
                  <div className="space-y-2">
                    <Label>Progress Preview</Label>
                    <Progress value={goalProgress} className="h-3" />
                  </div>

                  {/* Status Based on Progress */}
                  <div className="p-3 bg-accent rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">New Status:</span>
                      {goalProgress === 100 ? (
                        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      ) : goalProgress >= 70 ? (
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          On Track
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Needs Attention
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingGoal(null)}>
                    Cancel
                  </Button>
                  <Button onClick={() => {
                    if (editingGoal) {
                      hrApi.updateGoal(editingGoal, { progress: goalProgress }).then(() => {
                        loadData()
                        setEditingGoal(null)
                      })
                    }
                  }}>
                    Save Progress
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="space-y-6">
              {/* Analytics Overview - one rectangle with date filter + 4 metrics */}
              {(() => {
                const { filteredReviews, filteredGoals, filteredEmployees } = analyticsFiltered
                const totalEmployees = analyticsDateRange === "all" ? stats.totalEmployees : filteredEmployees.length
                const inactiveInPeriod = filteredEmployees.filter(e => e.status === 'Inactive').length
                const completeGoalsInPeriod = filteredGoals.filter(g => g.status === 'Complete').length
                const totalGoalsInPeriod = filteredGoals.length
                return (
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <CardTitle>Katana HR Analytics</CardTitle>
                          <CardDescription>Comprehensive workforce insights and metrics</CardDescription>
                        </div>
                        <Select value={analyticsDateRange} onValueChange={setAnalyticsDateRange}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Date Range" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">Last 7 Days</SelectItem>
                            <SelectItem value="30">Last 30 Days</SelectItem>
                            <SelectItem value="90">Last 90 Days</SelectItem>
                            <SelectItem value="365">Last Year</SelectItem>
                            <SelectItem value="all">All Time</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="flex items-center gap-4">
                          <Users className="h-8 w-8 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {analyticsDateRange === "all" ? "Total Headcount" : "New Hires"}
                            </p>
                            <p className="text-2xl font-bold">{totalEmployees}</p>
                            <p className="text-xs text-muted-foreground">
                              {analyticsDateRange === "all" ? "Active employees" : `Hired in ${analyticsDateRange} days`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <TrendingDown className="h-8 w-8 text-green-500 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {analyticsDateRange === "all" ? "Turnover Rate" : "Turnover (Period)"}
                            </p>
                            <p className="text-2xl font-bold">
                              {totalEmployees > 0 && inactiveInPeriod > 0 
                                ? `${((inactiveInPeriod / totalEmployees) * 100).toFixed(1)}%`
                                : '0%'
                              }
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {inactiveInPeriod === 0 ? 'No turnover' : `${inactiveInPeriod} inactive`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Reviews</p>
                            <p className="text-2xl font-bold">{filteredReviews.length}</p>
                            <p className="text-xs text-muted-foreground">
                              {analyticsDateRange === "all" ? "Total reviews" : "Reviews in period"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Target className="h-8 w-8 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Goal Completion</p>
                            <p className="text-2xl font-bold">
                              {totalGoalsInPeriod > 0 
                                ? `${Math.round((completeGoalsInPeriod / totalGoalsInPeriod) * 100)}%`
                                : '0%'
                              }
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {completeGoalsInPeriod} of {totalGoalsInPeriod} goals completed
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Department & Performance Overview */}
              {(() => {
                const { filteredReviews, employeesToUse } = analyticsFiltered
                return (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <CardTitle>Department & Performance Overview</CardTitle>
                      </div>
                      <CardDescription>
                        {analyticsDateRange === "all" 
                          ? "Headcount by department and performance ratings by team"
                          : `Department and performance metrics for the last ${analyticsDateRange} days`
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-sm font-semibold mb-3">
                            {analyticsDateRange === "all" ? "Department Distribution" : "New Hires by Department"}
                          </h3>
                          <div className="space-y-3">
                            {(() => {
                              const deptCounts = employeesToUse.reduce((acc, emp) => {
                                const dept = emp.department || 'Unknown'
                                acc[dept] = (acc[dept] || 0) + 1
                                return acc
                              }, {} as Record<string, number>)
                          
                          const total = employeesToUse.length
                          const entries = Object.entries(deptCounts)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                          
                          if (entries.length === 0) {
                            return (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No department data available
                              </p>
                            )
                          }
                          
                          return entries.map(([dept, count]) => {
                            const percentage = total > 0 ? (count / total) * 100 : 0
                            return (
                              <div key={dept} className="group">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm">{dept}</span>
                                  <span className="text-sm font-medium">{count} ({Math.round(percentage)}%)</span>
                                </div>
                                <Progress value={percentage} className="h-2 transition-[width] duration-300" />
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold mb-3">Performance by Department</h3>
                      <div className="space-y-4">
                        {(() => {
                          const deptPerformance = filteredReviews.reduce((acc, review) => {
                            const dept = review.employee?.department || 'Unknown'
                            if (!acc[dept]) {
                              acc[dept] = { total: 0, count: 0 }
                            }
                            const overall = Number(calculateOverallRating(review))
                            acc[dept].total += overall
                            acc[dept].count += 1
                            return acc
                          }, {} as Record<string, { total: number; count: number }>)
                          
                          const entries = Object.entries(deptPerformance)
                            .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))
                            .slice(0, 4)
                          
                          if (entries.length === 0) {
                            return (
                              <div className="p-3 border rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm">Average Performance</span>
                                  <span className="text-lg font-bold text-muted-foreground">N/A</span>
                                </div>
                                <Progress value={0} className="h-2" />
                                <p className="text-xs text-muted-foreground mt-2">No performance data available</p>
                              </div>
                            )
                          }
                          
                          return entries.map(([dept, { total, count }]) => {
                            const avg = total / count
                            const percentage = (avg / 5) * 100
                            return (
                              <div key={dept} className="p-3 border rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm">{dept}</span>
                                  <span className={`text-lg font-bold ${getRatingColor(avg)}`}>
                                    {avg.toFixed(1)}/5
                                  </span>
                                </div>
                                <Progress value={percentage} className="h-2" />
                                <p className="text-xs text-muted-foreground mt-1">{count} reviews</p>
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
                )
              })()}

              {/* Recruitment Analytics */}
              {(() => {
                const { filteredApplications } = analyticsFiltered
                const periodStats = {
                  total: filteredApplications.length,
                  new: filteredApplications.filter(app => app.status === 'new').length,
                  reviewing: filteredApplications.filter(app => app.status === 'reviewing').length,
                  interviewed: filteredApplications.filter(app => app.status === 'interviewed' || app.status === 'interview-scheduled').length,
                  offers: filteredApplications.filter(app => app.status === 'offer').length,
                }
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Recruitment Analytics</CardTitle>
                      <CardDescription>
                        {analyticsDateRange === "all" 
                          ? "Hiring trends and source effectiveness"
                          : `Applications received in the last ${analyticsDateRange} days`
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="p-3 border rounded-lg text-center transition-colors duration-200 hover:bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-1">Total Applications</p>
                            <p className="text-2xl font-bold">{periodStats.total}</p>
                          </div>
                          <div className="p-3 border rounded-lg text-center transition-colors duration-200 hover:bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-1">New</p>
                            <p className="text-2xl font-bold text-blue-500">{periodStats.new}</p>
                          </div>
                          <div className="p-3 border rounded-lg text-center transition-colors duration-200 hover:bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-1">Reviewing</p>
                            <p className="text-2xl font-bold text-yellow-500">{periodStats.reviewing}</p>
                          </div>
                          <div className="p-3 border rounded-lg text-center transition-colors duration-200 hover:bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-1">Interviewed</p>
                            <p className="text-2xl font-bold text-purple-500">{periodStats.interviewed}</p>
                          </div>
                          <div className="p-3 border rounded-lg text-center transition-colors duration-200 hover:bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-1">Offers</p>
                            <p className="text-2xl font-bold text-green-500">{periodStats.offers}</p>
                          </div>
                        </div>

                        {/* Application Status Distribution */}
                        <div>
                          <h3 className="text-sm font-semibold mb-3">Application Status Distribution</h3>
                          {filteredApplications.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No application data available</p>
                          <p className="text-xs mt-1">Data will appear here as applications are received</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(() => {
                            const statusCounts = filteredApplications.reduce((acc, app) => {
                              const status = app.status || 'unknown'
                              acc[status] = (acc[status] || 0) + 1
                              return acc
                            }, {} as Record<string, number>)
                            
                            const total = filteredApplications.length
                            const statusLabels: Record<string, string> = {
                              'new': 'New',
                              'reviewing': 'Reviewing',
                              'interview-scheduled': 'Interview Scheduled',
                              'interviewed': 'Interviewed',
                              'offer': 'Offer',
                              'accepted': 'Accepted',
                              'rejected': 'Rejected',
                            }
                            
                            return Object.entries(statusCounts)
                              .sort((a, b) => (b[1] as number) - (a[1] as number))
                              .map(([status, count]) => {
                                const countNum = count as number
                                const percentage = total > 0 ? (countNum / total) * 100 : 0
                                const label = statusLabels[status] || status
                                return (
                                  <div key={status}>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-sm capitalize">{label}</span>
                                      <span className="text-sm font-medium">{countNum} ({Math.round(percentage)}%)</span>
                                    </div>
                                    <Progress value={percentage} className="h-2 transition-[width] duration-300" />
                                  </div>
                                )
                              })
                          })()}
                        </div>
                      )}
                    </div>

                        {/* Application Sources */}
                        <div>
                          <h3 className="text-sm font-semibold mb-3">Application Sources</h3>
                          {filteredApplications.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No application source data available</p>
                              <p className="text-xs mt-1">Data will appear here as applications are received</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {(() => {
                                const sourceCounts = filteredApplications.reduce((acc, app) => {
                              const source = app.source || 'Direct'
                              acc[source] = (acc[source] || 0) + 1
                              return acc
                            }, {} as Record<string, number>)
                            
                            const total = filteredApplications.length
                            
                            return Object.entries(sourceCounts)
                              .sort((a, b) => (b[1] as number) - (a[1] as number))
                              .map(([source, count]) => {
                                const countNum = count as number
                                const percentage = total > 0 ? (countNum / total) * 100 : 0
                                return (
                                  <div key={source} className="p-3 border rounded-lg text-center">
                                    <p className="text-xs text-muted-foreground mb-1">{source}</p>
                                    <p className="text-2xl font-bold">{countNum}</p>
                                    <p className="text-xs text-muted-foreground">{Math.round(percentage)}%</p>
                                  </div>
                                )
                              })
                          })()}
                        </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Performance Analytics */}
              {(() => {
                const { filteredReviews } = analyticsFiltered
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Analytics</CardTitle>
                      <CardDescription>Employee performance trends and department comparisons</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-semibold mb-3">Average Performance Score by Department</h3>
                        {filteredReviews.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No performance data available</p>
                            <p className="text-xs mt-1">Department performance will appear here as reviews are completed</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {(() => {
                              const deptScores = filteredReviews.reduce((acc, review) => {
                              const dept = review.employee?.department || 'Unknown'
                              if (!acc[dept]) {
                                acc[dept] = { total: 0, count: 0 }
                              }
                              const overall = Number(calculateOverallRating(review))
                              acc[dept].total += overall
                              acc[dept].count += 1
                              return acc
                            }, {} as Record<string, { total: number; count: number }>)
                            
                            return Object.entries(deptScores)
                              .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))
                              .map(([dept, { total, count }]) => {
                                const avg = total / count
                                const percentage = (avg / 5) * 100
                                return (
                                  <div key={dept} className="flex items-center gap-3">
                                    <div className="w-40 text-sm font-medium truncate" title={dept}>
                                      {dept}
                                    </div>
                                    <Progress value={percentage} className="flex-1 h-2 transition-[width] duration-300" />
                                    <span className={`text-sm font-semibold w-16 text-right ${getRatingColor(avg)}`}>
                                      {avg.toFixed(1)}/5
                                    </span>
                                    <span className="text-xs text-muted-foreground w-12">
                                      ({count} reviews)
                                    </span>
                                  </div>
                                )
                              })
                          })()}
                        </div>
                      )}
                    </div>

                        {/* Review Statistics */}
                        {(() => {
                          const avgScore = filteredReviews.length > 0
                            ? filteredReviews.reduce((sum, r) => sum + Number(calculateOverallRating(r)), 0) / filteredReviews.length
                            : 0
                          
                          return (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">Total Reviews</p>
                                <p className="text-2xl font-bold">{filteredReviews.length}</p>
                              </div>
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">Avg Score</p>
                                <p className={`text-2xl font-bold ${getRatingColor(avgScore)}`}>
                                  {avgScore > 0 ? avgScore.toFixed(1) : '0.0'}/5
                                </p>
                              </div>
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">On Time</p>
                                <p className="text-2xl font-bold text-green-500">
                                  {filteredReviews.filter(r => r.status === 'on-time').length}
                                </p>
                              </div>
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">Overdue</p>
                                <p className="text-2xl font-bold text-red-500">
                                  {filteredReviews.filter(r => r.status === 'overdue').length}
                                </p>
                              </div>
                            </div>
                          )
                        })()}

                        {/* Performance Trends */}
                        <div>
                          <h3 className="text-sm font-semibold mb-3">Performance Trends</h3>
                          {filteredReviews.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No performance trend data available</p>
                              <p className="text-xs mt-1">Performance trends will appear here as review data accumulates</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-4">
                              <div className="p-3 border rounded-lg text-center">
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <TrendingUp className="h-4 w-4 text-green-500" />
                                  <p className="text-xs text-muted-foreground">Improving</p>
                                </div>
                                <p className="text-2xl font-bold text-green-500">
                                  {filteredReviews.filter(r => r.trend === 'up').length}
                                </p>
                              </div>
                              <div className="p-3 border rounded-lg text-center">
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <Minus className="h-4 w-4 text-gray-500" />
                                  <p className="text-xs text-muted-foreground">Stable</p>
                                </div>
                                <p className="text-2xl font-bold text-gray-500">
                                  {filteredReviews.filter(r => r.trend === 'stable').length}
                                </p>
                              </div>
                              <div className="p-3 border rounded-lg text-center">
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <TrendingDown className="h-4 w-4 text-red-500" />
                                  <p className="text-xs text-muted-foreground">Declining</p>
                                </div>
                                <p className="text-2xl font-bold text-red-500">
                                  {filteredReviews.filter(r => r.trend === 'down').length}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Employee Analytics */}
              {(() => {
                const { filteredEmployees, filteredGoals, employeesToUse } = analyticsFiltered
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Employee Analytics</CardTitle>
                      <CardDescription>Workforce composition and engagement metrics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                      {/* Headcount by Department */}
                      <div>
                        <h3 className="text-sm font-semibold mb-3">
                          {analyticsDateRange === "all" ? "Headcount by Department" : "New Hires by Department"}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {new Set(employeesToUse.map(e => e.department)).size > 0 ? (
                            Array.from(new Set(employeesToUse.map(e => e.department))).map(dept => {
                              const deptCount = employeesToUse.filter(e => e.department === dept).length;
                              const percentage = ((deptCount / employeesToUse.length) * 100).toFixed(0);
                            return (
                              <div key={dept} className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">{dept}</p>
                                <p className="text-2xl font-bold">{deptCount}</p>
                                <p className="text-xs text-muted-foreground">{percentage}%</p>
                              </div>
                            );
                          })
                        ) : (
                          <div className="col-span-full text-center py-8 text-muted-foreground">
                            <Building className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No department data available</p>
                            <p className="text-xs mt-1">Department breakdown will appear here as employees are added</p>
                          </div>
                        )}
                      </div>

                      {/* Tenure Distribution */}
                      <div>
                        <h3 className="text-sm font-semibold mb-3">Tenure Distribution</h3>
                        {employeesToUse.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No tenure data available</p>
                            <p className="text-xs mt-1">Tenure distribution will appear here as employees are added</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {(() => {
                              const tenureBuckets = {
                                '< 1 year': 0,
                                '1-2 years': 0,
                                '2-5 years': 0,
                                '5-10 years': 0,
                                '10+ years': 0,
                              }
                              
                              employeesToUse.forEach(emp => {
                              const years = (new Date().getTime() - new Date(emp.hire_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
                              if (years < 1) tenureBuckets['< 1 year']++
                              else if (years < 2) tenureBuckets['1-2 years']++
                              else if (years < 5) tenureBuckets['2-5 years']++
                              else if (years < 10) tenureBuckets['5-10 years']++
                              else tenureBuckets['10+ years']++
                            })
                            
                            const total = employeesToUse.length
                            
                            return Object.entries(tenureBuckets).map(([bucket, count]) => {
                              const percentage = total > 0 ? (count / total) * 100 : 0
                              return (
                                <div key={bucket}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm">{bucket}</span>
                                    <span className="text-sm font-medium">{count} ({Math.round(percentage)}%)</span>
                                  </div>
                                  <Progress value={percentage} className="h-2" />
                                </div>
                              )
                            })
                          })()}
                        </div>
                      )}
                    </div>

                        {/* Engagement Metrics */}
                        {(() => {
                          const { filteredReviews, filteredGoals } = analyticsFiltered
                          const completeGoalsInPeriod = filteredGoals.filter(g => g.status === 'Complete').length
                          const totalGoalsInPeriod = filteredGoals.length
                          const avgPerformance = filteredReviews.length > 0
                            ? filteredReviews.reduce((sum, r) => sum + Number(calculateOverallRating(r)), 0) / filteredReviews.length
                            : 0
                          
                          return (
                            <div>
                              <h3 className="text-sm font-semibold mb-3">Engagement Metrics</h3>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="p-3 border rounded-lg">
                                  <p className="text-xs text-muted-foreground mb-1">Goal Completion</p>
                                  <p className="text-2xl font-bold text-green-500">
                                    {totalGoalsInPeriod > 0 ? `${Math.round((completeGoalsInPeriod / totalGoalsInPeriod) * 100)}%` : '0%'}
                                  </p>
                                </div>
                                <div className="p-3 border rounded-lg">
                                  <p className="text-xs text-muted-foreground mb-1">Avg Performance</p>
                                  <p className={`text-2xl font-bold ${getRatingColor(avgPerformance)}`}>
                                    {avgPerformance > 0 ? avgPerformance.toFixed(1) : 'N/A'}
                                  </p>
                                </div>
                                <div className="p-3 border rounded-lg">
                                  <p className="text-xs text-muted-foreground mb-1">Learning Paths</p>
                                  <p className="text-2xl font-bold">{learningPaths.length}</p>
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Export Options */}
              <div className="flex justify-end gap-2">
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Report
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="development">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div>
                    <CardTitle>Development Studio</CardTitle>
                    <CardDescription>Career paths, mentorship, learning, and recognition in one place</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={developmentSection} onValueChange={(v) => setDevelopmentSection(v as typeof developmentSection)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1 p-1 bg-muted/50 mb-4">
                    <TabsTrigger value="career" className="text-xs sm:text-sm py-2.5 gap-1.5">
                      <Rocket className="h-4 w-4 shrink-0" />
                      Career Paths
                    </TabsTrigger>
                    <TabsTrigger value="mentorship" className="text-xs sm:text-sm py-2.5 gap-1.5">
                      <Users className="h-4 w-4 shrink-0" />
                      Mentorship
                    </TabsTrigger>
                    <TabsTrigger value="learning" className="text-xs sm:text-sm py-2.5 gap-1.5">
                      <GraduationCap className="h-4 w-4 shrink-0" />
                      Learning
                    </TabsTrigger>
                    <TabsTrigger value="recognition" className="text-xs sm:text-sm py-2.5 gap-1.5">
                      <Award className="h-4 w-4 shrink-0" />
                      Recognition
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="career" className="mt-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 px-6">
                          <p className="text-sm text-muted-foreground">Employee career progression and development tracking</p>
                          <div className="flex gap-2">
                            {selectedCareerPaths.size > 0 && (
                              <Button variant="destructive" size="sm" onClick={handleDeleteSelectedCareerPaths}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete ({selectedCareerPaths.size})
                              </Button>
                            )}
                            <Button onClick={() => setIsAddCareerPathDialogOpen(true)} size="sm">
                              <Plus className="mr-2 h-4 w-4" />
                              Add Career Path
                            </Button>
                          </div>
                        </div>
                        {careerPaths.length === 0 ? (
                    <div className="text-center py-12 px-6">
                      <Rocket className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-lg font-medium mb-1">No career paths defined</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Career paths will appear here as employees are assigned development plans
                      </p>
                      <Button onClick={() => setIsAddCareerPathDialogOpen(true)} variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Your First Career Path
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 px-6">
                      {careerPaths.map((path) => {
                        const isSelected = selectedCareerPaths.has(path.id)
                        return (
                      <div key={path.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedCareerPaths)
                              if (checked) {
                                newSelected.add(path.id)
                              } else {
                                newSelected.delete(path.id)
                              }
                              setSelectedCareerPaths(newSelected)
                            }}
                            className="mr-3 mt-1"
                          />
                          <div>
                            <h3 className="font-semibold text-sm mb-1">{path.employee?.name || 'Unknown'}</h3>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>{path.current_role_name}</span>
                              <ArrowRight className="h-3 w-3" />
                              <span className="font-medium text-foreground">{path.next_role}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">{path.time_to_promotion}</Badge>
                        </div>

                        <div className="mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">Promotion Readiness</span>
                            <span className="text-xs font-bold">{path.readiness}%</span>
                          </div>
                          <Progress value={Math.max(0, Math.min(100, path.readiness || 0))} className="h-1.5" />
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Required Skills:</p>
                          <div className="flex flex-wrap gap-2">
                            {Array.isArray(path.required_skills) && path.required_skills.length > 0 ? (
                              path.required_skills.map((skill, idx) => (
                                <Badge key={idx} variant="secondary">
                                  {skill}
                                </Badge>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No skills specified</p>
                            )}
                          </div>
                        </div>
                      </div>
                        )
                      })}
                    </div>
                  )}
                        </TabsContent>

                        <TabsContent value="mentorship" className="mt-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 px-6">
                          <p className="text-sm text-muted-foreground">Katana-powered mentor-mentee matching</p>
                          <div className="flex gap-2">
                            {selectedMentorships.size > 0 && (
                              <Button variant="destructive" size="sm" onClick={handleDeleteSelectedMentorships}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete ({selectedMentorships.size})
                              </Button>
                            )}
                            <Button onClick={() => setIsCreateMatchOpen(true)}>
                              <Plus className="mr-2 h-4 w-4" />
                              Create Match
                            </Button>
                          </div>
                        </div>
                  {mentorships.length === 0 ? (
                    <div className="text-center py-12 px-6">
                      <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-lg font-medium mb-1">No mentorship matches yet</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create mentorship matches to connect mentors with mentees
                      </p>
                      <Button onClick={() => setIsCreateMatchOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Your First Match
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {mentorships.map((match) => {
                        const isSelected = selectedMentorships.has(match.id)
                        return (
                      <div key={match.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedMentorships)
                              if (checked) {
                                newSelected.add(match.id)
                              } else {
                                newSelected.delete(match.id)
                              }
                              setSelectedMentorships(newSelected)
                            }}
                            className="mr-3 mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <h4 className="font-semibold text-sm">{match.mentor?.name || 'Unknown'}</h4>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <h4 className="font-semibold text-sm">{match.mentee?.name || 'Unknown'}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground">Focus: {match.focus}</p>
                          </div>
                          <div className="text-right ml-2">
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Sparkles className="h-3 w-3" />
                              {match.match_score}%
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Started: {match.start_date ? new Date(match.start_date).toLocaleDateString() : 'N/A'}</span>
                          <Badge variant="secondary" className="text-xs">{match.status}</Badge>
                        </div>
                      </div>
                        )
                      })}
                    </div>
                  )}
                        </TabsContent>

                        <TabsContent value="learning" className="mt-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 px-6">
                          <p className="text-sm text-muted-foreground">Training programs and skill development tracking</p>
                          <div className="flex gap-2">
                            {selectedLearningPaths.size > 0 && (
                              <Button variant="destructive" size="sm" onClick={handleDeleteSelectedLearningPaths}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete ({selectedLearningPaths.size})
                              </Button>
                            )}
                            <Button onClick={() => setIsAddLearningPathDialogOpen(true)} size="sm">
                              <Plus className="mr-2 h-4 w-4" />
                              Add Learning Path
                            </Button>
                          </div>
                        </div>
                  {learningPaths.length === 0 ? (
                    <div className="text-center py-12 px-6">
                      <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-lg font-medium mb-1">No learning paths assigned</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Learning paths will appear here as training programs are assigned to employees
                      </p>
                      <Button onClick={() => setIsAddLearningPathDialogOpen(true)} variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Assign Your First Learning Path
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 px-6">
                      {learningPaths.map((learning) => {
                        const isSelected = selectedLearningPaths.has(learning.id)
                        return (
                      <div key={learning.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedLearningPaths)
                              if (checked) {
                                newSelected.add(learning.id)
                              } else {
                                newSelected.delete(learning.id)
                              }
                              setSelectedLearningPaths(newSelected)
                            }}
                            className="mr-3 mt-1"
                          />
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm mb-0.5">{learning.employee?.name || 'Unknown'}</h4>
                            <p className="text-xs text-muted-foreground">{learning.course}</p>
                          </div>
                          <Badge variant={learning.status === "completed" ? "secondary" : "default"} className="text-xs">
                            {learning.status === "completed" ? (
                              <>
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Done
                              </>
                            ) : (
                              "In Progress"
                            )}
                          </Badge>
                        </div>
                        <div className="mb-1.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs">Progress</span>
                            <span className="text-xs font-bold">{learning.progress}%</span>
                          </div>
                          <Progress value={Math.max(0, Math.min(100, learning.progress || 0))} className="h-1.5" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Due: {learning.due_date ? new Date(learning.due_date).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                        )
                      })}
                    </div>
                  )}
                        </TabsContent>

                        <TabsContent value="recognition" className="mt-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 px-6">
                          <p className="text-sm text-muted-foreground">Peer and manager recognition tracking</p>
                          <div className="flex gap-2">
                            {selectedRecognitions.size > 0 && (
                              <Button variant="destructive" size="sm" onClick={handleDeleteSelectedRecognitions}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete ({selectedRecognitions.size})
                              </Button>
                            )}
                            <Button onClick={() => setIsGiveRecognitionOpen(true)}>
                              <Plus className="mr-2 h-4 w-4" />
                              Give Recognition
                            </Button>
                          </div>
                        </div>
                  {recognitions.length === 0 ? (
                    <div className="text-center py-12 px-6">
                      <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-lg font-medium mb-1">No recognitions yet</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Recognize team members for their contributions and achievements
                      </p>
                      <Button onClick={() => setIsGiveRecognitionOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Give Your First Recognition
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 px-6">
                      {recognitions.map((recognition) => {
                        const isSelected = selectedRecognitions.has(recognition.id)
                        return (
                      <div key={recognition.id} className="p-3 border rounded-lg bg-accent/30">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedRecognitions)
                              if (checked) {
                                newSelected.add(recognition.id)
                              } else {
                                newSelected.delete(recognition.id)
                              }
                              setSelectedRecognitions(newSelected)
                            }}
                            className="mr-2 mt-1"
                          />
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <ThumbsUp className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="font-semibold text-sm">{recognition.from_name}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="font-semibold text-sm">{recognition.to_name}</span>
                              <Badge variant="outline" className="text-xs">{recognition.category}</Badge>
                            </div>
                            <p className="text-xs mb-1.5 line-clamp-2">{recognition.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {recognition.recognition_date ? new Date(recognition.recognition_date).toLocaleDateString() : 'N/A'} • {recognition.type}
                            </p>
                          </div>
                        </div>
                      </div>
                        )
                      })}
                    </div>
                  )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* Employee Profile Dialog */}
        <Dialog open={isProfileDialogOpen} onOpenChange={(open) => {
          setIsProfileDialogOpen(open)
          if (!open) setEmployeeInviteCode(null)
          else if (selectedEmployee) setEditableModuleAccess(Array.isArray(selectedEmployee.module_access) ? [...selectedEmployee.module_access] : [])
        }}>
          <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col p-6">
            <DialogHeader className="pb-4 border-b flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-2xl mb-2 truncate">{selectedEmployee?.name}</DialogTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedEmployee && <Badge variant={getStatusVariant(selectedEmployee.status)}>{selectedEmployee.status}</Badge>}
                    {selectedEmployee && selectedEmployee.performance_score && selectedEmployee.performance_score >= 4.5 && (
                      <Badge variant="outline" className="border-yellow-500 text-yellow-500 bg-yellow-500/10">
                        <Star className="h-4 w-4 fill-yellow-500 mr-1" />
                        Top Performer
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button className="mx-0 my-3.5 bg-transparent" variant="outline" size="sm">
                    <Mail className="w-4 h-4" />
                  </Button>
                  <Button className="my-3.5 bg-transparent" variant="outline" size="sm">
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button className="my-3.5" size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </DialogHeader>

            {selectedEmployee && (
              <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col mt-2">
                <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 flex-shrink-0 mb-2">
                  <TabsTrigger
                    value="overview"
                    className="border-b-2 border-transparent data-[state=active]:border-primary text-base rounded-lg px-4"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="performance"
                    className="border-b-2 border-transparent data-[state=active]:border-primary text-base rounded-lg px-4"
                  >
                    Performance
                  </TabsTrigger>
                  <TabsTrigger
                    value="goals"
                    className="border-b-2 border-transparent data-[state=active]:border-primary text-base rounded-lg px-4"
                  >
                    Goals
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="border-b-2 border-transparent data-[state=active]:border-primary text-base rounded-lg px-4"
                  >
                    History
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-y-auto overflow-x-hidden pt-2 px-1">

                  <TabsContent value="overview" className="mt-0 space-y-5">
                    {/* Invite to Katana - at top so code is visible after generating */}
                    <Card className="overflow-hidden border-primary/30 bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Ticket className="w-5 h-5 text-primary" />
                          Invite to Katana
                        </CardTitle>
                        <CardDescription>
                          Generate an invite code for this employee. They go to the app home page, click Have an invite?, enter the code, then create their account.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="px-6">
                        {!selectedEmployee.email?.trim() ? (
                          <p className="text-sm text-muted-foreground">Add an email for this employee first.</p>
                        ) : employeeInviteCode && (employeeInviteCode.email || '').toLowerCase() === (selectedEmployee.email || '').trim().toLowerCase() ? (
                          <div className="space-y-3">
                            <Label className="text-sm font-medium">Invite code (copy and give to the employee)</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                readOnly
                                value={employeeInviteCode.code || employeeInviteCode.inviteLink || '—'}
                                className="text-xl font-mono font-bold tracking-[0.2em] h-12 bg-background border-2 flex-1"
                              />
                              <Button
                                onClick={() => {
                                  const toCopy = employeeInviteCode.code || employeeInviteCode.inviteLink
                                  if (toCopy) {
                                    navigator.clipboard.writeText(toCopy)
                                    setInviteCodeCopied(true)
                                    toast({ title: 'Copied to clipboard' })
                                    setTimeout(() => setInviteCodeCopied(false), 2000)
                                  }
                                }}
                              >
                                {inviteCodeCopied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                                {inviteCodeCopied ? 'Copied' : 'Copy'}
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Share with <strong>{selectedEmployee.email}</strong>. They use this code on the home page at Have an invite?.
                            </p>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            onClick={async () => {
                              setInviteCodeLoading(true)
                              try {
                                const email = (selectedEmployee.email ?? '').trim()
                                if (!email) {
                                  sonnerToast.error('No email', { description: 'Add an email for this employee first.' })
                                  toast({ title: 'No email', description: 'Add an email for this employee first.', variant: 'destructive' })
                                  return
                                }
                                const result = await getOrCreateInviteForEmployee(email, 'member')
                                const code = result.code || ''
                                const link = result.inviteLink || ''
                                setEmployeeInviteCode({
                                  email: email.toLowerCase(),
                                  code,
                                  inviteLink: link,
                                })
                                sonnerToast.success('Invite code ready', {
                                  description: code ? `Code: ${code}` : link ? 'Link generated — use Copy below.' : 'Done. Use Copy below.',
                                  duration: 8000,
                                })
                                toast({
                                  title: 'Invite code ready',
                                  description: code ? `Code: ${code}` : link ? 'Link generated — use Copy below.' : 'Done. Use Copy below.',
                                  duration: 8000,
                                })
                              } catch (e: unknown) {
                                const msg = e instanceof Error ? e.message : String(e)
                                console.error('Generate invite failed:', e)
                                const hint = /migration|function.*does not exist|relation.*does not exist/i.test(msg)
                                  ? ' Run the invite-code migration in Supabase (supabase-invite-code-migration.sql) and try again.'
                                  : ''
                                sonnerToast.error('Failed to generate invite', { description: msg + hint, duration: 10000 })
                                toast({
                                  title: 'Failed to generate invite',
                                  description: msg + hint,
                                  variant: 'destructive',
                                  duration: 10000,
                                })
                              } finally {
                                setInviteCodeLoading(false)
                              }
                            }}
                            disabled={inviteCodeLoading}
                          >
                            {inviteCodeLoading ? 'Generating…' : 'Generate invite code'}
                          </Button>
                        )}
                      </CardContent>
                    </Card>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="min-w-0">
                        <CardContent className="pt-5 pb-5 text-center px-3">
                          <div className="text-2xl font-bold mb-1">
                            {selectedEmployee.performance_score ? `${selectedEmployee.performance_score}/5.0` : 'N/A'}
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-nowrap">Performance</p>
                        </CardContent>
                      </Card>
                      <Card className="min-w-0">
                        <CardContent className="pt-5 pb-5 text-center px-3">
                          <div className="text-2xl font-bold mb-1">
                            {goals.filter(g => g.employee_id === selectedEmployee.id && g.status === 'Complete').length}/
                            {goals.filter(g => g.employee_id === selectedEmployee.id).length}
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-nowrap">Goals</p>
                        </CardContent>
                      </Card>
                      <Card className="min-w-0">
                        <CardContent className="pt-5 pb-5 text-center px-3">
                          <div className="text-2xl font-bold mb-1 whitespace-nowrap">-</div>
                          <p className="text-sm text-muted-foreground whitespace-nowrap">Tenure</p>
                        </CardContent>
                      </Card>
                      <Card className="min-w-0">
                        <CardContent className="pt-5 pb-5 text-center px-3">
                          <div className="text-xl font-bold mb-1">{getDaysUntilReview(selectedEmployee.next_review_date)}</div>
                          <p className="text-sm text-muted-foreground whitespace-nowrap">Next Review</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Employee Details */}
                    <Card className="overflow-hidden">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Employee Information</CardTitle>
                      </CardHeader>
                      <CardContent className="px-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                          <div className="flex items-start gap-3 min-w-0">
                            <Building className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Department</p>
                              <p className="text-base font-medium break-words">{selectedEmployee.department}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 min-w-0">
                            <User className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Position</p>
                              <p className="text-base font-medium break-words">{selectedEmployee.position}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 min-w-0">
                            <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Employee ID</p>
                              <p className="text-base font-medium">EMP-{selectedEmployee.id.toString().padStart(4, '0')}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 min-w-0">
                            <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Employment Type</p>
                              <p className="text-base font-medium">Full-time</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 min-w-0">
                            <User className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Manager</p>
                              <p className="text-base font-medium break-words">{selectedEmployee.manager?.name || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 min-w-0">
                            <Building className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Location</p>
                              <p className="text-base font-medium break-words">-</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Contact Information */}
                    <Card className="overflow-hidden">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Contact Information</CardTitle>
                      </CardHeader>
                      <CardContent className="px-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                          <div className="flex items-start gap-3 min-w-0">
                            <Mail className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Email</p>
                              <p className="text-base font-medium break-all">{selectedEmployee.email || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 min-w-0">
                            <Phone className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Phone</p>
                              <p className="text-base font-medium">{selectedEmployee.phone || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Module access – which app modules this employee can open */}
                    <Card className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Module access</CardTitle>
                        <CardDescription>
                          Choose which modules this employee can see in the sidebar. They must sign in with the same email as above for this to apply.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="px-6">
                        <div className="flex flex-wrap gap-4 mb-4">
                          {MODULES.map((m) => (
                            <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={editableModuleAccess.includes(m.id)}
                                onCheckedChange={(checked) => {
                                  setEditableModuleAccess((prev) =>
                                    checked ? [...prev, m.id] : prev.filter((id) => id !== m.id)
                                  )
                                }}
                              />
                              <span className="text-sm">{m.label}</span>
                            </label>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          disabled={moduleAccessSaving}
                          onClick={async () => {
                            if (!selectedEmployee) return
                            setModuleAccessSaving(true)
                            try {
                              const updated = await hrApi.updateEmployee(selectedEmployee.id, {
                                module_access: editableModuleAccess,
                              })
                              if (updated) {
                                setEmployees((prev) =>
                                  prev.map((e) => (e.id === selectedEmployee.id ? { ...e, module_access: editableModuleAccess } : e))
                                )
                                setSelectedEmployee((prev) => (prev?.id === selectedEmployee.id ? { ...prev, module_access: editableModuleAccess } : prev))
                                sonnerToast.success('Module access saved')
                              } else {
                                sonnerToast.error('Failed to save module access')
                              }
                            } catch (e) {
                              sonnerToast.error('Failed to save module access')
                            } finally {
                              setModuleAccessSaving(false)
                            }
                          }}
                        >
                          {moduleAccessSaving ? 'Saving…' : 'Save module access'}
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="performance" className="mt-0 space-y-4">
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Performance Reviews</CardTitle>
                        <p className="text-sm text-muted-foreground">Historical performance data</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {performanceReviews
                          .filter(review => review.employee_id === selectedEmployee.id)
                          .length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No performance reviews yet</p>
                          </div>
                        ) : (
                          performanceReviews
                            .filter(review => review.employee_id === selectedEmployee.id)
                            .map((review) => (
                              <div key={review.id} className="p-4 border rounded-lg">
                                <div className="flex items-center justify-between mb-4">
                                  <div>
                                    <p className="text-base font-medium">Review Period: {review.review_period}</p>
                                    <p className="text-sm text-muted-foreground">{new Date(review.review_date).toLocaleDateString()}</p>
                                  </div>
                                  <Badge variant={review.status === 'on-time' ? 'default' : 'secondary'} className="text-sm flex-shrink-0">
                                    {review.status}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Collaboration</p>
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: review.collaboration }).map((_, i) => (
                                        <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Accountability</p>
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: review.accountability }).map((_, i) => (
                                        <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Leadership</p>
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: review.leadership }).map((_, i) => (
                                        <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Trustworthy</p>
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: review.trustworthy }).map((_, i) => (
                                        <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="goals" className="mt-0 space-y-4">
                    {goals
                      .filter(goal => goal.employee_id === selectedEmployee.id)
                      .length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No goals assigned yet</p>
                      </div>
                    ) : (
                      goals
                        .filter(goal => goal.employee_id === selectedEmployee.id)
                        .map((goal) => (
                          <Card key={goal.id}>
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-base truncate">{goal.goal}</CardTitle>
                                  <p className="text-sm text-muted-foreground mt-1 truncate">{goal.category}</p>
                                </div>
                                <Badge 
                                  variant="outline"
                                  className={`flex-shrink-0 text-sm ${
                                    goal.status === 'On Track' ? 'border-green-500 text-green-600 bg-green-500/10' :
                                    goal.status === 'Complete' ? 'border-blue-500 text-blue-600 bg-blue-500/10' :
                                    goal.status === 'Behind' ? 'border-red-500 text-red-600 bg-red-500/10' :
                                    ''
                                  }`}
                                >
                                  {goal.status}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm mb-2">
                                  <span className="text-muted-foreground">Progress</span>
                                  <span className="font-medium text-base">{goal.progress}%</span>
                                </div>
                                <Progress value={goal.progress} className="h-2" />
                                <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
                                  <span className="truncate">Due: {new Date(goal.due_date).toLocaleDateString()}</span>
                                  <span className="truncate">Created: {new Date(goal.created_date).toLocaleDateString()}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                    )}
                  </TabsContent>

                  <TabsContent value="history" className="mt-0 space-y-4">
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Review History</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between text-base">
                          <span className="text-muted-foreground">Last Review</span>
                          <span className="font-medium">{selectedEmployee.last_review_date ? new Date(selectedEmployee.last_review_date).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between text-base">
                          <span className="text-muted-foreground">Next Review</span>
                          <span className="font-medium">{selectedEmployee.next_review_date ? new Date(selectedEmployee.next_review_date).toLocaleDateString() : 'Not scheduled'}</span>
                        </div>
                        <div className="flex items-center justify-between text-base">
                          <span className="text-muted-foreground">Review Cycle</span>
                          <span className="font-medium">Quarterly</span>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Employee Feedback Dialog */}
        <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Give Feedback</DialogTitle>
              <DialogDescription>
                Provide feedback for {selectedEmployee?.name}
              </DialogDescription>
            </DialogHeader>
            {selectedEmployee && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="feedback-type">Feedback Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recognition">Recognition</SelectItem>
                      <SelectItem value="improvement">Area for Improvement</SelectItem>
                      <SelectItem value="general">General Feedback</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="feedback-message">Feedback Message</Label>
                  <Textarea 
                    id="feedback-message"
                    placeholder="Write your feedback here..."
                    rows={6}
                  />
                </div>
                <div>
                  <Label>Visibility</Label>
                  <Select defaultValue="manager">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Visible to Employee</SelectItem>
                      <SelectItem value="manager">Manager Only</SelectItem>
                      <SelectItem value="hr">HR Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsFeedbackDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => {
                    alert("Feedback submitted successfully!")
                    setIsFeedbackDialogOpen(false)
                  }}>
                    Submit Feedback
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Employee Goals Dialog */}
        <Dialog open={isGoalsDialogOpen} onOpenChange={setIsGoalsDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto border-4">
            <DialogHeader>
              <DialogTitle>Employee Goals</DialogTitle>
              <DialogDescription>
                View and manage goals for {selectedEmployee?.name}
              </DialogDescription>
            </DialogHeader>
            {selectedEmployee && (
              <div className="space-y-4">
                {goals
                  .filter(goal => goal.employee_id === selectedEmployee.id)
                  .length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No goals assigned yet</p>
                  </div>
                ) : (
                  goals
                    .filter(goal => goal.employee_id === selectedEmployee.id)
                    .map((goal) => (
                      <Card key={goal.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{goal.goal}</CardTitle>
                              <CardDescription className="mt-1">{goal.employee?.department || 'N/A'} • {goal.category}</CardDescription>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={
                                goal.status === 'On Track' ? 'border-green-500 text-green-600 bg-green-500/10' :
                                goal.status === 'Complete' ? 'border-blue-500 text-blue-600 bg-blue-500/10' :
                                goal.status === 'Behind' ? 'border-red-500 text-red-600 bg-red-500/10' :
                                ''
                              }
                            >
                              {goal.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">{goal.progress}%</span>
                            </div>
                            <Progress value={goal.progress} className="h-2" />
                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                              <span>
                                <Calendar className="inline h-3 w-3 mr-1" />
                                Due: {new Date(goal.due_date).toLocaleDateString()}
                              </span>
                              <span className="capitalize">{goal.category}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
                <DialogFooter className="pt-4">
                  <Button variant="outline" onClick={() => setIsGoalsDialogOpen(false)}>Close</Button>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Goal
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Review Details Dialog */}
        <Dialog open={isReviewDetailsOpen} onOpenChange={setIsReviewDetailsOpen}>
          <DialogContent className="max-w-3x1 max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Performance Review Details</DialogTitle>
              <DialogDescription>
                Detailed performance review for {selectedReview?.employee?.name || 'Unknown Employee'}
              </DialogDescription>
            </DialogHeader>
            {selectedReview && (
              <div className="space-y-6">
                {/* Employee Info */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">{selectedReview.employee?.name || 'Unknown Employee'}</h3>
                        <p className="text-sm text-muted-foreground">{selectedReview.employee?.department || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${getRatingColor(Number(calculateOverallRating(selectedReview)))}`}>
                          {calculateOverallRating(selectedReview)}
                        </div>
                        <p className="text-xs text-muted-foreground">Overall Rating</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Ratings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Performance Ratings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">Collaboration</p>
                        <div className="flex items-center gap-2">
                          <div className={`text-2xl font-bold ${getRatingColor(selectedReview.collaboration)}`}>
                            {selectedReview.collaboration}
                          </div>
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-4 h-4 ${i < selectedReview.collaboration ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">Accountability</p>
                        <div className="flex items-center gap-2">
                          <div className={`text-2xl font-bold ${getRatingColor(selectedReview.accountability)}`}>
                            {selectedReview.accountability}
                          </div>
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-4 h-4 ${i < selectedReview.accountability ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">Trustworthy</p>
                        <div className="flex items-center gap-2">
                          <div className={`text-2xl font-bold ${getRatingColor(selectedReview.trustworthy)}`}>
                            {selectedReview.trustworthy}
                          </div>
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-4 h-4 ${i < selectedReview.trustworthy ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">Leadership</p>
                        <div className="flex items-center gap-2">
                          <div className={`text-2xl font-bold ${getRatingColor(selectedReview.leadership)}`}>
                            {selectedReview.leadership}
                          </div>
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-4 h-4 ${i < selectedReview.leadership ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Review Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Review Timeline</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Latest Review</span>
                      <span className="text-sm font-medium">{new Date(selectedReview.review_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Review Period</span>
                      <span className="text-sm font-medium">{selectedReview.review_period}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      {getReviewStatusBadge(selectedReview.status)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Trend</span>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(selectedReview.trend)}
                        <span className="text-sm capitalize">{selectedReview.trend}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReviewDetailsOpen(false)}>Close</Button>
              <Button onClick={() => {
                setIsReviewDetailsOpen(false)
                setIsAddReviewDialogOpen(true)
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add New Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Review Dialog */}
        <AddReviewDialog
          open={isAddReviewDialogOpen}
          onOpenChange={setIsAddReviewDialogOpen}
          employees={employees}
          preselectedEmployeeId={selectedReview?.employee_id || selectedEmployee?.id}
          onReviewAdded={loadData}
        />

        {/* Add Goal Dialog */}
        <AddGoalDialog
          open={isAddGoalDialogOpen}
          onOpenChange={setIsAddGoalDialogOpen}
          employees={employees}
          preselectedEmployeeId={selectedGoal?.employee_id || selectedEmployee?.id}
          onGoalAdded={loadData}
        />

        {/* Add Learning Path Dialog */}
        <AddLearningPathDialog
          open={isAddLearningPathDialogOpen}
          onOpenChange={setIsAddLearningPathDialogOpen}
          employees={employees}
          onLearningPathAdded={loadData}
        />

        {/* Add Career Path Dialog */}
        <AddCareerPathDialog
          open={isAddCareerPathDialogOpen}
          onOpenChange={setIsAddCareerPathDialogOpen}
          employees={employees}
          onCareerPathAdded={loadData}
        />

        {/* Review History Dialog */}
        <Dialog open={isReviewHistoryOpen} onOpenChange={setIsReviewHistoryOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review History</DialogTitle>
              <DialogDescription>
                Complete performance review history for {selectedReview?.employee?.name || 'Employee'}
              </DialogDescription>
            </DialogHeader>
            {selectedReview && (
              <div className="space-y-4">
                {/* Historical reviews */}
                {performanceReviews
                  .filter(review => review.employee_id === selectedReview.employee_id)
                  .length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No historical reviews available</p>
                  </div>
                ) : (
                  performanceReviews
                    .filter(review => review.employee_id === selectedReview.employee_id)
                    .map((review) => (
                      <Card key={review.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="font-semibold">{review.review_period}</h3>
                              <p className="text-sm text-muted-foreground">
                                {new Date(review.review_date).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`text-2xl font-bold ${getRatingColor((review.collaboration + review.accountability + review.trustworthy + review.leadership) / 4)}`}>
                                {((review.collaboration + review.accountability + review.trustworthy + review.leadership) / 4).toFixed(1)}
                              </div>
                              <p className="text-xs text-muted-foreground">Overall</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-4">
                            <div className="text-center p-3 border rounded-lg">
                              <div className={`text-xl font-bold ${getRatingColor(review.collaboration)}`}>
                                {review.collaboration}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Collaboration</p>
                            </div>
                            <div className="text-center p-3 border rounded-lg">
                              <div className={`text-xl font-bold ${getRatingColor(review.accountability)}`}>
                                {review.accountability}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Accountability</p>
                            </div>
                            <div className="text-center p-3 border rounded-lg">
                              <div className={`text-xl font-bold ${getRatingColor(review.trustworthy)}`}>
                                {review.trustworthy}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Trustworthy</p>
                            </div>
                            <div className="text-center p-3 border rounded-lg">
                              <div className={`text-xl font-bold ${getRatingColor(review.leadership)}`}>
                                {review.leadership}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Leadership</p>
                            </div>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setIsReviewHistoryOpen(false)
                                setIsReviewDetailsOpen(true)
                              }}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              View Full Review
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReviewHistoryOpen(false)}>Close</Button>
              <Button onClick={() => {
                setIsReviewHistoryOpen(false)
                setIsAddReviewDialogOpen(true)
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add New Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Goal Details Dialog */}
        <Dialog open={isGoalDetailsOpen} onOpenChange={setIsGoalDetailsOpen}>
          <DialogContent className="w-[96vw] max-w-none max-h-[95vh] overflow-y-auto overflow-x-hidden p-8">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-2xl">Goal Details</DialogTitle>
              <DialogDescription>
                Detailed information and progress tracking for this goal
              </DialogDescription>
            </DialogHeader>
            {selectedGoal && (
              <div className="space-y-6 overflow-x-hidden">
                {/* Goal Header */}
                <Card className="border-2 min-w-0">
                  <CardContent className="pt-6 pb-6">
                    <div className="flex items-start justify-between gap-6 min-w-0">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-2xl font-bold mb-3 break-words">{selectedGoal.goal}</h3>
                        <div className="flex items-center gap-4 text-base text-muted-foreground flex-wrap">
                          <span className="font-medium">{selectedGoal.employee?.name || 'Unknown Employee'}</span>
                          <span>•</span>
                          <span>{selectedGoal.employee?.department || 'N/A'}</span>
                          <span>•</span>
                          <Badge variant="secondary" className="text-sm">{selectedGoal.category}</Badge>
                        </div>
                      </div>
                      <Badge className={getGoalStatusColor(selectedGoal.status) + " text-base px-4 py-2 flex-shrink-0"}>
                        {getGoalStatusIcon(selectedGoal.status)}
                        <span className="ml-2 whitespace-nowrap">{selectedGoal.status}</span>
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-6 min-w-0 overflow-hidden">
                  {/* Left Column */}
                  <div className="space-y-6 min-w-0">
                    {/* Progress Card */}
                    <Card className="min-w-0 overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-lg">Progress</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <span className="text-base text-muted-foreground whitespace-nowrap">Current Progress</span>
                          <span className="text-5xl font-bold">{selectedGoal.progress}%</span>
                        </div>
                        <Progress value={selectedGoal.progress} className="h-4" />
                        <div className="grid grid-cols-2 gap-4 pt-3 min-w-0">
                          <div className="p-4 border rounded-lg min-w-0">
                            <p className="text-sm text-muted-foreground mb-2">Created</p>
                            <p className="text-base font-medium break-words">{new Date(selectedGoal.created_date).toLocaleDateString()}</p>
                          </div>
                          <div className="p-4 border rounded-lg min-w-0">
                            <p className="text-sm text-muted-foreground mb-2">Due Date</p>
                            <p className="text-base font-medium break-words">{new Date(selectedGoal.due_date).toLocaleDateString()}</p>
                            <p className="text-sm text-muted-foreground mt-1 break-words">{getDaysUntilDue(selectedGoal.due_date)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Goal Timeline */}
                    <Card className="min-w-0 overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-lg">Timeline & Milestones</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-5">
                          {/* Timeline */}
                          <div className="flex items-start gap-4 min-w-0">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-base break-words">Goal Created</h4>
                              <p className="text-base text-muted-foreground break-words">{new Date(selectedGoal.created_date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="text-center py-4 text-muted-foreground text-sm">
                            Timeline milestones will appear here as progress is tracked
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column */}
                  <div className="min-w-0">
                    {/* Comments Section */}
                    <Card className="h-full min-w-0 overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-lg">Comments & Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Comments */}
                          <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No comments yet</p>
                            <p className="text-xs mt-1">Comments will appear here as progress is tracked</p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="default" 
                            className="w-full mt-4"
                            onClick={() => {
                              setIsGoalDetailsOpen(false)
                              setIsAddCommentOpen(true)
                            }}
                          >
                            <Plus className="mr-2 h-5 w-5" />
                            Add Comment
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="gap-3">
              <Button variant="outline" size="lg" onClick={() => setIsGoalDetailsOpen(false)}>Close</Button>
              {selectedGoal && (
                <Button size="lg" onClick={() => {
                  setIsGoalDetailsOpen(false)
                  setEditingGoal(selectedGoal.id)
                  setGoalProgress(selectedGoal.progress)
                }}>
                  <Target className="mr-2 h-5 w-5" />
                  Update Progress
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Comment Dialog */}
        <Dialog open={isAddCommentOpen} onOpenChange={setIsAddCommentOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Comment</DialogTitle>
              <DialogDescription>
                Add a comment or note about this goal
              </DialogDescription>
            </DialogHeader>
            {selectedGoal && (
              <div className="space-y-4">
                {/* Goal Summary */}
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-medium mb-1">{selectedGoal.goal}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{selectedGoal.employee?.name}</span>
                      <span>•</span>
                      <Badge className={getGoalStatusColor(selectedGoal.status)} variant="outline">
                        {selectedGoal.status}
                      </Badge>
                      <span>•</span>
                      <span>{selectedGoal.progress}% complete</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Comment Input */}
                <div>
                  <Label htmlFor="comment">Comment</Label>
                  <Textarea 
                    id="comment"
                    placeholder="Add your comment or notes here..."
                    rows={6}
                    value={goalComment}
                    onChange={(e) => setGoalComment(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    This comment will be visible to the employee and their manager.
                  </p>
                </div>

                {/* Comment Type */}
                <div>
                  <Label htmlFor="comment-type">Comment Type</Label>
                  <Select defaultValue="general">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Update</SelectItem>
                      <SelectItem value="feedback">Feedback</SelectItem>
                      <SelectItem value="milestone">Milestone Achieved</SelectItem>
                      <SelectItem value="concern">Concern/Blocker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAddCommentOpen(false)
                setGoalComment('')
              }}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (goalComment.trim()) {
                    alert("Comment added successfully!")
                    setIsAddCommentOpen(false)
                    setGoalComment('')
                  } else {
                    alert("Please enter a comment before submitting.")
                  }
                }}
                disabled={!goalComment.trim()}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Add Comment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Mentorship Match Dialog */}
        <Dialog open={isCreateMatchOpen} onOpenChange={(open) => {
          setIsCreateMatchOpen(open)
          if (!open) {
            // Reset form when dialog closes
            setMentorshipForm({
              mentor_id: "",
              mentee_id: "",
              focus: "",
              match_score: 85,
              start_date: new Date().toISOString().split('T')[0],
              status: "active",
            })
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Mentorship Match</DialogTitle>
              <DialogDescription>
                Connect a mentor with a mentee to facilitate professional development
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="mentor">Select Mentor *</Label>
                <Select
                  value={mentorshipForm.mentor_id}
                  onValueChange={(value) => setMentorshipForm({ ...mentorshipForm, mentor_id: value })}
                >
                  <SelectTrigger id="mentor">
                    <SelectValue placeholder="Choose mentor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <SelectItem value="none" disabled>No employees available</SelectItem>
                    ) : (
                      employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} - {emp.position}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="mentee">Select Mentee *</Label>
                <Select
                  value={mentorshipForm.mentee_id}
                  onValueChange={(value) => setMentorshipForm({ ...mentorshipForm, mentee_id: value })}
                >
                  <SelectTrigger id="mentee">
                    <SelectValue placeholder="Choose mentee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <SelectItem value="none" disabled>No employees available</SelectItem>
                    ) : (
                      employees
                        .filter(emp => emp.id !== mentorshipForm.mentor_id)
                        .map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name} - {emp.position}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="focus-area">Focus Area *</Label>
                <Select
                  value={mentorshipForm.focus}
                  onValueChange={(value) => setMentorshipForm({ ...mentorshipForm, focus: value })}
                >
                  <SelectTrigger id="focus-area">
                    <SelectValue placeholder="Select focus area..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technical Skills">Technical Skills</SelectItem>
                    <SelectItem value="Leadership Development">Leadership Development</SelectItem>
                    <SelectItem value="Communication Skills">Communication Skills</SelectItem>
                    <SelectItem value="Career Growth">Career Growth</SelectItem>
                    <SelectItem value="Project Management">Project Management</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="match-score">Match Score: {mentorshipForm.match_score}%</Label>
                  <Slider
                    id="match-score"
                    value={[mentorshipForm.match_score]}
                    onValueChange={(value) => setMentorshipForm({ ...mentorshipForm, match_score: value[0] })}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
                <div>
                  <Label htmlFor="start-date">Start Date *</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={mentorshipForm.start_date}
                    onChange={(e) => setMentorshipForm({ ...mentorshipForm, start_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={mentorshipForm.status}
                  onValueChange={(value: any) => setMentorshipForm({ ...mentorshipForm, status: value })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateMatchOpen(false)}
                disabled={isSubmittingMentorship}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateMentorship}
                disabled={isSubmittingMentorship}
              >
                {isSubmittingMentorship ? "Creating..." : "Create Match"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Give Recognition Dialog */}
        <Dialog open={isGiveRecognitionOpen} onOpenChange={(open) => {
          setIsGiveRecognitionOpen(open)
          if (!open) {
            // Reset form when dialog closes
            setRecognitionForm({
              from_id: "",
              to_id: "",
              type: "peer",
              category: "",
              message: "",
              recognition_date: new Date().toISOString().split('T')[0],
            })
          }
        }}>
          <DialogContent className="max-w-2xl">
            <form onSubmit={(e) => {
              e.preventDefault()
              handleCreateRecognition()
            }}>
              <DialogHeader>
                <DialogTitle>Give Recognition</DialogTitle>
                <DialogDescription>
                  Recognize team members for their contributions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
              <div>
                <Label htmlFor="from">From *</Label>
                <Select
                  value={recognitionForm.from_id}
                  onValueChange={(value) => setRecognitionForm({ ...recognitionForm, from_id: value })}
                >
                  <SelectTrigger id="from">
                    <SelectValue placeholder="Select your name..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 && csmUsers.length === 0 ? (
                      <SelectItem value="none" disabled>No users available</SelectItem>
                    ) : (
                      <>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name} - {emp.position}
                          </SelectItem>
                        ))}
                        {csmUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="to">To (Employee) *</Label>
                <Select
                  value={recognitionForm.to_id}
                  onValueChange={(value) => setRecognitionForm({ ...recognitionForm, to_id: value })}
                >
                  <SelectTrigger id="to">
                    <SelectValue placeholder="Select recipient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <SelectItem value="none" disabled>No employees available</SelectItem>
                    ) : (
                      employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} - {emp.position}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="recognition-type">Recognition Type *</Label>
                  <Select
                    value={recognitionForm.type}
                    onValueChange={(value: any) => setRecognitionForm({ ...recognitionForm, type: value })}
                  >
                    <SelectTrigger id="recognition-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="peer">Peer Recognition</SelectItem>
                      <SelectItem value="manager">Manager Recognition</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={recognitionForm.category}
                    onValueChange={(value) => setRecognitionForm({ ...recognitionForm, category: value })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Innovation">Innovation</SelectItem>
                      <SelectItem value="Excellence">Excellence</SelectItem>
                      <SelectItem value="Teamwork">Teamwork</SelectItem>
                      <SelectItem value="Leadership">Leadership</SelectItem>
                      <SelectItem value="Dedication">Dedication</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="message">Recognition Message *</Label>
                <Textarea
                  id="message"
                  placeholder="Write a meaningful recognition message..."
                  rows={4}
                  className="resize-none"
                  value={recognitionForm.message}
                  onChange={(e) => setRecognitionForm({ ...recognitionForm, message: e.target.value })}
                  required
                />
              </div>
              <div className="p-4 border rounded-lg bg-accent/30">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="h-5 w-5 text-primary" />
                  <p className="text-sm">
                    Recognition will be visible to the recipient and their manager
                  </p>
                </div>
              </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsGiveRecognitionOpen(false)}
                  disabled={isSubmittingRecognition}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingRecognition}
                >
                  <Award className="mr-2 h-4 w-4" />
                  {isSubmittingRecognition ? "Sending..." : "Send Recognition"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Schedule Interview Dialog */}
        <Dialog open={isScheduleInterviewOpen} onOpenChange={(open) => {
          setIsScheduleInterviewOpen(open)
          if (!open) {
            // Reset form when closing
            setInterviewCandidate('')
            setInterviewDate('')
            setInterviewTime('')
            setInterviewType('')
            setInterviewNotes('')
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Schedule Interview</DialogTitle>
              <DialogDescription>
                Schedule an interview with a candidate
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              <div>
                <Label htmlFor="candidate">Select Candidate</Label>
                <Select value={interviewCandidate} onValueChange={setInterviewCandidate}>
                  <SelectTrigger id="candidate">
                    <SelectValue placeholder="Choose candidate..." />
                  </SelectTrigger>
                  <SelectContent>
                    {applications.length === 0 ? (
                      <SelectItem value="none" disabled>No candidates available</SelectItem>
                    ) : (
                      applications.map((app, idx) => (
                        <SelectItem key={app.id || idx} value={app.id || `candidate-${idx}`}>
                          {app.anonymousId} - {app.jobTitle}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="interview-type">Interview Type</Label>
                <Select value={interviewType} onValueChange={setInterviewType}>
                  <SelectTrigger id="interview-type">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone Screen</SelectItem>
                    <SelectItem value="technical">Technical Interview</SelectItem>
                    <SelectItem value="behavioral">Behavioral Interview</SelectItem>
                    <SelectItem value="final">Final Round</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="interview-date">Date</Label>
                  <Input 
                    id="interview-date" 
                    type="date" 
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="interview-time">Time</Label>
                  <Input 
                    id="interview-time" 
                    type="time" 
                    value={interviewTime}
                    onChange={(e) => setInterviewTime(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="interview-notes">Notes</Label>
                <Textarea
                  id="interview-notes"
                  placeholder="Add interview type, interviewer name, and any special instructions..."
                  rows={3}
                  value={interviewNotes}
                  onChange={(e) => setInterviewNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsScheduleInterviewOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={async () => {
                  if (!interviewCandidate || !interviewDate) {
                    alert("Please select a candidate and date")
                    return
                  }
                  
                  try {
                    // Combine notes with interview details
                    const fullNotes = `Interview Type: ${interviewType || 'Not specified'}\nTime: ${interviewTime || 'Not specified'}\n\n${interviewNotes}`
                    
                    const success = await scheduleInterview(interviewCandidate, interviewDate, fullNotes)
                    
                    if (success) {
                      alert("Interview scheduled successfully!")
                      await loadData() // Refresh the data
                      setIsScheduleInterviewOpen(false)
                    } else {
                      alert("Failed to schedule interview. Please try again.")
                    }
                  } catch (error) {
                    console.error('Error scheduling interview:', error)
                    alert("An error occurred. Please try again.")
                  }
                }}
                disabled={!interviewCandidate || !interviewDate}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Schedule Interview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send 360° Feedback Dialog */}
        <Dialog open={isSend360FeedbackOpen} onOpenChange={setIsSend360FeedbackOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Send 360° Feedback Request</DialogTitle>
              <DialogDescription>
                Request comprehensive feedback from multiple sources
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              <div>
                <Label htmlFor="feedback-subject">Feedback Subject</Label>
                <Select>
                  <SelectTrigger id="feedback-subject">
                    <SelectValue placeholder="Select employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <SelectItem value="none" disabled>No employees available</SelectItem>
                    ) : (
                      employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} - {emp.department}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Select Feedback Providers</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="manager" className="rounded" />
                    <Label htmlFor="manager">Manager</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="peers" className="rounded" />
                    <Label htmlFor="peers">Peers</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="direct-reports" className="rounded" />
                    <Label htmlFor="direct-reports">Direct Reports</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="self" className="rounded" />
                    <Label htmlFor="self">Self Assessment</Label>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="feedback-deadline">Deadline</Label>
                <Input id="feedback-deadline" type="date" />
              </div>
              <div>
                <Label htmlFor="feedback-instructions">Instructions</Label>
                <Textarea
                  id="feedback-instructions"
                  placeholder="Provide instructions or context for feedback providers..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSend360FeedbackOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                alert("360° feedback request sent successfully!")
                setIsSend360FeedbackOpen(false)
              }}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Send Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approve Time Off Dialog */}
        <Dialog open={isApproveTimeOffOpen} onOpenChange={setIsApproveTimeOffOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Approve Time Off Request</DialogTitle>
              <DialogDescription>
                Review and approve pending time off requests
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">Michael Chen</h4>
                    <p className="text-sm text-muted-foreground">Engineering</p>
                  </div>
                  <Badge>Pending</Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Type</p>
                    <p className="font-medium">Vacation</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Duration</p>
                    <p className="font-medium">5 days</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Start Date</p>
                    <p className="font-medium">Jan 15, 2025</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">End Date</p>
                    <p className="font-medium">Jan 19, 2025</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Reason</p>
                  <p className="text-sm">Family vacation to Hawaii</p>
                </div>
              </div>
              <div>
                <Label htmlFor="approval-notes">Manager Notes (Optional)</Label>
                <Textarea
                  id="approval-notes"
                  placeholder="Add any notes about this approval..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsApproveTimeOffOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => {
                alert("Time off request denied")
                setIsApproveTimeOffOpen(false)
              }}>
                Deny
              </Button>
              <Button onClick={() => {
                alert("Time off request approved successfully!")
                setIsApproveTimeOffOpen(false)
              }}>
                <FileCheck className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Training Dialog */}
        <Dialog open={isAssignTrainingOpen} onOpenChange={setIsAssignTrainingOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Assign Training</DialogTitle>
              <DialogDescription>
                Assign training courses to employees
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              <div>
                <Label htmlFor="training-employee">Select Employee</Label>
                <Select>
                  <SelectTrigger id="training-employee">
                    <SelectValue placeholder="Choose employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <SelectItem value="none" disabled>No employees available</SelectItem>
                    ) : (
                      employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} - {emp.department}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="training-course">Select Training Course</Label>
                <Select>
                  <SelectTrigger id="training-course">
                    <SelectValue placeholder="Choose course..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course1">Advanced React Development</SelectItem>
                    <SelectItem value="course2">Leadership Fundamentals</SelectItem>
                    <SelectItem value="course3">Product Management 101</SelectItem>
                    <SelectItem value="course4">Data Analytics with Python</SelectItem>
                    <SelectItem value="course5">Communication Skills</SelectItem>
                    <SelectItem value="course6">Agile Methodology</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="training-priority">Priority</Label>
                <Select>
                  <SelectTrigger id="training-priority">
                    <SelectValue placeholder="Select priority..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High - Required</SelectItem>
                    <SelectItem value="medium">Medium - Recommended</SelectItem>
                    <SelectItem value="low">Low - Optional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="training-deadline">Completion Deadline</Label>
                <Input id="training-deadline" type="date" />
              </div>
              <div>
                <Label htmlFor="training-notes">Notes for Employee</Label>
                <Textarea
                  id="training-notes"
                  placeholder="Add any context or instructions for this training assignment..."
                  rows={3}
                />
              </div>
              <div className="p-4 border rounded-lg bg-accent/30">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <p className="text-sm">
                    Employee will receive email notification and calendar invite
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignTrainingOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                alert("Training assigned successfully!")
                setIsAssignTrainingOpen(false)
              }}>
                <BookOpen className="mr-2 h-4 w-4" />
                Assign Training
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Selected Employees?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedEmployees.length} employee(s)? This action cannot be undone and will permanently remove their records from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Candidate Details Dialog */}
        <Dialog open={isCandidateDetailsOpen} onOpenChange={setIsCandidateDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Application Status</DialogTitle>
              <DialogDescription>
                {selectedCandidate?.anonymousId} - {selectedCandidate?.jobTitle}
              </DialogDescription>
            </DialogHeader>
            {selectedCandidate && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <Badge 
                    variant={
                      selectedCandidate.status === 'new' ? 'secondary' :
                      selectedCandidate.status === 'reviewing' ? 'default' :
                      selectedCandidate.status === 'interviewed' || selectedCandidate.status === 'interview-scheduled' ? 'outline' :
                      selectedCandidate.status === 'offer' ? 'default' :
                      'secondary'
                    }
                    className="text-base px-3 py-1"
                  >
                    {selectedCandidate.status.replace('-', ' ')}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Anonymous ID</Label>
                    <p className="text-base font-medium mt-1">{selectedCandidate.anonymousId}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Position Applied</Label>
                    <p className="text-base font-medium mt-1">{selectedCandidate.jobTitle}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Department</Label>
                    <p className="text-base font-medium mt-1">{selectedCandidate.department}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Applied Date</Label>
                    <p className="text-base font-medium mt-1">
                      {new Date(selectedCandidate.appliedDate).toLocaleDateString()}
                    </p>
                  </div>
                  {selectedCandidate.interviewDate && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Interview Date</Label>
                      <p className="text-base font-medium mt-1">
                        {new Date(selectedCandidate.interviewDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {selectedCandidate.rating && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Rating</Label>
                      <div className="flex items-center gap-1 mt-1">
                        {Array.from({ length: selectedCandidate.rating }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCandidateDetailsOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

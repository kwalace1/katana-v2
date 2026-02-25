import { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Briefcase,
  Users,
  ClipboardCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  MapPin,
  Phone,
  Edit,
  UserPlus,
  Plus,
  ChevronRight,
  BarChart3,
  FileText,
  Settings,
  Trash2,
  Loader2,
} from "lucide-react"
import {
  getJobs,
  getTechnicians,
  getTimesheets,
  createJob,
  updateJob,
  deleteJob,
  createTechnician,
  deleteTechnician,
  type Job,
  type Technician,
  type Timesheet,
} from "@/lib/wfm-api"
import { isSupabaseConfigured } from "@/lib/supabase"

export default function WorkforcePage() {
  const [activePortal, setActivePortal] = useState<"admin" | "technician">("admin")
  const [activeTab, setActiveTab] = useState("dashboard")
  const [technicianTab, setTechnicianTab] = useState("today")
  const [loading, setLoading] = useState(true)
  
  // State management for calendar and jobs
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [viewingCalendarJob, setViewingCalendarJob] = useState<any>(null)
  const [editingCalendarJob, setEditingCalendarJob] = useState<any>(null)
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([])
  const [editingJob, setEditingJob] = useState<string | null>(null)
  const [viewingJobLocation, setViewingJobLocation] = useState<string | null>(null)
  
  // New calendar interaction state
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false)
  const [quickCreateDate, setQuickCreateDate] = useState<Date | null>(null)
  const [draggedJob, setDraggedJob] = useState<any>(null)
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null)
  
  // Edit form state for jobs (technician by id so save persists correctly)
  const [editJobTitle, setEditJobTitle] = useState("")
  const [editJobTechnician, setEditJobTechnician] = useState("")
  const [editJobTechnicianId, setEditJobTechnicianId] = useState<string | null>(null)
  const [editJobStartDate, setEditJobStartDate] = useState("")
  const [editJobEndDate, setEditJobEndDate] = useState("")
  const [editJobStatus, setEditJobStatus] = useState("")
  const [editJobLocation, setEditJobLocation] = useState("")
  const [editJobNotes, setEditJobNotes] = useState("")

  // Create job form state
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false)
  const [newJobTitle, setNewJobTitle] = useState("")
  const [newJobDescription, setNewJobDescription] = useState("")
  const [newJobAddress, setNewJobAddress] = useState("")
  const [newJobTechnician, setNewJobTechnician] = useState("")
  const [newJobStartDate, setNewJobStartDate] = useState("")
  const [newJobEndDate, setNewJobEndDate] = useState("")
  const [newJobStatus, setNewJobStatus] = useState("Assigned")

  // Create technician form state
  const [isAddTechnicianOpen, setIsAddTechnicianOpen] = useState(false)
  const [newTechName, setNewTechName] = useState("")
  const [newTechPhone, setNewTechPhone] = useState("")
  const [newTechEmail, setNewTechEmail] = useState("")

  // Edit technician form state
  const [editingTechnicianIndex, setEditingTechnicianIndex] = useState<number | null>(null)
  const [editTechName, setEditTechName] = useState("")
  const [editTechPhone, setEditTechPhone] = useState("")
  const [editTechEmail, setEditTechEmail] = useState("")
  const [editTechStatus, setEditTechStatus] = useState("")

  // Selection state for technicians
  const [selectedTechnicianIndices, setSelectedTechnicianIndices] = useState<number[]>([])

  // Timesheet state
  interface TimesheetEntry {
    id: string
    technician: string
    date: string
    jobId: string
    jobTitle: string
    clockIn: string
    clockOut: string
    hours: number
    status: string
    notes: string
  }

  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([])

  const [isAddTimesheetOpen, setIsAddTimesheetOpen] = useState(false)
  const [newTimesheetTechnician, setNewTimesheetTechnician] = useState("")
  const [newTimesheetJob, setNewTimesheetJob] = useState("")
  const [newTimesheetDate, setNewTimesheetDate] = useState("")
  const [newTimesheetClockIn, setNewTimesheetClockIn] = useState("")
  const [newTimesheetClockOut, setNewTimesheetClockOut] = useState("")
  const [newTimesheetNotes, setNewTimesheetNotes] = useState("")

  const [editingTimesheetId, setEditingTimesheetId] = useState<string | null>(null)
  const [editTimesheetTechnician, setEditTimesheetTechnician] = useState("")
  const [editTimesheetJob, setEditTimesheetJob] = useState("")
  const [editTimesheetDate, setEditTimesheetDate] = useState("")
  const [editTimesheetClockIn, setEditTimesheetClockIn] = useState("")
  const [editTimesheetClockOut, setEditTimesheetClockOut] = useState("")
  const [editTimesheetStatus, setEditTimesheetStatus] = useState("")
  const [editTimesheetNotes, setEditTimesheetNotes] = useState("")

  const [selectedTimesheetIds, setSelectedTimesheetIds] = useState<string[]>([])

  // Technician portal state
  const [viewingTechJobDetails, setViewingTechJobDetails] = useState<any>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [jobMapMarkers, setJobMapMarkers] = useState<{ jobId: string; lat: number; lng: number; title: string; status: string; address: string }[]>([])
  const [mapGeocoding, setMapGeocoding] = useState(false)

  // Database data
  const [dbJobs, setDbJobs] = useState<Job[]>([])
  const [dbTechnicians, setDbTechnicians] = useState<Technician[]>([])

  // Legacy sample data structure for compatibility with existing code
  const [jobs, setJobs] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])

  // Calculate metrics from fetched data
  const totalJobs = dbJobs.length
  const activeTechnicians = dbTechnicians.filter(t => t.status === 'active' && t.is_active).length
  const assignedJobs = dbJobs.filter(j => j.status === 'assigned').length
  const inProgressJobs = dbJobs.filter(j => j.status === 'in-progress').length
  
  // Calculate completed this week
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const completedThisWeek = dbJobs.filter(j => {
    if (j.status !== 'completed') return false
    const completedDate = j.updated_at ? new Date(j.updated_at) : null
    return completedDate && completedDate >= startOfWeek
  }).length

  // Calculate overdue jobs (end_date in the past and status not completed)
  const overdueJobs = dbJobs.filter(j => {
    if (j.status === 'completed' || j.status === 'cancelled') return false
    if (!j.end_date) return false
    const endDate = new Date(j.end_date)
    return endDate < new Date()
  }).length

  // Jobs this week (start_date in current week)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(endOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)
  const jobsThisWeek = dbJobs.filter(j => {
    if (!j.start_date) return false
    const d = new Date(j.start_date)
    return d >= startOfWeek && d <= endOfWeek
  }).length

  // Jobs this month (start_date in current month)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  const jobsThisMonth = dbJobs.filter(j => {
    if (!j.start_date) return false
    const d = new Date(j.start_date)
    return d >= startOfMonth && d <= endOfMonth
  }).length

  // Top performers by completed jobs (technician name + count)
  const completedByTechnician = dbJobs
    .filter(j => j.status === 'completed' && j.technician_id)
    .reduce<Record<string, number>>((acc, j) => {
      const tid = j.technician_id!
      acc[tid] = (acc[tid] || 0) + 1
      return acc
    }, {})
  const topPerformers = Object.entries(completedByTechnician)
    .map(([techId, count]) => ({
      name: dbTechnicians.find(t => t.id === techId)?.name ?? 'Unknown',
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)

  // Jobs needing attention (overdue + on-hold)
  const jobsNeedingAttention = dbJobs.filter(j => {
    if (j.status === 'completed' || j.status === 'cancelled') return false
    if (j.status === 'on-hold') return true
    if (j.end_date && new Date(j.end_date) < new Date()) return true
    return false
  }).length

  useEffect(() => {
    fetchData()
  }, [])

  const formatTimeForTimesheet = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const mapApiTimesheetToEntry = (ts: Timesheet): TimesheetEntry => {
    const clockInDate = new Date(ts.clock_in)
    const dateStr = clockInDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const statusDisplay = !ts.clock_out
      ? 'Clocked In'
      : ts.status === 'approved'
      ? 'Approved'
      : ts.status === 'rejected'
      ? 'Rejected'
      : 'Pending Approval'
    return {
      id: ts.id,
      technician: ts.technician?.name ?? '—',
      date: dateStr,
      jobId: ts.job?.job_number ?? ts.job_id ?? '—',
      jobTitle: ts.job?.title ?? '—',
      clockIn: formatTimeForTimesheet(ts.clock_in),
      clockOut: ts.clock_out ? formatTimeForTimesheet(ts.clock_out) : '',
      hours: ts.total_hours ?? 0,
      status: statusDisplay,
      notes: ts.notes ?? '',
    }
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const [jobsData, techniciansData, timesheetsData] = await Promise.all([
        getJobs(),
        getTechnicians(),
        getTimesheets(),
      ])
      setDbJobs(jobsData)
      setDbTechnicians(techniciansData)
      setTimesheets(timesheetsData.map(mapApiTimesheetToEntry))
      
      // Convert database format to legacy format for compatibility
      const convertedJobs = jobsData.map(job => {
        const { technician: techObj, ...jobWithoutTech } = job
        // Resolve technician name from relation or by technician_id so assignment always shows
        const technicianName = techObj?.name ?? (job.technician_id ? (techniciansData.find(t => t.id === job.technician_id)?.name ?? 'Unassigned') : 'Unassigned')
        const hasTechnician = !!job.technician_id
        const displayStatus = job.status === 'in-progress' ? 'In Progress' :
                  job.status === 'assigned' ? (hasTechnician ? 'Assigned' : 'Unassigned') :
                  job.status === 'completed' ? 'Completed' :
                  job.status === 'on-hold' ? 'On Hold' :
                  job.status === 'cancelled' ? 'Cancelled' : job.status
        return {
          ...jobWithoutTech,
          id: job.job_number || job.id,
          dbId: job.id, // Keep DB uuid for API updates
          title: job.title,
          technician: technicianName,
          startDate: job.start_date ? new Date(job.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
          endDate: job.end_date ? new Date(job.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
          status: displayStatus,
        }
      })
      
      const convertedTechnicians = techniciansData.map(tech => ({
        ...tech, // Include all original technician data first
        name: tech.name,
        phone: tech.phone || '',
        email: tech.email || '',
        activeJobs: jobsData.filter(j => j.technician_id === tech.id && (j.status === 'assigned' || j.status === 'in-progress')).length,
        status: tech.status === 'active' ? 'Active' : tech.status === 'inactive' ? 'Inactive' : 'On Leave',
      }))
      
      setJobs(convertedJobs)
      setTechnicians(convertedTechnicians)
    } catch (error) {
      console.error('Error fetching WFM data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Recent activity from actual jobs (sorted by updated_at, most recent first)
  const recentActivity = [...dbJobs]
    .filter(j => j.updated_at)
    .sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime())
    .slice(0, 8)
    .map(j => {
      const jobLabel = j.job_number || j.id
      const techName = (j as { technician?: { name?: string } }).technician?.name ?? dbTechnicians.find(t => t.id === j.technician_id)?.name ?? 'Unassigned'
      if (j.status === 'completed') return `Job ${jobLabel} completed by ${techName}`
      if (j.status === 'in-progress') return `${techName} started job ${jobLabel}`
      if (j.status === 'assigned') return `Job ${jobLabel} assigned to ${techName}`
      if (j.status === 'on-hold') return `Job ${jobLabel} put on hold`
      if (j.status === 'cancelled') return `Job ${jobLabel} cancelled`
      return `Job ${jobLabel} updated`
    })

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    
    return { daysInMonth, startingDayOfWeek, year, month }
  }

  const dateStrFor = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // Technician portal stats (real data from jobs + timesheets)
  const todayStr = dateStrFor(now)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const jobsTodayForPortal = jobs.filter(j => j.startDate === todayStr)
  const nextJobForPortal = jobs
    .filter(j => {
      if (j.status === 'Completed' || j.status === 'Cancelled') return false
      const jobStart = new Date(j.startDate)
      return jobStart >= startOfToday
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0] ?? null

  const endOfNext7Days = new Date(now)
  endOfNext7Days.setDate(now.getDate() + 7)
  endOfNext7Days.setHours(23, 59, 59, 999)
  const jobsCurrentlyHappening = jobs.filter(j => {
    if (j.status === 'Completed' || j.status === 'Cancelled') return false
    const jobStart = new Date(j.startDate)
    const jobEnd = j.endDate ? new Date(j.endDate) : null
    if (j.status === 'In Progress') return true
    return jobStart <= startOfToday && (!jobEnd || jobEnd >= startOfToday)
  })
  const jobsUpcomingNext7Days = jobs
    .filter(j => {
      if (j.status === 'Completed' || j.status === 'Cancelled') return false
      const jobStart = new Date(j.startDate)
      return jobStart >= startOfToday && jobStart <= endOfNext7Days
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

  const hoursThisWeekForPortal = timesheets
    .filter(t => {
      const d = new Date(t.date)
      return d >= startOfWeek && d <= endOfWeek
    })
    .reduce((sum, t) => sum + (t.hours || 0), 0)

  const getJobsForDate = (date: Date) => {
    const dateStr = dateStrFor(date)
    const starting = jobs.filter(job => job.startDate === dateStr)
    const due = jobs.filter(job => job.endDate === dateStr && job.startDate !== dateStr)
    const startIds = new Set(starting.map(j => j.id))
    const dueOnly = due.filter(j => !startIds.has(j.id))
    return { starting, due: dueOnly, all: [...starting, ...dueOnly] }
  }

  const getJobsForDateLegacy = (date: Date) => getJobsForDate(date).all

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const goToToday = () => {
    setCurrentMonth(new Date())
  }

  // Quick create job on calendar cell click
  const handleCellClick = (date: Date) => {
    setQuickCreateDate(date)
    setIsQuickCreateOpen(true)
  }

  const handleQuickCreateJob = async () => {
    try {
      if (!newJobTitle || !quickCreateDate) {
        alert("Please fill in the job title")
        return
      }

      if (isSupabaseConfigured) {
        const dateStr = quickCreateDate.toISOString().slice(0, 10)
        const technicianId = newJobTechnician && newJobTechnician !== 'Unassigned'
          ? (technicians.find(t => t.name === newJobTechnician) as { id?: string } | undefined)?.id ?? null
          : null
        const created = await createJob({
          title: newJobTitle,
          description: null,
          customer_name: null,
          customer_phone: null,
          customer_email: null,
          location: null,
          location_address: null,
          status: statusToApi(newJobStatus),
          priority: 'medium',
          technician_id: technicianId,
          start_date: dateStr,
          end_date: dateStr,
          estimated_hours: null,
          actual_hours: null,
          notes: null,
          completion_notes: null,
          is_active: true,
        })
        if (created) {
          await fetchData()
          setNewJobTitle("")
          setNewJobTechnician("")
          setNewJobStatus("Assigned")
          setIsQuickCreateOpen(false)
          setQuickCreateDate(null)
        }
        return
      }

      const newId = getNextJobNumber(jobs)
      const formattedDate = quickCreateDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const newJob = {
        id: newId,
        title: newJobTitle,
        technician: newJobTechnician || "Unassigned",
        startDate: formattedDate,
        endDate: formattedDate,
        status: newJobStatus,
      }
      setJobs([...jobs, newJob])
      setNewJobTitle("")
      setNewJobTechnician("")
      setNewJobStatus("Assigned")
      setIsQuickCreateOpen(false)
      setQuickCreateDate(null)
    } catch (error: unknown) {
      console.error('Error creating job:', error)
      const message = error && typeof error === 'object' && 'message' in error ? String((error as { message: string }).message) : 'Unknown error'
      alert(`Failed to create job. ${message}`)
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, job: any) => {
    setDraggedJob(job)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, date: Date) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverDate(date)
  }

  const handleDragLeave = () => {
    setDragOverDate(null)
  }

  const handleDrop = (e: React.DragEvent, date: Date) => {
    e.preventDefault()
    
    if (!draggedJob) return

    const formattedDate = date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })

    const updatedJobs = jobs.map(job => {
      if (job.id === draggedJob.id) {
        return {
          ...job,
          startDate: formattedDate,
          endDate: formattedDate,
        }
      }
      return job
    })

    setJobs(updatedJobs)
    setDraggedJob(null)
    setDragOverDate(null)
  }

  // Job selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobIds(jobs.map(job => job.id))
    } else {
      setSelectedJobIds([])
    }
  }

  const handleSelectJob = (jobId: string, checked: boolean) => {
    if (checked) {
      setSelectedJobIds([...selectedJobIds, jobId])
    } else {
      setSelectedJobIds(selectedJobIds.filter(id => id !== jobId))
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedJobIds.length === 0) return
    
    if (!confirm(`Are you sure you want to delete ${selectedJobIds.length} job(s)?`)) return

    if (isSupabaseConfigured) {
      const jobsToDelete = jobs.filter((j) => selectedJobIds.includes(j.id))
      const dbIds = jobsToDelete
        .map((j) => (j as { dbId?: string }).dbId)
        .filter((id): id is string => !!id)
      const results = await Promise.all(dbIds.map((id) => deleteJob(id)))
      const failed = results.filter((ok) => !ok).length
      if (failed > 0) {
        alert(`Failed to delete ${failed} job(s). Please try again.`)
        return
      }
      setSelectedJobIds([])
      await fetchData()
    } else {
      const updatedJobs = jobs.filter((j) => !selectedJobIds.includes(j.id))
      setJobs(updatedJobs)
      setDbJobs(updatedJobs as Job[])
      setSelectedJobIds([])
    }
  }

  // Job management handlers
  const handleSaveCalendarJob = async () => {
    if (!editingCalendarJob) return

    const jobWithDbId = editingCalendarJob as { dbId?: string }
    if (isSupabaseConfigured && jobWithDbId.dbId) {
      try {
        const startDate = new Date(editJobStartDate).toISOString().slice(0, 10)
        const endDate = new Date(editJobEndDate).toISOString().slice(0, 10)
        await updateJob(jobWithDbId.dbId, {
          title: editJobTitle,
          technician_id: editJobTechnicianId ?? null,
          start_date: startDate,
          end_date: endDate,
          status: statusToApi(editJobStatus),
          location_address: editJobLocation?.trim() || null,
        })
        await fetchData()
      } catch (e) {
        console.error('Failed to save calendar job', e)
        alert('Failed to save changes. Please try again.')
        return
      }
    } else {
      const updatedJobs = jobs.map(job => {
        if (job.id === editingCalendarJob.id) {
          return {
            ...job,
            title: editJobTitle,
            technician: editJobTechnician,
            startDate: editJobStartDate,
            endDate: editJobEndDate,
            status: editJobStatus,
            location_address: editJobLocation?.trim() || ((job as { location_address?: string | null }).location_address ?? null),
          }
        }
        return job
      })
      setJobs(updatedJobs)
    }

    setEditingCalendarJob(null)
    setEditJobTitle("")
    setEditJobTechnician("")
    setEditJobTechnicianId(null)
    setEditJobStartDate("")
    setEditJobEndDate("")
    setEditJobStatus("")
    setEditJobLocation("")
    setEditJobNotes("")
  }

  const getNextJobNumber = (currentJobs: { id: string }[]) => {
    const numericIds = currentJobs.map(j => {
      const s = String(j.id).replace(/^#/, '')
      const n = parseInt(s, 10)
      return isNaN(n) ? 0 : n
    })
    const maxId = numericIds.length === 0 ? 0 : Math.max(0, ...numericIds)
    return `#${maxId + 1}`
  }

  const statusToApi = (s: string): Job['status'] => {
    if (s === 'In Progress') return 'in-progress'
    if (s === 'Completed') return 'completed'
    if (s === 'On Hold') return 'on-hold'
    if (s === 'Cancelled') return 'cancelled'
    if (s === 'Unassigned') return 'assigned' // API has no 'unassigned'; display-only
    return 'assigned'
  }

  // Resolve technician id from name (trim + case-insensitive); prefer dbTechnicians (source of truth)
  const getTechnicianIdByName = (name: string): string | null => {
    if (!name || name.trim() === '' || name === 'Unassigned') return null
    const n = name.trim().toLowerCase()
    const t =
      dbTechnicians.find(t => t.name?.trim().toLowerCase() === n) ??
      technicians.find((t: { name?: string }) => t.name?.trim().toLowerCase() === n)
    return (t as { id?: string } | undefined)?.id ?? null
  }

  const handleCreateJob = async () => {
    if (!newJobTitle || !newJobStartDate || !newJobEndDate) {
      alert("Please fill in all required fields (Title, Start Date, End Date)")
      return
    }

    if (isSupabaseConfigured) {
      try {
        const technicianId = getTechnicianIdByName(newJobTechnician)
        const startDate = new Date(newJobStartDate).toISOString().slice(0, 10)
        const endDate = new Date(newJobEndDate).toISOString().slice(0, 10)
        const created = await createJob({
          title: newJobTitle,
          description: newJobDescription || null,
          customer_name: null,
          customer_phone: null,
          customer_email: null,
          location: null,
          location_address: newJobAddress?.trim() || null,
          status: statusToApi(newJobStatus),
          priority: 'medium',
          technician_id: technicianId,
          start_date: startDate,
          end_date: endDate,
          estimated_hours: null,
          actual_hours: null,
          notes: null,
          completion_notes: null,
          is_active: true,
        })
        if (created) {
          await fetchData()
          setNewJobTitle("")
          setNewJobDescription("")
          setNewJobTechnician("")
          setNewJobStartDate("")
          setNewJobEndDate("")
          setNewJobStatus("Assigned")
          setIsCreateJobOpen(false)
        }
      } catch (e: unknown) {
        console.error('Error creating job:', e)
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Unknown error'
        alert(`Failed to create job. ${msg}`)
      }
      return
    }

    const newId = getNextJobNumber(jobs)
    const formattedStartDate = new Date(newJobStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const formattedEndDate = new Date(newJobEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const newJob = {
      id: newId,
      title: newJobTitle,
      technician: newJobTechnician || "Unassigned",
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      status: newJobStatus,
    }
    setJobs([...jobs, newJob])
    setNewJobTitle("")
    setNewJobDescription("")
    setNewJobAddress("")
    setNewJobTechnician("")
    setNewJobStartDate("")
    setNewJobEndDate("")
    setNewJobStatus("Assigned")
    setIsCreateJobOpen(false)
  }

  const openEditJob = (job: { id: string; title: string; technician: string; startDate: string; endDate: string; status: string; technician_id?: string | null; location_address?: string | null }) => {
    setEditingJob(job.id)
    setEditJobTitle(job.title)
    setEditJobTechnician(job.technician || 'Unassigned')
    setEditJobTechnicianId(job.technician_id ?? null)
    setEditJobStartDate(job.startDate)
    setEditJobEndDate(job.endDate)
    setEditJobStatus(job.status)
    setEditJobLocation(job.location_address ?? '')
  }

  const handleSaveJobEdit = async () => {
    if (!editingJob || !editJobTitle || !editJobStartDate || !editJobEndDate) {
      alert("Please fill in all required fields")
      return
    }
    const job = jobs.find((j: { id: string; dbId?: string }) => j.id === editingJob)
    if (!job) return
    const technicianId = getTechnicianIdByName(editJobTechnician)
    const apiStatus = statusToApi(editJobStatus)
    const startDate = new Date(editJobStartDate).toISOString().slice(0, 10)
    const endDate = new Date(editJobEndDate).toISOString().slice(0, 10)
    if (job.dbId && isSupabaseConfigured) {
      try {
        await updateJob(job.dbId, {
          title: editJobTitle,
          technician_id: technicianId ?? null,
          start_date: startDate,
          end_date: endDate,
          status: apiStatus,
          location_address: editJobLocation?.trim() || null,
        })
        await fetchData()
      } catch (e: unknown) {
        console.error('Error updating job:', e)
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Unknown error'
        alert(`Failed to save job. ${msg}`)
        return
      }
    } else {
      const technicianName = editJobTechnicianId ? (technicians.find((t: { id?: string }) => t.id === editJobTechnicianId)?.name ?? 'Unassigned') : 'Unassigned'
      setJobs(jobs.map((j: { id: string }) =>
        j.id === editingJob
          ? { ...j, title: editJobTitle, technician: technicianName, startDate: editJobStartDate, endDate: editJobEndDate, status: editJobStatus }
          : j
      ))
    }
    setEditingJob(null)
    setEditJobTitle("")
    setEditJobTechnician("")
    setEditJobTechnicianId(null)
    setEditJobStartDate("")
    setEditJobEndDate("")
    setEditJobStatus("")
  }

  // Technician management handlers
  const handleAddTechnician = async () => {
    if (!newTechName || !newTechPhone) {
      alert("Please fill in all required fields (Name and Phone)")
      return
    }

    if (isSupabaseConfigured) {
      try {
        const created = await createTechnician({
          name: newTechName.trim(),
          email: newTechEmail?.trim() || null,
          phone: newTechPhone.trim(),
          role: 'technician',
          status: 'active',
          skills: null,
          hourly_rate: null,
          avatar_url: null,
          notes: null,
          is_active: true,
        })
        if (created) {
          await fetchData()
          setNewTechName("")
          setNewTechPhone("")
          setNewTechEmail("")
          setIsAddTechnicianOpen(false)
        }
      } catch (e: unknown) {
        console.error('Error creating technician:', e)
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Unknown error'
        alert(`Failed to add technician. ${msg}`)
      }
      return
    }

    const newTechnician = {
      name: newTechName,
      phone: newTechPhone,
      activeJobs: 0,
      status: "Active",
    }
    setTechnicians([...technicians, newTechnician])
    setNewTechName("")
    setNewTechPhone("")
    setNewTechEmail("")
    setIsAddTechnicianOpen(false)
  }

  const formatPhoneNumber = (value: string) => {
    const phoneNumber = value.replace(/\D/g, '')
    
    if (phoneNumber.length <= 3) {
      return phoneNumber
    } else if (phoneNumber.length <= 6) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`
    } else {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
    }
  }

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value)
    setNewTechPhone(formatted)
  }

  const handleEditPhoneChange = (value: string) => {
    const formatted = formatPhoneNumber(value)
    setEditTechPhone(formatted)
  }

  const handleEditTechnician = (index: number) => {
    const tech = technicians[index]
    setEditingTechnicianIndex(index)
    setEditTechName(tech.name)
    setEditTechPhone(tech.phone)
    setEditTechEmail("")
    setEditTechStatus(tech.status)
  }

  const handleSaveTechnician = () => {
    if (!editTechName || !editTechPhone) {
      alert("Please fill in all required fields (Name and Phone)")
      return
    }

    if (editingTechnicianIndex === null) return

    const updatedTechnicians = [...technicians]
    updatedTechnicians[editingTechnicianIndex] = {
      ...updatedTechnicians[editingTechnicianIndex],
      name: editTechName,
      phone: editTechPhone,
      status: editTechStatus,
    }

    setTechnicians(updatedTechnicians)
    
    setEditingTechnicianIndex(null)
    setEditTechName("")
    setEditTechPhone("")
    setEditTechEmail("")
    setEditTechStatus("")
  }

  const handleSelectAllTechnicians = (checked: boolean) => {
    if (checked) {
      setSelectedTechnicianIndices(technicians.map((_, index) => index))
    } else {
      setSelectedTechnicianIndices([])
    }
  }

  const handleSelectTechnician = (index: number, checked: boolean) => {
    if (checked) {
      setSelectedTechnicianIndices([...selectedTechnicianIndices, index])
    } else {
      setSelectedTechnicianIndices(selectedTechnicianIndices.filter(i => i !== index))
    }
  }

  const handleDeleteSelectedTechnicians = async () => {
    if (selectedTechnicianIndices.length === 0) return
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedTechnicianIndices.length} technician(s)?`
    )
    
    if (!confirmDelete) return

    if (isSupabaseConfigured) {
      const idsToDelete = selectedTechnicianIndices
        .map((index) => technicians[index]?.id)
        .filter((id): id is string => !!id)
      const results = await Promise.all(idsToDelete.map((id) => deleteTechnician(id)))
      const failed = results.filter((ok) => !ok).length
      if (failed > 0) {
        alert(`Failed to delete ${failed} technician(s). Please try again.`)
        return
      }
      setSelectedTechnicianIndices([])
      await fetchData()
    } else {
      const updatedTechnicians = technicians.filter((_, index) => !selectedTechnicianIndices.includes(index))
      setTechnicians(updatedTechnicians)
      setDbTechnicians(updatedTechnicians)
      setSelectedTechnicianIndices([])
    }
  }

  // Timesheet management handlers
  const calculateHours = (clockIn: string, clockOut: string) => {
    if (!clockIn || !clockOut) return 0
    
    const [inTime, inPeriod] = clockIn.split(' ')
    const [outTime, outPeriod] = clockOut.split(' ')
    
    let [inHour, inMin] = inTime.split(':').map(Number)
    let [outHour, outMin] = outTime.split(':').map(Number)
    
    if (inPeriod === 'PM' && inHour !== 12) inHour += 12
    if (inPeriod === 'AM' && inHour === 12) inHour = 0
    if (outPeriod === 'PM' && outHour !== 12) outHour += 12
    if (outPeriod === 'AM' && outHour === 12) outHour = 0
    
    const inMinutes = inHour * 60 + inMin
    const outMinutes = outHour * 60 + outMin
    
    return Number(((outMinutes - inMinutes) / 60).toFixed(1))
  }

  const handleAddTimesheet = () => {
    if (!newTimesheetTechnician || !newTimesheetJob || !newTimesheetDate || !newTimesheetClockIn) {
      alert("Please fill in all required fields")
      return
    }

    const maxId = Math.max(...timesheets.map(t => parseInt(t.id.slice(3))))
    const newId = `#TS${String(maxId + 1).padStart(3, '0')}`

    const hours = calculateHours(newTimesheetClockIn, newTimesheetClockOut)
    const status = newTimesheetClockOut ? "Pending" : "Active"

    const selectedJob = jobs.find(j => j.id === newTimesheetJob)

    const newTimesheet: TimesheetEntry = {
      id: newId,
      technician: newTimesheetTechnician,
      date: new Date(newTimesheetDate).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }),
      jobId: newTimesheetJob,
      jobTitle: selectedJob?.title || "",
      clockIn: newTimesheetClockIn,
      clockOut: newTimesheetClockOut,
      hours: hours,
      status: status,
      notes: newTimesheetNotes,
    }

    setTimesheets([...timesheets, newTimesheet])
    
    setNewTimesheetTechnician("")
    setNewTimesheetJob("")
    setNewTimesheetDate("")
    setNewTimesheetClockIn("")
    setNewTimesheetClockOut("")
    setNewTimesheetNotes("")
    setIsAddTimesheetOpen(false)
  }

  const handleEditTimesheet = (id: string) => {
    const timesheet = timesheets.find(t => t.id === id)
    if (!timesheet) return

    setEditingTimesheetId(id)
    setEditTimesheetTechnician(timesheet.technician)
    setEditTimesheetJob(timesheet.jobId)
    setEditTimesheetDate(timesheet.date)
    setEditTimesheetClockIn(timesheet.clockIn)
    setEditTimesheetClockOut(timesheet.clockOut)
    setEditTimesheetStatus(timesheet.status)
    setEditTimesheetNotes(timesheet.notes)
  }

  const handleSaveTimesheet = () => {
    if (!editTimesheetTechnician || !editTimesheetJob || !editTimesheetClockIn) {
      alert("Please fill in all required fields")
      return
    }

    const hours = calculateHours(editTimesheetClockIn, editTimesheetClockOut)
    const selectedJob = jobs.find(j => j.id === editTimesheetJob)

    const updatedTimesheets = timesheets.map(t => 
      t.id === editingTimesheetId 
        ? {
            ...t,
            technician: editTimesheetTechnician,
            jobId: editTimesheetJob,
            jobTitle: selectedJob?.title || t.jobTitle,
            clockIn: editTimesheetClockIn,
            clockOut: editTimesheetClockOut,
            hours: hours,
            status: editTimesheetStatus,
            notes: editTimesheetNotes,
          }
        : t
    )

    setTimesheets(updatedTimesheets)
    
    setEditingTimesheetId(null)
    setEditTimesheetTechnician("")
    setEditTimesheetJob("")
    setEditTimesheetDate("")
    setEditTimesheetClockIn("")
    setEditTimesheetClockOut("")
    setEditTimesheetStatus("")
    setEditTimesheetNotes("")
  }

  const handleSelectAllTimesheets = (checked: boolean) => {
    if (checked) {
      setSelectedTimesheetIds(timesheets.map(t => t.id))
    } else {
      setSelectedTimesheetIds([])
    }
  }

  const handleSelectTimesheet = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedTimesheetIds([...selectedTimesheetIds, id])
    } else {
      setSelectedTimesheetIds(selectedTimesheetIds.filter(i => i !== id))
    }
  }

  const handleDeleteSelectedTimesheets = () => {
    if (selectedTimesheetIds.length === 0) return
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedTimesheetIds.length} timesheet(s)?`
    )
    
    if (confirmDelete) {
      const updatedTimesheets = timesheets.filter(t => !selectedTimesheetIds.includes(t.id))
      setTimesheets(updatedTimesheets)
      setSelectedTimesheetIds([])
    }
  }

  const getTimesheetStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "Pending":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      case "Approved":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "Rejected":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  // Export functionality
  const exportJobsToCSV = () => {
    try {
      const headers = ['Job ID', 'Title', 'Technician', 'Start Date', 'End Date', 'Status']
      const csvData = [
        headers.join(','),
        ...jobs.map(job => [
          job.id,
          `"${job.title}"`,
          `"${job.technician}"`,
          job.startDate,
          job.endDate,
          job.status
        ].join(','))
      ].join('\n')

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `jobs_export_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error exporting jobs:', error)
      alert('Failed to export jobs. Please try again.')
    }
  }

  const exportTimesheetsToCSV = () => {
    try {
      const headers = ['Timesheet ID', 'Date', 'Technician', 'Job ID', 'Job Title', 'Clock In', 'Clock Out', 'Hours', 'Status', 'Notes']
      const csvData = [
        headers.join(','),
        ...timesheets.map(timesheet => [
          timesheet.id,
          timesheet.date,
          `"${timesheet.technician}"`,
          timesheet.jobId,
          `"${timesheet.jobTitle}"`,
          timesheet.clockIn,
          timesheet.clockOut || '',
          timesheet.hours.toString(),
          timesheet.status,
          `"${timesheet.notes}"`
        ].join(','))
      ].join('\n')

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `timesheets_export_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error exporting timesheets:', error)
      alert('Failed to export timesheets. Please try again.')
    }
  }

  const exportPerformanceToPDF = () => {
    try {
      // Create a simple HTML report that can be printed as PDF
      const completionRate = ((jobs.filter(j => j.status === 'Completed').length / jobs.length) * 100).toFixed(1)
      const totalHours = timesheets.reduce((sum, t) => sum + calculateHours(t.clockIn, t.clockOut), 0).toFixed(1)
      const avgHoursPerJob = (parseFloat(totalHours) / jobs.length).toFixed(1)
      const activeTechnicians = technicians.filter(t => t.status === 'Active').length

      const reportContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Workforce Performance Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; }
            .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
            .metric-card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; }
            .metric-value { font-size: 2em; font-weight: bold; color: #2563eb; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .footer { margin-top: 30px; text-align: center; font-size: 0.9em; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Workforce Performance Report</h1>
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
          
          <div class="metrics">
            <div class="metric-card">
              <div class="metric-value">${completionRate}%</div>
              <div>Completion Rate</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${totalHours}h</div>
              <div>Total Hours Logged</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${avgHoursPerJob}h</div>
              <div>Avg Hours per Job</div>
            </div>
            <div class="metric-card">
              <div class="metric-value">${activeTechnicians}</div>
              <div>Active Technicians</div>
            </div>
          </div>

          <h2>Technician Performance</h2>
          <table>
            <thead>
              <tr>
                <th>Technician</th>
                <th>Jobs Completed</th>
                <th>Total Hours</th>
                <th>Avg Hours/Job</th>
                <th>Performance %</th>
              </tr>
            </thead>
            <tbody>
              ${technicians.map(tech => {
                const techJobs = jobs.filter(j => j.technician === tech.name);
                const completedJobs = techJobs.filter(j => j.status === 'Completed').length;
                const techTimesheets = timesheets.filter(t => t.technician === tech.name);
                const techTotalHours = techTimesheets.reduce((sum, t) => sum + calculateHours(t.clockIn, t.clockOut), 0);
                const techAvgHours = completedJobs > 0 ? techTotalHours / completedJobs : 0;
                const performance = completedJobs > 0 ? (completedJobs / techJobs.length) * 100 : 0;
                
                return `
                  <tr>
                    <td>${tech.name}</td>
                    <td>${completedJobs}/${techJobs.length}</td>
                    <td>${techTotalHours.toFixed(1)}h</td>
                    <td>${techAvgHours.toFixed(1)}h</td>
                    <td>${performance.toFixed(0)}%</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="footer">
            <p>Katana Workforce</p>
          </div>
        </body>
        </html>
      `

      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(reportContent)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
          printWindow.print()
        }, 250)
      }
    } catch (error) {
      console.error('Error generating performance report:', error)
      alert('Failed to generate performance report. Please try again.')
    }
  }

  // Geocode job addresses for map when on map tab (OpenStreetMap Nominatim - no API key)
  useEffect(() => {
    if (activePortal !== 'technician' || technicianTab !== 'map') {
      setJobMapMarkers([])
      return
    }
    if (jobs.length === 0) {
      setJobMapMarkers([])
      setMapLoaded(true)
      return
    }
    const jobsWithAddress = jobs.filter(j => {
      const addr = (j as { location_address?: string | null }).location_address
      return typeof addr === 'string' && addr.trim().length > 0
    })
    if (jobsWithAddress.length === 0) {
      setJobMapMarkers([])
      setMapGeocoding(false)
      setMapLoaded(true)
      return
    }
    let cancelled = false
    setMapGeocoding(true)
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    const geocode = async (address: string) => {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
        { headers: { Accept: 'application/json' } }
      )
      const data = await res.json()
      return Array.isArray(data) && data.length > 0 ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null
    }
    ;(async () => {
      const results: { jobId: string; lat: number; lng: number; title: string; status: string; address: string }[] = []
      for (const job of jobsWithAddress) {
        if (cancelled) break
        const address = (job as { location_address?: string | null }).location_address!.trim()
        try {
          const coords = await geocode(address)
          if (coords) {
            results.push({
              jobId: job.id,
              lat: coords.lat,
              lng: coords.lng,
              title: job.title,
              status: job.status,
              address,
            })
          }
          await delay(1100)
        } catch {
          // skip failed geocode
        }
      }
      if (!cancelled) {
        setJobMapMarkers(results)
        setMapLoaded(true)
      }
      setMapGeocoding(false)
    })()
    return () => { cancelled = true }
  }, [activePortal, technicianTab, jobs])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Assigned":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "Unassigned":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20"
      case "In Progress":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      case "Completed":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "Overdue":
        return "bg-red-500/10 text-red-500 border-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  return (
    <div className="min-h-screen bg-background p-6 border-0">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 px-6 mb-6">
        <div className="py-6">
          <div className="flex items-center justify-between">
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <span className="hover:text-foreground cursor-pointer transition-colors">Home</span>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground">Katana Workforce</span>
              </div>
              
              {/* Title with Icon */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg">
                  <MapPin className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">Katana Workforce</h1>
              </div>
              
              <p className="text-muted-foreground mt-2">TaskBeacon - Field service management</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant={activePortal === "admin" ? "default" : "outline"}
                onClick={() => setActivePortal("admin")}
              >
                <Settings className="h-4 w-4 mr-2" />
                Admin Console
              </Button>
              <Button
                variant={activePortal === "technician" ? "default" : "outline"}
                onClick={() => setActivePortal("technician")}
              >
                <Users className="h-4 w-4 mr-2" />
                Technician Portal
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Portal */}
      {activePortal === "admin" && (
        <div>
          {/* Stats – one rectangular bar */}
          <Card className="overflow-hidden border-border bg-card/50 mb-6">
            <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
              <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">Total Jobs</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : totalJobs}
                  </p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">Active Technicians</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : activeTechnicians}
                  </p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">Assigned Jobs</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : assignedJobs}
                  </p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : inProgressJobs}
                  </p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">Completed This Week</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : completedThisWeek}
                  </p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">Overdue Jobs</p>
                  <p className="text-2xl font-bold tabular-nums text-red-500">
                    {loading ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : overdueJobs}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
              <TabsTrigger value="technicians">Technicians</TabsTrigger>
              <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Jobs Management Table */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Jobs Management</CardTitle>
                      <div className="flex gap-2">
                        {selectedJobIds.length > 0 && (
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={handleDeleteSelected}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete ({selectedJobIds.length})
                          </Button>
                        )}
                        <Dialog open={isCreateJobOpen} onOpenChange={setIsCreateJobOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm">
                              <Plus className="h-4 w-4 mr-2" />
                              New Job
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Create New Job</DialogTitle>
                              <DialogDescription>Add a new job to the system</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="job-title">Job Title *</Label>
                                <Input 
                                  id="job-title" 
                                  placeholder="Enter job title"
                                  value={newJobTitle}
                                  onChange={(e) => setNewJobTitle(e.target.value)}
                                />
                              </div>
                              <div>
                                <Label htmlFor="job-description">Description</Label>
                                <Textarea 
                                  id="job-description" 
                                  placeholder="Enter job description"
                                  value={newJobDescription}
                                  onChange={(e) => setNewJobDescription(e.target.value)}
                                />
                              </div>
                              <div>
                                <Label htmlFor="job-address">Address (optional)</Label>
                                <Input 
                                  id="job-address" 
                                  placeholder="Street, city, state, zip"
                                  value={newJobAddress}
                                  onChange={(e) => setNewJobAddress(e.target.value)}
                                />
                              </div>
                              <div>
                                <Label htmlFor="dashboard-job-technician">Assign Technician</Label>
                                <Select value={newJobTechnician} onValueChange={setNewJobTechnician}>
                                  <SelectTrigger id="dashboard-job-technician">
                                    <SelectValue placeholder="Select technician" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Unassigned">Unassigned</SelectItem>
                                    {technicians.map((tech) => (
                                      <SelectItem key={tech.name} value={tech.name}>
                                        {tech.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="start-date">Start Date *</Label>
                                  <Input 
                                    id="start-date" 
                                    type="date"
                                    value={newJobStartDate}
                                    onChange={(e) => setNewJobStartDate(e.target.value)}
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="end-date">End Date *</Label>
                                  <Input 
                                    id="end-date" 
                                    type="date"
                                    value={newJobEndDate}
                                    onChange={(e) => setNewJobEndDate(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div>
                                <Label htmlFor="job-status">Status</Label>
                                <Select value={newJobStatus} onValueChange={setNewJobStatus}>
                                  <SelectTrigger id="job-status">
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Unassigned">Unassigned</SelectItem>
                                    <SelectItem value="Assigned">Assigned</SelectItem>
                                    <SelectItem value="In Progress">In Progress</SelectItem>
                                    <SelectItem value="Completed">Completed</SelectItem>
                                    <SelectItem value="Overdue">Overdue</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button className="w-full" onClick={handleCreateJob}>Create Job</Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedJobIds.length === jobs.length && jobs.length > 0}
                              onCheckedChange={handleSelectAll}
                            />
                          </TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Technician</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobs.map((job) => (
                          <TableRow
                            key={job.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => openEditJob(job)}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={selectedJobIds.includes(job.id)}
                                onCheckedChange={(checked) => handleSelectJob(job.id, checked as boolean)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{job.id}</TableCell>
                            <TableCell>{job.title}</TableCell>
                            <TableCell>{job.technician}</TableCell>
                            <TableCell>{job.startDate}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getStatusColor(job.status)}>
                                {job.status}
                              </Badge>
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => openEditJob(job)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Right Column */}
                <div className="space-y-6">
                  {/* Quick Stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Quick Stats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Jobs This Week</span>
                        <span className="font-bold">{loading ? '–' : jobsThisWeek}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Jobs This Month</span>
                        <span className="font-bold">{loading ? '–' : jobsThisMonth}</span>
                      </div>
                      <div className="pt-2 border-t">
                        <p className="text-sm font-medium mb-2">Top Performers</p>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {loading ? (
                            <div>–</div>
                          ) : topPerformers.length === 0 ? (
                            <div>No completed jobs yet</div>
                          ) : (
                            topPerformers.map((p) => (
                              <div key={p.name}>{p.name} ({p.count} jobs)</div>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="pt-2 border-t">
                        <div className="flex items-center gap-2 text-red-500">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {loading ? '–' : `${jobsNeedingAttention} job${jobsNeedingAttention !== 1 ? 's' : ''} need attention`}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Activity */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {loading ? (
                          <div className="text-sm text-muted-foreground">Loading…</div>
                        ) : recentActivity.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No recent activity</div>
                        ) : (
                          recentActivity.map((activity, index) => (
                            <div key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                              <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                              <span>{activity}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Edit Job Dialog for Dashboard */}
              <Dialog open={!!editingJob} onOpenChange={(open) => !open && setEditingJob(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Job</DialogTitle>
                    <DialogDescription>Update job information</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="dashboard-edit-job-title">Job Title *</Label>
                      <Input 
                        id="dashboard-edit-job-title" 
                        value={editJobTitle}
                        onChange={(e) => setEditJobTitle(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="dashboard-edit-job-technician">Assign Technician</Label>
                      <Select
                        value={editJobTechnician || 'Unassigned'}
                        onValueChange={(v) => {
                          setEditJobTechnician(v)
                          setEditJobTechnicianId(v === 'Unassigned' ? null : getTechnicianIdByName(v) ?? null)
                        }}
                      >
                        <SelectTrigger id="dashboard-edit-job-technician">
                          <SelectValue placeholder="Select technician" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Unassigned">Unassigned</SelectItem>
                          {technicians.map((tech) => (
                            <SelectItem key={(tech as { id?: string }).id ?? tech.name} value={tech.name}>
                              {tech.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="dashboard-edit-job-start">Start Date *</Label>
                        <Input 
                          id="dashboard-edit-job-start" 
                          value={editJobStartDate}
                          onChange={(e) => setEditJobStartDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="dashboard-edit-job-end">End Date *</Label>
                        <Input 
                          id="dashboard-edit-job-end" 
                          value={editJobEndDate}
                          onChange={(e) => setEditJobEndDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="dashboard-edit-job-status">Status</Label>
                      <Select value={editJobStatus} onValueChange={setEditJobStatus}>
                        <SelectTrigger id="dashboard-edit-job-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Assigned">Assigned</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="dashboard-edit-job-address">Address (optional)</Label>
                      <Input
                        id="dashboard-edit-job-address"
                        value={editJobLocation}
                        onChange={(e) => setEditJobLocation(e.target.value)}
                        placeholder="Street, city, state, zip"
                      />
                    </div>
                    <Button className="w-full" onClick={handleSaveJobEdit}>
                      Save Changes
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="schedule">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Schedule Calendar</CardTitle>
                      <CardDescription>View and manage job schedules</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={previousMonth}>
                        ← Previous
                      </Button>
                      <Button variant="outline" size="sm" onClick={goToToday}>
                        Today
                      </Button>
                      <Button variant="outline" size="sm" onClick={nextMonth}>
                        Next →
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Calendar Header */}
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-center">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {/* Day Headers */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
                        {day}
                      </div>
                    ))}

                    {/* Calendar Days */}
                    {(() => {
                      const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth)
                      const days = []
                      
                      // Empty cells for days before month starts
                      for (let i = 0; i < startingDayOfWeek; i++) {
                        days.push(
                          <div key={`empty-${i}`} className="min-h-24 p-2 border rounded-lg bg-muted/20" />
                        )
                      }
                      
                      // Days of the month
                      for (let day = 1; day <= daysInMonth; day++) {
                        const date = new Date(year, month, day)
                        const { starting, due, all: dayJobs } = getJobsForDate(date)
                        const isToday = new Date().toDateString() === date.toDateString()
                        const isDragOver = dragOverDate?.toDateString() === date.toDateString()
                        const maxShow = 3
                        const startingShow = starting.slice(0, 2)
                        const dueShow = due.slice(0, 2)
                        const totalShown = Math.min(dayJobs.length, maxShow)

                        days.push(
                          <div
                            key={day}
                            className={`min-h-24 p-2 border rounded-lg hover:bg-accent transition-colors cursor-pointer ${
                              isToday ? 'border-primary bg-primary/5' : ''
                            } ${
                              isDragOver ? 'bg-blue-100 border-blue-300 border-2' : ''
                            }`}
                            onClick={() => handleCellClick(date)}
                            onDragOver={(e) => handleDragOver(e, date)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, date)}
                          >
                            <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-primary' : ''}`}>
                              {day}
                            </div>
                            <div className="space-y-1">
                              {startingShow.map((job) => (
                                <div
                                  key={`s-${job.id}`}
                                  className={`text-xs p-1 rounded truncate font-medium cursor-move hover:opacity-80 transition-opacity ${
                                    job.status === 'In Progress' ? 'bg-yellow-400 text-yellow-900' :
                                    job.status === 'Completed' ? 'bg-green-400 text-green-900' :
                                    job.status === 'Overdue' ? 'bg-red-400 text-red-900' :
                                    job.status === 'Unassigned' ? 'bg-amber-400 text-amber-900' :
                                    'bg-blue-400 text-blue-900'
                                  } ${draggedJob?.id === job.id ? 'opacity-50' : ''}`}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, job)}
                                  onClick={(e) => { e.stopPropagation(); setViewingCalendarJob(job) }}
                                >
                                  <span className="text-[10px] opacity-90 mr-0.5">Start</span> {job.title}
                                </div>
                              ))}
                              {dueShow.map((job) => (
                                <div
                                  key={`d-${job.id}`}
                                  className={`text-xs p-1 rounded truncate font-medium cursor-move hover:opacity-80 transition-opacity border-l-2 border-amber-500 ${
                                    job.status === 'Completed' ? 'bg-green-300 text-green-900' :
                                    job.status === 'Overdue' ? 'bg-red-400 text-red-900' :
                                    'bg-amber-100 text-amber-900'
                                  } ${draggedJob?.id === job.id ? 'opacity-50' : ''}`}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, job)}
                                  onClick={(e) => { e.stopPropagation(); setViewingCalendarJob(job) }}
                                >
                                  <span className="text-[10px] opacity-90 mr-0.5">Due</span> {job.title}
                                </div>
                              ))}
                              {dayJobs.length > maxShow && (
                                <div
                                  className="text-xs text-muted-foreground cursor-pointer hover:text-foreground"
                                  onClick={(e) => { e.stopPropagation(); setSelectedDate(date) }}
                                >
                                  +{dayJobs.length - maxShow} more
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      }
                      
                      return days
                    })()}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                    <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded bg-blue-400" /> Start = job starts this day</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded bg-amber-400 border-l-2 border-amber-600" /> Due = job due this day</span>
                  </div>
                </CardContent>
              </Card>

              {/* Job Detail Dialog */}
              <Dialog open={!!viewingCalendarJob} onOpenChange={() => setViewingCalendarJob(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{viewingCalendarJob?.title}</DialogTitle>
                    <DialogDescription>Job Details</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Job ID</Label>
                        <p className="font-medium">{viewingCalendarJob?.id}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Status</Label>
                        <div className="mt-1">
                          <Badge variant="outline" className={getStatusColor(viewingCalendarJob?.status || '')}>
                            {viewingCalendarJob?.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-muted-foreground">Assigned Technician</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium">{viewingCalendarJob?.technician}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Start Date</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{viewingCalendarJob?.startDate}</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">End Date</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{viewingCalendarJob?.endDate}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-muted-foreground">Location</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium">123 Main St, City, State 12345</p>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button 
                        className="flex-1"
                        onClick={() => {
                          const job = viewingCalendarJob
                          setEditingCalendarJob(job)
                          setEditJobTitle(job.title)
                          setEditJobTechnician(job.technician || 'Unassigned')
                          setEditJobTechnicianId((job as { technician_id?: string | null }).technician_id ?? null)
                          setEditJobStartDate(job.startDate)
                          setEditJobEndDate(job.endDate)
                          setEditJobStatus(job.status)
                          setEditJobLocation((job as { location_address?: string | null; location?: string }).location_address ?? (job as { location?: string }).location ?? '')
                          setEditJobNotes("")
                          setViewingCalendarJob(null)
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Job
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={async () => {
                          if (!window.confirm(`Are you sure you want to delete "${viewingCalendarJob?.title}"?`)) return
                          const dbId = (viewingCalendarJob as { dbId?: string } | null)?.dbId
                          if (isSupabaseConfigured && dbId) {
                            const ok = await deleteJob(dbId)
                            if (ok) {
                              setViewingCalendarJob(null)
                              await fetchData()
                            } else {
                              alert('Failed to delete job. Please try again.')
                            }
                          } else {
                            const updatedJobs = jobs.filter((j) => j.id !== viewingCalendarJob?.id)
                            setJobs(updatedJobs)
                            setDbJobs(updatedJobs as Job[])
                            setViewingCalendarJob(null)
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                      <Button variant="outline" onClick={() => setViewingCalendarJob(null)}>
                        Close
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Edit Job Dialog */}
              <Dialog open={!!editingCalendarJob} onOpenChange={() => setEditingCalendarJob(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Job - {editingCalendarJob?.id}</DialogTitle>
                    <DialogDescription>Update job details</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-cal-job-title">Job Title</Label>
                      <Input 
                        id="edit-cal-job-title" 
                        value={editJobTitle}
                        onChange={(e) => setEditJobTitle(e.target.value)}
                        placeholder="Enter job title" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-cal-job-technician">Assigned Technician</Label>
                      <Select
                        value={editJobTechnician || 'Unassigned'}
                        onValueChange={(v) => {
                          setEditJobTechnician(v)
                          setEditJobTechnicianId(v === 'Unassigned' ? null : getTechnicianIdByName(v) ?? null)
                        }}
                      >
                        <SelectTrigger id="edit-cal-job-technician">
                          <SelectValue placeholder="Select technician" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Unassigned">Unassigned</SelectItem>
                          {technicians.map((tech) => (
                            <SelectItem key={(tech as { id?: string }).id ?? tech.name} value={tech.name}>
                              {tech.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-cal-start-date">Start Date</Label>
                        <Input 
                          id="edit-cal-start-date" 
                          value={editJobStartDate}
                          onChange={(e) => setEditJobStartDate(e.target.value)}
                          placeholder="Enter start date"
                        />
                      </div>
                      <div>
                        <Label htmlFor="edit-cal-end-date">End Date</Label>
                        <Input 
                          id="edit-cal-end-date" 
                          value={editJobEndDate}
                          onChange={(e) => setEditJobEndDate(e.target.value)}
                          placeholder="Enter end date"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="edit-cal-job-status">Status</Label>
                      <Select value={editJobStatus} onValueChange={setEditJobStatus}>
                        <SelectTrigger id="edit-cal-job-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Assigned">Assigned</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-cal-job-location">Address (optional)</Label>
                      <Input 
                        id="edit-cal-job-location" 
                        value={editJobLocation}
                        onChange={(e) => setEditJobLocation(e.target.value)}
                        placeholder="Street, city, state, zip" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-cal-job-notes">Notes</Label>
                      <Textarea 
                        id="edit-cal-job-notes" 
                        value={editJobNotes}
                        onChange={(e) => setEditJobNotes(e.target.value)}
                        placeholder="Add any additional notes"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button className="flex-1" onClick={handleSaveCalendarJob}>
                        Save Changes
                      </Button>
                      <Button variant="outline" onClick={() => setEditingCalendarJob(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* All Jobs for Date Dialog */}
              <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      Jobs for {selectedDate?.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </DialogTitle>
                    <DialogDescription>All scheduled jobs for this date</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {selectedDate && getJobsForDate(selectedDate).all.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No jobs scheduled for this date
                      </p>
                    ) : (
                      selectedDate && (() => {
                        const { starting, due, all } = getJobsForDate(selectedDate)
                        return all.map((job) => {
                          const isStart = starting.some(j => j.id === job.id)
                          const isDue = due.some(j => j.id === job.id)
                          const sameDay = job.startDate === job.endDate
                          const label = isStart && (isDue || sameDay) ? 'Starts & Due' : isStart ? 'Starts' : 'Due'
                          return (
                            <Card
                              key={job.id}
                              className="cursor-pointer hover:shadow-md transition-shadow"
                              onClick={() => {
                                setSelectedDate(null)
                                setViewingCalendarJob(job)
                              }}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-semibold">{job.title}</h4>
                                      <Badge variant="secondary" className="text-[10px]">{label}</Badge>
                                    </div>
                                    <div className="space-y-1 text-sm text-muted-foreground">
                                      <div className="flex items-center gap-2">
                                        <Users className="h-3 w-3" />
                                        <span>{job.technician}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Briefcase className="h-3 w-3" />
                                        <span>{job.id}</span>
                                        {job.startDate && job.endDate && (
                                          <span> · {job.startDate} → {job.endDate}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className={getStatusColor(job.status)}>
                                    {job.status}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })
                      })()
                    )}
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button variant="outline" onClick={() => setSelectedDate(null)}>
                      Close
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Quick Create Job Dialog */}
              {isQuickCreateOpen && (
                <Dialog open={true} onOpenChange={() => {
                  setIsQuickCreateOpen(false)
                  setQuickCreateDate(null)
                  setNewJobTitle("")
                  setNewJobTechnician("")
                  setNewJobStatus("Assigned")
                }}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Quick Create Job</DialogTitle>
                      <DialogDescription>
                        Create a new job for {quickCreateDate?.toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'long', 
                          day: 'numeric', 
                          year: 'numeric' 
                        }) || 'selected date'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="quick-job-title">Job Title *</Label>
                        <Input 
                          id="quick-job-title" 
                          placeholder="Enter job title"
                          value={newJobTitle}
                          onChange={(e) => setNewJobTitle(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div>
                        <Label htmlFor="quick-job-technician">Assign Technician</Label>
                        <Select value={newJobTechnician} onValueChange={setNewJobTechnician}>
                          <SelectTrigger id="quick-job-technician">
                            <SelectValue placeholder="Select technician" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Unassigned">Unassigned</SelectItem>
                            {technicians.map((tech) => (
                              <SelectItem key={tech.name} value={tech.name}>
                                {tech.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="quick-job-status">Status</Label>
                        <Select value={newJobStatus} onValueChange={setNewJobStatus}>
                          <SelectTrigger id="quick-job-status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Unassigned">Unassigned</SelectItem>
                            <SelectItem value="Assigned">Assigned</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="Overdue">Overdue</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button className="flex-1" onClick={handleQuickCreateJob}>
                          Create Job
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setIsQuickCreateOpen(false)
                          setQuickCreateDate(null)
                          setNewJobTitle("")
                          setNewJobTechnician("")
                          setNewJobStatus("Assigned")
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>

            <TabsContent value="jobs">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>All Jobs</CardTitle>
                      <CardDescription>Manage all jobs in the system</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedJobIds.length > 0 && (
                        <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete ({selectedJobIds.length})
                        </Button>
                      )}
                      <Dialog open={isCreateJobOpen} onOpenChange={setIsCreateJobOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Job
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Create New Job</DialogTitle>
                            <DialogDescription>Add a new job to the system</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="jobs-tab-title">Job Title *</Label>
                              <Input 
                                id="jobs-tab-title" 
                                placeholder="Enter job title"
                                value={newJobTitle}
                                onChange={(e) => setNewJobTitle(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="jobs-tab-description">Description</Label>
                              <Textarea 
                                id="jobs-tab-description" 
                                placeholder="Enter job description"
                                value={newJobDescription}
                                onChange={(e) => setNewJobDescription(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="jobs-tab-address">Address (optional)</Label>
                              <Input 
                                id="jobs-tab-address" 
                                placeholder="Street, city, state, zip"
                                value={newJobAddress}
                                onChange={(e) => setNewJobAddress(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="jobs-tab-technician">Assign Technician</Label>
                              <Select value={newJobTechnician} onValueChange={setNewJobTechnician}>
                                <SelectTrigger id="jobs-tab-technician">
                                  <SelectValue placeholder="Select technician" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Unassigned">Unassigned</SelectItem>
                                  {technicians.map((tech) => (
                                    <SelectItem key={tech.name} value={tech.name}>
                                      {tech.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label htmlFor="jobs-tab-start-date">Start Date *</Label>
                                <Input 
                                  id="jobs-tab-start-date" 
                                  type="date"
                                  value={newJobStartDate}
                                  onChange={(e) => setNewJobStartDate(e.target.value)}
                                />
                              </div>
                              <div>
                                <Label htmlFor="jobs-tab-end-date">End Date *</Label>
                                <Input 
                                  id="jobs-tab-end-date" 
                                  type="date"
                                  value={newJobEndDate}
                                  onChange={(e) => setNewJobEndDate(e.target.value)}
                                />
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="jobs-tab-status">Status</Label>
                              <Select value={newJobStatus} onValueChange={setNewJobStatus}>
                                <SelectTrigger id="jobs-tab-status">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Assigned">Assigned</SelectItem>
                                  <SelectItem value="In Progress">In Progress</SelectItem>
                                  <SelectItem value="Completed">Completed</SelectItem>
                                  <SelectItem value="Overdue">Overdue</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button className="w-full" onClick={handleCreateJob}>Create Job</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedJobIds.length === jobs.length && jobs.length > 0}
                            onCheckedChange={handleSelectAll}
                          />
                        </TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Technician</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow
                          key={job.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openEditJob(job)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedJobIds.includes(job.id)}
                              onCheckedChange={(checked) => handleSelectJob(job.id, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{job.id}</TableCell>
                          <TableCell>{job.title}</TableCell>
                          <TableCell>{job.technician}</TableCell>
                          <TableCell>{job.startDate}</TableCell>
                          <TableCell>{job.endDate}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(job.status)}>
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEditJob(job)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setViewingJobLocation(job.id)}>
                                <MapPin className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Edit Job Dialog */}
                  <Dialog open={!!editingJob} onOpenChange={(open) => !open && setEditingJob(null)}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Job</DialogTitle>
                        <DialogDescription>Update job information</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="edit-job-title">Job Title *</Label>
                          <Input 
                            id="edit-job-title" 
                            value={editJobTitle}
                            onChange={(e) => setEditJobTitle(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-job-technician">Assign Technician</Label>
                          <Select
                            value={editJobTechnician || 'Unassigned'}
                            onValueChange={(v) => {
                              setEditJobTechnician(v)
                              setEditJobTechnicianId(v === 'Unassigned' ? null : getTechnicianIdByName(v) ?? null)
                            }}
                          >
                            <SelectTrigger id="edit-job-technician">
                              <SelectValue placeholder="Select technician" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Unassigned">Unassigned</SelectItem>
                              {technicians.map((tech) => (
                                <SelectItem key={(tech as { id?: string }).id ?? tech.name} value={tech.name}>
                                  {tech.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="edit-job-start">Start Date *</Label>
                            <Input 
                              id="edit-job-start" 
                              value={editJobStartDate}
                              onChange={(e) => setEditJobStartDate(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="edit-job-end">End Date *</Label>
                            <Input 
                              id="edit-job-end" 
                              value={editJobEndDate}
                              onChange={(e) => setEditJobEndDate(e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="edit-job-status">Status</Label>
                          <Select value={editJobStatus} onValueChange={setEditJobStatus}>
                            <SelectTrigger id="edit-job-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Unassigned">Unassigned</SelectItem>
                              <SelectItem value="Assigned">Assigned</SelectItem>
                              <SelectItem value="In Progress">In Progress</SelectItem>
                              <SelectItem value="Completed">Completed</SelectItem>
                              <SelectItem value="Overdue">Overdue</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button className="w-full" onClick={handleSaveJobEdit}>
                          Save Changes
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* View Location Dialog */}
                  <Dialog open={!!viewingJobLocation} onOpenChange={(open) => !open && setViewingJobLocation(null)}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Job Location</DialogTitle>
                        <DialogDescription>View job location on map</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        {viewingJobLocation && jobs.find(j => j.id === viewingJobLocation) && (
                          <>
                            <div>
                              <p className="text-sm font-medium">Job: {jobs.find(j => j.id === viewingJobLocation)?.title}</p>
                              <p className="text-sm text-muted-foreground">ID: {viewingJobLocation}</p>
                            </div>
                            <div className="bg-muted rounded-lg p-8 text-center">
                              <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">Map integration would show here</p>
                              <p className="text-xs text-muted-foreground mt-2">Location: 123 Main St, City, State</p>
                            </div>
                            <Button className="w-full" onClick={() => setViewingJobLocation(null)}>
                              Close
                            </Button>
                          </>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="technicians">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Technician Management</CardTitle>
                      <CardDescription>Manage your field technicians</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedTechnicianIndices.length > 0 && (
                        <Button variant="destructive" size="sm" onClick={handleDeleteSelectedTechnicians}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete ({selectedTechnicianIndices.length})
                        </Button>
                      )}
                      <Dialog open={isAddTechnicianOpen} onOpenChange={setIsAddTechnicianOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add Technician
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add New Technician</DialogTitle>
                            <DialogDescription>Create a new technician account</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="tech-name">Full Name *</Label>
                              <Input 
                                id="tech-name" 
                                placeholder="Enter full name"
                                value={newTechName}
                                onChange={(e) => setNewTechName(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="tech-phone">Phone *</Label>
                              <Input 
                                id="tech-phone" 
                                placeholder="(555) 123-4567"
                                value={newTechPhone}
                                onChange={(e) => handlePhoneChange(e.target.value)}
                                maxLength={14}
                              />
                            </div>
                            <div>
                              <Label htmlFor="tech-email">Email</Label>
                              <Input 
                                id="tech-email" 
                                type="email" 
                                placeholder="email@example.com"
                                value={newTechEmail}
                                onChange={(e) => setNewTechEmail(e.target.value)}
                              />
                            </div>
                            <Button className="w-full" onClick={handleAddTechnician}>Create Technician</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedTechnicianIndices.length === technicians.length && technicians.length > 0}
                            onCheckedChange={handleSelectAllTechnicians}
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Active Jobs</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {technicians.map((tech, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Checkbox
                              checked={selectedTechnicianIndices.includes(index)}
                              onCheckedChange={(checked) => handleSelectTechnician(index, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{tech.name}</TableCell>
                          <TableCell>{tech.phone}</TableCell>
                          <TableCell>{tech.activeJobs}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                              {tech.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleEditTechnician(index)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Edit Technician Dialog */}
                  <Dialog open={editingTechnicianIndex !== null} onOpenChange={(open) => !open && setEditingTechnicianIndex(null)}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Technician</DialogTitle>
                        <DialogDescription>Update technician information</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="edit-tech-name">Full Name *</Label>
                          <Input 
                            id="edit-tech-name" 
                            placeholder="Enter full name"
                            value={editTechName}
                            onChange={(e) => setEditTechName(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-tech-phone">Phone *</Label>
                          <Input 
                            id="edit-tech-phone" 
                            placeholder="(555) 123-4567"
                            value={editTechPhone}
                            onChange={(e) => handleEditPhoneChange(e.target.value)}
                            maxLength={14}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-tech-status">Status</Label>
                          <Select value={editTechStatus} onValueChange={setEditTechStatus}>
                            <SelectTrigger id="edit-tech-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Active">Active</SelectItem>
                              <SelectItem value="Inactive">Inactive</SelectItem>
                              <SelectItem value="On Leave">On Leave</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button className="w-full" onClick={handleSaveTechnician}>Save Changes</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timesheets">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Time Tracking</CardTitle>
                      <CardDescription>Monitor technician hours and timesheets</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedTimesheetIds.length > 0 && (
                        <Button variant="destructive" size="sm" onClick={handleDeleteSelectedTimesheets}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete ({selectedTimesheetIds.length})
                        </Button>
                      )}
                      <Dialog open={isAddTimesheetOpen} onOpenChange={setIsAddTimesheetOpen}>
                        <DialogTrigger asChild>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Entry
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Timesheet Entry</DialogTitle>
                            <DialogDescription>Record time for a technician</DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="timesheet-tech">Technician *</Label>
                              <Select value={newTimesheetTechnician} onValueChange={setNewTimesheetTechnician}>
                                <SelectTrigger id="timesheet-tech">
                                  <SelectValue placeholder="Select technician" />
                                </SelectTrigger>
                                <SelectContent>
                                  {technicians.map((tech, index) => (
                                    <SelectItem key={index} value={tech.name}>{tech.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="timesheet-job">Job *</Label>
                              <Select value={newTimesheetJob} onValueChange={setNewTimesheetJob}>
                                <SelectTrigger id="timesheet-job">
                                  <SelectValue placeholder="Select job" />
                                </SelectTrigger>
                                <SelectContent>
                                  {jobs.map((job) => (
                                    <SelectItem key={job.id} value={job.title}>{job.title}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="timesheet-date">Date *</Label>
                              <Input 
                                id="timesheet-date" 
                                type="date"
                                value={newTimesheetDate}
                                onChange={(e) => setNewTimesheetDate(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="timesheet-clock-in">Clock In *</Label>
                              <Input 
                                id="timesheet-clock-in" 
                                type="time"
                                value={newTimesheetClockIn}
                                onChange={(e) => setNewTimesheetClockIn(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="timesheet-clock-out">Clock Out</Label>
                              <Input 
                                id="timesheet-clock-out" 
                                type="time"
                                value={newTimesheetClockOut}
                                onChange={(e) => setNewTimesheetClockOut(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="timesheet-notes">Notes</Label>
                              <Textarea 
                                id="timesheet-notes" 
                                placeholder="Additional notes"
                                value={newTimesheetNotes}
                                onChange={(e) => setNewTimesheetNotes(e.target.value)}
                              />
                            </div>
                            <Button className="w-full" onClick={handleAddTimesheet}>Add Entry</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                          {timesheets.filter(t => t.status === 'Clocked In').length}
                        </div>
                        <p className="text-sm text-muted-foreground">Active Clock-ins</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                          {timesheets
                            .filter(t => new Date(t.date).toDateString() === new Date().toDateString())
                            .reduce((sum, t) => sum + calculateHours(t.clockIn, t.clockOut), 0)
                            .toFixed(1)}
                        </div>
                        <p className="text-sm text-muted-foreground">Hours Today</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold">
                          {timesheets.reduce((sum, t) => sum + calculateHours(t.clockIn, t.clockOut), 0).toFixed(1)}
                        </div>
                        <p className="text-sm text-muted-foreground">Total Hours</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-yellow-500">
                          {timesheets.filter(t => t.status === 'Pending Approval').length}
                        </div>
                        <p className="text-sm text-muted-foreground">Pending Approval</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedTimesheetIds.length === timesheets.length && timesheets.length > 0}
                            onCheckedChange={handleSelectAllTimesheets}
                          />
                        </TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Technician</TableHead>
                        <TableHead>Job</TableHead>
                        <TableHead>Clock In</TableHead>
                        <TableHead>Clock Out</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timesheets.map((timesheet) => (
                        <TableRow key={timesheet.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedTimesheetIds.includes(timesheet.id)}
                              onCheckedChange={(checked) => handleSelectTimesheet(timesheet.id, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell>{new Date(timesheet.date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">{timesheet.technician}</TableCell>
                          <TableCell>{timesheet.jobTitle}</TableCell>
                          <TableCell>{timesheet.clockIn}</TableCell>
                          <TableCell>{timesheet.clockOut || '-'}</TableCell>
                          <TableCell>{calculateHours(timesheet.clockIn, timesheet.clockOut).toFixed(1)}h</TableCell>
                          <TableCell>
                            <Badge className={getTimesheetStatusColor(timesheet.status)}>
                              {timesheet.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleEditTimesheet(timesheet.id)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Edit Timesheet Dialog */}
                  <Dialog open={editingTimesheetId !== null} onOpenChange={(open) => !open && setEditingTimesheetId(null)}>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Edit Timesheet Entry</DialogTitle>
                        <DialogDescription>Update timesheet information</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="edit-timesheet-tech">Technician</Label>
                          <Input 
                            id="edit-timesheet-tech" 
                            value={editTimesheetTechnician}
                            disabled
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-timesheet-job">Job</Label>
                          <Input 
                            id="edit-timesheet-job" 
                            value={editTimesheetJob}
                            disabled
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-timesheet-date">Date</Label>
                          <Input 
                            id="edit-timesheet-date" 
                            type="date"
                            value={editTimesheetDate}
                            onChange={(e) => setEditTimesheetDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-timesheet-clock-in">Clock In</Label>
                          <Input 
                            id="edit-timesheet-clock-in" 
                            type="time"
                            value={editTimesheetClockIn}
                            onChange={(e) => setEditTimesheetClockIn(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-timesheet-clock-out">Clock Out</Label>
                          <Input 
                            id="edit-timesheet-clock-out" 
                            type="time"
                            value={editTimesheetClockOut}
                            onChange={(e) => setEditTimesheetClockOut(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="edit-timesheet-status">Status</Label>
                          <Select value={editTimesheetStatus} onValueChange={setEditTimesheetStatus}>
                            <SelectTrigger id="edit-timesheet-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Clocked In">Clocked In</SelectItem>
                              <SelectItem value="Clocked Out">Clocked Out</SelectItem>
                              <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                              <SelectItem value="Approved">Approved</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="edit-timesheet-notes">Notes</Label>
                          <Textarea 
                            id="edit-timesheet-notes" 
                            value={editTimesheetNotes}
                            onChange={(e) => setEditTimesheetNotes(e.target.value)}
                          />
                        </div>
                        <Button className="w-full" onClick={handleSaveTimesheet}>Save Changes</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports">
                <Card>
                  <CardHeader>
                  <CardTitle>Reports & Analytics</CardTitle>
                  <CardDescription>View performance metrics and export data</CardDescription>
                  </CardHeader>
                <CardContent className="pt-0">
                  <Tabs defaultValue="performance" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto flex-wrap gap-1 bg-muted/50 p-1 mb-6">
                      <TabsTrigger value="performance" className="text-sm">
                        Performance Overview
                      </TabsTrigger>
                      <TabsTrigger value="technicians" className="text-sm">
                        Technician Performance
                      </TabsTrigger>
                      <TabsTrigger value="job-status" className="text-sm">
                        Job Status Breakdown
                      </TabsTrigger>
                      <TabsTrigger value="timesheet-status" className="text-sm">
                        Timesheet Status
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="performance" className="mt-0 min-h-[200px]">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-2xl font-bold text-green-500">
                                {jobs.length > 0 ? ((jobs.filter(j => j.status === 'Completed').length / jobs.length) * 100).toFixed(1) : "0"}%
                          </div>
                          <p className="text-sm text-muted-foreground">Completion Rate</p>
                            </div>
                            <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-2xl font-bold">
                            {timesheets.reduce((sum, t) => sum + calculateHours(t.clockIn, t.clockOut), 0).toFixed(1)}h
                          </div>
                          <p className="text-sm text-muted-foreground">Total Hours Logged</p>
                            </div>
                            <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-2xl font-bold">
                                {jobs.length > 0 ? (timesheets.reduce((sum, t) => sum + calculateHours(t.clockIn, t.clockOut), 0) / jobs.length).toFixed(1) : "0"}h
                          </div>
                          <p className="text-sm text-muted-foreground">Avg Hours per Job</p>
                            </div>
                            <div className="rounded-lg border bg-muted/30 p-4">
                          <div className="text-2xl font-bold text-blue-500">
                            {technicians.filter(t => t.status === 'Active').length}
                          </div>
                          <p className="text-sm text-muted-foreground">Active Technicians</p>
                    </div>
                          </div>
                        </TabsContent>
                        <TabsContent value="technicians" className="mt-0">
                          <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Technician</TableHead>
                          <TableHead>Jobs Completed</TableHead>
                          <TableHead>Total Hours</TableHead>
                          <TableHead>Avg Hours/Job</TableHead>
                          <TableHead>Performance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {technicians.map((tech, index) => {
                          const techJobs = jobs.filter(j => j.technician === tech.name);
                          const completedJobs = techJobs.filter(j => j.status === 'Completed').length;
                          const techTimesheets = timesheets.filter(t => t.technician === tech.name);
                          const totalHours = techTimesheets.reduce((sum, t) => sum + calculateHours(t.clockIn, t.clockOut), 0);
                          const avgHours = completedJobs > 0 ? totalHours / completedJobs : 0;
                                  const performance = techJobs.length > 0 ? (completedJobs / techJobs.length) * 100 : 0;

                          return (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{tech.name}</TableCell>
                              <TableCell>{completedJobs}/{techJobs.length}</TableCell>
                              <TableCell>{totalHours.toFixed(1)}h</TableCell>
                              <TableCell>{avgHours.toFixed(1)}h</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                          <div className="flex-1 bg-secondary h-2 rounded-full overflow-hidden min-w-[60px]">
                                    <div 
                                              className="h-full bg-green-500 rounded-full transition-all"
                                              style={{ width: `${Math.min(100, performance)}%` }}
                                    />
                                  </div>
                                          <span className="text-sm font-medium whitespace-nowrap">{performance.toFixed(0)}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                          </div>
                        </TabsContent>
                    <TabsContent value="job-status" className="mt-0 min-h-[200px]">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">Assigned</span>
                              <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20">
                                {jobs.filter(j => j.status === 'Assigned').length}
                          </Badge>
                        </div>
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">In Progress</span>
                          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                            {jobs.filter(j => j.status === 'In Progress').length}
                          </Badge>
                        </div>
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">Completed</span>
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                            {jobs.filter(j => j.status === 'Completed').length}
                          </Badge>
                        </div>
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">On Hold</span>
                              <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">
                                {jobs.filter(j => j.status === 'On Hold').length}
                              </Badge>
                      </div>
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">Cancelled</span>
                              <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                                {jobs.filter(j => j.status === 'Cancelled').length}
                          </Badge>
                        </div>
                      </div>
                        </TabsContent>
                    <TabsContent value="timesheet-status" className="mt-0 min-h-[200px]">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">Clocked In</span>
                        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                          {timesheets.filter(t => t.status === 'Clocked In').length}
                        </Badge>
                      </div>
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">Clocked Out</span>
                        <Badge className="bg-gray-500/10 text-gray-500 border-gray-500/20">
                          {timesheets.filter(t => t.status === 'Clocked Out').length}
                        </Badge>
                      </div>
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">Pending Approval</span>
                        <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
                          {timesheets.filter(t => t.status === 'Pending Approval').length}
                        </Badge>
                      </div>
                            <div className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors">
                              <span className="text-sm font-medium">Approved</span>
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          {timesheets.filter(t => t.status === 'Approved').length}
                        </Badge>
                      </div>
                </div>
                        </TabsContent>
                  </Tabs>
                  <div className="border-t pt-4 mt-6">
                    <p className="text-sm font-medium text-muted-foreground mb-3">Export</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={exportJobsToCSV}>
                        <FileText className="h-4 w-4 mr-2" />
                        Jobs (CSV)
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportTimesheetsToCSV}>
                        <FileText className="h-4 w-4 mr-2" />
                        Timesheets (CSV)
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportPerformanceToPDF}>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        Performance (PDF)
                      </Button>
                    </div>
                    </div>
                  </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Technician Portal */}
      {activePortal === "technician" && (
        <div>
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-border">
                <div className="flex items-center gap-4 pt-0 md:pt-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Briefcase className="h-5 w-5 text-muted-foreground" />
                </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">Jobs Today</p>
                    <p className="text-2xl font-bold tabular-nums">{jobsTodayForPortal.length}</p>
                <p className="text-xs text-muted-foreground">Assigned to you</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-4 md:pt-0 md:pl-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-muted-foreground">Next Job</p>
                    <p className="text-lg font-bold truncate" title={nextJobForPortal?.title}>
                      {nextJobForPortal ? nextJobForPortal.title : "None scheduled"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {nextJobForPortal ? nextJobForPortal.startDate : "No upcoming jobs"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-4 md:pt-0 md:pl-6">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">Hours This Week</p>
                    <p className="text-2xl font-bold tabular-nums">{hoursThisWeekForPortal.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Time logged</p>
                  </div>
                </div>
              </div>
              </CardContent>
            </Card>

          <Tabs value={technicianTab} onValueChange={setTechnicianTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="map">Map</TabsTrigger>
              <TabsTrigger value="profile">Profile</TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="space-y-4">
              {jobs.slice(0, 3).map((job) => (
                <Card key={job.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{job.title}</CardTitle>
                        <CardDescription>
                          {job.id} • {job.startDate}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className={getStatusColor(job.status)}>
                        {job.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>123 Main St, City, State 12345</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>(555) 987-6543</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1">Start Job</Button>
                      <Button variant="outline" onClick={() => setViewingTechJobDetails(job)}>
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="upcoming">
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Jobs</CardTitle>
                  <CardDescription>Jobs currently in progress and starting in the next 7 days</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {jobsCurrentlyHappening.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Currently in progress
                      </h3>
                      <div className="space-y-2">
                        {jobsCurrentlyHappening.map((job) => (
                      <div 
                        key={job.id} 
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => setViewingTechJobDetails(job)}
                      >
                        <div>
                          <p className="font-medium">{job.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {job.endDate ? `${job.startDate} – ${job.endDate}` : `Started ${job.startDate}`}
                              </p>
                        </div>
                        <Badge variant="outline" className={getStatusColor(job.status)}>
                          {job.status}
                        </Badge>
                      </div>
                    ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Starting in the next 7 days
                    </h3>
                    {jobsUpcomingNext7Days.length > 0 ? (
                      <div className="space-y-2">
                        {jobsUpcomingNext7Days.map((job) => (
                          <div
                            key={job.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                            onClick={() => setViewingTechJobDetails(job)}
                          >
                            <div>
                              <p className="font-medium">{job.title}</p>
                              <p className="text-sm text-muted-foreground">
                                Starts {job.startDate}
                                {job.endDate ? ` – ${job.endDate}` : ''}
                              </p>
                            </div>
                            <Badge variant="outline" className={getStatusColor(job.status)}>
                              {job.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4">No jobs scheduled to start in the next 7 days.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="calendar">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Job Calendar</CardTitle>
                      <CardDescription>Monthly view of your assignments</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={previousMonth}>
                        ← Previous
                      </Button>
                      <Button variant="outline" size="sm" onClick={goToToday}>
                        Today
                      </Button>
                      <Button variant="outline" size="sm" onClick={nextMonth}>
                        Next →
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Calendar Header */}
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-center">
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {/* Day Headers */}
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-2">
                        {day}
                      </div>
                    ))}

                    {/* Calendar Days */}
                    {(() => {
                      const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth)
                      const days = []
                      
                      // Empty cells for days before month starts
                      for (let i = 0; i < startingDayOfWeek; i++) {
                        days.push(
                          <div key={`empty-${i}`} className="min-h-24 p-2 border rounded-lg bg-muted/20" />
                        )
                      }
                      
                      // Days of the month - same data as admin (getJobsForDate), with Start/Due labels
                      const maxShow = 3
                      for (let day = 1; day <= daysInMonth; day++) {
                        const date = new Date(year, month, day)
                        const { starting, due, all: dayJobs } = getJobsForDate(date)
                        const isToday = new Date().toDateString() === date.toDateString()
                        const startingShow = starting.slice(0, 2)
                        const dueShow = due.slice(0, 2)
                        
                        days.push(
                          <div
                            key={day}
                            className={`min-h-24 p-2 border rounded-lg hover:bg-accent transition-colors ${
                              isToday ? 'border-primary bg-primary/5' : ''
                            }`}
                            onClick={() => setSelectedDate(date)}
                          >
                            <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-primary' : ''}`}>
                              {day}
                            </div>
                            <div className="space-y-1">
                              {startingShow.map((job) => (
                                <div
                                  key={`s-${job.id}`}
                                  className={`text-xs p-1 rounded truncate font-medium cursor-pointer hover:opacity-80 transition-opacity ${
                                    job.status === 'In Progress' ? 'bg-yellow-400 text-yellow-900' :
                                    job.status === 'Completed' ? 'bg-green-400 text-green-900' :
                                    job.status === 'Overdue' ? 'bg-red-400 text-red-900' : 
                                    job.status === 'Unassigned' ? 'bg-amber-400 text-amber-900' :
                                    'bg-blue-400 text-blue-900'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setViewingTechJobDetails(job)
                                  }}
                                >
                                  <span className="text-[10px] opacity-90 mr-0.5">Start</span> {job.title}
                                </div>
                              ))}
                              {dueShow.map((job) => (
                                <div
                                  key={`d-${job.id}`}
                                  className={`text-xs p-1 rounded truncate font-medium cursor-pointer hover:opacity-80 transition-opacity border-l-2 border-amber-500 ${
                                    job.status === 'Completed' ? 'bg-green-300 text-green-900' :
                                    job.status === 'Overdue' ? 'bg-red-400 text-red-900' :
                                    'bg-amber-100 text-amber-900'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setViewingTechJobDetails(job)
                                  }}
                                >
                                  <span className="text-[10px] opacity-90 mr-0.5">Due</span> {job.title}
                                </div>
                              ))}
                              {dayJobs.length > maxShow && (
                                <div 
                                  className="text-xs text-muted-foreground cursor-pointer hover:text-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedDate(date)
                                  }}
                                >
                                  +{dayJobs.length - maxShow} more
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      }
                      
                      return days
                    })()}
                  </div>
                </CardContent>
              </Card>

              {/* All Jobs for Date Dialog - same data as admin calendar */}
              <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      Jobs for {selectedDate?.toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </DialogTitle>
                    <DialogDescription>All scheduled jobs for this date</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {selectedDate && getJobsForDate(selectedDate).all.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No jobs scheduled for this date
                      </p>
                    ) : selectedDate
                      ? getJobsForDate(selectedDate).all.map((job) => {
                          const { starting, due } = getJobsForDate(selectedDate)
                          const isStart = starting.some(j => j.id === job.id)
                          const isDue = due.some(j => j.id === job.id)
                          const sameDay = job.startDate === job.endDate
                          const label = isStart && (isDue || sameDay) ? 'Starts & Due' : isStart ? 'Starts' : 'Due'
                          const location = (job as { location_address?: string | null }).location_address ?? null
                          return (
                        <Card 
                          key={job.id} 
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => {
                            setSelectedDate(null)
                            setViewingTechJobDetails(job)
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-semibold">{job.title}</h4>
                                      <Badge variant="secondary" className="text-[10px]">{label}</Badge>
                                    </div>
                                <div className="space-y-1 text-sm text-muted-foreground">
                                      <div className="flex items-center gap-2">
                                        <Users className="h-3 w-3" />
                                        <span>{job.technician}</span>
                                      </div>
                                  <div className="flex items-center gap-2">
                                    <Briefcase className="h-3 w-3" />
                                    <span>{job.id}</span>
                                        {job.startDate && job.endDate && (
                                          <span> · {job.startDate} → {job.endDate}</span>
                                        )}
                                  </div>
                                      {location && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-3 w-3" />
                                          <span>{location}</span>
                                  </div>
                                      )}
                                </div>
                              </div>
                              <Badge variant="outline" className={getStatusColor(job.status)}>
                                {job.status}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                          )
                        })
                      : null}
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button variant="outline" onClick={() => setSelectedDate(null)}>
                      Close
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="map">
              <Card>
                <CardHeader>
                      <CardTitle>Job Locations</CardTitle>
                  <CardDescription>Map view of jobs from your workforce (OpenStreetMap)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border overflow-hidden" style={{ minHeight: '400px' }}>
                    {mapGeocoding && jobMapMarkers.length === 0 ? (
                      <div className="flex items-center justify-center h-96 bg-muted">
                          <div className="text-center">
                          <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin text-muted-foreground" />
                          <p className="text-sm font-medium">Looking up job addresses…</p>
                          </div>
                        </div>
                    ) : (
                      <MapContainer
                        center={jobMapMarkers.length > 0 ? [jobMapMarkers[0].lat, jobMapMarkers[0].lng] : [39.5, -98.5]}
                        zoom={jobMapMarkers.length > 0 ? 10 : 4}
                        style={{ height: '400px', width: '100%' }}
                        scrollWheelZoom
                      >
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {jobMapMarkers.map((m) => {
                          const markerColor = m.status === 'In Progress' ? '#eab308' : m.status === 'Completed' ? '#22c55e' : m.status === 'Overdue' ? '#ef4444' : '#3b82f6'
                          const icon = L.divIcon({
                            className: 'custom-marker',
                            html: `<div style="width:24px;height:24px;border-radius:50%;background:${markerColor};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>`,
                            iconSize: [24, 24],
                            iconAnchor: [12, 12],
                          })
                          return (
                            <Marker key={m.jobId} position={[m.lat, m.lng]} icon={icon}>
                              <Popup>
                                <div className="p-1 min-w-[200px]">
                                  <p className="font-semibold">{m.title}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{m.address}</p>
                                  <a
                                    href={`https://www.openstreetmap.org/directions?from=&to=${m.lat},${m.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary underline mt-2 inline-block"
                                  >
                                    Get directions
                                  </a>
                                </div>
                              </Popup>
                            </Marker>
                          )
                        })}
                      </MapContainer>
                      )}
                    </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Assigned</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500" /> In Progress</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> Completed</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Overdue</span>
                  </div>

                  <div className="mt-6">
                    <h4 className="font-semibold mb-4">Jobs with locations</h4>
                    {jobs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No jobs in the system.</p>
                    ) : (
                      <div className="space-y-2">
                        {jobs.map((job) => {
                          const addr = (job as { location_address?: string | null }).location_address
                          const address = typeof addr === 'string' && addr.trim() ? addr.trim() : null
                          return (
                        <div 
                          key={job.id} 
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                          onClick={() => setViewingTechJobDetails(job)}
                        >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-3 h-3 rounded-full shrink-0 ${
                              job.status === 'In Progress' ? 'bg-yellow-500' :
                              job.status === 'Completed' ? 'bg-green-500' :
                                  job.status === 'Overdue' ? 'bg-red-500' : 'bg-blue-500'
                                }`} />
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{job.title}</p>
                                  <p className="text-sm text-muted-foreground truncate">
                                    {address || 'No address set'}
                                  </p>
                              </div>
                            </div>
                              <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={getStatusColor(job.status)}>
                              {job.status}
                            </Badge>
                                {address && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    asChild
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <a
                                      href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(address)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Open in map"
                                    >
                              <MapPin className="h-4 w-4" />
                                    </a>
                            </Button>
                                )}
                          </div>
                        </div>
                          )
                        })}
                    </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile">
              <Card>
                <CardHeader>
                  <CardTitle>Profile Settings</CardTitle>
                  <CardDescription>Manage your account information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="profile-name">Full Name</Label>
                    <Input id="profile-name" defaultValue="John Smith" />
                  </div>
                  <div>
                    <Label htmlFor="profile-phone">Phone</Label>
                    <Input id="profile-phone" defaultValue="(555) 123-4567" />
                  </div>
                  <div>
                    <Label htmlFor="profile-email">Email</Label>
                    <Input id="profile-email" type="email" defaultValue="john.smith@example.com" />
                  </div>
                  <Button>Save Changes</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Job Details Dialog for Technician Portal */}
          <Dialog open={!!viewingTechJobDetails} onOpenChange={() => setViewingTechJobDetails(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  {viewingTechJobDetails?.title}
                </DialogTitle>
                <DialogDescription>Job Details and Instructions</DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                {/* Job Overview */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Job ID</Label>
                    <p className="font-medium">{viewingTechJobDetails?.id}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className={getStatusColor(viewingTechJobDetails?.status || '')}>
                        {viewingTechJobDetails?.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Schedule */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Start Date</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{viewingTechJobDetails?.startDate}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">End Date</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{viewingTechJobDetails?.endDate}</p>
                    </div>
                  </div>
                </div>

                {/* Location & Contact */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Location</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">123 Main St, City, State 12345</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Customer Contact</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">(555) 987-6543</p>
                    </div>
                  </div>
                </div>

                {/* Job Description */}
                <div>
                  <Label className="text-muted-foreground">Job Description</Label>
                  <div className="mt-1 p-3 bg-background rounded-lg border">
                    <p className="text-sm">
                      {viewingTechJobDetails?.title === "HVAC Repair" && 
                        "Diagnose and repair HVAC system issues. Customer reports that the heating unit is not working properly. Check filters, inspect ductwork, and test thermostat functionality."
                      }
                      {viewingTechJobDetails?.title === "Plumbing Check" && 
                        "Routine plumbing inspection and maintenance. Check for leaks, test water pressure, inspect pipes and fixtures. Customer requested preventive maintenance."
                      }
                      {viewingTechJobDetails?.title === "Electrical Install" && 
                        "Install new electrical outlets and switches in kitchen renovation. Follow electrical code requirements and test all connections for safety."
                      }
                      {(!["HVAC Repair", "Plumbing Check", "Electrical Install"].includes(viewingTechJobDetails?.title)) &&
                        "Complete the assigned maintenance or repair task according to company standards and safety protocols."
                      }
                    </p>
                  </div>
                </div>

                {/* Required Tools/Equipment */}
                <div>
                  <Label className="text-muted-foreground">Required Tools & Equipment</Label>
                  <div className="mt-1 p-3 bg-background rounded-lg border">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {viewingTechJobDetails?.title === "HVAC Repair" && (
                        <>
                          <div>• Multimeter</div>
                          <div>• HVAC gauges</div>
                          <div>• Screwdriver set</div>
                          <div>• Replacement filters</div>
                        </>
                      )}
                      {viewingTechJobDetails?.title === "Plumbing Check" && (
                        <>
                          <div>• Pipe wrench set</div>
                          <div>• Pressure gauge</div>
                          <div>• Leak detection kit</div>
                          <div>• Basic plumbing supplies</div>
                        </>
                      )}
                      {viewingTechJobDetails?.title === "Electrical Install" && (
                        <>
                          <div>• Wire strippers</div>
                          <div>• Voltage tester</div>
                          <div>• Outlet boxes</div>
                          <div>• Electrical wire</div>
                        </>
                      )}
                      {(!["HVAC Repair", "Plumbing Check", "Electrical Install"].includes(viewingTechJobDetails?.title)) && (
                        <>
                          <div>• Standard tool kit</div>
                          <div>• Safety equipment</div>
                          <div>• Measuring tools</div>
                          <div>• Replacement parts</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Special Instructions */}
                <div>
                  <Label className="text-muted-foreground">Special Instructions</Label>
                  <div className="mt-1 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-foreground">Important Notes:</p>
                        <ul className="mt-1 space-y-1 text-muted-foreground">
                          <li>• Customer will be home during service window</li>
                          <li>• Use protective floor coverings</li>
                          <li>• Take before/after photos for documentation</li>
                          <li>• Call dispatch if additional parts needed</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button className="flex-1">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Start Job
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={async () => {
                      if (!window.confirm(`Are you sure you want to delete "${viewingTechJobDetails?.title}"?`)) return
                      const dbId = (viewingTechJobDetails as { dbId?: string } | null)?.dbId
                      if (isSupabaseConfigured && dbId) {
                        const ok = await deleteJob(dbId)
                        if (ok) {
                          setViewingTechJobDetails(null)
                          await fetchData()
                        } else {
                          alert('Failed to delete job. Please try again.')
                        }
                      } else {
                        const updatedJobs = jobs.filter((j) => j.id !== viewingTechJobDetails?.id)
                        setJobs(updatedJobs)
                        setDbJobs(updatedJobs as Job[])
                        setViewingTechJobDetails(null)
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                  <Button variant="outline" onClick={() => setViewingTechJobDetails(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  )
}

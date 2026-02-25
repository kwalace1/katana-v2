import { useState, useEffect, useMemo, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getProjectById, getProjectWithProgress, updateProject, type Task, type Project } from "@/lib/project-data-supabase"
import {
  ArrowLeft,
  List,
  LayoutGrid,
  Target,
  GitBranch,
  CalendarIcon,
  TrendingUp,
  Users,
  FolderOpen,
  Share2,
  BarChart3,
  AlertCircle,
  Clock,
  ChevronDown,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react"
import { Link } from "react-router-dom"
import { KanbanBoard } from "./kanban-board"
import { TableView } from "./table-view"
import { CalendarView } from "./calendar-view"
import { TimelineView } from "./timeline-view"
import { TeamManagement } from "./team-management"
import { FileManagement } from "./file-management"
import { SprintView } from "./sprint-view"
import { PlanView } from "./plan-view"
import { ReportsView } from "./reports-view"
import { ShareView } from "./share-view"
import { AddTaskDialog } from "./add-task-dialog"
import { TaskDetailsDialog } from "./task-details-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

interface ProjectDetailProps {
  projectId: string
}

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState("board")
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false)
  const [addTaskDefaultStatus, setAddTaskDefaultStatus] = useState<Task["status"]>("todo")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false)
  const RECENT_ACTIVITY_INITIAL = 3
  const [activityExpanded, setActivityExpanded] = useState(false)
  type ActivityStatusFilter = 'all' | 'backlog' | 'todo' | 'in-progress' | 'review' | 'blocked' | 'done'
  const [activityFilter, setActivityFilter] = useState<ActivityStatusFilter>('all')

  const activityFilterLabel: Record<ActivityStatusFilter, string> = {
    all: 'All',
    backlog: 'Backlog',
    todo: 'To do',
    'in-progress': 'In progress',
    review: 'Review',
    blocked: 'Blocked',
    done: 'Done',
  }
  
  console.log("[ProjectDetail] Rendering, dialog open:", addTaskDialogOpen)
  
  // Load project data - wrapped in useCallback to prevent infinite loops
  const loadProject = useCallback(async () => {
    try {
      setLoading(true)
      console.log('[ProjectDetail] Loading project data...')
      const data = await getProjectById(projectId)
      if (data) {
        const projectWithProgress = await getProjectWithProgress(data)
        console.log('[ProjectDetail] Project loaded with', projectWithProgress.tasks.length, 'tasks')
        setProject(projectWithProgress)
      }
    } catch (err) {
      console.error('Error loading project:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // Initial load
  useEffect(() => {
    loadProject()
  }, [loadProject])

  // Listen for data updates and refresh
  useEffect(() => {
    const handleProjectUpdate = (event: CustomEvent) => {
      if (event.detail.projectId === projectId) {
        console.log('[ProjectDetail] ✨ Project data updated event received, refreshing...')
        loadProject()
      }
    }
    
    window.addEventListener('projectDataUpdated' as any, handleProjectUpdate)
    return () => window.removeEventListener('projectDataUpdated' as any, handleProjectUpdate)
  }, [projectId, loadProject])

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Project Not Found</h2>
          <p className="text-muted-foreground mb-4">The project you're looking for doesn't exist.</p>
          <Link to="/projects">
            <Button>Back to Katana Projects</Button>
          </Link>
        </div>
      </div>
    )
  }

  const viewModes = [
    { id: "table", label: "Table", icon: List },
    { id: "board", label: "Board", icon: LayoutGrid },
    { id: "plan", label: "Plan", icon: Target },
    { id: "timeline", label: "Timeline", icon: GitBranch },
    { id: "calendar", label: "Calendar", icon: CalendarIcon },
    { id: "sprint", label: "Sprint", icon: TrendingUp },
    { id: "team", label: "Team", icon: Users },
    { id: "files", label: "Files", icon: FolderOpen },
    { id: "share", label: "Share", icon: Share2 },
    { id: "reports", label: "Reports", icon: BarChart3 },
  ]

  return (
    <>
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/30 backdrop-blur-sm -mx-6 px-6 mb-6">
        <div className="py-6">
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4 text-base"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Katana Projects
          </Link>

          {/* Project Hero */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-5xl font-bold text-foreground mb-3">{project.name}</h1>
              <div className="flex items-center gap-3 mb-3">
                <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/20 dark:text-green-400 text-base px-3 py-1">
                  {project.status}
                </Badge>
                <Badge variant="outline" className="border-primary text-primary bg-primary/20 text-base px-3 py-1">
                  {project.progress}% Complete
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                {project.createdBy?.name && (
                  <span>Created by <span className="font-medium text-foreground">{project.createdBy.name}</span></span>
                )}
                <div className="flex items-center gap-2">
                  <span>Assigned to</span>
                  <Select
                    value={project.owner?.name || '__unassigned__'}
                    onValueChange={async (value) => {
                      if (value === '__unassigned__') {
                        const ok = await updateProject(projectId, { owner: { name: '', avatar: '' } })
                        if (ok) { loadProject(); toast.success('Project unassigned') }
                        else toast.error('Failed to update')
                      } else {
                        const member = project.team.find((m) => m.name === value)
                        if (member) {
                          const ok = await updateProject(projectId, { owner: { name: member.name, avatar: member.avatar } })
                          if (ok) { loadProject(); toast.success(`Assigned to ${member.name}`) }
                          else toast.error('Failed to update')
                        }
                      }
                    }}
                  >
                    <SelectTrigger className="w-[180px] h-8">
                      <SelectValue placeholder="Select owner..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__unassigned__">Unassigned</SelectItem>
                      {project.team.map((m) => (
                        <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* View Mode Toolbar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {viewModes.map((mode) => {
              const Icon = mode.icon
              return (
                <Button
                  key={mode.id}
                  variant={activeView === mode.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveView(mode.id)}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <Icon className="w-4 h-4" />
                  {mode.label}
                </Button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Stats bar - one rectangular card (matches Katana Projects home) */}
      {activeView !== "files" && activeView !== "share" && activeView !== "reports" && (
        <Card className="overflow-hidden border-border bg-card/50 mb-6">
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
            <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Progress</p>
                <p className="text-2xl font-bold tabular-nums">{project.progress}%</p>
                <Progress value={project.progress} className="mt-2 h-2" />
              </div>
            </div>
            <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Tasks</p>
                <p className="text-2xl font-bold tabular-nums">{project.completedTasks}/{project.totalTasks}</p>
                <p className="text-xs text-muted-foreground">{project.tasks.filter((t) => t.status !== "done").length} remaining</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Main Content Area */}
      <div className="w-full">
          {activeView === "board" && (
            <KanbanBoard 
              project={project} 
              onAddTask={(defaultStatus) => {
                console.log("[ProjectDetail] Opening dialog from kanban with status:", defaultStatus)
                setAddTaskDefaultStatus(defaultStatus || "todo")
                setAddTaskDialogOpen(true)
              }}
              onTaskClick={(task) => {
                console.log("[ProjectDetail] Task clicked:", task.title)
                setSelectedTask(task)
                setTaskDetailsOpen(true)
              }}
            />
          )}
          {activeView === "table" && <TableView project={project} />}
          {activeView === "plan" && <PlanView project={project} onProjectUpdate={() => loadProject()} />}
          {activeView === "calendar" && <CalendarView project={project} />}
          {activeView === "timeline" && (
            <TimelineView
              project={project}
              onTaskClick={(task) => {
                setSelectedTask(task)
                setTaskDetailsOpen(true)
              }}
            />
          )}
          {activeView === "sprint" && <SprintView project={project} onProjectUpdate={loadProject} />}
          {activeView === "team" && <TeamManagement project={project} onProjectUpdate={loadProject} />}
          {activeView === "files" && <FileManagement project={project} onProjectUpdate={loadProject} />}
          {activeView === "reports" && <ReportsView project={project} />}
          {activeView === "share" && <ShareView project={project} />}
        </div>

        {/* Activity Timeline - filterable */}
        <Card className="p-6 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold text-foreground">Recent Activity</h2>
            <Select value={activityFilter} onValueChange={(v) => setActivityFilter(v as ActivityStatusFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                {(['all', 'backlog', 'todo', 'in-progress', 'review', 'blocked', 'done'] as const).map((id) => (
                  <SelectItem key={id} value={id}>
                    {activityFilterLabel[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            {(() => {
              const isAll = activityFilter === 'all'
              const sortedActivities = [...project.activities].sort((a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
              )
              const combined = isAll
                ? [
                    ...sortedActivities.map((a) => ({ type: 'activity' as const, id: a.id, date: a.timestamp, activity: a })),
                    ...project.tasks.map((t) => ({ type: 'task' as const, id: t.id, date: t.deadline, task: t })),
                  ].sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())
                : project.tasks
                    .filter((t) => t.status === activityFilter)
                    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
                    .map((t) => ({ type: 'task' as const, id: t.id, date: t.deadline, task: t }))
              const visible = activityExpanded ? combined : combined.slice(0, RECENT_ACTIVITY_INITIAL)
              const hasMore = combined.length > RECENT_ACTIVITY_INITIAL

              if (combined.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground py-4">
                    {isAll ? 'No recent activity or tasks yet.' : `No tasks with status "${activityFilterLabel[activityFilter]}".`}
                  </p>
                )
              }

              const taskRow = (task: Task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/20 transition-colors border border-border/40"
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    {task.status === 'done' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : task.status === 'in-progress' ? (
                      <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {task.assignee?.name || 'Unassigned'} · Due {task.deadline}
                      {task.status === 'in-progress' ? ' · In progress' : task.status === 'done' ? ' · Complete' : ''}
                    </p>
                  </div>
                  <Badge variant={task.status === 'done' ? 'secondary' : 'outline'} className="shrink-0 capitalize">
                    {task.status.replace('-', ' ')}
                  </Badge>
                </div>
              )

              return (
                <>
                  {visible.map((item) =>
                    item.type === 'activity' ? (
                      <div
                        key={`act-${item.id}`}
                        className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/20 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">
                            <span className="font-semibold">{item.activity.user}</span> {item.activity.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{item.activity.timestamp}</p>
                        </div>
                      </div>
                    ) : (
                      taskRow(item.task)
                    )
                  )}
                  {hasMore && (
                    <div className="flex justify-center pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActivityExpanded(!activityExpanded)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {activityExpanded ? 'Show less' : 'Expand activity'}
                        <ChevronDown className={`h-4 w-4 ml-1.5 transition-transform ${activityExpanded ? 'rotate-180' : ''}`} />
                      </Button>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </Card>
    </div>

    <AddTaskDialog
      projectId={projectId}
      open={addTaskDialogOpen}
      onOpenChange={setAddTaskDialogOpen}
      defaultStatus={addTaskDefaultStatus}
      onTaskAdded={(task) => {
        setProject((prev) => (prev ? { ...prev, tasks: [...prev.tasks, task] } : null))
      }}
    />
    
    <TaskDetailsDialog
      projectId={projectId}
      task={selectedTask}
      open={taskDetailsOpen}
      onOpenChange={setTaskDetailsOpen}
      onTaskSaved={(updatedTask: Task) => {
        setProject((prev) =>
          prev
            ? { ...prev, tasks: prev.tasks.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t)) }
            : null
        )
      }}
    />
  </>
  )
}

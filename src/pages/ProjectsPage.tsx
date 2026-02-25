import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { LoadingState } from '@/components/ui/loading-state'
import { CheckCircle2, Clock, AlertCircle, Plus, Trash2, Loader2, TrendingUp, Calendar, Users } from 'lucide-react'
import * as ProjectData from '@/lib/project-data-supabase'
import { getTaskWithCachedSubtasks } from '@/lib/project-data-supabase'
import type { Task, Project } from '@/lib/project-data'
import { canMarkTaskDone } from '@/lib/project-data'
import { AddProjectDialog } from '@/components/projects/add-project-dialog'
import { RecentActivityWidget } from '@/components/projects/widgets'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

interface WorkItem {
  id: string
  title: string
  time: string
  status: Task['status']
  priority: 'high' | 'medium' | 'low'
  projectId: string
  projectName: string
  taskId: string
  completed: boolean
}

// Generate work items from projects - sort by most recent activity
function generateWorkItemsFromProjects(projectsList: Project[]): WorkItem[] {
  const workItems: WorkItem[] = []
  
  projectsList.forEach(project => {
    project.tasks.forEach(task => {
      // Get relative time from task deadline or status
      let timeDisplay = 'No deadline'
      if (task.deadline) {
        const deadlineDate = new Date(task.deadline)
        const today = new Date()
        const diffTime = deadlineDate.getTime() - today.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        
        if (diffDays < 0) {
          timeDisplay = `${Math.abs(diffDays)} days ago`
        } else if (diffDays === 0) {
          timeDisplay = 'Today'
        } else if (diffDays === 1) {
          timeDisplay = 'Tomorrow'
        } else if (diffDays <= 7) {
          timeDisplay = `In ${diffDays} days`
        } else {
          timeDisplay = task.deadline
        }
      }
      
      workItems.push({
        id: `${project.id}-${task.id}`,
        title: task.title,
        time: timeDisplay,
        status: task.status,
        priority: task.priority,
        projectId: project.id,
        projectName: project.name,
        taskId: task.id,
        completed: task.status === 'done'
      })
    })
  })
  
  return workItems
}

export default function ProjectsPage() {
  const { user, profile } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [workItems, setWorkItems] = useState<WorkItem[]>([])
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addProjectDialogOpen, setAddProjectDialogOpen] = useState(false)

  // Load projects from Supabase
  const loadProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await ProjectData.getAllProjects()
      setProjects(data)
      setWorkItems(generateWorkItemsFromProjects(data))
    } catch (err) {
      console.error('Error loading projects:', err)
      setError('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadProjects()
  }, [])

  // Listen for project data updates
  useEffect(() => {
    const handleProjectUpdate = () => {
      console.log('[ProjectsPage] Project data updated, refreshing...')
      loadProjects()
    }

    window.addEventListener('projectDataUpdated', handleProjectUpdate)
    return () => window.removeEventListener('projectDataUpdated', handleProjectUpdate)
  }, [])

  const refreshProjects = () => {
    loadProjects()
  }

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjects(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
  }

  const toggleSelectAll = () => {
    setSelectedProjects(prev =>
      prev.length === projects.length
        ? []
        : projects.map(p => p.id)
    )
  }

  const deleteSelectedProjects = async () => {
    if (window.confirm(`Are you sure you want to delete ${selectedProjects.length} project(s)?`)) {
      try {
        // Delete projects from Supabase
        for (const projectId of selectedProjects) {
          await ProjectData.deleteProject(projectId)
        }
        
        // Clear selection
        setSelectedProjects([])
        
        // Refresh projects list
        await loadProjects()
        
        console.log('Deleted projects:', selectedProjects)
      } catch (err) {
        console.error('Error deleting projects:', err)
        setError('Failed to delete projects')
      }
    }
  }

  const metrics = useMemo(() => {
    // Calculate upcoming deadlines (next 7 days)
    const today = new Date()
    const nextWeek = new Date(today)
    nextWeek.setDate(today.getDate() + 7)
    
    const upcomingDeadlines = projects.reduce((count, project) => {
      const projectDeadline = project.deadline ? new Date(project.deadline) : null
      if (projectDeadline && projectDeadline >= today && projectDeadline <= nextWeek) {
        count++
      }
      return count
    }, 0)
    
    return {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status === 'active').length,
      completedTasks: projects.reduce((acc, p) => acc + p.completedTasks, 0),
      totalTasks: projects.reduce((acc, p) => acc + p.totalTasks, 0),
      teamMembers: new Set(projects.flatMap(p => p.team.map(t => t.id))).size,
      upcomingDeadlines,
    }
  }, [projects])

  const toggleItemComplete = async (projectId: string, taskId: string) => {
    console.log('[ProjectsPage] Toggle task:', projectId, taskId)
    
    const project = projects.find(p => p.id === projectId)
    if (!project) return
    
    const task = project.tasks.find(t => t.id === taskId)
    if (!task) return
    
    const newStatus: Task['status'] = task.status === 'done' ? 'todo' : 'done'
    const taskWithCache = getTaskWithCachedSubtasks(taskId, task)
    if (newStatus === 'done' && !canMarkTaskDone(taskWithCache)) {
      toast.error('Complete all subtasks before marking this task as done.')
      return
    }
    try {
      await ProjectData.updateTaskStatus(projectId, taskId, newStatus, taskWithCache)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update task')
    }
  }

  const handleAddProject = async (projectData: {
    name: string
    status: "active" | "completed" | "on-hold"
    deadline: string
  }) => {
    console.log('[ProjectsPage] Adding project:', projectData)
    
    try {
      if (!ProjectData.isUsingSupabase()) {
        // For mock data, create project and update state
        const newProject: Project = {
          id: `proj-${Date.now()}`,
          name: projectData.name,
          status: projectData.status,
          progress: 0,
          deadline: projectData.deadline,
          totalTasks: 0,
          completedTasks: 0,
          starred: false,
          tasks: [],
          team: [],
          files: [],
          activities: [],
          milestones: [],
        }
        
        const { mockProjects } = await import('@/lib/project-data')
        mockProjects.push(newProject)
        setProjects(prevProjects => [...prevProjects, newProject])
        
        console.log('[ProjectsPage] Project added to mock data:', newProject.name)
      } else {
        // For Supabase, use the API (throws on error)
        const createdBy = profile?.full_name || user?.email
          ? { name: profile?.full_name || user?.email || 'Me', avatar: profile?.avatar_url || '' }
          : undefined
        const projectId = await ProjectData.createProject({
          ...projectData,
          createdBy,
        })
        console.log('[ProjectsPage] Project created with ID:', projectId)
        await loadProjects()
        toast.success('Project created', { description: `"${projectData.name}" was added.` })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[ProjectsPage] Error adding project:', err)
      toast.error('Failed to create project', { description: message })
    }
  }

  if (loading) {
    return (
      <div className="flex-1 my-16">
        <LoadingState
          fullPage={false}
          message={ProjectData.isUsingSupabase() ? 'Connecting to Supabase…' : 'Loading projects…'}
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 my-16">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-4" />
          <p className="text-destructive font-semibold">{error}</p>
          <Button onClick={loadProjects} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 pt-6 my-16">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Katana Projects</h2>
          <p className="text-sm text-muted-foreground">
            AI-Powered Project Execution Engine {ProjectData.isUsingSupabase() && '• Connected to Supabase'}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button size="sm" onClick={() => setAddProjectDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Stats bar - one wide card, read-only stats */}
      <Card className="overflow-hidden border-border bg-card/50">
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
          <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Total Projects</p>
              <p className="text-2xl font-bold tabular-nums">{metrics.totalProjects}</p>
              <p className="text-xs text-muted-foreground">{metrics.activeProjects} active</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Upcoming Deadlines</p>
              <p className="text-2xl font-bold tabular-nums">{metrics.upcomingDeadlines}</p>
              <p className="text-xs text-muted-foreground">Next 7 days</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Team Members</p>
              <p className="text-2xl font-bold tabular-nums">{metrics.teamMembers}</p>
              <p className="text-xs text-muted-foreground">Across all projects</p>
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="grid" className="space-y-4">
        <TabsList>
          <TabsTrigger value="grid">Grid View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>
        <TabsContent value="grid" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} to={`/projects/${project.id}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{project.progress}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{project.completedTasks}/{project.totalTasks} tasks</span>
                        <span>{project.team.length} members</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <CardTitle>All Projects</CardTitle>
                  {selectedProjects.length > 0 && (
                    <Badge variant="secondary">
                      {selectedProjects.length} selected
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedProjects.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={deleteSelectedProjects}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete {selectedProjects.length === 1 ? 'Project' : `${selectedProjects.length} Projects`}
                    </Button>
                  )}
                  <div className="flex items-center gap-2 border rounded-md px-3 py-2">
                    <Checkbox
                      checked={selectedProjects.length === projects.length && projects.length > 0}
                      onCheckedChange={toggleSelectAll}
                      id="select-all"
                    />
                    <label htmlFor="select-all" className="text-sm cursor-pointer">
                      Select All
                    </label>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent transition-colors"
                  >
                    <Checkbox
                      checked={selectedProjects.includes(project.id)}
                      onCheckedChange={() => toggleProjectSelection(project.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Link to={`/projects/${project.id}`} className="flex-1 flex items-center justify-between cursor-pointer">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{project.name}</h3>
                          <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                            {project.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Due {project.deadline}</span>
                          <span>{project.completedTasks}/{project.totalTasks} tasks</span>
                          <span>{project.team.length} members</span>
                          {project.owner?.name && (
                            <span>Assigned to <span className="font-medium text-foreground">{project.owner.name}</span></span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-2xl font-bold">{project.progress}%</div>
                          <div className="text-xs text-muted-foreground">Complete</div>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RecentActivityWidget 
        activities={workItems.map(item => ({
          id: item.id,
          title: item.title,
          projectName: item.projectName,
          projectId: item.projectId,
          status: item.status,
          time: item.time,
          color: item.priority === 'high' ? 'bg-red-500' : item.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
        }))}
        maxVisible={3}
      />

      <AddProjectDialog
        open={addProjectDialogOpen}
        onOpenChange={setAddProjectDialogOpen}
        onAddProject={handleAddProject}
      />
    </div>
  )
}

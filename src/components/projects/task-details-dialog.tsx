import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateTask, deleteTask, getProjectTeamMembers, type Task, type TeamMember } from "@/lib/project-data-supabase"
import { setSubtasksCache } from "@/lib/subtasks-cache"
import type { Subtask } from "@/lib/project-data"
import { canMarkTaskDone } from "@/lib/project-data"
import { randomId } from "@/lib/utils"
import { toast } from "sonner"
import { Edit, Trash2, Calendar, User, Flag, CheckCircle, TrendingUp, Plus, X } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffect, useRef } from "react"
import { EmployeeAvatar } from "@/components/ui/employee-avatar"

interface TaskDetailsDialogProps {
  projectId: string
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskSaved?: (task: Task) => void
}

export function TaskDetailsDialog({ 
  projectId, 
  task,
  open, 
  onOpenChange,
  onTaskSaved,
}: TaskDetailsDialogProps) {
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [formData, setFormData] = useState<Task | null>(task)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const addSubtaskRef = useRef<HTMLButtonElement>(null)

  // Load team members
  useEffect(() => {
    const loadTeamMembers = async () => {
      const members = await getProjectTeamMembers(projectId)
      setTeamMembers(members)
    }
    if (open) {
      loadTeamMembers()
    }
  }, [projectId, open])

  const addSubtaskInEdit = () => {
    setFormData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        subtasks: [...(prev.subtasks ?? []), { id: randomId(), title: '', completed: false }],
      }
    })
  }

  // Native click listener so Add subtask works (must run before any early return to keep hook count consistent)
  useEffect(() => {
    const el = addSubtaskRef.current
    if (!el) return
    const handler = () => addSubtaskInEdit()
    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [mode])

  // Keep global subtasks cache in sync so Kanban can block Done and preserve subtasks even before save
  useEffect(() => {
    if (formData?.id != null && formData.subtasks != null) {
      setSubtasksCache(formData.id, formData.subtasks)
    }
  }, [formData?.id, formData?.subtasks])

  // Update formData when task changes
  if (task && formData?.id !== task.id) {
    setFormData(task)
    setMode('view')
  }

  if (!task || !formData) return null

  const handleSave = async () => {
    if (!formData.title.trim()) return

    const subtasks = (formData.subtasks ?? []).filter((s) => s.title.trim()).map((s) => ({ ...s, title: s.title.trim() }))
    const updates: Partial<Task> = {
      title: formData.title,
      description: formData.description,
      priority: formData.priority,
      assignee: formData.assignee,
      deadline: formData.deadline,
      status: formData.status,
      subtasks,
    }

    if (formData.status === "done") {
      const merged = { ...formData, subtasks } as Task
      if (!canMarkTaskDone(merged)) {
        toast.error("Complete all subtasks before marking this task as done.")
        return
      }
    }

    try {
      await updateTask(projectId, task.id, updates)
      const updatedTask: Task = { ...task, ...updates, id: task.id }
      onTaskSaved?.(updatedTask)
      setMode('view')
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save task")
    }
  }

  const handleDelete = async () => {
    await deleteTask(projectId, task.id)
    setDeleteDialogOpen(false)
    onOpenChange(false)
  }

  const subtasks = formData.subtasks ?? []
  const completedCount = subtasks.filter((s) => s.completed).length
  const progressFromSubtasks = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : null

  const handleSubtaskToggle = async (subId: string) => {
    const updated = subtasks.map((s) => (s.id === subId ? { ...s, completed: !s.completed } : s))
    setFormData({ ...formData, subtasks: updated })
    await updateTask(projectId, task.id, { subtasks: updated })
  }

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "high":
        return "text-red-600 bg-red-500/10 border-red-500"
      case "medium":
        return "text-yellow-600 bg-yellow-500/10 border-yellow-500"
      case "low":
        return "text-green-600 bg-green-500/10 border-green-500"
    }
  }

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "done":
        return "text-green-600 bg-green-500/10 border-green-500"
      case "in-progress":
        return "text-blue-600 bg-blue-500/10 border-blue-500"
      case "review":
        return "text-purple-600 bg-purple-500/10 border-purple-500"
      case "blocked":
        return "text-red-600 bg-red-500/10 border-red-500"
      case "todo":
        return "text-gray-600 bg-gray-500/10 border-gray-500"
      default:
        return "text-gray-600 bg-gray-500/10 border-gray-500"
    }
  }

  const formatDeadline = (deadline: string) => {
    if (!deadline) return 'No deadline set'
    const date = new Date(deadline)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{mode === 'view' ? 'Task Details' : 'Edit Task'}</DialogTitle>
            <div className="absolute right-14 top-4 flex gap-2">
              {mode === 'view' ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMode('edit')}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData(task)
                      setMode('view')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                  >
                    Save
                  </Button>
                </>
              )}
            </div>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 pt-4">
              {mode === 'view' ? (
                // View Mode
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{task.title}</h3>
                    {task.description && (
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">Status:</span>
                      </div>
                      <Badge className={getStatusColor(task.status)}>
                        {task.status.replace('-', ' ').toUpperCase()}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Flag className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">Priority:</span>
                      </div>
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">Assignee:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <EmployeeAvatar
                          name={task.assignee.name}
                          photoUrl={task.assignee.avatar && task.assignee.avatar !== "/placeholder.svg?height=32&width=32" ? task.assignee.avatar : undefined}
                          size="sm"
                        />
                        <p className="text-sm">{task.assignee.name}</p>
                      </div>
                    </div>

                    {task.deadline && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Deadline:</span>
                        </div>
                        <p className="text-sm">{formatDeadline(task.deadline)}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Progress
                      </span>
                      <span className="text-lg font-semibold text-primary">
                        {progressFromSubtasks !== null
                          ? `${progressFromSubtasks}% (${completedCount}/${subtasks.length} subtasks)`
                          : task.status === 'done'
                            ? 'Complete'
                            : 'In progress'}
                      </span>
                    </div>
                    {(progressFromSubtasks !== null || task.status === 'done') && (
                      <div className="w-full bg-muted rounded-full h-2.5">
                        <div
                          className="bg-primary rounded-full h-2.5 transition-all"
                          style={{ width: `${progressFromSubtasks ?? 100}%` }}
                        />
                      </div>
                    )}
                    {progressFromSubtasks === null && (
                      <p className="text-xs text-muted-foreground">
                        Progress is based on status. Add subtasks or move to Done on the board to complete.
                      </p>
                    )}
                  </div>

                  {subtasks.length > 0 && (
                    <div className="space-y-2">
                      <span className="font-medium text-sm">Subtasks</span>
                      <ul className="space-y-1.5">
                        {subtasks.map((sub) => (
                          <li key={sub.id} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSubtaskToggle(sub.id)}
                              className="shrink-0 rounded border p-0.5 focus:ring-2 focus:ring-primary/50"
                              aria-label={sub.completed ? 'Mark incomplete' : 'Mark complete'}
                            >
                              {sub.completed ? (
                                <CheckCircle className="h-4 w-4 text-primary" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/50" />
                              )}
                            </button>
                            <span className={sub.completed ? 'text-muted-foreground line-through' : ''}>
                              {sub.title || '(Untitled)'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                // Edit Mode
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-title">Task Title *</Label>
                    <Input
                      id="edit-title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter task title..."
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter task description..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value as Task["status"] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="backlog">Backlog</SelectItem>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="edit-priority">Priority</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) => setFormData({ ...formData, priority: value as Task["priority"] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-assignee">Assignee</Label>
                      <Select
                        value={formData.assignee.name}
                        onValueChange={(value) => {
                          const member = teamMembers.find(m => m.name === value)
                          if (member) {
                            setFormData({ 
                              ...formData, 
                              assignee: { name: member.name, avatar: member.avatar }
                            })
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select assignee..." />
                        </SelectTrigger>
                        <SelectContent>
                          {teamMembers.map((member) => (
                            <SelectItem key={member.id} value={member.name}>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                                  {member.name.split(" ").map((n) => n[0]).join("")}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-sm">{member.name}</span>
                                  <span className="text-xs text-muted-foreground">{member.role}</span>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="edit-deadline">Deadline (Optional)</Label>
                      <Input
                        id="edit-deadline"
                        type="date"
                        value={formData.deadline || ''}
                        onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Subtasks (optional)</Label>
                    <p className="text-xs text-muted-foreground">
                      Progress is calculated from completed subtasks. Toggle in view mode.
                    </p>
                    {(formData.subtasks ?? []).map((sub, index) => (
                      <div key={sub.id} className="flex gap-2 items-center">
                        <Input
                          value={sub.title}
                          onChange={(e) => {
                            const next = [...(formData.subtasks ?? [])]
                            next[index] = { ...next[index], title: e.target.value }
                            setFormData({ ...formData, subtasks: next })
                          }}
                          placeholder="Subtask title..."
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              subtasks: (formData.subtasks ?? []).filter((_, i) => i !== index),
                            })
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <button
                      ref={addSubtaskRef}
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-full cursor-pointer"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add subtask
                    </button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="space-y-4 pt-4">
              <div className="text-sm text-muted-foreground text-center py-8">
                Activity history coming soon...
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{task.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}


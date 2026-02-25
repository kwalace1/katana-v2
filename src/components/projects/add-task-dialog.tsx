import { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { addTask, getProjectTeamMembers, type Task, type TeamMember } from "@/lib/project-data-supabase"
import type { Subtask } from "@/lib/project-data"
import { randomId } from "@/lib/utils"
import { toast } from "sonner"
import { Plus, X } from "lucide-react"

interface AddTaskDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultStatus?: Task["status"]
  /** Called with the new task so parent can add it to project state immediately */
  onTaskAdded?: (task: Task) => void
}

export function AddTaskDialog({ 
  projectId, 
  open, 
  onOpenChange,
  defaultStatus = "todo",
  onTaskAdded,
}: AddTaskDialogProps) {
  console.log("[AddTaskDialog] Rendering, open:", open, "projectId:", projectId)
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  
  console.log("[AddTaskDialog] Team members:", teamMembers.length)
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    status: defaultStatus as Task["status"],
    priority: "medium" as Task["priority"],
    assigneeName: "",
    assigneeAvatar: "",
    deadline: "",
    progress: 0,
    subtasks: [] as Subtask[],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      toast.error("Please enter a task title")
      return
    }
    setIsSubmitting(true)
    try {
      const subtasksToSave = formData.subtasks
        .filter((s) => s.title.trim())
        .map((s) => ({ ...s, title: s.title.trim() }))
      const newTask = await addTask(projectId, {
        title: formData.title.trim(),
        description: formData.description,
        status: formData.status,
        priority: formData.priority,
        assignee: {
          name: formData.assigneeName || "Unassigned",
          avatar: formData.assigneeAvatar || "/placeholder.svg?height=32&width=32"
        },
        deadline: formData.deadline || "",
        progress: formData.progress,
        subtasks: subtasksToSave.length > 0 ? subtasksToSave : undefined,
      })
      if (newTask) {
        onTaskAdded?.(newTask)
        setFormData({
          title: "",
          description: "",
          status: defaultStatus,
          priority: "medium",
          assigneeName: "",
          assigneeAvatar: "",
          deadline: "",
          progress: 0,
          subtasks: [],
        })
        onOpenChange(false)
        toast.success("Task added")
      } else {
        toast.error("Failed to add task")
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add task"
      toast.error("Failed to add task", { description: message })
    } finally {
      setIsSubmitting(false)
    }
  }

  const addSubtask = () => {
    setFormData((prev) => ({
      ...prev,
      subtasks: [
        ...(prev.subtasks ?? []),
        { id: randomId(), title: "", completed: false },
      ],
    }))
  }

  // Native click listener so Add subtask works even when React/Radix swallows synthetic events
  useEffect(() => {
    if (!open) return
    const el = addSubtaskRef.current
    if (!el) return
    const handler = () => addSubtask()
    el.addEventListener("click", handler)
    return () => el.removeEventListener("click", handler)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>Add New Task</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col min-h-0 overflow-hidden flex-1 flex">
          <div className="grid gap-4 py-4 px-6 overflow-y-auto min-h-0 flex-1">
            <form id="add-task-form" onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Task Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter task title..."
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter task description..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
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
                  <Label htmlFor="priority">Priority</Label>
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
                  <Label htmlFor="assignee">Assignee</Label>
                  <Select
                    value={formData.assigneeName}
                    onValueChange={(value) => {
                      const member = teamMembers.find(m => m.name === value)
                      if (member) {
                        setFormData({
                          ...formData,
                          assigneeName: member.name,
                          assigneeAvatar: member.avatar
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
                  <Label htmlFor="deadline">Deadline (Optional)</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  />
                </div>
              </div>
            </form>

            {/* Subtasks outside form so Add button is never captured by form */}
            <div className="grid gap-2">
              <Label>Subtasks (optional)</Label>
              <p className="text-xs text-muted-foreground">Progress will be calculated from completed subtasks.</p>
              {formData.subtasks.map((sub, index) => (
                <div key={sub.id} className="flex gap-2 items-center">
                  <Input
                    value={sub.title}
                    onChange={(e) => {
                      const next = [...formData.subtasks]
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
                        subtasks: formData.subtasks.filter((_, i) => i !== index),
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
                <Plus className="h-4 w-4" />
                Add subtask
              </button>
            </div>
          </div>

          <DialogFooter className="px-6 pb-6 pt-4 shrink-0 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-task-form" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add Task"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}


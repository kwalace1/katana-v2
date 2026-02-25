"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import type { Project, TeamMember } from "@/lib/project-data"
import { addTeamMember, updateTeamMember, deleteTeamMember } from "@/lib/project-data-supabase"
import { Mail, MoreHorizontal, UserPlus, Search, Pencil, Trash2, UserMinus, User, Users, Clock, TrendingUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { EmployeeAvatar } from "@/components/ui/employee-avatar"

interface TeamManagementProps {
  project: Project
  onProjectUpdate?: () => void
}

export function TeamManagement({ project, onProjectUpdate }: TeamManagementProps) {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState("")
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [newMemberForm, setNewMemberForm] = useState({
    name: "",
    email: "",
    role: "developer",
    capacity: 40
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false)
  const [editMemberOpen, setEditMemberOpen] = useState(false)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    name: "",
    role: "",
    capacity: 40
  })

  const filteredTeam = project.team.filter((member) => member.name.toLowerCase().includes(searchQuery.toLowerCase()))

  // Calculate workload for each team member
  const getTeamMemberWorkload = (memberName: string) => {
    const tasks = project.tasks.filter((t) => t.assignee.name === memberName && t.status !== "done")
    return {
      activeTasks: tasks.length,
      highPriority: tasks.filter((t) => t.priority === "high").length,
      utilization: Math.min((tasks.length / 5) * 100, 100), // Assuming 5 tasks = 100% utilization
    }
  }

  // Calculate average utilization across all team members
  const avgUtilization = project.team.length > 0
    ? Math.round(
        project.team.reduce((sum, member) => {
          const workload = getTeamMemberWorkload(member.name)
          return sum + workload.utilization
        }, 0) / project.team.length
      )
    : 0

  // Calculate total capacity
  const totalCapacity = project.team.reduce((sum, member) => sum + (member.capacity || 40), 0)

  const handleAddTeamMember = async () => {
    if (!newMemberForm.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a team member name",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const memberId = await addTeamMember(project.id, {
        name: newMemberForm.name,
        role: newMemberForm.role,
        avatar: "/placeholder.svg?height=32&width=32",
        capacity: newMemberForm.capacity
      })

      if (memberId) {
        console.log('[TeamManagement] Team member added successfully:', memberId)
        
        toast({
          title: "Team member added",
          description: `${newMemberForm.name} has been added to the team`,
        })
        
        // Reset form
        setNewMemberForm({
          name: "",
          email: "",
          role: "developer",
          capacity: 40
        })
        setShowInviteForm(false)

        // Trigger project refresh
        if (onProjectUpdate) {
          onProjectUpdate()
        }
      } else {
        toast({
          title: "Failed to add member",
          description: "There was an error adding the team member",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error('[TeamManagement] Error adding team member:', err)
      toast({
        title: "Error",
        description: "Failed to add team member. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleViewMemberDetails = (member: TeamMember) => {
    setSelectedMember(member)
    setViewDetailsOpen(true)
  }

  const handleEditMember = (member: TeamMember) => {
    setSelectedMember(member)
    setEditForm({
      name: member.name,
      role: member.role,
      capacity: member.capacity
    })
    setEditMemberOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedMember || !editForm.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a team member name",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const success = await updateTeamMember(selectedMember.id, {
        name: editForm.name,
        role: editForm.role,
        capacity: editForm.capacity,
        avatar: selectedMember.avatar
      })

      if (success) {
        console.log('[TeamManagement] Team member updated successfully')
        
        toast({
          title: "Member updated",
          description: `${editForm.name}'s information has been updated`,
        })
        
        setEditMemberOpen(false)
        
        // Trigger project refresh
        if (onProjectUpdate) {
          onProjectUpdate()
        }
      } else {
        toast({
          title: "Failed to update",
          description: "There was an error updating the team member",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error('[TeamManagement] Error updating team member:', err)
      toast({
        title: "Error",
        description: "Failed to update team member. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveMember = async (member: TeamMember) => {
    setSelectedMember(member)
    setConfirmDeleteOpen(true)
  }

  const confirmRemoveMember = async () => {
    if (!selectedMember) return

    try {
      const success = await deleteTeamMember(selectedMember.id)
      
      if (success) {
        console.log('[TeamManagement] Team member removed successfully')
        
        toast({
          title: "Member removed",
          description: `${selectedMember.name} has been removed from the team`,
        })
        
        setConfirmDeleteOpen(false)
        
        // Trigger project refresh
        if (onProjectUpdate) {
          onProjectUpdate()
        }
      } else {
        toast({
          title: "Failed to remove",
          description: "There was an error removing the team member",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error('[TeamManagement] Error removing team member:', err)
      toast({
        title: "Error",
        description: "Failed to remove team member. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        {/* Team overview */}
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border overflow-hidden rounded-lg border border-border/60 bg-muted/20">
          <div className="flex-1 flex items-center gap-4 px-4 py-4 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Team Members</p>
              <p className="text-2xl font-bold tabular-nums">{project.team.length}</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-4 px-4 py-4 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Total Capacity</p>
              <p className="text-2xl font-bold tabular-nums">{totalCapacity}h</p>
              <p className="text-xs text-muted-foreground">hours/week</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-4 px-4 py-4 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Average Utilization</p>
              <p className="text-2xl font-bold tabular-nums">{avgUtilization}%</p>
            </div>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="flex items-center gap-3 mt-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search team members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => setShowInviteForm(!showInviteForm)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Member
          </Button>
        </div>

        {showInviteForm && (
          <div className="mt-4 p-4 rounded-lg bg-muted/20 border border-border/40">
            <h3 className="font-semibold mb-3 text-foreground">Add Team Member</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Full Name *</label>
                  <Input 
                    placeholder="John Doe" 
                    value={newMemberForm.name}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Email (optional)</label>
                  <Input 
                    placeholder="john@example.com" 
                    type="email"
                    value={newMemberForm.email}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Role</label>
                  <Select 
                    value={newMemberForm.role}
                    onValueChange={(value) => setNewMemberForm({ ...newMemberForm, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="developer">Developer</SelectItem>
                      <SelectItem value="designer">Designer</SelectItem>
                      <SelectItem value="manager">Project Manager</SelectItem>
                      <SelectItem value="qa">QA Engineer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Capacity (hours/week)</label>
                  <Input 
                    type="number" 
                    placeholder="40"
                    value={newMemberForm.capacity}
                    onChange={(e) => setNewMemberForm({ ...newMemberForm, capacity: parseInt(e.target.value) || 40 })}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowInviteForm(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddTeamMember}
                  disabled={isSubmitting || !newMemberForm.name.trim()}
                >
                  <UserPlus className="w-4 w-4 mr-2" />
                  {isSubmitting ? 'Adding...' : 'Add Member'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Team Members – click to open details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-border">
          {filteredTeam.map((member) => {
            const workload = getTeamMemberWorkload(member.name)

            return (
              <div
                key={member.id}
                role="button"
                tabIndex={0}
                className="p-6 rounded-lg border border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/30 transition-all cursor-pointer"
                onClick={() => handleViewMemberDetails(member)}
                onKeyDown={(e) => e.key === "Enter" && handleViewMemberDetails(member)}
              >
              <div className="flex items-start gap-4">
                <EmployeeAvatar
                  name={member.name}
                  photoUrl={member.avatar && member.avatar !== "/placeholder.svg?height=32&width=32" ? member.avatar : undefined}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-lg text-foreground">{member.name}</h3>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-background/95 backdrop-blur-sm border shadow-md" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewMemberDetails(member); }}>
                          <User className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditMember(member); }}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit Member
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); handleRemoveMember(member); }}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove Member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-3 mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Capacity</span>
                      <span className="font-medium text-foreground">{member.capacity}h/week</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Utilization</span>
                        <span className="font-medium text-foreground">{workload.utilization.toFixed(0)}%</span>
                      </div>
                      <Progress value={workload.utilization} className="h-2" />
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Active Tasks: </span>
                        <span className="font-medium text-foreground">{workload.activeTasks}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">High Priority: </span>
                        <Badge variant="destructive" className="text-xs">
                          {workload.highPriority}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            )
          })}
        </div>

        {/* Team Performance */}
        <div className="mt-6 pt-6 border-t border-border">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Team Performance</h3>
        <div className="space-y-4">
          {project.team.map((member) => {
            const completedTasks = project.tasks.filter(
              (t) => t.assignee.name === member.name && t.status === "done",
            ).length
            const totalTasks = project.tasks.filter((t) => t.assignee.name === member.name).length
            const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0

            return (
              <div key={member.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <EmployeeAvatar
                      name={member.name}
                      photoUrl={member.avatar && member.avatar !== "/placeholder.svg?height=32&width=32" ? member.avatar : undefined}
                      size="md"
                    />
                    <div>
                      <p className="font-medium text-foreground">{member.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {completedTasks} of {totalTasks} tasks completed
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{completionRate.toFixed(0)}%</span>
                </div>
                <Progress value={completionRate} className="h-2" />
              </div>
            )
          })}
        </div>
      </div>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Team Member Details</DialogTitle>
            <DialogDescription>
              Viewing information for {selectedMember?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <EmployeeAvatar
                  name={selectedMember.name}
                  photoUrl={selectedMember.avatar && selectedMember.avatar !== "/placeholder.svg?height=32&width=32" ? selectedMember.avatar : undefined}
                  size="lg"
                />
                <div>
                  <h3 className="font-semibold text-lg">{selectedMember.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedMember.role}</p>
                </div>
              </div>
              
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm font-medium">Role</span>
                  <Badge variant="outline">{selectedMember.role}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm font-medium">Capacity</span>
                  <span className="text-sm font-semibold">{selectedMember.capacity}h/week</span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm font-medium">Active Tasks</span>
                  <span className="text-sm font-semibold">
                    {getTeamMemberWorkload(selectedMember.name).activeTasks}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="text-sm font-medium">Utilization</span>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={getTeamMemberWorkload(selectedMember.name).utilization} 
                      className="h-2 w-20"
                    />
                    <span className="text-sm font-semibold">
                      {getTeamMemberWorkload(selectedMember.name).utilization.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => setViewDetailsOpen(false)}>
              Close
            </Button>
            {selectedMember && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewDetailsOpen(false)
                    handleEditMember(selectedMember)
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setViewDetailsOpen(false)
                    handleRemoveMember(selectedMember)
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={editMemberOpen} onOpenChange={setEditMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update information for {selectedMember?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select
                value={editForm.role}
                onValueChange={(value) => setEditForm({ ...editForm, role: value })}
              >
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="designer">Designer</SelectItem>
                  <SelectItem value="manager">Project Manager</SelectItem>
                  <SelectItem value="qa">QA Engineer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-capacity">Capacity (hours/week)</Label>
              <Input
                id="edit-capacity"
                type="number"
                value={editForm.capacity}
                onChange={(e) => setEditForm({ ...editForm, capacity: parseInt(e.target.value) || 40 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditMemberOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSubmitting || !editForm.name.trim()}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedMember?.name} from the team?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. {selectedMember?.name} will be removed from all assigned tasks.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemoveMember}
            >
              Remove Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Target,
  Plus,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit,
  Trash2,
  ChevronRight,
} from "lucide-react"
import { useEmployeePortal } from "@/contexts/EmployeePortalContext"
import { EmployeePortalNoAccess } from "@/components/employee/EmployeePortalNoAccess"
import { LoadingState } from "@/components/ui/loading-state"
import * as hrApi from "@/lib/hr-api"
import type { Goal as HRGoal } from "@/lib/hr-api"

type DisplayStatus = "on-track" | "at-risk" | "behind" | "completed"

function mapStatus(s: HRGoal["status"]): DisplayStatus {
  if (s === "Complete") return "completed"
  if (s === "Behind") return "behind"
  if (s === "On Track") return "on-track"
  return "at-risk"
}

function mapCategory(c: string): "individual" | "team" | "company" {
  const lower = (c || "").toLowerCase()
  if (lower === "team") return "team"
  if (lower === "company") return "company"
  return "individual"
}

export default function EmployeeGoalsPage() {
  const { employee, employeeId, loading: portalLoading, error: portalError } = useEmployeePortal()
  const [goalsRaw, setGoalsRaw] = useState<HRGoal[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newGoal, setNewGoal] = useState({
    title: "",
    description: "",
    category: "individual" as "individual" | "team" | "company",
    dueDate: "",
  })

  useEffect(() => {
    if (!employeeId) return
    hrApi.getGoalsByEmployeeId(employeeId).then(setGoalsRaw)
  }, [employeeId])

  const goals = useMemo(
    () =>
      goalsRaw.map((g) => ({
        id: g.id,
        title: g.goal || "Untitled goal",
        description: g.description || "",
        category: mapCategory(g.category),
        progress: g.progress ?? 0,
        dueDate: g.due_date,
        status: mapStatus(g.status),
        metrics: [{ name: "Progress", current: g.progress ?? 0, target: 100, unit: "%" }],
        lastUpdated: g.updated_at ? new Date(g.updated_at).toLocaleDateString() : "",
      })),
    [goalsRaw]
  )

  const activeGoals = goals.filter((g) => g.status !== "completed")
  const completedGoals = goals.filter((g) => g.status === "completed")

  const goalsByCategory = {
    individual: goals.filter(g => g.category === "individual" && g.status !== "completed"),
    team: goals.filter(g => g.category === "team" && g.status !== "completed"),
    company: goals.filter(g => g.category === "company" && g.status !== "completed"),
  }

  const overallProgress = goals.length > 0 ? Math.round(goals.reduce((acc, goal) => acc + goal.progress, 0) / goals.length) : 0

  const getStatusColor = (status: DisplayStatus) => {
    switch (status) {
      case "on-track": return "border-green-500 text-green-600 bg-green-500/20"
      case "at-risk": return "border-yellow-500 text-yellow-600 bg-yellow-500/20"
      case "behind": return "border-red-500 text-red-600 bg-red-500/20"
      case "completed": return "border-blue-500 text-blue-600 bg-blue-500/20"
    }
  }

  const getStatusIcon = (status: DisplayStatus) => {
    switch (status) {
      case "on-track": return CheckCircle2
      case "at-risk": return AlertCircle
      case "behind": return Clock
      case "completed": return CheckCircle2
    }
  }

  const getCategoryColor = (category: "individual" | "team" | "company") => {
    switch (category) {
      case "individual": return "border-purple-500 text-purple-600 bg-purple-500/10"
      case "team": return "border-blue-500 text-blue-600 bg-blue-500/10"
      case "company": return "border-green-500 text-green-600 bg-green-500/10"
    }
  }

  const handleAddGoal = async () => {
    if (!employeeId || !newGoal.title || !newGoal.dueDate) return
    const created = await hrApi.createGoal({
      employee_id: employeeId,
      goal: newGoal.title,
      description: newGoal.description || null,
      category: newGoal.category,
      progress: 0,
      status: "On Track",
      due_date: newGoal.dueDate,
      created_date: new Date().toISOString().slice(0, 10),
    })
    if (created) {
      setGoalsRaw((prev) => [created, ...prev])
      setIsDialogOpen(false)
      setNewGoal({ title: "", description: "", category: "individual", dueDate: "" })
    }
  }

  if (portalLoading) {
    return <LoadingState message="Loading…" className="my-16" />
  }
  if (!employee) {
    return <EmployeePortalNoAccess error={portalError ?? undefined} />
  }

  return (
    <div className="min-h-screen bg-background p-6 my-16">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">My Goals</h1>
            <p className="text-muted-foreground">Track and manage your objectives</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Goal
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overallProgress}%</div>
            <Progress value={overallProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Goals</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeGoals.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {completedGoals.length} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On Track</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {goals.filter(g => g.status === "on-track").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Goals progressing well
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">
              {goals.filter(g => g.status === "at-risk").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Need attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All Goals ({activeGoals.length})</TabsTrigger>
          <TabsTrigger value="individual">Individual ({goalsByCategory.individual.length})</TabsTrigger>
          <TabsTrigger value="team">Team ({goalsByCategory.team.length})</TabsTrigger>
          <TabsTrigger value="company">Company ({goalsByCategory.company.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedGoals.length})</TabsTrigger>
        </TabsList>

        {/* All Goals */}
        <TabsContent value="all" className="space-y-4">
          {activeGoals.map((goal) => (
            <Card key={goal.id} className="hover:border-primary/40 transition-all">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle>{goal.title}</CardTitle>
                      <Badge variant="outline" className={getCategoryColor(goal.category)}>
                        {goal.category}
                      </Badge>
                      <Badge variant="outline" className={getStatusColor(goal.status)}>
                        {goal.status}
                      </Badge>
                    </div>
                    <CardDescription>{goal.description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Overall Progress</span>
                    <span className="text-sm font-bold">{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-2" />
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {goal.metrics.map((metric, index) => (
                    <div key={index} className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">{metric.name}</span>
                        <span className="text-xs font-medium">
                          {metric.current}/{metric.target} {metric.unit}
                        </span>
                      </div>
                      <Progress value={(metric.current / metric.target) * 100} className="h-1" />
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Due {goal.dueDate}
                    </span>
                    <span>Last updated {goal.lastUpdated}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7">
                    View Details
                    <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Individual Goals */}
        <TabsContent value="individual" className="space-y-4">
          {goalsByCategory.individual.map((goal) => (
            <Card key={goal.id} className="hover:border-primary/40 transition-all">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle>{goal.title}</CardTitle>
                      <Badge variant="outline" className={getStatusColor(goal.status)}>
                        {goal.status}
                      </Badge>
                    </div>
                    <CardDescription>{goal.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-sm font-bold">{goal.progress}%</span>
                </div>
                <Progress value={goal.progress} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Team Goals */}
        <TabsContent value="team" className="space-y-4">
          {goalsByCategory.team.map((goal) => (
            <Card key={goal.id} className="hover:border-primary/40 transition-all">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle>{goal.title}</CardTitle>
                      <Badge variant="outline" className={getStatusColor(goal.status)}>
                        {goal.status}
                      </Badge>
                    </div>
                    <CardDescription>{goal.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-sm font-bold">{goal.progress}%</span>
                </div>
                <Progress value={goal.progress} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Company Goals */}
        <TabsContent value="company" className="space-y-4">
          {goalsByCategory.company.map((goal) => (
            <Card key={goal.id} className="hover:border-primary/40 transition-all">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle>{goal.title}</CardTitle>
                      <Badge variant="outline" className={getStatusColor(goal.status)}>
                        {goal.status}
                      </Badge>
                    </div>
                    <CardDescription>{goal.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-sm font-bold">{goal.progress}%</span>
                </div>
                <Progress value={goal.progress} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Completed Goals */}
        <TabsContent value="completed" className="space-y-4">
          {completedGoals.map((goal) => (
            <Card key={goal.id} className="opacity-75">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="line-through">{goal.title}</CardTitle>
                      <Badge variant="outline" className={getCategoryColor(goal.category)}>
                        {goal.category}
                      </Badge>
                      <Badge variant="outline" className={getStatusColor(goal.status)}>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Completed
                      </Badge>
                    </div>
                    <CardDescription>{goal.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Progress value={100} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">Completed on {goal.lastUpdated}</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Add Goal Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Goal</DialogTitle>
            <DialogDescription>
              Set a new objective to track your progress
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="goal-title">Goal Title *</Label>
              <Input
                id="goal-title"
                placeholder="e.g., Learn TypeScript"
                value={newGoal.title}
                onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="goal-description">Description</Label>
              <Textarea
                id="goal-description"
                placeholder="What do you want to achieve?"
                value={newGoal.description}
                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="goal-category">Category</Label>
                <Select
                  value={newGoal.category}
                  onValueChange={(value: "individual" | "team" | "company") => setNewGoal({ ...newGoal, category: value })}
                >
                  <SelectTrigger id="goal-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal-due">Due Date *</Label>
                <Input
                  id="goal-due"
                  type="date"
                  value={newGoal.dueDate}
                  onChange={(e) => setNewGoal({ ...newGoal, dueDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddGoal}
              disabled={!newGoal.title || !newGoal.dueDate}
            >
              Create Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


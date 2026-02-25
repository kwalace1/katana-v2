import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Users,
  Target,
  BookOpen,
  Calendar,
  Star,
  TrendingUp,
  Award,
  Briefcase,
  Clock,
  CheckCircle2,
  ArrowRight,
  Bell,
  MessageSquare,
  FolderKanban,
} from "lucide-react"
import { useEmployeePortal } from "@/contexts/EmployeePortalContext"
import { EmployeePortalNoAccess } from "@/components/employee/EmployeePortalNoAccess"
import { LoadingState } from "@/components/ui/loading-state"
import * as hrApi from "@/lib/hr-api"
import type { PerformanceReview, Goal, LearningPath } from "@/lib/hr-api"
import { getProjectsAndTasksAssignedTo } from "@/lib/project-data-supabase"

function overallRating(review: PerformanceReview): number {
  return (review.collaboration + review.accountability + review.trustworthy + review.leadership) / 4
}

export default function EmployeePortalPage() {
  const { employee, employeeId, loading, error, refresh } = useEmployeePortal()
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([])
  const [recognitionsCount, setRecognitionsCount] = useState(0)
  const [dataLoading, setDataLoading] = useState(true)
  const [myProjects, setMyProjects] = useState<Awaited<ReturnType<typeof getProjectsAndTasksAssignedTo>>>([])

  // Load portal data when employee is set
  useEffect(() => {
    if (!employeeId) {
      setDataLoading(false)
      return
    }
    setDataLoading(true)
    Promise.all([
      hrApi.getPerformanceReviewsByEmployeeId(employeeId),
      hrApi.getGoalsByEmployeeId(employeeId),
      hrApi.getLearningPathsByEmployeeId(employeeId),
      hrApi.getRecognitionsByEmployeeId(employeeId),
    ])
      .then(([reviewsData, goalsData, learningData, recognitionsData]) => {
        setReviews(reviewsData)
        setGoals(goalsData)
        setLearningPaths(learningData)
        setRecognitionsCount(recognitionsData.length)
      })
      .catch((e) => console.error('Failed to load portal data:', e))
      .finally(() => setDataLoading(false))
  }, [employeeId])

  // Load projects/tasks assigned to this employee (by HR name) so portal shows "My Projects"
  useEffect(() => {
    if (!employee?.name?.trim()) {
      setMyProjects([])
      return
    }
    getProjectsAndTasksAssignedTo(employee.name.trim())
      .then(setMyProjects)
      .catch(() => setMyProjects([]))
  }, [employee?.name])

  const performanceScore = useMemo(() => {
    if (employee?.performance_score != null) return Number(employee.performance_score)
    if (reviews.length === 0) return null
    return Number(overallRating(reviews[0]))
  }, [employee?.performance_score, reviews])

  const goalsCompleted = useMemo(() => goals.filter((g) => g.status === "Complete").length, [goals])
  const goalsTotal = goals.length
  const trainingInProgress = useMemo(
    () => learningPaths.filter((l) => l.status === "in-progress" || l.status === "not-started").length,
    [learningPaths]
  )
  const trainingCompleted = useMemo(
    () => learningPaths.filter((l) => l.status === "completed").length,
    [learningPaths]
  )

  const nextReviewDate = employee?.next_review_date ?? null

  type EventItem = {
    type: string
    title: string
    date: string
    dateSort: number
    link: string
    icon: typeof Star
    color: string
  }

  const upcomingEvents = useMemo((): EventItem[] => {
    const now = Date.now()
    const items: EventItem[] = []

    if (nextReviewDate) {
      const d = new Date(nextReviewDate)
      if (d.getTime() >= now) {
        items.push({
          type: "Review",
          title: "Performance Review",
          date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          dateSort: d.getTime(),
          link: "/employee/performance",
          icon: Star,
          color: "text-purple-500",
        })
      }
    }

    goals
      .filter((g) => g.status !== "Complete" && g.status !== "Cancelled" && g.due_date)
      .forEach((g) => {
        const d = new Date(g.due_date)
        if (d.getTime() >= now) {
          items.push({
            type: "Goal",
            title: g.goal?.slice(0, 40) + (g.goal && g.goal.length > 40 ? "…" : "") || "Goal due",
            date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            dateSort: d.getTime(),
            link: "/employee/goals",
            icon: Target,
            color: "text-green-500",
          })
        }
      })

    learningPaths
      .filter((l) => l.status !== "completed" && l.due_date)
      .forEach((l) => {
        const d = new Date(l.due_date)
        if (d.getTime() >= now) {
          items.push({
            type: "Training",
            title: l.course?.slice(0, 40) + (l.course && l.course.length > 40 ? "…" : "") || "Course due",
            date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            dateSort: d.getTime(),
            link: "/employee/development",
            icon: BookOpen,
            color: "text-blue-500",
          })
        }
      })

    items.sort((a, b) => a.dateSort - b.dateSort)
    return items.slice(0, 10)
  }, [nextReviewDate, goals, learningPaths])

  const quickActions = [
    { label: "Company Directory", icon: Users, link: "/employee/directory", color: "bg-blue-500" },
    { label: "My Performance", icon: Star, link: "/employee/performance", color: "bg-purple-500" },
    { label: "My Goals", icon: Target, link: "/employee/goals", color: "bg-green-500" },
    { label: "Learning & Development", icon: BookOpen, link: "/employee/development", color: "bg-orange-500" },
    { label: "Internal Jobs", icon: Briefcase, link: "/employee/jobs", color: "bg-pink-500" },
    { label: "My Profile", icon: Users, link: "/employee/profile", color: "bg-indigo-500" },
  ]

  const recentAchievements = useMemo(() => {
    const list: { title: string; description: string; icon: typeof Award; color: string }[] = []
    if (goalsCompleted > 0) {
      list.push({
        title: "Goal Achiever",
        description: `Completed ${goalsCompleted} goal${goalsCompleted === 1 ? "" : "s"}`,
        icon: Award,
        color: "text-yellow-500",
      })
    }
    if (recognitionsCount > 0) {
      list.push({
        title: "Team Player",
        description: `Received ${recognitionsCount} recognition${recognitionsCount === 1 ? "" : "s"}`,
        icon: Users,
        color: "text-blue-500",
      })
    }
    if (trainingCompleted > 0) {
      list.push({
        title: "Learning Champion",
        description: `Completed ${trainingCompleted} training course${trainingCompleted === 1 ? "" : "s"}`,
        icon: BookOpen,
        color: "text-green-500",
      })
    }
    if (list.length === 0) {
      list.push({
        title: "Get started",
        description: "Complete goals, training, or receive recognition to see achievements here",
        icon: Award,
        color: "text-muted-foreground",
      })
    }
    return list
  }, [goalsCompleted, recognitionsCount, trainingCompleted])

  const notifications = useMemo(() => {
    const list: { message: string; time: string; unread: boolean; link?: string }[] = []
    const goalsDueSoon = goals.filter((g) => {
      if (g.status === "Complete" || g.status === "Cancelled") return false
      const due = new Date(g.due_date).getTime()
      const in5Days = now + 5 * 24 * 60 * 60 * 1000
      return due <= in5Days && due >= now
    })
    const now = Date.now()
    goalsDueSoon.slice(0, 2).forEach((g) => {
      list.push({
        message: `Goal "${(g.goal || "").slice(0, 30)}…" is due soon`,
        time: "Due " + new Date(g.due_date).toLocaleDateString(),
        unread: true,
        link: "/employee/goals",
      })
    })
    if (list.length === 0) {
      list.push({
        message: "You're all caught up. Complete goals and training to see updates here.",
        time: "",
        unread: false,
      })
    }
    return list
  }, [goals])

  const tenureYears = employee
    ? Math.floor(
        (Date.now() - new Date(employee.hire_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      )
    : 0
  const tenureMonths = employee
    ? Math.floor(
        ((Date.now() - new Date(employee.hire_date).getTime()) / (1000 * 60 * 60 * 24 * 30.44)) % 12
      )
    : 0

  if (loading || dataLoading) {
    return <LoadingState message="Loading your portal…" className="my-16" />
  }

  if (error || !employee) {
    return <EmployeePortalNoAccess error={error ?? undefined} />
  }

  const firstName = employee.name?.split(" ")[0] || "there"

  // Build feed: assignments first (things sent to you), then events, notifications, real achievements, projects. No "Get started" or shortcut items.
  type FeedItem = {
    id: string
    type: "assigned" | "event" | "notification" | "achievement" | "project"
    avatar: React.ReactNode
    title: string
    subtitle?: string
    time?: string
    link?: string
    meta?: string
  }
  const feedItems: FeedItem[] = []

  // Assignments: goals and training assigned to this employee (shows "something has been sent to you")
  goals
    .filter((g) => g.status !== "Complete" && g.status !== "Cancelled")
    .slice(0, 5)
    .forEach((g, i) => {
      const goalTitle = (g.goal || "Goal").slice(0, 50) + ((g.goal?.length ?? 0) > 50 ? "…" : "")
      feedItems.push({
        id: `assigned-goal-${g.id ?? i}`,
        type: "assigned",
        avatar: (
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-600">
            <Target className="w-5 h-5" />
          </div>
        ),
        title: "Goal assigned to you",
        subtitle: goalTitle,
        link: "/employee/goals",
        meta: "Goal",
      })
    })
  learningPaths
    .filter((l) => l.status !== "completed")
    .slice(0, 5)
    .forEach((l, i) => {
      const courseTitle = (l.course || "Training").slice(0, 50) + ((l.course?.length ?? 0) > 50 ? "…" : "")
      feedItems.push({
        id: `assigned-training-${l.id ?? i}`,
        type: "assigned",
        avatar: (
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600">
            <BookOpen className="w-5 h-5" />
          </div>
        ),
        title: "Training assigned to you",
        subtitle: courseTitle,
        link: "/employee/development",
        meta: "Training",
      })
    })
  myProjects.slice(0, 3).forEach(({ projectId, projectName, tasks }) => {
    feedItems.push({
      id: `assigned-proj-${projectId}`,
      type: "assigned",
      avatar: (
        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600">
          <FolderKanban className="w-5 h-5" />
        </div>
      ),
      title: "Tasks assigned to you",
      subtitle: `${tasks.length} task${tasks.length === 1 ? "" : "s"} on ${projectName}`,
      link: `/projects/${projectId}`,
      meta: "Project",
    })
  })

  // Upcoming events (reviews, goal due dates, training due dates)
  upcomingEvents.slice(0, 3).forEach((event, i) => {
    feedItems.push({
      id: `event-${i}`,
      type: "event",
      avatar: (
        <div className={`w-10 h-10 rounded-full bg-muted flex items-center justify-center ${event.color}`}>
          <event.icon className="w-5 h-5" />
        </div>
      ),
      title: event.title,
      subtitle: event.date,
      time: "Upcoming",
      link: event.link,
      meta: event.type,
    })
  })
  const catchUpMessage = "You're all caught up. Complete goals and training to see updates here."
  notifications
    .filter((n) => n.message && n.message !== catchUpMessage)
    .slice(0, 3)
    .forEach((n, i) => {
      feedItems.push({
        id: `notif-${i}`,
        type: "notification",
        avatar: (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${n.unread ? "bg-primary/20 text-primary" : "bg-muted"}`}>
            <Bell className="w-5 h-5" />
          </div>
        ),
        title: n.message,
        subtitle: n.time,
        link: n.link,
      })
    })
  // Real achievements only (exclude "Get started" placeholder)
  recentAchievements
    .filter((a) => a.title !== "Get started")
    .slice(0, 2)
    .forEach((a, i) => {
      feedItems.push({
        id: `ach-${i}`,
        type: "achievement",
        avatar: (
          <div className={`w-10 h-10 rounded-full bg-background flex items-center justify-center border ${a.color}`}>
            <a.icon className="w-5 h-5" />
          </div>
        ),
        title: a.title,
        subtitle: a.description,
      })
    })

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 py-6 pt-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left sidebar - profile card + shortcuts (social-style) */}
          <aside className="lg:col-span-4 xl:col-span-3 order-2 lg:order-1 space-y-4">
            <Card className="overflow-hidden border-0 shadow-sm">
              <div className="h-16 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
              <CardContent className="pt-0 pb-4 -mt-8 px-4">
                <div className="flex flex-col items-center text-center">
                  {employee.photo_url ? (
                    <img
                      src={employee.photo_url}
                      alt={employee.name}
                      className="w-16 h-16 rounded-full object-cover border-4 border-background shadow"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/10 border-4 border-background flex items-center justify-center text-xl font-bold text-primary shadow">
                      {employee.name?.split(" ").map((n) => n[0]).join("") || "?"}
                    </div>
                  )}
                  <h2 className="font-semibold text-lg mt-2">{employee.name}</h2>
                  <p className="text-sm text-muted-foreground">{employee.position}</p>
                  <p className="text-xs text-muted-foreground">{employee.department}</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-3">
                    <Badge variant="secondary" className="text-xs">
                      {performanceScore != null ? `${Number(performanceScore).toFixed(1)}/5` : "—"} perf
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {goalsCompleted}/{goalsTotal} goals
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-4" asChild>
                    <Link to="/employee/profile">Edit profile</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Shortcuts</p>
                <div className="space-y-1">
                  {quickActions.map((action) => (
                    <Link key={action.label} to={action.link}>
                      <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/80 transition-colors">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${action.color}`}>
                          <action.icon className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm font-medium">{action.label}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Performance</span>
                  <Link to="/employee/performance" className="text-xs text-primary">View</Link>
                </div>
                <Progress value={performanceScore != null ? (performanceScore / 5) * 100 : 0} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  Next review: {nextReviewDate ? new Date(nextReviewDate).toLocaleDateString() : "—"}
                </p>
              </CardContent>
            </Card>
          </aside>

          {/* Center - feed (Facebook/Instagram style) */}
          <main className="lg:col-span-8 xl:col-span-6 order-1 lg:order-2 space-y-4">
            {/* Composer bar - "What's on your mind?" style */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {employee.photo_url ? (
                    <img src={employee.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {employee.name?.split(" ").map((n) => n[0]).join("") || "?"}
                    </div>
                  )}
                  <Link to="/employee/directory" className="flex-1 rounded-full bg-muted px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/80 transition-colors text-left">
                    Find someone in the directory…
                  </Link>
                  <Button variant="ghost" size="icon" onClick={() => refresh()} title="Notifications">
                    <Bell className="h-5 w-5" />
                    {notifications.filter((n) => n.unread).length > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <h2 className="text-lg font-semibold px-1">Your feed</h2>
            <div className="space-y-3">
              {feedItems.length === 0 ? (
                <Card className="border-0 shadow-sm">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Nothing in your feed yet.</p>
                    <p className="text-sm mt-1">Goals, events, and updates will show up here.</p>
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                      <Button variant="outline" size="sm" asChild><Link to="/employee/goals">Goals</Link></Button>
                      <Button variant="outline" size="sm" asChild><Link to="/employee/directory">Directory</Link></Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                feedItems.map((item) => {
                  const content = (
                    <div className="flex gap-3 p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow transition-shadow">
                      <div className="shrink-0">{item.avatar}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{item.title}</span>
                          {item.meta && (
                            <Badge variant="outline" className="text-xs">{item.meta}</Badge>
                          )}
                        </div>
                        {item.subtitle && (
                          <p className="text-sm text-muted-foreground mt-0.5">{item.subtitle}</p>
                        )}
                        {item.time && (
                          <p className="text-xs text-muted-foreground mt-1">{item.time}</p>
                        )}
                        {item.link && (
                          <Link to={item.link} className="text-sm text-primary mt-2 inline-flex items-center gap-1">
                            View <ArrowRight className="w-3 h-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                  return item.link ? (
                    <Link key={item.id} to={item.link}>{content}</Link>
                  ) : (
                    <div key={item.id}>{content}</div>
                  )
                })
              )}
            </div>
          </main>

          {/* Right sidebar - achievements + resources */}
          <aside className="lg:col-span-4 xl:col-span-3 order-3 space-y-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Achievements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentAchievements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Complete goals or training to earn badges.</p>
                ) : (
                  recentAchievements.map((achievement, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${achievement.color}`}>
                        <achievement.icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{achievement.title}</p>
                        <p className="text-xs text-muted-foreground">{achievement.description}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Resources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                  <Link to="/employee/profile"><MessageSquare className="w-4 h-4 mr-2" />My Profile</Link>
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                  <Link to="/employee/directory"><Users className="w-4 h-4 mr-2" />Company Directory</Link>
                </Button>
                <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                  <Link to="/employee/development"><BookOpen className="w-4 h-4 mr-2" />Learning</Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  )
}

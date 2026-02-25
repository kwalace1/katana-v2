import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  BookOpen,
  Award,
  Search,
  Play,
  CheckCircle2,
  Clock,
  TrendingUp,
  Star,
  Users,
  Calendar,
} from "lucide-react"
import { useEmployeePortal } from "@/contexts/EmployeePortalContext"
import { EmployeePortalNoAccess } from "@/components/employee/EmployeePortalNoAccess"
import { LoadingState } from "@/components/ui/loading-state"
import * as hrApi from "@/lib/hr-api"

export default function EmployeeDevelopmentPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const { employee, employeeId, loading: portalLoading, error: portalError } = useEmployeePortal()
  const [learningPaths, setLearningPaths] = useState<hrApi.LearningPath[]>([])

  useEffect(() => {
    if (!employeeId) return
    hrApi.getLearningPathsByEmployeeId(employeeId).then(setLearningPaths)
  }, [employeeId])

  const myCourses = useMemo(
    () =>
      learningPaths.map((lp) => ({
        id: lp.id,
        title: lp.course || "Untitled course",
        provider: "Assigned",
        progress: lp.progress ?? 0,
        status: lp.status === "completed" ? "completed" : "in-progress",
        dueDate: lp.due_date ? new Date(lp.due_date).toLocaleDateString() : "",
        completedDate: lp.status === "completed" && lp.updated_at ? new Date(lp.updated_at).toLocaleDateString() : undefined,
        instructor: "",
        duration: "",
      })),
    [learningPaths]
  )

  const catalog: { id: string; title: string; provider: string; rating: number; students: number; duration: string; level: string; category: string }[] = []
  const certifications: { id: string; name: string; issuer: string; issueDate: string; expiryDate: string | null; status: string }[] = []
  const skills: { name: string; level: number; category: string }[] = []
  const learningHoursThisMonth = 0

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
        <h1 className="text-3xl font-bold text-foreground mb-2">Learning & Development</h1>
        <p className="text-muted-foreground">Grow your skills and advance your career</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Courses In Progress</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{myCourses.filter(c => c.status === "in-progress").length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{myCourses.filter(c => c.status === "completed").length}</div>
            <p className="text-xs text-muted-foreground mt-1">This quarter</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Certifications</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{certifications.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Active credentials (when tracked)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Learning Hours</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{learningHoursThisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">This month (tracked when linked)</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="my-courses" className="space-y-6">
        <TabsList>
          <TabsTrigger value="my-courses">My Courses</TabsTrigger>
          <TabsTrigger value="catalog">Course Catalog</TabsTrigger>
          <TabsTrigger value="certifications">Certifications</TabsTrigger>
          <TabsTrigger value="skills">Skills</TabsTrigger>
        </TabsList>

        {/* My Courses */}
        <TabsContent value="my-courses" className="space-y-4">
          {myCourses.map((course) => (
            <Card key={course.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {course.title}
                      <Badge variant={course.status === "completed" ? "default" : "outline"}>
                        {course.status === "completed" ? "Completed" : "In Progress"}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {course.provider} • Instructor: {course.instructor} • {course.duration}
                    </CardDescription>
                  </div>
                  <Button size="sm">
                    {course.status === "completed" ? "Review" : "Continue"}
                    <Play className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {course.status === "in-progress" && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Progress</span>
                      <span className="text-sm font-bold">{course.progress}%</span>
                    </div>
                    <Progress value={course.progress} className="h-2 mb-2" />
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      Due {course.dueDate}
                    </div>
                  </>
                )}
                {course.status === "completed" && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Completed on {course.completedDate}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Course Catalog - empty until linked to a course provider */}
        <TabsContent value="catalog" className="space-y-4">
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No course catalog available yet. Courses will appear here when your organization connects a learning provider.
            </p>
          ) : (
          <>
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {catalog.map((course) => (
              <Card key={course.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="outline">{course.category}</Badge>
                    <Badge variant="secondary">{course.level}</Badge>
                  </div>
                  <CardTitle className="text-lg">{course.title}</CardTitle>
                  <CardDescription>{course.provider}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                        <span className="font-medium">{course.rating}</span>
                      </div>
                      <span className="text-muted-foreground">{course.students.toLocaleString()} students</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {course.duration}
                    </div>
                    <Button className="w-full">
                      Enroll Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          </>
          )}
        </TabsContent>

        {/* Certifications */}
        <TabsContent value="certifications" className="space-y-4">
          {certifications.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No certifications recorded yet. Certifications will appear here when they are added to your profile.
            </p>
          ) : certifications.map((cert) => (
            <Card key={cert.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-primary" />
                      {cert.name}
                    </CardTitle>
                    <CardDescription>Issued by {cert.issuer}</CardDescription>
                  </div>
                  <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/10">
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Issued: {cert.issueDate}</span>
                  {cert.expiryDate && (
                    <>
                      <span>•</span>
                      <span>Expires: {cert.expiryDate}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Skills */}
        <TabsContent value="skills" className="space-y-6">
          {skills.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No skills recorded. Skills will appear here when they are tracked in the system.
            </p>
          ) : (
            <>
              {["Technical", "Soft Skills"].map((category) => (
                <Card key={category}>
                  <CardHeader>
                    <CardTitle>{category} Skills</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {skills.filter((s) => s.category === category).map((skill, index) => (
                        <div key={index}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{skill.name}</span>
                            <span className="text-sm font-bold">{skill.level}%</span>
                          </div>
                          <Progress value={skill.level} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}


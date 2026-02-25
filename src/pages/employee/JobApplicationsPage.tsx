import { useState, useEffect } from 'react'
import * as recruitmentDb from '@/lib/recruitment-db'
import { useEmployeePortal } from '@/contexts/EmployeePortalContext'
import { EmployeePortalNoAccess } from '@/components/employee/EmployeePortalNoAccess'
import { LoadingState } from '@/components/ui/loading-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Clock,
  Search,
  Bookmark,
  Send,
  CheckCircle2,
  AlertCircle,
  Calendar
} from "lucide-react"

interface Job {
  id: string
  title: string
  department: string
  location: string
  type: "full-time" | "part-time" | "contract"
  level: "entry" | "mid" | "senior" | "lead"
  salary: string
  postedDate: string
  description: string
  requirements: string[]
}

interface Application {
  id: string
  jobTitle: string
  department: string
  appliedDate: string
  status: "under-review" | "interview" | "offer" | "rejected"
}

export default function JobApplicationsPage() {
  const { employee, loading: portalLoading, error: portalError } = useEmployeePortal()
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  const myApplications: Application[] = []
  const savedJobs: { id: string; jobTitle: string; department: string }[] = []

  useEffect(() => {
    recruitmentDb.getAllJobs().then((data) => {
      const mapped: Job[] = data
        .filter((j) => j.is_active !== false)
        .map((j) => ({
          id: j.id,
          title: j.title,
          department: j.department ?? "",
          location: j.location ?? "",
          type: j.type === "internship" ? "contract" : j.type,
          level: j.level,
          salary: j.salary ?? "",
          postedDate: j.postedDate ?? "",
          description: j.description ?? "",
          requirements: Array.isArray(j.qualifications) ? j.qualifications : [],
        }))
      setJobs(mapped)
    }).catch(() => setJobs([])).finally(() => setLoading(false))
  }, [])

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.department.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDepartment = departmentFilter === "all" || job.department === departmentFilter
    return matchesSearch && matchesDepartment
  })

  const getLevelColor = (level: string) => {
    switch (level) {
      case "entry": return "border-green-500 text-green-600 bg-green-500/10"
      case "mid": return "border-blue-500 text-blue-600 bg-blue-500/10"
      case "senior": return "border-purple-500 text-purple-600 bg-purple-500/10"
      case "lead": return "border-orange-500 text-orange-600 bg-orange-500/10"
      default: return ""
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "under-review": return "border-yellow-500 text-yellow-600 bg-yellow-500/10"
      case "interview": return "border-blue-500 text-blue-600 bg-blue-500/10"
      case "offer": return "border-green-500 text-green-600 bg-green-500/10"
      case "rejected": return "border-red-500 text-red-600 bg-red-500/10"
      default: return ""
    }
  }

  if (portalLoading) {
    return <LoadingState message="Loading…" className="my-16" />
  }
  if (!employee) {
    return <EmployeePortalNoAccess error={portalError ?? undefined} />
  }
  if (loading) {
    return <LoadingState message="Loading jobs…" className="my-16" />
  }

  return (
    <div className="min-h-screen bg-background p-6 my-16">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Internal Jobs</h1>
        <p className="text-muted-foreground">Explore new opportunities within the company</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{jobs.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Applications</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{myApplications.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saved Jobs</CardTitle>
            <Bookmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{savedJobs.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="browse" className="space-y-6">
        <TabsList>
          <TabsTrigger value="browse">Browse Jobs ({jobs.length})</TabsTrigger>
          <TabsTrigger value="applications">My Applications ({myApplications.length})</TabsTrigger>
          <TabsTrigger value="saved">Saved ({savedJobs.length})</TabsTrigger>
        </TabsList>

        {/* Browse Jobs */}
        <TabsContent value="browse" className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search jobs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {Array.from(new Set(jobs.map((j) => j.department).filter(Boolean))).sort().map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Job Listings */}
          <div className="space-y-4">
            {filteredJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">
                No open positions at the moment. Check back later for new opportunities.
              </p>
            ) : filteredJobs.map((job) => (
              <Card key={job.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle>{job.title}</CardTitle>
                        <Badge variant="outline" className={getLevelColor(job.level)}>
                          {job.level}
                        </Badge>
                        <Badge variant="outline">{job.type}</Badge>
                      </div>
                      <CardDescription>{job.department}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon">
                        <Bookmark className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{job.description}</p>

                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {job.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {job.salary}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Posted {job.postedDate}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-2">Requirements:</h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {job.requirements.map((req, i) => (
                        <li key={i}>{req}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1">
                      <Send className="w-4 h-4 mr-2" />
                      Apply Now
                    </Button>
                    <Button variant="outline">View Details</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* My Applications */}
        <TabsContent value="applications" className="space-y-4">
          {myApplications.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              You haven&apos;t applied to any internal positions yet. Browse open jobs and click Apply to submit an application.
            </p>
          ) : myApplications.map((app) => (
            <Card key={app.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{app.jobTitle}</CardTitle>
                    <CardDescription>{app.department}</CardDescription>
                  </div>
                  <Badge variant="outline" className={getStatusColor(app.status)}>
                    {app.status === "under-review" ? (
                      <>
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Under Review
                      </>
                    ) : app.status === "interview" ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Interview Stage
                      </>
                    ) : (
                      app.status
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Applied {app.appliedDate}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Saved Jobs */}
        <TabsContent value="saved" className="space-y-4">
          {savedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No saved jobs. Save positions you&apos;re interested in to find them here.
            </p>
          ) : savedJobs.map((job) => (
            <Card key={job.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{job.jobTitle}</CardTitle>
                    <CardDescription>{job.department}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                    <Button size="sm">
                      <Send className="w-4 h-4 mr-2" />
                      Apply
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}


import { useState, useEffect } from 'react'
import * as hrApi from '@/lib/hr-api'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { 
  Search, 
  Users, 
  Mail, 
  Phone, 
  MapPin, 
  Grid3x3,
  List
} from "lucide-react"

interface Employee {
  id: string
  name: string
  position: string
  department: string
  location: string
  email: string
  phone: string
  manager: string
  photo: string
  timezone: string
  status: "active" | "away" | "offline"
}

export default function EmployeeDirectoryPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [locationFilter, setLocationFilter] = useState("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    hrApi.getAllEmployees().then((all) => {
      const mapped: Employee[] = all.map((e) => ({
        id: e.id,
        name: e.name,
        position: e.position,
        department: e.department,
        location: "", // HR employees don't have location; add to schema if needed
        email: e.email ?? "",
        phone: e.phone ?? "",
        manager: e.manager?.name ?? "",
        photo: e.photo_url ?? "",
        timezone: "",
        status: e.status === "Active" ? "active" : e.status === "On Leave" ? "away" : "offline",
      }))
      setEmployees(mapped)
    }).catch(() => setEmployees([])).finally(() => setLoading(false))
  }, [])

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         employee.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         employee.department.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDepartment = departmentFilter === "all" || employee.department === departmentFilter
    const matchesLocation = locationFilter === "all" || employee.location === locationFilter
    
    return matchesSearch && matchesDepartment && matchesLocation
  })

  const departments = Array.from(new Set(employees.map(e => e.department)))
  const locations = Array.from(new Set(employees.map(e => e.location)))

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500"
      case "away": return "bg-yellow-500"
      case "offline": return "bg-gray-500"
      default: return "bg-gray-500"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Online"
      case "away": return "Away"
      case "offline": return "Offline"
      default: return "Unknown"
    }
  }

  if (loading) {
    return <LoadingState message="Loading directory…" className="my-16" />
  }

  const deptColors: Record<string, string> = {}
  const colorPalette = [
    "from-blue-500/80 to-cyan-500/80",
    "from-violet-500/80 to-purple-500/80",
    "from-amber-500/80 to-orange-500/80",
    "from-emerald-500/80 to-teal-500/80",
    "from-rose-500/80 to-pink-500/80",
  ]
  departments.forEach((d, i) => {
    deptColors[d] = colorPalette[i % colorPalette.length]
  })

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 py-6 pt-24">
        {/* Social-style header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">People</h1>
          <p className="text-muted-foreground text-sm">Find and connect with your team</p>
        </div>

        {/* Search bar - single line like social apps */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search people..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-full bg-background border-border shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={departmentFilter === "all" ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => setDepartmentFilter("all")}
            >
              All
            </Button>
            {departments.map((dept) => (
              <Button
                key={dept}
                variant={departmentFilter === dept ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={() => setDepartmentFilter(dept)}
              >
                {dept}
              </Button>
            ))}
            <div className="flex gap-1 ml-auto">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="icon"
                className="rounded-full h-9 w-9"
                onClick={() => setViewMode("grid")}
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="icon"
                className="rounded-full h-9 w-9"
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {filteredEmployees.length} of {employees.length} people
        </p>

        {/* Profile cards - Instagram/LinkedIn style */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((employee) => (
              <Card
                key={employee.id}
                className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                onClick={() => setSelectedEmployee(employee)}
              >
                <div className={`h-20 bg-gradient-to-br ${deptColors[employee.department] ?? "from-muted to-muted/80"}`} />
                <CardContent className="pt-0 pb-4 -mt-10 px-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-2">
                      {employee.photo && employee.photo !== "/placeholder.svg?height=100&width=100" ? (
                        <img
                          src={employee.photo}
                          alt={employee.name}
                          className="w-16 h-16 rounded-full object-cover border-4 border-background shadow"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = "none"
                            const fallback = target.nextElementSibling as HTMLElement
                            if (fallback) fallback.style.display = "flex"
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-16 h-16 rounded-full border-4 border-background shadow flex items-center justify-center text-lg font-bold text-primary bg-primary/10 ${employee.photo && employee.photo !== "/placeholder.svg?height=100&width=100" ? "hidden" : ""}`}
                      >
                        {employee.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full ${getStatusColor(employee.status)} border-2 border-background`} />
                    </div>
                    <h3 className="font-semibold text-foreground">{employee.name}</h3>
                    <p className="text-sm text-muted-foreground">{employee.position}</p>
                    <p className="text-xs text-muted-foreground">{employee.department}</p>
                    <div className="flex gap-2 mt-3 w-full justify-center" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="default" className="rounded-full flex-1 max-w-[120px]" asChild>
                        <a href={`mailto:${employee.email}`}>
                          <Mail className="w-3 h-3 mr-1" />
                          Message
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => setSelectedEmployee(employee)}>
                        Profile
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEmployees.map((employee) => (
              <div
                key={employee.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedEmployee(employee)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setSelectedEmployee(employee)
                  }
                }}
                className="flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow transition-all cursor-pointer"
              >
                <div className="relative shrink-0">
                  {employee.photo && employee.photo !== "/placeholder.svg?height=100&width=100" && (
                    <img
                      src={employee.photo}
                      alt={employee.name}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = "none"
                        const fallback = target.nextElementSibling as HTMLElement
                        if (fallback) fallback.style.display = "flex"
                      }}
                    />
                  )}
                  <div
                    className={`w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary ${employee.photo && employee.photo !== "/placeholder.svg?height=100&width=100" ? "hidden" : ""}`}
                  >
                    {employee.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{employee.name}</h3>
                    <Badge variant="outline" className="text-xs">{getStatusLabel(employee.status)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{employee.position} · {employee.department}</p>
                </div>
                <Button size="sm" variant="outline" className="rounded-full shrink-0" onClick={(e) => e.stopPropagation()} asChild>
                  <a href={`mailto:${employee.email}`}>
                    <Mail className="w-4 h-4 mr-1" />
                    Message
                  </a>
                </Button>
              </div>
            ))}
          </div>
        )}

        <Dialog open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>{selectedEmployee?.name}</DialogTitle>
            </DialogHeader>
            {selectedEmployee && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3">
                  {selectedEmployee.photo && selectedEmployee.photo !== "/placeholder.svg?height=100&width=100" ? (
                    <img
                      src={selectedEmployee.photo}
                      alt={selectedEmployee.name}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
                      {selectedEmployee.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{selectedEmployee.position}</p>
                    <Badge variant="outline">{selectedEmployee.department}</Badge>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4 shrink-0" />
                    <a href={`mailto:${selectedEmployee.email}`} className="hover:text-primary truncate">
                      {selectedEmployee.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{selectedEmployee.phone}</span>
                  </div>
                  {(selectedEmployee.location || selectedEmployee.timezone) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span>{[selectedEmployee.location, selectedEmployee.timezone].filter(Boolean).join(" · ") || "—"}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4 shrink-0" />
                    <span>Reports to {selectedEmployee.manager || "—"}</span>
                  </div>
                </div>
                <Button className="w-full rounded-full" asChild>
                  <a href={`mailto:${selectedEmployee.email}`}>
                    <Mail className="w-4 h-4 mr-2" />
                    Send message
                  </a>
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {filteredEmployees.length === 0 && (
          <Card className="border-0 shadow-sm">
            <EmptyState
              icon={Users}
              title="No people found"
              description="Try a different search or filter"
              compact
            />
          </Card>
        )}
      </div>
    </div>
  )
}


import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useEmployeePortal } from '@/contexts/EmployeePortalContext'
import { EmployeePortalNoAccess } from '@/components/employee/EmployeePortalNoAccess'
import { LoadingState } from '@/components/ui/loading-state'
import * as hrApi from '@/lib/hr-api'
import { getTimezoneFromLocation } from '@/lib/location-timezone'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  Briefcase,
  Clock,
  Shield,
  Bell,
  Lock,
  Edit2,
  Save,
  X,
  Loader2
} from "lucide-react"

const PROFILE_NOTIFICATIONS_KEY = 'employeePortal_notifications'
const PROFILE_PRIVACY_KEY = 'employeePortal_privacy'

const defaultNotifications = [
  { id: "email", label: "Email Notifications", enabled: true },
  { id: "performance", label: "Performance Reviews", enabled: true },
  { id: "goals", label: "Goal Updates", enabled: true },
  { id: "training", label: "Training Reminders", enabled: true },
  { id: "announcements", label: "Company Announcements", enabled: false },
]

const defaultPrivacy = [
  { id: "profile", label: "Show profile in directory", enabled: true },
  { id: "phone", label: "Show phone number", enabled: true },
  { id: "email", label: "Show email address", enabled: true },
  { id: "location", label: "Show location", enabled: false },
]

function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch {}
  return defaultValue
}

export default function EmployeeProfilePage() {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [detectingTimezone, setDetectingTimezone] = useState(false)
  const { employee, loading, error, refresh } = useEmployeePortal()

  const nameParts = (employee?.name ?? "").trim().split(" ")
  const initialProfile = employee
    ? {
        firstName: nameParts[0] ?? "",
        lastName: nameParts.slice(1).join(" ") ?? "",
        email: employee.email ?? "",
        phone: employee.phone ?? "",
        location: (employee as hrApi.Employee & { location?: string }).location ?? "",
        timezone: (employee as hrApi.Employee & { timezone?: string }).timezone ?? "",
        employeeId: employee.id.slice(0, 8),
        department: employee.department,
        position: employee.position,
        manager: employee.manager?.name ?? "",
        startDate: employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : "",
        employmentType: "Full-time",
        bio: (employee as hrApi.Employee & { bio?: string }).bio ?? "",
      }
    : null

  const [profile, setProfile] = useState(initialProfile)
  const [notificationSettings, setNotificationSettings] = useState<typeof defaultNotifications>(() =>
    loadFromStorage(PROFILE_NOTIFICATIONS_KEY, defaultNotifications)
  )
  const [privacySettings, setPrivacySettings] = useState<typeof defaultPrivacy>(() =>
    loadFromStorage(PROFILE_PRIVACY_KEY, defaultPrivacy)
  )

  useEffect(() => {
    if (!employee) return
    const np = (employee.name ?? "").trim().split(" ")
    setProfile({
      firstName: np[0] ?? "",
      lastName: np.slice(1).join(" ") ?? "",
      email: employee.email ?? "",
      phone: employee.phone ?? "",
      location: (employee as hrApi.Employee & { location?: string }).location ?? "",
      timezone: (employee as hrApi.Employee & { timezone?: string }).timezone ?? "",
      employeeId: employee.id.slice(0, 8),
      department: employee.department,
      position: employee.position,
      manager: employee.manager?.name ?? "",
      startDate: employee.hire_date ? new Date(employee.hire_date).toLocaleDateString() : "",
      employmentType: "Full-time",
      bio: (employee as hrApi.Employee & { bio?: string }).bio ?? "",
    })
  }, [employee])

  const handleToggleNotification = (id: string) => {
    setNotificationSettings((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
      if (typeof window !== 'undefined') localStorage.setItem(PROFILE_NOTIFICATIONS_KEY, JSON.stringify(next))
      return next
    })
  }

  const handleTogglePrivacy = (id: string) => {
    setPrivacySettings((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
      if (typeof window !== 'undefined') localStorage.setItem(PROFILE_PRIVACY_KEY, JSON.stringify(next))
      return next
    })
  }

  const handleSave = async () => {
    if (!employee || !profile) return
    setSaving(true)
    try {
      const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim() || employee.name
      const baseUpdates = {
        name,
        email: profile.email.trim() || employee.email,
        phone: profile.phone?.trim() ?? undefined,
      }
      const result = await hrApi.updateEmployee(employee.id, baseUpdates)
      if (!result) {
        toast.error("Failed to save profile. Please try again.")
        return
      }
      const loc = profile.location.trim()
      const tz = profile.timezone.trim()
      const bioVal = profile.bio.trim()
      let extOk = true
      if (loc || tz || bioVal) {
        const extResult = await hrApi.updateEmployee(employee.id, {
          ...baseUpdates,
          ...(loc && { location: loc }),
          ...(tz && { timezone: tz }),
          ...(bioVal && { bio: bioVal }),
        })
        extOk = !!extResult
      }
      await refresh()
      setIsEditing(false)
      if (extOk) {
        toast.success("Profile updated")
      } else {
        toast.success("Phone and name saved. For location, timezone, and bio, run supabase-hr-profile-fields-migration.sql in Supabase SQL Editor.")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (initialProfile) setProfile(initialProfile)
    setIsEditing(false)
  }

  const handleDetectTimezone = async () => {
    const loc = profile?.location?.trim()
    if (!loc) {
      toast.error("Enter a location first")
      return
    }
    setDetectingTimezone(true)
    try {
      const tz = await getTimezoneFromLocation(loc)
      if (tz) {
        setProfile((p) => (p ? { ...p, timezone: tz } : p))
        toast.success(`Timezone set to ${tz}`)
      } else {
        toast.error("Could not detect timezone for that location")
      }
    } catch {
      toast.error("Could not detect timezone")
    } finally {
      setDetectingTimezone(false)
    }
  }

  const handleLocationBlur = () => {
    if (profile?.location?.trim() && !profile?.timezone?.trim()) {
      handleDetectTimezone()
    }
  }

  if (loading) {
    return <LoadingState message="Loading profile…" className="my-16" />
  }
  if (!employee) {
    return <EmployeePortalNoAccess error={error ?? undefined} />
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background p-6 my-16 flex items-center justify-center">
        <div className="text-muted-foreground">Loading profile…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6 my-16">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">My Profile</h1>
            <p className="text-muted-foreground">Manage your personal information and settings</p>
          </div>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Photo & Quick Info */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="relative">
                  {employee.photo_url ? (
                    <img
                      src={employee.photo_url}
                      alt={employee.name}
                      className="w-32 h-32 rounded-full object-cover mb-4 border-2 border-background"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center text-4xl font-bold text-primary mb-4">
                      {(profile.firstName[0] ?? "")}{(profile.lastName[0] ?? "") || profile.firstName[0]}
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-bold mb-1">
                  {profile.firstName} {profile.lastName}
                </h2>
                <p className="text-muted-foreground mb-2">{profile.position}</p>
                <Badge variant="outline" className="mb-4">{profile.employmentType}</Badge>
                
                <div className="w-full space-y-3 mt-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="w-4 h-4" />
                    <span>{profile.department}</span>
                  </div>
                  {profile.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{profile.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {profile.startDate}</span>
                  </div>
                  {profile.timezone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>{profile.timezone}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact - show only when data exists (future HR field) */}
        </div>

        {/* Right Column - Detailed Information */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="personal" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            {/* Personal Information Tab */}
            <TabsContent value="personal" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                  <CardDescription>Update your personal details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input 
                        id="firstName" 
                        value={profile.firstName}
                        disabled={!isEditing}
                        onChange={(e) => setProfile({...profile, firstName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input 
                        id="lastName" 
                        value={profile.lastName}
                        disabled={!isEditing}
                        onChange={(e) => setProfile({...profile, lastName: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email"
                      value={profile.email}
                      disabled={!isEditing}
                      onChange={(e) => setProfile({...profile, email: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input 
                      id="phone" 
                      type="tel"
                      value={profile.phone}
                      disabled={!isEditing}
                      onChange={(e) => setProfile({...profile, phone: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={profile.location}
                        disabled={!isEditing}
                        onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                        onBlur={isEditing ? handleLocationBlur : undefined}
                        placeholder="e.g. Philadelphia, Pennsylvania"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timezone">Timezone</Label>
                      <div className="flex gap-2">
                        <Input
                          id="timezone"
                          value={profile.timezone}
                          disabled={!isEditing}
                          onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                          placeholder="Auto-detect from location"
                        />
                        {isEditing && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={handleDetectTimezone}
                            disabled={detectingTimezone || !profile.location?.trim()}
                            title="Auto-detect timezone from location"
                          >
                            {detectingTimezone ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MapPin className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Timezone is auto-detected when you blur the location field, or click the icon.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <textarea 
                      id="bio"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={profile.bio}
                      disabled={!isEditing}
                      onChange={(e) => setProfile({...profile, bio: e.target.value})}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Employment Information Tab */}
            <TabsContent value="employment" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Employment Details</CardTitle>
                  <CardDescription>Your work-related information (read-only)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Employee ID</Label>
                      <Input value={profile.employeeId} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Employment Type</Label>
                      <Input value={profile.employmentType} disabled />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Position</Label>
                    <Input value={profile.position} disabled />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Department</Label>
                      <Input value={profile.department} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Manager</Label>
                      <Input value={profile.manager} disabled />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input value={profile.startDate} disabled />
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      To update employment information, please contact HR at <a href="mailto:hr@company.com" className="text-primary hover:underline">hr@company.com</a>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5" />
                    Notification Preferences
                  </CardTitle>
                  <CardDescription>Choose what notifications you want to receive</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {notificationSettings.map((setting) => (
                    <div key={setting.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{setting.label}</p>
                      </div>
                      <Button
                        variant={setting.enabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleToggleNotification(setting.id)}
                      >
                        {setting.enabled ? "Enabled" : "Disabled"}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Privacy Settings
                  </CardTitle>
                  <CardDescription>Control what information is visible to others</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {privacySettings.map((setting) => (
                    <div key={setting.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{setting.label}</p>
                      </div>
                      <Button
                        variant={setting.enabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleTogglePrivacy(setting.id)}
                      >
                        {setting.enabled ? "Visible" : "Hidden"}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab - account security is managed through your organization's authentication */}
            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Account Security
                  </CardTitle>
                  <CardDescription>Your account is secured through your organization&apos;s authentication. Sign out using the menu in the header to end your session.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Password changes, two-factor authentication, and session management are handled by your organization&apos;s identity provider. Contact your IT administrator if you need to update your security settings.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}


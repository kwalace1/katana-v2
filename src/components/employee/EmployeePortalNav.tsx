import { NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Star,
  Target,
  BookOpen,
  User,
  Briefcase,
  Sparkles,
} from 'lucide-react'

const portalItems = [
  { path: '/employee', label: 'Feed', icon: LayoutDashboard, end: true },
  { path: '/employee/directory', label: 'People', icon: Users, end: false },
  { path: '/employee/performance', label: 'Performance', icon: Star, end: false },
  { path: '/employee/goals', label: 'Goals', icon: Target, end: false },
  { path: '/employee/development', label: 'Learning', icon: BookOpen, end: false },
  { path: '/employee/profile', label: 'Profile', icon: User, end: false },
  { path: '/employee/jobs', label: 'Jobs', icon: Briefcase, end: false },
]

export function EmployeePortalNav() {
  return (
    <nav
      className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      aria-label="Employee portal"
    >
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between gap-2 py-3">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {portalItems.map(({ path, label, icon: Icon, end }) => (
              <NavLink
                key={path}
                to={path}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors shrink-0 ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </NavLink>
            ))}
          </div>
          <Link
            to="/hub"
            title="Go to Katana Hub"
            className="flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/80 transition-colors shrink-0"
          >
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            Hub
          </Link>
        </div>
      </div>
    </nav>
  )
}

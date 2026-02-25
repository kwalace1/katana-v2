import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  FileText,
  MessageSquare,
  FolderOpen,
  Zap,
  BarChart3,
  Settings,
  Upload,
  Play,
  History,
  Camera,
  MousePointer,
  Download,
  FileInput,
  Bot,
  User,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
} from "lucide-react"
import * as HRApi from "@/lib/hr-api"
import * as ProjectData from "@/lib/project-data-supabase"
import { getAllJobs, getAllApplications } from "@/lib/recruitment-db"
import * as CSApi from "@/lib/customer-success-api"

type AutomationActivityStatus = 'success' | 'info' | 'error'

type AutomationActivityType = 'task' | 'document' | 'chat' | 'system'

interface AutomationActivity {
  id: string
  type: AutomationActivityType
  title: string
  status: AutomationActivityStatus
  createdAt: string
}

const AUTOMATION_FEED_STORAGE_KEY = 'zenith_automation_activities'

function loadAutomationActivities(): AutomationActivity[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(AUTOMATION_FEED_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as AutomationActivity[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diffMs = now - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)

  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return d.toLocaleDateString()
}

/** Indexed docs list for "list documents" / "summarize" (in-memory; could sync from Documents tab later). */
const PLACEHOLDER_DOCS = [
  { name: 'Contract_2024.pdf', summary: 'Annual service agreement with standard terms, renewal date Q4 2024.' },
  { name: 'Report_Q1.docx', summary: 'Q1 performance report: revenue up 12%, key metrics on track.' },
  { name: 'Data_Analysis.xlsx', summary: 'Spreadsheet with sales and inventory data; 3 sheets.' },
]

type ChatAction = 'switch_documents' | 'switch_automation' | 'open_url' | 'clear_chat' | null

type ParseResult = { reply: string; action: ChatAction; actionPayload?: string; dataCommand?: string }

function parseChatCommand(message: string): ParseResult {
  const raw = message.trim().toLowerCase()
  const words = raw.split(/\s+/)
  const first = words[0] ?? ''

  // help / what can you do / commands
  if (/^(help|what can you do|commands|options)\b/.test(raw) || raw === '?') {
    return {
      reply: `Here’s what you can do (no AI key required):\n\n• **help** – show this list\n• **list documents** – show indexed documents\n• **summarize [document name]** – short summary of a doc (e.g. "summarize Contract_2024.pdf")\n• **screenshot &lt;url&gt;** – queue screenshot task (e.g. "screenshot https://example.com")\n• **extract text from &lt;url&gt;** – queue text extraction\n• **open &lt;url&gt;** – open link in a new tab\n• **go to documents** – jump to Documents tab\n• **go to automation** – jump to Automation tab\n• **time** or **date** – current time/date\n• **clear** – reset this chat`,
      action: null,
    }
  }

  // Data commands (reply filled by fetchDataReply)
  if (/^hr\s+stats?/.test(raw) || raw === 'hr') return { reply: '', action: null, dataCommand: 'hr_stats' }
  if (/^list\s+employees?/.test(raw) || raw === 'employees') return { reply: '', action: null, dataCommand: 'hr_employees' }
  const searchEmp = raw.match(/^search\s+employee\s+(.+)/)
  if (searchEmp) return { reply: '', action: null, dataCommand: 'hr_search_employee', actionPayload: searchEmp[1].trim() }
  if (/^active\s+projects?/.test(raw) || raw === 'projects') return { reply: '', action: null, dataCommand: 'projects' }
  if (/^overdue\s+(tasks?)?/.test(raw) || raw === 'overdue') return { reply: '', action: null, dataCommand: 'overdue_tasks' }
  if (/^open\s+roles?/.test(raw) || raw === 'jobs' || raw === 'roles') return { reply: '', action: null, dataCommand: 'jobs' }
  if (/^applications?/.test(raw)) return { reply: '', action: null, dataCommand: 'applications' }
  if (/^at\s*risk\s+customers?/.test(raw)) return { reply: '', action: null, dataCommand: 'at_risk_customers' }
  if (/^customers?/.test(raw) && !raw.includes('at risk')) return { reply: '', action: null, dataCommand: 'customers' }

  // list documents
  if (/^list\s+documents?/.test(raw) || raw === 'documents') {
    const list = PLACEHOLDER_DOCS.map((d) => `• ${d.name}`).join('\n')
    return { reply: `Indexed documents:\n\n${list}\n\nSay "summarize [filename]" for a short summary.`, action: null }
  }

  // summarize [document]
  const summarizeMatch = raw.match(/^summarize\s+(.+)/)
  if (summarizeMatch) {
    const name = summarizeMatch[1].trim().toLowerCase()
    const doc = PLACEHOLDER_DOCS.find((d) => d.name.toLowerCase().includes(name) || name.includes(d.name.toLowerCase()))
    if (doc) {
      return { reply: `**${doc.name}**\n\n${doc.summary}`, action: null }
    }
    return { reply: `I don’t have a summary for "${summarizeMatch[1]}". Try "list documents" to see available files.`, action: null }
  }

  // screenshot <url>
  const screenshotMatch = raw.match(/^screenshot\s+(https?:\/\/\S+)/)
  if (screenshotMatch) {
    const url = screenshotMatch[1]
    return {
      reply: `Screenshot task queued for ${url}. Check the Automation tab to run it, and the Activity Feed for status.`,
      action: 'open_url',
      actionPayload: url,
    }
  }

  // extract text from <url>
  const extractMatch = raw.match(/^extract\s+text\s+(?:from\s+)?(https?:\/\/\S+)/)
  if (extractMatch) {
    const url = extractMatch[1]
    return {
      reply: `Text extraction queued for ${url}. Use the Automation tab → Get Text to run it.`,
      action: 'open_url',
      actionPayload: url,
    }
  }

  // open <url>
  const openMatch = raw.match(/^open\s+(https?:\/\/\S+)/)
  if (openMatch) {
    const url = openMatch[1]
    return {
      reply: `Opening ${url} in a new tab.`,
      action: 'open_url',
      actionPayload: url,
    }
  }

  // go to documents / show documents
  if (/^(go\s+to|show|open)\s+documents?/.test(raw)) {
    return { reply: 'Taking you to the Documents tab.', action: 'switch_documents' }
  }

  // go to automation / show automation
  if (/^(go\s+to|show|open)\s+automation/.test(raw)) {
    return { reply: 'Taking you to the Automation tab.', action: 'switch_automation' }
  }

  // time / date
  if (/^(time|date|now)\b/.test(raw)) {
    const now = new Date()
    return {
      reply: `It’s ${now.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}.`,
      action: null,
    }
  }

  // clear / reset chat
  if (/^(clear|reset)\s*chat?/.test(raw) || raw === 'clear' || raw === 'reset') {
    return {
      reply: 'Chat cleared. Say **help** anytime to see commands.',
      action: 'clear_chat' as ChatAction,
    }
  }

  // default: friendly fallback
  return {
    reply: "I don’t understand that yet. Say **help** to see what I can do (no API key needed).",
    action: null,
  }
}

async function fetchDataReply(dataCommand: string, actionPayload?: string): Promise<string> {
  try {
    switch (dataCommand) {
      case 'hr_stats': {
        const stats = await HRApi.getHRStats()
        return (
          `**HR overview**\n\n` +
          `Employees: ${stats.activeEmployees} active / ${stats.totalEmployees} total\n` +
          `Goals: ${stats.onTrackGoals} on track, ${stats.behindGoals} behind, ${stats.completeGoals} complete\n` +
          `Reviews: ${stats.upcomingReviews} upcoming, ${stats.overdueReviews} overdue\n` +
          (stats.avgPerformanceScore > 0 ? `Avg performance: ${stats.avgPerformanceScore}` : '')
        )
      }
      case 'hr_employees': {
        const employees = await HRApi.getAllEmployees()
        if (employees.length === 0) return 'No employees in HR yet.'
        const list = employees.slice(0, 15).map((e) => `• ${e.name} – ${e.department}`).join('\n')
        const more = employees.length > 15 ? `\n… and ${employees.length - 15} more` : ''
        return `**Employees** (${employees.length})\n\n${list}${more}`
      }
      case 'hr_search_employee': {
        if (!actionPayload) return 'Say **search employee [name]** with a name.'
        const employees = await HRApi.getAllEmployees()
        const q = actionPayload.toLowerCase()
        const matches = employees.filter(
          (e) =>
            e.name.toLowerCase().includes(q) ||
            (e.email && e.email.toLowerCase().includes(q)) ||
            (e.department && e.department.toLowerCase().includes(q))
        )
        if (matches.length === 0) return `No employees found for "${actionPayload}".`
        const list = matches.slice(0, 10).map((e) => `• ${e.name} – ${e.department} – ${e.email || ''}`).join('\n')
        const more = matches.length > 10 ? `\n… and ${matches.length - 10} more` : ''
        return `**Found ${matches.length}**\n\n${list}${more}`
      }
      case 'projects': {
        const projects = await ProjectData.getAllProjects()
        const active = projects.filter((p) => (p.status ?? '').toLowerCase() === 'active')
        if (active.length === 0) return 'No active projects.'
        const list = active.slice(0, 10).map((p) => `• ${p.name} – ${p.progress ?? 0}%`).join('\n')
        const more = active.length > 10 ? `\n… and ${active.length - 10} more` : ''
        return `**Active projects** (${active.length})\n\n${list}${more}`
      }
      case 'overdue_tasks': {
        const count = await ProjectData.getOverdueTasks()
        return count === 0 ? 'No overdue tasks.' : `**Overdue tasks:** ${count}`
      }
      case 'jobs': {
        const jobs = await getAllJobs()
        const active = jobs.filter((j) => j.is_active !== false && String(j.is_active) !== 'false')
        if (active.length === 0) return 'No open roles right now.'
        const list = active.slice(0, 10).map((j) => `• ${j.title} – ${j.department || ''}`).join('\n')
        const more = active.length > 10 ? `\n… and ${active.length - 10} more` : ''
        return `**Open roles** (${active.length})\n\n${list}${more}`
      }
      case 'applications': {
        const apps = await getAllApplications()
        if (apps.length === 0) return 'No applications yet.'
        const list = apps.slice(0, 10).map((a) => `• ${a.firstName} ${a.lastName} – ${a.jobTitle || a.jobId} – ${a.status || 'new'}`).join('\n')
        const more = apps.length > 10 ? `\n… and ${apps.length - 10} more` : ''
        return `**Recent applications** (${apps.length})\n\n${list}${more}`
      }
      case 'customers': {
        const clients = await CSApi.getAllClients()
        if (clients.length === 0) return 'No customers in the system yet.'
        const list = clients.slice(0, 10).map((c) => `• ${c.name} – health ${c.health_score ?? 0} – ${c.status ?? 'unknown'}`).join('\n')
        const more = clients.length > 10 ? `\n… and ${clients.length - 10} more` : ''
        return `**Customers** (${clients.length})\n\n${list}${more}`
      }
      case 'at_risk_customers': {
        const clients = await CSApi.getAllClients()
        const atRisk = clients.filter((c) => (c.status ?? '').toLowerCase() === 'at-risk')
        if (atRisk.length === 0) return 'No at-risk customers.'
        const list = atRisk.map((c) => `• ${c.name} – health ${c.health_score ?? 0}`).join('\n')
        return `**At-risk customers** (${atRisk.length})\n\n${list}`
      }
      default:
        return "I couldn't fetch that. Say **help** for commands."
    }
  } catch (err) {
    console.error('fetchDataReply', dataCommand, err)
    return 'Something went wrong loading that data. Please try again.'
  }
}

export default function AutomationPage() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const initialMessages = [
    { role: "bot" as const, content: "Hello! I'm AutomationBot. Say **help** to see what I can do—no API key required." },
    { role: "user" as const, content: "What can you help me with?" },
    {
      role: "bot" as const,
      content:
        "I can run commands like list documents, summarize a file, queue screenshots, open URLs, and jump to Documents or Automation. Type **help** for the full list.",
    },
  ]
  const [messages, setMessages] = useState<Array<{ role: "user" | "bot"; content: string }>>(initialMessages)
  const [inputMessage, setInputMessage] = useState("")
  const [isTyping, setIsTyping] = useState(false)

  const [activities, setActivities] = useState<AutomationActivity[]>(() => loadAutomationActivities())

  const addActivity = (entry: { type: AutomationActivityType; title: string; status?: AutomationActivityStatus }) => {
    const newItem: AutomationActivity = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: entry.type,
      title: entry.title,
      status: entry.status ?? 'info',
      createdAt: new Date().toISOString(),
    }
    setActivities((prev) => {
      const next = [newItem, ...prev].slice(0, 100)
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(AUTOMATION_FEED_STORAGE_KEY, JSON.stringify(next))
        } catch {
          // ignore storage errors
        }
      }
      return next
    })
  }

  const handleSendMessage = (optionalText?: string) => {
    const text = (optionalText ?? inputMessage).trim()
    if (!text) return

    setMessages((prev) => [...prev, { role: "user", content: text }])
    addActivity({
      type: "chat",
      title: text.length > 60 ? `Chat: ${text.slice(0, 57)}…` : `Chat: ${text}`,
      status: "info",
    })
    setInputMessage("")
    setIsTyping(true)

    const { reply, action, actionPayload, dataCommand } = parseChatCommand(text)

    if (dataCommand) {
      fetchDataReply(dataCommand, actionPayload)
        .then((result) => {
          setMessages((prev) => [...prev, { role: "bot", content: result }])
          setIsTyping(false)
          addActivity({ type: "chat", title: "AutomationBot replied", status: "success" })
        })
        .catch(() => {
          setMessages((prev) => [...prev, { role: "bot", content: "Something went wrong loading that data. Please try again." }])
          setIsTyping(false)
        })
      return
    }

    setTimeout(() => {
      setMessages((prev) => {
        const next = [...prev, { role: "bot" as const, content: reply }]
        if (action === "clear_chat") {
          return [
            ...initialMessages,
            { role: "bot" as const, content: "Chat cleared. Say **help** to see commands." },
          ]
        }
        return next
      })
      setIsTyping(false)
      addActivity({ type: "chat", title: "AutomationBot replied", status: "success" })

      if (action === "switch_documents") setActiveTab("documents")
      if (action === "switch_automation") setActiveTab("automation")
      if (action === "open_url" && actionPayload) {
        window.open(actionPayload, "_blank", "noopener,noreferrer")
        if (/screenshot|screenshot\s+task/i.test(text)) addActivity({ type: "task", title: "Screenshot task triggered from chat", status: "success" })
        if (/extract\s+text/i.test(text)) addActivity({ type: "task", title: "Text extraction requested from chat", status: "success" })
      }
    }, 600)
  }

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 px-6 mb-6">
        <div className="py-6">
          <div className="flex items-center justify-between">
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <span className="hover:text-foreground cursor-pointer transition-colors">Home</span>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground">Automation</span>
              </div>
              
              {/* Title with Icon */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">Automation</h1>
              </div>
              
              <p className="text-muted-foreground mt-2">AutomationBot - Intelligent task automation</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
              <Button variant="outline">
                <Play className="mr-2 h-4 w-4" />
                Run Task
              </Button>
              <Button variant="outline">
                <History className="mr-2 h-4 w-4" />
                View History
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div>
        {/* KPI summary – single card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
              <div className="flex items-center gap-4 py-4 md:py-0 md:px-6 first:pt-0 last:pb-0 md:first:pl-0 md:last:pr-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Documents Indexed</p>
                  <p className="text-2xl font-bold">5</p>
                  <p className="text-xs text-muted-foreground">Files ready for querying</p>
                </div>
              </div>
              <div className="flex items-center gap-4 py-4 md:py-0 md:px-6 first:pt-0 last:pb-0 md:first:pl-0 md:last:pr-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tasks Completed</p>
                  <p className="text-2xl font-bold">23</p>
                  <p className="text-xs text-muted-foreground">Automation jobs finished</p>
                </div>
              </div>
              <div className="flex items-center gap-4 py-4 md:py-0 md:px-6 first:pt-0 last:pb-0 md:first:pl-0 md:last:pr-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Chat Messages</p>
                  <p className="text-2xl font-bold">156</p>
                  <p className="text-xs text-muted-foreground">Conversation history</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Layout: sidebar + main content in one box */}
        <div className="grid grid-cols-12 gap-6">
          <Card className="col-span-12 lg:col-span-9 flex flex-col min-h-0">
            <div className="flex flex-col lg:flex-row flex-1 min-h-0">
              {/* Sidebar nav inside the same box */}
              <aside className="lg:w-[200px] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-border">
                <nav className="p-3 space-y-1" aria-label="Automation sections">
                  <Button
                    variant={activeTab === "dashboard" ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start gap-2 h-9 text-sm font-normal"
                    onClick={() => setActiveTab("dashboard")}
                  >
                    <BarChart3 className="h-4 w-4 shrink-0" />
                    <span className="truncate">Dashboard</span>
                  </Button>
                  <Button
                    variant={activeTab === "chat" ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start gap-2 h-9 text-sm font-normal"
                    onClick={() => setActiveTab("chat")}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="truncate">Chat</span>
                  </Button>
                  <Button
                    variant={activeTab === "documents" ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start gap-2 h-9 text-sm font-normal"
                    onClick={() => setActiveTab("documents")}
                  >
                    <FolderOpen className="h-4 w-4 shrink-0" />
                    <span className="truncate">Documents</span>
                  </Button>
                  <Button
                    variant={activeTab === "automation" ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start gap-2 h-9 text-sm font-normal"
                    onClick={() => setActiveTab("automation")}
                  >
                    <Zap className="h-4 w-4 shrink-0" />
                    <span className="truncate">Automation</span>
                  </Button>
                  <Button
                    variant={activeTab === "analytics" ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start gap-2 h-9 text-sm font-normal"
                    onClick={() => setActiveTab("analytics")}
                  >
                    <BarChart3 className="h-4 w-4 shrink-0" />
                    <span className="truncate">Analytics</span>
                  </Button>
                  <Button
                    variant={activeTab === "settings" ? "secondary" : "ghost"}
                    size="sm"
                    className="w-full justify-start gap-2 h-9 text-sm font-normal"
                    onClick={() => setActiveTab("settings")}
                  >
                    <Settings className="h-4 w-4 shrink-0" />
                    <span className="truncate">Settings</span>
                  </Button>
                </nav>
              </aside>
              {/* Main content area */}
              <div className="flex-1 min-w-0 p-4 lg:p-6">
            {activeTab === "chat" && (
              <Card className="h-[600px] flex flex-col">
                <CardHeader>
                  <CardTitle>AI Chat Interface</CardTitle>
                  <CardDescription>Command-based chat: try help, list documents, summarize &lt;file&gt;, screenshot &lt;url&gt;, open &lt;url&gt;, go to documents. No API key.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <ScrollArea className="flex-1 pr-4 mb-4 min-h-0">
                    <div className="space-y-4 pb-2">
                      {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`flex gap-2 max-w-[85%] min-w-0 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                            <div
                              className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${msg.role === "user" ? "bg-primary" : "bg-muted"}`}
                            >
                              {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                            </div>
                            <div
                              className={`rounded-lg p-3 text-sm whitespace-pre-wrap break-words min-w-0 overflow-hidden ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                            >
                              {msg.role === "bot"
                                ? msg.content.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                                    part.startsWith("**") && part.endsWith("**") ? (
                                      <strong key={i}>{part.slice(2, -2)}</strong>
                                    ) : (
                                      <span key={i}>{part}</span>
                                    )
                                  )
                                : msg.content}
                            </div>
                          </div>
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="flex gap-2 max-w-[85%] min-w-0">
                            <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center bg-muted">
                              <Bot className="h-4 w-4" />
                            </div>
                            <div className="rounded-lg p-3 bg-muted flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-sm">Typing...</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ask a question or give a command..."
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    />
                    <Button onClick={() => handleSendMessage()}>Send</Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 mb-1">Quick actions (no API key):</p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleSendMessage("screenshot https://www.google.com")}
                    >
                      Screenshot google.com
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleSendMessage("summarize Contract_2024.pdf")}
                    >
                      Summarize document
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleSendMessage("extract text from https://example.com")}
                    >
                      Extract text from page
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleSendMessage("list documents")}
                    >
                      List documents
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-muted"
                      onClick={() => handleSendMessage("help")}
                    >
                      Help
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "documents" && (
              <Card>
                <CardHeader>
                  <CardTitle>Document Manager</CardTitle>
                  <CardDescription>Upload and manage documents for AI processing</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed rounded-lg p-12 text-center mb-6">
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Drag & Drop Files</h3>
                    <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                    <Button
                      onClick={() =>
                        addActivity({
                          type: "document",
                          title: "Selected files for upload",
                          status: "success",
                        })
                      }
                    >
                      Select Files
                    </Button>
                    <p className="text-xs text-muted-foreground mt-4">Supported: PDF, TXT, CSV, DOCX, XLSX</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold mb-3">Indexed Documents</h4>
                    {[
                      { name: "Contract_2024.pdf", size: "2.4 MB", status: "Indexed" },
                      { name: "Report_Q1.docx", size: "1.1 MB", status: "Indexed" },
                      { name: "Data_Analysis.xlsx", size: "856 KB", status: "Processing" },
                    ].map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">{doc.size}</p>
                          </div>
                        </div>
                        <Badge variant={doc.status === "Indexed" ? "default" : "secondary"}>{doc.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "automation" && (
              <Card>
                <CardHeader>
                  <CardTitle>Browser Automation</CardTitle>
                  <CardDescription>Execute automated web tasks</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="screenshot">
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="screenshot">Screenshot</TabsTrigger>
                      <TabsTrigger value="text">Get Text</TabsTrigger>
                      <TabsTrigger value="form">Fill Form</TabsTrigger>
                      <TabsTrigger value="click">Click</TabsTrigger>
                      <TabsTrigger value="download">Download</TabsTrigger>
                    </TabsList>
                    <TabsContent value="screenshot" className="space-y-4">
                      <div>
                        <Label htmlFor="url">URL</Label>
                        <Input id="url" placeholder="https://example.com" />
                      </div>
                      <div>
                        <Label htmlFor="selector">Element Selector (optional)</Label>
                        <Input id="selector" placeholder=".main-content" />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() =>
                          addActivity({
                            type: "task",
                            title: "Screenshot task triggered",
                            status: "success",
                          })
                        }
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        Take Screenshot
                      </Button>
                    </TabsContent>
                    <TabsContent value="text" className="space-y-4">
                      <div>
                        <Label htmlFor="url-text">URL</Label>
                        <Input id="url-text" placeholder="https://example.com" />
                      </div>
                      <div>
                        <Label htmlFor="selector-text">Element Selector</Label>
                        <Input id="selector-text" placeholder=".article-content" />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() =>
                          addActivity({
                            type: "task",
                            title: "Text extraction requested",
                            status: "success",
                          })
                        }
                      >
                        <FileInput className="mr-2 h-4 w-4" />
                        Extract Text
                      </Button>
                    </TabsContent>
                    <TabsContent value="form" className="space-y-4">
                      <div>
                        <Label htmlFor="url-form">URL</Label>
                        <Input id="url-form" placeholder="https://example.com/form" />
                      </div>
                      <div>
                        <Label htmlFor="form-data">Form Data (JSON)</Label>
                        <Input id="form-data" placeholder='{"name": "John", "email": "john@example.com"}' />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() =>
                          addActivity({
                            type: "task",
                            title: "Form submission automation triggered",
                            status: "success",
                          })
                        }
                      >
                        <MousePointer className="mr-2 h-4 w-4" />
                        Fill & Submit Form
                      </Button>
                    </TabsContent>
                    <TabsContent value="click" className="space-y-4">
                      <div>
                        <Label htmlFor="url-click">URL</Label>
                        <Input id="url-click" placeholder="https://example.com" />
                      </div>
                      <div>
                        <Label htmlFor="click-sequence">Click Sequence (selectors)</Label>
                        <Input id="click-sequence" placeholder=".button1, .button2, .submit" />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() =>
                          addActivity({
                            type: "task",
                            title: "Click sequence automation triggered",
                            status: "success",
                          })
                        }
                      >
                        <MousePointer className="mr-2 h-4 w-4" />
                        Execute Clicks
                      </Button>
                    </TabsContent>
                    <TabsContent value="download" className="space-y-4">
                      <div>
                        <Label htmlFor="url-download">File URL</Label>
                        <Input id="url-download" placeholder="https://example.com/file.pdf" />
                      </div>
                      <div>
                        <Label htmlFor="save-path">Save Path</Label>
                        <Input id="save-path" placeholder="/downloads/file.pdf" />
                      </div>
                      <Button
                        className="w-full"
                        onClick={() =>
                          addActivity({
                            type: "task",
                            title: "Download task triggered",
                            status: "success",
                          })
                        }
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download File
                      </Button>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}

            {activeTab === "dashboard" && (
              <Card>
                <CardHeader>
                  <CardTitle>Dashboard Overview</CardTitle>
                  <CardDescription>Quick access to all features</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col gap-2 bg-transparent"
                      onClick={() => setActiveTab("chat")}
                    >
                      <MessageSquare className="h-6 w-6" />
                      <span>Start Chat</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col gap-2 bg-transparent"
                      onClick={() => setActiveTab("documents")}
                    >
                      <Upload className="h-6 w-6" />
                      <span>Upload Document</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col gap-2 bg-transparent"
                      onClick={() => setActiveTab("automation")}
                    >
                      <Zap className="h-6 w-6" />
                      <span>Run Automation</span>
                    </Button>
                    <Button
                      variant="outline"
                      className="h-24 flex flex-col gap-2 bg-transparent"
                      onClick={() => setActiveTab("analytics")}
                    >
                      <BarChart3 className="h-6 w-6" />
                      <span>View Analytics</span>
                    </Button>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3">Recent Activity</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-2 border rounded">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Screenshot task completed</span>
                        <span className="text-xs text-muted-foreground ml-auto">2 min ago</span>
                      </div>
                      <div className="flex items-center gap-3 p-2 border rounded">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">Document indexed: Report_Q1.docx</span>
                        <span className="text-xs text-muted-foreground ml-auto">15 min ago</span>
                      </div>
                      <div className="flex items-center gap-3 p-2 border rounded">
                        <MessageSquare className="h-4 w-4 text-purple-500" />
                        <span className="text-sm">Chat conversation started</span>
                        <span className="text-xs text-muted-foreground ml-auto">1 hour ago</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "analytics" && (
              <Card>
                <CardHeader>
                  <CardTitle>Analytics & Insights</CardTitle>
                  <CardDescription>Usage statistics from your automation activity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {activities.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <BarChart3 className="mx-auto h-12 w-12 opacity-50 mb-3" />
                      <p className="font-medium">No analytics data yet</p>
                      <p className="text-sm mt-1">
                        Use Chat, Documents, and Automation to generate activity. Metrics will appear here.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border rounded-lg p-4">
                          <p className="text-sm text-muted-foreground mb-1">Task Success Rate</p>
                          <p className="text-2xl font-bold">
                            {(() => {
                              const tasks = activities.filter((a) => a.type === "task")
                              const success = tasks.filter((a) => a.status === "success").length
                              return tasks.length ? `${Math.round((success / tasks.length) * 100)}%` : "—"
                            })()}
                          </p>
                        </div>
                        <div className="border rounded-lg p-4">
                          <p className="text-sm text-muted-foreground mb-1">Documents</p>
                          <p className="text-2xl font-bold">
                            {activities.filter((a) => a.type === "document").length}
                          </p>
                        </div>
                        <div className="border rounded-lg p-4">
                          <p className="text-sm text-muted-foreground mb-1">Chat activity</p>
                          <p className="text-2xl font-bold">
                            {activities.filter((a) => a.type === "chat").length}
                          </p>
                        </div>
                        <div className="border rounded-lg p-4">
                          <p className="text-sm text-muted-foreground mb-1">Total actions</p>
                          <p className="text-2xl font-bold">{activities.length}</p>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <h4 className="font-semibold mb-3">Task breakdown</h4>
                        <div className="space-y-2">
                          {[
                            { label: "Screenshot", key: "screenshot" },
                            { label: "Text extraction", key: "text" },
                            { label: "Form submission", key: "form" },
                            { label: "Click sequence", key: "click" },
                            { label: "Download", key: "download" },
                          ].map(({ label, key }) => {
                            const count = activities.filter(
                              (a) => a.type === "task" && a.title.toLowerCase().includes(key)
                            ).length
                            if (count === 0) return null
                            return (
                              <div key={key} className="flex items-center justify-between">
                                <span className="text-sm">{label}</span>
                                <Badge variant="secondary">{count}</Badge>
                              </div>
                            )
                          })}
                          {activities.filter((a) => a.type === "task").length === 0 && (
                            <p className="text-sm text-muted-foreground">No automation tasks run yet.</p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === "settings" && (
              <Card>
                <CardHeader>
                  <CardTitle>Settings</CardTitle>
                  <CardDescription>Configure AI and automation settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold mb-3">AI Configuration</h4>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="provider">LLM Provider</Label>
                        <Input id="provider" placeholder="OpenAI" />
                      </div>
                      <div>
                        <Label htmlFor="model">Model</Label>
                        <Input id="model" placeholder="gpt-4" />
                      </div>
                      <div>
                        <Label htmlFor="temperature">Temperature</Label>
                        <Input id="temperature" type="number" placeholder="0.7" step="0.1" />
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3">Browser Settings</h4>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="viewport">Viewport Size</Label>
                        <Input id="viewport" placeholder="1920x1080" />
                      </div>
                      <div>
                        <Label htmlFor="timeout">Default Timeout (ms)</Label>
                        <Input id="timeout" type="number" placeholder="30000" />
                      </div>
                    </div>
                  </div>
                  <Button className="w-full">Save Settings</Button>
                </CardContent>
              </Card>
            )}
              </div>
            </div>
          </Card>

          {/* Right Panel */}
          <Card className="col-span-12 lg:col-span-3">
            <CardHeader>
              <CardTitle>Activity Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3">
                  {activities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No recent automation activity yet. Actions from Chat, Documents, and Automation will appear here.
                    </p>
                  ) : (
                    activities.map((activity) => (
                      <div key={activity.id} className="flex gap-3 p-2 border rounded-lg">
                        <div className="mt-1">
                          {activity.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                          {activity.status === "info" && <AlertCircle className="h-4 w-4 text-blue-500" />}
                          {activity.status === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.title}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatRelativeTime(activity.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

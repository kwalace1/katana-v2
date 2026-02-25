"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, ChevronLeft, ChevronRight, ArrowLeft, Loader2, ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react"
import { getPurchaseOrders, type PurchaseOrder } from "@/lib/inventory-api"
import { isSupabaseConfigured } from "@/lib/supabase"
import { Link } from "react-router-dom"
import { NewPurchaseOrderDialog } from "@/components/inventory/new-purchase-order-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function PurchaseOrdersList() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [newPODialogOpen, setNewPODialogOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [sortBy, setSortBy] = useState<"status" | "po_number" | "created_date">("created_date")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  useEffect(() => {
    fetchPurchaseOrders()
  }, [])

  const fetchPurchaseOrders = async () => {
    setLoading(true)
    try {
      const data = await getPurchaseOrders()
      setPurchaseOrders(data)
    } catch (error) {
      console.error('Error fetching purchase orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPOs = purchaseOrders.filter((po) => {
    const matchesSearch =
      po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplier_name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || po.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const statusOrder: Record<string, number> = {
    draft: 0,
    open: 1,
    pending: 2,
    received: 3,
    cancelled: 4,
  }
  const sortedPOs = [...filteredPOs].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1
    if (sortBy === "status") {
      return mul * ((statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5))
    }
    if (sortBy === "po_number") {
      return mul * a.po_number.localeCompare(b.po_number)
    }
    if (sortBy === "created_date") {
      return mul * (new Date(a.created_date).getTime() - new Date(b.created_date).getTime())
    }
    return 0
  })

  const totalPages = Math.ceil(sortedPOs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedPOs = sortedPOs.slice(startIndex, startIndex + itemsPerPage)

  const handleSort = (field: "status" | "po_number" | "created_date") => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setSortBy(field)
      setSortDir("asc")
    }
    setCurrentPage(1)
  }

  const SortHeader = ({
    field,
    children,
  }: {
    field: "status" | "po_number" | "created_date"
    children: React.ReactNode
  }) => (
    <th className="text-left p-4 font-medium">
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        {sortBy === field ? (
          sortDir === "asc" ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </button>
    </th>
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-500/10 text-gray-600 border-gray-500/20"
      case "open":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20"
      case "pending":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
      case "received":
        return "bg-green-500/10 text-green-600 border-green-500/20"
      case "cancelled":
        return "bg-red-500/10 text-red-600 border-red-500/20"
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20"
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Supabase Not Configured</h2>
            <p className="text-muted-foreground">
              Please configure Supabase to use this feature.
            </p>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/inventory">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Purchase Orders</h1>
              <p className="text-muted-foreground">Manage and track purchase orders</p>
            </div>
          </div>
          <Button onClick={() => setNewPODialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Purchase Order
          </Button>
        </div>

        <NewPurchaseOrderDialog
          open={newPODialogOpen}
          onOpenChange={setNewPODialogOpen}
          onSuccess={(createdId) => {
            fetchPurchaseOrders()
            navigate(`/inventory/purchase-orders/${createdId}`)
          }}
        />

        {/* PO List */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-xl font-semibold">All Purchase Orders</h2>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search PO number, supplier..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-80"
                  />
                </div>
              </div>
            </div>

            {/* PO Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium">PO Number</th>
                    <th className="text-left p-4 font-medium">Supplier</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Total</th>
                    <th className="text-left p-4 font-medium">Created Date</th>
                    <th className="text-left p-4 font-medium">Expected Date</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        <p className="text-muted-foreground">Loading purchase orders...</p>
                      </td>
                    </tr>
                  ) : paginatedPOs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        {searchQuery || statusFilter !== "all"
                          ? "No purchase orders match your search or filter."
                          : "No purchase orders yet."}
                      </td>
                    </tr>
                  ) : (
                    paginatedPOs.map((po) => (
                      <tr key={po.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-4 font-mono text-sm">{po.po_number}</td>
                        <td className="p-4">{po.supplier_name}</td>
                        <td className="p-4">
                          <Badge className={getStatusColor(po.status)}>
                            {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                          </Badge>
                        </td>
                        <td className="p-4 font-semibold">${po.total.toFixed(2)}</td>
                        <td className="p-4 text-sm">{new Date(po.created_date).toLocaleDateString()}</td>
                        <td className="p-4 text-sm">{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : "-"}</td>
                        <td className="p-4">
                          <Link to={`/inventory/purchase-orders/${po.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && sortedPOs.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedPOs.length)} of{" "}
                  {sortedPOs.length} purchase orders
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm">
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Box,
  Plus,
  FileText,
  ArrowDown,
  ArrowUp,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  AlertTriangle,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { 
  getInventoryItems, 
  createInventoryItem, 
  getInventoryStats,
  getOpenPOCount,
  deleteInventoryItem,
  type InventoryItem 
} from '@/lib/inventory-api'
import { isSupabaseConfigured } from '@/lib/supabase'
import { NewPurchaseOrderDialog } from '@/components/inventory/new-purchase-order-dialog'

export default function InventoryPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  const [isNewItemOpen, setIsNewItemOpen] = useState(false)
  const [newPODialogOpen, setNewPODialogOpen] = useState(false)
  const [newItemSku, setNewItemSku] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [newItemLocation, setNewItemLocation] = useState('')
  const [newItemQty, setNewItemQty] = useState('')
  const [newItemMinQty, setNewItemMinQty] = useState('')
  const [newItemReorderQty, setNewItemReorderQty] = useState('')
  const [newItemUnitCost, setNewItemUnitCost] = useState('')
  const [newItemSupplier, setNewItemSupplier] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('')
  const [newItemBarcode, setNewItemBarcode] = useState('')
  
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ totalItems: 0, lowStockItems: 0, outOfStockItems: 0, totalValue: 0 })
  const [openPOCount, setOpenPOCount] = useState(0)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  // Fetch data on mount
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [itemsData, statsData, poCount] = await Promise.all([
        getInventoryItems(),
        getInventoryStats(),
        getOpenPOCount()
      ])
      setItems(itemsData)
      setStats(statsData)
      setOpenPOCount(poCount)
    } catch (error) {
      console.error('Error fetching inventory data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddItem = async () => {
    if (!newItemSku || !newItemName || !newItemLocation || !newItemQty || !newItemMinQty || !newItemUnitCost) {
      alert("Please fill in all required fields")
      return
    }

    setSaving(true)
    try {
      const qty = parseInt(newItemQty)
      const minQty = parseInt(newItemMinQty)
      const unitCost = parseFloat(newItemUnitCost)
      
      const status: 'in-stock' | 'low-stock' | 'out-of-stock' = 
        qty <= 0 ? 'out-of-stock' : qty <= minQty ? 'low-stock' : 'in-stock'

      const newItem = await createInventoryItem({
        sku: newItemSku,
        product_name: newItemName,
        location: newItemLocation,
        on_hand_qty: qty,
        min_qty: minQty,
        reorder_qty: parseInt(newItemReorderQty) || minQty * 2,
        unit_cost: unitCost,
        allocated: 0,
        supplier_id: null,
        supplier_name: newItemSupplier || null,
        status,
        barcode: newItemBarcode || null,
        image_url: null,
        category: newItemCategory || null,
        description: null,
        last_movement_at: null,
        is_active: true,
      })

      if (newItem) {
        setItems([...items, newItem])
        // Reset form
        resetForm()
        setIsNewItemOpen(false)
        // Refresh stats
        const newStats = await getInventoryStats()
        setStats(newStats)
      }
    } catch (error) {
      console.error('Error creating item:', error)
      alert('Failed to create item')
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setNewItemSku('')
    setNewItemName('')
    setNewItemLocation('')
    setNewItemQty('')
    setNewItemMinQty('')
    setNewItemReorderQty('')
    setNewItemUnitCost('')
    setNewItemSupplier('')
    setNewItemCategory('')
    setNewItemBarcode('')
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(paginatedItems.map(item => item.id))
      setSelectedItems(allIds)
    } else {
      setSelectedItems(new Set())
    }
  }

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems)
    if (checked) {
      newSelected.add(itemId)
    } else {
      newSelected.delete(itemId)
    }
    setSelectedItems(newSelected)
  }

  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return

    setDeleting(true)
    try {
      // Delete all selected items
      const deletePromises = Array.from(selectedItems).map(id => deleteInventoryItem(id))
      const results = await Promise.all(deletePromises)
      
      const successCount = results.filter(Boolean).length
      
      if (successCount > 0) {
        // Refresh the data
        await fetchData()
        setSelectedItems(new Set())
        setIsDeleteDialogOpen(false)
        alert(`Successfully deleted ${successCount} item(s)`)
      } else {
        alert('Failed to delete items')
      }
    } catch (error) {
      console.error('Error deleting items:', error)
      alert('Failed to delete items')
    } finally {
      setDeleting(false)
    }
  }

  const filteredItems = items.filter(
    (item) =>
      item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.location?.toLowerCase().includes(searchQuery.toLowerCase()) || false)
  )

  type SortField = 'sku' | 'product_name' | 'location' | 'on_hand_qty' | 'min_qty' | 'status'
  const [sortBy, setSortBy] = useState<SortField>('product_name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sortedItems = [...filteredItems].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    switch (sortBy) {
      case 'sku':
        return mul * (a.sku.localeCompare(b.sku))
      case 'product_name':
        return mul * (a.product_name.localeCompare(b.product_name))
      case 'location':
        return mul * ((a.location ?? '').localeCompare(b.location ?? ''))
      case 'on_hand_qty':
        return mul * (a.on_hand_qty - b.on_hand_qty)
      case 'min_qty':
        return mul * (a.min_qty - b.min_qty)
      case 'status': {
        const order = { 'out-of-stock': 0, 'low-stock': 1, 'in-stock': 2 }
        return mul * ((order[a.status as keyof typeof order] ?? 0) - (order[b.status as keyof typeof order] ?? 0))
      }
      default:
        return 0
    }
  })

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedItems = sortedItems.slice(startIndex, startIndex + itemsPerPage)

  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(field)
      setSortDir('asc')
    }
    setCurrentPage(1)
  }

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th className="text-left p-4 font-medium">
      <button
        type="button"
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        {sortBy === field ? (
          sortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </button>
    </th>
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in-stock':
        return 'bg-green-500/10 text-green-600 border-green-500/20'
      case 'low-stock':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
      case 'out-of-stock':
        return 'bg-red-500/10 text-red-600 border-red-500/20'
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20'
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="p-8 text-center">
            <Box className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Supabase Not Configured</h2>
            <p className="text-muted-foreground mb-4">
              Please configure your Supabase environment variables to use Katana Inventory.
            </p>
            <p className="text-sm text-muted-foreground">
              Set <code className="bg-muted px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
              <code className="bg-muted px-1 rounded">VITE_SUPABASE_ANON_KEY</code> in your .env file.
            </p>
          </Card>
        </div>
      </div>
    )
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
                <span className="text-foreground">Katana Inventory</span>
              </div>
              
              {/* Title with Icon */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg">
                  <Box className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">Katana Inventory</h1>
              </div>
              
              <p className="text-muted-foreground mt-2">Real-time stock management and tracking</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsNewItemOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div>
        <div className="space-y-6">

        {/* KPI Stats – one rectangular bar */}
        <Card className="overflow-hidden border-border bg-card/50">
          <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border">
            <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Box className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold tabular-nums">{loading ? '–' : stats.totalItems}</p>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <AlertTriangle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold tabular-nums text-yellow-600">{loading ? '–' : stats.lowStockItems}</p>
              </div>
            </div>
            <Link to="/inventory/purchase-orders" className="flex-1 flex items-center gap-4 px-6 py-5 min-w-0 hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">Open POs</p>
                <p className="text-2xl font-bold tabular-nums text-blue-600">{loading ? '–' : openPOCount}</p>
              </div>
            </Link>
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Link to="/inventory/purchase-orders">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold">Open POs</p>
                  <p className="text-sm text-muted-foreground">View purchase orders</p>
                </div>
              </div>
            </Card>
          </Link>
          <Card
            className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!isSupabaseConfigured) navigate('/inventory/purchase-orders')
              else setNewPODialogOpen(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (!isSupabaseConfigured) navigate('/inventory/purchase-orders')
                else setNewPODialogOpen(true)
              }
            }}
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold">New PO</p>
                <p className="text-sm text-muted-foreground">Add purchase order</p>
              </div>
            </div>
          </Card>
          <NewPurchaseOrderDialog
            open={newPODialogOpen}
            onOpenChange={setNewPODialogOpen}
            onSuccess={(createdId) => navigate(`/inventory/purchase-orders/${createdId}`)}
          />
          <Link to="/inventory/scan-in">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <ArrowDown className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold">Scan-In</p>
                  <p className="text-sm text-muted-foreground">Receive stock</p>
                </div>
              </div>
            </Card>
          </Link>
          <Link to="/inventory/check-out">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center">
                  <ArrowUp className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="font-semibold">Check-Out</p>
                  <p className="text-sm text-muted-foreground">Issue stock</p>
                </div>
              </div>
            </Card>
          </Link>
        </div>

        {/* Items Management Section */}
        <Card className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Items</h2>
              <div className="flex items-center gap-2">
                {selectedItems.size > 0 && (
                  <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete ({selectedItems.size})
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Items</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete {selectedItems.size} item(s)? This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex gap-2 pt-4">
                        <Button 
                          variant="destructive" 
                          className="flex-1" 
                          onClick={handleDeleteSelected}
                          disabled={deleting}
                        >
                          {deleting ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            'Delete'
                          )}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setIsDeleteDialogOpen(false)}
                          disabled={deleting}
                        >
                          Cancel
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items, SKU, barcode, location..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-80"
                  />
                </div>
                <Dialog open={isNewItemOpen} onOpenChange={setIsNewItemOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Item
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </div>
            </div>

            {/* Items Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 font-medium w-12">
                      <Checkbox
                        checked={paginatedItems.length > 0 && paginatedItems.every(item => selectedItems.has(item.id))}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all items"
                      />
                    </th>
                    <SortHeader field="sku">SKU</SortHeader>
                    <SortHeader field="product_name">Product Name</SortHeader>
                    <SortHeader field="location">Location</SortHeader>
                    <SortHeader field="on_hand_qty">On Hand Qty</SortHeader>
                    <SortHeader field="min_qty">Min Qty</SortHeader>
                    <SortHeader field="status">Status</SortHeader>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        <p className="text-muted-foreground">Loading inventory...</p>
                      </td>
                    </tr>
                  ) : paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        {searchQuery ? 'No items match your search' : 'No inventory items yet. Add your first item!'}
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => (
                      <tr key={item.id} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-4">
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                            aria-label={`Select ${item.product_name}`}
                          />
                        </td>
                        <td className="p-4 font-mono text-sm">{item.sku}</td>
                        <td className="p-4">{item.product_name}</td>
                        <td className="p-4 font-mono text-sm">{item.location || '-'}</td>
                        <td className="p-4 font-semibold">{item.on_hand_qty}</td>
                        <td className="p-4 text-muted-foreground">{item.min_qty}</td>
                        <td className="p-4">
                          <Badge className={getStatusColor(item.status)}>
                            {item.status === 'in-stock' && 'In Stock'}
                            {item.status === 'low-stock' && 'Low Stock'}
                            {item.status === 'out-of-stock' && 'Out of Stock'}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Link to={`/inventory/items/${item.id}`}>
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
            {!loading && filteredItems.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, sortedItems.length)} of{' '}
                  {sortedItems.length} items
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

        {/* New Item Dialog */}
        <Dialog open={isNewItemOpen} onOpenChange={setIsNewItemOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Item</DialogTitle>
              <DialogDescription>Create a new SKU in Katana Inventory</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="item-sku">SKU *</Label>
                  <Input 
                    id="item-sku"
                    placeholder="Enter SKU code"
                    value={newItemSku}
                    onChange={(e) => setNewItemSku(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="item-name">Product Name *</Label>
                  <Input 
                    id="item-name"
                    placeholder="Enter product name"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="item-location">Location *</Label>
                  <Input 
                    id="item-location"
                    placeholder="e.g., A1-B2-C3"
                    value={newItemLocation}
                    onChange={(e) => setNewItemLocation(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="item-category">Category</Label>
                  <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                    <SelectTrigger id="item-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Electronics">Electronics</SelectItem>
                      <SelectItem value="Tools">Tools</SelectItem>
                      <SelectItem value="Components">Components</SelectItem>
                      <SelectItem value="Raw Materials">Raw Materials</SelectItem>
                      <SelectItem value="Finished Goods">Finished Goods</SelectItem>
                      <SelectItem value="General">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="item-qty">Initial Quantity *</Label>
                  <Input 
                    id="item-qty"
                    type="number"
                    placeholder="0"
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="item-min-qty">Min Quantity *</Label>
                  <Input 
                    id="item-min-qty"
                    type="number"
                    placeholder="0"
                    value={newItemMinQty}
                    onChange={(e) => setNewItemMinQty(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="item-reorder-qty">Reorder Quantity</Label>
                  <Input 
                    id="item-reorder-qty"
                    type="number"
                    placeholder="Auto-calculated"
                    value={newItemReorderQty}
                    onChange={(e) => setNewItemReorderQty(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="item-unit-cost">Unit Cost *</Label>
                  <Input 
                    id="item-unit-cost"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newItemUnitCost}
                    onChange={(e) => setNewItemUnitCost(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="item-supplier">Supplier</Label>
                  <Input 
                    id="item-supplier"
                    placeholder="Enter supplier name"
                    value={newItemSupplier}
                    onChange={(e) => setNewItemSupplier(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="item-barcode">Barcode</Label>
                <Input 
                  id="item-barcode"
                  placeholder="Enter barcode (optional)"
                  value={newItemBarcode}
                  onChange={(e) => setNewItemBarcode(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1" onClick={handleAddItem} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Item'
                  )}
                </Button>
                <Button variant="outline" onClick={() => {
                  setIsNewItemOpen(false)
                  resetForm()
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  )
}

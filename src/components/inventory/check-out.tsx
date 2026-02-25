"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Scan, Check, AlertTriangle, Loader2 } from "lucide-react"
import { getInventoryItemBySku, performCheckOut, type InventoryItem } from "@/lib/inventory-api"
import { isSupabaseConfigured } from "@/lib/supabase"
import { Link } from "react-router-dom"

interface RecentCheckout {
  item: InventoryItem
  quantity: number
  timestamp: Date
}

export function CheckOut() {
  const [skuInput, setSkuInput] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null)
  const [recentCheckouts, setRecentCheckouts] = useState<RecentCheckout[]>([])
  const [scanning, setScanning] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleScan = async () => {
    if (!skuInput.trim()) return
    
    setScanning(true)
    setError(null)
    
    try {
      const item = await getInventoryItemBySku(skuInput.trim())
      if (item) {
        setScannedItem(item)
      } else {
        setError('Item not found. Please check the SKU or barcode.')
        setScannedItem(null)
      }
    } catch (err) {
      console.error('Error scanning item:', err)
      setError('Failed to look up item')
      setScannedItem(null)
    } finally {
      setScanning(false)
    }
  }

  const handleConfirm = async () => {
    if (!scannedItem || !quantity) return
    
    const qty = parseInt(quantity)
    const available = scannedItem.on_hand_qty - scannedItem.allocated
    
    if (qty > available) {
      setError(`Cannot check out more than available quantity (${available})`)
      return
    }
    
    setConfirming(true)
    setError(null)
    
    try {
      const result = await performCheckOut(
        scannedItem.id,
        qty,
        reference || undefined,
        'Current User', // In production, get from auth context
        notes || undefined
      )
      
      if (result.success && result.item) {
        setRecentCheckouts([
          { item: result.item, quantity: qty, timestamp: new Date() },
          ...recentCheckouts.slice(0, 4),
        ])
        setScannedItem(null)
        setSkuInput("")
        setQuantity("1")
        setReference("")
        setNotes("")
      } else {
        setError(result.error || 'Failed to check out item')
      }
    } catch (err) {
      console.error('Error confirming check-out:', err)
      setError('Failed to complete check-out')
    } finally {
      setConfirming(false)
    }
  }

  const isLowStock = scannedItem && (scannedItem.on_hand_qty - parseInt(quantity || "0")) < scannedItem.min_qty
  const available = scannedItem ? scannedItem.on_hand_qty - scannedItem.allocated : 0

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto">
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
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/inventory">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Check-Out</h1>
            <p className="text-muted-foreground">Issue stock · Katana Inventory</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Checkout Interface */}
          <Card className="p-6">
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Scan className="w-5 h-5 text-orange-600" />
                </div>
                <h2 className="text-xl font-semibold">Scan Item</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>SKU / Barcode</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter or scan SKU/barcode..."
                      value={skuInput}
                      onChange={(e) => setSkuInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleScan()}
                      disabled={scanning}
                    />
                    <Button onClick={handleScan} disabled={scanning || !skuInput.trim()}>
                      {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scan className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 border border-red-500/20 rounded-lg bg-red-500/10 text-red-600 text-sm">
                    {error}
                  </div>
                )}

                {scannedItem && (
                  <>
                    <div className="p-4 border rounded-lg bg-muted/30">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{scannedItem.product_name}</h3>
                          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">Found</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">SKU</p>
                            <p className="font-mono">{scannedItem.sku}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Location</p>
                            <p className="font-mono">{scannedItem.location || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Available</p>
                            <p className="font-semibold">{available}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Min Qty</p>
                            <p className="font-semibold">{scannedItem.min_qty}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isLowStock && (
                      <div className="p-3 border border-yellow-500/20 rounded-lg bg-yellow-500/10 flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-semibold text-yellow-600">Low Stock Warning</p>
                          <p className="text-yellow-600/80">This checkout will bring stock below minimum quantity</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        max={available}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="Enter quantity..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Reference (Optional)</Label>
                      <Input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="Work order, sales order..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Notes (Optional)</Label>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Additional notes..."
                        rows={3}
                      />
                    </div>

                    <Button onClick={handleConfirm} className="w-full" size="lg" disabled={confirming}>
                      {confirming ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Confirm Check-Out
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Recent Checkouts */}
          <Card className="p-6">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Recent Check-Outs</h2>
              {recentCheckouts.length > 0 ? (
                <div className="space-y-3">
                  {recentCheckouts.map((checkout, index) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold">{checkout.item.product_name}</p>
                          <p className="text-sm text-muted-foreground font-mono">{checkout.item.sku}</p>
                          <div className="flex items-center gap-2 text-sm">
                            <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                              -{checkout.quantity}
                            </Badge>
                            <span className="text-muted-foreground">{checkout.timestamp.toLocaleTimeString()}</span>
                          </div>
                        </div>
                        <Check className="w-5 h-5 text-orange-600" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Scan className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No recent check-outs</p>
                  <p className="text-sm">Start checking out items to see them here</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createPurchaseOrder, generatePONumber } from "@/lib/inventory-api"
import { isSupabaseConfigured } from "@/lib/supabase"
import { toast } from "sonner"

export interface NewPurchaseOrderFormData {
  supplier_name: string
  expected_date: string
  notes: string
}

interface NewPurchaseOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (createdId: string) => void
}

const defaultForm: NewPurchaseOrderFormData = {
  supplier_name: "",
  expected_date: "",
  notes: "",
}

export function NewPurchaseOrderDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewPurchaseOrderDialogProps) {
  const [formData, setFormData] = useState<NewPurchaseOrderFormData>(defaultForm)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      toast.error("Supabase is not configured")
      return
    }
    setSaving(true)
    try {
      const poNumber = await generatePONumber()
      const created = await createPurchaseOrder({
        po_number: poNumber,
        supplier_id: null,
        supplier_name: formData.supplier_name.trim() || "",
        status: "draft",
        total: 0,
        notes: formData.notes.trim() || null,
        created_date: new Date().toISOString().split("T")[0],
        expected_date: formData.expected_date || null,
        received_date: null,
        created_by: null,
      })
      if (created?.id) {
        toast.success("Purchase order created")
        setFormData(defaultForm)
        onOpenChange(false)
        onSuccess(created.id)
      } else {
        toast.error("Could not create purchase order", {
          description: "No data returned from server.",
        })
      }
    } catch (err) {
      const e = err as { message?: string; details?: string; code?: string }
      const message =
        err instanceof Error
          ? err.message
          : typeof e?.message === "string"
            ? e.message
            : typeof e?.details === "string"
              ? e.details
              : typeof e?.code === "string"
                ? e.code
                : typeof err === "object" && err !== null
                  ? JSON.stringify(err)
                  : String(err)
      toast.error("Failed to create purchase order", { description: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Purchase Order</DialogTitle>
          <DialogDescription>
            Enter the purchase order details. The PO will appear in the list after you save.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="supplier_name">Supplier name</Label>
              <Input
                id="supplier_name"
                placeholder="e.g. Acme Supplies"
                value={formData.supplier_name}
                onChange={(e) =>
                  setFormData({ ...formData, supplier_name: e.target.value })
                }
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expected_date">Expected delivery date</Label>
              <Input
                id="expected_date"
                type="date"
                value={formData.expected_date}
                onChange={(e) =>
                  setFormData({ ...formData, expected_date: e.target.value })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any notes for this purchase order..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create purchase order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

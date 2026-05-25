'use client'

import React, { useState, useEffect } from 'react'
import { Settings, Edit2, Save, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getAuthUser } from '@/lib/auth'
import { type Role } from '@/lib/types/roles'

interface Equipment {
  id: string
  name: string
  unique_code: string
  equipment_type: string | null
}

export function SettingsPageClient({ role }: { role: Role }) {
  const [equipments, setEquipments] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; unique_code: string; equipment_type: string }>({
    name: '',
    unique_code: '',
    equipment_type: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  const fetchEquipments = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('equipments')
        .select('id, name, unique_code, equipment_type')
        .order('unique_code')

      if (error) throw error
      setEquipments(data || [])
    } catch (err) {
      console.error('Error fetching equipments:', err)
      setError('Failed to load equipment configurations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEquipments()
  }, [])

  const handleEditClick = (equipment: Equipment) => {
    setEditingId(equipment.id)
    setEditForm({
      name: equipment.name,
      unique_code: equipment.unique_code,
      equipment_type: equipment.equipment_type || ''
    })
    setShowEditModal(true)
  }

  const handleSave = async () => {
    if (!editingId) return

    try {
      const supabase = createClient()
      const user = await getAuthUser()
      if (!user) throw new Error('Not authenticated')

      const match = document.cookie.match(/(?:^|; )access_token=([^;]*)/)
      const token = match ? decodeURIComponent(match[1]) : null
      if (!token) throw new Error('Not authenticated')

      // Convert equipment_type to lowercase
      const normalizedEquipmentType = editForm.equipment_type.toLowerCase()

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-equipment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update',
          equipment_id: editingId,
          name: editForm.name,
          unique_code: editForm.unique_code,
          equipment_type: normalizedEquipmentType
        })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to update equipment')

      setSuccess('Equipment updated successfully')
      setEditingId(null)
      setShowEditModal(false)
      await fetchEquipments()
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update equipment')
      setTimeout(() => setError(null), 3000)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setShowEditModal(false)
    setEditForm({ name: '', unique_code: '', equipment_type: '' })
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-[20px] font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-foreground-muted">
          Manage system configuration and settings.
        </p>
      </div>

      {/* Configuration Section */}
      <div className="  bg-surface p-3 shadow-card border border-foreground/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-secondary/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <h2 className="text-[16px] font-semibold text-foreground">Configuration</h2>
            <p className="text-xs text-foreground-muted">Manage equipment configurations</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-error bg-error-bg p-3">
            <X className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 text-sm text-secondary bg-secondary/10 p-3">
            <Save className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}

        {loading ? (
          <div className="text-center py-4 text-sm text-foreground-muted">
            Loading equipment configurations...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-foreground/5">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">
                    Unique Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">
                    Equipment Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-foreground-muted whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/10">
                {equipments.map((equipment) => (
                  <tr key={equipment.id} className="hover:bg-foreground/3">
                    <td className="px-4 py-3 text-sm text-foreground font-medium whitespace-nowrap">
                      {equipment.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                      {equipment.unique_code}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                      {equipment.equipment_type ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-secondary/20 text-foreground">
                          {equipment.equipment_type}
                        </span>
                      ) : (
                        <span className="text-foreground-muted">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <button
                        onClick={() => handleEditClick(equipment)}
                        className="inline-flex items-center gap-1 text-foreground hover:text-secondary transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {equipments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-sm text-foreground-muted">
                      No equipment configurations found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCancel}
          />

          {/* Modal */}
          <div className="relative bg-surface shadow-popover w-full max-w-md p-3 animate-in fade-in zoom-in duration-200">
            {/* Close Button */}
            <button
              onClick={handleCancel}
              className="absolute top-4 right-4 text-foreground-muted hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>

            {/* Content */}
            <div className="pt-2">
              <h3 className="text-[20px] font-semibold text-foreground mb-2">
                Edit Equipment
              </h3>
              
              <div className="space-y-4 py-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-foreground/10 bg-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Unique Code
                  </label>
                  <input
                    type="text"
                    value={editForm.unique_code}
                    onChange={(e) => setEditForm({ ...editForm, unique_code: e.target.value })}
                    className="w-full px-3 py-2 border border-foreground/10 bg-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Equipment Type
                  </label>
                  <input
                    type="text"
                    value={editForm.equipment_type}
                    onChange={(e) => setEditForm({ ...editForm, equipment_type: e.target.value })}
                    placeholder="e.g., weapon, communication, navigational, ict, ammunitions"
                    className="w-full px-3 py-2 border border-foreground/10 bg-surface focus:outline-none focus:ring-2 focus:ring-secondary/50 text-sm"
                  />
                  <p className="text-xs text-foreground-muted mt-1">
                    Will be automatically converted to lowercase (e.g., AMMUNITIONS → ammunitions)
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2.5 text-xs font-bold uppercase tracking-widest bg-accent text-white hover:bg-secondary-hover transition-colors shadow-card"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Settings, Edit2, Save, X, ChevronDown, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getAuthUser, getValidAccessToken } from '@/lib/auth'
import { ROLES, type Role } from '@/lib/types/roles'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { SuccessModal } from '@/components/ui/SuccessModal'
import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface Equipment {
  id: string
  name: string
  unique_code: string
  equipment_type: string | null
}

interface Vessel {
  id: string
  bow_number: string
}

export function SettingsPageClient({ role }: { role: Role }) {
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [isClearDataOpen, setIsClearDataOpen] = useState(false)
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
  const [isClearingMasterlist, setIsClearingMasterlist] = useState(false)
  const [isClearingReports, setIsClearingReports] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successModalData, setSuccessModalData] = useState<{ title: string, message: string }>({ title: '', message: '' })
  const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean, type: 'masterlist' | 'reports' | 'vessel' | null }>({ isOpen: false, type: null })
  const [clipboardModalState, setClipboardModalState] = useState<{ isOpen: boolean, type: 'masterlist' | 'reports' | 'vessel' | null, phrase: string }>({ isOpen: false, type: null, phrase: '' })

  const [vessels, setVessels] = useState<Vessel[]>([])
  const [selectedVesselId, setSelectedVesselId] = useState<string>('')
  const [clearVesselOptions, setClearVesselOptions] = useState({ report: false, masterlist: false })
  const [isClearingVesselData, setIsClearingVesselData] = useState(false)

  const [vesselSearchQuery, setVesselSearchQuery] = useState('')
  const [isVesselDropdownOpen, setIsVesselDropdownOpen] = useState(false)
  const vesselDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (vesselDropdownRef.current && !vesselDropdownRef.current.contains(event.target as Node)) {
        setIsVesselDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredVesselsForSearch = vessels
    .filter(v => v.bow_number.toLowerCase().includes(vesselSearchQuery.toLowerCase()))

  const selectedVesselObj = vessels.find(v => v.id === selectedVesselId)

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

  const fetchVessels = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('vessels').select('id, bow_number').order('bow_number')
      if (!error && data) {
        setVessels(data)
      }
    } catch (err) {
      console.error('Error fetching vessels:', err)
    }
  }

  useEffect(() => {
    fetchEquipments()
    fetchVessels()
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

      const token = await getValidAccessToken()
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

  const handleClearMasterlist = async () => {
    setClipboardModalState({ isOpen: false, type: null, phrase: '' })
    setIsClearingMasterlist(true)
    try {
      const token = await getValidAccessToken()
      if (!token) throw new Error('Not authenticated')

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/clear-all-items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to clear masterlist')
      }

      setSuccessModalData({
        title: 'MASTERLIST CLEARED',
        message: 'All masterlist item data has been successfully removed from the system.'
      })
      setShowSuccessModal(true)
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setIsClearingMasterlist(false)
    }
  }

  const handleClearReports = async () => {
    setClipboardModalState({ isOpen: false, type: null, phrase: '' })
    setIsClearingReports(true)
    try {
      const token = await getValidAccessToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/clear-monthly-report`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || res.statusText)
      }

      setSuccessModalData({
        title: 'REPORTS CLEARED',
        message: 'All monthly report data has been successfully removed from the system.'
      })
      setShowSuccessModal(true)
    } catch (err: any) {
      alert(`Error clearing reports: ${err.message}`)
    } finally {
      setIsClearingReports(false)
    }
  }

  const handleClearVesselData = async () => {
    setClipboardModalState({ isOpen: false, type: null, phrase: '' })
    setIsClearingVesselData(true)
    try {
      const token = await getValidAccessToken()
      if (!token) throw new Error('Not authenticated')

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/clear-vessel-data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vesselId: selectedVesselId, options: clearVesselOptions })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to clear vessel data')
      }

      setSuccessModalData({
        title: 'VESSEL DATA CLEARED',
        message: 'Successfully cleared data for the selected vessel.'
      })
      setShowSuccessModal(true)

      setSelectedVesselId('')
      setClearVesselOptions({ report: false, masterlist: false })
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setIsClearingVesselData(false)
    }
  }

  // Variables for dynamic modal rendering
  const vesselName = vessels.find(v => v.id === selectedVesselId)?.bow_number || ''
  const actionStr = clearVesselOptions.report && clearVesselOptions.masterlist ? 'Both' : (clearVesselOptions.report ? 'Report' : 'Masterlist')

  const confirmModalTitle = confirmModalState.type === 'masterlist' ? 'Clear Masterlist?' :
    confirmModalState.type === 'reports' ? 'Clear All Reports?' :
      `Clear ${actionStr} for ${vesselName}?`

  const confirmModalMessage = confirmModalState.type === 'masterlist'
    ? 'Are you sure you want to completely clear the HQ and all Vessel Masterlists (including all Monthly Reports)? This action cannot be undone.'
    : confirmModalState.type === 'reports'
      ? 'Are you sure you want to completely clear all monthly reports? This action cannot be undone.'
      : `Are you sure you want to clear ${actionStr} for ${vesselName}? This action cannot be undone.`

  const clipboardExpectedPhrase = clipboardModalState.type === 'masterlist' ? 'CLEAR MASTERLIST' :
    clipboardModalState.type === 'reports' ? 'CLEAR REPORTS' :
      `CLEAR ${actionStr.toUpperCase()}`

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
      <div className="bg-surface shadow-card border border-foreground/10">
        <div
          className="flex items-center justify-between p-3 cursor-pointer select-none hover:bg-foreground/5 transition-colors"
          onClick={() => setIsConfigOpen(!isConfigOpen)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-secondary/20 flex items-center justify-center">
              <Settings className="w-5 h-5 text-foreground" />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-foreground">Configuration</h2>
              <p className="text-xs text-foreground-muted">Manage equipment configurations</p>
            </div>
          </div>
          <div className="text-foreground-muted">
            {isConfigOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </div>
        </div>

        {isConfigOpen && (
          <div className="p-3 border-t border-foreground/10">
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
        )}
      </div>

      {/* Clear Data Section */}
      {role === ROLES.admin && (
        <div className="bg-surface shadow-card border border-foreground/10 mt-6">
          <div
            className="flex items-center justify-between p-3 cursor-pointer select-none hover:bg-foreground/5 transition-colors"
            onClick={() => setIsClearDataOpen(!isClearDataOpen)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-error/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-error" />
              </div>
              <div>
                <h2 className="text-[16px] font-semibold text-error">Clear Data (Not Recommended)</h2>
                <p className="text-xs text-foreground-muted">Dangerous operations to hard-delete system data</p>
              </div>
            </div>
            <div className="text-foreground-muted">
              {isClearDataOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </div>
          </div>

          {isClearDataOpen && (
            <div className="p-3 border-t border-error/10">
              <div className="flex flex-col gap-4 mt-2">
                <div className="flex flex-col gap-3 p-4 border border-error/20 bg-error/5">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest">Clear Vessel Data</h3>
                    <p className="text-xs text-foreground-muted mt-1">Select a vessel and choose which records to clear.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full flex flex-col gap-2">
                      <div className="relative w-full" ref={vesselDropdownRef}>
                        <input
                          type="text"
                          className="w-full px-3 py-2.5 pr-10 border border-foreground/20 bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-error"
                          placeholder="Type bow number to search..."
                          value={isVesselDropdownOpen ? vesselSearchQuery : (selectedVesselObj ? selectedVesselObj.bow_number : vesselSearchQuery)}
                          onChange={(e) => {
                            setVesselSearchQuery(e.target.value)
                            setIsVesselDropdownOpen(true)
                            setSelectedVesselId('') // clear selection when typing
                          }}
                          onFocus={() => {
                            setIsVesselDropdownOpen(true)
                            if (selectedVesselObj) setVesselSearchQuery(selectedVesselObj.bow_number)
                          }}
                        />
                        {(vesselSearchQuery || selectedVesselId) && (
                          <button
                            title="Clear selection"
                            onClick={() => {
                              setVesselSearchQuery('')
                              setSelectedVesselId('')
                              setIsVesselDropdownOpen(true) // Reopen to show all options again
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
                          >
                            <X className="w-4 h-4" strokeWidth={2.5} />
                          </button>
                        )}
                        {isVesselDropdownOpen && (
                          <div className="absolute z-10 w-full mt-1 bg-surface border border-foreground/20 shadow-popover max-h-[175px] overflow-y-auto">
                            {filteredVesselsForSearch.length > 0 ? (
                              filteredVesselsForSearch.map(v => (
                                <div
                                  key={v.id}
                                  className="px-3 py-2 cursor-pointer hover:bg-foreground/5 text-sm"
                                  onClick={() => {
                                    setSelectedVesselId(v.id)
                                    setVesselSearchQuery(v.bow_number)
                                    setIsVesselDropdownOpen(false)
                                  }}
                                >
                                  {v.bow_number}
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-2 text-sm text-foreground-muted">
                                No vessels found
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-4 items-center mt-2">
                        <label className={`flex items-center gap-2 cursor-pointer ${clearVesselOptions.masterlist ? 'opacity-70' : ''}`}>
                          <input
                            type="checkbox"
                            checked={clearVesselOptions.report || clearVesselOptions.masterlist}
                            onChange={(e) => setClearVesselOptions(prev => ({ ...prev, report: e.target.checked }))}
                            disabled={clearVesselOptions.masterlist}
                            className="accent-error w-4 h-4 disabled:cursor-not-allowed"
                          />
                          <span className="text-sm text-foreground">Report {clearVesselOptions.masterlist && <span className="text-[10px] text-foreground-muted ml-1 uppercase">(Auto-included)</span>}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={clearVesselOptions.masterlist}
                            onChange={(e) => setClearVesselOptions(prev => {
                              const isChecked = e.target.checked
                              return { report: isChecked ? true : false, masterlist: isChecked }
                            })}
                            className="accent-error w-4 h-4"
                          />
                          <span className="text-sm text-foreground">Masterlist</span>
                        </label>
                      </div>
                    </div>

                    <button
                      onClick={() => setConfirmModalState({ isOpen: true, type: 'vessel' })}
                      disabled={!selectedVesselId || (!clearVesselOptions.report && !clearVesselOptions.masterlist) || isClearingVesselData}
                      className="bg-error/10 hover:bg-error/20 text-error px-6 py-2.5 text-xs font-bold uppercase tracking-widest border border-error/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                      {isClearingVesselData
                        ? 'Clearing...'
                        : `Clear ${clearVesselOptions.report && clearVesselOptions.masterlist ? 'Both' : (clearVesselOptions.report ? 'Report' : 'Masterlist')}`}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-error/20 bg-error/5">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest">Delete All Masterlist</h3>
                    <p className="text-xs text-foreground-muted mt-1">This will permanently delete all items across the HQ Inventory Masterlist and all Vessel Masterlists, including their Monthly Reports.</p>
                  </div>
                  <button
                    onClick={() => setConfirmModalState({ isOpen: true, type: 'masterlist' })}
                    disabled={isClearingMasterlist}
                    className="mt-3 sm:mt-0 bg-error/10 hover:bg-error/20 text-error px-6 py-2.5 text-xs font-bold uppercase tracking-widest border border-error/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isClearingMasterlist ? 'Clearing...' : 'Clear Masterlist'}
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-error/20 bg-error/5">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-widest">Clear All Reports</h3>
                    <p className="text-xs text-foreground-muted mt-1">This will permanently delete all monthly reports imported into the system.</p>
                  </div>
                  <button
                    onClick={() => setConfirmModalState({ isOpen: true, type: 'reports' })}
                    disabled={isClearingReports}
                    className="mt-3 sm:mt-0 bg-error/10 hover:bg-error/20 text-error px-6 py-2.5 text-xs font-bold uppercase tracking-widest border border-error/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    {isClearingReports ? 'Clearing...' : 'Clear Reports'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successModalData.title}
        message={successModalData.message}
      />
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState({ isOpen: false, type: null })}
        onConfirm={() => {
          setClipboardModalState({ isOpen: true, type: confirmModalState.type, phrase: '' })
          setConfirmModalState({ isOpen: false, type: null })
        }}
        title={confirmModalTitle}
        message={confirmModalMessage}
        confirmText="Yes, Clear Data"
        cancelText="Cancel"
        confirmButtonClassName="px-4 py-2.5 text-sm font-bold bg-error text-white hover:bg-error/90 transition-colors border border-error/50 shadow-card uppercase tracking-widest"
      />

      {clipboardModalState.isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setClipboardModalState({ isOpen: false, type: null, phrase: '' })} />
          <div className="relative bg-surface shadow-popover w-full max-w-md p-4 animate-in fade-in zoom-in duration-200 border border-error/40">
            <button
              onClick={() => setClipboardModalState({ isOpen: false, type: null, phrase: '' })}
              className="absolute top-4 right-4 text-foreground-muted hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
            <div className="pt-2">
              <h3 className="text-[20px] font-semibold text-foreground mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-error" /> Final Confirmation
              </h3>
              <p className="text-sm font-normal text-foreground-muted mb-3">
                To continue, please type <strong className="text-foreground">{clipboardExpectedPhrase}</strong> below.
              </p>
              <input
                type="text"
                value={clipboardModalState.phrase}
                onChange={(e) => setClipboardModalState({ ...clipboardModalState, phrase: e.target.value })}
                placeholder={clipboardExpectedPhrase}
                className="w-full px-4 py-3 border border-error/30 bg-surface focus:outline-none focus:ring-2 focus:ring-error/50 text-sm font-bold mb-5 text-foreground placeholder:text-foreground-muted/50"
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setClipboardModalState({ isOpen: false, type: null, phrase: '' })}
                  className="px-4 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/10 transition-colors border border-foreground/10"
                >
                  Cancel
                </button>
                <button
                  onClick={clipboardModalState.type === 'masterlist' ? handleClearMasterlist :
                    clipboardModalState.type === 'reports' ? handleClearReports :
                      handleClearVesselData}
                  disabled={
                    clipboardModalState.phrase !== clipboardExpectedPhrase ||
                    isClearingMasterlist ||
                    isClearingReports ||
                    isClearingVesselData
                  }
                  className="px-6 py-2.5 text-xs font-bold uppercase tracking-widest bg-error text-white hover:bg-error/90 transition-colors shadow-card disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isClearingMasterlist || isClearingReports || isClearingVesselData ? 'Processing...' : 'Proceed'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

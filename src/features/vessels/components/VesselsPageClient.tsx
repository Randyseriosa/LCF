'use client'

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Role, ROLES } from '@/lib/types/roles'
import { useVessels, ClassOfVessel, Vessel } from '../hooks/useVessels'
import { Anchor, Plus, Pencil, Trash2, X, GripVertical, ArrowUpDown, ArrowUp, ArrowDown, Filter, Package, Search, Ship } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

type SortDirection = 'asc' | 'desc' | null

export function VesselsPageClient({ role, basePath }: { role: Role, basePath: string }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const { classesOfVessel, vessels, loading, error, manageClassOfVessel, reorderClassesOfVessel, manageVessel } = useVessels()

    // Read active tab from URL; default to 'bow'
    const rawTab = searchParams.get('tab')
    const initialTab: 'class' | 'bow' = rawTab === 'class' ? 'class' : 'bow'
    const [activeTab, setActiveTabState] = useState<'class' | 'bow'>(initialTab)
    const canEdit = role === ROLES.admin || role === ROLES.encoder

    // Highlight state: when returning from equipment page after save
    const [highlightedVesselId, setHighlightedVesselId] = useState<string | null>(null)

    useEffect(() => {
        const highlightId = searchParams.get('highlight')

        if (highlightId) {
            setHighlightedVesselId(highlightId)
            // Switch to bow tab when returning from equipment page with a highlight
            setActiveTabState('bow')
            // Update URL: keep tab=bow, remove highlight
            const params = new URLSearchParams(searchParams.toString())
            params.set('tab', 'bow')
            params.delete('highlight')
            window.history.replaceState({}, '', `${pathname}?${params.toString()}`)
        }

        // Auto-clear highlight after 2.5s
        if (highlightId) {
            const timer = setTimeout(() => setHighlightedVesselId(null), 2500)
            return () => clearTimeout(timer)
        }
    }, [searchParams, pathname])

    /** Persist selected tab in URL */
    const setActiveTab = useCallback(
        (tab: 'class' | 'bow') => {
            setActiveTabState(tab)
            const params = new URLSearchParams(searchParams.toString())
            params.set('tab', tab)
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        },
        [router, pathname, searchParams]
    )

    // Modal state for Class of Vessel
    const [isClassModalOpen, setIsClassModalOpen] = useState(false)
    const [currentClass, setCurrentClass] = useState<Partial<ClassOfVessel> | null>(null)

    // Modal state for Bow Number
    const [isBowModalOpen, setIsBowModalOpen] = useState(false)
    const [currentBow, setCurrentBow] = useState<Partial<Vessel> | null>(null)

    // Delete confirmation modal state
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'class' | 'bow', id: string, name: string } | null>(null)

    // Error modal state
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const [modalError, setModalError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)

    // Drag-and-drop state for class of vessel reordering
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
    const [isReordering, setIsReordering] = useState(false)

    // Bow Number sort & filter state
    const [bowSortColumn, setBowSortColumn] = useState<'bow_number' | 'class_of_vessel' | null>(null)
    const [bowSortDirection, setBowSortDirection] = useState<SortDirection>(null)
    const [bowFilterClass, setBowFilterClass] = useState<string>('')
    const [bowSearchQuery, setBowSearchQuery] = useState<string>('')
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const filterRef = useRef<HTMLDivElement>(null)

    const handleSaveClass = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!currentClass?.name) return

        // Client-side validation for duplicates
        const isDuplicate = classesOfVessel.some(
            cls => cls.id !== currentClass.id && cls.name.toLowerCase().trim() === currentClass.name?.toLowerCase().trim()
        )
        if (isDuplicate) {
            setModalError('Class of vessel with this name already exists')
            return
        }

        setIsSaving(true)
        setModalError(null)
        try {
            if (currentClass.id) {
                await manageClassOfVessel('update', { id: currentClass.id, name: currentClass.name })
            } else {
                await manageClassOfVessel('create', { name: currentClass.name })
            }
            setIsClassModalOpen(false)
            setCurrentClass(null)
        } catch (err: any) {
            setModalError(err.message)
        } finally {
            setIsSaving(false)
        }
    }

    const handleDeleteClass = async (id: string) => {
        const classToDelete = classesOfVessel.find(c => c.id === id)
        if (!classToDelete) return
        setDeleteTarget({ type: 'class', id, name: classToDelete.name })
        setIsDeleteModalOpen(true)
    }

    const handleDeleteBow = async (id: string) => {
        const bowToDelete = vessels.find(v => v.id === id)
        if (!bowToDelete) return
        setDeleteTarget({ type: 'bow', id, name: bowToDelete.bow_number })
        setIsDeleteModalOpen(true)
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        setIsSaving(true)
        try {
            if (deleteTarget.type === 'class') {
                await manageClassOfVessel('delete', { id: deleteTarget.id })
            } else {
                await manageVessel('delete', { id: deleteTarget.id })
            }
            setIsDeleteModalOpen(false)
            setDeleteTarget(null)
        } catch (err: any) {
            setIsDeleteModalOpen(false)
            setErrorMessage(err.message)
            setIsErrorModalOpen(true)
        } finally {
            setIsSaving(false)
        }
    }

    const handleSaveBow = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!currentBow?.bow_number || !currentBow?.class_of_vessel) return
        setIsSaving(true)
        setModalError(null)
        try {
            if (currentBow.id) {
                await manageVessel('update', { id: currentBow.id, bow_number: currentBow.bow_number, class_of_vessel: currentBow.class_of_vessel })
            } else {
                await manageVessel('create', { bow_number: currentBow.bow_number, class_of_vessel: currentBow.class_of_vessel })
            }
            setIsBowModalOpen(false)
            setCurrentBow(null)
        } catch (err: any) {
            setModalError(err.message)
        } finally {
            setIsSaving(false)
        }
    }

    // Drag-and-drop handlers
    const handleDragStart = useCallback((index: number) => {
        setDraggedIndex(index)
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
        e.preventDefault()
        setDragOverIndex(index)
    }, [])

    const handleDragEnd = useCallback(async () => {
        if (draggedIndex === null || dragOverIndex === null || draggedIndex === dragOverIndex) {
            setDraggedIndex(null)
            setDragOverIndex(null)
            return
        }

        setIsReordering(true)
        const reordered = [...classesOfVessel]
        const [moved] = reordered.splice(draggedIndex, 1)
        reordered.splice(dragOverIndex, 0, moved)

        const items = reordered.map((cls, i) => ({ id: cls.id, sort_order: i + 1 }))

        try {
            await reorderClassesOfVessel(items)
        } catch (err: any) {
            alert('Reorder failed: ' + err.message)
        } finally {
            setDraggedIndex(null)
            setDragOverIndex(null)
            setIsReordering(false)
        }
    }, [draggedIndex, dragOverIndex, classesOfVessel, reorderClassesOfVessel])

    // Bow Number sort toggle
    const handleBowSort = useCallback((column: 'bow_number' | 'class_of_vessel') => {
        if (bowSortColumn === column) {
            if (bowSortDirection === 'asc') setBowSortDirection('desc')
            else if (bowSortDirection === 'desc') { setBowSortColumn(null); setBowSortDirection(null) }
            else setBowSortDirection('asc')
        } else {
            setBowSortColumn(column)
            setBowSortDirection('asc')
        }
    }, [bowSortColumn, bowSortDirection])

    // Helper to get class name by id
    const getClassName = useCallback((classId: string) => {
        return classesOfVessel.find(c => c.id === classId)?.name || 'Unknown'
    }, [classesOfVessel])

    // Get class sort_order by id for sorting
    const getClassSortOrder = useCallback((classId: string) => {
        return classesOfVessel.find(c => c.id === classId)?.sort_order ?? 999
    }, [classesOfVessel])

    // Filtered & sorted bow numbers
    const filteredAndSortedVessels = useMemo(() => {
        let result = [...vessels]

        // Filter by search query
        if (bowSearchQuery.trim()) {
            const query = bowSearchQuery.toLowerCase()
            result = result.filter(v => v.bow_number.toLowerCase().includes(query))
        }

        // Filter by class
        if (bowFilterClass) {
            result = result.filter(v => v.class_of_vessel === bowFilterClass)
        }

        // Sort
        if (bowSortColumn && bowSortDirection) {
            result.sort((a, b) => {
                let valueA: string | number
                let valueB: string | number

                if (bowSortColumn === 'bow_number') {
                    valueA = a.bow_number.toLowerCase()
                    valueB = b.bow_number.toLowerCase()
                } else {
                    // Sort by class sort_order (same order as class table)
                    valueA = getClassSortOrder(a.class_of_vessel)
                    valueB = getClassSortOrder(b.class_of_vessel)
                }

                if (valueA < valueB) return bowSortDirection === 'asc' ? -1 : 1
                if (valueA > valueB) return bowSortDirection === 'asc' ? 1 : -1
                return 0
            })
        }

        return result
    }, [vessels, bowSearchQuery, bowFilterClass, bowSortColumn, bowSortDirection, getClassSortOrder])

    const SortIcon = ({ column }: { column: 'bow_number' | 'class_of_vessel' }) => {
        if (bowSortColumn !== column) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
        if (bowSortDirection === 'asc') return <ArrowUp className="w-3.5 h-3.5 text-primary" />
        return <ArrowDown className="w-3.5 h-3.5 text-primary" />
    }

    if (loading) return <div className="p-4 text-foreground">Loading vessels data...</div>
    if (error) return <div className="p-4 text-error">Error: {error}</div>

    return (
        <div className="space-y-6">
            <PageHeader
                title="Vessel Management"
                description="View class of vessels and bow numbers"
                onBack={() => router.push(basePath)}
                Icon={Ship}
            />

            <div className="flex border-b border-primary/30">
                <button
                    className={`py-3 px-4 text-xs font-bold transition-colors border-b-2 ${activeTab === 'bow'
                        ? 'border-accent text-primary'
                        : 'border-transparent text-foreground-muted hover:text-foreground'
                        }`}
                    onClick={() => setActiveTab('bow')}
                >
                    Bow Number
                </button>
                <button
                    className={`py-3 px-4 text-xs font-bold transition-colors border-b-2 ${activeTab === 'class'
                        ? 'border-accent text-primary'
                        : 'border-transparent text-foreground-muted hover:text-foreground'
                        }`}
                    onClick={() => setActiveTab('class')}
                >
                    Class of Vessel
                </button>
            </div>

            {/* CLASS OF VESSEL TABLE */}
            {activeTab === 'class' && (
                <div className=" bg-surface border border-foreground/10 overflow-hidden shadow-card">
                    <div className="p-3 flex justify-between items-center border-b border-foreground/10 bg-foreground/3">
                        <h2 className="text-[20px] font-semibold text-foreground">Class of Vessels</h2>
                        {canEdit && (
                            <button
                                onClick={() => { setCurrentClass({}); setModalError(null); setIsClassModalOpen(true) }}
                                className="bg-accent text-white px-6 py-2.5 flex items-center gap-2 hover:bg-secondary-hover transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
                            >
                                <Plus className="w-4 h-4" /> Add Class
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="text-xs text-foreground/60 uppercase bg-foreground/3">
                                <tr>
                                    {canEdit && <th className="px-3 py-3 font-medium w-12">#</th>}
                                    <th className="px-4 py-3 font-medium">Name</th>
                                    {canEdit && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-foreground/10">
                                {classesOfVessel.map((cls, index) => (
                                    <tr
                                        key={cls.id}
                                        draggable={canEdit}
                                        onDragStart={() => handleDragStart(index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDragEnd={handleDragEnd}
                                        className={`bg-surface transition-all ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''
                                            } ${draggedIndex === index ? 'opacity-40' : ''
                                            } ${dragOverIndex === index && draggedIndex !== index ? 'border-t-2 border-t-primary' : ''
                                            }`}
                                    >
                                        {canEdit && (
                                            <td className="px-3 py-2 text-foreground-muted whitespace-nowrap">
                                                <GripVertical className="w-4 h-4" />
                                            </td>
                                        )}
                                        <td className="px-4 py-2 text-foreground font-medium whitespace-nowrap">
                                            {cls.name}
                                        </td>
                                        {canEdit && (
                                            <td className="px-4 py-2 text-right flex justify-end gap-2 whitespace-nowrap">
                                                <button
                                                    onClick={() => { setCurrentClass(cls); setModalError(null); setIsClassModalOpen(true) }}
                                                    className="text-primary hover:text-primary/70 p-1.5 hover:bg-primary/10 transition-colors"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClass(cls.id)}
                                                    className="text-error hover:text-error/80 p-1.5 hover:bg-error-bg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {classesOfVessel.length === 0 && (
                                    <tr>
                                        <td colSpan={canEdit ? 3 : 1} className="px-4 py-4 text-center text-foreground-muted">No classes found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {isReordering && (
                        <div className="p-3 text-center text-xs text-foreground-muted bg-foreground/2">
                            Saving new order...
                        </div>
                    )}
                    {canEdit && classesOfVessel.length > 1 && (
                        <div className="p-3 text-center text-xs text-foreground-muted bg-foreground/2 border-t border-foreground/5">
                            <GripVertical className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                            Drag rows to reorder. This order is reflected in the dropdown when adding bow numbers.
                        </div>
                    )}
                </div>
            )}

            {/* BOW NUMBER TABLE */}
            {activeTab === 'bow' && (
                <div className=" bg-surface border border-foreground/10 overflow-hidden shadow-card">
                    <div className="p-3 flex justify-between items-center border-b border-foreground/10 bg-foreground/3">
                        <div className="flex items-center gap-3">
                            <h2 className="text-[20px] font-semibold text-foreground">Bow Numbers</h2>

                            {/* Search Input */}
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
                                <input
                                    type="text"
                                    placeholder="Search bow number..."
                                    value={bowSearchQuery}
                                    onChange={(e) => setBowSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-1.5 text-sm border border-foreground/10 bg-surface text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors w-48 lg:w-64"
                                />
                            </div>

                            {/* Filter dropdown */}
                            <div className="relative" ref={filterRef}>
                                <button
                                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                                    className={`flex items-center gap-1.5 text-sm px-3 py-1.5 border transition-colors ${bowFilterClass
                                        ? 'border-primary/40 bg-primary/10 text-primary'
                                        : 'border-foreground/10 text-foreground/60 hover:text-foreground hover:border-foreground/20'
                                        }`}
                                >
                                    <Filter className="w-3.5 h-3.5" />
                                    {bowFilterClass
                                        ? getClassName(bowFilterClass)
                                        : 'Filter Class'
                                    }
                                </button>
                                {isFilterOpen && (
                                    <div className="absolute top-full left-0 mt-1 w-56  bg-surface border border-foreground/10 shadow-popover z-30 py-1 max-h-64 overflow-y-auto">
                                        <button
                                            onClick={() => { setBowFilterClass(''); setIsFilterOpen(false) }}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${!bowFilterClass ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-foreground/5'}`}
                                        >
                                            All Classes
                                        </button>
                                        {classesOfVessel.map(cls => (
                                            <button
                                                key={cls.id}
                                                onClick={() => { setBowFilterClass(cls.id); setIsFilterOpen(false) }}
                                                className={`w-full text-left px-4 py-2 text-sm transition-colors ${bowFilterClass === cls.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-foreground/5'}`}
                                            >
                                                {cls.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        {canEdit && (
                            <button
                                onClick={() => { setCurrentBow({}); setModalError(null); setIsBowModalOpen(true) }}
                                className="bg-accent text-white px-6 py-2.5 flex items-center gap-2 hover:bg-secondary-hover transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
                            >
                                <Plus className="w-4 h-4" /> Add Bow Number
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="text-xs text-foreground/60 uppercase bg-foreground/3">
                                <tr>
                                    <th
                                        className="px-4 py-3 font-medium cursor-pointer select-none hover:text-foreground transition-colors"
                                        onClick={() => handleBowSort('bow_number')}
                                    >
                                        <span className="inline-flex items-center gap-1.5">
                                            Bow Number Name
                                            <SortIcon column="bow_number" />
                                        </span>
                                    </th>
                                    <th
                                        className="px-4 py-3 font-medium cursor-pointer select-none hover:text-foreground transition-colors"
                                        onClick={() => handleBowSort('class_of_vessel')}
                                    >
                                        <span className="inline-flex items-center gap-1.5">
                                            Class of Vessel
                                            <SortIcon column="class_of_vessel" />
                                        </span>
                                    </th>
                                    <th className="px-4 py-3 font-medium">
                                        <span className="inline-flex items-center gap-1.5">
                                            Equipments
                                        </span>
                                    </th>
                                    {canEdit && <th className="px-4 py-3 font-medium text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-foreground/10">
                                {filteredAndSortedVessels.map(vessel => (
                                    <tr
                                        key={vessel.id}
                                        className={`transition-all duration-500 ${highlightedVesselId === vessel.id
                                            ? 'bg-primary/10 ring-1 ring-primary/30 ring-inset'
                                            : 'bg-surface hover:bg-foreground/2'
                                            }`}
                                    >
                                        <td className="px-4 py-2 text-foreground font-medium whitespace-nowrap">
                                            {vessel.bow_number}
                                        </td>
                                        <td className="px-4 py-2 text-foreground/70 whitespace-nowrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 bg-primary/10 text-primary text-xs font-medium">
                                                {getClassName(vessel.class_of_vessel)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <button
                                                onClick={() => {
                                                    const basePath = pathname.replace(/\/vessels.*/, '/vessels')
                                                    router.push(`${basePath}/${vessel.slug}/equipments`)
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all cursor-pointer bg-foreground/5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
                                            >
                                                <Package className="w-3.5 h-3.5" />
                                                View Equipments
                                            </button>
                                        </td>
                                        {canEdit && (
                                            <td className="px-4 py-2 text-right flex justify-end gap-2 whitespace-nowrap">
                                                <button
                                                    onClick={() => { setCurrentBow(vessel); setModalError(null); setIsBowModalOpen(true) }}
                                                    className="text-primary hover:text-primary/70 p-1.5 hover:bg-primary/10 transition-colors"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteBow(vessel.id)}
                                                    className="text-error hover:text-error/80 p-1.5 hover:bg-error-bg transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {filteredAndSortedVessels.length === 0 && (
                                    <tr>
                                        <td colSpan={canEdit ? 4 : 3} className="px-4 py-4 text-center text-foreground-muted">
                                            {bowSearchQuery && bowFilterClass
                                                ? 'No bow numbers match your search and filter criteria'
                                                : bowSearchQuery
                                                    ? 'No bow numbers match your search'
                                                    : bowFilterClass
                                                        ? 'No bow numbers found for this class'
                                                        : 'No bow numbers found'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {filteredAndSortedVessels.length > 0 && (
                        <div className="p-3 text-right text-xs text-foreground-muted bg-foreground/2 border-t border-foreground/5">
                            Showing {filteredAndSortedVessels.length} of {vessels.length} bow numbers
                        </div>
                    )}
                </div>
            )}


            {/* CLASS MODAL */}
            {isClassModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className=" bg-surface max-w-md w-full shadow-popover border border-foreground/10">
                        <div className="flex justify-between items-center p-3 border-b border-foreground/10">
                            <h3 className="font-semibold text-[20px] text-foreground">
                                {currentClass?.id ? 'Edit Class of Vessel' : 'Add Class of Vessel'}
                            </h3>
                            <button onClick={() => setIsClassModalOpen(false)} className="text-foreground-muted hover:text-foreground transition-colors p-1 hover:bg-foreground/5">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveClass} className="p-3 space-y-4">
                            {modalError && <div className="text-sm text-error bg-error-bg p-3">{modalError}</div>}
                            <div>
                                <label className="block text-sm font-medium text-foreground-muted mb-1.5">Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border border-foreground/15 px-4 py-2.5 bg-background text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                                    placeholder="Enter class name"
                                    value={currentClass?.name || ''}
                                    onChange={e => setCurrentClass(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsClassModalOpen(false)} className="px-4 py-2.5 text-foreground-muted hover:bg-foreground/5 transition-colors text-sm font-medium">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-accent text-white hover:bg-secondary-hover disabled:opacity-50 transition-colors text-xs font-bold uppercase tracking-widest shadow-card">
                                    {isSaving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* BOW MODAL */}
            {isBowModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className=" bg-surface max-w-md w-full shadow-popover border border-foreground/10">
                        <div className="flex justify-between items-center p-3 border-b border-foreground/10">
                            <h3 className="font-semibold text-[20px] text-foreground">
                                {currentBow?.id ? 'Edit Bow Number' : 'Add Bow Number'}
                            </h3>
                            <button onClick={() => setIsBowModalOpen(false)} className="text-foreground-muted hover:text-foreground transition-colors p-1 hover:bg-foreground/5">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveBow} className="p-3 space-y-4">
                            {modalError && <div className="text-sm text-error bg-error-bg p-3">{modalError}</div>}
                            <div>
                                <label className="block text-sm font-medium text-foreground-muted mb-1.5">Bow Number</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border border-foreground/15 px-4 py-2.5 bg-background text-foreground placeholder:text-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                                    placeholder="Enter bow number"
                                    value={currentBow?.bow_number || ''}
                                    onChange={e => setCurrentBow(prev => ({ ...prev, bow_number: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-foreground-muted mb-1.5">Class of Vessel</label>
                                <select
                                    required
                                    className="w-full border border-foreground/15 px-4 py-2.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors appearance-none"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' viewBox='0 0 24 24' stroke='%236B7280' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 12px center',
                                        paddingRight: '36px'
                                    }}
                                    value={currentBow?.class_of_vessel || ''}
                                    onChange={e => setCurrentBow(prev => ({ ...prev, class_of_vessel: e.target.value }))}
                                >
                                    <option value="" disabled>Select a class</option>
                                    {classesOfVessel.map(cls => (
                                        <option key={cls.id} value={cls.id}>{cls.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setIsBowModalOpen(false)} className="px-4 py-2.5 text-foreground-muted hover:bg-foreground/5 transition-colors text-sm font-medium">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-accent text-white hover:bg-secondary-hover disabled:opacity-50 transition-colors text-xs font-bold uppercase tracking-widest shadow-card">
                                    {isSaving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {isDeleteModalOpen && deleteTarget && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className=" bg-surface max-w-md w-full shadow-popover border border-foreground/10">
                        <div className="flex justify-between items-center p-3 border-b border-foreground/10">
                            <h3 className="font-semibold text-[20px] text-foreground">
                                Confirm Delete
                            </h3>
                            <button onClick={() => setIsDeleteModalOpen(false)} className="text-foreground-muted hover:text-foreground transition-colors p-1 hover:bg-foreground/5">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-3 space-y-4">
                            <p className="text-foreground">
                                {deleteTarget.type === 'class'
                                    ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone if there are bow numbers assigned to this class.`
                                    : `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.`
                                }
                            </p>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsDeleteModalOpen(false)
                                        setDeleteTarget(null)
                                    }}
                                    className="px-4 py-2.5 text-foreground-muted hover:bg-foreground/5 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmDelete}
                                    disabled={isSaving}
                                    className="px-4 py-2.5 bg-error text-white hover:bg-error/90 disabled:opacity-50 transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
                                >
                                    {isSaving ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ERROR MODAL */}
            {isErrorModalOpen && errorMessage && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className=" bg-surface max-w-md w-full shadow-popover border border-foreground/10">
                        <div className="flex justify-between items-center p-3 border-b border-foreground/10">
                            <h3 className="font-semibold text-[20px] text-foreground">
                                Error
                            </h3>
                            <button onClick={() => setIsErrorModalOpen(false)} className="text-foreground-muted hover:text-foreground transition-colors p-1 hover:bg-foreground/5">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-3 space-y-4">
                            <p className="text-foreground">{errorMessage}</p>
                            <div className="flex justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsErrorModalOpen(false)
                                        setErrorMessage(null)
                                    }}
                                    className="px-4 py-2.5 bg-accent text-white hover:bg-secondary-hover transition-colors text-xs font-bold uppercase tracking-widest shadow-card"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
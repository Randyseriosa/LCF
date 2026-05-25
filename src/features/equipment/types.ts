export interface Equipment {
    id: string
    name: string
    created_at: string
}

export interface Item {
    id: string
    equipment_id: string
    name: string
    is_spare: 'standard' | 'spare'
    current_assignment_id?: string
    created_at: string
}

export interface VesselItemAssignment {
    id: string
    item_id: string
    vessel_id: string
    is_current: boolean
    assigned_at: string
    created_at: string
}

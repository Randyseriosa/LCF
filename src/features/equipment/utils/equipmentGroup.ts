export type EquipmentGroup = 'WEAPONS' | 'COMMUNICATION' | 'NAVIGATIONAL' | 'ICT' | 'AMMUNITIONS'
export type EquipmentCategory = 'WEAPONS' | 'COMMUNICATION' | 'NAVIGATIONAL' | 'ICT' | 'AMMUNITIONS'

export function getEquipmentGroupFromUniqueCode(uniqueCode?: string): EquipmentGroup {
    if (!uniqueCode) return 'COMMUNICATION'

    const prefix = uniqueCode.toUpperCase().substring(0, 2)

    if (prefix === 'WE') return 'WEAPONS'
    if (prefix === 'IE') return 'ICT'
    if (prefix === 'NE') return 'NAVIGATIONAL'
    if (prefix === 'AM') return 'AMMUNITIONS'
    if (prefix === 'CE') return 'COMMUNICATION'

    return 'COMMUNICATION'
}

export function getCategoryFromEquipmentType(equipmentType: string | null, uniqueCode?: string | null | undefined): EquipmentCategory {
    // If equipment_type is available, use it
    if (equipmentType) {
        const type = equipmentType.toLowerCase()

        if (type === 'we' || type === 'weapon' || type.includes('weapon') || type.includes('weap')) {
            return 'WEAPONS'
        }
        if (type === 'ie' || type === 'ict' || type === 'it') {
            return 'ICT'
        }
        if (type === 'ne' || type === 'navigational' || type.includes('navig')) {
            return 'NAVIGATIONAL'
        }
        if (type === 'am' || type === 'ammunitions' || type.includes('ammunition') || type.includes('ammo')) {
            return 'AMMUNITIONS'
        }
        if (type === 'ce' || type === 'communication' || type.includes('comm')) {
            return 'COMMUNICATION'
        }

        console.log('[getCategoryFromEquipmentType] Unknown equipment_type:', equipmentType)
    }

    // Fall back to unique_code if equipment_type is null
    if (uniqueCode) {
        return getEquipmentGroupFromUniqueCode(uniqueCode)
    }

    // Default to COMMUNICATION for unknown types
    return 'COMMUNICATION'
}

export function getEquipmentGroupLabel(group: EquipmentGroup): string {
    const labels: Record<EquipmentGroup, string> = {
        'WEAPONS': 'Weapon Equipment',
        'COMMUNICATION': 'Communication Equipment',
        'NAVIGATIONAL': 'Navigational Equipment',
        'ICT': 'IT Equipment',
        'AMMUNITIONS': 'Ammunition',
    }
    return labels[group]
}

export function isNavigationalGroup(group: EquipmentGroup): boolean {
    return group === 'NAVIGATIONAL'
}

export function isAmmunitionsGroup(group: EquipmentGroup): boolean {
    return group === 'AMMUNITIONS'
}

export function isAmmunitionGroup(
    equipmentType?: string | null,
    uniqueCode?: string | null,
    equipmentName?: string | null
): boolean {
    const type = (equipmentType || '').toLowerCase()
    const code = (uniqueCode || '').toUpperCase()
    const name = (equipmentName || '').toUpperCase()
    return (
        type === 'ammunitions' ||
        type === 'ammunition' ||
        code === 'AM' ||
        code.startsWith('AM') ||
        name === 'AMMUNITIONS' ||
        name === 'AMMUNITION'
    )
}


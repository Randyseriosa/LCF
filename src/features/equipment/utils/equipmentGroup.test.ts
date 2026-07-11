import {
    getEquipmentGroupFromUniqueCode,
    getCategoryFromEquipmentType,
    isAmmunitionGroup
} from './equipmentGroup'

describe('Equipment Group Utilities', () => {
    describe('isAmmunitionGroup', () => {
        it('identifies ammunition by exact equipment_type "ammunitions"', () => {
            expect(isAmmunitionGroup('ammunitions', 'WE', 'Weapon')).toBe(true)
            expect(isAmmunitionGroup('Ammunition', 'WE', 'Weapon')).toBe(true)
        })

        it('identifies ammunition by unique_code startsWith "AM" or exact "AM"', () => {
            expect(isAmmunitionGroup('', 'AM', '')).toBe(true)
            expect(isAmmunitionGroup('', 'AM01-OLCF6-001', '')).toBe(true)
            expect(isAmmunitionGroup('', 'AM02', '')).toBe(true)
        })

        it('identifies ammunition by equipment name', () => {
            expect(isAmmunitionGroup('', '', 'Ammunition')).toBe(true)
            expect(isAmmunitionGroup('', '', 'AMMUNITIONS')).toBe(true)
        })

        it('returns false for non-ammunition types, codes, and names', () => {
            expect(isAmmunitionGroup('weapons', 'WE01', 'Rifle')).toBe(false)
            expect(isAmmunitionGroup('', 'CE01', 'Radio')).toBe(false)
            expect(isAmmunitionGroup('', '', 'Navigational Equipment')).toBe(false)
        })
    })

    describe('getEquipmentGroupFromUniqueCode', () => {
        it('correctly returns mapped categories from unique code prefix', () => {
            expect(getEquipmentGroupFromUniqueCode('WE01')).toBe('WEAPONS')
            expect(getEquipmentGroupFromUniqueCode('IE02')).toBe('ICT')
            expect(getEquipmentGroupFromUniqueCode('NE03')).toBe('NAVIGATIONAL')
            expect(getEquipmentGroupFromUniqueCode('AM04')).toBe('AMMUNITIONS')
            expect(getEquipmentGroupFromUniqueCode('CE05')).toBe('COMMUNICATION')
            expect(getEquipmentGroupFromUniqueCode('XX01')).toBe('COMMUNICATION') // default fallback
            expect(getEquipmentGroupFromUniqueCode()).toBe('COMMUNICATION') // default fallback
        })
    })

    describe('getCategoryFromEquipmentType', () => {
        it('correctly maps various equipment type string variants to EquipmentCategory', () => {
            expect(getCategoryFromEquipmentType('weapon')).toBe('WEAPONS')
            expect(getCategoryFromEquipmentType('we')).toBe('WEAPONS')
            expect(getCategoryFromEquipmentType('ICT')).toBe('ICT')
            expect(getCategoryFromEquipmentType('navigational')).toBe('NAVIGATIONAL')
            expect(getCategoryFromEquipmentType('ammunitions')).toBe('AMMUNITIONS')
            expect(getCategoryFromEquipmentType('ammo')).toBe('AMMUNITIONS')
            expect(getCategoryFromEquipmentType('communication')).toBe('COMMUNICATION')
        })

        it('falls back to unique_code prefix resolution when equipmentType is null', () => {
            expect(getCategoryFromEquipmentType(null, 'WE01')).toBe('WEAPONS')
            expect(getCategoryFromEquipmentType(null, 'AM01')).toBe('AMMUNITIONS')
        })
    })
})

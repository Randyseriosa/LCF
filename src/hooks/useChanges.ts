import { useState, useCallback } from 'react'

/**
 * Custom hook to track changes in an array of selected items
 * Compares current selection with initial selection to determine if changes exist
 */
export function useChanges<T>(initialValue: T[]) {
    const [currentValue, setCurrentValue] = useState<T[]>(initialValue)
    const [initialValueState, setInitialValueState] = useState<T[]>(initialValue)

    /**
     * Reset the initial state to match the current value
     * Useful when loading new data
     */
    const resetInitial = useCallback((newValue: T[]) => {
        setCurrentValue(newValue)
        setInitialValueState(newValue)
    }, [])

    /**
     * Check if there are any changes between current and initial values
     */
    const hasChanges = () => {
        if (currentValue.length !== initialValueState.length) {
            return true
        }
        const sortedCurrent = [...currentValue].sort()
        const sortedInitial = [...initialValueState].sort()
        return JSON.stringify(sortedCurrent) !== JSON.stringify(sortedInitial)
    }

    return {
        currentValue,
        setCurrentValue,
        hasChanges,
        resetInitial
    }
}

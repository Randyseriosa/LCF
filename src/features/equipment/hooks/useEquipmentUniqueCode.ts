import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuthUser, getValidAccessToken } from '@/lib/auth'

interface ValidationResult {
  valid: boolean
  unique: boolean
  message: string
}

interface ItemCodeResult {
  item_code: string
}

export function useEquipmentUniqueCode() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateUniqueCode = useCallback(async (uniqueCode: string, equipmentId?: string): Promise<ValidationResult> => {
    setLoading(true)
    setError(null)
    try {
      const user = await getAuthUser()
      if (!user) throw new Error('Not authenticated')

      const token = await getValidAccessToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-equipment-unique-code`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'validate',
          unique_code: uniqueCode,
          equipment_id: equipmentId
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Validation failed')

      return data.data
    } catch (err: any) {
      setError(err.message || 'Validation failed')
      throw err
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const generateItemCode = useCallback(async (equipmentUniqueCode: string): Promise<string> => {
    setLoading(true)
    setError(null)
    try {
      const user = await getAuthUser()
      if (!user) throw new Error('Not authenticated')

      const token = await getValidAccessToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-equipment-unique-code`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'generate-item-code',
          equipment_unique_code: equipmentUniqueCode
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate item code')

      return data.data.item_code
    } catch (err: any) {
      setError(err.message || 'Failed to generate item code')
      throw err
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const updateUniqueCode = useCallback(async (equipmentId: string, uniqueCode: string) => {
    setLoading(true)
    setError(null)
    try {
      const user = await getAuthUser()
      if (!user) throw new Error('Not authenticated')

      const token = await getValidAccessToken()
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-equipment-unique-code`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update-unique-code',
          equipment_id: equipmentId,
          unique_code: uniqueCode
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update unique code')

      return data.data
    } catch (err: any) {
      setError(err.message || 'Failed to update unique code')
      throw err
    } finally {
      setLoading(false)
    }
  }, [supabase])

  return {
    validateUniqueCode,
    generateItemCode,
    updateUniqueCode,
    loading,
    error
  }
}

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuthUser } from '@/lib/auth'

interface ValidationResult {
  valid: boolean
  unique?: boolean
  message?: string
}

export function useItemCode() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateItemCode = useCallback(async (equipmentId: string, vesselId: string): Promise<string> => {
    setLoading(true)
    setError(null)
    try {
      const user = await getAuthUser()
      if (!user) throw new Error('Not authenticated')

      const match = document.cookie.match(/(?:^|; )access_token=([^;]*)/)
      const token = match ? decodeURIComponent(match[1]) : null
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-item-code`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'generate-item-code',
          equipment_id: equipmentId,
          vessel_id: vesselId
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

  const validateItemCode = useCallback(async (itemCode: string): Promise<ValidationResult> => {
    setLoading(true)
    setError(null)
    try {
      const user = await getAuthUser()
      if (!user) throw new Error('Not authenticated')

      const match = document.cookie.match(/(?:^|; )access_token=([^;]*)/)
      const token = match ? decodeURIComponent(match[1]) : null
      if (!token) throw new Error('Not authenticated')

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-item-code`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'validate-item-code',
          item_code: itemCode,
          equipment_id: '', // Not required for validation
          vessel_id: '' // Not required for validation
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

  return {
    generateItemCode,
    validateItemCode,
    loading,
    error
  }
}

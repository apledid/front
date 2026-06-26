'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface UseUnsavedChangesOptions<T> {
  initialData: T
  onSave: (data: T) => Promise<void>
}

export function useUnsavedChanges<T extends Record<string, unknown>>({
  initialData,
  onSave,
}: UseUnsavedChangesOptions<T>) {
  const [data, setData] = useState<T>(initialData)
  const [originalData, setOriginalData] = useState<T>(initialData)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Track if data has changed from original
  useEffect(() => {
    const changed = JSON.stringify(data) !== JSON.stringify(originalData)
    setHasChanges(changed)
  }, [data, originalData])

  // Update a single field
  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setData((prev) => ({ ...prev, [field]: value }))
  }, [])

  // Update multiple fields at once
  const updateFields = useCallback((updates: Partial<T>) => {
    setData((prev) => ({ ...prev, ...updates }))
  }, [])

  // Save changes
  const save = useCallback(async () => {
    if (!hasChanges || saving) return
    
    setSaving(true)
    try {
      await onSave(data)
      setOriginalData(data)
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save:', error)
      throw error
    } finally {
      setSaving(false)
    }
  }, [data, hasChanges, saving, onSave])

  // Reset to original data
  const reset = useCallback(() => {
    setData(originalData)
    setHasChanges(false)
  }, [originalData])

  // Sync with new initial data (e.g., after refetch)
  const syncData = useCallback((newData: T) => {
    setData(newData)
    setOriginalData(newData)
    setHasChanges(false)
  }, [])

  return {
    data,
    hasChanges,
    saving,
    updateField,
    updateFields,
    save,
    reset,
    syncData,
  }
}

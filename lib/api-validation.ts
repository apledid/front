import { NextResponse } from 'next/server'
import { escapeHtml, sanitizeString, validateInput, isNumericOnly, isValidHexColor, safeJsonParse } from './security'

/**
 * Validation schema types
 */
export type ValidationRule = {
  type: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'username' | 'hex_color' | 'array' | 'object'
  required?: boolean
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  pattern?: RegExp
  sanitize?: boolean
  allowHtml?: boolean
}

export type ValidationSchema = Record<string, ValidationRule>

/**
 * Validates request body against a schema
 * Returns sanitized data or validation errors
 */
export function validateRequestBody<T extends Record<string, any>>(
  body: any,
  schema: ValidationSchema
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const sanitizedData: Record<string, any> = {}

  for (const [field, rules] of Object.entries(schema)) {
    const value = body?.[field]

    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors[field] = `${field} is required`
      continue
    }

    // Skip validation for optional empty fields
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue
    }

    // Type-specific validation
    switch (rules.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors[field] = `${field} must be a string`
          break
        }
        
        let strValue = value.trim()
        
        // Length checks
        if (rules.minLength && strValue.length < rules.minLength) {
          errors[field] = `${field} must be at least ${rules.minLength} characters`
          break
        }
        if (rules.maxLength && strValue.length > rules.maxLength) {
          errors[field] = `${field} must be at most ${rules.maxLength} characters`
          break
        }
        
        // Pattern check
        if (rules.pattern && !rules.pattern.test(strValue)) {
          errors[field] = `${field} format is invalid`
          break
        }
        
        // Sanitize unless explicitly allowing HTML
        if (rules.sanitize !== false && !rules.allowHtml) {
          strValue = sanitizeString(strValue)
        }
        
        sanitizedData[field] = strValue
        break

      case 'number':
        const numStr = String(value).trim()
        if (!isNumericOnly(numStr.replace(/^-/, '').replace('.', ''))) {
          errors[field] = `${field} must contain only numbers`
          break
        }
        
        const numValue = Number(value)
        if (isNaN(numValue)) {
          errors[field] = `${field} must be a valid number`
          break
        }
        
        if (rules.min !== undefined && numValue < rules.min) {
          errors[field] = `${field} must be at least ${rules.min}`
          break
        }
        if (rules.max !== undefined && numValue > rules.max) {
          errors[field] = `${field} must be at most ${rules.max}`
          break
        }
        
        sanitizedData[field] = numValue
        break

      case 'boolean':
        if (typeof value !== 'boolean') {
          errors[field] = `${field} must be true or false`
          break
        }
        sanitizedData[field] = value
        break

      case 'email':
        const emailResult = validateInput(String(value), 'email')
        if (!emailResult.valid) {
          errors[field] = emailResult.error || 'Invalid email'
          break
        }
        sanitizedData[field] = emailResult.sanitized
        break

      case 'url':
        const urlResult = validateInput(String(value), 'url')
        if (!urlResult.valid) {
          errors[field] = urlResult.error || 'Invalid URL'
          break
        }
        sanitizedData[field] = urlResult.sanitized
        break

      case 'username':
        const usernameResult = validateInput(String(value), 'username')
        if (!usernameResult.valid) {
          errors[field] = usernameResult.error || 'Invalid username'
          break
        }
        sanitizedData[field] = usernameResult.sanitized
        break

      case 'hex_color':
        if (!isValidHexColor(String(value))) {
          errors[field] = `${field} must be a valid hex color (e.g., #FF0000)`
          break
        }
        sanitizedData[field] = String(value).toUpperCase()
        break

      case 'array':
        if (!Array.isArray(value)) {
          errors[field] = `${field} must be an array`
          break
        }
        sanitizedData[field] = value
        break

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors[field] = `${field} must be an object`
          break
        }
        sanitizedData[field] = value
        break
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors }
  }

  return { success: true, data: sanitizedData as T }
}

/**
 * Creates a JSON response with proper content-type header
 * Ensures browser interprets response as JSON, not HTML
 */
export function jsonResponse(data: any, status: number = 200): NextResponse {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

/**
 * Creates an error response with proper content-type
 */
export function errorResponse(message: string, status: number = 400): NextResponse {
  return jsonResponse({ error: message }, status)
}

/**
 * Creates a validation error response
 */
export function validationErrorResponse(errors: Record<string, string>): NextResponse {
  return jsonResponse({ error: 'Validation failed', details: errors }, 400)
}

/**
 * Safely parse JSON request body
 */
export async function parseJsonBody<T>(request: Request): Promise<T | null> {
  try {
    const text = await request.text()
    return safeJsonParse<T>(text)
  } catch {
    return null
  }
}

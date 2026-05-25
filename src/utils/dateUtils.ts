/**
 * Parse date from various formats and return a Date object
 * @param dateInput - Date string, Date object, or Excel serial number
 * @returns Date object or null if invalid
 */
function parseDate(dateInput: string | Date | number | null | undefined): Date | null {
  if (!dateInput) return null

  // Handle empty string
  if (typeof dateInput === 'string' && dateInput.trim() === '') return null

  let date: Date

  // Handle Excel serial number (days since 1900-01-01)
  if (typeof dateInput === 'number') {
    // Validate Excel serial number range (reasonable bounds)
    if (dateInput < 1 || dateInput > 100000) return null
    
    // Excel dates start from 1900-01-01, but Excel incorrectly treats 1900 as a leap year
    // So we need to adjust by 1 day for dates after 1900-02-28
    const excelEpoch = new Date(1900, 0, 1)
    const daysToAdd = dateInput - 2 // Adjust for Excel's leap year bug
    date = new Date(excelEpoch.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
  } else if (typeof dateInput === 'string') {
    const trimmedInput = dateInput.trim()
    
    // Check if already in DD-MM-YYYY or MM/DD/YYYY format
    const ddmmyyyyMatch = trimmedInput.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
    if (ddmmyyyyMatch) {
      const [, firstPart, secondPart, yearStr] = ddmmyyyyMatch
      const firstNum = parseInt(firstPart, 10)
      const secondNum = parseInt(secondPart, 10)
      const year = parseInt(yearStr, 10)
      
      // Validate year range
      if (year < 1900 || year > 2100) return null
      
      // Determine if format is DD/MM/YYYY or MM/DD/YYYY
      // If first part > 12, it must be day (DD/MM/YYYY)
      // If second part > 12, it must be month (DD/MM/YYYY)
      // If both <= 12, assume MM/DD/YYYY (US format) as it's common in Excel
      let day: number, month: number
      
      if (firstNum > 12) {
        // First part must be day (DD/MM/YYYY)
        day = firstNum
        month = secondNum
      } else if (secondNum > 12) {
        // Second part must be month (DD/MM/YYYY)
        day = firstNum
        month = secondNum
      } else {
        // Both <= 12, assume MM/DD/YYYY (US Excel format)
        month = firstNum
        day = secondNum
      }
      
      // Validate ranges
      if (month < 1 || month > 12) return null
      if (day < 1 || day > 31) return null
      
      date = new Date(year, month - 1, day)
    } else {
      // Try standard Date parsing
      date = new Date(trimmedInput)
    }
  } else if (dateInput instanceof Date) {
    date = dateInput
  } else {
    return null
  }

  // Check if date is valid
  if (isNaN(date.getTime())) return null

  // Validate date ranges
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  if (year < 1900 || year > 2100) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null

  // Additional validation: check if the date matches what we expect
  // (prevents dates like February 30 from being accepted)
  const checkDate = new Date(year, month - 1, day)
  if (checkDate.getFullYear() !== year || 
      checkDate.getMonth() + 1 !== month || 
      checkDate.getDate() !== day) {
    return null
  }

  return date
}

/**
 * Format date to DD-MM-YYYY format (for display)
 * @param dateInput - Date string (ISO or DD-MM-YYYY), Date object, or Excel serial number
 * @returns Formatted date string in DD-MM-YYYY format, or null if invalid
 */
export function formatDateToDDMMYYYY(dateInput: string | Date | number | null | undefined): string | null {
  const date = parseDate(dateInput)
  if (!date) return null

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${day}-${month}-${year}`
}

/**
 * Format date to ISO format YYYY-MM-DD (for database storage)
 * @param dateInput - Date string (ISO or DD-MM-YYYY), Date object, or Excel serial number
 * @returns Formatted date string in YYYY-MM-DD format, or null if invalid
 */
export function formatDateToISO(dateInput: string | Date | number | null | undefined): string | null {
  const date = parseDate(dateInput)
  if (!date) return null

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

/**
 * Validate if a date string is in DD-MM-YYYY format
 */
export function isValidDDMMYYYY(dateString: string): boolean {
  const regex = /^(\d{2})-(\d{2})-(\d{4})$/
  const match = dateString.match(regex)
  
  if (!match) return false
  
  const [, dayStr, monthStr, yearStr] = match
  const day = parseInt(dayStr, 10)
  const month = parseInt(monthStr, 10)
  const year = parseInt(yearStr, 10)
  
  if (month < 1 || month > 12) return false
  if (day < 1 || day > 31) return false
  
  // Check valid date for the month
  const date = new Date(year, month - 1, day)
  return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year
}

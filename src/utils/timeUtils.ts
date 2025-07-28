/**
 * Time utility functions for consistent timestamp handling
 */

/**
 * Get current UTC timestamp
 * Always returns a proper Date object in UTC
 */
export function getCurrentTimestamp(): Date {
  return getActualCurrentTime();
}

/**
 * Ensure a date is valid and not in the future beyond reasonable limits
 * @param date - Date to validate
 * @param maxFutureDays - Maximum days in the future allowed (default: 1)
 * @returns Valid date or corrected time if invalid
 */
export function validateAndFixTimestamp(date: Date | string | null | undefined, maxFutureDays: number = 1): Date {
  if (!date) {
    return getActualCurrentTime();
  }

  let parsedDate: Date;
  
  try {
    parsedDate = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(parsedDate.getTime())) {
      console.warn('Invalid timestamp provided, using current time:', date);
      return getActualCurrentTime();
    }
    
    // Check for obviously wrong years only (way in the future should be corrected to current year)
    const year = parsedDate.getFullYear();
    const currentYear = getActualCurrentTime().getFullYear();
    if (year > currentYear + 1) {
      // Convert obviously future timestamp to current year
      const correctedDate = new Date(parsedDate);
      correctedDate.setFullYear(currentYear);
      console.warn(`Obviously future year detected (${year}), corrected to ${currentYear}. Original:`, parsedDate.toISOString(), 'Corrected:', correctedDate.toISOString());
      return correctedDate;
    }
    
    // If date is too far in the past (before 2020), use current time
    if (year < 2020) {
      console.warn('Very old timestamp detected, using current time. Original:', parsedDate.toISOString());
      return getActualCurrentTime();
    }
    
    // For reasonable years, check if it's too far in the future
    const actualNow = getActualCurrentTime();
    const maxFutureTime = new Date(actualNow.getTime() + (maxFutureDays * 24 * 60 * 60 * 1000));
    
    if (parsedDate > maxFutureTime) {
      console.warn('Timestamp too far in future, using current time. Original:', parsedDate.toISOString());
      return actualNow;
    }
    
    return parsedDate;
  } catch (error) {
    console.error('Error parsing timestamp:', error);
    return getActualCurrentTime();
  }
}

/**
 * Get actual current time - using system time as the source of truth
 */
function getActualCurrentTime(): Date {
  // Use system time as-is - let the system determine the correct year
  return new Date();
}

/**
 * Format date to ISO string safely
 */
export function toISOString(date: Date | string | null | undefined): string {
  const validDate = validateAndFixTimestamp(date);
  return validDate.toISOString();
}

/**
 * Parse timestamp from various formats
 */
export function parseTimestamp(timestamp: any): Date {
  if (!timestamp) return getCurrentTimestamp();
  
  if (timestamp instanceof Date) {
    return validateAndFixTimestamp(timestamp);
  }
  
  if (typeof timestamp === 'string') {
    return validateAndFixTimestamp(timestamp);
  }
  
  if (typeof timestamp === 'number') {
    // Handle Unix timestamps (both seconds and milliseconds)
    const date = timestamp < 10000000000 
      ? new Date(timestamp * 1000) 
      : new Date(timestamp);
    return validateAndFixTimestamp(date);
  }
  
  return getCurrentTimestamp();
}

/**
 * Create timestamp for database operations
 */
export function createDbTimestamp(): Date {
  return getCurrentTimestamp();
}

/**
 * Update timestamp for database operations
 */
export function updateDbTimestamp(): Date {
  return getCurrentTimestamp();
}

/**
 * Check if system time is reasonable
 */
export function validateSystemTime(): { isValid: boolean; message: string } {
  const now = new Date();
  const year = now.getFullYear();
  
  if (year < 2020 || year > 2030) {
    return {
      isValid: false,
      message: `System time appears unusual. Current year: ${year}. Please check system clock.`
    };
  }
  
  return {
    isValid: true,
    message: 'System time appears correct'
  };
}

/**
 * Log timestamp validation warning
 */
export function logTimestampWarning(context: string, originalTime: any, fixedTime: Date) {
  console.warn(`[TIMESTAMP WARNING] ${context}:`, {
    original: originalTime,
    fixed: fixedTime.toISOString(),
    timestamp: Date.now()
  });
}
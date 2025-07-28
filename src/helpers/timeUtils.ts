import { performance } from 'perf_hooks';

/**
 * Utility functions for handling time and timestamps
 */

/**
 * Get current UTC timestamp
 */
export const getCurrentUTCTimestamp = (): Date => {
  return new Date();
};

/**
 * Get current server time info for debugging
 */
export const getServerTimeInfo = () => {
  const now = new Date();
  return {
    utc: now.toISOString(),
    local: now.toString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    offset: now.getTimezoneOffset(),
    timestamp: now.getTime(),
    performanceNow: performance.now(),
  };
};

/**
 * Convert any date to UTC
 */
export const toUTC = (date: Date | string): Date => {
  if (typeof date === 'string') {
    return new Date(date);
  }
  return date;
};

/**
 * Validate if a date is reasonable (not too far in future or past)
 */
export const isValidTimestamp = (date: Date): boolean => {
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
  
  return date >= oneYearAgo && date <= oneYearFromNow;
};

/**
 * Log time information for debugging
 */
export const logTimeInfo = (context: string) => {
  const timeInfo = getServerTimeInfo();
  console.log(`⏰ Time info [${context}]:`, {
    utc: timeInfo.utc,
    timezone: timeInfo.timezone,
    offset: timeInfo.offset,
  });
};

/**
 * Create a timestamp with validation
 */
export const createValidatedTimestamp = (): Date => {
  const timestamp = getCurrentUTCTimestamp();
  
  if (!isValidTimestamp(timestamp)) {
    console.warn('⚠️ Invalid timestamp detected, using fallback');
    // Log the time info for debugging
    logTimeInfo('createValidatedTimestamp');
  }
  
  return timestamp;
};
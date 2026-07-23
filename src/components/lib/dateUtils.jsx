/**
 * Utility functions for handling dates in Brazil timezone (America/Sao_Paulo)
 * Prevents timezone conversion issues when working with date inputs
 */

/**
 * Converts a date string (YYYY-MM-DD) to ISO format in Brazil timezone
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} ISO string in Brazil timezone
 */
export function toLocalISOString(dateString) {
  if (!dateString) return '';
  
  // Parse the date string as local date (no timezone conversion)
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0); // Use noon to avoid DST issues
  
  return date.toISOString();
}

/**
 * Converts an ISO date string to local date string (YYYY-MM-DD) in Brazil timezone
 * @param {string} isoString - ISO date string
 * @returns {string} Date in YYYY-MM-DD format
 */
export function toLocalDateString(isoString) {
  if (!isoString) return '';
  
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Gets today's date in Brazil timezone as YYYY-MM-DD
 * @returns {string} Today's date in YYYY-MM-DD format
 */
export function getTodayBrazil() {
  // Create date in Brazil timezone
  const now = new Date();
  const brazilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  
  const year = brazilTime.getFullYear();
  const month = String(brazilTime.getMonth() + 1).padStart(2, '0');
  const day = String(brazilTime.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Format date for display in Brazilian format (DD/MM/YYYY)
 * @param {string} dateString - Date in YYYY-MM-DD or ISO format
 * @returns {string} Date in DD/MM/YYYY format
 */
export function formatDateBR(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}
import { GeoPoint } from '../types';

/**
 * Calculates the great-circle distance between two points on the earth's surface
 * using the Haversine formula.
 * @returns distance in meters
 */
export function calculateDistanceMeters(
  point1: GeoPoint,
  point2: GeoPoint
): number {
  const R = 6371000; // Radius of the Earth in meters
  const lat1Rad = (point1.latitude * Math.PI) / 180;
  const lat2Rad = (point2.latitude * Math.PI) / 180;
  const deltaLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const deltaLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // 1 decimal place
}

/**
 * Check if the user's coordinates fall within the shop's allowed radius
 */
export function isWithinShopRadius(
  userCoords: GeoPoint,
  shopCoords: GeoPoint,
  allowedRadiusMeters: number
): { inside: boolean; distanceMeters: number } {
  const distanceMeters = calculateDistanceMeters(userCoords, shopCoords);
  return {
    inside: distanceMeters <= allowedRadiusMeters,
    distanceMeters,
  };
}

/**
 * Parses time string like "10:00" or "09:00 PM" into minutes from midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().toUpperCase();
  const isPM = clean.includes('PM');
  const isAM = clean.includes('AM');
  const parts = clean.replace(/(AM|PM)/g, '').trim().split(':');
  let hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

/**
 * Validates whether current time is permitted for Punch In or Punch Out
 * Rule per PDF:
 * - Punch In option will activate only when the shop opening time starts
 * - Punch Out option will activate only until the shop closing time
 * - Attendance actions will be disabled outside working hours
 */
export function checkBusinessHours(
  openingTimeStr: string, // e.g. "10:00"
  closingTimeStr: string, // e.g. "21:00"
  testDate: Date = new Date()
): {
  isWithinHours: boolean;
  canPunchIn: boolean;
  canPunchOut: boolean;
  currentMinutes: number;
  openMinutes: number;
  closeMinutes: number;
  message: string;
} {
  const currentMinutes = testDate.getHours() * 60 + testDate.getMinutes();
  const openMinutes = parseTimeToMinutes(openingTimeStr);
  const closeMinutes = parseTimeToMinutes(closingTimeStr);

  const isBeforeOpen = currentMinutes < openMinutes;
  const isAfterClose = currentMinutes > closeMinutes;

  if (isBeforeOpen) {
    return {
      isWithinHours: false,
      canPunchIn: false,
      canPunchOut: false,
      currentMinutes,
      openMinutes,
      closeMinutes,
      message: `Punch In is disabled before opening time (${openingTimeStr}).`,
    };
  }

  if (isAfterClose) {
    return {
      isWithinHours: false,
      canPunchIn: false,
      canPunchOut: false,
      currentMinutes,
      openMinutes,
      closeMinutes,
      message: `Punch Out is disabled after closing time (${closingTimeStr}).`,
    };
  }

  return {
    isWithinHours: true,
    canPunchIn: true,
    canPunchOut: true,
    currentMinutes,
    openMinutes,
    closeMinutes,
    message: 'Within official business hours.',
  };
}

/**
 * Checks if punch in time is considered late (e.g. > 15 minutes after opening)
 */
export function isPunchInLate(
  punchInTimeStr: string,
  openingTimeStr: string,
  graceMinutes: number = 15
): boolean {
  const punchMinutes = parseTimeToMinutes(punchInTimeStr);
  const openMinutes = parseTimeToMinutes(openingTimeStr);
  return punchMinutes > openMinutes + graceMinutes;
}

/**
 * Checks if punch out is an early exit (e.g. > 30 minutes before closing)
 */
export function isEarlyExit(
  punchOutTimeStr: string,
  closingTimeStr: string,
  thresholdMinutes: number = 30
): boolean {
  const punchMinutes = parseTimeToMinutes(punchOutTimeStr);
  const closeMinutes = parseTimeToMinutes(closingTimeStr);
  return punchMinutes < closeMinutes - thresholdMinutes;
}

/**
 * Calculates total working hours between punch in and punch out
 */
export function calculateWorkingHours(
  punchInTimeStr: string,
  punchOutTimeStr: string
): number {
  const inMins = parseTimeToMinutes(punchInTimeStr);
  const outMins = parseTimeToMinutes(punchOutTimeStr);
  if (outMins <= inMins) return 0;
  const diffHours = (outMins - inMins) / 60;
  return Math.round(diffHours * 10) / 10;
}

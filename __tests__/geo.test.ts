import {
  calculateDistanceMeters,
  isWithinShopRadius,
  checkBusinessHours,
  isPunchInLate,
  calculateWorkingHours,
} from '../src/utils/geo';

describe('Geo-Fencing & Business Hours Logic', () => {
  const shopLocation = { latitude: 21.1702, longitude: 72.8311 };

  test('calculates accurate distance in meters between two GPS coordinates', () => {
    // Exactly at shop location
    const exactDistance = calculateDistanceMeters(shopLocation, shopLocation);
    expect(exactDistance).toBe(0);

    // Coordinate slightly offset (~20-25 meters)
    const nearbyLocation = { latitude: 21.17038, longitude: 72.8311 };
    const distance = calculateDistanceMeters(shopLocation, nearbyLocation);
    expect(distance).toBeGreaterThan(15);
    expect(distance).toBeLessThan(30);
  });

  test('validates radius check (30 meters rule)', () => {
    // 15 meters away
    const inside = isWithinShopRadius(
      { latitude: 21.1703, longitude: 72.8311 },
      shopLocation,
      30
    );
    expect(inside.inside).toBe(true);

    // 500 meters away
    const outside = isWithinShopRadius(
      { latitude: 21.175, longitude: 72.835 },
      shopLocation,
      30
    );
    expect(outside.inside).toBe(false);
  });

  test('validates business hours punch restrictions', () => {
    // 09:30 AM (before 10:00 AM opening)
    const earlyMorning = new Date();
    earlyMorning.setHours(9, 30, 0, 0);
    const beforeOpenCheck = checkBusinessHours('10:00', '21:00', earlyMorning);
    expect(beforeOpenCheck.canPunchIn).toBe(false);
    expect(beforeOpenCheck.isWithinHours).toBe(false);

    // 02:00 PM (during business hours)
    const midday = new Date();
    midday.setHours(14, 0, 0, 0);
    const middayCheck = checkBusinessHours('10:00', '21:00', midday);
    expect(middayCheck.canPunchIn).toBe(true);
    expect(middayCheck.canPunchOut).toBe(true);
    expect(middayCheck.isWithinHours).toBe(true);

    // 10:00 PM (after 09:00 PM closing)
    const lateNight = new Date();
    lateNight.setHours(22, 0, 0, 0);
    const afterCloseCheck = checkBusinessHours('10:00', '21:00', lateNight);
    expect(afterCloseCheck.canPunchOut).toBe(false);
    expect(afterCloseCheck.isWithinHours).toBe(false);
  });

  test('tracks late arrival and working hours', () => {
    // 10:10 AM is on-time (within 15m grace)
    expect(isPunchInLate('10:10', '10:00', 15)).toBe(false);

    // 10:30 AM is late
    expect(isPunchInLate('10:30', '10:00', 15)).toBe(true);

    // Worked from 10:00 to 19:30 = 9.5 hours
    const hours = calculateWorkingHours('10:00', '19:30');
    expect(hours).toBe(9.5);
  });
});

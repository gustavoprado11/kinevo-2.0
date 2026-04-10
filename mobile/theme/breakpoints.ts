export const breakpoints = {
  phone: 0,
  tablet: 768,
  tabletLarge: 1024,
} as const;

export type DeviceType = 'phone' | 'tablet';

export function getDeviceType(width: number): DeviceType {
  return width >= breakpoints.tablet ? 'tablet' : 'phone';
}

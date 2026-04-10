import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';
import { computeResponsiveInfo } from './responsive-utils';

export type { ResponsiveInfo } from './responsive-utils';
export { computeResponsiveInfo } from './responsive-utils';

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  return useMemo(() => computeResponsiveInfo(width, height), [width, height]);
}

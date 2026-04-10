export interface ResponsiveInfo {
  isTablet: boolean;
  isPhone: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
  width: number;
  height: number;
  columns: 1 | 2 | 3;
  contentMaxWidth: number;
  sidebarWidth: number;
  fontScale: number;
  spacingScale: number;
}

/**
 * Pure function that computes responsive info from screen dimensions.
 * Used by useResponsive hook and directly in tests.
 */
export function computeResponsiveInfo(width: number, height: number): ResponsiveInfo {
  const isTablet = width >= 768;
  const isLandscape = width > height;
  return {
    isTablet,
    isPhone: !isTablet,
    isLandscape,
    isPortrait: !isLandscape,
    width,
    height,
    columns: isTablet ? (isLandscape ? 3 : 2) : 1,
    contentMaxWidth: isTablet ? 1200 : width,
    sidebarWidth: isTablet ? (isLandscape ? 320 : 280) : 0,
    fontScale: isTablet ? 1.15 : 1.0,
    spacingScale: isTablet ? 1.25 : 1.0,
  };
}

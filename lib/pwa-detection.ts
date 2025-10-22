/**
 * PWA detection utilities
 * Detects if app is running in standalone/installed mode
 */

/**
 * Check if app is running in standalone PWA mode
 * Works for iOS, Android, and desktop PWAs
 */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;

  // iOS Safari standalone mode
  const isIOSStandalone = (window.navigator as { standalone?: boolean }).standalone === true;

  // Standard PWA display mode (works on Android, desktop)
  const isDisplayStandalone = window.matchMedia('(display-mode: standalone)').matches;

  // Alternative check for display mode
  const isDisplayMinimalUI = window.matchMedia('(display-mode: minimal-ui)').matches;

  return isIOSStandalone || isDisplayStandalone || isDisplayMinimalUI;
}

/**
 * Check if popups are likely to work
 * Returns false in standalone PWA mode
 */
export function canUsePopups(): boolean {
  return !isStandalonePWA();
}

/**
 * Get platform information for debugging
 */
export function getPlatformInfo() {
  if (typeof window === 'undefined') {
    return { platform: 'server', standalone: false };
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  const isMobile = isIOS || isAndroid;

  return {
    platform: isIOS ? 'ios' : isAndroid ? 'android' : 'desktop',
    standalone: isStandalonePWA(),
    mobile: isMobile,
    canUsePopups: canUsePopups(),
  };
}

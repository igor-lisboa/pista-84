/** Read optional wrapper capabilities without trusting unknown global data. */
export function isNativeApp(): boolean {
  if (!('Capacitor' in window)) return false;
  const runtime: unknown = window.Capacitor;
  return !!runtime && typeof runtime === 'object' && 'isNativePlatform' in runtime &&
    typeof runtime.isNativePlatform === 'function' && runtime.isNativePlatform() === true;
}

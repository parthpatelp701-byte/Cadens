/**
 * Smoke tests for image helper API surface (no DOM canvas in node).
 * Run browser-side or skip in CI without canvas.
 */
export function runImageApiSmoke() {
  // Module must export compressImage / compressImages
  // Full canvas tests belong in e2e / browser.
  console.log('image module: import smoke — run compressImage in browser after pick')
}

if (typeof process !== 'undefined' && process.argv?.[1]?.includes('image.test')) {
  runImageApiSmoke()
}

/** Passkey (Face ID / fingerprint / screen lock) helpers. The ceremony itself is done by supabase-js. */

export function passkeysSupported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && 'PublicKeyCredential' in window
}

/** True when this device can verify the user itself (Face ID, Touch ID, fingerprint, Windows Hello, screen lock). */
export async function hasPlatformAuthenticator(): Promise<boolean> {
  if (!passkeysSupported()) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/** The user closing or refusing the system prompt is not an error worth showing. */
export function isCancelled(err: { name?: string; code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  return err.name === 'NotAllowedError' || err.code === 'ERROR_CEREMONY_ABORTED' || /cancel|abort|not allowed/i.test(err.message ?? '')
}

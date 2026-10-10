/** Account setup flow: which steps exist, which ones block, and what is still to do afterwards. */

export type StepId = 'profile' | 'access' | 'address' | 'mfa' | 'kyc' | 'done'

export interface StepDef {
  id: StepId
  required: boolean
}

export const STEPS: StepDef[] = [
  { id: 'profile', required: true },
  { id: 'access', required: false },
  { id: 'address', required: false },
  { id: 'mfa', required: false },
  { id: 'kyc', required: false },
  { id: 'done', required: false },
]

/** Phone as typed by the user (without the +509 prefix): at least 8 digits. */
export function validPhone(raw: string): boolean {
  return raw.replace(/\D/g, '').length >= 8
}

export function validName(raw: string): boolean {
  return raw.trim().length >= 2
}

export interface SetupState {
  profile: boolean
  notifications: boolean
  notificationsUnsupported: boolean
  passkey: boolean
  camera: boolean
  installed: boolean
  address: boolean
  mfa: boolean
  kyc: boolean
}

/** Can the user leave this step with "Continue"? Required steps block until satisfied. */
export function canContinue(step: StepId, s: SetupState): boolean {
  if (step === 'profile') return s.profile
  return true
}

/** Optional items the user did not do: stored on the profile so a reminder can be shown later. */
export function skippedItems(s: SetupState): string[] {
  const out: string[] = []
  if (!s.notifications && !s.notificationsUnsupported) out.push('notifications')
  if (!s.address) out.push('address')
  if (!s.passkey) out.push('passkey')
  if (!s.camera) out.push('camera')
  if (!s.installed) out.push('install')
  if (!s.mfa) out.push('mfa')
  if (!s.kyc) out.push('kyc')
  return out
}

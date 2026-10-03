// English translations. Keys are the French source strings used with tr(); one file per area.
import { PUBLIC_EN } from './en/public.ts'
import { CLIENT_EN } from './en/client.ts'
import { ADMIN_EN } from './en/admin.ts'
import { WALLET_EN } from './en/wallet.ts'
import { SERVER_EN } from './en/server.ts'
import { DATA_EN } from './en/data.ts'
import { SECURITY_EN } from './en/security.ts'
import { FEATURES_EN } from './en/features.ts'

export const EN: Record<string, string> = {
  ...PUBLIC_EN,
  ...CLIENT_EN,
  ...ADMIN_EN,
  ...WALLET_EN,
  ...SERVER_EN,
  ...DATA_EN,
  ...SECURITY_EN,
  ...FEATURES_EN,
}

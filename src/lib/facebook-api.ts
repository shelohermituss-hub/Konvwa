import { supabase } from '@/lib/supabase'
import { tr } from '@/lib/i18n'

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('facebook-post', { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const res = ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) as { error?: string } | null : null
    throw new Error(res?.error || tr('Erreur réseau'))
  }
  if (data?.error) throw new Error(String(data.error))
  return data as T
}

export type SocialTarget = 'facebook' | 'instagram'

export interface SocialPost {
  /** Facebook post (absent when Facebook was not asked for or failed). */
  post_id?: string
  url?: string
  caption: string
  instagram?: { id: string; url: string | null }
  /** What went wrong on a network that failed while the other one worked. */
  errors: { facebook?: string; instagram?: string }
}

/** Posts a product on the Facebook Page and/or Instagram (`images` = our own public picture addresses, the visual card first). The server writes the caption from the product's data. */
export const postProductToSocial = (productId: string, images: string[], targets: SocialTarget[]) => call<SocialPost>({ product_id: productId, images, targets })

export const deleteFacebookPost = (postId: string) => call<{ deleted: true }>({ action: 'delete', post_id: postId })

/** Copies supplier pictures (Amazon, Alibaba…) into KONVWA's storage; the result keeps the order, `null` for a picture that could not be copied. */
export const mirrorImages = async (urls: string[]) => (await call<{ urls: Array<string | null> }>({ action: 'mirror', urls })).urls

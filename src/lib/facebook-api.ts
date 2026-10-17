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

export interface FacebookPost { post_id: string; url: string; caption: string; photos: number; ai: boolean }

/** Posts a product on the Facebook Page (`images` = our own public picture addresses, the visual card first). The server writes the caption from the product's data. */
export const postProductToFacebook = (productId: string, images: string[]) => call<FacebookPost>({ product_id: productId, images })

export const deleteFacebookPost = (postId: string) => call<{ deleted: true }>({ action: 'delete', post_id: postId })

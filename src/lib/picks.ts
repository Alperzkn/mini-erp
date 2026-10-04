import type { Product, ProductLicense } from './types'

/** One thing to put on a sale: a plain product, or one license of a licensed product. */
export interface PickedItem {
  product: Product
  license?: ProductLicense
}

export function pickKey(p: PickedItem): string {
  return p.license ? `${p.product.id}:${p.license.id}` : p.product.id
}

export function pickLabel(p: PickedItem): string {
  return p.license ? `${p.product.name} · ${p.license.name}` : p.product.name
}

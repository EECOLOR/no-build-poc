import { context } from '#cms/client/context.js'

/**
 * @arg {string} filename
 * @arg {{
 *   width: number, height: number,
 *   crop?: { x:number, y: number, width: number, height: number },
 *   hotspot?: { x:number, y: number, width: number, height: number },
 * }} metadata
 */
export function createImageSrc(filename, { width, height, crop, hotspot }) {
  const src = context.api.images.single({ filename })
  const params = new URLSearchParams({
    w: String(width), h: String(height),
    ...(crop && { crop: [crop.x, crop.y, crop.width, crop.height].join(',') }),
    ...(hotspot && { hotspot: [hotspot.x, hotspot.y, hotspot.width, hotspot.height].join(',') }),
  })
  return `${src}?${params.toString()}`
}

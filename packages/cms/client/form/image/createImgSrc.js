import { context } from '#cms/client/context.js'

/**
 * @param {string} filename
 * @param {{ width, height, crop?, hotspot? }} metadata
 */
export function createImageSrc(filename, { width, height, crop, hotspot }) {
  const src = `${context.apiPath}/images/${filename}`
  const params = new URLSearchParams({
    w: String(width), h: String(height),
    ...(crop && { crop: [crop.x, crop.y, crop.width, crop.height].join(',') }),
    ...(hotspot && { hotspot: [hotspot.x, hotspot.y, hotspot.width, hotspot.height].join(',') }),
  })
  return `${src}?${params.toString()}`
}

import { createMetadataHandler } from './images/metadata.js'
import { withRequestBufferBody } from './machinery/request.js'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { notFound, respondJson, sendImage } from './machinery/response.js'

/** @import { DeepReadonly } from '#typescript/utils.ts' */

/** @typedef {DeepReadonly<ReturnType<typeof createImagesHandler>>} ImagesHandler */

/** @param {{ imagesPath: string, databaseActions: import('./database.js').Actions }} params */
export function createImagesHandler({ imagesPath, databaseActions }) {

  const metadataHandler = createMetadataHandler({ databaseActions })

  const {
    imagesEventStream,

    insertImage,
  } = databaseActions.images

  return {
    metadata: metadataHandler,
    imagesEventStream,
    handleGetImage,
    handlePostImage,
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  function handlePostImage(req, res, { searchParams }) {
    withRequestBufferBody(req, (buffer, e) => {
      // TODO: error handling
      // TODO: scan for virus
      writeFile(buffer, imagesPath)
        .then(({ filename, width, height }) => {
          const metadata = {
            width,
            height,
            originalFilename: searchParams.name
          }

          const fileInfo = { filename, metadata }
          insertImage(fileInfo)

          respondJson(res, 200, { filename, metadata })
        })
        .catch(e => {
          // TODO: error handling
          console.error(e)
          res.end()
        })
    })
  }

  // TODO: move this method to a separate package (front-end should be able to use it without a dependency on the CMS)
  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   * @param {{ filename: string, searchParams: URLSearchParams }} options
   */
  function handleGetImage(req, res, { filename, searchParams }) {
    const imagePath = path.join(imagesPath, filename)
    if (!fs.existsSync(imagePath))
      return notFound(res)

    const image = fs.readFileSync(imagePath)

    // TODO: ETag
    const entries = Array.from(searchParams.entries())
    if (!entries.length)
      return sendImage(res, image)

    const params = Object.fromEntries(entries)

    handleModifiedImage(image, params)
      .then(x => sendImage(res, x.data))
      .catch(e => {
        // TODO: error responses
        console.error(e)
      })

    return true
  }
}

async function writeFile(buffer, imagesPath) {
  const $image = sharp(buffer)
  const { width, height } = await $image.metadata()
  const filename = `${crypto.randomUUID()}-${width}x${height}.webp`

  const webpBuffer = await $image.webp().toBuffer()
  await fs.promises.writeFile(path.join(imagesPath, filename), webpBuffer)

  return { filename, width, height }
}

async function handleModifiedImage(image, params) {
  if (!params.w || !params.h)
    throw new Error(`Expected w and h params`)

  const $image = sharp(image)
  const metadata = await $image.metadata()

  const width = parseInt(params.w, 10) || metadata.width
  const height = parseInt(params.h, 10) || metadata.height
  const crop = params.crop
    ? rectangleFromArray(params.crop?.split(','))
    : { x: 0, y: 0, width: metadata.width, height: metadata.height }
  const hotspot = params.hotspot
    ? rectangleFromArray(params.hotspot.split(','))
    : crop
  const region = determineImageRegion(crop, hotspot, width / height)

  return $image
    .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
    .resize({ width, height })
    .toBuffer({ resolveWithObject: true })
}

function rectangleFromArray(array) {
  const [x, y, width, height] = array.map(x => parseInt(x, 10))
  return { x, y, width, height }
}

function determineImageRegion(crop, hotspot, desiredRatio) {
  const cropCenterX = crop.x + crop.width / 2
  const cropCenterY = crop.y + crop.height / 2

  let width, height
  if (crop.width / crop.height > desiredRatio) {
    height = crop.height
    width = height * desiredRatio
  } else {
    width = crop.width
    height = width / desiredRatio
  }

  const hotspotRight = hotspot.x + hotspot.width
  const hotspotBottom = hotspot.y + hotspot.height

  let x = cropCenterX - width / 2
  let y = cropCenterY - height / 2
  if (hotspot.x < x) {
      x = Math.max(crop.x, hotspot.x)
  } else if (hotspotRight > x + width) {
      x = Math.min(crop.x + crop.width - width, hotspotRight - width)
  }
  if (hotspot.y < y) {
      y = Math.max(crop.y, hotspot.y)
  } else if (hotspotBottom > y + height) {
      y = Math.min(crop.y + crop.height - height, hotspotBottom - height)
  }

  x = clamp(crop.x, crop.x + crop.width - width, x)
  y = clamp(crop.y, crop.y + crop.height - height, y)

  return rectangleFromArray([x, y, width, height].map(n => Math.round(n)))

  function clamp(min, max, value) {
      return Math.max(min, Math.min(max, value))
  }
}

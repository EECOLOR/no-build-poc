import { withRequestJsonBody } from '../machinery/request.js'
import { respondJson } from '../machinery/response.js'

/** @param {{ databaseActions: import('../database.js').Actions }} params */
export function createMetadataHandler({ databaseActions }) {

  const {
    metadataEventStream,

    updateImageMetadataByFilename,
    getImageMetadataByFilename,
  } = databaseActions.images

  return {
    handleRequest,
    canHandleRequest(method, pathSegments) {
      const [filename, feature] = pathSegments

      return (
        (feature === 'metadata' && filename && method === 'GET') ||
        (feature === 'metadata' && filename && method === 'PATCH')
      )
    }
  }

  function handleRequest(req, res, pathSegments, searchParams) {
    const { method } = req
    const [filename, feature] = pathSegments

    if (feature === 'metadata' && filename && method === 'GET')
      handleGetImageMetadata(req, res, { filename })
    else if (feature === 'metadata' && filename && method === 'PATCH')
      handlePatchImageMtadata(req, res, { filename })
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  function handleGetImageMetadata(req, res, { filename }) {
    metadataEventStream.subscribe(res, [filename])
  }

  function handlePatchImageMtadata(req, res, { filename }) {
    withRequestJsonBody(req, (body, error) => {
      // TODO: error handling
      // TODO: history
      const existingMetadata = getImageMetadataByFilename({ filename })
      const metadata = Object.assign(existingMetadata, body)

      updateImageMetadataByFilename({ filename, metadata })

      respondJson(res, 200, { success: true })
    })
  }
}

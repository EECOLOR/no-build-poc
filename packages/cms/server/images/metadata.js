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
        (feature === 'metadata' && filename && ['GET', 'HEAD'].includes(method)) ||
        (feature === 'metadata' && filename && method === 'PATCH')
      )
    }
  }

  function handleRequest(req, res, pathSegments, searchParams) {
    const { method, headers } = req
    const [filename, feature] = pathSegments
    const connectId = headers['x-connect-id']

    if (feature === 'metadata' && filename && method === 'HEAD')
      metadataEventStream.subscribe(connectId, ['images', filename, 'metadata'])
    if (feature === 'metadata' && filename && method === 'DELETE')
      metadataEventStream.unsubscribe(connectId, ['images', filename, 'metadata'])
    else if (feature === 'metadata' && filename && method === 'PATCH')
      handlePatchImageMtadata(req, res, { filename })
  }

  /**
   * @param {import('node:http').IncomingMessage} req
   * @param {import('node:http').ServerResponse} res
   */
  function handleGetImageMetadata(req, res, { filename }) {

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

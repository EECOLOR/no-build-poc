import { withRequestJsonBody } from '../machinery/request.js'
import { handleSubscription, respondJson } from '../machinery/response.js'

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
      const [filename, feature, subscription] = pathSegments

      return (
        (feature === 'metadata' && filename && subscription === 'subscription' && ['GET', 'HEAD'].includes(method)) ||
        (feature === 'metadata' && filename && method === 'PATCH')
      )
    }
  }

  function handleRequest(req, res, pathSegments, searchParams, connectId) {
    const { method } = req
    const [filename, feature, subscription] = pathSegments

    if (feature === 'metadata' && filename && subscription === 'subscription')
      handleSubscription(res, metadataEventStream, method, connectId, [filename])
    else if (feature === 'metadata' && filename && method === 'PATCH')
      handlePatchImageMtadata(req, res, { filename })
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

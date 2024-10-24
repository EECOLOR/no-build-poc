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
      const [filename, feature, subscription] = pathSegments

      return (
        (feature === 'metadata' && filename && subscription === 'subscription' && ['GET', 'HEAD'].includes(method)) ||
        (feature === 'metadata' && filename && method === 'PATCH')
      )
    }
  }

  function handleRequest(req, res, pathSegments, searchParams) {
    const { method, headers } = req
    const [filename, feature, subscription] = pathSegments
    const connectId = headers['x-connect-id']

    if (feature === 'metadata' && filename && subscription === 'subscription')
      ok(res, handleSubscription(metadataEventStream, method, connectId, [filename]))
    else if (feature === 'metadata' && filename && method === 'PATCH')
      handlePatchImageMtadata(req, res, { filename })
  }

  function handleSubscription(eventStreams, method, connectId, args) {
    if (method === 'HEAD')
      eventStreams.subscribe(connectId, args)
    else if (method === 'DELETE')
      eventStreams.unsubscribe(connectId, args)
  }

  function ok(res, _) {
    res.writeHead(204, { 'Content-Length': 0, 'Connection': 'close' })
    res.end()
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

import { handleSubscribe, handleUnsubscribe } from '../machinery/eventStreams.js'
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
    handlePatchImageMetadata,
    handleSubscribe(req, res, { filename }) {
      handleSubscribe(req, res, metadataEventStream, [filename])
    },
    handleUnsubscribe(req, res, { filename }) {
      handleUnsubscribe(req, res, metadataEventStream, [filename])
    }
  }

  function handlePatchImageMetadata(req, res, { filename }) {
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

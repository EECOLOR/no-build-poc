import { createCustomEventStreamCollection } from '../machinery/eventStreams.js'
import { withRequestJsonBody } from '../machinery/request.js'
import { internalServerError, notAuthorized, respondJson } from '../machinery/response.js'
import { getAt } from './utils.js'

/**
 * @param {{
 *   databaseActions: import('../database.js').Actions
 *   streams: import('../machinery/eventStreams.js').Streams
 *   patchDocument: import('../documents.js').PatchDocument
 * }} params
 */
export function createRichTextHandler({ databaseActions, streams, patchDocument }) {

  const { getDocumentById } = databaseActions.documents

  const eventStreamCollection = createCustomEventStreamCollection({
    channel: `document/rich-text`,
    createInitialValue(type, id, encodedFieldPath) {
      const fieldPath = decodeURIComponent(encodedFieldPath)
      return {
        value: getAt(getDocumentById({ id }), fieldPath),
        version: 0,
      }
    },
    subscribeEvent: 'initialValue',
    notifyEvent: 'steps',
    getSubscribeData(value, args) { return value },
    streams,
  })

  return {
    handlePostRichText,
    eventStreamCollection,
  }

  /** @param {import('node:http').ServerResponse} res */
  function handlePostRichText(req, res, { type, id, encodedFieldPath, auth }) {
    const fieldPath = decodeURIComponent(encodedFieldPath)
    withRequestJsonBody(req, (body, error) => {
      // TODO: error handling
      if (error) {
        console.error(error)
        return internalServerError(res)
      }

      const { clientId, steps, documentVersion, value, valueVersion, fieldType } = body

      if (clientId !== auth.user.id)
        return notAuthorized(res)

      const stored = eventStreamCollection.getValue(type, id, encodedFieldPath)
      if (stored.version !== valueVersion)
        return respondJson(res, 400, { success: false, reason: 'Version mismatch' })

      stored.value = value
      stored.version += steps.length

      const patch = { op: 'replace', path: fieldPath, value }
      const result = patchDocument({
        clientId, type, id, version: documentVersion, fieldType,
        patch, steps
      })

      if (!result.success)
        return respondJson(res, 400, result)

      eventStreamCollection.notify(
        { steps, clientIds: steps.map(_ => clientId) },
        [type, id, encodedFieldPath]
      )
      respondJson(res, 200, result)
    })
  }
}

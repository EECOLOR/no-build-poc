import { createCustomEventStreamCollection, handleSubscribe, handleUnsubscribe } from '../machinery/eventStreams.js'
import { withRequestJsonBody } from '../machinery/request.js'
import { respondJson } from '../machinery/response.js'
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
    getChannel: ([type, id, encodedFieldPath]) => `documents/${type}/${id}/rich-text/${encodedFieldPath}`,
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
    handleSubscribe(req, res, { type, id, encodedFieldPath }) {
      handleSubscribe(req, res, eventStreamCollection, [type, id, encodedFieldPath])
    },
    handleUnsubscribe(req, res, { type, id, encodedFieldPath }) {
      handleUnsubscribe(req, res, eventStreamCollection, [type, id, encodedFieldPath])
    },
  }

  /** @param {import('node:http').ServerResponse} res */
  function handlePostRichText(req, res, { type, id, encodedFieldPath }) {
    const fieldPath = decodeURIComponent(encodedFieldPath)
    withRequestJsonBody(req, (body, error) => {
      // TODO: error handling
      const { clientId, steps, documentVersion, value, valueVersion, fieldType } = body

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

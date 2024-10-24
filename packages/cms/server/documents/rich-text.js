import { createCustomEventStreamCollection } from '../machinery/eventStreams.js'
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
    getPathSegments: ([type, id, encodedFieldPath]) => ['documents', type, id, 'rich-text', encodedFieldPath],
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
    handleRequest,
    canHandleRequest(method, pathSegments) {
      const [type, id, feature, encodedFieldPath, subscription] = pathSegments

      return (
        feature === 'rich-text' && ['POST'].includes(method) ||
        subscription === 'subscription' && ['HEAD', 'DELETE'].includes(method)
      )
    }
  }

  function handleRequest(req, res, pathSegments, searchParams) {
    const { method, headers } = req
    const [type, id, feature, encodedFieldPath, subscription] = pathSegments
    const connectId = headers['x-connect-id']


    if (subscription === 'subscription')
      ok(res, handleSubscription(method, connectId, [type, id, encodedFieldPath]))
    else if (feature === 'rich-text' && method === 'POST')
      handlePostRichText(req, res, { type, id, encodedFieldPath })
  }

  function handleSubscription(method, connectId, args) {
    if (method === 'HEAD')
      eventStreamCollection.subscribe(connectId, args)
    else if (method === 'DELETE')
      eventStreamCollection.unsubscribe(connectId, args)
  }

  function ok(res, _) {
    res.writeHead(204, { 'Content-Length': 0, 'Connection': 'close' })
    res.end()
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

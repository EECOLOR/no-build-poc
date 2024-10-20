import { createCustomEventStreamCollection } from '../machinery/eventStreams.js'
import { withRequestJsonBody } from '../machinery/request.js'
import { respondJson } from '../machinery/response.js'
import { getAt } from './utils.js'

/**
 * @param {{
 *   databaseActions: import('../database.js').Actions,
 *   patchDocument: import('../documents.js').PatchDocument
 * }} params
 */
export function createRichTextHandler({ databaseActions, patchDocument }) {

  const { getDocumentById } = databaseActions.documents

  const eventStreamCollection = createCustomEventStreamCollection({
    createInitialValue(type, id, fieldPath) {
      return {
        value: getAt(getDocumentById({ id }), fieldPath),
        version: 0,
      }
    },
    subscribeEvent: 'initialValue',
    notifyEvent: 'steps',
    getSubscribeData(value, args) { return value },
  })

  return {
    handleRequest,
    canHandleRequest(method, pathSegments) {
      const [type, id, feature] = pathSegments

      return feature === 'rich-text' && ['GET', 'POST'].includes(method)
    }
  }

  function handleRequest(req, res, pathSegments, searchParams) {
    const { method } = req
    const [type, id, feature] = pathSegments

    if (feature === 'rich-text' && method === 'GET')
      handleGetRichText(req, res, { type, id, searchParams })
    else if (feature === 'rich-text' && method === 'POST')
      handlePostRichText(req, res, { type, id, searchParams })
  }

  function handleGetRichText(req, res, { type, id, searchParams }) {
    const fieldPath = searchParams.get('fieldPath')
    eventStreamCollection.subscribe(res, [type, id, fieldPath])
  }

  /** @param {import('node:http').ServerResponse} res */
  function handlePostRichText(req, res, { type, id, searchParams }) {
    const fieldPath = searchParams.get('fieldPath')
    withRequestJsonBody(req, (body, error) => {
      // TODO: error handling
      const { clientId, steps, documentVersion, value, valueVersion, fieldType } = body

      const stored = eventStreamCollection.getValue(type, id, fieldPath)
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
        [type, id, fieldPath]
      )
      respondJson(res, 200, result)
    })
  }
}

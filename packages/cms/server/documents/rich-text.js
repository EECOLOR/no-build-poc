import { createCustomEventStreamCollection } from '../machinery/eventStreams.js'
import { withRequestJsonBody } from '../machinery/request.js'
import { internalServerError, noContent, notAuthorized, respondJson } from '../machinery/response.js'
import { getAt } from './utils.js'

/**
 * @param {{
 *   streams: import('../machinery/eventStreams.js').Streams
 * }} params
 */
export function createRichTextHandler({ streams }) {

  const eventStreamCollection = createCustomEventStreamCollection({
    channel: `document/rich-text`,
    createInitialValue(info, type, id, encodedFieldPath) {
      return { version: info.version, steps: [], clientIds: [] }
    },
    subscribeEvent: 'steps',
    notifyEvent: 'steps',
    getSubscribeData(value, args) { return value },
    streams,
  })

  return {
    handlePostRichText,
    eventStreamCollection,
  }

  /** @param {import('node:http').ServerResponse} res */
  function handlePostRichText(req, res, { type, id, auth }) {
    withRequestJsonBody(req, (body, error) => {
      // TODO: error handling
      if (error) {
        console.error(error)
        return internalServerError(res)
      }

      const { userId, clientId, steps, valueVersion, fieldType, encodedFieldPath } = body

      if (!strictEqual(fieldType, 'rich-text'))
        return respondJson(res, 400, { success: false, reason: `Given field type was not 'rich-text'`})

      if (userId !== auth.user.id)
        return notAuthorized(res)

      const stored = eventStreamCollection.getValue(type, id, encodedFieldPath)
      if (stored.version !== valueVersion)
        return respondJson(res, 400, { success: false, reason: 'Version mismatch' })

      stored.version += steps.length

      eventStreamCollection.notify(
        { steps, clientIds: steps.map(_ => clientId), version: stored.version },
        [type, id, encodedFieldPath]
      )
      respondJson(res, 200, { success: true })
    })
  }
}

/**
 * @template T
 * @param {any} value
 * @param {T} expected
 * @returns {value is T}
 */
function strictEqual(value, expected) {
  return value === expected
}

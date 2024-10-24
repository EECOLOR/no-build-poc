import { diffChars } from 'diff'

/** @param {{ databaseActions: import('../database.js').Actions }} params */
export function createHistoryHandler({ databaseActions }) {

  const {
    historyEventStreams,

    getFieldHistoryChangedInTheLastMinute,
    insertHistory,
    updateHistory,
  } = databaseActions.history

  return {
    handleRequest,
    canHandleRequest(method, pathSegments) {
      const [type, id, feature, subscription] = pathSegments

      return subscription === 'subscription' && ['HEAD', 'DELETE'].includes(method)
    },
    updateDocumentHistory,
  }

  function handleRequest(req, res, pathSegments, searchParams) {
    const { method, headers } = req
    const [type, id, feature, subscription] = pathSegments
    const connectId = headers['x-connect-id']

    if (subscription === 'subscription')
      ok(res, handleSubscription(method, connectId, [type, id]))
  }

  function handleSubscription(method, connectId, args) {
    if (method === 'HEAD')
      historyEventStreams.subscribe(connectId, args)
    else if (method === 'DELETE')
      historyEventStreams.unsubscribe(connectId, args)
  }

  function ok(res, _) {
    res.writeHead(204, { 'Content-Length': 0, 'Connection': 'close' })
    res.end()
  }

  /**
   * @param {string} clientId
   * @param {string} type
   * @param {string} documentId
   * @param {string} fieldPath
   * @param {{
   *   fieldType: string,
   *   oldValue: any,
   *   newValue: any,
   *   patch: Array<any>,
   *   steps?: Array<any>,
   * }} newDetails
   * @returns
   */
  function updateDocumentHistory(clientId, type, documentId, fieldPath, newDetails) {
    const timestamp = Date.now()

    const result = getFieldHistoryChangedInTheLastMinute({ documentId, clientId, fieldPath })

    //TODO: if the old and new value end up to be the same (or in case of an object, when there are no patches) remove the history item
    if (result) {
      const previous = result.details

      const timestampStart = result.timestampStart
      const timestampEnd = timestamp
      const details = {
        fieldType: newDetails.fieldType,
        oldValue: previous.oldValue,
        newValue: newDetails.newValue,
        steps: newDetails.steps && previous.steps.concat(newDetails.steps),
        patches: previous.patches.concat(newDetails.patch),
        difference: newDetails.fieldType === 'string'
          ? diffChars(previous.oldValue, newDetails.newValue)
          : []
      }

      return updateHistory({
        type,
        select: { documentId, fieldPath, clientId, timestampStart },
        update: { details, timestampEnd }
      })

    } else {
      const timestampStart = timestamp
      const timestampEnd = timestamp
      const details = {
        fieldType: newDetails.fieldType,
        oldValue: newDetails.oldValue,
        newValue: newDetails.newValue,
        steps: newDetails.steps,
        patches: [newDetails.patch],
        difference: newDetails.fieldType === 'string'
          ? diffChars('', newDetails.newValue)
          : []
      }

      return insertHistory({
        type, documentId, fieldPath, clientId,
        timestampStart, details, timestampEnd
      })
    }
  }
}


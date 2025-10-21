
// TODO: we probably need to add display information for the user here. Things might change over time

/** @import { HistoryDetails, Patch } from '#cms/types.ts' */

/**
 * @template {string} T
 * @typedef {{
 *   fieldType: T,
 *   valueForDiff: any,
 *   patch: Patch,
 * }} Change
 */

/** @param {{ databaseActions: import('../database.js').Actions }} params */
export function createHistoryHandler({ databaseActions }) {

  const {
    historyEventStreams,

    getFieldHistoryChangedInTheLastMinute,
    insertHistory,
    updateHistory,
  } = databaseActions.history

  return {
    updateDocumentHistory,
    historyEventStreams,
  }

  /**
   * @template {string} T
   * @param {string} userId
   * @param {string} type
   * @param {string} documentId
   * @param {string} fieldPath
   * @param {Change<T>} change
   */
  function updateDocumentHistory(userId, type, documentId, fieldPath, change) {
    const timestamp = Date.now()

    const result = getFieldHistoryChangedInTheLastMinute({ documentId, userId, fieldPath })

    //TODO: if the old and new value end up to be the same (or in case of an object, when there are no patches) remove the history item
    if (result) {
      const previous = result.details

      const timestampStart = result.timestampStart
      const timestampEnd = timestamp
      /** @type {HistoryDetails} */
      const details = {
        fieldType: change.fieldType,
        valueForDiff: change.valueForDiff,
        patches: previous.patches.concat(change.patch),
      }

      return updateHistory({
        type,
        select: { documentId, fieldPath, userId, timestampStart },
        update: { details, timestampEnd }
      })

    } else {
      const timestampStart = timestamp
      const timestampEnd = timestamp
      /** @type {HistoryDetails} */
      const details = {
        fieldType: change.fieldType,
        valueForDiff: change.valueForDiff,
        patches: [change.patch],
      }

      return insertHistory({
        type, documentId, fieldPath, userId,
        timestampStart, details, timestampEnd
      })
    }
  }
}


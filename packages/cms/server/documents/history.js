import { diffChars } from 'diff'

/**
 * @template {string} T
 * @typedef {{
 *   fieldType: T,
 *   oldValue: any,
 *   newValue: any,
 *   patch: object,
 * }} Change
 */

/**
 * @typedef {{
 *   fieldType: string,
 *   oldValue: any,
 *   newValue: any,
 *   patches: Array<any>,
 * }} Details
 */

const detailHandlers = {
  'string': createStringDetails,
  'rich-text': createRichTextDetails,
}

/**
 * @template {string} T
 * @typedef {T extends keyof typeof detailHandlers
 *   ? Parameters<(typeof detailHandlers)[T]>[2]
 *   : undefined
 * } FieldSpecificInfo
 */

/**
 * @template {string} T
 * @param {Change<T>} change
 * @param {Details} details
 */
function createStringDetails(change, details) {
  return {
    difference: diffChars(details.oldValue || '', change.newValue)
  }
}
/**
 * @template {string} T
 * @param {Change<T>} change
 * @param {Details & { steps?: Array<any> }} change
 * @param {{ steps: Array<any> }} info
 */
function createRichTextDetails(change, details, info) {
  return {
    steps: details.steps ? details.steps.concat(info.steps) : info.steps,
  }
}

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
   * @param {FieldSpecificInfo<T>} info
   */
  function updateDocumentHistory(userId, type, documentId, fieldPath, change, info) {
    const timestamp = Date.now()

    const result = getFieldHistoryChangedInTheLastMinute({ documentId, userId, fieldPath })

    /** @type {(typeof detailHandlers)[keyof typeof detailHandlers] | undefined} */
    // @ts-ignore - It will probably be tricky to tell Typescript that it is ok if we get an `undefined` as a result
    const appendToDetails = detailHandlers[change.fieldType]

    //TODO: if the old and new value end up to be the same (or in case of an object, when there are no patches) remove the history item
    if (result) {
      const previous = result.details

      const timestampStart = result.timestampStart
      const timestampEnd = timestamp
      const details = {
        fieldType: change.fieldType,
        oldValue: previous.oldValue,
        newValue: change.newValue,
        patches: previous.patches.concat(change.patch),
      }
      if (appendToDetails)
        Object.assign(details, appendToDetails(change, details, info)) // I don't like mutating like this, but I did it this way for backwards compatibility

      return updateHistory({
        type,
        select: { documentId, fieldPath, userId, timestampStart },
        update: { details, timestampEnd }
      })

    } else {
      const timestampStart = timestamp
      const timestampEnd = timestamp
      const details = {
        fieldType: change.fieldType,
        oldValue: change.oldValue,
        newValue: change.newValue,
        patches: [change.patch],
      }
      if (appendToDetails)
        Object.assign(details, appendToDetails(change, details, info)) // I don't like this, but I did it this way for backwards compatibility

      return insertHistory({
        type, documentId, fieldPath, userId,
        timestampStart, details, timestampEnd
      })
    }
  }
}


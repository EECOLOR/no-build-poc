// Inspiration taken from https://github.com/kpdecker/jsdiff/issues/528

/** @import { Change } from './index.js' */

/**
 * We do not expect similar changes to be present consecutively in the array (added, removed, unchanged)
 *
 * @param {Array<Change>} changes
 * @returns {Array<Change>}
 */
export function mergeChanges(changes) {
  let addedText = ''
  let removedText = ''
  /** @type {Array<Change>} */
  const mergedChanges = []

  for (const change of changes) {
    if (change.added) {
      addedText += change.value
    } else if (change.removed) {
      removedText += change.value
    } else if (change.value.length <= 2) {
      // we ignore small unchanged segments
      addedText += change.value
      removedText += change.value
    } else {
      // if the change is not added or removed, merge the added and removed text and append to the diff alongside unchanged text

      if (removedText)
        mergedChanges.push({ value: removedText, removed: true })

      if (addedText)
        mergedChanges.push({ value: addedText, added: true })

      mergedChanges.push({ value: change.value })

      addedText = ''
      removedText = ''
    }
  }

  if (removedText === addedText) {
    if (removedText)
      mergedChanges.push({ value: removedText })
  } else {
    if (removedText)
      mergedChanges.push({ value: removedText, removed: true })

    if (addedText)
      mergedChanges.push({ value: addedText, added: true })
  }

  return mergedChanges
}

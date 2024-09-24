import { loop } from '#ui/dynamic.js'
import { tags } from '#ui/tags.js'
import { context } from '../context.js'
import { useEventSourceAsSignal } from '../machinery/useEventSourceAsSignal.js'

const { div, li, span, pre, code, ol, del, ins } = tags

export function DocumentHistory({ id, schemaType }) {
  const $history = useDocumentHistory({ id, schemaType })
  return (
    ol({ reversed: true, style: { maxHeight: '100vh', overflow: 'scroll' } },
      loop(
        $history,
        history => `${history.clientId} ${history.fieldPath} ${history.timestampEnd}`,
        history => HistoryItem({ history })
      )
    )
  )
}

function HistoryItem({ history }) {
  const dateTime = new Date(history.timestampStart).toISOString()
  return (
    li(
      div(`${dateTime} ${history.clientId}`),
      history.details.type === 'string'
        ? HistoryString({ difference: history.details.difference })
        : pre(
            code(
              JSON.stringify({
                oldValue: '...',
                newValue: '...',
                patches: history.details.patches,
                steps: history.details.steps?.map(x => ({
                  stepType: x.stepType,
                  slice: JSON.stringify(x.slice)?.replaceAll('\\', '').replaceAll('"', ''),
                  '...': '...',
                }))
              }, null, 2)
            )
          )
    )
  )
}

function HistoryString({ difference }) {
  const merged = mergeChanges(difference)

  return (
    span(
      merged.map(x =>
        x.added ? ins({ style: { backgroundColor: 'lightgreen' } },x.value) :
        x.removed? del({ style: { backgroundColor: 'lightcoral' } }, x.value) :
        x.value
      )
    )
  )
}

function useDocumentHistory({ id, schemaType }) {
  return useEventSourceAsSignal({
    pathname: `${context.apiPath}/documents/${schemaType}/${id}/history`,
    events: ['history'],
  }).derive(x => x?.data || [])
}

// https://github.com/kpdecker/jsdiff/issues/528
function mergeChanges(changes) {
  // create accumulators for the added and removed text. Once a neutral part is encountered, merge the diffs and reset the accumulators
  let addedText = ""
  let addedCount = 0
  let removedText = ""
  let removedCount = 0
  let mergedChanges = []

  for (const part of changes) {
    if (part?.added) {
      addedText += part.value
      addedCount += part.count ?? 0
    } else if (part?.removed) {
      removedText += part.value
      removedCount += part.count ?? 0
    } else if (part.value.length <= 2) {
      // we ignore small unchanged segments (<= 4 characters), which catches most whitespace too
      addedText += part.value
      removedText += part.value
    } else {
      // if the part is not added or removed, merge the added and removed text and append to the diff alongside neutral text
      mergedChanges.push({ value: removedText, removed: true, count: removedCount })
      mergedChanges.push({ value: addedText, added: true, count: addedCount })
      mergedChanges.push(part)

      addedText = ""
      addedCount = 0
      removedText = ""
      removedCount = 0
    }
  }

  // after exiting the loop we might have ended with some added or removed text that needs to be appended
  if (addedText) {
    mergedChanges.push({ value: addedText, added: true, count: addedCount })
  }
  if (removedText) {
    mergedChanges.push({ value: removedText, removed: true, count: removedCount })
  }

  return mergedChanges
}

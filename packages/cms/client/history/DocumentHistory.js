import { derive } from '#ui/dynamic.js'
import { css, tags } from '#ui/tags.js'
import { getPathInfo, getSchema } from '../context.js'
import { useEventSourceAsSignal } from '../machinery/useEventSourceAsSignal.js'
import { ListSignal } from '../ui/List.js'

const { div, span, pre, code, del, ins, time, em } = tags

DocumentHistory.style = css`
  --gap: 1rem;
`
export function DocumentHistory({ id, schemaType }) {
  const $history = useDocumentHistory({ id, schemaType })
    .derive(history => history.filter(x => x.details.type !== 'empty'))

  const schema = getSchema(schemaType)

  return (
    ListSignal(
      {
        className: 'DocumentHistory',
        css: DocumentHistory.style,
        signal: $history,
        getKey: historyItem => historyItem.key,
        renderItem: $historyItem => derive($historyItem, historyItem =>
          HistoryItem({ historyItem, schema })
        )
      },
    )
  )
}

HistoryItem.style = css`
  padding: 0.2rem;
`
function HistoryItem({ historyItem, schema }) {
  // TODO: history items that are not a minute old can still change, we should probably make them reactive (or not, probably not important for real use cases, maybe introduce a refresh button, I don't know)
  return (
    div(
      HistoryItemHeader({ historyItem, schema }),
      HistoryItemBody({ historyItem, schema }),
    )
  )
}

HistoryItemHeader.style = css`
  & > .dateAndAuthor {
    display: flex;
    justify-content: space-between;
    gap: 1ex;
  }

  & > .pathAndAction {
    display: flex;
    gap: 1ex;
    font-size: 0.85em;
  }
`
function HistoryItemHeader({ historyItem, schema }) {

  return (
    div({ css: HistoryItemHeader.style },
      div({ className: 'dateAndAuthor'},
        DateTime({ timestamp: historyItem.timestampStart }),
        Author({ userId: historyItem.userId }),
      ),
      div({ className: 'pathAndAction' },
        Action({ details: historyItem.details }),
        Path({ fieldPath: historyItem.fieldPath, schema }),
      )
    )
  )
}

function Action({ details }) {
  const { patches = [], oldValue, newValue } = details
  const [patch] = patches.slice(-1)
  const { op } = patch || {}

  return (
    em(
      op === 'replace' && oldValue ? 'Updated' :
      op === 'replace' ? 'Added' :
      op === 'move' ? 'Moved' :
      op === 'remove' ? 'Removed' :
      oldValue && newValue ? 'Updated' :
      oldValue ? 'Removed' :
      'Added'
    )
  )
}

function Path({ fieldPath, schema }) {
  const pathInfo = getPathInfo(schema, fieldPath)
  return (
    div(
      pathInfo.flatMap((fieldInfo, i) =>
        [Boolean(i) && ' > ', fieldInfo.field?.title || `[${fieldInfo.key}]`, fieldInfo.inArray && ` at ${fieldInfo.key}`]
      )
    )
  )
}

// TODO: Change this to the correct field type (based on schema)
const itemRenderers = {
  'string': StringItem,
  'object': ObjectItem,
  'rich-text': UnsupportedTypeItem,
  default: UnsupportedTypeItem,
}

function HistoryItemBody({ historyItem, schema }) {
  const renderer = itemRenderers[historyItem.details.fieldType] || itemRenderers.default
  return renderer({ historyItem, schema })
}

function UnsupportedTypeItem({ historyItem, schema }) {
  return (
    pre({ css: css`max-width: 35rem; overflow: scroll; max-height: 20rem;` },
      code(
        `Unsupported type ${historyItem.details.type}\n`,
        JSON.stringify(historyItem.details),
        JSON.stringify({
          oldValue: '...',
          newValue: '...',
          patches: historyItem.details.patches,
          steps: historyItem.details.steps?.map(x => ({
            stepType: x.stepType,
            slice: JSON.stringify(x.slice)?.replaceAll('\\', '').replaceAll('"', ''),
            '...': '...',
          }))
        }, null, 2)
      )
    )
  )
}

DateTime.style = css`
  display: inline-flex;
  gap: 1ex;
`
function DateTime({ timestamp }) {
  const [dateString, timeString] = new Date(timestamp).toISOString().split('T')
  return (
    span({ css: DateTime.style },
      time(dateString),
      time(timeString.slice(0, 5)),
    )
  )
}

Author.style = css`
  display: inline-block;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 1.5rem;
  background-color: var(--color);
`
function Author({ userId }) {
  return span({ style: { '--color': `#${userId.slice(0, 6)}` }, css: Author.style, title: userId })
}

StringItem.style = css`
  & > ins { background-color: lightgreen; }
  & > del { background-color: lightcoral; }
`
function StringItem({ historyItem, schema }) {
  const { difference } = historyItem.details
  const merged = mergeChanges(difference)

  return (
    span({ css: StringItem.style },
      merged.map(x =>
        x.added ? ins(x.value) :
        x.removed ? del(x.value) :
        x.value
      )
    )
  )
}

function ObjectItem({ historyItem, schema }) {
  const { details } = historyItem

  if (details.steps)
    return itemRenderers['rich-text']({ historyItem, schema })

  if (details.newValue.filename)
    return itemRenderers['default']({ historyItem, schema })

  const { patches = [] } = details

  const [patch] = patches.slice(-1)

  const pathInfo = getPathInfo(schema, historyItem.fieldPath)
  const [{ field }] = pathInfo.slice(-1)

  if (patch.op === 'replace' && !details.oldValue) {
    return `Add ${field.title}`
  } else if (patch.op === 'move') {
    const [lastFrom] = patch.from.split('/').slice(-1)
    const [lastPath] = patch.path.split('/').slice(-1)
    return `Move ${field.title} from ${lastFrom} to ${lastPath}`
  } else if (patch.op === 'remove') {
    const [lastPath] = patch.path.split('/').slice(-1)
    return `Removed ${field.title} at ${lastPath}`
  } else {
    throw new Error(`[ObjectItem] Do not know how to render history item\n${JSON.stringify(details, null, 2)}`)
  }
}

function useDocumentHistory({ id, schemaType }) {
  return useEventSourceAsSignal({
    channel: 'document/history',
    args: [schemaType, id],
    events: ['history'],
  }).derive(x => x?.data || [])
}

// https://github.com/kpdecker/jsdiff/issues/528
function mergeChanges(changes) {
  let addedText = ''
  let removedText = ''
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
      // if the change is not added or removed, merge the added and removed text and append to the diff alongside neutral text
      mergedChanges.push(
        { value: removedText, removed: true },
        { value: addedText, added: true },
        { value: change.value },
      )

      addedText = ''
      removedText = ''
    }
  }

  if (removedText)
    mergedChanges.push({ value: removedText, removed: true })
  if (addedText)
    mergedChanges.push({ value: addedText, added: true })

  return mergedChanges
}

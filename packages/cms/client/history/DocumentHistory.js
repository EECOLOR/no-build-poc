import { derive } from '#ui/dynamic.js'
import { css, raw, tags } from '#ui/tags.js'
import { diffChars } from 'diff'
import { getPathInfo, getSchema } from '../context.js'
import { useEventSourceAsSignal } from '../machinery/useEventSourceAsSignal.js'
import { ListSignal } from '../ui/List.js'

const { div, span, pre, code, del, ins, time, em } = tags

DocumentHistory.style = css`
  --gap: 1rem;
`
export function DocumentHistory({ id, schemaType }) {
  const $history = useDocumentHistory({ id, schemaType })
    .derive(prepareHistory)

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
        Action({ historyItem }),
        Path({ fieldPath: historyItem.fieldPath, schema }),
      )
    )
  )
}

function Action({ historyItem }) {
  const { patches = [], oldValue, newValue } = historyItem
  const [patch] = patches.slice(-1) // TODO: think: do we need to merge patches of a sinle edit session?
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
  // TODO: schema might have changed. We probably need to do this on storing the history item
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
  'rich-text': RichTextItem,
  default: UnsupportedTypeItem,
}

function HistoryItemBody({ historyItem, schema }) {
  const renderer = itemRenderers[historyItem.fieldType] || itemRenderers.default
  return renderer({ historyItem, schema })
}

function UnsupportedTypeItem({ historyItem, schema }) {
  return (
    pre({ css: css`max-width: 35rem; overflow: scroll; max-height: 20rem;` },
      code(
        `Unsupported type ${historyItem.fieldType}\n`,
        JSON.stringify(historyItem, null, 2)
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
  const { oldValue, newValue } = historyItem
  if (!newValue)
    return null

  const difference = diffChars(oldValue || '', newValue)
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

RichTextItem.style = css`
  & ins, & ins * { background-color: lightgreen; }
  & del, & del * { background-color: lightcoral; }
  & span.contextChanged, & span.contextChanged * { background-color: khaki; }
  & ol, ul, li {
    margin: revert;
    padding: revert;
  }
`
function RichTextItem({ historyItem, schema }) {
  const { oldValue, newValue } = historyItem
  if (!newValue)
    return null

  const diffDiv = createHtmlDiffAsDiv(oldValue, newValue)

  return div({ css: RichTextItem.style },
    raw(diffDiv)
  )
}

function ObjectItem({ historyItem, schema }) {
  const { patches = [] } = historyItem

  const [patch] = patches.slice(-1)

  const pathInfo = getPathInfo(schema, historyItem.fieldPath)
  const [{ field }] = pathInfo.slice(-1)

  if (patch.op === 'replace' && !historyItem.oldValue) {
    return `Add ${field.title}`
  } else if (patch.op === 'move') {
    const [lastFrom] = patch.from.split('/').slice(-1)
    const [lastPath] = patch.path.split('/').slice(-1)
    return `Move ${field.title} from ${lastFrom} to ${lastPath}`
  } else if (patch.op === 'remove') {
    const [lastPath] = patch.path.split('/').slice(-1)
    return `Removed ${field.title} at ${lastPath}`
  } else {
    throw new Error(`[ObjectItem] Do not know how to render history item\n${JSON.stringify(historyItem, null, 2)}`)
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

function prepareHistory(history) {
  const preparedHistory = []
  const lookup = {}

  // history is sorted newest to oldest
  for (const item of history) {
    const laterItem = lookup[item.fieldPath]

    if (laterItem) {
      laterItem.oldValue = item.details.valueForDiff
    }

    const preparedItem = {
      fieldPath: item.fieldPath,
      userId: item.userId,
      timestampStart: item.timestampStart,
      timestampEnd: item.timestampEnd,
      fieldType: item.details.fieldType,
      newValue: item.details.valueForDiff,
      patches: item.details.patches,
      key: item.key,
    }
    lookup[item.fieldPath] = preparedItem

    preparedHistory.push(preparedItem)
  }

  console.log(preparedHistory)

  return preparedHistory
}

// Unicode Private Use Area
const puaStart = 0xE000
const puaEnd = 0xF8FF
const placeholderRegex = /[\uE000-\uF8FF]/g
const placeholdersOnlyRegex = /^(\s*[\uE000-\uF8FF]\s*)+$/
const containsTextRegex = /[^\s\uE000-\uF8FF]/

function createHtmlDiffAsDiv(oldValue, newValue) {
  const info = prepareForDiff(oldValue || '', newValue)
  const difference = calculateDifference(info.oldValue, info.newValue, info.placeholderToTag)
  const html = prepareForDisplay(difference, info.placeholderToTag)

  const div = window.document.createElement('div')
  div.innerHTML = html

  return div
}

function prepareForDiff(oldHtml, newHtml) {
  const tagRegex = /<[^>]+>/g
  const tagToPlaceholder = new Map()
  const placeholderToTag = new Map()

  let charCode = puaStart
  for (const [tag] of (oldHtml + newHtml).matchAll(tagRegex)) {
    if (charCode > puaEnd)
      throw new Error("Placeholder index exceeded Unicode PUA range. Cannot process HTML.")

    if (tagToPlaceholder.has(tag))
      continue

    const isClose = tag.startsWith('</')
    const isOpen = !isClose && tag.startsWith('<')

    const placeholderChar = String.fromCharCode(charCode++)
    tagToPlaceholder.set(tag, placeholderChar)
    placeholderToTag.set(placeholderChar, { value: tag, isOpen, isClose })
  }

  const oldValue = oldHtml.replace(tagRegex, tagMatch => tagToPlaceholder.get(tagMatch))
  const newValue = newHtml.replace(tagRegex, tagMatch => tagToPlaceholder.get(tagMatch))

  return { oldValue, newValue, placeholderToTag }
}

/**
 * @returns {Array<import('diff').Change & { contextChanged?: boolean, tagsOnly?: boolean }>}
 */
function calculateDifference(oldValue, newValue, placeHolderToTag) {
  // TODO: maybe it's a fun challenge to recreate the diff function yourself. Saves the usage of another library
  //       The library references the paper that describes the algorithm
  const difference = diffChars(oldValue, newValue)

  let contextChanges = { added: 0, removed: 0 }
  for (const part of difference) {
    const changed = part.added || part.removed

    const isContextChange = changed && placeholdersOnlyRegex.test(part.value)
    const shouldMarkContextChange = (
      !changed &&
      (contextChanges.added > 0 || contextChanges.removed > 0) &&
      containsTextRegex.test(part.value)
    )

    if (isContextChange) {
      for (const [placeholder] of part.value.matchAll(placeholderRegex)) {
        const tag = placeHolderToTag.get(placeholder)
        console.log(tag)
        contextChanges[part.added ? 'added' : 'removed'] += (
          tag.isClose ? -1 :
          tag.isOpen ? 1 :
          0
        )
      }
      part['tagsOnly'] = true
    }

    if (shouldMarkContextChange) {
      part['contextChanged'] = true
    }
  }

  return difference
}

function prepareForDisplay(diffs, placeholderToTag) {
  let result = ''

  for (const part of diffs) {
    const text = part.value.replace(placeholderRegex, match => placeholderToTag.get(match).value)

    if (part.added)
      result += '<ins>' + text + '</ins>'
    else if (part.removed && part.tagsOnly)
      continue // No need to display removed tags
    else if (part.removed)
      result += '<del>' + text + '</del>'
    else if (part.contextChanged)
      result += '<span class="contextChanged">' + text + '</span>'
    else
      result += text
  }

  return result
}

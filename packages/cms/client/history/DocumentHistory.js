import { derive } from '#ui/dynamic.js'
import { css, raw, Tag, tags } from '#ui/tags.js'
import { getPathInfo, getSchema } from '../context.js'
import { useEventSourceAsSignal } from '../machinery/useEventSourceAsSignal.js'
import { ListSignal } from '../ui/List.js'
import { mergeChanges } from '#diff/merge.js'
import { diff } from '#diff'
import { diffHtml, toHtml } from '#diff/diffHtml.js'
/** @import { HistoryItem, Patch } from '#cms/types.ts' */
/** @import { DocumentSchema } from '../cmsConfigTypes.ts' */

const { div, span, pre, code, del, ins, time, em } = tags

DocumentHistory.style = css`
  --gap: 1rem;
`
/** @arg {{ id: string, schemaType: string }} props */
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
/** @arg {{ historyItem: PreparedHistoryItem, schema: DocumentSchema.DocumentSchema }} props */
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
/** @arg {{ historyItem: PreparedHistoryItem, schema: DocumentSchema.DocumentSchema }} props */
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

/** @arg {{ historyItem: PreparedHistoryItem }} props */
function Action({ historyItem }) {
  const { patches = [], oldValue, newValue } = historyItem
  const [patch] = patches.slice(-1) // TODO: think: do we need to merge patches of a single edit session?
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

/** @arg {{ fieldPath: string, schema: DocumentSchema.DocumentSchema }} props */
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
/** @type {{ [type: string]: (props: { historyItem: PreparedHistoryItem, schema: DocumentSchema.DocumentSchema }) => any }} */
const itemRenderers = {
  'string': StringItem,
  'object': ObjectItem,
  'rich-text': RichTextItem,
  default: UnsupportedTypeItem,
}
/** @arg {{ historyItem: PreparedHistoryItem, schema: DocumentSchema.DocumentSchema }} props */
function HistoryItemBody({ historyItem, schema }) {
  const renderer = itemRenderers[historyItem.fieldType] || itemRenderers.default
  return renderer({ historyItem, schema })
}

/** @arg {{ historyItem: PreparedHistoryItem, schema: DocumentSchema.DocumentSchema }} props */
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
/** @arg {{ timestamp: number }} props */
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
/** @arg {{ userId: string }} props */
function Author({ userId }) {
  return span({ style: { '--color': `#${userId.slice(0, 6)}` }, css: Author.style, title: userId })
}

StringItem.style = css`
  & > ins { background-color: lightgreen; }
  & > del { background-color: lightcoral; }
`
/** @arg {{ historyItem: PreparedHistoryItem, schema: DocumentSchema.DocumentSchema }} props */
function StringItem({ historyItem, schema }) {
  const { oldValue, newValue } = historyItem
  if (!newValue)
    return null

  const difference = diff(oldValue || '', newValue)
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
  & ins.diff-added, & ins.diff-added * { background-color: lightgreen; }
  & del.diff-removed, & del.diff-removed * { background-color: lightcoral; }
  & span.diff-context-changed, & span.diff-context-changed * { background-color: khaki; }
  & ol, ul, li {
    margin: revert;
    padding: revert;
  }
`
/** @arg {{ historyItem: PreparedHistoryItem, schema: DocumentSchema.DocumentSchema }} props */
function RichTextItem({ historyItem, schema }) {
  const { oldValue, newValue } = historyItem
  if (!newValue)
    return null

  const diffDiv = createHtmlDiffAsDiv(oldValue, newValue)

  return div({ css: RichTextItem.style },
    raw(diffDiv)
  )
}

/** @arg {{ historyItem: PreparedHistoryItem, schema: DocumentSchema.DocumentSchema }} props */
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

/** @arg {{ id: string, schemaType: string }} props */
function useDocumentHistory({ id, schemaType }) {
  return useEventSourceAsSignal({
    channel: 'document/history',
    args: [schemaType, id],
    events: ['history'],
    initialValue: /** @type {null} */ (null),
    type: /** @type {Array<HistoryItem>} */ (null),
  }).derive(x => x?.data || [])
}

/**
 * @typedef {{
 *   fieldPath: string,
 *   userId: string,
 *   timestampStart: number,
 *   timestampEnd: number,
 *   fieldType: string,
 *   newValue: any,
 *   oldValue?: any,
 *   patches: Array<Patch>,
 *   key: string,
 * }} PreparedHistoryItem
 */

/** @arg {Array<HistoryItem>} history */
function prepareHistory(history) {
  const preparedHistory = []
  /** @type {Record<string, PreparedHistoryItem>} */
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

/** @arg {string} oldValue @arg {string} newValue */
function createHtmlDiffAsDiv(oldValue, newValue) {
  const html = toHtml(diffHtml(oldValue, newValue))

  const div = window.document.createElement('div')
  div.innerHTML = html

  return div
}

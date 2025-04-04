import { derive } from '#ui/dynamic.js'
import { css, raw, tags } from '#ui/tags.js'
import { Node } from 'prosemirror-model'
import { context, getPathInfo, getSchema } from '../context.js'
import { useEventSourceAsSignal } from '../machinery/useEventSourceAsSignal.js'
import { ListSignal } from '../ui/List.js'
import { AddMarkStep, Mapping, RemoveMarkStep, ReplaceStep, Step } from 'prosemirror-transform'
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view'
import { EditorState, Plugin, PluginKey } from 'prosemirror-state'

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
  'rich-text': RichTextItem,
  default: UnsupportedTypeItem,
}

function HistoryItemBody({ historyItem, schema }) {
  const renderer = itemRenderers[historyItem.details.fieldType] || itemRenderers.default
  return renderer({ historyItem, schema })
}

RichTextItem.style = css`

  & .history-insertion {
    background-color: lightgreen;
  }

  & .history-deletion {
    background-color: lightcoral;
    text-decoration: line-through;
  }

  & .history-mark-added, & .history-mark-removed {
    background-color: khaki;
  }
`

function RichTextItem({ historyItem }) {
console.log(historyItem)
console.log('before', historyItem.details.steps)

  // TODO: this should be stored with the history item
  const schema = context.documentSchemas[0].fields[3].schema

  // merge steps
  let lastStep = null
  let steps = []
  for (const jsonStep of historyItem.details.steps) {
    const step = Step.fromJSON(schema, jsonStep)
    if (!lastStep) {
      lastStep = step
      continue
    }

    const mergedStep = lastStep.merge(step)
    if (mergedStep) {
      lastStep = mergedStep
      continue
    }

    steps.push(lastStep)
    lastStep = step
  }
  steps.push(lastStep)
  console.log('after steps', steps.map(x => x.toJSON()))

  // apply steps and create mapping
  console.log('before doc', historyItem.details.oldValue)
  const initialDoc = Node.fromJSON(schema, historyItem.details.oldValue
    ? historyItem.details.oldValue
    : { type: 'doc', content: [] }
  )
  let currentDoc = initialDoc
  const mapping = new Mapping()
  /**
   * @type {Array<
   *   { type: 'insert', step: ReplaceStep, deletedSlice: null } |
   *   { type: 'delete', step: ReplaceStep, deletedSlice: any } |
   *   { type: 'replace', step: ReplaceStep, deletedSlice: any } |
   *   { type: 'addMark', step: AddMarkStep, deletedSlice: null } |
   *   { type: 'removeMark', step: RemoveMarkStep, deletedSlice: null } |
   *   { type: 'unknown', step: Step, deletedSlice: null }
   * >}
   * */
  const stepMetadata = []

  for (const step of steps) {
    let deletedSlice = null
    if (step instanceof ReplaceStep && step.from < step.to) {
      deletedSlice = currentDoc.slice(step.from, step.to)
    }

    let result = null
    try {
      result = step.apply(currentDoc)
    } catch (e) {
      result = { failed: 'error applying step, most likely caused by incomplete information' }
    }

    if (result.failed) {
      console.error(`Failed to apply step: "${result.failed}":\n${JSON.stringify(step.toJSON(), null, 2)}`)
      break
    }

    // @ts-ignore
    stepMetadata.push({
      step,
      deletedSlice,
      type: (
        step instanceof ReplaceStep && step.slice.size > 0 && step.from === step.to ? 'insert' :
        step instanceof ReplaceStep && step.slice.size === 0 && step.from < step.to ? 'delete' :
        step instanceof ReplaceStep ? 'replace' :
        step instanceof AddMarkStep ? 'addMark' :
        step instanceof RemoveMarkStep ? 'removeMark' :
        'unknown'
      ),
    })
    currentDoc = result.doc
    mapping.appendMap(step.getMap())
  }

  console.log('after doc', currentDoc.toJSON())
  console.log('after doc original', historyItem.details.newValue)

  console.log(stepMetadata)

  // add decorations for
  // - add
  // - remove (crossed through text)
  // - change
  // - mark add
  // - mark remove
  const decorations = []
  for (const [i, { type, step, deletedSlice }] of stepMetadata.entries()) {

    console.log({ type })
    const mappingForStep = mapping.slice(i)
    if (type === 'insert') {
      const mapResult = mappingForStep.mapResult(step.from)
      if (mapResult.pos >= 0) {
        const mappedFrom = mapResult.pos
        const mappedTo = mappedFrom + step.slice.size
        decorations.push(
          Decoration.inline(mappedFrom, mappedTo, {
            class: 'history-insertion',
          })
        )
      } else {
        console.warn(`Can not display insertion, location was invalid`, step.slice.content)
      }
    }
    else if (type === 'delete') {
      const deletedText = deletedSlice.content.textBetween(0, deletedSlice.content.size)
      const mapResult = mappingForStep.mapResult(step.from)
      if (mapResult.pos >= 0) {
        const mappedFrom = mapResult.pos
        decorations.push(
          Decoration.widget(
            mappedFrom,
            () => {
              const span = document.createElement('span')
              span.textContent = deletedText || '[empty]'
              span.className = 'history-deletion'
              return span
            },
            { side: -1, marks: [] }
          )
        )
      } else {
        console.warn(`Can not display deletion, location was invalid`, `"${deletedText}"`)
      }
    }
    else if (type === 'replace') {
      const mapResult = mappingForStep.mapResult(step.from)
      const deletedText = deletedSlice.content.textBetween(0, deletedSlice.content.size)
      if (mapResult.pos >= 0) {
        const mappedFrom = mapResult.pos
        const mappedTo = mappedFrom + step.slice.size
        decorations.push(
          Decoration.widget(
            mappedFrom,
            () => {
              const span = document.createElement('span')
              span.textContent = deletedText || '[empty]'
              span.className = 'history-deletion'
              return span
            },
            { side: -1, marks: [] }
          )
        )
        decorations.push(
          Decoration.inline(mappedFrom, mappedTo, {
            class: 'history-insertion',
          })
        )
      } else {
        console.warn(`Can not display replace, location was invalid`, `"${deletedText}"`)
      }
    }
    else if (type === 'addMark') {
        const mapResultFrom = mappingForStep.mapResult(step.from)
        const mapResultTo = mappingForStep.mapResult(step.to)
        if (!mapResultFrom.deleted && !mapResultTo.deleted) {
            decorations.push(
                Decoration.inline(mapResultFrom.pos, mapResultTo.pos, {
                    class: 'history-mark-added',
                    title: `Added ${step.mark.type.name}`,
                    'data-mark-type': step.mark.type.name,
                })
            )
        }
    }
    else if (type === 'removeMark') {
        const mapResultFrom = mappingForStep.mapResult(step.from)
        const mapResultTo = mappingForStep.mapResult(step.to)
        if (!mapResultFrom.deleted && !mapResultTo.deleted) {
             decorations.push(
                Decoration.inline(mapResultFrom.pos, mapResultTo.pos, {
                    class: 'history-mark-removed',
                    title: `Remove ${step.mark.type.name}`,
                    'data-mark-type': step.mark.type.name,
                })
            )
        }
    } else {
      console.warn(`Unknown step type '${type}':\n${JSON.stringify(step.toJSON(), null, 2)}`)
    }
  }

  console.log(new Date(historyItem.timestampStart).toISOString(), decorations.slice())

  // create prosemirror renderer that returns a dom node
  const decorationSet = DecorationSet.create(currentDoc, decorations)

  const pluginKey = new PluginKey('decorations')
  const editorState = EditorState.create({
    doc: currentDoc,
    plugins: [
      new Plugin({
        key: pluginKey,
        state: {
          init() {
            return decorationSet
          },
          apply(tr, oldDecorationSet) {
            return oldDecorationSet
          }
        },
        props: {
          decorations(state) {
            console.log(new Date(historyItem.timestampStart).toISOString(), pluginKey.getState(state))
            return pluginKey.getState(state)
          },
          editable(state) {
            return false
          }
        }
      })
    ]
  })

  const view = new EditorView(null, { state: editorState })

  // render dom node in raw, just as in RichTextEditor.js
  return (
    div({ css: RichTextItem.style },
      raw(view.dom),
    )
  )
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

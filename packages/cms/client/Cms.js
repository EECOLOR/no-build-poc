import { conditional, loop, useOnDestroy } from '#ui/dynamic.js'
import { createSignal, Signal } from '#ui/signal.js'
import { tags } from '#ui/tags.js'
import { context, getSchema, setContext } from './context.js'
import { $pathname, pushState } from './history.js'
import { RichTextEditor } from './richTextEditor/RichTextEditor.js'

const { div, p, ul, li, a, button, h1, label, span, input, pre, code, ol, del, ins } = tags

const documentApiPath = '/api/2024-09-07/documents/'

export function Cms({ basePath, deskStructure, documentSchemas, documentView }) {

  if (typeof window === 'undefined')
    return div('Loading...')

  const clientId = window.crypto.randomUUID()
  setContext({ documentSchemas, documentView, basePath, clientId })

  return DeskStructure({ deskStructure })
}

function DeskStructure({ deskStructure }) {
  return (
    div(
      p('CMS'),
      Panes({ firstPane: deskStructure.pane }),
    )
  )
}

function Panes({ firstPane }) {
  const $panesWithPath = $pathname.derive(pathname => {
    const pathSegments = pathname.replace(context.basePath, '').slice(1).split('/')
    return resolvePanes(firstPane, pathSegments)
  })

  return (
    div(
      { style: { display: 'flex', gap: '20px' }},
      loop(
        $panesWithPath,
        x => x.path.join('/'),
        Pane
      )
    )
  )
}

function Pane({ pane, path }) {
  const { type } = pane
  return (
    type === 'list' ? ListPane({ items: pane.items, path }) :
    type === 'documentList' ? DocumentListPane({ schemaType: pane.schemaType, path }) :
    type === 'document' ? Document({ id: pane.id, schemaType: pane.schemaType }) :
    `Unknown pane type '${type}'`
  )
}

function ListPane({ items, path }) {
  return (
    ul(
      items.map(item =>
        li(
          Link({ href: [context.basePath, ...path, item.slug].join('/') }, item.label)
        )
      )
    )
  )
}

function DocumentListPane({ schemaType, path }) {
  const $documents = useDocuments({ schemaType })
  const schema = getSchema(schemaType)
  if (!schema) throw new Error(`Could not find schema '${schemaType}'`)

  return (
    div(
      button({ type: 'button', onClick: handleAddClick }, '+'),
      ul(
        loop($documents, x => x._id + hack(x), document => // TODO: document should probably be a signal, if the id does not change, nothing will be re-rendered
          li(
            Link({ href: [context.basePath, ...path, document._id].join('/')}, schema.preview(document).title)
          )
        )
      )
    )
  )

  function handleAddClick(e) {
    const newPath = `${context.basePath}/${path.concat(window.crypto.randomUUID()).join('/')}`
    console.log(newPath)
    pushState(null, undefined, newPath)
  }

  function hack(document) {
    return JSON.stringify(schema.preview(document))
  }
}

function Document({ id, schemaType }) {
  return (
    div({ style: { display: 'flex' } },
      DocumentForm({ id, schemaType }),
      DocumentHistory({ id, schemaType }),
    )
  )
}

function DocumentForm({ id, schemaType }) {
  const $document = useDocument({ id, schemaType })
  const schema = getSchema(schemaType)

  return (
    div(// TODO: use context.documentView
      DocumentTitle({ $document, schema }),
      DocumentFields({ $document, id, schema }),
    )
  )
}

function DocumentHistory({ id, schemaType }) {
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

function DocumentTitle({ $document, schema }) {
  return h1($document.derive(document => schema.preview(document).title))
}

function DocumentFields({ $document, id, schema }) {
  return (
    div(
      {
        style: {
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          gridColumnGap: '1em',
        }
      },
      schema.fields.map(field => DocumentField({ $document, id, schema, field }))
    )
  )
}

const fieldRenderers = /** @type {const} */({
  'string': StringField,
  'rich-text': RichTextField,
})

function DocumentField({ $document, id, schema, field }) {
  const renderer = fieldRenderers[field.type]
  if (!renderer)
    return `Unknown field type '${field.type}'`

  return (
    label(
      {
        style: {
          gridColumn: 'span 2',

          display: 'grid',
          grid: 'inherit',
          gridTemplateColumns: 'subgrid',
          gridGap: 'inherit',
        }
      },
      span(field.title),
      renderer({ $document, id, schema, field })
    )
  )
}

function StringField({ $document, id, schema, field }) {
  const [$value, setValue] = useFieldValue({ $document, id, schema, field })

  return input({ type: 'text', value: $value, onInput: handleInput })

  function handleInput(e) {
    setValue(e.currentTarget.value)
  }
}

function RichTextField({ $document, id, schema, field }) {
  const richTextPathname = getRichTextPathname({ documentId: id, schemaType: schema.type, fieldPath: field.name })

  const $events = useEventSourceAsSignal({
    pathname: richTextPathname,
    events: ['initialValue', 'steps'],
  })
  const $initialValue = $events.derive((value, previous) =>
    value?.event === 'initialValue'
      ? { value: RichTextEditor.fromJson(value.data.value), version: value.data.version }
      : previous
  )
  const $steps = $events.derive((value, previous) =>
    value?.event === 'steps' ? { steps: value.data.steps.map(RichTextEditor.stepFromJson), clientIds: value.data.clientIds } :
    previous ? previous :
    { steps: [], clientIds: [] }
  )

  // This might be an interesting performance optimization if that is needed:
  // https://discuss.prosemirror.net/t/current-state-of-the-art-on-syncing-data-to-backend/5175/4
  return conditional(
    $initialValue,
    initialValue => Boolean(initialValue),
    initialValue => RichTextEditor({ initialValue, $steps, synchronize }),
  )

  function synchronize({ clientId, steps, version, value }) {
    const controller = new AbortController()
    const result = fetch(
      richTextPathname,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          clientId,
          steps: steps.map(RichTextEditor.stepToJson),
          version,
          value: RichTextEditor.toJson(value),
        })
      }
    ).then(x => x.json())

    return {
      result,
      abort(reason) {
        controller.abort(reason)
      }
    }
  }
}

function getRichTextPathname({ schemaType, documentId, fieldPath }) {
  // instead of using path as an id for prosemirror document handing, we should probably use a unique id for each document, that would prevent problems handling stuff nested in arrays
  return `${context.basePath}${documentApiPath}${schemaType}/${documentId}/rich-text?fieldPath=${fieldPath}`
}

function useFieldValue({
  $document, id, schema, field,
  isEqual = (localValue, valueFromDocument) => localValue === valueFromDocument,
  serialize = x => x,
  deserialize = x => x,
}) {
  const $valueFromDocument = $document.derive(document => deserialize(document[field.name]) || '')
  let localValue = $valueFromDocument.get()
  let dirty = false

  // This signal only updates when it has seen the current local value
  const $value = $valueFromDocument.derive((valueFromDocument, oldValueFromDocument) => {
    if (isEqual(localValue, valueFromDocument)) dirty = false
    return dirty ? oldValueFromDocument : valueFromDocument
  })

  return [$value, setValue]

  function setValue(newValue) {
    dirty = true
    localValue = newValue

    fetch(`${context.basePath}${documentApiPath}${schema.type}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: field.name,
        value: serialize(newValue),
        clientId: context.clientId,
      })
    }) // TODO: error reporting
  }
}

function useDocuments({ schemaType }) {
  return useEventSourceAsSignal({
    pathname: `${context.basePath}${documentApiPath}${schemaType}`,
    events: ['documents'],
  }).derive(x => x?.data || [])
}

function useDocument({ id, schemaType }) {
  return useEventSourceAsSignal({
    pathname: `${context.basePath}${documentApiPath}${schemaType}/${id}`,
    events: ['document'],
  }).derive(x => x?.data || { _id: id, _type: schemaType })
}

function useDocumentHistory({ id, schemaType }) {
  return useEventSourceAsSignal({
    pathname: `${context.basePath}${documentApiPath}${schemaType}/${id}/history`,
    events: ['history'],
  }).derive(x => x?.data || [])
}

function useEventSourceAsSignal({ pathname, events }) {
  const [$signal, setValue] = createSignal(null)
  const eventSource = new EventSource(pathname)
  for (const event of events) {
    eventSource.addEventListener(event, e => {
      setValue({ event, data: JSON.parse(e.data) })
    })
  }
  useOnDestroy(eventSource.close.bind(eventSource))

  return $signal
}

function resolvePanes(pane, pathSegments, path = []) {
  if (!pathSegments.length) return [{ pane, path }]

  const [nextPathSegment, ...otherPathSegments] = pathSegments

  if (pane.type === 'list') {
    const item = pane.items.find(x => x.slug === nextPathSegment)
    return [{ pane, path }].concat(
      item
        ? resolvePanes(item.child, otherPathSegments, path.concat(nextPathSegment))
        : []
    )
  }

  if (pane.type === 'documentList') {
    return [
      { pane, path },
      {
        pane: { type: 'document', id: nextPathSegment, schemaType: pane.schemaType },
        path: path.concat(nextPathSegment),
      }
    ]
  }

  return [{ pane, path }]
}

function Link({ href }, children) {
  return a({ href, onClick: linkClick(href) }, children)
}

function linkClick(to) {
  return e => {
    if (!shouldNavigate(e))
      return

    e.preventDefault()

    if (window.location.pathname === to)
      return

    pushState(null, undefined, to)
  }
}

function shouldNavigate(e) {
  return (
    !e.defaultPrevented &&
    e.button === 0 &&
    !(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey)
  )
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

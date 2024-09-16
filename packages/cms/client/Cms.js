import { loop, useOnDestroy } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'
import { tags } from '#ui/tags.js'
import { context, getSchema, setContext } from './context.js'
import { $pathname, pushState } from './history.js'

const { div, p, ul, li, a, button, h1, label, span, input } = tags

const documentApiPath = '/api/2024-09-07/documents/'

export function Cms({ basePath, deskStructure, documentSchemas, documentView }) {

  if (typeof window === 'undefined')
    return div('Loading...')

  setContext({ documentSchemas, documentView, basePath })

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
  const $document = useDocument({ id, schemaType })
  const schema = getSchema(schemaType)

  return (
    div(
      DocumentTitle({ $document, schema }),
      DocumentFields({ $document, id, schema })
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
  string: StringField,
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
  const $documentValue = $document.derive(document => document[field.name])
  let localValue = $documentValue.get()

  let dirty = false
  const $valueToUse = $documentValue.derive((newDocumentValue, oldValue) => {
    if (localValue === newDocumentValue) dirty = false
    return dirty ? oldValue : newDocumentValue
  })

  return input({ type: 'text', value: $valueToUse, onInput: handleInput })

  function handleInput(e) {
    dirty = true
    const newValue = e.currentTarget.value
    localValue = newValue
    console.log({ newValue })
    fetch(`${context.basePath}${documentApiPath}${schema.type}/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: field.name,
        value: newValue,
      })
    })
  }
}

function useDocuments({ schemaType }) {
  return useEventSourceAsSignal({
    pathname: `${context.basePath}${documentApiPath}${schemaType}`,
    event: 'documents',
    initialValue: []
  })
}

function useDocument({ id, schemaType }) {
  return useEventSourceAsSignal({
    pathname: `${context.basePath}${documentApiPath}${schemaType}/${id}`,
    event: 'document',
    initialValue: { _id: id, _type: schemaType }
  })
}

function useEventSourceAsSignal({ pathname, event, initialValue }) {
  const [$signal, setValue] = createSignal(initialValue)
  const eventSource = new EventSource(pathname)
  eventSource.addEventListener(event, e => {
    setValue(JSON.parse(e.data))
  })
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

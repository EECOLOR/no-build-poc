import { loop, useOnDestroy } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'
import { tags } from '#ui/tags.js'
import { context, setContext } from './context.js'
import { $pathname, pushState } from './history.js'

const { div, p, ul, li, a } = tags

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

  return (
    div(
      loop($documents, x => x._id, document =>
        Link({ href: [context.basePath, ...path, document._id].join('/')}, document.title)
      )
    )
  )
}

function Document({ id, schemaType }) {
  const $document = getDocument({ id, schemaType })
  return (
    div(
      `document ${id}`,
      p(
        $document.derive(document =>
          document.title
        )
      )
    )
  )
}

function useDocuments({ schemaType }) {
  return useEventSourceAsSignal({
    pathname: `${context.basePath}${documentApiPath}${schemaType}`,
    event: 'documents',
    initialValue: []
  })
}

function getDocument({ id, schemaType }) {
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

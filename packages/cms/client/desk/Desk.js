import { conditional, loop } from '#ui/dynamic.js'
import { tags } from '#ui/tags.js'
import { context, getSchema } from '../context.js'
import { DocumentForm } from '../form/DocumentForm.js'
import { DocumentHistory } from '../history/DocumentHistory.js'
import { $pathname, pushState } from '../machinery/history.js'
import { useEventSourceAsSignal } from '../machinery/useEventSourceAsSignal.js'

const { div, p, ul, li, a, button } = tags

const connecting = Symbol('connecting')

export function Desk({ deskStructure }) {
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
    type === 'document' ? DocumentPane({ id: pane.id, schemaType: pane.schemaType }) :
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
      button({ type: 'button', onClick: handleAddClick, title: `Add ${schema.title}` }, '+'),
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
    pushState(null, undefined, newPath)
  }

  function hack(document) {
    return JSON.stringify(schema.preview(document))
  }
}

function DocumentPane({ id, schemaType }) {
  const $document = useDocument({ id, schemaType })

  return (
    div({ style: { display: 'flex' } },
      conditional($document, doc => doc !== connecting, _ => [
        DocumentForm({ id, $document, schemaType }),
        DocumentHistory({ id, schemaType }),
      ])
    )
  )
}

function useDocument({ id, schemaType }) {
  return useEventSourceAsSignal({
    pathname: `${context.apiPath}/documents/${schemaType}/${id}`,
    events: ['document'],
    initialValue: connecting,
  }).derive(x => typeof x === 'symbol' ? x : x && x.data)
}

function useDocuments({ schemaType }) {
  return useEventSourceAsSignal({
    pathname: `${context.apiPath}/documents/${schemaType}`,
    events: ['documents'],
  }).derive(x => x?.data || [])
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

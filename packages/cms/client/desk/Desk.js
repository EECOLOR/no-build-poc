import { conditional, loop } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'
import { css, tags } from '#ui/tags.js'
import { ButtonAdd, ButtonChevronRight, Link, List } from '../buildingBlocks.js'
import { context, getSchema } from '../context.js'
import { DocumentForm } from '../form/DocumentForm.js'
import { DocumentHistory } from '../history/DocumentHistory.js'
import { $pathname, pushState } from '../machinery/history.js'
import { useCombined } from '../machinery/useCombined.js'
import { useEventSourceAsSignal } from '../machinery/useEventSourceAsSignal.js'

const { div, input } = tags

const connecting = Symbol('connecting')

Desk.style = css`& {
  display: flex;
  flex-direction: column;
  min-height: 100%;

  & > * {
    padding: 0.5rem;
  }

  & > :not(:first-child, :last-child) {
    border-bottom: 1px solid lightgray;
  }

  & > :last-child {
    flex-grow: 1;
  }
}`
export function Desk({ deskStructure }) {
  return (
    div(
      Desk.style,
      DeskHeader(),
      Panes({ firstPane: deskStructure.pane }),
    )
  )
}

function DeskHeader() {
  return div('CMS')
}

Panes.style = css`& {
  display: flex;

  & > :not(:nth-child(2)) {
    padding-left: 1rem;
  }

  & > * {
    padding-right: 1rem;
  }

  & > :not(:last-child) {
    max-width: 20rem;
    flex-shrink: 0;
  }

  & > :not(:first-child) {
    border-right: 1px solid lightgray;
  }
}`
function Panes({ firstPane }) {
  const $panesWithPath = $pathname.derive(pathname => {
    const pathSegments = pathname.replace(context.basePath, '').slice(1).split('/')
    return resolvePanes(firstPane, pathSegments)
  })

  return (
    div(
      Panes.style,
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
    div(
      List({ renderItems: renderItem =>
        items.map(item =>
          renderItem(
            ListItem({
              href: [context.basePath, ...path, item.slug].join('/'),
              title: item.label,
            })
          )
        )
      })
    )
  )
}

DocumentListPane.style = css`& {
  & > :not(:first-child, :last-child) {
    margin-bottom: 0.5rem;
  }
}`
function DocumentListPane({ schemaType, path }) {
  const $documents = useDocuments({ schemaType })
  const schema = getSchema(schemaType)
  if (!schema) throw new Error(`Could not find schema '${schemaType}'`)

  const [$filter, setFilter] = createSignal('')
  const $filteredDocuments = useCombined($documents, $filter)
    .derive(([documents, filter]) => documents.filter(doc =>
      schema.preview(doc).title.toLowerCase().includes(filter.toLowerCase()))
    )

  return (
    div(
      DocumentListPane.style,
      DocumentListHeader({ schema, onFilterChange: handleFilterChange, onAddClick: handleAddClick }),
      List({ renderItems: renderItem =>
        loop($filteredDocuments, x => x._id + hack(x), document => // TODO: document should probably be a signal, if the id does not change, nothing will be re-rendered
          renderItem(
            ListItem({
              href: [context.basePath, ...path, document._id].join('/'),
              title: schema.preview(document).title ,
            })
          )
        )
      })
    )
  )

  function handleAddClick() {
    const newPath = `${context.basePath}/${path.concat(window.crypto.randomUUID()).join('/')}`
    pushState(null, undefined, newPath)
  }

  function handleFilterChange(value) {
    setFilter(value)
  }

  function hack(document) {
    return JSON.stringify(schema.preview(document))
  }
}

DocumentListHeader.style = css`& {
  display: flex;
  gap: 0.5rem;

  & > input {
    flex-grow: 1;
  }
}`
function DocumentListHeader({ schema, onFilterChange, onAddClick }) {
  return (
    div(
      DocumentListHeader.style,
      input({ type: 'text', onInput: e => onFilterChange(e.currentTarget.value) }),
      ButtonAdd({ title: `Add ${schema.title}`, onClick: onAddClick }),
    )
  )
}

DocumentPane.style = css`& {
  display: flex;
  gap: 1rem;
}`
function DocumentPane({ id, schemaType }) {
  const $document = useDocument({ id, schemaType })

  return (
    div(
      DocumentPane.style,
      conditional($document, doc => doc !== connecting, _ => [
        DocumentForm({ id, $document, schemaType }),
        DocumentHistory({ id, schemaType }),
      ])
    )
  )
}

ListItem.style = css`& {
  display: flex;
  text-decoration: none;
  color: inherit;
  justify-content: space-between;
  gap: 1rem;

  &:hover, &.active {
    background-color: lightblue;
  }

  & > button {
    border: none;
  }
}`
function ListItem({ href, title }) {
  const $className = $pathname.derive(pathname => pathname.startsWith(href) ? 'active' : '')
  return Link({ className: $className, href },
    ListItem.style,
    title,
    ButtonChevronRight({ disabled: true })
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

/** @returns {Array<{ pane: any, path: Array<string> }>} */
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

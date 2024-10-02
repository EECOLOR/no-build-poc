import { conditional, loop } from '#ui/dynamic.js'
import { css, tags } from '#ui/tags.js'
import { ButtonAdd, ButtonChevronRight, Link, List } from '../buildingBlocks.js'
import { context, getSchema } from '../context.js'
import { DocumentForm } from '../form/DocumentForm.js'
import { DocumentHistory } from '../history/DocumentHistory.js'
import { $pathname, pushState } from '../machinery/history.js'
import { useEventSourceAsSignal } from '../machinery/useEventSourceAsSignal.js'

const { div, a, button } = tags

const connecting = Symbol('connecting')

Desk.style = css`& {
  display: flex;
  flex-direction: column;

  & > * {
    padding: 0.5rem;
  }

  & > :not(:first-child, :last-child) {
    border-bottom: 1px solid lightgray;
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
    padding-left: 0.5rem;
  }

  & > :not(:last-child) {
    padding-right: 0.5rem;
    max-width: 20rem;
    flex-shrink: 0;
  }

  & > :not(:first-child, :last-child) {
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

function DocumentListPane({ schemaType, path }) {
  const $documents = useDocuments({ schemaType })
  const schema = getSchema(schemaType)
  if (!schema) throw new Error(`Could not find schema '${schemaType}'`)

  return (
    div(
      ButtonAdd({ title: `Add ${schema.title}`, onClick: handleAddClick }),
      List({ renderItems: renderItem =>
        loop($documents, x => x._id + hack(x), document => // TODO: document should probably be a signal, if the id does not change, nothing will be re-rendered
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

  function handleAddClick(e) {
    const newPath = `${context.basePath}/${path.concat(window.crypto.randomUUID()).join('/')}`
    pushState(null, undefined, newPath)
  }

  function hack(document) {
    return JSON.stringify(schema.preview(document))
  }
}

DocumentPane.style = css`& {
  display: flex;
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

  &:hover {
    background-color: lightblue;
  }
}`
function ListItem({ href, title }) {
  return Link({ href },
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

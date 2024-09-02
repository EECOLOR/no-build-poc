import { component } from '#ui/component.js'
import { tags } from '#ui/tags.js'

const { div, p, ul, li, a } = tags

export function Cms({ basePath, deskStructure, documentSchemas, documentView }) {

  if (typeof window === 'undefined')
    return div('Loading...')

// We might want to choose to use a 'real' context
  const context = { documentSchemas, documentView, basePath }
  return DeskStructure({ deskStructure, context })
}

function DeskStructure({ deskStructure, context }) {
  return (
    div(
      p('CMS'),
      Panes({ firstPane: deskStructure.pane, context }),
    )
  )
}

function Panes({ firstPane, context }) {
  const pathSegments = document.location.pathname.replace(context.basePath, '').slice(1).split('/')

  const panesWithPath = resolvePanes(firstPane, pathSegments)
console.log(panesWithPath)
  return (
    div(
      { style: { display: 'flex', gap: '20px' }},
      panesWithPath.map(({ pane, path }) => Pane({ pane, path, context }))
    )
  )
}

function Pane({ pane, path, context }) {
  const { type } = pane
  return (
    type === 'list' ? ListPane({ pane, path, context }) :
    type === 'documentList' ? DocumentListPane({ pane, path, context }) :
    type === 'document' ? Document({ pane, path, context }) :
    `Unknown pane type '${type}'`
  )
}

function ListPane({ pane, path, context }) {
  return (
    ul(
      pane.items.map(item =>
        li(
          a({ href: `${[context.basePath, ...path, item.slug].join('/')}` }, item.label)
        )
      )
    )
  )
}

function DocumentListPane({ pane, path }) {
  return (
    div(
      'document list'
    )
  )
}

function Document({ pane, path }) {
  return (
    div(
      'document'
    )
  )
}

function resolvePanes(pane, pathSegments, path = []) {
  console.log(pane, pathSegments, path)
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

  return [{ pane, path }]
}

import { loop } from '#ui/dynamic.js'
import { css } from '#ui/tags.js'
import { context } from '../context.js'
import { $pathname } from '../machinery/history.js'
import { FlexSectionBorderedHorizontal } from '../ui/FlexSection.js'
import { DocumentListPane } from './panes/DocumentListPane.js'
import { DocumentPane } from './panes/DocumentPane.js'
import { ImagePane } from './panes/ImagePane.js'
import { ImagesPane } from './panes/ImagesPane.js'
import { ListPane } from './panes/ListPane.js'

Panes.style = css`
  overflow-x: auto;

  & > *:not(:last-child) {
    flex-shrink: 0;
  }

  & > :last-child {
    flex-grow: 1;
  }
`
export function Panes({ firstPane }) {
  const $panesWithPath = $pathname.derive(pathname => {
    const pathSegments = pathname.replace(context.basePath, '').slice(1).split('/')
    return resolvePanes(firstPane, pathSegments)
  })

  return (
    FlexSectionBorderedHorizontal({ className: 'Panes', css: Panes.style },
      loop(
        $panesWithPath,
        x => x.path.join('/'),
        $paneWithPath => renderPane($paneWithPath.get())
      )
    )
  )
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

  if (pane.type === 'images') {
    return [
      { pane, path },
      {
        pane: { type: 'image', id: nextPathSegment },
        path: path.concat(nextPathSegment),
      }
    ]
  }

  return [{ pane, path }]
}

function renderPane({ pane, path }) {
  const { type } = pane
  return (
    type === 'list' ? ListPane({ items: pane.items, path }) :
    type === 'documentList' ? DocumentListPane({ schemaType: pane.schemaType, path }) :
    type === 'document' ? DocumentPane({ id: pane.id, schemaType: pane.schemaType }) :
    type === 'images' ? ImagesPane({ path }) :
    type === 'image' ? ImagePane({ id: pane.id, path }) :
    `Unknown pane type '${type}'`
  )
}

import { loop } from '#ui/dynamic.js'
import { css } from '#ui/tags.js'
import { context } from '../context.js'
import { $pathname } from '../machinery/history.js'
import { FlexSectionBorderedHorizontal } from '../ui/FlexSection.js'
/** @import { DeskStructure, PaneTypes } from '../cmsConfigTypes.ts' */
/** @import { PanePath, Path } from '../../types.ts' */

Panes.style = css`
  overflow-x: auto;

  & > *:not(:last-child) {
    flex-shrink: 0;
  }

  & > :last-child {
    flex-grow: 1;
  }
`
/** @arg {{ firstPane: DeskStructure.Pane<DeskStructure.PaneTypes>, paneTypes: PaneTypes }} props */
export function Panes({ firstPane, paneTypes }) {
  const $panesWithPath = $pathname.derive(pathname => {
    const pathSegments = pathname.replace(context.basePath, '').slice(1).split('/')
    return resolvePanes(firstPane, pathSegments, paneTypes)
  })

  return (
    FlexSectionBorderedHorizontal({ className: 'Panes', css: Panes.style },
      loop(
        $panesWithPath,
        x => x.path.join('/'),
        $paneWithPath => renderPane($paneWithPath.get(), paneTypes)
      )
    )
  )
}

/**
 * @arg {DeskStructure.Pane<DeskStructure.PaneTypes>} firstPane
 * @arg {Array<string>} pathSegments
 * @arg {PaneTypes} paneTypes
 * @returns {Array<{ pane: any, path: PanePath }>}
 */
function resolvePanes(firstPane, pathSegments, paneTypes) {
  let pane = firstPane
  let path = /** @type {PanePath} */ ([])
  let remainingPathSegments = pathSegments

  const panes = [{ pane, path }]

  while (remainingPathSegments.length) {
    const [nextPathSegment, ...otherPathSegments] = remainingPathSegments

    const resolvePane = getResolvePane(paneTypes, pane)
    if (!resolvePane)
      break

    const { child } = resolvePane({ config: pane, context: { nextPathSegment } })

    if (!child)
      break

    pane = child
    path = path.concat(nextPathSegment)
    panes.push({ pane: child, path })

    remainingPathSegments = otherPathSegments
  }

  return panes
}

/**
 * @param {{ pane: DeskStructure.Pane<DeskStructure.PaneTypes>, path: PanePath }} info
 * @param {PaneTypes} paneTypes
 */
function renderPane({ pane, path }, paneTypes) {
  const renderPane = getRenderPane(paneTypes, pane)
  if (!renderPane)
    return `Unknown pane type '${pane.type}'`

  return renderPane({ pane, path })
}

/**
 * @template {DeskStructure.PaneTypes} T
 * @param {PaneTypes} paneTypes
 * @param {DeskStructure.Pane<T>} pane
 */
function getResolvePane(paneTypes, pane) {
  const info = paneTypes[pane.type]
  return info?.resolvePane
}

/**
 * @template {DeskStructure.PaneTypes} T
 * @param {PaneTypes} paneTypes
 * @param {DeskStructure.Pane<T>} pane
 */
function getRenderPane(paneTypes, pane) {
  const info = paneTypes[pane.type]
  return info?.renderPane
}

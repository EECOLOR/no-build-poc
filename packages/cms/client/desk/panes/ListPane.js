import { List } from '#cms/client/ui/List.js'
import { css } from '#ui/tags.js'
import { context } from '../../context.js'
import { ListItem } from './list/ListItem.js'

/** @import { DeskStructure } from '../../cmsConfigTypes.ts' */

/**
 * @typedef {{
 *   items: Array<ListPaneItemConfig<DeskStructure.PaneTypes>>
 * }} ListPaneConfig
 */

/**
 * @template {DeskStructure.PaneTypes} T
 * @typedef {{
 *   slug: string;
 *   label?: string,
 *   child: DeskStructure.Pane<T>
 * }} ListPaneItemConfig
 */

/** @type {DeskStructure.PaneResolver<ListPaneConfig>} */
export function resolveListPane({ config, context }) {
  const item = config.items.find(x => x.slug === context.nextPathSegment)
  return { child: item?.child }
}

/** @type {DeskStructure.PaneRenderer<ListPaneConfig>} */
export function renderListPane({ pane, path }) {
  return ListPane({ items: pane.items, path })
}

ListPane.style = css`
  max-width: 20rem;
`
export function ListPane({ items, path }) {
  return (
    List({
      className: 'ListPane',
      css: ListPane.style,
      items: items.map(item =>
        ListItem({
          href: [context.basePath, ...path, item.slug].join('/'),
          title: item.label,
        })
      )
    })
  )
}

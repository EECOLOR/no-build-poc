import { css } from '#ui/tags.js'
import { List } from '../../buildingBlocks.js'
import { context } from '../../context.js'
import { ListItem } from './list/ListItem.js'

ListPane.style = css`& {
  max-width: 20rem;
}`
export function ListPane({ items, path }) {
  return (
    List(
      {
        className: 'ListPane',
        renderItems: renderItem =>
          items.map(item =>
            renderItem(
              ListItem({
                href: [context.basePath, ...path, item.slug].join('/'),
                title: item.label,
              })
            )
          )
      },
      ListPane.style,
    )
  )
}

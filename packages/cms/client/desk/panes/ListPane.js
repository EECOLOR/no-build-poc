import { List } from '#cms/client/ui/List.js'
import { css } from '#ui/tags.js'
import { context } from '../../context.js'
import { ListItem } from './list/ListItem.js'

ListPane.style = css`
  max-width: 20rem;
`
export function ListPane({ items, path }) {
  return (
    List(
      {
        className: 'ListPane',
        items: items.map(item =>
          ListItem({
            href: [context.basePath, ...path, item.slug].join('/'),
            title: item.label,
          })
        )
      },
      ListPane.style,
    )
  )
}

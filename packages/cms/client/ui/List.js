import { tags, css } from '#ui/tags.js'
import { loop } from '#ui/dynamic.js'
import { scrollable } from './scrollable.js'

const { li } = tags

List.style = css`
  display: flex;
  flex-direction: column;
  gap: var(--gap, var(--default-gap));

  & > li {
    list-style-type: none;
  }
`
export function List({ className = undefined, css = undefined, items }, ...children) {
  return scrollable.ul({ className, css: [List.style, css] },
    ...children,
    items.map(x => li(x))
  )
}

export function ListSignal({ className = undefined, css = undefined, signal, getKey, renderItem }, ...children) {
  return scrollable.ul({ className, css: [List.style, css] },
    ...children,
    loop(signal, getKey, ($item, key) => li(renderItem($item, key))),
  )
}

import { tags, css } from '#ui/tags.js'
import { loop } from '#ui/dynamic.js'
import { scrollable } from './scrollable.js'

const { li } = tags

List.style = css`& {
  display: flex;
  flex-direction: column;
  min-height: 0; /* 'display: flex' sets min-height to auto */
  gap: var(--gap, 0.3rem);

  & > li {
    display: block;
    list-style-type: none;
  }
}`
export function List({ className = undefined, items }, ...children) {
  return scrollable.ul({ className },
    List.style,
    ...children,
    items.map(x => li(x))
  )
}

export function ListSignal({ className = undefined, signal, getKey, renderItem }, ...children) {
  return scrollable.ul({ className },
    List.style,
    ...children,
    loop(signal, getKey, ($item, key) => li(renderItem($item, key))),
  )
}

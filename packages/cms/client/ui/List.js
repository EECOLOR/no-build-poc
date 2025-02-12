import { tags, css, combineCss } from '#ui/tags.js'
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
export function List({ className = undefined, css, items }, ...children) {
  return scrollable.ul({ className, css: combineCss(List.style, css) },
    ...children,
    items.map(x => li(x))
  )
}

export function ListSignal({ className = undefined, css, signal, getKey, renderItem }, ...children) {
  return scrollable.ul({ className, css: combineCss(List.style, css) },
    ...children,
    loop(signal, getKey, ($item, key) => li(renderItem($item, key))),
  )
}

import { tags, css } from '#ui/tags.js'
import { loop } from '#ui/dynamic.js'
import { scrollable } from './scrollable.js'
import { Signal } from '#ui/signal.js'
/** @import { Children, Child } from '#ui/tags.js' */

const { li } = tags

List.style = css`
  display: flex;
  flex-direction: column;
  gap: var(--gap, var(--default-gap));

  & > li {
    list-style-type: none;
  }
`
/**
 * @arg {{
 *   className?: string,
 *   css?: string,
 *   items: Array<Child<any>>
 * }} props
 * @arg  {Children<any>} children
 * @returns
 */
export function List({ className = undefined, css = undefined, items }, ...children) {
  return scrollable.ul({ className, css: [List.style, css] },
    ...children,
    items.map(item => li(item))
  )
}

/**
 * @template T
 * @template K
 * @arg {{
 *   className?: string,
 *   css?: string,
 *   signal: Signal<Array<T>>,
 *   getKey: (item: T) => K,
 *   renderItem: ($item: Signal<T>, key: K) => any,
 * }} props
 * @arg  {Children<any>} children
 * @returns
 */
export function ListSignal({ className = undefined, css = undefined, signal, getKey, renderItem }, ...children) {
  return scrollable.ul({ className, css: [List.style, css] },
    ...children,
    loop(signal, getKey, ($item, key) => li(renderItem($item, key))),
  )
}

import { tags, css, Tag } from '#ui/tags.js'
import { separatePropsAndChildren } from '#ui/utils.js'
/** @import { TagConstructor, TagNames } from '#ui/tags.js' */

/** @type {typeof tags & (<T extends (...args:any[]) => any>(element: T) => (...args: Parameters<T>) => Tag<any>)} */
export const indented = new Proxy(/** @type {any} */ (function(){}), {
  /** @arg {typeof tags} target @arg {keyof tags} p */
  get(target, p) {
    return Indented.bind(null, tags[p])
  },

  apply(target, thisArg, [element]) {
    return Indented.bind(null, element)
  }
})

Indented.styles = css`
  padding-left: var(--default-padding);
  border-left: var(--default-border);
`
/**
 * @template {TagNames} tagName
 * @arg {TagConstructor<tagName>} element
 * @arg {[any, ...any]} params
 */
function Indented(element, ...params) {
  const { props, children } = separatePropsAndChildren(params)
  return (
    element({ ...props, css: [Indented.styles, props?.css] },
      ...children,
    )
  )
}

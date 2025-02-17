import { tags, css, Tag } from '#ui/tags.js'
import { separatePropsAndChildren } from '#ui/utils.js'

/** @type {typeof tags & (<T extends (...args:any[]) => any>(element: T) => (...args: Parameters<T>) => Tag<any>)} */
export const indented = new Proxy(/** @type {any} */ (function(){}), {
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
function Indented(element, ...params) {
  const { props, children } = separatePropsAndChildren(params)
  return (
    element({ ...props, css: [Indented.styles, props?.css] },
      ...children,
    )
  )
}

import { tags, css, Tag } from '#ui/tags.js'
import { combineRefs, separatePropsAndChildren } from '#ui/utils.js'
import { useElementSize } from '#ui/hooks.js'

/** @type {typeof tags & (<T extends (...args:any[]) => any>(element: T) => (...args: Parameters<T>) => Tag<any>)} */
export const scrollable = new Proxy(/** @type {any} */ (function(){}), {
  get(target, p) {
    return Scrollable.bind(null, tags[p])
  },

  apply(target, thisArg, [element]) {
    return Scrollable.bind(null, element)
  }
})

Scrollable.styles = css`
  overflow-y: auto;
  overflow-x: visible; /* TODO: does not work, visible is computed as auto when overflow-y is not set to visible, seems we need a wrapper so that we have overflow-x and overflow-y on different elements  */

  &[data-has-scrollbar=true] {
    padding-right: var(--scrollbarPadding, 0.5rem);
  }
`
function Scrollable(element, ...params) {
  const { props, children } = separatePropsAndChildren(params)
  const { ref: scrollbarRef, $hasScrollbar } = useHasScrollbar()
  const combinedRef = combineRefs(scrollbarRef, props?.ref)

  return (
    element(
      {
        ref: combinedRef,
        'data-has-scrollbar': $hasScrollbar,
        ...props,
      },
      Scrollable.styles,
      ...children,
    )
  )
}

function useHasScrollbar() {
  const { $size, ref } = useElementSize()
  const $hasScrollbar = $size.derive(size => Boolean(size) && size.height < size.element.scrollHeight)

  return { ref, $hasScrollbar }
}

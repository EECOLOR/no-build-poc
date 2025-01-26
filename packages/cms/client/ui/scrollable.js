import { tags, css } from '#ui/tags.js'
import { combineRefs, separatePropsAndChildren } from '#ui/utils.js'
import { useElementSize } from '#ui/hooks.js'

/** @type {typeof tags} */
export const scrollable = new Proxy(tags, {
  get(target, p) {
    return Scrollable.bind(null, target[p])
  }
})

Scrollable.styles = css`
  overflow-y: auto;
  overflow-x: hidden;

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

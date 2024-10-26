import { arrowDown, arrowUp, chevronDown, chevronLeft, chevronRight, chevronUp, plus, trash } from '#cms/client/icons.js'
import { tags, css, Tag } from '#ui/tags.js'
import { pushState } from './machinery/history.js'
import { combineRefs, useHasScrollbar } from './machinery/elementHooks.js'
import { separatePropsAndChildren } from '#ui/utils.js'
import { Signal } from '#ui/signal.js'

const { ul, li, button, a, div } = tags

List.style = css`& {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: var(--gap, 0.3rem);

  & > li {
    display: block;
    list-style-type: none;
  }
}`
export function List({ className = undefined, gap = undefined, renderItems }) {
  return scrollable.ul({ className, style: { ...(gap && { '--gap': gap }) } },
    List.style,
    renderItems((...args) =>
      li(...args)
    )
  )
}

/** @type {typeof tags} */
export const scrollable = new Proxy(tags, {
  get(target, p) {
    return Scrollable.bind(null, target[p])
  }
})

Scrollable.styles = css`& {
  overflow-y: auto;

  &[data-has-scrollbar=true] {
    padding-right: var(--scrollbarPadding, 0.5rem);
  }
}`
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

export const ButtonAdd = createIconButton(plus)
export const ButtonUp = createIconButton(arrowUp)
export const ButtonDown = createIconButton(arrowDown)
export const ButtonDelete = createIconButton(trash)
export const ButtonChevronUp = createIconButton(chevronUp)
export const ButtonChevronDown = createIconButton(chevronDown)
export const ButtonChevronRight = createIconButton(chevronRight)
export const ButtonChevronLeft = createIconButton(chevronLeft)
export const ButtonClose = createIconButton(plus, { cssTransform: 'rotate(45deg)' })

export const IconAdd = createIcon(plus)

export function Link({ href, className = undefined }, ...children) {
  return a({ className, href, onClick: linkClick(href) }, ...children)
}

function linkClick(to) {
  return e => {
    if (!shouldNavigate(e))
      return

    e.preventDefault()

    const newPathname = to instanceof Signal ? to.get() : to
    if (window.location.pathname === newPathname)
      return

    pushState(null, undefined, newPathname)
  }
}

function shouldNavigate(e) {
  return (
    !e.defaultPrevented &&
    e.button === 0 &&
    !(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey)
  )
}

Button.style = css`& {
  padding: 0.25rem;
}`
/**
 * @param {props} import('#ui/tags.js').Attributes<'button'>
 * @returns {Tag<'button'>}
 */
export function Button({ label, ...props }) {
  return button({ type: 'button', ...props }, Button.style, label)
}

function createIconStyle(icon, { cssTransform = '' } = {}) {
  return css`& {
    --width: 1.5rem;
    --height: 1.5rem;
    padding: 0.25rem;

    /* lock the width and height independent of the context */
    width: var(--width);
    height: var(--height);
    min-width: var(--width);
    max-width: var(--width);
    min-height: var(--height);
    max-height: var(--height);

    &::before {
      content: '';
      display: block;
      width: 100%;
      height: 100%;

      background-origin: content-box;
      background-image: url('data:image/svg+xml;utf8,${icon}');
      background-position: center;
      background-repeat: no-repeat;

      ${cssTransform && `transform: ${cssTransform};`}
    }

    &:disabled {
      opacity: 0.5;
    }
  }`
}

/** @returns {(props?: import('#ui/tags.js').Attributes<'div'>) => Tag<'div'>} */
function createIcon(icon, { cssTransform = '' } = {}) {
  return props => div(props, createIconStyle(icon, { cssTransform }))
}

/** @returns {(props: import('#ui/tags.js').Attributes<'button'>) => Tag<'button'>} */
function createIconButton(icon, { cssTransform = '' } = {}) {
  return props => button({ type: 'button', ...props }, createIconStyle(icon, { cssTransform }))
}

import { arrowDown, arrowUp, chevronDown, chevronRight, chevronUp, plus, trash } from '#cms/icons.js'
import { tags, css, Tag } from '#ui/tags.js'
import { pushState } from './machinery/history.js'

const { ul, li, button, a } = tags

List.style = css`& {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  & > li {
    display: block;
    list-style-type: none;
  }
}`
export function List({ renderItems }) {

  return ul(
    List.style,
    renderItems((...args) =>
      li(...args)
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

export function Link({ href }, ...children) {
  return a({ href, onClick: linkClick(href) }, ...children)
}

function linkClick(to) {
  return e => {
    if (!shouldNavigate(e))
      return

    e.preventDefault()

    if (window.location.pathname === to)
      return

    pushState(null, undefined, to)
  }
}

function shouldNavigate(e) {
  return (
    !e.defaultPrevented &&
    e.button === 0 &&
    !(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey)
  )
}

/** @returns {(props: import('#ui/tags.js').Attributes<'button'>) => Tag<'button'>} */
function createIconButton(icon) {
  return props => button(
    { type: 'button', ...props },
    css`& {
      width: 1.5rem;
      height: 1.5rem;
      padding: 0.25rem;
      background-origin: content-box;
      background-image: url('data:image/svg+xml;utf8,${icon}');
      background-position: center;
      background-repeat: no-repeat;

      &:disabled {
        opacity: 0.5;
      }
    }`,
  )
}

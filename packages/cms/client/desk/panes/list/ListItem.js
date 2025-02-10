import { $pathname } from '#cms/client/machinery/history.js'
import { Link } from '#cms/client/machinery/Link.js'
import { ButtonChevronRight } from '#cms/client/ui/Button.js'
import { Signal } from '#ui/signal.js'
import { css } from '#ui/tags.js'

ListItem.style = css`
  display: flex;
  text-decoration: none;
  color: inherit;
  justify-content: space-between;
  gap: 1ex;
  position: relative;
  isolation: isolate;

  &:hover, &.active {
    &::before {
      position: absolute;
      inset: calc(-1 * var(--default-padding) / 4);
      display: block;
      content: '';
      background-color: lightblue;
      z-index: -1;
    }
  }

  & > button {
    border: none;
  }
`
export function ListItem({ href, title }) {
  const $className = $pathname.derive(pathname => {
    const activeHref = href instanceof Signal ? href.get() : href
    return pathname.startsWith(activeHref) ? 'active' : ''
  })
  return Link({ className: $className, href },
    ListItem.style,
    title,
    ButtonChevronRight({ disabled: true })
  )
}

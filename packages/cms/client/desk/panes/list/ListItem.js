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

  &:hover, &.active {
      background-color: lightgray;
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
  return Link({ className: $className, css: ListItem.style, href },
    title,
    ButtonChevronRight({ disabled: true })
  )
}

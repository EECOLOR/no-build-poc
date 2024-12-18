import { ButtonChevronRight, Link } from '#cms/client/buildingBlocks.js'
import { $pathname } from '#cms/client/machinery/history.js'
import { Signal } from '#ui/signal.js'
import { css } from '#ui/tags.js'

ListItem.style = css`& {
  display: flex;
  text-decoration: none;
  color: inherit;
  justify-content: space-between;
  gap: 1ex;

  &:hover, &.active {
    background-color: lightblue;
  }

  & > button {
    border: none;
  }
}`
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

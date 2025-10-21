import { tags } from '#ui/tags.js'
import { pushState } from './history.js'
import { Signal } from '#ui/signal.js'
/** @import { Children } from '#ui/tags.js' */

const { a } = tags

/** @arg {{ href: string | Signal<string>, className?: string | Signal<string>, css: string }} props @arg {Children<any>} children */
export function Link({ href, className = undefined, css }, ...children) {
  return a(
    {
      className,
      css,
      href,
      // @ts-expect-error Event type mismatch because of react types
      onClick: linkClick(href)
    },
    ...children
  )
}

/** @arg {string | Signal<string>} to */
function linkClick(to) {
  /** @arg {MouseEvent} e */
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

/** @arg {MouseEvent} e */
function shouldNavigate(e) {
  return (
    !e.defaultPrevented &&
    e.button === 0 &&
    !(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey)
  )
}

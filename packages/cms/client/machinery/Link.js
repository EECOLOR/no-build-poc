import { tags } from '#ui/tags.js'
import { pushState } from './history.js'
import { Signal } from '#ui/signal.js'

const { a } = tags

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

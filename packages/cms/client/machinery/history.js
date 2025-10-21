import { createSignal } from '#ui/signal.js';

const [$pathnameSignal, setPathname] = createSignal(() => window.location.pathname)

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', e => {
    setPathname(window.location.pathname)
  })
}

export const $pathname = $pathnameSignal

/** @arg {any} state @arg {undefined} unused @arg {string} [pathname] */
export function pushState(state, unused, pathname) {
  window.history.pushState(state, unused, pathname)
  setPathname(window.location.pathname)
}



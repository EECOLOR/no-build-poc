import { createSignal } from '#ui/signal.js';

const [$pathnameSignal, setPathname] = createSignal(() => window.location.pathname)

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', e => {
    setPathname(window.location.pathname)
  })
}

export const $pathname = $pathnameSignal

export function pushState(state, unused, pathname = undefined) {
  window.history.pushState(state, unused, pathname)
  setPathname(pathname)
}



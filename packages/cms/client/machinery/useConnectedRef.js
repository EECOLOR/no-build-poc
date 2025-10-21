import { useOnDestroy } from '#ui/dynamic.js'

/** @typedef {(element: Node) => void} Callback */

/** @arg {Callback} callback */
export function useConnectedRef(callback) {
  let destroyed = false
  let cancel = /** @type {() => void} */ (null)

  useOnDestroy(() => {
    destroyed = true
    if (cancel) cancel()
  })

  /** @arg {Node} element */
  return function ref(element) {
    if (destroyed) return
    cancel = onConnect(element, callback)
  }
}

/** @arg {Node} element @arg {Callback} callback */
export function onConnect(element, callback) {
  let timeout = null

  check()

  return function cancel() {
    clearTimeout(timeout)
  }

  function check() {
    if (element.isConnected) callback(element)
    else setTimeout(check)
  }
}

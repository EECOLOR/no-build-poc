import { useOnDestroy } from '#ui/dynamic.js'

export function useConnectedRef(callback) {
  let destroyed = false
  let cancel = null

  useOnDestroy(() => {
    destroyed = true
    if (cancel) cancel()
  })

  return function ref(element) {
    if (destroyed) return
    cancel = onConnect(element, callback)
  }
}

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

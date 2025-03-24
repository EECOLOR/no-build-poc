import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'

/**
 * @param {Parameters<typeof fetch>[0]} url
 * @param {Parameters<typeof fetch>[1]} options
 */
export function useFetch(url, options = undefined) {
  /** @type {{ status: number, body: string, json?: any } | Error | null} */
  const typedNull = null
  const [$state, setState] = createSignal(typedNull)

  if (typeof window === 'undefined')
    return $state

  const controller = new AbortController()
  if (options?.signal)
    throw new Error(`No support has been provided to combine abort signals, if you really need this, implement a combineSignals function (listen for the signals and call abort on another controller)`)

  useOnDestroy(() => controller.abort('Component destroyed'))

  fetch(url, { ...options, signal: controller.signal })
    .then(async response => {
      const body = await response.text()
      const result = { status: response.status, body }
      try { result.json = JSON.parse(body) } catch (e) { }
      setState(result)
    })
    .catch(e => {
      console.error(e) // TODO error handling
      setState(e)
    })

  return $state
}

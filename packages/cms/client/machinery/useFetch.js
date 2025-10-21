import { useOnDestroy } from '#ui/dynamic.js'
import { createSignal } from '#ui/signal.js'
/** @import { ResultType, TypeValidator } from '#validation/types.ts' */
/** @import { Expand } from '#typescript/utils.ts' */

/**
 * @template T
 * @arg {Parameters<typeof fetch>[0]} url
 * @arg {{ fetchOptions?: Parameters<typeof fetch>[1], schema: TypeValidator<T> }} props
 */
export function useFetch(url, { schema, fetchOptions }) {
  /** @typedef {{ status: number, body: string, json?: ReturnType<schema['parse']> }} Result */
  /** @type {Result | Error | null} */
  const typedNull = null
  const [$state, setState] = createSignal(typedNull)

  if (typeof window === 'undefined')
    return $state

  const controller = new AbortController()
  if (fetchOptions?.signal)
    throw new Error(`No support has been provided to combine abort signals, if you really need this, implement a combineSignals function (listen for the signals and call abort on another controller)`)

  useOnDestroy(() => controller.abort('Component destroyed'))

  fetch(url, { ...fetchOptions, signal: controller.signal })
    .then(async response => {
      const body = await response.text()
      const result = /** @type {Result} */ ({ status: response.status, body })
      try { result.json = schema.parse(JSON.parse(body)) } catch (e) { }
      setState(result)
    })
    .catch(e => {
      console.error(e) // TODO error handling
      setState(e)
    })

  return $state
}

import { useOnDestroy } from './dynamic.js'
import { createSignal } from './signal.js'


/**
 * @template {HTMLElement} T
 * @typedef {((element: T) => void) & { current: null | T}} Ref
 */

/**
 * @template {keyof HTMLElementTagNameMap} T
 * @param {T} [hint]
 * @return {Ref<HTMLElementTagNameMap[T]>}
 */
export function useRef(hint) {
  ref.current = null

  useOnDestroy(() => { ref.current = null })

  return ref

  function ref(element) {
    ref.current = element
  }
}

/** @type {null | { width: number, height: number, element: HTMLElement }} */
const initialElementSizeValue = null

export function useElementSize() {
  const [$size, setSize] = createSignal(initialElementSizeValue)

  const observer = new window.ResizeObserver(([entry]) => update(entry.target))
  useOnDestroy(() => observer.disconnect())

  return { ref, $size }

  function ref(element) {
    observer.disconnect()
    if (!element)
      return setSize(initialElementSizeValue)

    update(element)
    observer.observe(element)
  }

  function update(target) {
    setSize({ width: target.offsetWidth, height: target.offsetHeight, element: target })
  }
}

export function useCombined(...signals) {
  const [$combined, setCombined] = createSignal(() => signals.map(signal => signal.get()))

  const subscriptions = []
  for (const [i, signal] of signals.entries()) {
    const unsubscribe = signal.subscribeDirect(value => {
      setCombined(previous => {
        const newValue = previous.slice()
        newValue[i] = value
        return newValue
      })
    })

    subscriptions.push(unsubscribe)
  }

  useOnDestroy(() => {
    for (const unsubscribe of subscriptions) unsubscribe()
  })

  return $combined
}

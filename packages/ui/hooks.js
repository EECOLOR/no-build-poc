import { useOnDestroy } from './dynamic.js'
import { createSignal } from './signal.js'

/** @import { Signal } from './signal.js' */

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
    const unsubscribe = signal.subscribe(value => {
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

/**
 * @template T
 * @param {Signal<T>} signal
 * @param {(value: T) => Boolean} predicate If true, use the left rignal
 * @returns
 */
export function useSplitSignal(signal, predicate) {
  const initialValue = signal.get()
  const [left, right] = predicate(initialValue)
    ? [initialValue, null]
    : [null, initialValue]

  const [$left, setLeft] = createSignal(left)
  const [$right, setRight] = createSignal(right)
  const unsubscribe = signal.subscribe(value => {
    if (predicate(value)) setLeft(value)
    else setRight(value)
  })

  useOnDestroy(unsubscribe)

  return [$left, $right]
}

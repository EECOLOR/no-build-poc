import { useOnDestroy } from './dynamic.js'
import { createSignal } from './signal.js'
/** @import { Signal } from './signal.js' */
/** @import { CombineSignals, ExtractSignalTypes } from './types.ts' */

/**
 * @template {HTMLElement} T
 * @typedef {((element: T) => void) & { current: null | T}} Ref
 */

/**
 * @template {keyof HTMLElementTagNameMap} T
 * @arg {T} [hint]
 * @return {Ref<HTMLElementTagNameMap[T]>}
 */
export function useRef(hint) {
  ref.current = null

  useOnDestroy(() => { ref.current = null })

  return ref

  /** @arg {HTMLElement} element */
  function ref(element) {
    ref.current = element
  }
}

/** @typedef {{ width: number, height: number, element: HTMLElement }} ElementSize */

/** @type {null | ElementSize} */
const initialElementSizeValue = null

export function useElementSize() {
  const [$size, setSize] = createSignal(initialElementSizeValue)

  const observer = new window.ResizeObserver(([entry]) => update(entry.target))
  useOnDestroy(() => observer.disconnect())

  return { ref, $size }

  /** @arg {HTMLElement} element */
  function ref(element) {
    observer.disconnect()
    if (!element)
      return setSize(initialElementSizeValue)

    update(element)
    observer.observe(element)
  }

  /** @arg {Element} target */
  function update(target) {
    if (!(target instanceof HTMLElement))
      throw new Error(`Can only update the size of HTML elements, the current target has another type`)

    setSize({ width: target.offsetWidth, height: target.offsetHeight, element: target })
  }
}

/**
 * @template {Array<Signal<any>>} T
 * @arg {T} signals
 * @returns {CombineSignals<T>}
 */
export function useCombined(...signals) {
  const [$combined, setCombined] = createSignal(() => /** @type {ExtractSignalTypes<T>} */(
    signals.map(signal => signal.get())
  ))

  /** @type {Array<() => void>} */
  const subscriptions = []
  for (const [i, signal] of signals.entries()) {
    const unsubscribe = signal.subscribe(value => {
      setCombined(previous => {
        const newValue = /** @type {ExtractSignalTypes<T>} */ (previous.slice())
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
 * @arg {Signal<T>} signal
 * @arg {(value: T) => Boolean} predicate If true, use the left rignal
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

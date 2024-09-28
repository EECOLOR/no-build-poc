/* Using signals with functions as values does not work */

/** @template T */
export class Signal {

  /** @returns {T} */
  get() { return null }

  /** @param {(value: T, oldValue: T) => void} callback @returns {() => void} */
  subscribe(callback){ return null }

  /** @template X @param {(value: T, previous?: X) => X} f @returns {Signal<X>} */
  derive(f) { return null }

  init() {}
}
Object.defineProperty(Signal, Symbol.hasInstance, { value: o => o.constructor === Signal })

/**
 * @template T
 * @typedef {(newValue: T | ((oldValue: T) => T)) => void} setSignalValue
 */

/**
 * @template T
 * @param {T | (() => T)} initialValue
 * @returns {[Signal<T>, setSignalValue<T>]}
 */
export function createSignal(initialValue) {
  let isInitialized = false
  let value = undefined
  let listeners = []

  const signal = {
    constructor: Signal,

    get() {
      return getValue()
    },

    subscribe(callback) {
      listeners.push(callback)
      return function unsubscribe() {
        const index = listeners.indexOf(callback)
        if (index < 0) return
        listeners.splice(index, 1)
      }
    },

    derive(f) {
      return derived(signal, f)
    },

    init() {
      getValue()
    },
  }

  return [
    signal,
    function setValue(newValueOrFunction) {
      const oldValue = getValue()
      const newValue = isCallable(newValueOrFunction)
        ? newValueOrFunction(oldValue)
        : newValueOrFunction

      if (newValue === oldValue) return
      value = newValue

      for (const callback of listeners) {
        setTimeout(() => { callback(value, oldValue) }, 0)
      }
    },
  ]

  function getValue() {
    if (!isInitialized) {
      isInitialized = true
      value = isCallable(initialValue) ? initialValue() : initialValue
    }

    return value
  }
}

/**
 * @template T @template X
 * @param {Signal<T>} signal
 * @param {(value: T, previous?: X) => X} deriveValue
 * @returns {Signal<X>}
 */
export function derived(signal, deriveValue) {
  const [newSignal, setValue] = createSignal(() => deriveValue(signal.get()))
  // TODO: do we need to unsubscribe?
  signal.subscribe(newValue => setValue(oldValue => deriveValue(newValue, oldValue)))
  return newSignal
}

/**
 * @template {Array<any>} X @template Y @template {(...args: X) => Y} T
 * @param {unknown} value
 * @returns {value is T}
 */
function isCallable(value) {
  return typeof value === 'function'
}

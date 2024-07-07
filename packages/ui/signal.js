/* Using signals with functions as values does not work */

/** @template T */
export class Signal {

  /** @returns {T} */
  get() { return null }

  /** @param {(value: T) => void} callback @returns {() => void} */
  subscribe(callback){ return null }

  /** @template X @param {(value: T, previous?: X) => X} f @returns {Signal<X>} */
  derive(f) { return null }
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
  let value = isCallable(initialValue) ? initialValue() : initialValue
  let listeners = []

  const signal = {
    constructor: Signal,

    get() {
      return value
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
    }
  }

  return [
    signal,
    function setValue(newValueOrFunction) {
      const newValue = isCallable(newValueOrFunction)
        ? newValueOrFunction(value)
        : newValueOrFunction

      if (newValue === value) return
      value = newValue

      for (const callback of listeners) {
        setTimeout(() => { callback(value) }, 0)
      }
    },
  ]
}

/**
 * @template T @template X
 * @param {Signal<T>} signal
 * @param {(value: T, previous?: X) => X} deriveValue
 * @returns {Signal<X>}
 */
export function derived(signal, deriveValue) {
  const [newSignal, setValue] = createSignal(deriveValue(signal.get()))
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

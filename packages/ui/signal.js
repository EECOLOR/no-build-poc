/* Using signals with functions as values does not work */

// The class below only exists for instanceof checks
/** @template T */
export class Signal {

  constructor() {
    throw new Error(`Use 'createSignal' to create a signal`)
  }

  /** @returns {T} */
  get() { return null }

  /** @param {(value: T) => void} callback @returns {() => void} */
  subscribe(callback){ return null }

  /** @template X @param {(value: T) => X} f @returns {Signal<X>} */
  derive(f) { return null }

  /** @returns {string} */
  get stack() { return null }
}
Object.defineProperty(Signal, Symbol.hasInstance, { value: o => o?.constructor === Signal })


function defaultIsEqual(a, b) {
  return a === b
}

/**
 * @template T
 * @typedef {(newValue: T | ((oldValue: T) => T)) => void} setSignalValue
 */

/**
 * @template T
 * @param {T | (() => T)} initialValue
 * @returns {[Signal<T>, setSignalValue<T>]}
 */
export function createSignal(initialValue, isEqual = defaultIsEqual) {
  let isInitialized = false
  let value = undefined
  const listeners = new Set()

  const e = new Error()

  const signal = {
    constructor: Signal,

    get() {
      return getValue()
    },

    subscribe(callback) {
      listeners.add(callback)
      return function unsubscribe() {
        listeners.delete(callback)
      }
    },

    derive(f) {
      return derived(signal, f)
    },

    get stack() {
      return e.stack
    },
  }

  return [
    signal,
    function setValue(newValueOrFunction) {
      const wasInitialized = isInitialized
      const oldValue = getValue()
      const newValue = isCallable(newValueOrFunction)
        ? newValueOrFunction(oldValue)
        : newValueOrFunction

      if (wasInitialized && isEqual(newValue, oldValue))
        return

      value = newValue

      for (const callback of listeners) {
        callback(value, oldValue)
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
 * @param {(value: T) => X} deriveValue
 * @returns {Signal<X>}
 */
export function derived(signal, deriveValue) {
  const e = new Error()

  const derivedSignal = {
    constructor: Signal,

    get() {
      return deriveValue(signal.get())
    },

    subscribe(callback) {
      return signal.subscribe(wrapCallback(callback))
    },

    derive(f) {
      return derived(derivedSignal, f)
    },

    get stack() {
      return e.stack
    },
  }

  return derivedSignal

  function wrapCallback(callback) {
    return value => callback(deriveValue(value))
  }
}

/**
 * @template {Array<any>} X @template Y @template {(...args: X) => Y} T
 * @param {unknown} value
 * @returns {value is T}
 */
function isCallable(value) {
  return typeof value === 'function'
}

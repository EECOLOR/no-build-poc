/* Using signals with functions as values does not work */

// The class below only exists for instanceof checks
/** @template T */
export class Signal {

  constructor() {
    throw new Error(`Use 'createSignal' to create a signal`)
  }

  /** @returns {T} */
  get() { return null }

  /** @arg {(value: T) => void} callback @returns {() => void} */
  subscribe(callback){ return null }

  /** @template X @arg {(value: T) => X} f @returns {Signal<X>} */
  derive(f) { return null }

  /** @returns {string} */
  get stack() { return null }
}
Object.defineProperty(
  Signal,
  Symbol.hasInstance,
  {
    /** @arg {Signal<any>} o */
    value: o => o?.constructor === Signal
  }
)

/** @template T @arg {T} a @arg {T} b */
function defaultIsEqual(a, b) {
  return a === b
}

/**
 * @template T
 * @typedef {(newValue: T | ((oldValue: T) => T)) => void} setSignalValue
 */

/**
 * @template T
 * @arg {T | (() => T)} initialValue
 * @returns {[Signal<T>, setSignalValue<T>]}
 */
export function createSignal(initialValue, isEqual = defaultIsEqual) {
  let isInitialized = false
  /** @type {T} */
  let value = undefined
  const listeners = new Set()

  const e = new Error()

  const signal = {
    constructor: Signal,

    get() {
      return getValue()
    },

    /** @arg {(value: T) => void} callback */
    subscribe(callback) {
      listeners.add(callback)
      return function unsubscribe() {
        listeners.delete(callback)
      }
    },

    /** @template X @arg {(value: T) => X} f @returns {Signal<X>} */
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
 * @arg {Signal<T>} signal
 * @arg {(value: T) => X} deriveValue
 * @returns {Signal<X>}
 */
export function derived(signal, deriveValue) {
  const e = new Error()

  const derivedSignal = {
    constructor: Signal,

    get() {
      return deriveValue(signal.get())
    },

    /** @arg {(value: X) => void} callback */
    subscribe(callback) {
      return signal.subscribe(wrapCallback(callback))
    },

    /** @template Y @arg {(value: X) => Y} f @returns {Signal<Y>} */
    derive(f) {
      return derived(derivedSignal, f)
    },

    get stack() {
      return e.stack
    },
  }

  return derivedSignal

  /** @arg {(value: X) => void} callback */
  function wrapCallback(callback) {
    /** @arg {T} value */
    return value => callback(deriveValue(value))
  }
}

/**
 * @template {Array<any>} X @template Y @template {(...args: X) => Y} T
 * @arg {unknown} value
 * @returns {value is T}
 */
function isCallable(value) {
  return typeof value === 'function'
}

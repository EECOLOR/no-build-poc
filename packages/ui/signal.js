/* Using signals with functions as values does not work */

// The class below only exists for instanceof checks
/** @template T */
export class Signal {

  /** @returns {T} */
  get() { return null }

  /** @param {(value: T, oldValue: T) => void} callback @returns {() => void} */
  subscribe(callback){ return null }

  /** @param {(value: T, oldValue: T) => void} callback @returns {() => void} */
  subscribeDirect(callback){ return null }

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
  const listeners = []
  const directListeners = []

  const e = new Error()

  const signal = {
    constructor: Signal,

    get() {
      return getValue()
    },

    subscribe(callback) {
      return addListener(callback, listeners)
    },

    subscribeDirect(callback) {
      return addListener(callback, directListeners)
    },

    derive(f) {
      return derived(signal, f)
    },

    init() {
      getValue()
    },

    get stack() {
      return e.stack
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

      for (const callback of directListeners) {
        callback(value, oldValue)
      }

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

  function addListener(callback, target) {
    target.push(callback)
    return function unsubscribe() {
      const index = target.indexOf(callback)
      if (index < 0) return
      target.splice(index, 1)
    }
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

  let subscriptions = 0
  let unsubscribe = null
  const e = new Error()

  const derivedSignal = {
    constructor: Signal,

    init: newSignal.init,
    get: newSignal.get,
    derive: f => derived(derivedSignal, f),

    subscribe(callback) {
      return addSubscription(callback, 'subscribe')
    },
    subscribeDirect(callback) {
      return addSubscription(callback, 'subscribeDirect')
    },

    get stack() { return e.stack },
  }

  return derivedSignal

  function connect() {
    unsubscribe = signal.subscribeDirect(newValue =>
      setValue(oldValue => deriveValue(newValue, oldValue))
    )
  }

  function disconnect() {
    unsubscribe()
    unsubscribe = null
  }

  function addSubscription(callback, method) {
    if (!subscriptions) connect()
    subscriptions += 1
    const unsubscribe = newSignal[method](callback)

    return () => {
      unsubscribe()
      subscriptions -= 1
      if (!subscriptions) disconnect()
    }
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

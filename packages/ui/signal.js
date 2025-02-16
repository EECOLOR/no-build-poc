/* Using signals with functions as values does not work */

// The class below only exists for instanceof checks
/** @template T */
export class Signal {

  constructor() {
    throw new Error(`Use 'createSignal' to create a signal`)
  }

  /** @returns {T} */
  get() { return null }

  /** @param {(value: T, oldValue: T) => void} callback @returns {() => void} */
  subscribe(callback){ return null }

  /** @param {(value: T, oldValue: T) => void} callback @returns {() => void} */
  subscribeDirect(callback){ return null }

  /** @template X @param {(value: T, previous?: X) => X} f @returns {Signal<X>} */
  derive(f) { return null }

  /** @returns {string} */
  get stack() { return null }

  // TODO: we probably need a destroy
  /*
    That would be tricky, let's say you have this:

    $b = $a.derive(...).derive(...)

    The middle signal would not be destroyed by a call to destroy unless we chain it, but that
    would be problematic too:

    $b = $a.derive(...)
    $c = $b.derive(...)

    If we destroy $c we don't want $b to be destroyed

    We could add the ability to track the creation of signals. Simlar to the `useOnDestroy`. That way,
    the client renderer could call destroy on all signals created in the 'renderItem' function when the
    UI element is destroyed.
  */
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
  const directListeners = new Set()

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
    target.add(callback)
    return function unsubscribe() {
      target.delete(callback)
    }
  }
}

/**
 * @template T @template X
 * @param {Signal<T>} signal
 * @param {(value: T, previous?: X) => X} deriveValue
 * @returns {Signal<X>}
 */
function derived(signal, deriveValue) {
  const [newSignal, setValue] = createSignal(() => deriveValue(signal.get()))

  signal.subscribeDirect(value => {
    setValue(oldValue => deriveValue(value, oldValue))
  })

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

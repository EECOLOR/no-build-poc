/* Using signals with functions as values does not work */

/**
 * @template T
 * @typedef {{
 *   get(): T
 *   subscribe(callback: (value: T) => void): () => void
 *   derive<X>(f: (value: T, previous?: X) => X): Signal<X>
 * }} Signal
 */

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

  const signal = new class SignalClass {
    get() {
      return value
    }

    subscribe(callback) {
      listeners.push(callback)
      return function unsubscribe() {
        const index = listeners.indexOf(callback)
        if (index < 0) return
        listeners.splice(index, 1)
      }
    }

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

      listeners.forEach((callback, i) => {
        setTimeout(() => { callback(value) }, 0)
      })
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

/** @type {(value: Object) => value is import('./signal.js').Signal<any>}*/
export function isSignal(value) {
  return value.get && value.subscribe
}

/**
 * @template {Array<any>} X @template Y @template {(...args: X) => Y} T
 * @param {unknown} value
 * @returns {value is T}
 */
function isCallable(value) {
  return typeof value === 'function'
}

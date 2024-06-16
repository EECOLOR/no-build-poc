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
 * @param {T | (() => T)} initialValue
 * @returns {[Signal<T>, (newValueOrFunction: T | ((oldValue: T) => T)) => void]}
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
 * @template T
 * @template X
 * @param {Signal<T>} signal
 * @param {(value: T, previous?: X) => X} f
 * @returns {Signal<X>} */
export function derived(signal, f) {
  const [newSignal, setValue] = createSignal(f(signal.get()))
  signal.subscribe(newValue => setValue(oldValue => f(newValue, oldValue)))
  return newSignal
}

/**
 * @template {Array<any>} X
 * @template Y
 * @template {(...args: X) => Y} T
 * @param {unknown} value
 * @returns {value is T}
 */
 function isCallable(value) {
  return typeof value === 'function'
}

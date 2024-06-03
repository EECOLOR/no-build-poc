/* Using signals with functions as values does not work */

/**
 * @template T
 * @typedef {{
 *   toString(): string
 *   get(): T
 *   subscribe(callback: (T) => void): () => void
 * }} Signal
 */

/**
 * @template T
 * @param {T | (() => T)} initialValue
 * @returns {{ signal: Signal<T>, setValue: (T) => void }}
 */
 export function createSignal(initialValue) {
  let value = isCallable(initialValue) ? initialValue() : initialValue
  let listeners = []

  return {
    signal: {
      toString() {
        return String(value)
      },
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
      }
    },

    setValue(newValue) {
      if (newValue === value) return
      value = newValue
      setTimeout(
        () => { listeners.forEach(callback => callback(value)) },
        0
      )
    },
  }
}

/**
 * @template X
 * @template {() => X} T
 * @param {unknown} value
 * @returns {value is T}
 */
 function isCallable(value) {
  return typeof value === 'function'
}

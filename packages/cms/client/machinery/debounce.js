/**
 * @template {any[]} T
 * @param {(...args: T) => void} f
 * @returns {(...args: T) => void}
 */
 export function debounce(f, milliseconds) {
  let timeout = null

  return function debounced(...args) {
    clearTimeout(timeout)
    timeout = setTimeout(f.bind(null, ...args), milliseconds)
  }
}

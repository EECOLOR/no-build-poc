/**
 * @template {any[]} T
 * @arg {(...args: T) => void} f
 * @arg {number} milliseconds
 * @returns {(...args: T) => void}
 */
 export function debounce(f, milliseconds) {
  let timeout = /** @type {any} */ (null)

  return function debounced(...args) {
    clearTimeout(timeout)
    timeout = setTimeout(f.bind(null, ...args), milliseconds)
  }
}

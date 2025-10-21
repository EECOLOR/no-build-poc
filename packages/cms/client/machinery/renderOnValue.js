import { conditional } from '#ui/dynamic.js';
/** @import { Signal } from '#ui/signal.js' */

/** @template T @arg {Signal<T>} signal @arg {(value: T) => any} renderItem */
export function renderOnValue(signal, renderItem) {
  return conditional(signal, isPresent, $value => renderItem($value.get()))

  /** @arg {T} value @returns {value is T} */
  function isPresent(value) {
    return Boolean(value)
  }
}

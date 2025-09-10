import { conditional } from '#ui/dynamic.js';
/** @import { Signal } from '#ui/signal.js' */

/** @template T @arg {Signal<T>} signal @arg {(value: T) => any} renderItem */
export function renderOnValue(signal, renderItem) {
  return conditional(signal, Boolean, $value => renderItem($value.get()))
}

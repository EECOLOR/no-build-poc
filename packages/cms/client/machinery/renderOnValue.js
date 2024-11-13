import { conditional } from '#ui/dynamic.js';

export function renderOnValue(signal, renderItem) {
  return conditional(signal, Boolean, $value => renderItem($value.get()))
}

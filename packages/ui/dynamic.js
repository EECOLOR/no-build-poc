import { Signal } from './signal.js';

const onDestroyCallbacks = [[]]

export function useOnDestroy(callback) {
  onDestroyCallbacks[onDestroyCallbacks.length - 1].push(callback)
}

export function withOnDestroyCapture(f) {
  onDestroyCallbacks.push([])
  const result = f()
  return [result, onDestroyCallbacks.pop()]
}

/** @template T */
export class Loop {
  /**
   * @param {Signal<Array<T>>} signal
   * @param {(value: T) => any} getKey
   * @param {(value: T) => any} renderItem
   */
  constructor(signal, getKey, renderItem) {
    this.signal = signal
    this.getKey = getKey
    this.renderItem = renderItem
  }
}

/**
 * @template T
 * @param {Signal<Array<T>>} signal
 * @param {(value: T) => any} getKey
 * @param {(value: T) => any} renderItem
 */
export function loop(signal, getKey, renderItem) {
  return new Loop(signal, getKey, renderItem)
}

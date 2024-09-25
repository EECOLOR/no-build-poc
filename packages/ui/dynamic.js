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
   * @param {(value: T, index: number) => any} getKey
   * @param {(value: T, index: number) => any} renderItem
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

/** @template T */
export class Conditional {
  /**
   * @param {Signal<T>} signal
   * @param {(value: T) => boolean} predicate
   * @param {(value: T) => any} renderItem
   */
  constructor(signal, predicate, renderItem) {
    this.signal = signal
    this.predicate = predicate
    this.renderItem = renderItem
  }
}

export function conditional(signal, predicate, renderItem) {
  return new Conditional(signal, predicate, renderItem)
}

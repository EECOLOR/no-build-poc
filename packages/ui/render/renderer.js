import { Dynamic, withOnDestroyCapture } from '#ui/dynamic.js'
import { Signal } from '#ui/signal.js'
import { Raw, Tag } from '#ui/tags.js'

export const emptyValues = [false, undefined, null]

/** @typedef {import('#ui/tags.js').TagNames} TagNames */

/**
 * @template T
 * @typedef {{
 *   renderRaw(raw: Raw): Array<T>
 *   renderTag<tagName extends TagNames>(tag: Tag<tagName>): T
 *   renderSignal<X>(signal: Signal<X>): Array<T>
 *   renderDynamic<X>(loop: Dynamic<X>): Array<T>
 *   renderString(value: string): T
 * }} Renderer
 */

/**
 * @template T
 * @typedef {(props: { renderValue(value: unknown): Array<T> }) => Renderer<T>} RendererConstructor
 */

/**
 * @template T
 * @param {RendererConstructor<T>} constructor
 * @returns {(f: () => any) => ({ destroy(): void, result: Array<T> })}
 */
export function createRenderer(constructor) {
  const renderer = constructor({ renderValue })

  return render

  function render(f) {
    const [result, onDestroyCallbacks] = withOnDestroyCapture(() => renderValue(f()))

    return { result, destroy() { for (const callback of onDestroyCallbacks) callback() } }
  }

  function renderValue(value) {
    return (
      emptyValues.includes(value) ? [] :
      Array.isArray(value) ? value.flatMap(x => renderValue(x)) :
      value instanceof Raw ? renderer.renderRaw(value) :
      value instanceof Tag ? [renderer.renderTag(value)] :
      value instanceof Signal ? renderer.renderSignal(value) :
      value instanceof Dynamic ? renderer.renderDynamic(value) :
      [renderer.renderString(String(value))]
    )
  }
}

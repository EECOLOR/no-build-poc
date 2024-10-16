import { Component, _setNodeContext } from '#ui/component.js'
import { Dynamic, withOnDestroyCapture } from '#ui/dynamic.js'
import { Signal } from '#ui/signal.js'
import { Raw, Tag } from '#ui/tags.js'

export const emptyValues = [false, undefined, null]

/** @typedef {import('#ui/tags.js').TagNames} TagNames */
/** @typedef {Readonly<object>} Context */

/**
 * @template T
 * @typedef {{
 *   renderRaw(raw: Raw, context: Context): Array<T>
 *   renderTag<tagName extends TagNames>(tag: Tag<tagName>, context: Context): T
 *   renderSignal<X>(signal: Signal<X>, context: Context): Array<T>
 *   renderDynamic<X>(loop: Dynamic<X>, context: Context): Array<T>
 *   renderString(value: string): T
 * }} Renderer
 */

/**
 * @template T
 * @typedef {(props: { renderValue(value: unknown, context: Context): Array<T> }) => Renderer<T>} RendererConstructor
 */

/**
 * @template T
 * @param {RendererConstructor<T>} constructor
 * @returns {(tagOrComponent: Tag<any> | Component<any>) => ({ destroy(): void, result: T })}
 */
export function createRenderer(constructor) {
  const renderer = constructor({ renderValue })

  return render

  function render(tagOrComponent) {
    const context = {}
    const [result, onDestroyCallbacks] = withOnDestroyCapture(() =>
      tagOrComponent instanceof Component ? renderComponent(tagOrComponent, context) :
      tagOrComponent instanceof Tag ? renderer.renderTag(tagOrComponent, context) :
      renderValue(tagOrComponent, context)
    )

    return { result, destroy() { for (const callback of onDestroyCallbacks) callback() } }
  }

  function renderComponent({ constructor, props, children }, context) {
    const params = props ? [props].concat(children) : children

    const newContext = { parent: context }
    _setNodeContext(newContext)
    const result = renderValue(constructor(...params), newContext)
    _setNodeContext(newContext.parent)

    return result
  }

  function renderValue(value, context) {
    return (
      emptyValues.includes(value) ? [] :
      Array.isArray(value) ? value.flatMap(x => renderValue(x, context)) :
      value instanceof Raw ? renderer.renderRaw(value, context) :
      value instanceof Tag ? [renderer.renderTag(value, context)] :
      value instanceof Component ? renderComponent(value, context) :
      value instanceof Signal ? renderer.renderSignal(value, context) :
      value instanceof Dynamic ? renderer.renderDynamic(value, context) :
      [renderer.renderString(String(value))]
    )
  }
}

import { Component, _setNodeContext } from '#ui/component.js'
import { Loop } from '#ui/dynamic.js'
import { Signal } from '#ui/signal.js'
import { Raw, Tag } from '#ui/tags.js'

export const emptyValues = [false, undefined, null]

/** @typedef {import('#ui/tags.js').TagNames} TagNames */
/** @typedef {Readonly<object>} Context */

/**
 * @template T
 * @typedef {{
 *   renderTag<tagName extends TagNames>(tag: Tag<tagName>, context: Context): T
 *   renderSignal<X>(signal: Signal<X>, context: Context): Array<T>
 *   renderLoop<X>(signal: Loop<X>, context: Context): Array<T>
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
 * @returns {(tagOrComponent: Tag<any> | Component<any>) => T}
 */
export function createRenderer(constructor) {
  const renderer = constructor({ renderValue })

  return render

  function render(tagOrComponent) {
    const context = {}
    return (
      tagOrComponent instanceof Component ? renderComponent(tagOrComponent, context) :
      tagOrComponent instanceof Tag ? renderer.renderTag(tagOrComponent, context) :
      renderValue(tagOrComponent, context)
    )
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
      value instanceof Raw ? [value.value] :
      value instanceof Tag ? [renderer.renderTag(value, context)] :
      value instanceof Component ? renderComponent(value, context) :
      value instanceof Signal ? renderer.renderSignal(value, context) :
      value instanceof Loop ? renderer.renderLoop(value, context) :
      [renderer.renderString(String(value))]
    )
  }
}

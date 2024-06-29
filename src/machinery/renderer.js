import { Component, _setNodeContext } from './component.js'
import { Signal } from './signal.js'
import { Raw, Tag } from './tags.js'

export const emptyValues = [false, undefined, null]

/** @typedef {import('./tags.js').TagNames} TagNames */
/** @typedef {Readonly<object>} Context */

/**
 * @template T
 * @typedef {{
 *   renderTag<tagName extends TagNames>(tag: Tag<tagName>, context: Context): T
 *   renderSignal<X>(signal: Signal<X>, context: Context): Array<T>
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
      throwError(`Can only render tags and components`)
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
      [renderer.renderString(String(value))]
    )
  }
}

/** @returns {never} */
function throwError(message) { throw new Error(message) }

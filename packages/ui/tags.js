import { Component } from './component.js'
import { Dynamic } from './dynamic.js'
import { separatePropsAndChildren } from './utils.js'

export class Raw { constructor(value) { this.value = value } }
export function raw(value) { return new Raw(value) }

/** @template T @typedef {import('./signal.js').Signal<T>} Signal */

/**
 * @typedef {'children' | 'key' | 'ref' | 'dangerouslySetInnerHTML' |
 *   'defaultChecked' | 'defaultValue' |
 *   'suppressContentEditableWarning' | 'suppressHydrationWarning'
 * } ForbiddenJsxProperties
 */

/**
 * @template {object} T
 * @template {keyof T} key
 * @typedef {key extends 'style' ? (T[key] & { [k: `--${string}`]: string }) : T[key]} AllowCustomPropertiesInStyles
 */

/**
 * @template {object} T
 * @typedef {{ [key in keyof T]: (AllowCustomPropertiesInStyles<T, key> | Signal<T[key]>)}} AllowSignalValueAndCustomProperty
 */

/**
 * @template {TagNames} tagName
 * @typedef {AllowSignalValueAndCustomProperty<
 *   Omit<JSX.IntrinsicElements[tagName], ForbiddenJsxProperties | ExcludeTagSpecific<tagName>>
 * >} Attributes
 */

/**
 * @template {string} tagName
 * @typedef {(
 *   tagName extends 'select' ? 'value' :
 *   tagName extends 'textarea' ? 'value' :
 *   never
 * )} ExcludeTagSpecific
 */

/**
 * @template T
 * @typedef {T extends (Tag<any> | Signal<any> | Component<any> | Dynamic<any> | Raw | string | number | boolean | null | undefined | Children<T>) ? T : never} Child
 */

/** @template T @typedef {Array<Child<any>>} Children */
/** @typedef {keyof JSX.IntrinsicElements} TagNames */
/**
 * @template T @template {TagNames} tagName
 * @typedef {(
 *   T extends Child<T> ? Child<T> :
 *   T extends Attributes<tagName> ? Attributes<tagName> :
 *   never
 * )} ChildOrAttributes
 */

export const tags = new Proxy(
  /**
   * @type {{
   *   [tagName in TagNames]: <T, X extends Children<X>>
   *     (childOrAttributes?: ChildOrAttributes<T, tagName>, ...children: X) => Tag<tagName>
   * }}
   */
  ({}),
  {
    /** @param {TagNames} tagName */
    get(_, tagName) {
      return function tag(...params) {
        const { props, children } = separatePropsAndChildren(params)
        return new Tag(tagName, props, children.flat())
      }
    }
  }
)

/** @template {TagNames} tagName */
export class Tag {
  /**
   * @param {tagName} tagName
   * @param {Attributes<tagName>} attributes
   * @param {Children<any>} children
   */
  constructor(tagName, attributes, children) {
    this.tagName = tagName
    this.attributes = attributes
    this.children = children
  }
}

/**
 * @param {Parameters<typeof String.raw>} args
 * @returns {Tag<'style'>}
 */
export function css(...args) {
  return tags.style(`@scope to (*:has(> style) > *) { ${String.raw(...args)} }`)
}

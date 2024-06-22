export class Raw { constructor(value) { this.value = value } }
export function raw(str) { return new Raw(str) }
export const emptyValues = [false, undefined, null]
const emptyObject = {}

/**
 * @template T
 * @typedef {import('/machinery/signal.js').Signal<T>} Signal
 */

/**
 * @typedef {'children' | 'key' | 'ref' | 'dangerouslySetInnerHTML' |
 *   'defaultChecked' | 'defaultValue' |
 *   'suppressContentEditableWarning' | 'suppressHydrationWarning'
 * } ForbiddenJsxProperties
 */

/**
 * @template {object} T
 * @typedef {{ [key in keyof T]: T[key] | Signal<T[key]>}} AllowSignalValue
 */

/**
 * @template {TagNames} tagName
 * @typedef {AllowSignalValue<
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
 * @typedef {T extends Tag<any> | Raw | string | number | boolean | null | undefined | Signal<any> ? T : never} Child
 */

/** @template T @typedef {Array<Child<any>>} Children */
/** @typedef {keyof JSX.IntrinsicElements} TagNames */

export const tags = new Proxy(
  /**
   * @type {{
   *   [tagName in TagNames]: <T, X extends Children<X>>
   *     (childOrAttributes?: Child<T> | Attributes<tagName>, ...children: X) => Tag<tagName>
   * }}
   */
  ({}), {
  /** @param {TagNames} tagName */
  get(_, tagName) {
    return function tag(attributesOrChild = emptyObject, ...children) {
      const hasAttributes = attributesOrChild.constructor === Object
      const attributes = hasAttributes ? attributesOrChild : emptyObject
      if (!hasAttributes) children.unshift(attributesOrChild)
      return new Tag(tagName, attributes, children.flat())
    }
  }
})

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

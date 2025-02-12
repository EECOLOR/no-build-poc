import { Component } from './component.js'
import { Dynamic } from './dynamic.js'
import { Signal } from './signal.js'
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
 * @typedef {key extends 'style' ? ({ [k: `--${string}`]: string } & { [k in keyof T[key]]: T[key][k] | Signal<T[key][k]> }) : T[key]} AllowCustomPropertiesInStyles
 */

/**
 * @template {object} T
 * @typedef {{ [key in keyof T]: (AllowCustomPropertiesInStyles<T, key> | Signal<T[key]>)}} AllowSignalValueAndCustomProperty
 */

/**
 * @template {TagNames} tagName
 * @typedef {AllowSignalValueAndCustomProperty<
 *   Omit<JSX.IntrinsicElements[tagName], ForbiddenJsxProperties | ExcludeTagSpecific<tagName>>
 * > & { ref?: (element: Element) => void } & { [k: `data-${string}`]: any }} Attributes
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
 * @typedef {T extends (Tag<any> | Signal<any> | Component<any> | Dynamic<any> | Array<any> | Raw | string | number | boolean | null | undefined) ? T : never} Child
 */

/**
 * @typedef {Record<string, {}>} PlainObject
 */

/** @template T @typedef {Array<Child<any>>} Children */
/** @typedef {keyof JSX.IntrinsicElements} TagNames */
/**
 * @template T @template {TagNames} tagName
 * @typedef {T extends PlainObject ? Attributes<tagName> : Child<T>} ChildOrAttributes
 */

const styles = new Set()

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
        if (props?.css) {
          const cssString = Array.isArray(props.css) ? props.css.join('') : props.css
          const hash = fnv1aHash(cssString)
          const className = 'c_' + hash
          if (!styles.has(hash)) {
            children.unshift(tags.style(raw(`.${className} { ${cssString} }`)))
          }
          props.className = (
            !props.className ? className :
            props.className instanceof Signal ? props.className.derive(x => x + ' ' + className) :
            props.className + ' ' + className
          )
          delete props.css
        }
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
 * @returns {string}
 */
export function css(...args) {
  return String.raw(...args)
  // return tags.style(raw(`@scope to (*:has(> style) > *) { :scope { ${String.raw(...args)} } }`))
}

export function combineCss(...args) {
  return args.flat().filter(Boolean)
}

const fnv1aOffset = 2166136261
const fnv1aPrime = 16777619

function fnv1aHash(str) {
  let hash = fnv1aOffset >>> 0
  for (let i = 0; i < str.length; i++) {
    hash = hash ^ (str.charCodeAt(i) >>> 0)
    hash = (hash * fnv1aPrime) >>> 0
  }
  return hash.toString(16)
}

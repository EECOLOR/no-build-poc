/** @import { TypeOrArrayOfType } from '#ui/types.ts' */
import { Dynamic } from './dynamic.js'
import { derived, Signal } from './signal.js'
import { useStyle } from './styles/shared.js'
import { separatePropsAndChildren } from './utils.js'

export class Raw { constructor(value) { this.value = value } }
export function raw(value) { return new Raw(value) }

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
 * > & { ref?: (element: Element) => void } & { [k: `data-${string}`]: any } & { css?: TypeOrArrayOfType<string> }} Attributes
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
 * @typedef {T extends (Tag<any> | Signal<any> | Dynamic<any> | Array<any> | Raw | string | number | boolean | null | undefined) ? T : never} Child
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
          const className = useStyle(props.css)

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
}

export function cx(...classNames) {
  const signals = classNames.filter(x => x instanceof Signal)
  if (!signals.length)
    return classNames.filter(Boolean).join(' ')

  return mergeSignals(classNames, classNames => classNames.filter(Boolean).join(' '))
}

/**
 * @template T
 * @param {Array<Signal<string> | string>} potentialSignals
 * @param {(values: Array<string>) => T} callback
 */
function mergeSignals(potentialSignals, callback) {
  const signals = potentialSignals
    .map(potentialSignal =>
      potentialSignal instanceof Signal ? potentialSignal : fixed(potentialSignal)
    )

  return combine(signals).derive(callback)
}

// TODO: we need to move this to signal.js (if we want to keep it)

function fixed(value) {
  const e = new Error()

  const fixedSignal = {
    constructor: Signal,

    get() {
      return value
    },

    subscribe(callback) {
      return noop
    },

    derive(f) {
      return fixed(f(value))
    },

    get stack() {
      return e.stack
    },
  }

  return fixedSignal

  function noop() {}
}

function combine(signals) {
  const e = new Error()

  const combinedSignal = {
    constructor: Signal,

    get() {
      return signals.map(signal => signal.get())
    },

    subscribe(callback) {
      return subscribeToAll('subscribe', callback)
    },

    derive(f) {
      return derived(combinedSignal, f)
    },

    get stack() {
      return e.stack
    },
  }

  return combinedSignal

  function subscribeToAll(method, callback) {
    const unsubscribes = []
    for (const [index, signal] of signals.entries()) {
      unsubscribes.push(signal[method](wrapCallback(callback, index)))
    }
    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe()
      }
    }
  }

  function wrapCallback(callback, index) {
    return (value, oldValue) => {
      const values = combinedSignal.get()
      const oldValues = values.toSpliced(index, 1, oldValue)
      callback(values, oldValues)
    }
  }
}

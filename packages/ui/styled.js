import { Tag, tags } from './tags.js'
import { separatePropsAndChildren } from './utils.js'

const { template, style } = tags

export class Css { constructor(cssString) { this.cssString = cssString } }

/** @param {Parameters<typeof String.raw>} args */
export function css(...args) {
  return new Css(String.raw(...args))
}

export const styled = new Proxy(
    /**
   * @type {{
     *   [tagName in TagNames]: <T1, T2, X extends Children<X>>(
     *     cssOrChildOrAttributes?: Css | ChildOrAttributes<T1, tagName>,
     *     childOrAttributes?: ChildOrAttributes<T2, tagName>,
     *     ...children: X
     *   ) => Tag<tagName>
     * }}
     */
  ({}),
  {
    /** @param {TagNames} tagName */
    get(_, tagName) {
      return function styledTag(cssOrParam, ...params) {
        const hasCss = cssOrParam instanceof Css
        if (!hasCss) params.unshift(cssOrParam)
        const { props, children } = separatePropsAndChildren(params)
        return hasCss
          ? (
            tags[tagName](
              props,
              template({ shadowRootMode: 'open' },
                style(cssOrParam.cssString),
                ...children,
              )
            )
          )
          : tags[tagName](props, ...children)
      }
    }
  }
)

/**
 * @template X
 * @typedef {import('./tags.js').Children<X>} Children
 */

/**
 * @template T
 * @template {TagNames} tagName
 * @typedef {import('./tags.js').ChildOrAttributes<T, tagName>} ChildOrAttributes
 */

/**
 * Tags that can receive a shadow root (https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow)
 *
 * @typedef { 'article' |
 *   'aside' |
 *   'blockquote' |
 *   'body' |
 *   'div' |
 *   'footer' |
 *   'h1' |
 *   'h2' |
 *   'h3' |
 *   'h4' |
 *   'h5' |
 *   'h6' |
 *   'header' |
 *   'main' |
 *   'nav' |
 *   'p' |
 *   'section' |
 *   'span'
 * } TagNames
 */

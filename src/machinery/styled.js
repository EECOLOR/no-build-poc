import { tags } from '#ui/tags.js'
import { separatePropsAndChildren } from '#utils/index.js'

const { template, style } = tags

class Css { constructor(value) { this.value = value } }
export function css(...args) {
  return new Css(String.raw(...args))
}
// TODO: type definition (see tags)
export const styled = new Proxy({}, {
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
              style(cssOrParam.value),
              ...children,
            )
          )
        )
        : tags[tagName](props, ...children)
    }
  }
})

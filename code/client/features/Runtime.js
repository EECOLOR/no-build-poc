import { css, tags } from '#ui/tags.js'

const { p } = tags

Runtime.styles = css`
  color: #002299;
`
export function Runtime({ runtime }) {
  return p({ css: Runtime.styles }, `at `, runtime)
}

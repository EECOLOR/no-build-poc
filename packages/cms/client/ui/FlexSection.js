import { css, tags } from '#ui/tags.js'

const { div } = tags

FlexSectionVertical.style = css`
  display: flex;
  flex-direction: column;

  & > *:not(:last-child) {
    margin-block-end: var(--default-padding);
    padding-block-end: var(--default-padding);
    border-block-end: 1px solid lightgray;
  }
`
export function FlexSectionVertical({ className }, ...children) {
  return div({ className }, FlexSectionVertical.style, ...children)
}

FlexSectionHorizontal.style = css`
  display: flex;

  & > *:not(:last-child) {
    margin-inline-end: var(--default-padding);
    padding-inline-end: var(--default-padding);
    border-inline-end: 1px solid lightgray;
  }
`
export function FlexSectionHorizontal({ className }, ...children) {
  return div({ className }, FlexSectionHorizontal.style, ...children)
}

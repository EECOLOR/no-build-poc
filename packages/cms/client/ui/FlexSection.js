import { css, tags } from '#ui/tags.js'

const { div } = tags

FlexSectionHorizontal.style = css`
  display: flex;
  gap: var(--default-gap);
`
export function FlexSectionHorizontal({ className }, ...children) {
  return div({ className }, FlexSectionHorizontal.style, ...children)
}

FlexSectionVertical.style = css`
  display: flex;
  flex-direction: column;
  gap: var(--default-gap);
`
export function FlexSectionVertical({ className }, ...children) {
  return div({ className }, FlexSectionVertical.style, ...children)
}

FlexSectionProperties.style = css`
  display: flex;
  flex-direction: column;
  gap: calc(var(--default-gap) * 2);
`
export function FlexSectionProperties({ className }, ...children) {
  return div({ className }, FlexSectionProperties.style, ...children)
}

FlexSectionBorderedHorizontal.style = css`
  display: flex;

  & > *:not(:last-child) {
    margin-right: var(--default-padding);
    padding-right: var(--default-padding);
    border-right: var(--default-border);
  }
`
export function FlexSectionBorderedHorizontal({ className }, ...children) {
  return div({ className }, FlexSectionBorderedHorizontal.style, ...children)
}

FlexSectionBorderedVertical.style = css`
  display: flex;
  flex-direction: column;

  & > *:not(:last-child) {
    margin-bottom: var(--default-padding);
    padding-bottom: var(--default-padding);
    border-bottom: var(--default-border);
  }
`
export function FlexSectionBorderedVertical({ className }, ...children) {
  return div({ className }, FlexSectionBorderedVertical.style, ...children)
}
